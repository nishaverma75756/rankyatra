import React, { createContext, useContext, useState, useCallback, useRef } from "react";

export interface UploadState {
  isUploading: boolean;
  progress: number; // 0–100
  error: string | null;
  done: boolean;
}

interface ReelsUploadContextType extends UploadState {
  startUpload: (params: {
    videoBase64: string;
    videoMime: string;
    caption: string;
    thumbnailBase64?: string;
    thumbnailMime?: string;
    token: string;
    onSuccess?: () => void;
  }) => void;
  reset: () => void;
}

const ReelsUploadContext = createContext<ReelsUploadContextType>({
  isUploading: false,
  progress: 0,
  error: null,
  done: false,
  startUpload: () => {},
  reset: () => {},
});

export function ReelsUploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UploadState>({ isUploading: false, progress: 0, error: null, done: false });
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    setState({ isUploading: false, progress: 0, error: null, done: false });
  }, []);

  const startUpload = useCallback(({
    videoBase64, videoMime, caption, thumbnailBase64, thumbnailMime, token, onSuccess
  }: {
    videoBase64: string;
    videoMime: string;
    caption: string;
    thumbnailBase64?: string;
    thumbnailMime?: string;
    token: string;
    onSuccess?: () => void;
  }) => {
    setState({ isUploading: true, progress: 0, error: null, done: false });

    const videoUrl = `data:${videoMime};base64,${videoBase64}`;
    const thumbnailUrl = thumbnailBase64 ? `data:${thumbnailMime ?? "image/jpeg"};base64,${thumbnailBase64}` : undefined;

    const body = JSON.stringify({ videoUrl, thumbnailUrl, caption });
    const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    const url = `${baseUrl}/api/reels`;

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setState((s) => ({ ...s, progress: pct }));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setState({ isUploading: false, progress: 100, error: null, done: true });
        onSuccess?.();
        // Auto-reset after 4 seconds
        setTimeout(() => setState({ isUploading: false, progress: 0, error: null, done: false }), 4000);
      } else {
        setState({ isUploading: false, progress: 0, error: "Upload failed. Please try again.", done: false });
      }
    };

    xhr.onerror = () => {
      setState({ isUploading: false, progress: 0, error: "Network error. Please check your connection.", done: false });
    };

    xhr.onabort = () => {
      setState({ isUploading: false, progress: 0, error: null, done: false });
    };

    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(body);
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
