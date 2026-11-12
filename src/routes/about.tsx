import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Shield,
  Scale,
  GraduationCap,
  Sparkles,
  Users,
  Target,
  Compass,
  Eye,
  Heart,
  Award,
  Activity,
  Camera,
  Dumbbell,
  Music,
  Globe,
  ArrowLeft,
  ArrowRight,
  Share2,
  Lock,
  Flag,
  Car,
  Bike,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About TRANA (त्राणा) — Democratizing Legal Intelligence" },
      {
        name: "description",
        content:
          "Learn about TRANA, our mission to democratize Indian legal intelligence, our founders Swastik Mishra, Soumil Krishn Sharma, and Aditya Amist, and our 5-year vision for citizen empowerment.",
      },
    ],
  }),
  component: AboutPage,
});

interface Founder {
  name: string;
  role: string;
  domain: string;
  location: string;
  initials: string;
  badge: string;
  summary: string;
  image?: string;
  beyondBoardroom: {
    description: string;
    tags: { label: string; icon: any }[];
  };
}

const FOUNDERS: Founder[] = [
  {
    name: "Swastik Mishra",
    role: "Founder & Chief Executive Officer (CEO)",
    domain: "Strategy, Product Architecture & Technology",
    location: "New Delhi",
    initials: "SM",
    badge: "Architect & CEO",
    image: "/founders/swastik-mishra.jpg",
    summary:
      "Swastik is the original architect of TRANA. Recognizing that the law needed a technological bridge to truly serve the people, he conceptualized the platform and built its core vision. As CEO, Swastik leads the overarching strategy, product architecture, and technological direction of the company.",
    beyondBoardroom: {
      description:
        "Hailing from Delhi, Swastik grew up watching his father practice as an advocate, which instilled a deep passion for the law and a lifelong drive to help people. Outside the legal tech world, he is a multifaceted achiever. An avid cricketer and a Taekwondo black belt, he brings a highly disciplined and competitive energy to TRANA. A fitness enthusiast with a love for cars, music, and travel, Swastik approaches both life and business with relentless momentum.",
      tags: [
        { label: "Taekwondo Black Belt", icon: Award },
        { label: "Avid Cricketer", icon: Activity },
        { label: "Automotive & Music", icon: Car },
        { label: "Fitness & Travel", icon: Dumbbell },
      ],
    },
  },
  {
    name: "Soumil Krishn Sharma",
    role: "Cofounder (Finance & Operations)",
    domain: "Finance, Compliance & Operational Backbone",
    location: "Faridabad",
    initials: "SS",
    badge: "Finance & Operations",
    summary:
      "Realizing the massive operational scope of democratizing Indian law, Swastik was soon joined by Soumil. Soumil stepped in to engineer the financial, structural, and operational backbone of the venture. He ensures that TRANA runs as a sustainable, compliant, and highly efficient organization. While his domain is finance and structure, his deep legal acumen heavily influences the platform's strategic development.",
    beyondBoardroom: {
      description:
        "Based in Faridabad, Soumil is a man of diverse talents. When he isn't managing TRANA's operations, you can often find him behind the lens as a passionate motorsport photographer or out on the court as an exceptional, highly competitive badminton player. He is a fitness enthusiast, a skilled beatboxer, and has a deep appreciation for Japanese culture. With a love for motorcycles and a passion for travel, Soumil balances his rigorous operational mindset with immense creative and athletic energy.",
      tags: [
        { label: "Motorsport Photography", icon: Camera },
        { label: "Competitive Badminton", icon: Activity },
        { label: "Skilled Beatboxer", icon: Music },
        { label: "Motorcycles & Travel", icon: Bike },
        { label: "Japanese Culture & Fitness", icon: Globe },
      ],
    },
  },
  {
    name: "Aditya Amist",
    role: "Cofounder (Marketing & Public Relations)",
    domain: "Brand Voice, Public Relations & Platform Outreach",
    location: "Noida",
    initials: "AA",
    badge: "Marketing & PR",
    summary:
      "The core leadership trio was completed when Aditya came on board to ensure TRANA’s tools actually reach the people who need them. Spearheading marketing, public relations, and platform outreach, Aditya is the voice of TRANA. He is responsible for translating the platform's complex capabilities into a brand that everyday Indian citizens can trust, understand, and turn to in times of crisis.",
    beyondBoardroom: {
      description:
        "Operating out of Noida, Aditya has a sharp mind for business and a deep fascination with Indian history and sociopolitical landscapes, giving him a unique edge in understanding the pulse of the common citizen. Outside of his marketing and PR initiatives, he is an automotive enthusiast and a music lover. Aditya is driven by a deeply rooted desire to improve society, and this passion fuels his commitment to building TRANA into a household name.",
      tags: [
        { label: "Indian History & Sociopolitics", icon: BookOpen },
        { label: "Brand Strategy & Voice", icon: Users },
        { label: "Automotive Enthusiast", icon: Car },
        { label: "Music & Cultural Pulse", icon: Music },
        { label: "Social Impact Champion", icon: Heart },
      ],
    },
  },
];

function AboutPage() {
  const [activeFounderTab, setActiveFounderTab] = useState<number>(0);

  const handleShare = () => {
    if (typeof window !== "undefined" && navigator?.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("About TRANA link copied to clipboard");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased border-l border-r border-border selection:bg-primary/20 selection:text-foreground">
      {/* Top Navigation Bar */}
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
              onClick={handleShare}
              type="button"
              className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <Link
              to="/privacy-policy"
              className="rounded border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Legal &amp; Privacy
            </Link>
            <Link
              to="/dashboard"
              className="btn-solid !px-3 !py-1.5 !text-xs"
            >
              Launch Platform
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16 space-y-12 sm:space-y-16">
        {/* Title & Mission Statement */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-xs text-muted-foreground font-mono shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-foreground" />
            <span>Our Mission · Democratizing Legal Intelligence</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.1]">
            Democratizing Legal Intelligence <br className="hidden sm:inline" />
            for Every Indian Citizen.
          </h1>

          <p className="mx-auto max-w-3xl text-sm sm:text-base lg:text-lg text-foreground/90 leading-relaxed font-sans">
            TRANA is built on a single, vital premise: <strong className="text-foreground">legal intelligence should be accessible, comprehensible, and immediately actionable for every citizen.</strong> We are a legal technology and artificial intelligence platform dedicated to transforming how individuals interact with the criminal justice system in India. Our mission is to bridge the massive gap between complex legal procedures and the everyday people who need immediate clarity during stressful situations.
          </p>
        </div>

        {/* The Devanagari Meaning Card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute -right-6 -bottom-8 select-none pointer-events-none opacity-5 font-serif text-[180px] text-foreground font-bold leading-none">
            त्राणा
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-serif text-2xl sm:text-3xl font-bold text-foreground px-3.5 py-1 rounded-lg bg-secondary border border-border">
                त्राण / त्राणा
              </span>
              <div>
                <span className="text-xs uppercase tracking-[0.2em] font-mono text-muted-foreground block">
                  Etymology &amp; Core Identity
                </span>
                <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground">
                  The Meaning of TRANA
                </h3>
              </div>
            </div>

            <p className="text-sm sm:text-base text-foreground/90 leading-relaxed max-w-3xl">
              The name TRANA is rooted in the Devanagari script (<strong>त्राण / त्राणा</strong>), signifying <em>protection, shelter, preservation, and relief</em>. It reflects our core belief that timely access to accurate legal information is the first line of defense in safeguarding individual rights. We ensure that every interaction remains strictly confidential. Your private legal documents are never made public and are never used to train our AI models.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <div className="rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-xs font-mono text-muted-foreground flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-foreground" />
                <span>Strictly Confidential Interactions</span>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-xs font-mono text-muted-foreground flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-foreground" />
                <span>Zero AI Model Training on Citizen Files</span>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-xs font-mono text-muted-foreground flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-foreground" />
                <span>BCI Rule 36 Ethical Neutrality</span>
              </div>
            </div>
          </div>
        </div>

        {/* Problem & Solution Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Problem */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">The Reality</span>
                <h3 className="font-display text-xl font-semibold text-foreground">The Problem We Solve</h3>
              </div>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Navigating criminal law can be overwhelming, intimidating, and confusing. Legal documents are often drafted in dense, archaic language that is difficult for a layperson to understand.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When citizens receive a First Information Report (FIR) or a legal complaint, their immediate need is to understand what the document means, what their rights are, and what steps they must take next.
            </p>
          </div>

          {/* Solution */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">Our Approach</span>
                <h3 className="font-display text-xl font-semibold text-foreground">Our Solution: AI Driven Legal First Aid &amp; A Digital Ecosystem</h3>
              </div>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              TRANA acts as your digital legal first responder. Through our AI driven criminal legal intelligence platform, we provide rapid first aid legal information, helping individuals decode FIRs, police complaints, and legal notices in plain language.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Beyond just helping citizens, TRANA serves as a modern, digitalized legal ecosystem. We provide a single, secure digital infrastructure where legal professionals can operate, collaborate, and connect with the people who need them most. It is a unified workspace designed to bring traditional legal practice into the 21st century.
            </p>
          </div>
        </div>

        {/* Commitment to Neutrality */}
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <Scale className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground">
              Our Commitment to Neutrality
            </h3>
          </div>
          <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
            TRANA is strictly an independent technology provider. We do not provide legal advice, and we do not solicit clients on behalf of any advocate. Our platform is designed to empower citizens with knowledge and facilitate voluntary connections, all while strictly respecting the professional boundaries and ethics established by the Bar Council of India (BCI).
          </p>
        </div>

        {/* MEET THE FOUNDERS SECTION */}
        <section className="space-y-8 pt-4">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3.5 py-1 text-xs text-muted-foreground font-mono">
              <GraduationCap className="h-3.5 w-3.5 text-foreground" />
              <span>Second-Year BA LLB (Hons) Innovators</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
              MEET THE FOUNDERS: Building the Future of Indian Law
            </h2>
            <p className="mx-auto max-w-3xl text-sm text-muted-foreground leading-relaxed">
              TRANA was not born in a corporate boardroom; it was born from a profound realization in the classrooms of a law school.
            </p>
            <p className="mx-auto max-w-3xl text-sm text-foreground/90 leading-relaxed">
              The platform is the brainchild of three driven second year BA LLB (Hons) students. While studying the intricacies of the Indian justice system, they recognized a glaring, unacceptable gap: the laws designed to protect the citizens are often too complex, opaque, and intimidating for the common masses to actually use. They decided not to wait until graduation to make a difference.
            </p>
          </div>

          {/* Founder Quick Switcher Tabs */}
          <div className="flex justify-center">
            <div className="inline-flex flex-wrap justify-center gap-1.5 rounded-xl border border-border bg-secondary/40 p-1.5 backdrop-blur">
              {FOUNDERS.map((f, idx) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setActiveFounderTab(idx)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeFounderTab === idx
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
                    activeFounderTab === idx
                      ? "bg-background/25 text-background font-bold"
                      : "bg-border/80 text-foreground"
                  }`}>
                    {f.initials}
                  </span>
                  <span>{f.name.split(" ")[0]}</span>
                  <span className={`text-[10px] hidden sm:inline ${activeFounderTab === idx ? "opacity-90" : "opacity-60"}`}>
                    ({f.badge})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Founder In-Depth Spotlight with Dedicated Picture Space */}
          {(() => {
            const f = FOUNDERS[activeFounderTab];
            return (
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-border pb-6">
                  <div className="flex flex-col sm:flex-row items-start gap-5">
                    {/* Dedicated Picture Space */}
                    <div className={`relative group w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border ${f.image ? "border-border shadow-md" : "border-2 border-dashed border-border p-2 shadow-inner"} bg-secondary/50 flex flex-col items-center justify-center text-center shrink-0 overflow-hidden`}>
                      {f.image ? (
                        <img src={f.image} alt={f.name} className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground space-y-1.5">
                          <div className="h-12 w-12 rounded-full bg-background border border-border flex items-center justify-center text-foreground font-display text-xl font-bold shadow-sm">
                            {f.initials}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <Camera className="h-3 w-3" />
                            <span>Founder Photo</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <span>{f.location}, India</span>
                        <span>•</span>
                        <span>{f.domain}</span>
                      </div>
                      <h3 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
                        {f.name}
                      </h3>
                      <p className="text-sm font-medium text-foreground/80">
                        {f.role}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex self-start sm:self-auto items-center gap-1.5 rounded-full bg-secondary border border-border px-3.5 py-1 text-xs text-muted-foreground font-mono">
                    {f.badge}
                  </span>
                </div>

                {/* Core Leadership Bio */}
                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                    Strategic Mandate &amp; Platform Leadership
                  </h4>
                  <p className="text-sm sm:text-base text-foreground/90 leading-relaxed font-sans">
                    {f.summary}
                  </p>
                </div>

                {/* Beyond the Boardroom */}
                <div className="rounded-xl border border-border bg-secondary/30 p-5 sm:p-6 space-y-3.5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono text-foreground font-semibold">
                    <Activity className="h-4 w-4" />
                    <span>Beyond the Boardroom</span>
                  </div>
                  <p className="text-xs sm:text-sm text-foreground/85 leading-relaxed">
                    {f.beyondBoardroom.description}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {f.beyondBoardroom.tags.map((tag) => {
                      const Icon = tag.icon;
                      return (
                        <span
                          key={tag.label}
                          className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground font-mono"
                        >
                          <Icon className="h-3.5 w-3.5 text-foreground" />
                          <span>{tag.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Three Founders Summary Grid with Thumbnail Picture Spaces */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {FOUNDERS.map((f, idx) => (
              <div
                key={f.name}
                onClick={() => setActiveFounderTab(idx)}
                className={`rounded-xl border p-5 space-y-4 transition-all cursor-pointer ${
                  activeFounderTab === idx
                    ? "border-foreground/40 bg-secondary/80 shadow-md ring-1 ring-border"
                    : "border-border bg-card hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Thumbnail Picture Space */}
                  <div className={`h-16 w-16 rounded-xl border ${f.image ? "border-border shadow-sm" : "border-dashed border-border"} bg-secondary flex flex-col items-center justify-center overflow-hidden shrink-0`}>
                    {f.image ? (
                      <img src={f.image} alt={f.name} className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <span className="font-display font-bold text-foreground text-sm">{f.initials}</span>
                        <Camera className="h-2.5 w-2.5 opacity-60 mt-0.5" />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full border border-border">
                    {f.badge}
                  </span>
                </div>
                <div>
                  <h4 className="font-display text-lg font-semibold text-foreground">{f.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.role}</p>
                </div>
                <p className="text-xs sm:text-[13px] text-muted-foreground line-clamp-3 leading-relaxed">
                  {f.summary}
                </p>
                <div className="text-[11px] text-foreground font-mono flex items-center gap-1 pt-1 underline underline-offset-4">
                  <span>View Story &amp; Passions</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* The Collaborative Engine */}
        <section className="rounded-xl border border-border bg-card p-6 sm:p-10 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Synergy &amp; Execution
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">
                The Collaborative Engine
              </h3>
            </div>
          </div>

          <p className="text-sm sm:text-[15px] text-foreground/90 leading-relaxed max-w-3xl">
            While they have their specialized domains and distinct personal passions, the true strength of TRANA’s leadership is its collaborative engine. <strong>Swastik, Soumil, and Aditya are united by a singular, overarching goal: to improve society by making legal rights accessible to all.</strong> In the relentless spirit of a startup, they work side by side across product development, legal compliance, and strategy to bring this platform to life.
          </p>
        </section>

        {/* OUR CORE PHILOSOPHY */}
        <section className="rounded-xl border border-border bg-card p-6 sm:p-10 space-y-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Uncompromising Belief
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                OUR CORE PHILOSOPHY
              </h3>
            </div>
          </div>

          <blockquote className="rounded-xl border border-border bg-secondary/40 p-6 text-base sm:text-lg text-foreground font-display italic leading-relaxed">
            &ldquo;Knowledge must be shared for the betterment of society, and understanding your legal rights should never be a luxury.&rdquo;
          </blockquote>

          <p className="text-sm text-foreground/90 leading-relaxed max-w-3xl">
            For too long, the legal system has been a labyrinth, sometimes weaponized by corrupt officials, and often a source of fear for the innocent. The law belongs to the people. TRANA was built to democratize that knowledge, ensuring that basic legal rights are accessible, understandable, and immediately actionable for everyone, regardless of their background or wealth.
          </p>
        </section>

        {/* THE FIVE YEAR VISION */}
        <section className="rounded-xl border border-border bg-card p-6 sm:p-10 space-y-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Roadmap to National Impact
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                THE FIVE YEAR VISION
              </h3>
            </div>
          </div>

          <p className="text-sm sm:text-base text-foreground/90 leading-relaxed max-w-3xl">
            Fast forward five years, the founders are working toward a singular goal: <strong>TRANA must be the definitive first response for every single Indian citizen.</strong>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            Whether a person is facing unjust harassment, dealing with a sudden police complaint, navigating an encounter with a corrupt official, or simply requiring urgent legal clarity, TRANA will be the application they instinctively trust. The ultimate vision is to create an empowered, happy, and secure India, a nation where every citizen has the knowledge and the tools to navigate the legal system with absolute confidence and peace of mind.
          </p>
        </section>

        {/* Bottom CTA / Platform Hub Links */}
        <div className="rounded-xl border border-border bg-secondary/30 p-8 text-center space-y-4">
          <h3 className="font-display text-2xl font-semibold text-foreground">
            Experience the TRANA Ecosystem
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Whether you are a citizen needing immediate legal first aid, an advocate managing chambers, or a law student researching precedents, TRANA is built for you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/dashboard"
              className="btn-solid !px-5 !py-2.5 !text-xs"
            >
              For Citizens →
            </Link>
            <Link
              to="/lawyer"
              className="rounded border border-border bg-secondary/50 hover:bg-secondary text-foreground px-5 py-2.5 font-medium text-xs uppercase tracking-wider transition-colors"
            >
              For Legal Professionals
            </Link>
            <Link
              to="/student"
              className="rounded border border-border bg-secondary/50 hover:bg-secondary text-foreground px-5 py-2.5 font-medium text-xs uppercase tracking-wider transition-colors"
            >
              For Law Students
            </Link>
            <Link
              to="/privacy-policy"
              className="rounded border border-border bg-secondary/50 hover:bg-secondary text-foreground px-5 py-2.5 font-medium text-xs uppercase tracking-wider transition-colors"
            >
              Privacy &amp; Legal Charters
            </Link>
          </div>
        </div>

        {/* Global Footer */}
        <footer className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-foreground tracking-widest">TRANA</span>
            <span>•</span>
            <span className="font-display italic text-muted-foreground">त्राणा — Protection.</span>
          </div>
          <div>© 2026 TRANA Technologies. All rights reserved. New Delhi, India.</div>
        </footer>
      </main>
    </div>
  );
}
