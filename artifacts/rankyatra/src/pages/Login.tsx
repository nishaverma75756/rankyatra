import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { setAuthToken } from "@/lib/auth";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, X, AlertCircle } from "lucide-react";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;


export default function Login() {
  const [, setLocation] = useLocation();
  const [loginError, setLoginError] = useState<{ message: string; notFound?: boolean } | null>(null);
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin();

  function getErrorMessage(error: any): { message: string; notFound?: boolean } {
    if (error?.status === 403) return { message: "Account is blocked. Contact admin." };
    const msg = error?.data?.error || error?.data?.message || (error?.message && !error.message.startsWith("HTTP") ? error.message : null);
    if (msg && msg.toLowerCase().includes("google")) {
      return { message: msg };
    }
    if (msg === "Invalid email or password" || error?.status === 401) {
      return { message: "Email ya password sahi nahi hai. Agar account nahi hai to pehle signup karo.", notFound: true };
    }
    return { message: msg || "Login failed. Please try again." };
  }

  const onSubmit = (data: LoginFormValues) => {
    setLoginError(null);
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          setAuthToken(res.token);
          setLocation("/dashboard");
        },
        onError: (error: any) => {
          const err = getErrorMessage(error);
          setLoginError(err);
        },
      }
    );
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Skip / Browse without login */}
      <button
        type="button"
        onClick={() => setLocation("/")}
        className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold text-muted-foreground bg-card border border-border hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
        title="Browse without signing in"
      >
        <X className="h-4 w-4" />
        <span className="hidden sm:inline">Browse as Guest</span>
      </button>

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center group">
            <img src="/logo.png" alt="RankYatra" className="h-14 w-auto object-contain transform transition-transform group-hover:scale-105" />
          </Link>
        </div>


        <Card className="border-2 border-border shadow-2xl shadow-secondary/10 backdrop-blur-sm bg-card/90">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center">Battle Ready?</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your arena.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loginError && (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{loginError.message}</span>
                </div>
                {loginError.notFound && (
                  <button
                    type="button"
                    onClick={() => setLocation("/signup")}
                    className="ml-6 text-primary font-bold underline underline-offset-2 text-left hover:opacity-80"
                  >
                    → Abhi Signup Karo
                  </button>
                )}
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-secondary">Email</FormLabel>
                      <FormControl>
                        <Input placeholder="aspirant@rankyatra.in" className="h-12 text-md border-border/50 focus-visible:ring-primary" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="font-semibold text-secondary">Password</FormLabel>
                        <Link href="/forgot-password" className="text-xs text-primary hover:underline font-semibold">
                          Forgot Password?
                        </Link>
                      </div>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" className="h-12 text-md border-border/50 focus-visible:ring-primary" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-bold mt-6 shadow-md hover:shadow-lg transition-all"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Enter Arena <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <div className="px-6 pb-4">
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or continue with</span>
              </div>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-border/60 hover:bg-muted/50"
                onClick={() => { window.location.href = `${BASE}/api/auth/google`; }}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
            </div>
          </div>
          <CardFooter className="flex flex-col border-t bg-muted/30 pt-6 mt-2">
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/signup" className="font-bold text-primary hover:underline underline-offset-4">
                Register for battle
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
