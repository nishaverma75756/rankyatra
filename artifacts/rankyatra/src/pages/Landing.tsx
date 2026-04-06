import { Link } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  Trophy, Zap, Users, Award, ArrowRight, CheckCircle,
  TrendingUp, Shield, Clock, Star, BookOpen, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  { value: "50,000+", label: "Active Aspirants" },
  { value: "1,200+", label: "Exams Conducted" },
  { value: "₹25 Lakh+", label: "Prize Money Distributed" },
  { value: "4.8 ★", label: "User Rating" },
];

const steps = [
  {
    number: "01",
    icon: Users,
    title: "Create Account",
    desc: "Sign up for free — just your name, email and password. Ready in 30 seconds.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    number: "02",
    icon: Zap,
    title: "Join an Exam",
    desc: "Add ₹5 to your wallet, choose your favourite exam and enter the live competition.",
    color: "bg-orange-100 text-orange-600",
  },
  {
    number: "03",
    icon: Trophy,
    title: "Win Prizes",
    desc: "Top the leaderboard, get your name noticed and receive cash prizes directly in your wallet!",
    color: "bg-green-100 text-green-600",
  },
];

const features = [
  { icon: Zap, title: "Live Competition", desc: "Compete with thousands of students in real-time — exactly like a government exam experience.", color: "text-orange-500" },
  { icon: Clock, title: "20-Minute Exams", desc: "Quick, focused exams that give you fast feedback on your preparation. Easy to practice daily.", color: "text-blue-500" },
  { icon: Award, title: "Cash Prizes", desc: "Prizes are distributed across all ranks — not just the top. Hard work is always rewarded.", color: "text-amber-500" },
  { icon: TrendingUp, title: "Real Rank", desc: "Know your actual rank — state level, national level. Find out exactly where you stand!", color: "text-green-500" },
  { icon: Shield, title: "100% Secure", desc: "Your data and money are completely safe. SSL encryption, secure payment gateway and verified prizes.", color: "text-purple-500" },
  { icon: BookOpen, title: "All Exam Categories", desc: "SSC, UPSC, Banking, Railways, Defence, NEET, IIT JEE — all major competitive exams covered.", color: "text-red-500" },
];

const categories = [
  { name: "SSC", emoji: "📋", color: "bg-blue-50 border-blue-200 hover:bg-blue-100", desc: "CGL, CHSL, MTS" },
  { name: "UPSC", emoji: "🏛️", color: "bg-purple-50 border-purple-200 hover:bg-purple-100", desc: "IAS, IPS, IFS" },
  { name: "Banking", emoji: "🏦", color: "bg-green-50 border-green-200 hover:bg-green-100", desc: "PO, Clerk, SO" },
  { name: "Railways", emoji: "🚂", color: "bg-amber-50 border-amber-200 hover:bg-amber-100", desc: "NTPC, Group D" },
  { name: "Defence", emoji: "🪖", color: "bg-red-50 border-red-200 hover:bg-red-100", desc: "NDA, CDS, AFCAT" },
  { name: "NEET", emoji: "⚕️", color: "bg-teal-50 border-teal-200 hover:bg-teal-100", desc: "Medical Entrance" },
];

const testimonials = [
  { name: "Priya S.", city: "Lucknow", exam: "SSC CGL", text: "RankYatra gave me a real exam-like experience. In my very first month, my rank jumped from 500+ to 87!", rating: 5 },
  { name: "Rohit K.", city: "Patna", exam: "Banking PO", text: "Such a big competition for just ₹5! I won prizes and improved my preparation at the same time. Best platform!", rating: 5 },
  { name: "Anjali M.", city: "Jaipur", exam: "UPSC", text: "I can track my accuracy and identify weak areas. My performance improved significantly within a month.", rating: 5 },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">

        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-background to-amber-50/60 py-16 sm:py-24">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="relative container mx-auto px-4 max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-1.5 text-sm font-bold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Live Exams Are Running — Join Now!
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-foreground leading-tight mb-6">
              India's{" "}
              <span className="text-primary">#1</span>{" "}
              Competitive<br className="hidden sm:block" /> Exam Platform
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Join live exams for just <strong className="text-foreground">₹5</strong>, compete with lakhs of students, know your real rank — and win <strong className="text-foreground">cash prizes</strong>!
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
              <Button size="lg" className="gap-2 px-8 py-6 text-base font-bold shadow-lg shadow-primary/30" asChild>
                <Link href="/signup">
                  Get Started — Free! <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8 py-6 text-base font-bold" asChild>
                <Link href="/exams">Browse Exams</Link>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {["👨‍💼","👩‍💻","👨‍🎓","👩‍🎓","👨‍💼"].map((e, i) => (
                  <div key={i} className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">{e}</div>
                ))}
              </div>
              <span><strong className="text-foreground">50,000+</strong> aspirants already joined</span>
              <div className="hidden sm:flex items-center gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                <span className="ml-1">4.8/5</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ STATS ═══ */}
        <section className="bg-primary py-10">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-primary-foreground">
              {stats.map(({ value, label }) => (
                <div key={label}>
                  <p className="text-3xl font-black">{value}</p>
                  <p className="text-sm text-primary-foreground/70 mt-1 font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-bold text-sm uppercase tracking-widest mb-2">Simple Process</p>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground">How It Works</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
              {steps.map(({ number, icon: Icon, title, desc, color }) => (
                <Card key={number} className="relative text-center border-primary/10 hover:shadow-lg transition-shadow">
                  <CardContent className="p-8">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-black px-3 py-1 rounded-full">{number}</div>
                    <div className={`h-16 w-16 rounded-2xl ${color} flex items-center justify-center mx-auto mb-5 mt-3`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-black text-foreground mb-3">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CATEGORIES ═══ */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-bold text-sm uppercase tracking-widest mb-2">All Exams</p>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground">Your Exam Is Here</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {categories.map(({ name, emoji, color, desc }) => (
                <Link key={name} href={`/exams?category=${name}`}>
                  <div className={`border rounded-2xl p-5 text-center cursor-pointer transition-all hover:shadow-md ${color}`}>
                    <div className="text-4xl mb-3">{emoji}</div>
                    <p className="font-black text-foreground text-lg">{name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button variant="outline" asChild>
                <Link href="/exams">View All Exams <ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-bold text-sm uppercase tracking-widest mb-2">Why RankYatra?</p>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground">What No Other Platform Offers</h2>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
              {features.map(({ icon: Icon, title, desc, color }) => (
                <Card key={title} className="border-border hover:border-primary/20 hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <Icon className={`h-7 w-7 mb-3 ${color}`} />
                    <h3 className="font-black text-foreground mb-1.5">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TESTIMONIALS ═══ */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-primary font-bold text-sm uppercase tracking-widest mb-2">Real Users</p>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground">What Our Users Say</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map(({ name, city, exam, text, rating }) => (
                <Card key={name} className="border-primary/10">
                  <CardContent className="p-6">
                    <div className="flex mb-3">
                      {Array.from({ length: rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{text}"</p>
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                        {name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">{exam} · {city}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FINAL CTA ═══ */}
        <section className="py-20 bg-primary">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <Trophy className="h-14 w-14 text-primary-foreground mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl sm:text-4xl font-black text-primary-foreground mb-4">
              Start Your Journey Today!
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
              50,000+ aspirants are already competing. One small step can change your rank forever.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" variant="secondary" className="gap-2 px-8 py-6 text-base font-bold" asChild>
                <Link href="/signup">Create Free Account <ArrowRight className="h-5 w-5" /></Link>
              </Button>
              <div className="flex items-center gap-2 text-primary-foreground/70 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>No credit card required</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-primary-foreground/60 text-sm">
              {["Free Registration", "Starting at ₹5", "Instant Results", "Safe & Secure"].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" /> {t}
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
