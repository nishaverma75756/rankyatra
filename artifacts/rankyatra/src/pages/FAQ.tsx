import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HelpCircle, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const faqs = [
  {
    category: "General",
    items: [
      { q: "What is RankYatra?", a: "RankYatra is a live competitive exam platform where aspirants can join exams for ₹5, compete with thousands of students and top performers win real cash prizes. Exams are available for SSC, UPSC, Banking, Railways, Defence, NEET and IIT JEE." },
      { q: "Is this platform legal?", a: "Yes, RankYatra is 100% legal. It is a skill-based competition platform (not a lottery). Skill-based games for money are legal in India. We fully comply with Income Tax regulations." },
      { q: "How do I create an account?", a: "Click the Sign Up button, enter your name, email and password, verify the OTP — and you're done. Then add funds to your wallet and join your first exam!" },
    ],
  },
  {
    category: "Exams",
    items: [
      { q: "What is the exam entry fee?", a: "Most exams have an entry fee of ₹5. Some special exams may have different fees, which are clearly displayed on the exam page." },
      { q: "How long is each exam?", a: "Most exams are 20 minutes long. The exact duration is mentioned on each exam's page." },
      { q: "Can I join an exam after it has started?", a: "Yes, you can join as long as the exam is still live. However, the time that has already passed will count against your timer. It's better to join on time." },
      { q: "What if my internet disconnects during an exam?", a: "Your answers are auto-saved. You can continue after reconnecting. The exam timer will not pause." },
      { q: "Is there negative marking?", a: "It depends on the specific exam. If negative marking applies, it will be clearly mentioned on the exam page and exam screen." },
    ],
  },
  {
    category: "Payment & Wallet",
    items: [
      { q: "How do I add money to my wallet?", a: "Go to Dashboard → Wallet → Add Money. You can deposit via UPI (PhonePe, GPay, Paytm), Debit/Credit Card or Net Banking. Minimum deposit is ₹10." },
      { q: "How do I withdraw money?", a: "Go to Wallet → Withdraw Money → enter your UPI ID or bank details. KYC verification is required. Amount is credited to your account within 2–3 working days." },
      { q: "What is the minimum withdrawal amount?", a: "The minimum withdrawal amount is ₹100." },
      { q: "What if my deposit fails?", a: "If the amount was deducted from your payment gateway, an auto-refund is initiated within 5–7 working days. If not received, email support@rankyatra.in with a screenshot." },
    ],
  },
  {
    category: "KYC & Account",
    items: [
      { q: "Why is KYC required?", a: "KYC is mandatory for claiming prizes and withdrawals above ₹500. This is required under RBI and government norms. Verify using a government-issued ID (Aadhaar/PAN)." },
      { q: "How long does KYC approval take?", a: "Usually 24–48 hours. If it is still pending after 3 days, please contact support." },
      { q: "I forgot my password. What should I do?", a: "Go to the Login page → Forgot Password → enter your registered email → you will receive a reset link → set your new password." },
      { q: "How do I delete my account?", a: "Email support@rankyatra.in. Your account will be deleted within 30 days. Please withdraw any remaining balance first." },
    ],
  },
  {
    category: "Prizes & Results",
    items: [
      { q: "How are prizes distributed?", a: "Prize money is credited to the winners' RankYatra wallet within 24 hours of the exam result. From there, you can withdraw it to your bank account." },
      { q: "How is rank decided when scores are equal?", a: "In case of equal scores, the user who completed the exam in less time gets the better rank — exactly like government exams." },
      { q: "Is tax applicable on prizes?", a: "Yes, TDS is applicable on prizes above ₹10,000 as per Section 115BB of the Income Tax Act. You will receive a TDS certificate." },
      { q: "Can others see my result?", a: "Only your name and score are visible on the leaderboard. Detailed answers remain private." },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl transition-all ${open ? "border-primary/30 bg-primary/5" : "border-border"}`}>
      <button className="w-full flex items-center justify-between p-4 text-left gap-3" onClick={() => setOpen(!open)}>
        <span className="font-semibold text-sm text-foreground">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 text-primary shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const [search, setSearch] = useState("");
  const filtered = faqs.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">

        <section className="bg-gradient-to-br from-primary/10 via-background to-purple-50/40 py-16">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mb-6">
              <HelpCircle className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-black text-foreground mb-3">Frequently Asked Questions</h1>
            <p className="text-muted-foreground text-base mb-8">Answers to our most common questions.</p>
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search questions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/30 outline-none text-sm"
              />
            </div>
          </div>
        </section>

        <section className="py-12 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground">No results found</p>
                  <p className="text-sm text-muted-foreground mt-1">Try different keywords or <a href="/contact" className="text-primary underline">contact us</a></p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-10">
                {filtered.map(cat => (
                  <div key={cat.category}>
                    <h2 className="text-lg font-black text-foreground mb-4 flex items-center gap-2">
                      <span className="h-1 w-6 bg-primary rounded-full" />
                      {cat.category}
                    </h2>
                    <div className="space-y-2">
                      {cat.items.map(item => <FAQItem key={item.q} q={item.q} a={item.a} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Card className="mt-12 border-primary/20 bg-primary/5">
              <CardContent className="p-6 text-center">
                <h3 className="font-black text-foreground text-lg mb-2">Still have questions?</h3>
                <p className="text-sm text-muted-foreground mb-4">We're here to help! Reach out for any issue.</p>
                <a href="/contact" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors">
                  Contact Us →
                </a>
              </CardContent>
            </Card>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
