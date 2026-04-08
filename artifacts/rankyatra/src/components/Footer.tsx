import { Link, useLocation } from "wouter";
import { Trophy, Twitter, Instagram, Linkedin, Youtube, Mail, Phone, MapPin } from "lucide-react";

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLocation(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 group"
    >
      <span className="h-1 w-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors shrink-0" />
      {children}
    </a>
  );
}

function FooterBarLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLocation(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <a href={href} onClick={handleClick} className="text-xs text-muted-foreground hover:text-primary transition-colors">
      {children}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-16">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Column 1 — Logo + About + Social */}
          <div className="space-y-4">
            <Link href="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="w-fit">
              <img src="/logo.png" alt="RankYatra" className="h-12 w-auto object-contain" />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              RankYatra is India's leading competitive exam platform where aspirants take live exams, discover their real rank and win cash prizes — covering SSC, UPSC, Banking, Railways, Defence and more!
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>5/955, Viram Khand 5, Gomtinagar, Lucknow - 226010, UP</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <a href="mailto:rankyatra.in@gmail.com" className="hover:text-primary transition-colors">rankyatra.in@gmail.com</a>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <a href="tel:+919006109415" className="hover:text-primary transition-colors">+91 9006109415</a>
            </div>
            {/* Social links */}
            <div className="flex items-center gap-3 pt-2">
              <a href="https://twitter.com/rankyatra" target="_blank" rel="noopener noreferrer"
                className="h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors text-muted-foreground">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="https://instagram.com/rankyatra" target="_blank" rel="noopener noreferrer"
                className="h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors text-muted-foreground">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://linkedin.com/company/rankyatra" target="_blank" rel="noopener noreferrer"
                className="h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors text-muted-foreground">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="https://youtube.com/@rankyatra" target="_blank" rel="noopener noreferrer"
                className="h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors text-muted-foreground">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Column 2 — Quick Links */}
          <div className="space-y-4">
            <h3 className="font-black text-foreground text-base">Quick Links</h3>
            <ul className="space-y-2.5">
              {[
                { label: "Home", href: "/" },
                { label: "Dashboard", href: "/dashboard" },
                { label: "Leaderboard", href: "/leaderboard" },
                { label: "About Us", href: "/about" },
                { label: "Contact Us", href: "/contact" },
                { label: "FAQ", href: "/faq" },
              ].map(({ label, href }) => (
                <li key={href}>
                  <FooterLink href={href}>{label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Legal */}
          <div className="space-y-4">
            <h3 className="font-black text-foreground text-base">Legal</h3>
            <ul className="space-y-2.5">
              {[
                { label: "Terms & Conditions", href: "/terms" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Refund Policy", href: "/terms" },
                { label: "Responsible Gaming", href: "/terms" },
                { label: "Cookie Policy", href: "/privacy" },
                { label: "Grievance Redressal", href: "/contact" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <FooterLink href={href}>{label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-border mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            © {new Date().getFullYear()} RankYatra Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <FooterBarLink href="/terms">Terms</FooterBarLink>
            <FooterBarLink href="/privacy">Privacy</FooterBarLink>
            <FooterBarLink href="/faq">FAQ</FooterBarLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
