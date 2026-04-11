import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import * as FileSystem from "expo-file-system";
// expo-file-system@19: uploadAsync moved to /legacy — must import from there
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
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

// ── Web upload using browser fetch + real File object ─────────────────────
async function uploadViaWebFetch(
  url: string,
  videoFile: File,
  caption: string,
  token: string,
  onProgress: (pct: number) => void,
  xhrRef: React.MutableRefObject<XMLHttpRequest | null>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("video", videoFile, videoFile.name || `reel_${Date.now()}.mp4`);
    formData.append("caption", caption || "");

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

// ── Native upload via expo-file-system/legacy (SDK 54 compatible) ──────────
async function uploadViaLegacyFS(
  url: string,
  videoUri: string,
  videoMime: string,
  caption: string,
  thumbnailBase64: string | undefined,
  thumbnailMime: string,
  token: string
): Promise<{ status: number; body: string }> {
  const result = await uploadAsync(url, videoUri, {
    uploadType: FileSystemUploadType.MULTIPART, // = 1 (number, not string)
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

// ── XHR fallback (React Native native, uses {uri} FormData trick) ────────────
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
    const filename = videoUri.split("/").pop() ?? `reel_${Date.now()}.mp4`;
    formData.append("video", { uri: videoUri, name: filename, type: videoMime || "video/mp4" } as any);
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
    videoUri, videoMime, caption, thumbnailUri, thumbnailMime, token, onSuccess, videoFile,
  }: {
    videoUri: string;
    videoMime: string;
    caption: string;
    thumbnailUri?: string;
    thumbnailMime?: string;
    token: string;
    onSuccess?: () => void;
    videoFile?: File;
  }) => {
    (async () => {
      setState({ isUploading: true, progress: 5, statusText: "Preparing...", error: null, done: false });

      try {
        // Always upload directly to production — Replit dev proxy drops large binary bodies
        const url = `https://rankyatra.in/api/reels/upload`;

        setState((s) => ({ ...s, progress: 10, statusText: "Uploading reel..." }));

        let result: { status: number; body: string };

        if (Platform.OS === "web") {
          // ── Web mode: use real browser File object ──────────────────────────
          if (!videoFile) {
            setState({ isUploading: false, progress: 0, statusText: "", error: "Could not read video file. Try again.", done: false });
            return;
          }
          result = await uploadViaWebFetch(
            url, videoFile, caption,
            token,
            (pct) => setState((s) => ({ ...s, progress: 10 + Math.round(pct * 0.88), statusText: `Uploading... ${pct}%` })),
            xhrRef
          );
        } else {
          // ── Native mode (Android / iOS) ────────────────────────────────────
          // Ensure local file:// URI (content:// doesn't work with XHR on Android)
          let finalVideoUri = videoUri;
          if (Platform.OS === "android" && videoUri.startsWith("content://")) {
            const dest = `${FileSystem.cacheDirectory}reel_up_${Date.now()}.mp4`;
            await FileSystem.copyAsync({ from: videoUri, to: dest });
            finalVideoUri = dest;
          }

          // Read thumbnail as base64 (native only)
          let thumbnailBase64: string | undefined;
          if (thumbnailUri) {
            try {
              thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
            } catch {}
          }

          // Try native legacy uploadAsync first (most reliable on real device)
          try {
            result = await uploadViaLegacyFS(
              url, finalVideoUri, videoMime, caption,
              thumbnailBase64, thumbnailMime || "image/jpeg", token
            );
          } catch (nativeErr: any) {
            console.warn("[ReelsUpload] native uploadAsync failed, falling back to XHR:", nativeErr?.message);
            result = await uploadViaXHR(
              url, finalVideoUri, videoMime, caption,
              thumbnailBase64, thumbnailMime || "image/jpeg", token,
              (pct) => setState((s) => ({ ...s, progress: 10 + Math.round(pct * 0.88), statusText: `Uploading... ${pct}%` })),
              xhrRef
            );
          }
        }

        if (result.status >= 200 && result.status < 300) {
          setState({ isUploading: false, progress: 100, statusText: "Reel published!", error: null, done: true });
          onSuccess?.();
          setTimeout(
            () => setState({ isUploading: false, progress: 0, statusText: "", error: null, done: false }),
            4000
          );
        } else {
          let msg = `Upload failed (${result.status}).`;
          try {
            const parsed = JSON.parse(result.body);
            msg = parsed?.error ?? parsed?.message ?? msg;
          } catch {
            // body is not JSON — show first 120 chars for diagnosis
            if (result.body) msg = `Server error (${result.status}): ${result.body.slice(0, 120)}`;
          }
          console.error("[ReelsUpload] server error:", result.status, result.body?.slice(0, 200));
          setState({ isUploading: false, progress: 0, statusText: "", error: msg, done: false });
        }
      } catch (e: any) {
        const raw: string = e?.message ?? String(e) ?? "";
        console.error("[ReelsUpload] exception:", raw);
        const msg = raw.toLowerCase().includes("network") || raw.toLowerCase().includes("cancelled")
          ? "Network error. Check your connection."
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

export function useReelsUpload() {
  return useContext(ReelsUploadContext);
}
