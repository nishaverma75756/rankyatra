import React, { createContext, useContext, useState, useCallback } from "react";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export interface UploadState {
  isUploading: boolean;
  progress: number; // 0–100
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

export function ReelsUploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    statusText: "",
    error: null,
    done: false,
  });

  const reset = useCallback(() => {
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
    // Run async but don't await so it's fire-and-forget (background upload)
    (async () => {
      setState({ isUploading: true, progress: 5, statusText: "Preparing upload...", error: null, done: false });

      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const url = `https://${domain}/api/reels/upload`;

        // Ensure video URI is a local file URI (not content://)
        let finalVideoUri = videoUri;
        if (Platform.OS === "android" && videoUri.startsWith("content://")) {
          const dest = `${FileSystem.cacheDirectory}reel_upload_${Date.now()}.mp4`;
          await FileSystem.copyAsync({ from: videoUri, to: dest });
          finalVideoUri = dest;
        }

        setState((s) => ({ ...s, progress: 10, statusText: "Uploading reel..." }));

        // Read thumbnail as base64 if present
        let thumbnailBase64: string | undefined;
        if (thumbnailUri) {
          try {
            thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch {}
        }

        // Use FileSystem.uploadAsync — reliable native multipart upload
        const result = await FileSystem.uploadAsync(url, finalVideoUri, {
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "video",
          mimeType: videoMime || "video/mp4",
          parameters: {
            caption: caption || "",
            ...(thumbnailBase64
              ? { thumbnailBase64, thumbnailMime: thumbnailMime || "image/jpeg" }
              : {}),
          },
          headers: { Authorization: `Bearer ${token}` },
          httpMethod: "POST",
        });

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
        const msg = e?.message?.includes("Network request failed")
          ? "Network error. Check your connection and try again."
          : `Upload failed: ${e?.message ?? "Unknown error"}`;
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
