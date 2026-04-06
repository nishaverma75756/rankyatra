import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Lock } from "lucide-react";

const sections = [
  {
    id: "collection",
    title: "1. What Data We Collect",
    content: `We collect the following data about you:
• Account information: Name, email address, phone number
• Identity verification (KYC): Government ID, PAN card (only if you wish to withdraw)
• Payment data: UPI ID, bank details (to process payments)
• Usage data: Which exams you took, scores, time spent, device/browser info
• Technical data: IP address, cookies, log files`,
  },
  {
    id: "use",
    title: "2. How We Use Your Data",
    content: `Your data is used for the following purposes:
• Providing platform services (exams, results, prizes)
• Managing your account and verifying identity
• Processing payments and preventing fraud
• Providing customer support
• Improving the platform and developing new features
• Complying with legal obligations (TDS, KYC norms)
• Marketing emails (only with your permission)`,
  },
  {
    id: "sharing",
    title: "3. Data Sharing",
    content: `We do not sell your personal data to any third party. Data is shared only with:
• Payment gateways (Razorpay/Paytm) — to process payments
• Cloud services (AWS/GCP) — to store data securely
• Government authorities — when legally required (court order, RBI, IT Dept)
• KYC verification service — to verify identity
We have data protection agreements with all of the above.`,
  },
  {
    id: "storage",
    title: "4. Data Storage & Security",
    content: `Your data is stored securely on India-based servers. Security measures include:
• HTTPS encryption for all connections
• Passwords stored with bcrypt encryption
• Database in encrypted storage
• Regular security audits
• Limited employee access (need-to-know basis)
No system is 100% secure — if a breach occurs, we will notify you within 72 hours.`,
  },
  {
    id: "cookies",
    title: "5. Cookies",
    content: `We use cookies for:
• Essential cookies: To maintain your login session (required)
• Analytics cookies: To understand platform usage (opt-out available)
• Preference cookies: To remember your settings
You can disable cookies in your browser settings, but some features may not work.`,
    id2: "cookies",
  },
  {
    id: "rights",
    title: "6. Your Rights",
    content: `Under India's IT Act 2000, you have the following rights:
• Access right: Right to access your stored data
• Correction right: Right to correct incorrect data
• Deletion right: Right to delete your account and data
• Portability right: Right to export your data
• Objection right: Right to opt out of marketing emails
To exercise these rights, email privacy@rankyatra.in.`,
  },
  {
    id: "children",
    title: "7. Children's Privacy",
    content: `Our platform is for users aged 18 and above. We do not knowingly collect data from anyone under 18. If you believe a minor has an account, please inform us immediately at report@rankyatra.in.`,
  },
  {
    id: "retention",
    title: "8. Data Retention",
    content: `Account data: While the account is active + 2 years after closure
Financial data: 7 years (Income Tax requirement)
KYC data: 5 years (RBI requirement)
Usage logs: 1 year
On account deletion: Financial data must be retained by law; all other data will be deleted within 30 days.`,
  },
  {
    id: "changes",
    title: "9. Changes to This Policy",
    content: `We may update this policy. When material changes occur:
• A notice will be displayed on the platform
• A notification will be sent to your registered email
• 30 days' notice will be given for major changes
Continued use of the platform after changes constitutes acceptance of the new policy.`,
  },
  {
    id: "contact-privacy",
    title: "10. Privacy Contact",
    content: `For any privacy-related queries:
Email: privacy@rankyatra.in
Grievance Officer: Arjun Sharma
Response time: 30 working days
Postal: RankYatra Technologies Pvt. Ltd., New Delhi, India 110001`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">

        <section className="bg-gradient-to-br from-primary/10 via-background to-green-50/40 py-16">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mb-6">
              <Lock className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-black text-foreground mb-3">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: April 2026 · GDPR & IT Act 2000 compliant</p>
          </div>
        </section>

        <section className="py-12 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-10 text-sm text-blue-800 leading-relaxed">
              <strong>Simple Summary:</strong> We use your data only to run the platform. We never sell it. You can request deletion at any time. That's it.
            </div>

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
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{s.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 p-5 border border-primary/20 rounded-xl bg-primary/5 text-center">
              <p className="text-sm text-muted-foreground">
                Privacy concerns? Email us at <a href="mailto:privacy@rankyatra.in" className="text-primary font-bold hover:underline">privacy@rankyatra.in</a>
              </p>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
