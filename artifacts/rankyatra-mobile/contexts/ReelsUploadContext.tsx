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

const BASE_URL = "https://rankyatra.in";
const CHUNK_SIZE = 400 * 1024; // 400KB per chunk — safe under any Nginx limit

// ── Web upload using XHR with real File object ────────────────────────────────
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

    xhr.open("POST", `${BASE_URL}/api/reels/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}

// ── Native chunked upload (bypasses Nginx size limit) ────────────────────────
async function uploadViaChunks(
  videoUri: string,
  caption: string,
  thumbnailBase64: string | undefined,
  thumbnailMime: string,
  token: string,
  onProgress: (pct: number) => void,
  cancelledRef: React.MutableRefObject<boolean>
): Promise<{ status: number; body: string }> {
  // Step 1: Get file size
  const info = await FileSystem.getInfoAsync(videoUri, { size: true });
  const fileSize = (info as any).size ?? 0;
  if (fileSize === 0) throw new Error("Could not determine video file size");

  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  // Step 2: Init upload session
  const initResp = await fetch(`${BASE_URL}/api/reels/upload-init`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ totalChunks }),
  });
  if (!initResp.ok) {
    const body = await initResp.text();
    return { status: initResp.status, body };
  }
  const { uploadId } = await initResp.json();

  // Step 3: Upload each chunk
  for (let i = 0; i < totalChunks; i++) {
    if (cancelledRef.current) throw new Error("Upload cancelled");

    const position = i * CHUNK_SIZE;
    const length = Math.min(CHUNK_SIZE, fileSize - position);

    const chunkData = await FileSystem.readAsStringAsync(videoUri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });

    const chunkResp = await fetch(`${BASE_URL}/api/reels/upload-chunk`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId, chunkIndex: i, data: chunkData }),
    });

    if (!chunkResp.ok) {
      const body = await chunkResp.text();
      return { status: chunkResp.status, body };
    }

    // Progress: 15% to 85% during chunk upload
    onProgress(Math.round(15 + ((i + 1) / totalChunks) * 70));
  }

  // Step 4: Finalize — assemble chunks + save to DB
  if (cancelledRef.current) throw new Error("Upload cancelled");
  onProgress(90);

  const finalResp = await fetch(`${BASE_URL}/api/reels/upload-finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, caption, thumbnailBase64, thumbnailMime }),
  });

  const finalBody = await finalResp.text();
  return { status: finalResp.status, body: finalBody };
}

export function ReelsUploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UploadState>({
    isUploading: false, progress: 0, statusText: "", error: null, done: false,
  });
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = true;
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
    cancelledRef.current = false;

    (async () => {
      setState({ isUploading: true, progress: 5, statusText: "Preparing...", error: null, done: false });

      try {
        let result: { status: number; body: string };

        if (Platform.OS === "web") {
          // Web: use XHR with real File object (no Nginx issue on web)
          if (!videoFile) {
            setState({ isUploading: false, progress: 0, statusText: "", error: "Could not read video file. Try again.", done: false });
            return;
          }
          setState((s) => ({ ...s, progress: 10, statusText: "Uploading..." }));
          result = await uploadViaWebXHR(
            videoFile, caption, token,
            (pct) => setState((s) => ({ ...s, progress: 10 + Math.round(pct * 0.88), statusText: `Uploading... ${pct}%` })),
            xhrRef
          );
        } else {
          // Native: chunked upload (bypasses Nginx size limit completely)
          let finalVideoUri = videoUri;

          // Ensure local file:// URI (content:// doesn't work with FileSystem.readAsStringAsync)
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

          setState((s) => ({ ...s, progress: 12, statusText: "Starting upload..." }));

          result = await uploadViaChunks(
            finalVideoUri, caption,
            thumbnailBase64, thumbnailMime || "image/jpeg",
            token,
            (pct) => setState((s) => ({ ...s, progress: pct, statusText: `Uploading... ${pct}%` })),
            cancelledRef
          );
        }

        if (cancelledRef.current) return;

        if (result.status >= 200 && result.status < 300) {
          setState({ isUploading: false, progress: 100, statusText: "Reel published! 🎉", error: null, done: true });
          onSuccess?.();
          setTimeout(
            () => setState({ isUploading: false, progress: 0, statusText: "", error: null, done: false }),
            4000
          );
        } else {
          let msg = `Upload failed (${result.status}).`;
          if (result.status === 413) {
            msg = "Video file bahut bada hai. Chhota ya kam quality ka clip try karein.";
          } else if (result.status === 401) {
            msg = "Session expire ho gayi. App restart karein aur dobara login karein.";
          } else if (result.status === 404) {
            msg = "Upload session expire ho gayi. Dobara try karein.";
          } else if (result.status === 500) {
            msg = "Server error aaya. Thodi der baad try karein.";
          } else {
            try {
              const parsed = JSON.parse(result.body);
              msg = parsed?.error ?? parsed?.message ?? msg;
            } catch {
              if (result.body && !result.body.trim().startsWith("<")) {
                msg = `Upload failed: ${result.body.slice(0, 120)}`;
              }
            }
          }
          console.error("[ReelsUpload] server error:", result.status, result.body?.slice(0, 200));
          setState({ isUploading: false, progress: 0, statusText: "", error: msg, done: false });
        }
      } catch (e: any) {
        if (cancelledRef.current) return;
        const raw: string = e?.message ?? String(e) ?? "";
        console.error("[ReelsUpload] exception:", raw);
        const msg = raw.toLowerCase().includes("cancel")
          ? "Upload cancel kar diya."
          : raw.toLowerCase().includes("network") || raw.toLowerCase().includes("failed to fetch")
          ? "Network error. Internet connection check karein aur dobara try karein."
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
