import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";

const schema = z.object({
  newPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof schema>;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) setInvalidToken(true);
    else setToken(t);
  }, []);

  const onSubmit = async (data: FormValues) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 400) setInvalidToken(true);
        throw new Error(json.error || "Something went wrong");
      }
      setDone(true);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center transform transition-transform group-hover:scale-110 shadow-lg">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <span className="text-3xl font-bold tracking-tight text-foreground">RankYatra</span>
          </Link>
        </div>

        <Card className="border-2 border-border shadow-2xl shadow-secondary/10 backdrop-blur-sm bg-card/90">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center">
              {done ? "Password Reset!" : invalidToken ? "Invalid Link" : "Set New Password"}
            </CardTitle>
            <CardDescription className="text-center">
              {done
                ? "Your password has been updated. You can now log in."
                : invalidToken
                ? "This link is invalid or has expired."
                : "Enter your new password below."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <Button className="w-full" onClick={() => setLocation("/login")}>
                  Log In
                </Button>
              </div>
            ) : invalidToken ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <AlertCircle className="h-16 w-16 text-destructive" />
                <p className="text-center text-sm text-muted-foreground">
                  The reset link has expired or is invalid. Please request a new one.
                </p>
                <Button className="w-full" onClick={() => setLocation("/forgot-password")}>
                  Request New Link
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-secondary">New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" className="h-12 text-md border-border/50 focus-visible:ring-primary" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-secondary">Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" className="h-12 text-md border-border/50 focus-visible:ring-primary" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 text-lg font-bold mt-2 shadow-md hover:shadow-lg transition-all"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Reset Password"}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
