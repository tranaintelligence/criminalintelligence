import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Scale,
  FileText,
  Lock,
  Cpu,
  EyeOff,
  UserCheck,
  AlertCircle,
  Gavel,
  Mail,
  MapPin,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  Calendar,
  Sparkles,
  BookOpen,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface PolicySearch {
  tab?: "privacy" | "terms";
}

export const Route = createFileRoute("/privacy-policy")({
  validateSearch: (search: Record<string, unknown>): PolicySearch => {
    return {
      tab: search.tab === "terms" ? "terms" : "privacy",
    };
  },
  head: () => ({
    meta: [
      { title: "Privacy Policy & Terms of Use — TRANA (त्राणा)" },
      {
        name: "description",
        content:
          "TRANA Privacy Policy and Terms of Use in compliance with the DPDP Act 2023, IT Rules 2011, and Bar Council of India Rule 36.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const search = useSearch({ from: "/privacy-policy" });
  const [activeTab, setActiveTab] = useState<"privacy" | "terms">(search.tab || "privacy");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (search.tab && (search.tab === "privacy" || search.tab === "terms")) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

  const handleCopyLink = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Page link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased border-l border-r border-border selection:bg-primary/20 selection:text-foreground">
      {/* Top Header / Brand Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors group text-xs font-mono"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span>Back to Home</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <Link to="/" className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-[0.2em] text-foreground">TRANA</span>
              <span className="font-serif italic text-muted-foreground text-xs tracking-wider">त्राणा</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleCopyLink}
              type="button"
              className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              title="Copy link"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-foreground" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
            </button>
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              title="Print policy"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
            <Link
              to="/dashboard"
              className="btn-solid !px-3 !py-1.5 !text-xs"
            >
              Citizen Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-xs text-muted-foreground font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-foreground" />
            <span>Digital Personal Data Protection (DPDP) Act, 2023 · BCI Rule 36 Compliant</span>
          </div>

          <h1 
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground"
          >
            {activeTab === "terms" ? (
              <span>TRANA &mdash; Terms and Conditions</span>
            ) : (
              <span>TRANA &mdash; Privacy Policy</span>
            )}
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed font-sans">
            Transparency, zero AI model training on citizen complaints, and strict adherence to DPDP Act 2023 &amp; Bar Council of India professional standards.
          </p>

          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground font-mono pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-foreground" />
              Last Updated: November 12, 2026
            </span>
            <span>•</span>
            <span>Jurisdiction: New Delhi, India</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1 backdrop-blur">
            <button
              type="button"
              onClick={() => setActiveTab("privacy")}
              className={`flex items-center gap-2 rounded px-5 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === "privacy"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lock className="h-4 w-4" />
              <span>Privacy Policy</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("terms")}
              className={`flex items-center gap-2 rounded px-5 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === "terms"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>Terms & Conditions</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="mt-10">
          {activeTab === "privacy" ? <PrivacyPolicyContent /> : <TermsContent />}
        </div>

        {/* Universal Footer Banner */}
        <div className="mt-16 rounded-xl border border-border bg-secondary/40 p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="font-display text-xl font-bold tracking-[0.2em] text-foreground">TRANA</span>
            <span className="font-display italic text-muted-foreground text-sm">त्राणा — Protection.</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
            TRANA is a technology interface operating under Indian law. For inquiries regarding our privacy standards or statutory data rights, reach our Grievance Desk at{" "}
            <a href="mailto:tranaintelligence@gmail.com" className="text-foreground underline underline-offset-2 hover:text-muted-foreground">
              tranaintelligence@gmail.com
            </a>.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground font-mono">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span>•</span>
            <Link to="/dashboard" className="hover:text-foreground">Citizens</Link>
            <span>•</span>
            <Link to="/lawyer" className="hover:text-foreground">Advocate Portal</Link>
            <span>•</span>
            <Link to="/student" className="hover:text-foreground">Student Portal</Link>
            <span>•</span>
            <Link to="/about" className="hover:text-foreground">About Us</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================================
   PRIVACY POLICY CONTENT COMPONENT
   ========================================================================= */
function PrivacyPolicyContent() {
  return (
    <div 
      style={{ fontFamily: '"Times New Roman", Times, serif' }} 
      className="space-y-8 text-foreground/90 leading-relaxed text-[16px] sm:text-[17px]"
    >
      {/* Preamble Card */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-5 gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
                className="text-2xl sm:text-3xl font-bold text-foreground tracking-wide"
              >
                TRANA &mdash; PRIVACY POLICY
              </h2>
              <span className="text-sm text-muted-foreground block mt-1">
                Last Updated: 12 November 2026
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3.5 py-1 text-xs text-muted-foreground self-start sm:self-auto font-mono">
            <Check className="h-3.5 w-3.5" /> DPDP Act 2023 Aligned
          </span>
        </div>

        <p className="text-foreground/90 leading-relaxed">
          TRANA is a criminal intelligence platform designed to make legal information, procedural guidance and legal research more accessible through AI powered technology. This Privacy Policy explains how <strong>TRANA</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, protects, and handles your data when you use our website (<code className="text-foreground font-mono text-sm bg-secondary px-1.5 py-0.5 rounded border border-border">criminalintelligence.vercel.app</code> and associated domains) and our AI driven legal intelligence tools. We are committed to safeguarding your privacy in strict compliance with India&apos;s applicable data protection laws, including the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong>, and the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong>.
        </p>
      </div>

      {/* 1. Information We Collect */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          1. Information We Collect
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          To provide our services effectively, we collect limited and necessary information:
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>Identity and Contact Information:</strong> Name, email address, phone number, and location (only when you create an account or initiate contact with an advocate).
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>Case Information &amp; Document Uploads:</strong> FIRs, police complaints, or query text that you voluntarily upload or type into our AI tools to receive informational summaries and procedural guidance.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>Technical and Usage Data:</strong> IP addresses, browser types, device information, and interaction metrics to monitor platform performance, ensure security, and improve the user interface.
            </span>
          </li>
        </ul>
      </section>

      {/* 2. How We Use Your Information (Strictly Pro Citizen) */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          2. How We Use Your Information (Strictly Pro Citizen)
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          Your data is processed solely to provide you with immediate legal clarity, procedural guidance, and to facilitate your connection with a legal professional.
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>To Deliver Services:</strong> To generate plain language summaries of the documents you upload.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>To Facilitate Connections:</strong> To transmit your query and contact details to an independent advocate, only when you explicitly request us to do so.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>Platform Operations:</strong> To maintain server stability, prevent fraud, and ensure the secure operation of our website.
            </span>
          </li>
        </ul>
      </section>

      {/* 3. STRICTLY NO AI TRAINING POLICY */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
            <EyeOff className="h-5 w-5" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-foreground">
            3. STRICTLY NO AI TRAINING POLICY
          </h3>
        </div>
        <p className="text-foreground/90 leading-relaxed">
          We recognize the highly sensitive nature of legal documents. <strong>TRANA does not and will not use your personal data, uploaded FIRs, complaints, or private communications to train, fine tune, or improve our underlying Artificial Intelligence models.</strong> Your data is processed transiently by our algorithms to generate your specific summary and is never absorbed into our AI learning datasets.
        </p>
      </section>

      {/* 4. Confidentiality and Data Sharing */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          4. Confidentiality and Data Sharing
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          Your data is highly confidential. We do not sell, rent, monetize, or publicly display your personal information or legal documents. We only share data under the following strict conditions:
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>User Initiated Advocate Connection:</strong> Your case details and contact information are transmitted solely to the specific independent advocate you explicitly choose to connect with. This transmission happens entirely on your own volition to facilitate your legal consultation.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>Service Providers:</strong> We may use secure, trusted third party cloud hosting and infrastructure providers to operate the platform. These providers are strictly bound by confidentiality agreements and are prohibited from accessing or using your data for any other purpose.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>Legal Mandates:</strong> We will only disclose your information to law enforcement or government authorities if strictly mandated by a valid, lawful court order or statutory requirement.
            </span>
          </li>
        </ul>
      </section>

      {/* 5. Data Security */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          5. Data Security
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          We implement robust, industry standard administrative, technical, and physical security measures to protect your data against unauthorized access, loss, or alteration. However, please note that preliminary messaging relays on TRANA should not be used for the exchange of unredacted, business critical, or politically sensitive information prior to establishing a formalized advocate client engagement. Standard platform communications are not protected by lawyer client privilege until you formally hire the advocate.
        </p>
      </section>

      {/* 6. Data Retention */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          6. Data Retention
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          We retain your personal information only for as long as is necessary to fulfill the purposes outlined in this Privacy Policy, to facilitate your connection with an advocate, or as required by applicable Indian laws. Once the purpose is fulfilled, or upon your valid request, your data is securely deleted or anonymized.
        </p>
      </section>

      {/* 7. Your Rights */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          7. Your Rights
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          Under applicable Indian data protection laws, you have the right to:
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Access the personal data we hold about you.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Correct any inaccurate or incomplete data.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Request the deletion or erasure of your personal data.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Withdraw your consent for data processing at any time (which may limit your ability to use certain platform features).</span>
          </li>
        </ul>
      </section>

      {/* 8. Grievance Redressal */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
            <Scale className="h-5 w-5" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-foreground">
            8. Grievance Redressal
          </h3>
        </div>
        <p className="text-foreground/90 leading-relaxed">
          In accordance with the Information Technology Act, 2000, and rules made thereunder, the name and contact details of the Grievance Officer are provided below. If you have any concerns regarding your privacy or data usage, please contact:
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span><strong>Name:</strong> Swastik Mishra</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>
              <strong>Email:</strong>{" "}
              <a href="mailto:tranaintelligence@gmail.com" className="text-foreground underline underline-offset-2 hover:text-muted-foreground">
                tranaintelligence@gmail.com
              </a>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span><strong>Address:</strong> D-537 Additional Building Block, Supreme Court of India</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

/* =========================================================================
   TERMS AND CONDITIONS OF USE COMPONENT
   ========================================================================= */
function TermsContent() {
  return (
    <div 
      style={{ fontFamily: '"Times New Roman", Times, serif' }} 
      className="space-y-8 text-foreground/90 leading-relaxed text-[16px] sm:text-[17px]"
    >
      {/* Preamble Card */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-5 gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
                className="text-2xl sm:text-3xl font-bold text-foreground tracking-wide"
              >
                TRANA &mdash; TERMS AND CONDITIONS
              </h2>
              <span className="text-sm text-muted-foreground block mt-1">
                Last Updated: 12 November 2026
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3.5 py-1 text-xs text-muted-foreground self-start sm:self-auto">
            <Scale className="h-3.5 w-3.5" /> BCI Rule 36 Compliant
          </span>
        </div>

        <p className="text-foreground/90 leading-relaxed">
          Welcome to <strong>TRANA</strong>. These Terms and Conditions (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) and <strong>TRANA</strong> (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By accessing or using our website, AI tools, and digital infrastructure (collectively, the &ldquo;Platform&rdquo;), you agree to be bound by these Terms. If you do not agree to all of these Terms, you must not use the Platform.
        </p>
      </div>

      {/* 1. Eligibility */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          1. Eligibility
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          By using TRANA, you represent and warrant that you are at least 18 years of age and possess the legal authority, right, and freedom to enter into a binding agreement under the Indian Contract Act, 1872.
        </p>
      </section>

      {/* 2. Nature of the Platform & BCI Compliance (Non Solicitation) */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          2. Nature of the Platform &amp; BCI Compliance (Non Solicitation)
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          TRANA is a criminal intelligence platform designed to make legal information, procedural guidance and legal research more accessible through AI powered technology. We are NOT a law firm, and we do not practice law. By accessing this website, you explicitly acknowledge, confirm, and agree that:
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>You are seeking information relating to TRANA and its legal first aid tools of your own accord and volition.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>There has been no form of solicitation, advertisement, personal communication, invitation, or inducement of any sort whatsoever by TRANA, its founders, directors, employees, or any advocate or legal professional listed on or associated with it.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>The presence of advocates on our platform complies with Rule 36 of the Bar Council of India (BCI) Rules, functioning as a neutral directory and technology interface.</span>
          </li>
        </ul>
      </section>

      {/* 3. Not Legal Advice & No Advocate Client Relationship */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          3. Not Legal Advice &amp; No Advocate Client Relationship
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          All information, content, statutory summaries, case law extracts, procedural workflows, and content generated by our AI tools are for general informational and educational purposes only.
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span><strong>No Legal Advice:</strong> Nothing on this platform should be construed as legal advice. TRANA is a guide designed to assist you in difficult circumstances and help you reach a qualified lawyer; it is not a substitute for one.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span><strong>No Relationship:</strong> Any transmission, receipt, access, or use of this website, including communications through automated assistance or preliminary intake channels, does not create, and is not intended to create, an advocate client or lawyer client relationship between you and TRANA, its founders, or any advocate.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span><strong>Independent Verification:</strong> Readers should not act or refrain from acting based on any content available on this website without seeking the independent advice of competent legal counsel licensed to practice in the appropriate jurisdiction.</span>
          </li>
        </ul>
      </section>

      {/* 4. Platform Usage and Account Security */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          4. Platform Usage and Account Security
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          If you create an account on TRANA, you are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
        </p>
      </section>

      {/* 5. Prohibited User Conduct */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          5. Prohibited User Conduct
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          Users agree to use TRANA for lawful purposes only. You strictly agree NOT to:
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Upload documents containing malicious code, malware, or viruses.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Attempt to reverse engineer, decompile, or extract the source code or AI algorithms of the platform.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Submit fabricated, frivolous, or abusive requests to the AI tools to test limitations or generate harmful content.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Use the platform to harass, threaten, or intimidate any other person or advocate.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Scrape, data mine, or mass download the contents of the platform.</span>
          </li>
        </ul>
      </section>

      {/* 6. AI Output Disclaimer & Limitation of Liability */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          6. AI Output Disclaimer &amp; Limitation of Liability
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          Artificial Intelligence is a rapidly evolving technology. While we strive for accuracy, AI models may occasionally generate incomplete, outdated, or inaccurate outputs (&ldquo;hallucinations&rdquo;).
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>TRANA, its founders, affiliates, and employees shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from any action taken or omitted by any person based on materials, AI generated answers, or information available on this website.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Information on this website may not constitute the most up to date legal statutes or amendments. Users assume all risks associated with reliance on the platform&apos;s outputs.</span>
          </li>
        </ul>
      </section>

      {/* 7. Intellectual Property Rights */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          7. Intellectual Property Rights
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          All software architecture, source code, text, designs, UI/UX, AI prompt structures, algorithms, and content on this website are the exclusive intellectual property of TRANA and its founders.
        </p>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>The TRANA brand, logos, and the use of the Devanagari script identity (<strong>त्राणा</strong>) are proprietary trademarks.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span>Unauthorized reproduction, modification, distribution, or commercial exploitation of any TRANA intellectual property is strictly prohibited and will result in immediate legal action.</span>
          </li>
        </ul>
      </section>

      {/* 8. Indemnification */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          8. Indemnification
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          You agree to indemnify, defend, and hold harmless TRANA, its founders, employees, and affiliates from and against any and all claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys&apos; fees) arising out of or related to your violation of these Terms, your misuse of the Platform, or your infringement of any third party rights.
        </p>
      </section>

      {/* 9. Third Party Links & External Operators */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          9. Third Party Links &amp; External Operators
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          Our platform may contain links redirecting users to external portals (such as eCourts, government repositories, or payment gateways). These links are provided for convenience only. They should neither be construed as legal reference nor considered as referrals to, endorsements of, or affiliations with any third party website operators. TRANA assumes no responsibility for the content, privacy policies, or practices of any third party sites.
        </p>
      </section>

      {/* 10. Modification of Terms and Services */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          10. Modification of Terms and Services
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          TRANA reserves the right to modify, suspend, or discontinue any aspect of the platform, or to update these Terms and Conditions at any time, without prior notice. Continued use of the platform following any changes constitutes your acceptance of the revised Terms.
        </p>
      </section>

      {/* 11. Termination */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          11. Termination
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          We reserve the right to suspend or terminate your access to the platform immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms and Conditions.
        </p>
      </section>

      {/* 12. Governing Law and Dispute Resolution */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          12. Governing Law and Dispute Resolution
        </h3>
        <ul className="space-y-3 pl-2 sm:pl-4 text-foreground/90">
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span><strong>Governing Law:</strong> These Terms shall be governed by and construed in accordance with the laws of India.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span><strong>Arbitration:</strong> Any dispute, controversy, or claim arising out of or relating to these Terms, or the breach, termination, or invalidity thereof, shall be settled by arbitration in accordance with the Arbitration and Conciliation Act, 1996. The arbitral tribunal shall consist of a sole arbitrator mutually appointed by the parties.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-muted-foreground text-lg leading-none mt-1">•</span>
            <span><strong>Jurisdiction:</strong> The seat and venue of arbitration shall be New Delhi, India. Subject to the arbitration clause, the competent courts in New Delhi shall have exclusive jurisdiction.</span>
          </li>
        </ul>
      </section>

      {/* 13. Severability and Entire Agreement */}
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          13. Severability and Entire Agreement
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          If any provision of these Terms is found to be unenforceable or invalid under any applicable law, such unenforceability or invalidity shall not render these Terms unenforceable or invalid as a whole, and such provisions shall be deleted without affecting the remaining provisions herein. These Terms constitute the entire agreement between you and TRANA regarding your use of the platform.
        </p>
      </section>
    </div>
  );
}
