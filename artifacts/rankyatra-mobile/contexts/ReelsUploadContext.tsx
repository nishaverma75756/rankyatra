import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import * as FileSystem from "expo-file-system/legacy";
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
    categories?: string[];
    thumbnailUri?: string;
    thumbnailMime?: string;
    token: string;
    onSuccess?: () => void;
    videoFile?: File;
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

const UPLOAD_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/reels/upload`;

// ── XHR upload — works for both web and native, shows real progress ────────────
function uploadViaXHR(
  videoUri: string | null,
  videoFile: File | null,
  videoMime: string,
  caption: string,
  categories: string[] | undefined,
  thumbnailBase64: string | undefined,
  thumbnailMime: string,
  token: string,
  onProgress: (pct: number) => void,
  xhrRef: React.MutableRefObject<XMLHttpRequest | null>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();

    if (videoFile) {
      // Web: use real File object
      formData.append("video", videoFile, videoFile.name || `reel_${Date.now()}.mp4`);
    } else if (videoUri) {
      // Native: React Native FormData accepts { uri, name, type }
      const filename = videoUri.split("/").pop() ?? `reel_${Date.now()}.mp4`;
      formData.append("video", { uri: videoUri, name: filename, type: videoMime || "video/mp4" } as any);
    } else {
      reject(new Error("No video source")); return;
    }

    formData.append("caption", caption || "");
    if (categories && categories.length > 0) {
      formData.append("categories", categories.join(","));
    }
    if (thumbnailBase64) {
      formData.append("thumbnailBase64", thumbnailBase64);
      formData.append("thumbnailMime", thumbnailMime || "image/jpeg");
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.open("POST", UPLOAD_URL);
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
    videoUri, videoMime, caption, categories, thumbnailUri, thumbnailMime, token, onSuccess, videoFile,
  }: {
    videoUri: string;
    videoMime: string;
    caption: string;
    categories?: string[];
    thumbnailUri?: string;
    thumbnailMime?: string;
    token: string;
    onSuccess?: () => void;
    videoFile?: File;
  }) => {
    (async () => {
      setState({ isUploading: true, progress: 3, statusText: "Preparing...", error: null, done: false });

      try {
        let finalVideoUri: string | null = videoUri;

        if (Platform.OS !== "web") {
          // Copy content:// URI to local cache (required on Android)
          if (Platform.OS === "android" && videoUri.startsWith("content://")) {
            setState((s) => ({ ...s, progress: 6, statusText: "Reading video..." }));
            const dest = `${FileSystem.cacheDirectory}reel_up_${Date.now()}.mp4`;
            await FileSystem.copyAsync({ from: videoUri, to: dest });
            finalVideoUri = dest;
          }

          // Read thumbnail as base64
          let thumbnailBase64: string | undefined;
          if (thumbnailUri) {
            try {
              thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
            } catch {}
          }

          setState((s) => ({ ...s, progress: 10, statusText: "Uploading..." }));

          const result = await uploadViaXHR(
            finalVideoUri, null, videoMime, caption, categories,
            thumbnailBase64, thumbnailMime || "image/jpeg",
            token,
            (pct) => setState((s) => ({
              ...s,
              progress: Math.min(97, 10 + Math.round(Math.min(pct, 100) * 0.87)),
              statusText: `Uploading... ${Math.min(pct, 100)}%`,
            })),
            xhrRef
          );

          handleResult(result, onSuccess, setState);
        } else {
          // Web
          if (!videoFile) {
            setState({ isUploading: false, progress: 0, statusText: "", error: "Video file not found.", done: false });
            return;
          }

          setState((s) => ({ ...s, progress: 10, statusText: "Uploading..." }));

          const result = await uploadViaXHR(
            null, videoFile, videoMime, caption, categories,
            undefined, thumbnailMime || "image/jpeg",
            token,
            (pct) => setState((s) => ({
              ...s,
              progress: Math.min(97, 10 + Math.round(Math.min(pct, 100) * 0.87)),
              statusText: `Uploading... ${Math.min(pct, 100)}%`,
            })),
            xhrRef
          );

          handleResult(result, onSuccess, setState);
        }
      } catch (e: any) {
        const raw: string = e?.message ?? String(e) ?? "";
        const msg = raw.toLowerCase().includes("cancel")
          ? "Upload cancelled."
          : raw.toLowerCase().includes("network")
          ? "Network error. Please check your internet connection and try again."
          : `Upload error: ${raw.slice(0, 100)}`;
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

function handleResult(
  result: { status: number; body: string },
  onSuccess: (() => void) | undefined,
  setState: React.Dispatch<React.SetStateAction<UploadState>>
) {
  if (result.status >= 200 && result.status < 300) {
    setState({ isUploading: false, progress: 100, statusText: "Reel published!", error: null, done: true });
    onSuccess?.();
    setTimeout(
      () => setState({ isUploading: false, progress: 0, statusText: "", error: null, done: false }),
      4000
    );
  } else {
    let msg = `Upload failed (${result.status}).`;
    if (result.status === 413) {
      msg = "Video file is too large. Please reduce the file size and try again.";
    } else if (result.status === 401) {
      msg = "Session expired. Please log in again.";
    } else {
      try {
        const parsed = JSON.parse(result.body);
        msg = parsed?.error ?? parsed?.message ?? msg;
      } catch {
        if (result.body && !result.body.trim().startsWith("<")) {
          msg = result.body.slice(0, 120);
        }
      }
    }
    setState({ isUploading: false, progress: 0, statusText: "", error: msg, done: false });
  }
}

export function useReelsUpload() {
  return useContext(ReelsUploadContext);
}
