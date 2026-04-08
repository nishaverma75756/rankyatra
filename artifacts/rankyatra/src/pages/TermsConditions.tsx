import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ScrollText } from "lucide-react";

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: `By using these Terms and Conditions ("Terms"), you agree to RankYatra Technologies Pvt. Ltd. ("Company", "we", "our"). If you do not agree to these terms, please do not use the platform. These terms may be updated from time to time; changes will be published on the platform.`,
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    content: `You must be 18 years of age or older to use the platform. The platform is not intended for use in states where skill-based games are restricted (e.g. Andhra Pradesh, Telangana, Nagaland, etc.). You are responsible for verifying your own eligibility. Each user may only hold one account.`,
  },
  {
    id: "services",
    title: "3. Our Services",
    content: `RankYatra is a skill-based competitive exam platform where users participate in exams by paying an entry fee. Top performers win cash prizes. This is a skill-based activity — the result depends on your knowledge and speed, not chance. We follow government-level exam patterns.`,
  },
  {
    id: "account",
    title: "4. Account & Security",
    content: `You are responsible for keeping your account and password secure. Report any suspicious activity to support immediately. Account sharing is strictly prohibited. Providing false information may result in a permanent account ban. Creating multiple accounts may result in all accounts being banned.`,
  },
  {
    id: "payment",
    title: "5. Payment & Wallet",
    content: `You must add balance to your wallet to use the platform. The minimum deposit is ₹10. Entry fees are deducted when you join an exam. Prize money is credited to winners' wallets within 24 hours of the result. Wallet balance is non-transferable.`,
  },
  {
    id: "refund",
    title: "6. Refund Policy",
    content: `If an exam could not be completed due to a technical issue, the entry fee will be refunded. If you voluntarily left the exam or time ran out, no refund will be issued. Withdrawn wallet amounts are non-refundable. Deposited amounts in the wallet are not refunded except on account closure. On account closure, remaining wallet balance will be refunded within 7 working days.`,
    id2: "refund",
  },
  {
    id: "prizes",
    title: "7. Prizes & Taxes",
    content: `Prize distribution takes place after exam results are confirmed by the admin. TDS is applicable on prizes above ₹10,000 as per Section 115BB of the Income Tax Act. A TDS certificate will be issued. You are responsible for correctly reporting your prize income for tax purposes.`,
  },
  {
    id: "conduct",
    title: "8. User Conduct",
    content: `Cheating, hacking, using bots or any unfair means is strictly prohibited and will result in a permanent account ban. Sharing offensive, abusive or illegal content is prohibited. Harassing other users is prohibited. Misusing the company name or brand is prohibited.`,
  },
  {
    id: "gaming",
    title: "9. Responsible Gaming",
    content: `Although RankYatra is a skill-based platform, we encourage responsible gaming. Only spend what you can afford. If you feel you are exhibiting compulsive behaviour, contact help@rankyatra.in. We can connect you with problem gambling resources.`,
    id2: "gaming",
  },
  {
    id: "ip",
    title: "10. Intellectual Property",
    content: `All content on the platform — questions, design, code, logos — is the intellectual property of RankYatra. Copying, reproducing or distributing without permission is prohibited. You are responsible for any user-generated content (answers, profile information).`,
  },
  {
    id: "limitation",
    title: "11. Limitation of Liability",
    content: `RankYatra is not liable for losses caused by internet outages, server issues or third-party service failures. Maximum liability in any case will not exceed your entry fees for the last 30 days. We are not liable for indirect, consequential or punitive damages.`,
  },
  {
    id: "termination",
    title: "12. Account Termination",
    content: `We may terminate any account without notice if there is a violation of these Terms. You may also close your account at any time. On account closure, remaining wallet balance will be refunded (except where the ban was due to a violation).`,
  },
  {
    id: "governing",
    title: "13. Governing Law",
    content: `These Terms are governed under Indian law. The jurisdiction for disputes will be the courts of Lucknow, Uttar Pradesh, India. Any dispute will first be attempted to be resolved through mutual negotiation within 30 days.`,
  },
];

export default function TermsConditions() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">

        <section className="bg-gradient-to-br from-primary/10 via-background to-orange-50/40 py-16">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mb-6">
              <ScrollText className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-black text-foreground mb-3">Terms & Conditions</h1>
            <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
          </div>
        </section>

        <section className="py-12 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">

            <div className="bg-muted/40 rounded-2xl p-5 mb-10">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">Contents</p>
              <div className="grid grid-cols-2 gap-1">
                {sections.map(s => (
                  <a key={s.id} href={`#${s.id}`} className="text-xs text-primary hover:underline py-0.5">{s.title}</a>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              {sections.map(s => (
                <div key={s.id} id={s.id2 ?? s.id} className="scroll-mt-20">
                  <h2 className="text-lg font-black text-foreground mb-3">{s.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 p-5 border border-primary/20 rounded-xl bg-primary/5 text-center">
              <p className="text-sm text-muted-foreground">
                Have questions? <a href="/contact" className="text-primary font-bold hover:underline">Contact Us</a> or email{" "}
                <a href="mailto:rankyatra.in@gmail.com" className="text-primary font-bold hover:underline">rankyatra.in@gmail.com</a>
              </p>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
