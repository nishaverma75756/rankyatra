import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export interface UploadState {
  isUploading: boolean;
  progress: number;
  statusText: string;
  error: string | null;
  done: boolean;
}

interface ReelsUploadContextType extends UploadState {
  startUpload: (params: {
    videoUri: string;
    videoMime: string;
    caption: string;
    thumbnailUri?: string;
    thumbnailMime?: string;
    token: string;
    onSuccess?: () => void;
  }) => void;
  reset: () => void;
}

const ReelsUploadContext = createContext<ReelsUploadContextType>({
  isUploading: false,
  progress: 0,
  statusText: "",
  error: null,
  done: false,
  startUpload: () => {},
  reset: () => {},
});

// ── Try uploadAsync (native), fallback to XHR FormData ─────────────────────
async function uploadViaFileSystem(
  url: string,
  videoUri: string,
  videoMime: string,
  caption: string,
  thumbnailBase64: string | undefined,
  thumbnailMime: string,
  token: string
): Promise<{ status: number; body: string }> {
  const MULTIPART_TYPE: any =
    (FileSystem as any).FileSystemUploadType?.MULTIPART ?? "MULTIPART";

  if (typeof (FileSystem as any).uploadAsync !== "function") {
    throw new Error("uploadAsync not available");
  }

  const result = await (FileSystem as any).uploadAsync(url, videoUri, {
    uploadType: MULTIPART_TYPE,
    fieldName: "video",
    mimeType: videoMime || "video/mp4",
    parameters: {
      caption: caption || "",
      ...(thumbnailBase64 ? { thumbnailBase64, thumbnailMime } : {}),
    },
    headers: { Authorization: `Bearer ${token}` },
    httpMethod: "POST",
  });
  return { status: result.status, body: result.body };
}

async function uploadViaXHR(
  url: string,
  videoUri: string,
  videoMime: string,
  caption: string,
  thumbnailBase64: string | undefined,
  thumbnailMime: string,
  token: string,
  onProgress: (pct: number) => void,
  xhrRef: React.MutableRefObject<XMLHttpRequest | null>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    const videoFilename = videoUri.split("/").pop() ?? `reel_${Date.now()}.mp4`;
    formData.append("video", { uri: videoUri, name: videoFilename, type: videoMime || "video/mp4" } as any);
    formData.append("caption", caption || "");
    if (thumbnailBase64) {
      formData.append("thumbnailBase64", thumbnailBase64);
      formData.append("thumbnailMime", thumbnailMime);
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}

export function ReelsUploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UploadState>({
    isUploading: false, progress: 0, statusText: "", error: null, done: false,
  });
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    setState({ isUploading: false, progress: 0, statusText: "", error: null, done: false });
  }, []);

  const startUpload = useCallback(({
    videoUri, videoMime, caption, thumbnailUri, thumbnailMime, token, onSuccess,
  }: {
    videoUri: string;
    videoMime: string;
    caption: string;
    thumbnailUri?: string;
    thumbnailMime?: string;
    token: string;
    onSuccess?: () => void;
  }) => {
    (async () => {
      setState({ isUploading: true, progress: 5, statusText: "Preparing...", error: null, done: false });

      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "rankyatra.in";
        const url = `https://${domain}/api/reels/upload`;

        // On Android ensure we have a local file URI (not content://)
        let finalVideoUri = videoUri;
        if (Platform.OS === "android" && videoUri.startsWith("content://")) {
          const dest = `${FileSystem.cacheDirectory}reel_up_${Date.now()}.mp4`;
          await FileSystem.copyAsync({ from: videoUri, to: dest });
          finalVideoUri = dest;
        }

        setState((s) => ({ ...s, progress: 10, statusText: "Uploading reel..." }));

        // Read thumbnail as base64 if available
        let thumbnailBase64: string | undefined;
        if (thumbnailUri) {
          try {
            thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch {}
        }

        let result: { status: number; body: string };

        // Try native uploadAsync first; fall back to XHR
        try {
          result = await uploadViaFileSystem(
            url, finalVideoUri, videoMime, caption,
            thumbnailBase64, thumbnailMime || "image/jpeg", token
          );
        } catch {
          setState((s) => ({ ...s, statusText: "Uploading..." }));
          result = await uploadViaXHR(
            url, finalVideoUri, videoMime, caption,
            thumbnailBase64, thumbnailMime || "image/jpeg", token,
            (pct) => setState((s) => ({ ...s, progress: 10 + Math.round(pct * 0.9), statusText: `Uploading... ${pct}%` })),
            xhrRef
          );
        }

        if (result.status >= 200 && result.status < 300) {
          setState({ isUploading: false, progress: 100, statusText: "Reel published!", error: null, done: true });
          onSuccess?.();
          setTimeout(
            () => setState({ isUploading: false, progress: 0, statusText: "", error: null, done: false }),
            4000
          );
        } else {
          let msg = "Upload failed. Please try again.";
          try { msg = JSON.parse(result.body)?.error ?? msg; } catch {}
          setState({ isUploading: false, progress: 0, statusText: "", error: msg, done: false });
        }
      } catch (e: any) {
        const raw: string = e?.message ?? String(e) ?? "Unknown error";
        const msg = raw.toLowerCase().includes("network") || raw.toLowerCase().includes("cancelled")
          ? "Network error. Check your connection."
          : "Upload failed. Please try again.";
        setState({ isUploading: false, progress: 0, statusText: "", error: msg, done: false });
      }
    })();
  }, []);

  return (
    <ReelsUploadContext.Provider value={{ ...state, startUpload, reset }}>
      {children}
    </ReelsUploadContext.Provider>
  );
}

export function useReelsUpload() {
  return useContext(ReelsUploadContext);
}
