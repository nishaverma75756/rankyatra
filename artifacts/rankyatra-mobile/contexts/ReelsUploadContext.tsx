import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import * as FileSystem from "expo-file-system";
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

const UPLOAD_URL = "https://rankyatra.in/api/reels/upload";

// ── Web upload ────────────────────────────────────────────────────────────────
async function uploadViaWebXHR(
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
        let result: { status: number; body: string };

        if (Platform.OS === "web") {
          if (!videoFile) {
            setState({ isUploading: false, progress: 0, statusText: "", error: "Could not read video file.", done: false });
            return;
          }
          setState((s) => ({ ...s, progress: 10, statusText: "Uploading..." }));
          result = await uploadViaWebXHR(
            videoFile, caption, token,
            (pct) => setState((s) => ({ ...s, progress: 10 + Math.round(pct * 0.88), statusText: `Uploading... ${pct}%` })),
            xhrRef
          );
        } else {
          // Native: copy content:// URI to cache if needed
          let finalVideoUri = videoUri;
          if (Platform.OS === "android" && videoUri.startsWith("content://")) {
            setState((s) => ({ ...s, progress: 8, statusText: "Reading video..." }));
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

          setState((s) => ({ ...s, progress: 12, statusText: "Uploading reel..." }));

          result = await uploadAsync(UPLOAD_URL, finalVideoUri, {
            uploadType: FileSystemUploadType.MULTIPART,
            fieldName: "video",
            mimeType: videoMime || "video/mp4",
            parameters: {
              caption: caption || "",
              ...(thumbnailBase64 ? { thumbnailBase64, thumbnailMime: thumbnailMime || "image/jpeg" } : {}),
            },
            headers: { Authorization: `Bearer ${token}` },
            httpMethod: "POST",
          });

          setState((s) => ({ ...s, progress: 95, statusText: "Saving..." }));
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
          if (result.status === 413) {
            msg = "Video bahut badi hai. Server pe size limit increase karni hogi.";
          } else if (result.status === 401) {
            msg = "Session expire ho gayi. Dobara login karein.";
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
      } catch (e: any) {
        const raw: string = e?.message ?? String(e) ?? "";
        const msg = raw.toLowerCase().includes("network") || raw.toLowerCase().includes("failed to fetch")
          ? "Network error. Internet check karein aur dobara try karein."
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
