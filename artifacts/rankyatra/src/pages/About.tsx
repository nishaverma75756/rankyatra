import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Trophy, Target, Users, Zap, Award, Shield, BookOpen, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  { icon: Users, label: "Active Users", value: "50,000+", color: "bg-blue-100 text-blue-600" },
  { icon: BookOpen, label: "Exams Conducted", value: "1,200+", color: "bg-purple-100 text-purple-600" },
  { icon: Award, label: "Prizes Distributed", value: "₹25 Lakh+", color: "bg-amber-100 text-amber-600" },
  { icon: TrendingUp, label: "Success Rate", value: "78%", color: "bg-green-100 text-green-600" },
];

const values = [
  {
    icon: Target,
    title: "Our Mission",
    desc: "To give every Indian aspirant a fair, affordable and engaging competitive exam preparation platform — one that delivers a real exam experience and rewards their hard work.",
  },
  {
    icon: Zap,
    title: "Real Exam Experience",
    desc: "Our exams mirror government exams — live timer, negative marking and an instant leaderboard. Compete from home and get real results.",
  },
  {
    icon: Shield,
    title: "Transparent & Fair",
    desc: "Every result is calculated in real-time. No bias, no manipulation. Top performers receive prize money directly in their wallet.",
  },
];

const team = [
  { name: "Arjun Sharma", role: "CEO & Co-Founder", emoji: "👨‍💼" },
  { name: "Priya Mehta", role: "CTO & Co-Founder", emoji: "👩‍💻" },
  { name: "Rohit Gupta", role: "Head of Content", emoji: "📚" },
  { name: "Sneha Verma", role: "Community Manager", emoji: "🤝" },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">

        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-amber-50/40 py-20">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mb-6">
              <Trophy className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-4 leading-tight">
              About RankYatra
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              We built a platform for India's competitive exam aspirants where preparation meets real experience — and where hard work is genuinely rewarded!
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="py-14 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map(({ icon: Icon, label, value, color }) => (
                <Card key={label}>
                  <CardContent className="p-6 text-center">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${color} mb-3`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="text-2xl font-black text-foreground">{value}</p>
                    <p className="text-sm text-muted-foreground font-semibold mt-1">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Story */}
        <section className="py-14 bg-muted/30">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl font-black text-foreground mb-6 text-center">Our Story</h2>
            <div className="prose prose-slate max-w-none text-muted-foreground space-y-4 text-base leading-relaxed">
              <p>
                RankYatra was founded in 2024 when our founders observed that millions of government job aspirants were only taking mock tests — but never getting the feel of real competition. Studying alone in a library is one thing; competing with 10,000 people in a live exam is a completely different experience.
              </p>
              <p>
                So we built a platform where aspirants can join a live exam for ₹5, compete with thousands of students, know their real rank, and where top performers receive cash prizes directly.
              </p>
              <p>
                Today, aspirants for SSC, UPSC, Banking, Railways, Defence, NEET and IIT JEE take exams on RankYatra every day. Our mission is simple — <strong className="text-foreground">every hardworking student deserves to be rewarded for their effort.</strong>
              </p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-14 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-black text-foreground mb-10 text-center">Our Values</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {values.map(({ icon: Icon, title, desc }) => (
                <Card key={title} className="border-primary/10">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-black text-foreground text-lg mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="py-14 bg-muted/30">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl font-black text-foreground mb-10 text-center">Our Team</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {team.map(({ name, role, emoji }) => (
                <Card key={name} className="text-center">
                  <CardContent className="p-6">
                    <div className="text-4xl mb-3">{emoji}</div>
                    <p className="font-black text-foreground text-sm">{name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{role}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
