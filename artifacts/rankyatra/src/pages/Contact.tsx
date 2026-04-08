import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Mail, Phone, MapPin, Clock, MessageSquare, Send, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const contacts = [
  { icon: Mail, label: "Email", value: "rankyatra.in@gmail.com", sub: "Response within 24 hours", href: "mailto:rankyatra.in@gmail.com" },
  { icon: Phone, label: "Phone", value: "+91 9006109415", sub: "Mon–Sat, 9 AM – 6 PM", href: "tel:+919006109415" },
  { icon: MapPin, label: "Address", value: "5/955, Viram Khand 5, Gomtinagar, Lucknow - 226010, UP", sub: "Head Office", href: "#" },
  { icon: Clock, label: "Support Hours", value: "Mon – Sat", sub: "9:00 AM – 6:00 PM IST", href: "#" },
];

const faqs = [
  { q: "How long does it take to receive prize money?", a: "Prize money is credited to winners' wallets within 24 hours of the exam ending." },
  { q: "What should I do if my deposit fails?", a: "Email support with a screenshot. We will resolve it within 2 working days." },
  { q: "My account is blocked. What should I do?", a: "Email rankyatra.in@gmail.com with your registered email and a description of the problem." },
];

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">

        <section className="bg-gradient-to-br from-primary/10 via-background to-blue-50/40 py-16">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mb-6">
              <MessageSquare className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-black text-foreground mb-3">Get in Touch</h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Any issue — account, payment, exam — we're here to help!
            </p>
          </div>
        </section>

        <section className="py-12 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {contacts.map(({ icon: Icon, label, value, sub, href }) => (
                <Card key={label} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 text-center">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <a href={href} className="text-sm font-bold text-foreground hover:text-primary transition-colors break-words">{value}</a>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-black text-foreground mb-5">Send a Message</h2>
                  {submitted ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle className="h-14 w-14 text-green-500 mb-4" />
                      <h3 className="font-black text-foreground text-lg mb-2">Message Sent!</h3>
                      <p className="text-sm text-muted-foreground">We will reply within 24 hours. Thank you!</p>
                      <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>
                        Send Another
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">Your Name *</label>
                          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/30 outline-none"
                            placeholder="Arjun Kumar" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">Email *</label>
                          <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/30 outline-none"
                            placeholder="arjun@email.com" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">Subject *</label>
                        <select required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/30 outline-none">
                          <option value="">Select a subject</option>
                          <option value="payment">Payment / Deposit</option>
                          <option value="withdrawal">Withdrawal</option>
                          <option value="exam">Exam Related</option>
                          <option value="account">Account Issue</option>
                          <option value="prize">Prize Not Received</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">Message *</label>
                        <textarea required value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                          rows={5} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/30 outline-none resize-none"
                          placeholder="Describe your issue or question in detail..." />
                      </div>
                      <Button type="submit" className="w-full gap-2">
                        <Send className="h-4 w-4" /> Send Message
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4" id="grievance">
                <h2 className="text-xl font-black text-foreground">Common Questions</h2>
                {faqs.map(({ q, a }) => (
                  <Card key={q}>
                    <CardContent className="p-4">
                      <p className="font-bold text-sm text-foreground mb-1.5">{q}</p>
                      <p className="text-sm text-muted-foreground">{a}</p>
                    </CardContent>
                  </Card>
                ))}
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <p className="font-black text-sm text-amber-800 mb-1">Grievance Officer</p>
                    <p className="text-sm text-amber-700">Nisha Verma · rankyatra.in@gmail.com</p>
                    <p className="text-xs text-amber-600 mt-1">Appointed under Section 79 of the IT Act 2000. Resolved within 30 days.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
