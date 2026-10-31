import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TRANA Legal Guidance, Within Reach" },
      { name: "description", content: "TRANA makes Indian legal information easier to understand and connects you with the right lawyer." },
      { property: "og:title", content: "TRANA Legal Guidance, Within Reach" },
      { property: "og:description", content: "Legal first aid for India. Understand your situation and reach a qualified lawyer." },
    ],
  }),
  component: Index,
});

const Disclaimer = "TRANA provides legal information and first aid not legal advice. Always consult a qualified lawyer.";

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`mb-3 md:mb-6 text-xs uppercase tracking-[0.3em] ${light ? "text-ink-muted" : "text-muted-foreground"}`}>{children}</p>;
}

function H2({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <h2 className={`font-display text-3xl leading-[1.05] font-medium md:text-6xl ${light ? "text-ink" : "text-foreground"}`}>{children}</h2>;
}

function Index() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
      try {
        sessionStorage.removeItem("tsr-scroll-restoration-v1_3");
      } catch {}
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-6 py-3 md:py-4">
          <a href="#top" className="font-display text-xl md:text-2xl font-semibold tracking-[0.25em]">TRANA</a>
          <div className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#who" className="hover:text-foreground">Who we help</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <Link to="/dashboard/chat" className="hover:text-foreground">Legal Chat</Link>
            <Link to="/lawyer" className="hover:text-foreground">For Lawyers</Link>
            <a href="#how" className="hover:text-foreground">How it works</a>
          </div>
          <Link to="/dashboard/chat" className="btn-solid !px-3 !py-2 !text-[0.65rem] md:!px-4 md:!py-2.5 md:!text-[0.7rem]">Legal Chat</Link>
        </div>
      </nav>

{/* Hero */}
      <section id="top" className="mx-auto flex min-h-[70vh] md:min-h-[88vh] max-w-7xl flex-col justify-center px-4 md:px-6 py-8 md:py-24">
        <p className="reveal mb-4 md:mb-8 font-display text-base md:text-xl italic text-muted-foreground">त्राणा — Protection.</p>
        <h1 className="reveal font-display text-[38px] leading-[0.95] font-medium md:text-6xl lg:text-[8.5rem]">
          Legal Guidance,<br /><em className="font-normal">Within Reach.</em>
        </h1>
        <p className="reveal mt-6 md:mt-10 max-w-xl text-[14px] md:text-[15px] font-light text-muted-foreground">
          TRANA makes legal information easier to understand and connects you with the right lawyer when it matters most.
        </p>
        <div className="reveal mt-6 md:mt-10 flex flex-col gap-3 md:flex-row md:gap-4">
          <a href="#cta" onClick={(e)=>{e.preventDefault(); setModalOpen(true);}} className="btn-solid">Get Legal Guidance</a>
          <a href="#cta" className="btn-solid">Talk to a Lawyer</a>
        </div>
        <p className="reveal mt-5 md:mt-8 max-w-md text-xs text-muted-foreground">{Disclaimer}</p>
      </section>

      {/* Who */}
      <section id="who" className="bg-paper py-10 md:py-28 text-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="reveal"><Eyebrow light>01 Who we help</Eyebrow><H2 light>Built for Everyone<br />Who Needs the Law</H2></div>
          <div className="mt-8 md:mt-16 grid grid-cols-1 gap-px bg-paper-border md:grid-cols-3">
            {[
              ["🧑‍💼", "Citizens", "Facing a Legal Problem?", "Understand your rights, decode legal documents, and get connected to a qualified lawyer quickly and clearly."],
              ["⚖️", "Lawyers", "For Legal Professionals", "Research cases, find citations from High Courts and lower courts, draft documents, and connect with other lawyers in our professional network."],
              ["📚", "Students", "For Law Students", "Access legal research with case citations, judgment timelines, and practical legal tools to support your studies."],
            ].map(([i, k, t, b]) => (
              <div key={t} className="reveal bg-paper p-5 md:p-10">
                <div className="text-2xl grayscale">{i}</div>
                <p className="mt-4 md:mt-8 text-xs uppercase tracking-[0.25em] text-ink-muted">{k}</p>
                <h3 className="mt-2 md:mt-3 font-display text-2xl md:text-3xl font-medium">{t}</h3>
                <p className="mt-3 md:mt-4 font-light leading-relaxed text-ink-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-paper border-t border-paper-border py-3 md:py-5 text-ink">
        <div className="mx-auto max-w-7xl px-3 md:px-6 flex flex-row items-center justify-between">
          <div className="flex-1 min-w-0 flex flex-col items-center text-center px-1.5 sm:px-3 md:px-6">
            <span className="font-sans text-[11px] sm:text-xs md:text-sm font-semibold tracking-tight sm:tracking-wide text-ink leading-tight">BNS · BNSS · BSA</span>
            <span className="font-sans text-[9px] sm:text-[11px] md:text-xs font-light text-ink-muted mt-0.5 leading-tight">All 3 New Laws Covered</span>
          </div>
          <div className="w-px h-6 md:h-7 bg-ink/20 shrink-0 self-center" />
          <div className="flex-1 min-w-0 flex flex-col items-center text-center px-1.5 sm:px-3 md:px-6">
            <span className="font-sans text-[11px] sm:text-xs md:text-sm font-semibold tracking-tight sm:tracking-wide text-ink leading-tight">Hindi & English</span>
            <span className="font-sans text-[9px] sm:text-[11px] md:text-xs font-light text-ink-muted mt-0.5 leading-tight">Bilingual Support</span>
          </div>
          <div className="w-px h-6 md:h-7 bg-ink/20 shrink-0 self-center" />
          <div className="flex-1 min-w-0 flex flex-col items-center text-center px-1.5 sm:px-3 md:px-6">
            <span className="font-sans text-[11px] sm:text-xs md:text-sm font-semibold tracking-tight sm:tracking-wide text-ink leading-tight">Free to Start</span>
            <span className="font-sans text-[9px] sm:text-[11px] md:text-xs font-light text-ink-muted mt-0.5 leading-tight">No Lawyer Fees to Understand Your Rights</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-10 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="reveal"><Eyebrow>02 What you can do</Eyebrow><H2>Your Legal First Aid<br />All in One Place</H2></div>
          <div className="mt-8 md:mt-16 grid gap-6 md:gap-10 grid-cols-2 md:grid-cols-4">
            {[
              ["Understand Legal Documents", "Upload or describe any legal situation and get a plain-language explanation of what it means and what to do next."],
              ["Find the Right Lawyer", "TRANA connects you to verified legal professionals. Arrange a consultation by call or chat directly through the platform."],
              ["Legal Research & Citations", "Find relevant case law with citations, timelines, and judgments from the Supreme Court, High Courts, and lower courts."],
              ["Connect With Experts", "Beyond lawyers, connect with legal professionals and experts across different areas of law."],
            ].map(([t, b], n) => (
              <div key={t} className="reveal border-t border-primary pt-4 md:pt-6">
                <span className="text-xs tracking-[0.25em] text-muted-foreground">0{n + 1}</span>
                <h3 className="mt-3 md:mt-4 font-display text-xl md:text-2xl">{t}</h3>
                <p className="mt-2 md:mt-3 text-sm font-light leading-relaxed text-muted-foreground">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI tools */}
      <section className="bg-paper py-10 md:py-28 text-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="reveal max-w-2xl"><Eyebrow light>03 AI tools</Eyebrow><H2 light>AI-Assisted Legal Tools</H2>
            <p className="mt-4 md:mt-6 text-base md:text-lg font-light text-ink-muted">Powerful features being built to make legal help faster and smarter.</p></div>
          <div className="mt-8 md:mt-16 grid gap-4 md:gap-6 md:grid-cols-2">
            {[
              ["In Development", "FIR Analyser", "Describe or upload an FIR. Our AI will identify the sections invoked, explain what they mean, check bail eligibility, and suggest next steps in plain language."],
              ["Planned", "Legal Information Assistant", "A chat assistant that answers your legal questions using verified Indian law and always guides you toward a qualified lawyer when needed."],
            ].map(([badge, t, b]) => (
              <div key={t} className="reveal border border-paper-border bg-paper p-5 md:p-10">
                <span className="inline-block border border-ink px-3 py-1 text-[0.65rem] uppercase tracking-[0.25em] text-ink">{badge}</span>
                <h3 className="mt-5 md:mt-8 font-display text-3xl md:text-4xl">{t}</h3>
                <p className="mt-3 md:mt-4 font-light leading-relaxed text-ink-muted">{b}</p>
              </div>
            ))}
          </div>
          <p className="reveal mt-6 md:mt-10 font-display text-lg md:text-xl italic text-ink-muted">
            These are AI tools for information only. For legal advice, TRANA will always connect you to a real lawyer.
          </p>
        </div>
      </section>

      {/* Lawyers */}
      <section id="lawyers" className="py-10 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 md:gap-16 px-4 md:px-6 md:grid-cols-2">
          <div className="reveal">
            <Eyebrow>04 For lawyers</Eyebrow>
            <H2>A Platform Built for Legal Professionals Too</H2>
            <p className="mt-5 md:mt-8 text-base md:text-lg font-light leading-relaxed text-muted-foreground">
              TRANA isn't just for people seeking help. It's a platform where lawyers and legal professionals can connect with clients, collaborate with peers, and access tools that make their practice more efficient.
            </p>
          </div>
          <div className="reveal flex flex-col justify-end">
            {["Receive client referrals directly through the platform", "Access legal research with case citations and timelines", "Connect with other lawyers in our professional network"].map((x) => (
              <div key={x} className="flex gap-4 md:gap-5 border-t border-border py-3">
                <span className="font-display text-xl md:text-2xl text-foreground">✓</span>
                <p className="text-base md:text-lg text-foreground">{x}</p>
              </div>
            ))}
            <Link to="/lawyer" className="btn-solid mt-6 md:mt-8 self-start">Access Lawyer Workspace</Link>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="bg-paper py-10 md:py-28 text-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="reveal"><Eyebrow light>05 Process</Eyebrow><H2 light>How TRANA Works</H2></div>
          <div className="mt-8 md:mt-16 grid gap-6 md:gap-10 grid-cols-2 md:grid-cols-4">
            {[
              ["Describe Your Situation", "Tell us what's happened in plain language no legal knowledge needed."],
              ["Get Instant Clarity", "TRANA explains your legal situation, your rights, and what your options are."],
              ["Connect With a Lawyer", "We connect you to a verified lawyer for a consultation by call or chat."],
              ["You're Guided, Not Alone", "TRANA stays with you answering questions and helping you understand every step."],
            ].map(([t, b], n) => (
              <div key={t} className="reveal border-t border-ink pt-4 md:pt-6">
                <span className="text-xs tracking-[0.25em] text-ink-muted">STEP 0{n + 1}</span>
                <h3 className="mt-3 md:mt-4 font-display text-xl md:text-2xl text-ink">{t}</h3>
                <p className="mt-2 md:mt-3 text-sm font-light leading-relaxed text-ink-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statement */}
      <section className="border-t border-border bg-background py-20 md:py-32 text-foreground hidden md:block">
        <p className="reveal mx-auto max-w-5xl px-6 text-center font-display text-4xl leading-tight md:text-6xl">
          TRANA is your legal guide <em>not your lawyer.</em><br />We exist to make sure you always reach one.
        </p>
      </section>

      {/* CTA */}
      <section id="cta" className="border-b border-border py-12 md:py-32 text-center bg-background text-foreground md:bg-paper md:text-ink md:border-paper-border">
        <div className="reveal mx-auto max-w-3xl px-4 md:px-6">
          <h2 className="font-display text-4xl md:text-6xl lg:text-8xl font-medium">Don't face it alone.</h2>
          <p className="mt-4 md:mt-6 text-base md:text-lg font-light text-muted-foreground md:text-ink-muted">Get legal guidance or connect with a lawyer today.</p>
          <div className="mt-6 md:mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-3 md:gap-4">
            <a href="#cta" onClick={(e)=>{e.preventDefault(); setModalOpen(true);}} className="btn-solid md:btn-ink">Get Legal Guidance</a>
            <a href="#cta" onClick={(e)=>{e.preventDefault(); setModalOpen(true);}} className="btn-solid md:btn-ink sm:w-auto w-full">Talk to a Lawyer</a>
          </div>
          <p className="mt-6 md:mt-8 font-display text-lg md:text-xl leading-tight text-muted-foreground md:hidden">
            TRANA is your legal guide <em>not your lawyer.</em><br />We exist to make sure you always reach one.
          </p>
        </div>
{/* Modal */}
{modalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 px-4">
    <div className="bg-[#0A0A0A] p-6 md:p-8 rounded-lg relative w-full max-w-sm md:w-96">
      <button onClick={() => setModalOpen(false)} className="absolute top-2 right-2 text-white text-xl font-bold">✕</button>
      <h2 className="text-white text-xl mb-4">We're Launching Soon</h2>
      <p className="text-gray-400 mb-4">TRANA is almost ready. Leave your email and we will notify you the moment we go live.</p>
      <p className="text-gray-400 mb-4">Our team of verfied lawyers are coming soon.</p>
      <input type="email" placeholder="Your email" className="w-full p-2 mb-4 bg-white text-black border border-black" />
      <button className="w-full bg-white text-black py-2">Notify Me</button>
    </div>
  </div>
)}
      </section>

      <footer className="bg-secondary py-8 md:py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-col justify-between gap-6 md:gap-8 md:flex-row">
            <div>
              <p className="font-display text-2xl md:text-3xl font-semibold tracking-[0.25em]">TRANA</p>
              <p className="mt-1 md:mt-2 font-display italic text-muted-foreground">त्राणा — Protection.</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground md:text-sm">
              {["About", "For Lawyers", "Legal Research", "Privacy Policy", "Contact", "Team Login"].map((l) => {
                if (l === "For Lawyers") {
                  return <Link key={l} to="/lawyer" className="hover:text-foreground">{l}</Link>;
                } else if (l === "About") {
                  return <Link key={l} to="/about" className="hover:text-foreground">{l}</Link>;
                } else if (l === "Privacy Policy") {
                  return <Link key={l} to="/privacy-policy" className="hover:text-foreground">{l}</Link>;
                } else if (l === "Contact") {
                  return <Link key={l} to="/contact" className="hover:text-foreground">{l}</Link>;
                } else if (l === "Team Login") {
                  return <Link key={l} to="/founders" className="hover:text-foreground border-l border-border pl-4">{l}</Link>;
                } else {
                  return <a key={l} href="#top" className="hover:text-foreground text-[13px] md:text-sm">{l}</a>;
                }
              })}
            </div>
          </div>
          <p className="mt-6 md:mt-12 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            TRANA provides legal information and first aid only. Nothing on this platform constitutes legal advice. Always consult a qualified legal professional.
          </p>
          <p className="mt-4 md:mt-6 text-[13px] text-muted-foreground">© 2026 TRANA. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

