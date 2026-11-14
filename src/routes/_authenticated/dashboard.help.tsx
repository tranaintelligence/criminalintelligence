import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, Headphones, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/help")({
  head: () => ({
    meta: [
      { title: "Citizens Dashboard — TRANA" },
      { name: "description", content: "Get help using TRANA, contact our support team, and find emergency legal resources." },
      { property: "og:title", content: "Citizens Dashboard — TRANA" },
      { property: "og:description", content: "Help using TRANA and official contact channels." },
    ],
  }),
  component: Help,
});

const faqs = [
  ["Is TRANA a lawyer?", "No. TRANA gives legal information and first aid. For advice on your case, always speak to a qualified lawyer."],
  ["Is my information private?", "Your analyses and consultations are visible only to you when signed in."],
  ["Free legal aid", "If you cannot afford a lawyer, you may be entitled to free legal aid. Call the NALSA helpline 15100."],
  ["Emergency", "If you are in danger, call 112 immediately."],
];

function Help() {
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl md:text-5xl">Help & Support</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Need assistance with your case analysis, account, or statutory inquiry? Contact our team directly.
      </p>

      {/* Official TRANA Contact Box */}
      <div className="mt-8 rounded-2xl border border-primary/30 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Contact TRANA Official Support</h2>
            <p className="text-xs text-muted-foreground">
              Reach out to us directly for any queries, technical support, or partnership inquiries.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Email Card */}
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <div className="flex items-center gap-2 text-xs font-mono font-medium text-muted-foreground">
              <Mail className="h-4 w-4 text-primary" />
              <span>Official Email ID</span>
            </div>
            <a
              href="mailto:tranaintelligence@gmail.com"
              className="mt-2 block font-mono text-sm font-semibold text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              tranaintelligence@gmail.com
            </a>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Direct email support for citizens, advocates, and students.
            </p>
          </div>

          {/* Telephone / Helpline Card */}
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <div className="flex items-center gap-2 text-xs font-mono font-medium text-muted-foreground">
              <Phone className="h-4 w-4 text-primary" />
              <span>Helpline &amp; Contact Numbers</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-sm font-semibold text-foreground">
              <a
                href="tel:9891438718"
                className="hover:text-primary transition-colors underline-offset-4 hover:underline"
              >
                9891438718
              </a>
              <span className="text-muted-foreground">&bull;</span>
              <a
                href="tel:8368515600"
                className="hover:text-primary transition-colors underline-offset-4 hover:underline"
              >
                8368515600
              </a>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Available for immediate support and platform guidance.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Official TRANA Intelligence &amp; Legal Support Helpdesk</span>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <h2 className="mt-12 font-display text-2xl text-foreground">Frequently Asked Questions</h2>
      <div className="mt-4 divide-y divide-border border border-border bg-card rounded-2xl overflow-hidden">
        {faqs.map(([q, a]) => (
          <div key={q} className="p-6">
            <p className="font-display text-xl">{q}</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
