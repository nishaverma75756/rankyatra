import { Link, useLocation } from "wouter";
import { Home, Trophy, BookOpen, User, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const TABS = [
  { label: "Home",        href: "/exams",        icon: Home,      authRequired: false },
  { label: "My Exams",    href: "/dashboard",    icon: BookOpen,  authRequired: true  },
  { label: "Moments",     href: "/moments",      icon: Sparkles,  authRequired: false },
  { label: "Leaderboard", href: "/leaderboard",  icon: Trophy,    authRequired: false },
  { label: "Profile",     href: "/profile",      icon: User,      authRequired: true  },
];

export function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

  const isAdminRoute = location.startsWith("/admin");
  const isAuthRoute = location === "/login" || location === "/signup";
  const isTakeExamRoute = location.includes("/take");
  if (isAdminRoute || isAuthRoute || isTakeExamRoute) return null;

  return (
    <>
      <div className="h-16 md:h-20" />
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-bottom">
        <div className="flex items-stretch justify-around h-16 md:h-20 max-w-lg mx-auto">
          {TABS.map(({ label, href, icon: Icon, authRequired }) => {
            const dest = authRequired && !isAuthenticated ? "/login" : href;
            const isActive = href === "/" ? location === "/" : location.startsWith(href);

            return (
              <Link
                key={label}
                href={dest}
                className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-0 px-1 transition-colors select-none ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-7 rounded-xl transition-all ${
                    isActive ? "bg-primary/10" : ""
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-all ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`}
                  />
                </div>
                <span
                  className={`text-[10px] leading-none font-semibold truncate ${
                    isActive ? "text-primary" : ""
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
