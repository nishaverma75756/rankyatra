import { Link, useLocation } from "wouter";
import { Menu, X, Wallet, LayoutDashboard, LogOut, Shield, User, CreditCard, Info, Phone, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useGetMe } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";

export function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const { data: meData } = useGetMe();
  const walletBalance = (meData as any)?.walletBalance ?? (user as any)?.walletBalance ?? 0;

  const initials = (user as any)?.name
    ?.split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase() ?? "U";

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img src="/logo.png" alt="RankYatra" className="h-10 w-auto object-contain" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>
            Home
          </Link>
          <Link href="/exams" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/exams" ? "text-primary" : "text-muted-foreground"}`}>
            Exams
          </Link>
          {isAuthenticated && (
            <>
              <Link href="/dashboard" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/dashboard" ? "text-primary" : "text-muted-foreground"}`}>
                Dashboard
              </Link>
              <Link href="/wallet" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/wallet" ? "text-primary" : "text-muted-foreground"}`}>
                Wallet
              </Link>
            </>
          )}
          {isAdmin && (
            <Link href="/admin" className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1 ${location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"}`}>
              <Shield className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
          <Link href="/about" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/about" ? "text-primary" : "text-muted-foreground"}`}>
            About Us
          </Link>
          <Link href="/contact" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/contact" ? "text-primary" : "text-muted-foreground"}`}>
            Contact Us
          </Link>
          <Link href="/faq" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/faq" ? "text-primary" : "text-muted-foreground"}`}>
            FAQ
          </Link>
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link href="/wallet" className="flex items-center gap-1.5 px-3 py-2 rounded-2xl font-bold text-sm transition-colors hover:opacity-90 shrink-0" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">₹{Number(walletBalance).toLocaleString("en-IN")}</span>
                <span className="sm:hidden">₹{Number(walletBalance) >= 1000 ? `${(walletBalance / 1000).toFixed(1)}k` : walletBalance}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={(user as any)?.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-2 p-2">
                    <div>
                      <p className="font-semibold text-sm">{(user as any)?.name}</p>
                      <p className="text-xs text-muted-foreground">{(user as any)?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/wallet" className="flex items-center gap-2 cursor-pointer">
                      <Wallet className="h-4 w-4" /> Wallet
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer text-primary">
                          <Shield className="h-4 w-4" /> Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

    </header>

      {/* Mobile drawer backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile drawer — slides in from right, exactly viewport height */}
      <div
        className={`fixed top-0 bottom-0 right-0 z-50 w-72 bg-background shadow-2xl md:hidden flex flex-col transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <img src="/logo.png" alt="RankYatra" className="h-9 w-auto object-contain" />
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Nav links — grows to fill remaining space */}
        <nav className="flex flex-col px-3 py-4 gap-1 flex-1 overflow-y-auto">
          <Link href="/" onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${location === "/" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
            Home
          </Link>
          <Link href="/exams" onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${location === "/exams" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
            Exams
          </Link>
          <Link href="/leaderboard" onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${location === "/leaderboard" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
            Leaderboard
          </Link>
          {isAuthenticated && (
            <>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${location === "/dashboard" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
              <Link href="/wallet" onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${location === "/wallet" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
                <Wallet className="h-4 w-4" /> Wallet
              </Link>
              <Link href="/profile" onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${location === "/profile" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
                <User className="h-4 w-4" /> Profile
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-primary ${location.startsWith("/admin") ? "bg-primary/10" : "hover:bg-primary/5"}`}>
                  <Shield className="h-4 w-4" /> Admin Panel
                </Link>
              )}
              {/* Sign Out right below nav links */}
              <div className="border-t border-border mt-2 pt-2">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => { logout(); setMobileOpen(false); }}>
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </>
          )}
          {/* Company links — always visible */}
          <div className="border-t border-border mt-2 pt-2 space-y-0.5">
            <p className="px-4 py-1 text-xs font-black text-muted-foreground uppercase tracking-wider">Company</p>
            <Link href="/about" onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${location === "/about" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <Info className="h-4 w-4" /> About Us
            </Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${location === "/contact" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <Phone className="h-4 w-4" /> Contact Us
            </Link>
            <Link href="/faq" onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${location === "/faq" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <HelpCircle className="h-4 w-4" /> FAQ
            </Link>
          </div>
        </nav>

        {/* Bottom — only for unauthenticated users */}
        {!isAuthenticated && (
          <div className="px-3 py-4 border-t border-border shrink-0 flex flex-col gap-2">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
            </Button>
            <Button className="w-full" asChild>
              <Link href="/signup" onClick={() => setMobileOpen(false)}>Get Started</Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
