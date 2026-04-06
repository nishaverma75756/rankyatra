import { useEffect } from "react";
import { useLocation } from "wouter";
import { setAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      setAuthToken(token);
      window.location.href = "/dashboard";
    } else {
      toast({
        title: "Login failed",
        description: error || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      window.location.href = "/login";
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Logging you in...</p>
      </div>
    </div>
  );
}
