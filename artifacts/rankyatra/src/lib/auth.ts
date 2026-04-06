import { useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

const TOKEN_KEY = "rankyatra_token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Initialize custom fetch auth header
setAuthTokenGetter(() => getAuthToken());

export function useAuthContext() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    clearAuthToken();
    queryClient.clear();
    setLocation("/login");
  };

  return { handleLogout };
}
