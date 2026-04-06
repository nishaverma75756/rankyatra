import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { getAuthToken, clearAuthToken } from "@/lib/auth";

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const hasToken = !!getAuthToken();

  const { data: user, isLoading } = useGetMe({
    query: { enabled: hasToken, retry: false } as any,
  });

  const logout = useCallback(() => {
    clearAuthToken();
    queryClient.clear();
    setLocation("/login");
  }, [queryClient, setLocation]);

  return {
    user: user ?? null,
    isLoading: hasToken ? isLoading : false,
    isAuthenticated: !!user,
    isAdmin: !!(user as any)?.isAdmin,
    logout,
  };
}
