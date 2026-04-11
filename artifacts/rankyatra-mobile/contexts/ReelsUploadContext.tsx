import React, { createContext, useContext, useState, useCallback, useRef } from "react";

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
    setState({ isUploading: true, progress: 0, statusText: "Uploading reel...", error: null, done: false });

    const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    const url = `${baseUrl}/api/reels/upload`;

    const formData = new FormData();

    // Video file — append as blob with proper URI
    const videoFilename = videoUri.split("/").pop() ?? `reel_${Date.now()}.mp4`;
    formData.append("video", {
      uri: videoUri,
      name: videoFilename,
      type: videoMime || "video/mp4",
    } as any);

    // Optional thumbnail
    if (thumbnailUri) {
      const thumbFilename = thumbnailUri.split("/").pop() ?? `thumb_${Date.now()}.jpg`;
      formData.append("thumbnail", {
        uri: thumbnailUri,
        name: thumbFilename,
        type: thumbnailMime || "image/jpeg",
      } as any);
    }

    formData.append("caption", caption);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setState((s) => ({ ...s, progress: pct, statusText: `Uploading... ${pct}%` }));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setState({ isUploading: false, progress: 100, statusText: "Reel published!", error: null, done: true });
        onSuccess?.();
        setTimeout(() => setState({ isUploading: false, progress: 0, statusText: "", error: null, done: false }), 4000);
      } else {
        let msg = "Upload failed. Please try again.";
        try { msg = JSON.parse(xhr.responseText)?.error ?? msg; } catch {}
        setState({ isUploading: false, progress: 0, statusText: "", error: msg, done: false });
      }
    };

    xhr.onerror = () => {
      setState({ isUploading: false, progress: 0, statusText: "", error: "Network error. Check your connection.", done: false });
    };

    xhr.onabort = () => {
      setState({ isUploading: false, progress: 0, statusText: "", error: null, done: false });
    };

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
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
