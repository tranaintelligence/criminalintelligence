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
  Gamepad2,
  Dumbbell,
  Music,
  Globe,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Briefcase,
  Share2,
  Lock,
  Flag,
  Car,
  Bike,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About TRANA (त्राण) — Democratizing Legal Intelligence" },
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
  color: string;
  badge: string;
  summary: string;
  beyondBoardroom: {
    title: string;
    description: string;
    tags: { label: string; icon: any }[];
  };
}

const FOUNDERS: Founder[] = [
  {
    name: "Swastik Mishra",
    role: "Founder & Chief Executive Officer",
    domain: "Strategy, Product Architecture & Technology",
    location: "New Delhi",
    initials: "SM",
    color: "from-amber-500/20 via-amber-600/10 to-transparent border-amber-500/40 text-amber-300",
    badge: "Architect & CEO",
    summary:
      "Swastik is the original architect of TRANA. Recognizing that the law needed a technological bridge to truly serve the people, he conceptualized the platform and built its core vision. As CEO, Swastik leads the overarching strategy, product architecture, and technological direction of the company.",
    beyondBoardroom: {
      title: "Delhi Roots, Competitive Drive & Martial Arts",
      description:
        "Hailing from Delhi, Swastik grew up watching his father practice as an advocate, which instilled a deep passion for the law and a lifelong drive to help people. Outside the legal tech world, he is a multifaceted achiever: a former gamer and streamer, an avid cricketer, and a Taekwondo black belt. Bringing a disciplined, highly competitive energy to TRANA, he pairs his love for cars, music, and travel with relentless startup momentum.",
      tags: [
        { label: "Taekwondo Black Belt", icon: Award },
        { label: "Former Gamer & Streamer", icon: Gamepad2 },
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
    color: "from-emerald-500/20 via-emerald-600/10 to-transparent border-emerald-500/40 text-emerald-300",
    badge: "Operations & Finance",
    summary:
      "Realizing the massive operational scope of democratizing Indian law, Swastik was soon joined by Soumil. Soumil stepped in to engineer the financial, structural, and operational backbone of the venture. He ensures that TRANA runs as a sustainable, compliant, and highly efficient organization, pairing sharp financial discipline with deep legal acumen.",
    beyondBoardroom: {
      title: "Motorsport Lens, Competitive Court & Creative Beats",
      description:
        "Based in Faridabad, Soumil is a man of diverse talents. When he isn't managing TRANA's operations, you can often find him behind the lens as a passionate motorsport photographer or out on the court as an exceptional, highly competitive badminton player. A fitness enthusiast, skilled beatboxer, and motorcycle aficionado with a deep appreciation for Japanese culture and world travel, he balances operational rigor with immense creative and athletic energy.",
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
    domain: "Brand Voice, Public Relations & Civic Outreach",
    location: "Noida",
    initials: "AA",
    color: "from-purple-500/20 via-purple-600/10 to-transparent border-purple-500/40 text-purple-300",
    badge: "Marketing & PR",
    summary:
      "The core leadership trio was completed when Aditya came on board to ensure TRANA's tools actually reach the people who need them. Spearheading marketing, public relations, and platform outreach, Aditya is the voice of TRANA, translating complex legal capabilities into a trusted brand that everyday citizens turn to in moments of crisis.",
    beyondBoardroom: {
      title: "Civic Pulse, Sociopolitics & Business Vision",
      description:
        "Operating out of Noida, Aditya has a sharp mind for business and a deep fascination with Indian history and sociopolitical landscapes, giving him a unique edge in understanding the pulse of the common citizen. Outside of marketing and PR initiatives, he is an automotive enthusiast and a music lover, driven by a deeply rooted commitment to improving society and establishing TRANA as a household name across India.",
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
    <div className="min-h-screen bg-[#0A0A0C] text-[#EDEDED] antialiased selection:bg-amber-500/30 selection:text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[800px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute top-1/2 -right-40 h-80 w-80 rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-purple-500/5 blur-[130px]" />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0A0C]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors group text-xs font-mono"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span>Back to Home</span>
            </Link>
            <div className="h-4 w-px bg-white/15" />
            <Link to="/" className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-[0.2em] text-white">TRANA</span>
              <span className="font-serif italic text-amber-300/80 text-xs tracking-wider">त्राण</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleShare}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <Link
              to="/privacy-policy"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
            >
              Legal & Privacy
            </Link>
            <Link
              to="/dashboard"
              className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors shadow-sm"
            >
              Launch Platform
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16 space-y-16">
        {/* Title & Mission Statement */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300 font-mono shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Our Mission · Democratizing Legal Intelligence</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.1]">
            Democratizing Legal Intelligence <br className="hidden sm:inline" />
            for Every Indian Citizen.
          </h1>

          <p className="mx-auto max-w-3xl text-sm sm:text-base lg:text-lg text-neutral-300 leading-relaxed font-sans">
            TRANA is built on a single, vital premise: <strong className="text-white">legal intelligence should be accessible, comprehensible, and immediately actionable for every citizen.</strong> We are a legal technology and artificial intelligence platform dedicated to transforming how individuals interact with the criminal justice system in India.
          </p>

          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-neutral-400 font-mono">
            Bridging the gap between complex legal procedures and the everyday people who need immediate clarity during stressful situations.
          </p>
        </div>

        {/* The Devanagari Meaning Card */}
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#161412] via-[#101014] to-[#0d0d10] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-8 select-none pointer-events-none opacity-10 font-serif text-[180px] text-amber-300 font-bold leading-none">
            त्राण
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-serif text-3xl sm:text-4xl font-bold text-amber-300 px-3.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30">
                त्राण / त्राणा
              </span>
              <div>
                <span className="text-xs uppercase tracking-[0.2em] font-mono text-amber-400/90 block">
                  Etymology & Core Identity
                </span>
                <h3 className="font-display text-lg sm:text-xl font-semibold text-white">
                  The Meaning of TRANA
                </h3>
              </div>
            </div>

            <p className="text-sm sm:text-base text-neutral-200 leading-relaxed max-w-3xl">
              The name TRANA is rooted in the Devanagari script (<strong>त्राण / त्राणा</strong>), signifying <em>protection, shelter, preservation, and relief</em>. It reflects our core belief that timely access to accurate legal information is the first line of defense in safeguarding individual rights.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-mono text-neutral-300 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                <span>Strictly Confidential Interactions</span>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2 text-xs font-mono text-emerald-300 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                <span>Zero AI Model Training on Citizen Files</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-mono text-neutral-300 flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-purple-400" />
                <span>BCI Rule 36 Ethical Neutrality</span>
              </div>
            </div>
          </div>
        </div>

        {/* Problem & Solution Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Problem */}
          <div className="rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-950/15 to-[#121216] p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-red-400 font-semibold">The Reality</span>
                <h3 className="font-display text-xl font-semibold text-white">The Problem We Solve</h3>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Navigating criminal law can be overwhelming, intimidating, and confusing. Legal documents are often drafted in dense, archaic language that is difficult for a layperson to understand.
            </p>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              When citizens receive a First Information Report (FIR) or a police complaint, their immediate need is to understand what the document means, what their statutory rights are, and what concrete steps they must take in the next 24 hours.
            </p>
          </div>

          {/* Solution */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-[#121216] p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">Our Approach</span>
                <h3 className="font-display text-xl font-semibold text-white">Legal First Aid & Digital Ecosystem</h3>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              TRANA acts as your <strong className="text-white">digital legal first responder</strong>. Through our AI-driven criminal legal intelligence platform, we provide rapid first-aid legal information, helping individuals decode FIRs, police complaints, and notices into plain language.
            </p>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Beyond citizen triage, TRANA serves as a unified digital ecosystem where verified legal professionals and law students operate, collaborate, draft pleadings, and connect with people who need them most.
            </p>
          </div>
        </div>

        {/* Commitment to Neutrality */}
        <div className="rounded-2xl border border-white/10 bg-[#121216] p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-3">
            <Scale className="h-5 w-5 text-amber-300" />
            <h3 className="font-display text-lg sm:text-xl font-semibold text-white">
              Our Commitment to Neutrality & BCI Ethics
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            TRANA is strictly an independent technology provider. <strong>We are not a law firm. We do not provide legal advice, and we do not solicit clients on behalf of any advocate.</strong> Our platform is designed to empower citizens with knowledge and facilitate voluntary connections, all while strictly respecting the professional boundaries and ethics established by the <strong>Bar Council of India (BCI)</strong> under Rule 36 of Chapter II, Part VI.
          </p>
        </div>

        {/* MEET THE FOUNDERS SECTION */}
        <section className="space-y-8 pt-4">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs text-neutral-300 font-mono">
              <GraduationCap className="h-3.5 w-3.5 text-amber-400" />
              <span>Second-Year BA LLB (Hons) Innovators</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white">
              Meet the Founders: Building the Future of Indian Law
            </h2>
            <p className="mx-auto max-w-2xl text-xs sm:text-sm text-neutral-400 leading-relaxed">
              TRANA was not born in a corporate boardroom; it was born from a profound realization in the classrooms of a law school. While studying the intricacies of the Indian justice system, three driven law students recognized that laws designed to protect citizens are often too complex, opaque, and intimidating for the common masses. They decided not to wait until graduation to make a difference.
            </p>
          </div>

          {/* Founder Quick Switcher Tabs */}
          <div className="flex justify-center">
            <div className="inline-flex flex-wrap justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-md">
              {FOUNDERS.map((f, idx) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setActiveFounderTab(idx)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeFounderTab === idx
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <span className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] text-white">
                    {f.initials}
                  </span>
                  <span>{f.name.split(" ")[0]}</span>
                  <span className="text-[10px] opacity-70 hidden sm:inline">({f.badge})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Founder In-Depth Spotlight */}
          {(() => {
            const f = FOUNDERS[activeFounderTab];
            return (
              <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#141418] to-[#0e0e12] p-6 sm:p-10 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-6">
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-amber-400/20 to-purple-600/20 border border-white/20 flex items-center justify-center text-white font-display text-2xl sm:text-3xl font-bold shrink-0 shadow-lg">
                      {f.initials}
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono mb-1">
                        <span>{f.location}, India</span>
                        <span>•</span>
                        <span className="text-neutral-400">{f.domain}</span>
                      </div>
                      <h3 className="font-display text-2xl sm:text-3xl font-semibold text-white">
                        {f.name}
                      </h3>
                      <p className="text-xs sm:text-sm font-medium text-neutral-300 mt-0.5">
                        {f.role}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex self-start sm:self-auto items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 text-xs text-amber-300 font-mono">
                    {f.badge}
                  </span>
                </div>

                {/* Core Leadership Bio */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-[0.15em] text-neutral-400 font-semibold">
                    Strategic Mandate & Platform Leadership
                  </h4>
                  <p className="text-sm sm:text-[15px] text-neutral-200 leading-relaxed font-sans">
                    {f.summary}
                  </p>
                </div>

                {/* Beyond the Boardroom */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono text-amber-300 font-semibold">
                    <Activity className="h-4 w-4" />
                    <span>Beyond the Boardroom · {f.beyondBoardroom.title}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    {f.beyondBoardroom.description}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {f.beyondBoardroom.tags.map((tag) => {
                      const Icon = tag.icon;
                      return (
                        <span
                          key={tag.label}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300 font-mono"
                        >
                          <Icon className="h-3.5 w-3.5 text-amber-400" />
                          <span>{tag.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Three Founders Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {FOUNDERS.map((f, idx) => (
              <div
                key={f.name}
                onClick={() => setActiveFounderTab(idx)}
                className={`rounded-2xl border p-5 space-y-3 transition-all cursor-pointer ${
                  activeFounderTab === idx
                    ? "border-amber-500/50 bg-[#161512] shadow-lg"
                    : "border-white/10 bg-[#121216] hover:border-white/20 hover:bg-[#16161b]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-display font-bold text-white text-base">
                    {f.initials}
                  </div>
                  <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    {f.badge}
                  </span>
                </div>
                <div>
                  <h4 className="font-display text-lg font-semibold text-white">{f.name}</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">{f.role}</p>
                </div>
                <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">
                  {f.summary}
                </p>
                <div className="text-[11px] text-amber-400/90 font-mono flex items-center gap-1 pt-1">
                  <span>View Story & Passions</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* The Collaborative Engine */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#121216] via-[#101014] to-[#0d0d10] p-6 sm:p-10 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-semibold">
                Synergy & Execution
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-white">
                The Collaborative Engine
              </h3>
            </div>
          </div>

          <p className="text-sm sm:text-[15px] text-neutral-200 leading-relaxed max-w-3xl">
            While they have their specialized domains and distinct personal passions, the true strength of TRANA&apos;s leadership is its collaborative engine. <strong>Swastik, Soumil, and Aditya are united by a singular, overarching goal: to improve society by making legal rights accessible to all.</strong> In the relentless spirit of a startup, they work side by side across product development, legal compliance, and strategy to bring this platform to life.
          </p>
        </section>

        {/* Our Core Philosophy */}
        <section className="rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-[#181512] to-[#100e0b] p-6 sm:p-10 space-y-4 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Uncompromising Belief
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Our Core Philosophy
              </h3>
            </div>
          </div>

          <blockquote className="rounded-2xl border border-amber-500/30 bg-black/40 p-6 text-base sm:text-lg text-neutral-100 font-display italic leading-relaxed">
            &ldquo;Knowledge must be shared for the betterment of society, and understanding your legal rights should never be a luxury.&rdquo;
          </blockquote>

          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-3xl">
            For too long, the legal system has been a labyrinth, sometimes weaponized by corrupt officials, and often a source of fear for the innocent. The law belongs to the people. TRANA was built to democratize that knowledge, ensuring that basic legal rights are accessible, understandable, and immediately actionable for everyone, regardless of their background or wealth.
          </p>
        </section>

        {/* The 5-Year Vision */}
        <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/25 via-[#101512] to-[#0e1210] p-6 sm:p-10 space-y-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                Roadmap to National Impact
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                The Five Year Vision
              </h3>
            </div>
          </div>

          <p className="text-sm sm:text-base text-neutral-200 leading-relaxed max-w-3xl">
            Fast forward five years, the founders are working toward a singular goal: <strong>TRANA must be the definitive first response for every single Indian citizen.</strong>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-1.5">
              <span className="text-xs font-mono text-emerald-400 uppercase">Emergency Clarity</span>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Whether facing unjust harassment, dealing with an unexpected FIR, or navigating an encounter with corrupt officials, TRANA is the trusted first call.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-1.5">
              <span className="text-xs font-mono text-emerald-400 uppercase">Empowered Republic</span>
              <p className="text-xs text-neutral-300 leading-relaxed">
                A nation where every citizen has the knowledge and the tools to navigate the criminal justice system with absolute confidence and peace of mind.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA / Platform Hub Links */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-4">
          <h3 className="font-display text-2xl font-semibold text-white">
            Experience the TRANA Ecosystem
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto leading-relaxed">
            Whether you are a citizen needing immediate legal first aid, an advocate managing chambers, or a law student researching precedents, TRANA is built for you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/dashboard"
              className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 font-semibold text-xs uppercase tracking-wider transition-colors shadow-lg"
            >
              For Citizens →
            </Link>
            <Link
              to="/lawyer"
              className="rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 font-semibold text-xs uppercase tracking-wider transition-colors"
            >
              For Legal Professionals
            </Link>
            <Link
              to="/student"
              className="rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 font-semibold text-xs uppercase tracking-wider transition-colors"
            >
              For Law Students
            </Link>
            <Link
              to="/privacy-policy"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-5 py-2.5 font-semibold text-xs uppercase tracking-wider transition-colors"
            >
              Privacy & Legal Charters
            </Link>
          </div>
        </div>

        {/* Global Footer */}
        <footer className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-white tracking-widest">TRANA</span>
            <span>•</span>
            <span className="font-serif italic text-amber-400">त्राणा — Protection.</span>
          </div>
          <div>© 2026 TRANA Technologies. All rights reserved. New Delhi, India.</div>
        </footer>
      </main>
    </div>
  );
}
