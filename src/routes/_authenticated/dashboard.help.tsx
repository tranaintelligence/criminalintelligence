import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/help")({
  head: () => ({
    meta: [
      { title: "Citizens Dashboard — TRANA" },
      { name: "description", content: "Get help using TRANA and find emergency legal resources." },
      { property: "og:title", content: "Citizens Dashboard — TRANA" },
      { property: "og:description", content: "Help using TRANA." },
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
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Help & Support</h1>
      <div className="mt-10 divide-y divide-border border border-border bg-card">
        {faqs.map(([q, a]) => (
          <div key={q} className="p-6">
            <p className="font-display text-xl">{q}</p>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
