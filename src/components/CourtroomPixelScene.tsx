import React, { useState, useEffect } from "react";
import { Gavel, Scale, Volume2, Sparkles, MessageSquare, ShieldAlert, Award, Eye } from "lucide-react";

// ═════════════════════════════════════════════════════════════════════════════
// 16-BIT RETRO COLOR PALETTE FOR COURTROOM PIXEL ART
// ═════════════════════════════════════════════════════════════════════════════
const PALETTE: Record<string, string> = {
  // Judge & wigs
  "W": "#f1f5f9", // Crisp white wig curls
  "w": "#cbd5e1", // Wig shadow/crease
  "G": "#fbbf24", // Gold spectacles / brass seal / gavel ring
  "g": "#d97706", // Dark gold / bronze
  
  // Skin tones
  "S": "#fed7aa", // Light skin
  "s": "#fbcfe8", // Rosy cheek
  "D": "#ea580c", // Deep skin shadow / Indian warm complexion
  "d": "#c2410c", // Dark skin accent
  
  // Features & eyes
  "E": "#0f172a", // Dark pupil / eyebrows
  "e": "#ef4444", // Red pupil / intense objection brow
  "m": "#475569", // Gray mustache / stubble
  
  // Robes & Clothing
  "B": "#09090b", // Deep black judicial robe
  "b": "#18181b", // Charcoal robe fabric
  "r": "#27272a", // Robe fold highlight
  "T": "#ffffff", // Pure white advocate tabs / jabot collar
  "t": "#94a3b8", // White tab shadow
  "P": "#9333ea", // Purple advocate tie / TRANA accent
  "p": "#c084fc", // Purple highlight
  
  // Opposition specific
  "H": "#1c1917", // Jet black opposition hair
  "h": "#292524", // Hair highlight
  "R": "#dc2626", // Red opposition case file docket / ribbon
  "K": "#991b1b", // Dark red folder shadow
  
  // Crowd & Police Constable
  "C": "#b45309", // Khaki police uniform
  "c": "#78350f", // Dark khaki belt/strap
  "Y": "#1d4ed8", // Police beret blue
  "y": "#b91c1c", // Police beret red cockade
  "F": "#10b981", // Emerald citizen shirt
  "f": "#047857", // Dark emerald
  "O": "#f97316", // Orange citizen kurta
  "o": "#ea580c", // Dark orange
  "N": "#fef08a", // Legal pad yellow paper
  "J": "#0284c7", // Press badge cyan
  
  // Wood & Furniture
  "M": "#451a03", // Rich mahogany wood
  "A": "#78350f", // Medium warm mahogany
  "a": "#92400e", // Lighter wood trim
  "X": "#271206", // Deep wood shadow
  "V": "#b45309", // Gavel wood head
  "v": "#78350f", // Gavel handle
  
  // Effects & Sparks
  "L": "#fef08a", // Impact spark yellow
  "l": "#ffffff", // Spark bright white
  ".": "transparent"
};

// ═════════════════════════════════════════════════════════════════════════════
// SPRITE MATRICES (28x26 for characters, 84x18 for gallery crowd)
// ═════════════════════════════════════════════════════════════════════════════

const PIXEL_JUDGE_IDLE = [
  "..........WWWWWWWW..........",
  "........WWWWWWWWWWWW........",
  ".......WWwWWWWWWWWwWW.......",
  "......WWwwWWWWWWWWwwWW......",
  ".....WWwwWWWWWWWWWWwwWW.....",
  ".....WWwwSSSSSSSSSSwwWW.....",
  ".....WWwwSSSmSSSmSSwwWW.....",
  ".....WWwwSGGEESSGGEGwwWW....",
  ".....WWwwSSSmSSSSmSSwwWW....",
  ".....WWwwSSSSSSSSSSwwWW.....",
  "......WWwSSSSSSSSSSwWW......",
  ".......WWSSSSmmmmSSWW.......",
  ".........BBTTTTTTBB.........",
  ".......BBBBTTTTTTBBBB.......",
  "......bBBBBTTggTTBBBBb......",
  ".....bbBBBBBTttTBBBBBbb.....",
  "....bbbrBBBBBTTBBBBBrbbb....",
  "...bbbrrBBBBBBBBBBBBrrbbb...",
  "..bbbrrrBBBBBBBBBBBBrrrbbb..",
  ".bbbrrrrBBBBBBBBBBBBrrrrbbb.",
  "XXXXXXXXMMMMMMMMMMMMXXXXXXXX",
  "XAAAAAAAAAAAAAAAAAAAAAAAAAAX",
  "XAMMMMMAAAAgggAAAAMMMMMAAAAX",
  "XAMMMMMAAAAgggAAAAMMMMMAAAAX",
  "XAaaaaaAAAAgggAAAAaaaaaAAAAX",
  "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
];

const PIXEL_JUDGE_STRIKE = [
  "..........WWWWWWWW..........",
  "........WWWWWWWWWWWW........",
  ".......WWwWWWWWWWWwWW...VVV.",
  "......WWwwWWWWWWWWwwWW..VGV.",
  ".....WWwwWWWWWWWWWWwwWW..vv.",
  ".....WWwwSSSSSSSSSSwwWW.vv..",
  ".....WWwwSSSmSSSmSSwwWW.b...",
  ".....WWwwSGGEESSGGEGwwWbb...",
  ".....WWwwSSSmSSSSmSSwwWbb...",
  ".....WWwwSSSSSSSSSSwwWWb....",
  "......WWwSSSSSSSSSSwWW......",
  ".......WWSSSSmmmmSSWW.......",
  ".........BBTTTTTTBB.........",
  ".......BBBBTTTTTTBBBB.......",
  "......bBBBBTTggTTBBBBb......",
  ".....bbBBBBBTttTBBBBBbb.....",
  "....bbbrBBBBBTTBBBBBrbbb....",
  "...bbbrrBBBBBBBBBBBBrrbbb...",
  "..bbbrrrBBBBBBBBBBBBrrrbbb..",
  ".bbbrrrrBBBBBBBBBBBBrrrrbbb.",
  "XXXXXXXXMMMMMMMMMMMMXXXXXXXX",
  "XAAAAAAAAAAAAAAAAAAAAAAAAAAX",
  "XAMMMMMAAAALLLAAAAMMMMMAAAAX",
  "XAMMMMMAAAALLlAAAAMMMMMAAAAX",
  "XAaaaaaAAAAVVVAAAAaaaaaAAAAX",
  "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
];

const PIXEL_OPPOSITION_IDLE = [
  "..........HHHHHHHH..........",
  "........HHHHHHHHHHHH........",
  ".......HHhHHHHHHHHhHH.......",
  "......HHhhHHHHHHHHhhHH......",
  ".....HHhhHHHHHHHHHHhhHH.....",
  ".....HHhhSSSSSSSSSSssHH.....",
  ".....HHhhSSEESSSSEESSss.....",
  ".....HHhhSEeESSSSEeESss.....",
  ".....HHhhSSSSSSSSSSssHH.....",
  ".....HHhhSSSDddDSSShhHH.....",
  "......HHhSSSSSSSSSSshh......",
  ".......HHSSSSSSSSSSHH.......",
  ".........RRTTTTTTRR.........",
  ".......bRRRTTTTTTRRRb.......",
  "......bbRRRRTTggTTRRRbb.....",
  ".....bbbRRRRRTttTRRRRbbb....",
  "....bbbrRRRRRRRRRRRRrbbb....",
  "...bbbrrRRRRRRRRRRRRrrbbb...",
  "..bbbrrrRRRRRRRRRRRRrrrbbb..",
  ".bbbrrrrRRRRRRRRRRRRrrrrbbb.",
  "XXXXXXXXMMMMMMMMMMMMXXXXXXXX",
  "XAAAAAAAARRRRRRRAAAAAAAAAAAX",
  "XAMMMMMAARRKKKRAAAMMMMMAAAAX",
  "XAMMMMMAARRKKKRAAAMMMMMAAAAX",
  "XAaaaaaAARRKKKRAAAaaaaaAAAAX",
  "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
];

const PIXEL_OPPOSITION_OBJECT = [
  "..........HHHHHHHH....S.....",
  "........HHHHHHHHHHHH..SS....",
  ".......HHhHHHHHHHHhHH.SS....",
  "......HHhhHHHHHHHHhhHH.b....",
  ".....HHhhSSSSSSSSSSssHb.....",
  ".....HHhhSSEESSSSEESSsb.....",
  ".....HHhhSEeESSSSEeESs......",
  ".....HHhhSSSSSSSSSSss.......",
  ".....HHhhSSSDDDDSSShh.......",
  "......HHhSSSSSSSSSSshh......",
  ".......HHSSSSSSSSSSHH.......",
  ".........RRTTTTTTRR.........",
  ".......bRRRTTTTTTRRRb.......",
  "......bbRRRRTTggTTRRRbb.....",
  ".....bbbRRRRRTttTRRRRbbb....",
  "....bbbrRRRRRRRRRRRRrbbb....",
  "...bbbrrRRRRRRRRRRRRrrbbb...",
  "..bbbrrrRRRRRRRRRRRRrrrbbb..",
  ".bbbrrrrRRRRRRRRRRRRrrrrbbb.",
  "XXXXXXXXMMMMMMMMMMMMXXXXXXXX",
  "XAAAAAAAARRRRRRRAAAAAAAAAAAX",
  "XAMMMMMAARRKKKRAAAMMMMMAAAAX",
  "XAMMMMMAARRKKKRAAAMMMMMAAAAX",
  "XAaaaaaAARRKKKRAAAaaaaaAAAAX",
  "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
];

const PIXEL_DEFENSE_IDLE = [
  "..........HHHHHHHH..........",
  "........HHHHHHHHHHHH........",
  ".......HHhHHHHHHHHhHH.......",
  "......HHhhHHHHHHHHhhHH......",
  ".....HHhhHHHHHHHHHHhhHH.....",
  ".....HHhhSSSSSSSSSSssHH.....",
  ".....HHhhSSEESSSSEESSss.....",
  ".....HHhhSSSSSSSSSSssHH.....",
  ".....HHhhSSSmssmSSShhHH.....",
  "......HHhSSSSSSSSSSshh......",
  ".......HHSSSSSSSSSSHH.......",
  ".........PPTTTTTTPP.........",
  ".......bPPPTTTTTTPPPb.......",
  "......bbPPPPTTggTTPPPbb.....",
  ".....bbbPPPPPTttTPPPPbbb....",
  "....bbbrPPPPPPPPPPPPrbbb....",
  "...bbbrrPPPPPPPPPPPPrrbbb...",
  "..bbbrrrPPPPPPPPPPPPrrrbbb..",
  ".bbbrrrrPPPPPPPPPPPPrrrrbbb.",
  "XXXXXXXXMMMMMMMMMMMMXXXXXXXX",
  "XAAAAAAAANNNNNNNAAAAAAAAAAAX",
  "XAMMMMMAANNNNNNNAAMMMMMAAAAX",
  "XAMMMMMAANNNNNNNAAMMMMMAAAAX",
  "XAaaaaaAANNNNNNNAAAaaaaaAAAAX",
  "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
];

// The Courtroom Gallery: 6 spectators (84 cols wide x 18 rows)
// Constable + Stenographer + Law Student + Citizen + Journalist + Senior
const charConstable = [
  "....YYyyYY....", "...YYYYYYYY...", "..YYYYYYYYYY..", "..CCCCSSSSCC..",
  "..CCSEEEESCC..", "..CCSSSSSSCC..", "...CCSSSSCC...", "...CCCCCCCC...",
  "..CCCCCCCCCC..", "..CCCCCCCCCC..", "..CCcCCCCcCC..", "..CcCCCCCCcC..",
  "..cCCCCCCCCc.."
];

const charStenographer = [
  "....hhhhhh....", "...hhhhhhhh...", "..hhhhhhhhhh..", "..hhSSSSSSsh..",
  "..hSGGEEGGSh..", "..hhSSSSSSsh..", "...hSSSSSSsh..", "...FFTTTTFF...",
  "..FFFFTTFFFF..", "..FFFFTTFFFF..", "..bbrrTTbbrr..", "..bbbbbbbbbb..",
  "..bbbbbbbbbb.."
];

const charStudent = [
  "....HHHHHH....", "...HHHHHHHH...", "..HHhHHHHhHH..", "..HHSSSSSSHH..",
  "..HHSEEEESHH..", "..HHSSSSSSHH..", "...HSSSSSSH...", "...PPTTTTPP...",
  "..PPPPTTPPPP..", "..PPPPTTPPPP..", "..PPNNNNNNPP..", "..PPNNNNNNPP..",
  "..PPPPPPPPPP.."
];

const charCitizen = [
  "....WWWWWW....", "...WWWWWWWW...", "..WWwWWWWwWW..", "..WWSSSSSSWW..",
  "..WWSEEEESWW..", "..WWSSmmSSWW..", "...WSSSSSSW...", "...OOTTTTOO...",
  "..OOOOTTOOOO..", "..OOOOTTOOOO..", "..OOOOOOOOOO..", "..OOOOOOOOOO..",
  "..OOOOOOOOOO.."
];

const charJournalist = [
  "....hhhhhh....", "...hhhhhhhh...", "..hhHHHHHHhh..", "..hhSSSSSSsh..",
  "..hhSEEEESsh..", "..hhSSSSSSsh..", "...hSSSSSSsh..", "...bbrrJJrrb..",
  "..bbbbrJJrbb..", "..bbbbrJJrbb..", "..bbNNNNNNbb..", "..bbNNNNNNbb..",
  "..bbbbbbbbbb.."
];

const charSenior = [
  "....wwwwww....", "...wwwwwwww...", "..wwWWWWWWww..", "..wwSSSSSSww..",
  "..wSGGEEGGSw..", "..wwSSmmSSww..", "...wSSSSSSw...", "...FFTTTTFF...",
  "..FFFFTTFFFF..", "..FFFFTTFFFF..", "..FFFFFFFFFF..", "..FFFFFFFFFF..",
  "..FFFFFFFFFF.."
];

const PIXEL_CROWD_GALLERY: string[] = [];
for (let r = 0; r < 13; r++) {
  PIXEL_CROWD_GALLERY.push(
    charConstable[r] +
    charStenographer[r] +
    charStudent[r] +
    charCitizen[r] +
    charJournalist[r] +
    charSenior[r]
  );
}
// 5 rows of mahogany gallery rail
PIXEL_CROWD_GALLERY.push("GGgg".repeat(21));
PIXEL_CROWD_GALLERY.push("A".repeat(84));
PIXEL_CROWD_GALLERY.push("X" + "M".repeat(82) + "X");
PIXEL_CROWD_GALLERY.push("X" + "M".repeat(82) + "X");
PIXEL_CROWD_GALLERY.push("X".repeat(84));

// ═════════════════════════════════════════════════════════════════════════════
// REUSABLE PIXEL MATRIX RENDERER
// ═════════════════════════════════════════════════════════════════════════════
export function PixelSprite({
  matrix,
  pixelSize = 3,
  className = "",
  style = {},
}: {
  matrix: string[];
  pixelSize?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const height = matrix.length;
  const width = Math.max(...matrix.map((r) => r.length));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{
        width: "100%",
        maxWidth: width * pixelSize,
        height: "auto",
        aspectRatio: `${width}/${height}`,
        imageRendering: "pixelated",
        shapeRendering: "crispEdges",
        display: "block",
        ...style,
      }}
    >
      {matrix.map((row, y) =>
        row.split("").map((ch, x) => {
          const fill = PALETTE[ch];
          if (!fill || fill === "transparent") return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPACT PIXEL AVATARS FOR LIVE TRANSCRIPT STREAM
// ═════════════════════════════════════════════════════════════════════════════
export function PixelJudgeAvatar({ isGavelStriking = false }: { isGavelStriking?: boolean }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#24130a] border border-amber-500/50 p-0.5 shadow-md flex items-center justify-center overflow-hidden shrink-0">
      <PixelSprite
        matrix={isGavelStriking ? PIXEL_JUDGE_STRIKE : PIXEL_JUDGE_IDLE}
        pixelSize={1.2}
      />
    </div>
  );
}

export function PixelOppositionAvatar({ isObjecting = false }: { isObjecting?: boolean }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#1f0a0a] border border-rose-500/50 p-0.5 shadow-md flex items-center justify-center overflow-hidden shrink-0">
      <PixelSprite
        matrix={isObjecting ? PIXEL_OPPOSITION_OBJECT : PIXEL_OPPOSITION_IDLE}
        pixelSize={1.2}
      />
    </div>
  );
}

export function PixelDefenseAvatar() {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#150a24] border border-purple-500/50 p-0.5 shadow-md flex items-center justify-center overflow-hidden shrink-0">
      <PixelSprite matrix={PIXEL_DEFENSE_IDLE} pixelSize={1.2} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPLETE RETRO PIXEL COURTROOM ARENA
// ═════════════════════════════════════════════════════════════════════════════
interface CourtroomPixelSceneProps {
  courtTitle?: string;
  isGavelStriking: boolean;
  onTriggerGavel?: () => void;
  lastTurnSender?: "judge" | "prosecutor" | "advocate";
  proceedingsCount?: number;
}

export function CourtroomPixelScene({
  courtTitle = "COURT OF JUDICIAL MAGISTRATE FIRST CLASS",
  isGavelStriking,
  onTriggerGavel,
  lastTurnSender = "judge",
  proceedingsCount = 1,
}: CourtroomPixelSceneProps) {
  const [crowdWhisper, setCrowdWhisper] = useState<string>("Gallery: Silence in Court");
  const [activeCam, setActiveCam] = useState<"arena" | "bench" | "bar">("arena");

  const whispers = [
    "Gallery: *murmuring intently*",
    "Intern: 'Did you hear that Section 479 argument?'",
    "Constable: 'Attention in the Court!'",
    "Citizen: 'The defense is citing Satender Antil...'",
    "Clerk: *typing proceedings at rapid pace*",
    "Press Reporter: 'Big development on electronic evidence!'",
  ];

  // Rotate crowd whispers whenever submissions increase
  useEffect(() => {
    const next = whispers[proceedingsCount % whispers.length];
    setCrowdWhisper(next);
  }, [proceedingsCount]);

  const isOppositionActive = lastTurnSender === "prosecutor";

  return (
    <div className="rounded-3xl bg-gradient-to-b from-[#1b0d06] via-[#100703] to-[#080301] border-2 border-amber-500/50 p-4 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.95)] relative overflow-hidden select-none">
      {/* Top Gold Trim & Ashoka Motif Header */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 opacity-90" />

      {/* Retro Arcade Courtroom Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>16-Bit Court Arena</span>
          </div>
          <span className="text-xs font-mono text-neutral-400 hidden sm:inline">
            • {courtTitle}
          </span>
        </div>

        {/* Camera Views & Interactive Gavel Trigger */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-black/60 p-0.5 border border-amber-500/30 text-[11px] font-mono">
            <button
              onClick={() => setActiveCam("arena")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeCam === "arena"
                  ? "bg-amber-500/30 text-amber-300 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Arena View
            </button>
            <button
              onClick={() => setActiveCam("bench")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeCam === "bench"
                  ? "bg-amber-500/30 text-amber-300 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Bench
            </button>
            <button
              onClick={() => setActiveCam("bar")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeCam === "bar"
                  ? "bg-amber-500/30 text-amber-300 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Opposition Bar
            </button>
          </div>

          {onTriggerGavel && (
            <button
              onClick={onTriggerGavel}
              className="apple-glass-pill px-3 py-1 text-xs text-amber-300 hover:text-white border-amber-500/40 bg-black/70 flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-md"
              title="Strike Gavel"
            >
              <Gavel className={`h-3.5 w-3.5 ${isGavelStriking ? "animate-bounce text-amber-400" : ""}`} />
              <span className="font-mono text-[11px] font-bold">Bang Gavel</span>
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          COURTROOM PIXEL STAGE
          ══════════════════════════════════════════════════════════════════ */}
      <div className="relative rounded-2xl bg-black/80 border border-amber-500/40 p-4 md:p-6 overflow-hidden">
        {/* Courtroom Wall Panelling & Emblem Watermark */}
        <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
          <Scale className="h-72 w-72 text-amber-400" />
        </div>

        {/* Gavel Strike Banner / Shockwave Notification */}
        {isGavelStriking && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-bounce">
            <div className="px-5 py-2 rounded-xl bg-amber-500 text-black font-extrabold font-mono text-xs md:text-sm tracking-widest border-2 border-yellow-200 shadow-[0_0_25px_rgba(245,158,11,0.9)] flex items-center gap-2 uppercase">
              <Sparkles className="h-4 w-4" />
              <span>*ORDER IN THE COURT!*</span>
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        )}

        {/* STAGE TIER 1: THE ELEVATED JUDICIAL BENCH */}
        <div
          className={`transition-all duration-300 ${
            activeCam === "bar" ? "opacity-30 scale-95" : "opacity-100 scale-100"
          }`}
        >
          <div className="flex flex-col items-center justify-center text-center relative z-10">
            {/* The High Dais Wood Pedestal */}
            <div className="relative group">
              {/* Bench Nameplate */}
              <div className="mb-1 text-[10px] font-mono tracking-widest text-amber-300 font-bold uppercase bg-black/70 px-3 py-0.5 rounded-full border border-amber-500/30 inline-flex items-center gap-1.5 shadow-md">
                <Scale className="h-3 w-3 text-amber-400" />
                <span>Hon'ble Presiding Judge</span>
              </div>

              {/* The Pixel Judge Sprite */}
              <div
                className={`relative mx-auto transition-transform duration-150 ${
                  isGavelStriking ? "scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" : ""
                }`}
                style={{ width: 140 }}
              >
                <PixelSprite
                  matrix={isGavelStriking ? PIXEL_JUDGE_STRIKE : PIXEL_JUDGE_IDLE}
                  pixelSize={5}
                />
              </div>

              {/* Judge Reactive Speech Pill */}
              {lastTurnSender === "judge" && (
                <div className="mt-1 inline-block animate-fade-in bg-amber-950/80 border border-amber-400/60 px-3 py-1 rounded-full text-[11px] font-mono text-amber-200 shadow-md">
                  ⚖️ The Bench is evaluating submissions
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STAGE TIER 2: ADVOCATE BAR (DEFENSE vs OPPOSITION COUNSEL) */}
        <div
          className={`grid grid-cols-2 gap-4 md:gap-12 mt-6 pt-5 border-t border-amber-500/20 relative z-10 transition-all duration-300 ${
            activeCam === "bench" ? "opacity-30 scale-95" : "opacity-100 scale-100"
          }`}
        >
          {/* Left: Defense Bar (Advocate / You) */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-1 px-2.5 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-[10px] font-mono text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span>Defense Bar (You)</span>
            </div>

            <div className="relative" style={{ width: 112 }}>
              <PixelSprite matrix={PIXEL_DEFENSE_IDLE} pixelSize={4} />
            </div>

            <span className="text-[10px] font-mono text-neutral-400 mt-1">
              Briefcase & BNSS Records
            </span>
          </div>

          {/* Right: Opposition Bar (Public Prosecutor / State Counsel) */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`mb-1 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-md transition-colors ${
                isOppositionActive
                  ? "bg-rose-950/90 border-rose-400 text-rose-200 animate-pulse"
                  : "bg-rose-950/60 border-rose-500/30 text-rose-300"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span>Opposition (Public Prosecutor)</span>
            </div>

            <div
              className={`relative transition-transform duration-200 ${
                isOppositionActive ? "scale-105" : ""
              }`}
              style={{ width: 112 }}
            >
              <PixelSprite
                matrix={isOppositionActive ? PIXEL_OPPOSITION_OBJECT : PIXEL_OPPOSITION_IDLE}
                pixelSize={4}
              />
            </div>

            {/* Opposition Reaction Balloon */}
            {isOppositionActive ? (
              <div className="mt-1 px-3 py-1 rounded-full bg-rose-900/80 border border-rose-400 text-[11px] font-mono font-bold text-rose-100 shadow-md animate-bounce">
                ❗ "State Vehemently Contests!"
              </div>
            ) : (
              <span className="text-[10px] font-mono text-neutral-400 mt-1">
                State Case Diary Docket
              </span>
            )}
          </div>
        </div>

        {/* STAGE TIER 3: COURTROOM PUBLIC GALLERY (THE PIXEL CROWD) */}
        <div
          className={`mt-6 pt-5 border-t-2 border-amber-500/30 relative z-10 transition-all duration-300 ${
            activeCam !== "arena" ? "opacity-40" : "opacity-100"
          }`}
        >
          {/* Gallery Header with Animated Murmurs */}
          <div className="flex items-center justify-between mb-2 px-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <span className="text-sm">👥</span>
              <span className="uppercase tracking-wider text-[11px]">Courtroom Spectator Gallery</span>
            </div>
            <div className="text-[11px] text-amber-200/80 italic flex items-center gap-1 bg-black/60 px-3 py-0.5 rounded-full border border-amber-500/20">
              <MessageSquare className="h-3 w-3 text-amber-400" />
              <span>{crowdWhisper}</span>
            </div>
          </div>

          {/* Panoramic Pixel Crowd Bench (Constable, Clerk, Intern, Citizens, Journalist) */}
          <div className="relative rounded-xl overflow-hidden bg-black/50 border border-amber-500/30 p-2 shadow-inner">
            <div className="w-full max-w-[560px] mx-auto">
              <PixelSprite matrix={PIXEL_CROWD_GALLERY} pixelSize={6.5} />
            </div>

            {/* Spectator Identification Legend */}
            <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] font-mono text-neutral-400">
              <span className="flex items-center gap-1 text-amber-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Police Constable
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Court Stenographer
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Law Students / Interns
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                Complainant
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                Legal Press
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Court Decorum Status */}
      <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 px-1 gap-2">
        <span className="text-amber-300/80">
          Courtroom Sub Judice Atmosphere: <strong className="text-emerald-400">Active Hearing</strong>
        </span>
        <span className="text-neutral-400">
          Bench Temperament: <strong className="text-amber-300">Inquisitive & Rigorous</strong>
        </span>
      </div>
    </div>
  );
}
