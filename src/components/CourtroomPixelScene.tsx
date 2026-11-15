import React, { useState, useEffect } from "react";
import {
  Gavel,
  Scale,
  Volume2,
  Sparkles,
  MessageSquare,
  Mic,
  Send,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  FileText,
  User,
} from "lucide-react";

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
  ".": "transparent",
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
const charConstable = [
  "....YYyyYY....", "...YYYYYYYY...", "..YYYYYYYYYY..", "..CCCCSSSSCC..",
  "..CCSEEEESCC..", "..CCSSSSSSCC..", "...CCSSSSCC...", "...CCCCCCCC...",
  "..CCCCCCCCCC..", "..CCCCCCCCCC..", "..CCcCCCCcCC..", "..CcCCCCCCcC..",
  "..cCCCCCCCCc..",
];

const charStenographer = [
  "....hhhhhh....", "...hhhhhhhh...", "..hhhhhhhhhh..", "..hhSSSSSSsh..",
  "..hSGGEEGGSh..", "..hhSSSSSSsh..", "...hSSSSSSsh..", "...FFTTTTFF...",
  "..FFFFTTFFFF..", "..FFFFTTFFFF..", "..bbrrTTbbrr..", "..bbbbbbbbbb..",
  "..bbbbbbbbbb..",
];

const charStudent = [
  "....HHHHHH....", "...HHHHHHHH...", "..HHhHHHHhHH..", "..HHSSSSSSHH..",
  "..HHSEEEESHH..", "..HHSSSSSSHH..", "...HSSSSSSH...", "...PPTTTTPP...",
  "..PPPPTTPPPP..", "..PPPPTTPPPP..", "..PPNNNNNNPP..", "..PPNNNNNNPP..",
  "..PPPPPPPPPP..",
];

const charCitizen = [
  "....WWWWWW....", "...WWWWWWWW...", "..WWwWWWWwWW..", "..WWSSSSSSWW..",
  "..WWSEEEESWW..", "..WWSSmmSSWW..", "...WSSSSSSW...", "...OOTTTTOO...",
  "..OOOOTTOOOO..", "..OOOOTTOOOO..", "..OOOOOOOOOO..", "..OOOOOOOOOO..",
  "..OOOOOOOOOO..",
];

const charJournalist = [
  "....hhhhhh....", "...hhhhhhhh...", "..hhHHHHHHhh..", "..hhSSSSSSsh..",
  "..hhSEEEESsh..", "..hhSSSSSSsh..", "...hSSSSSSsh..", "...bbrrJJrrb..",
  "..bbbbrJJrbb..", "..bbbbrJJrbb..", "..bbNNNNNNbb..", "..bbNNNNNNbb..",
  "..bbbbbbbbbb..",
];

const charSenior = [
  "....wwwwww....", "...wwwwwwww...", "..wwWWWWWWww..", "..wwSSSSSSww..",
  "..wSGGEEGGSw..", "..wwSSmmSSww..", "...wSSSSSSw...", "...FFTTTTFF...",
  "..FFFFTTFFFF..", "..FFFFTTFFFF..", "..FFFFFFFFFF..", "..FFFFFFFFFF..",
  "..FFFFFFFFFF..",
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
// COMPACT PIXEL AVATARS FOR TRANSCRIPT
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
// COMPLETE RETRO PIXEL COURTROOM ARENA WITH LIVE DIALOGUE & ADVOCATE'S PODIUM
// ═════════════════════════════════════════════════════════════════════════════
export interface DialogueTurn {
  sender: "judge" | "prosecutor" | "advocate";
  name: string;
  roleTitle: string;
  text: string;
  type?: "submission" | "question" | "ruling" | "objection";
  timestamp?: string;
}

interface CourtroomPixelSceneProps {
  courtTitle?: string;
  isGavelStriking: boolean;
  onTriggerGavel?: () => void;
  latestTurn?: DialogueTurn | null;
  allTurns?: DialogueTurn[];
  // Integrated Advocate Podium Props
  inputArgument?: string;
  onInputChange?: (value: string) => void;
  onSubmitArgument?: (text?: string) => void;
  isSubmittingTurn?: boolean;
  onQuickSubmission?: (text: string) => void;
}

export function CourtroomPixelScene({
  courtTitle = "COURT OF JUDICIAL MAGISTRATE FIRST CLASS",
  isGavelStriking,
  onTriggerGavel,
  latestTurn,
  allTurns = [],
  inputArgument = "",
  onInputChange,
  onSubmitArgument,
  isSubmittingTurn = false,
  onQuickSubmission,
}: CourtroomPixelSceneProps) {
  const [crowdWhisper, setCrowdWhisper] = useState<string>("Gallery: Silence in Court");
  const [activeCam, setActiveCam] = useState<"arena" | "bench" | "bar">("arena");
  const [viewTurnIndex, setViewTurnIndex] = useState<number>(-1);

  const whispers = [
    "Gallery: *murmuring intently as arguments develop*",
    "Law Intern: 'Notice how the counsel handles Section 479 proviso!'",
    "Police Constable: 'Attention in the Court!'",
    "Citizen: 'The defense is citing Satender Kumar Antil...'",
    "Court Clerk: *rapidly typing submissions into judicial record*",
    "Press Reporter: 'Key questions raised on Section 63 BSA certificate!'",
  ];

  // Rotate crowd whispers whenever submissions increase
  useEffect(() => {
    if (allTurns.length > 0) {
      setCrowdWhisper(whispers[allTurns.length % whispers.length]);
      setViewTurnIndex(allTurns.length - 1);
    }
  }, [allTurns.length]);

  const activeTurn =
    viewTurnIndex >= 0 && viewTurnIndex < allTurns.length
      ? allTurns[viewTurnIndex]
      : latestTurn;

  const currentSender = activeTurn ? activeTurn.sender : "judge";
  const isJudgeSpeaking = currentSender === "judge";
  const isOppositionSpeaking = currentSender === "prosecutor";
  const isAdvocateSpeaking = currentSender === "advocate";

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (onSubmitArgument && inputArgument.trim() && !isSubmittingTurn) {
      onSubmitArgument(inputArgument);
    }
  }

  return (
    <div className="rounded-3xl bg-gradient-to-b from-[#1b0d06] via-[#100703] to-[#080301] border-2 border-amber-500/50 p-4 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.95)] relative overflow-hidden select-none space-y-4">
      {/* Top Gold Trim & Crest Header */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 opacity-90" />

      {/* Retro Arcade Courtroom Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>16-Bit Judicial Arena</span>
          </div>
          <span className="text-xs font-mono text-neutral-300 hidden sm:inline">
            • {courtTitle}
          </span>
        </div>

        {/* Camera Views & Interactive Gavel Trigger */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-black/60 p-0.5 border border-amber-500/30 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setActiveCam("arena")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeCam === "arena"
                  ? "bg-amber-500/30 text-amber-300 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Arena View
            </button>
            <button
              type="button"
              onClick={() => setActiveCam("bench")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeCam === "bench"
                  ? "bg-amber-500/30 text-amber-300 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Bench
            </button>
            <button
              type="button"
              onClick={() => setActiveCam("bar")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
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
              type="button"
              onClick={onTriggerGavel}
              className="apple-glass-pill px-3 py-1 text-xs text-amber-300 hover:text-white border-amber-500/40 bg-black/70 flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-md"
              title="Strike Gavel"
            >
              <Gavel
                className={`h-3.5 w-3.5 ${
                  isGavelStriking ? "animate-bounce text-amber-400" : ""
                }`}
              />
              <span className="font-mono text-[11px] font-bold">Bang Gavel</span>
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          COURTROOM PIXEL STAGE (VISUAL BATTLEGROUND)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="relative rounded-2xl bg-black/85 border border-amber-500/40 p-4 md:p-6 overflow-hidden">
        {/* Courtroom Wall Panelling & Emblem Watermark */}
        <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
          <Scale className="h-80 w-80 text-amber-400" />
        </div>

        {/* Gavel Strike Banner / Shockwave Notification */}
        {isGavelStriking && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 animate-bounce">
            <div className="px-5 py-2 rounded-xl bg-amber-500 text-black font-extrabold font-mono text-xs md:text-sm tracking-widest border-2 border-yellow-200 shadow-[0_0_30px_rgba(245,158,11,1)] flex items-center gap-2 uppercase">
              <Sparkles className="h-4 w-4" />
              <span>*ORDER IN THE COURT!*</span>
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        )}

        {/* STAGE TIER 1: THE ELEVATED JUDICIAL BENCH WITH PIXEL JUDGE */}
        <div
          className={`transition-all duration-300 relative ${
            activeCam === "bar" ? "opacity-30 scale-95" : "opacity-100 scale-100"
          }`}
        >
          <div className="flex flex-col items-center justify-center text-center relative z-10">
            {/* The High Dais Wood Pedestal */}
            <div className="relative group flex flex-col items-center">
              {/* Bench Nameplate */}
              <div className="mb-1 text-[10px] font-mono tracking-widest text-amber-300 font-bold uppercase bg-black/80 px-3 py-0.5 rounded-full border border-amber-500/40 inline-flex items-center gap-1.5 shadow-md">
                <Scale className="h-3 w-3 text-amber-400" />
                <span>Hon'ble Presiding Judge</span>
              </div>

              {/* The Pixel Judge Sprite */}
              <div
                className={`relative mx-auto transition-transform duration-150 ${
                  isGavelStriking
                    ? "scale-110 drop-shadow-[0_0_20px_rgba(251,191,36,0.9)]"
                    : isJudgeSpeaking
                    ? "drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    : ""
                }`}
                style={{ width: 130 }}
              >
                <PixelSprite
                  matrix={isGavelStriking ? PIXEL_JUDGE_STRIKE : PIXEL_JUDGE_IDLE}
                  pixelSize={4.8}
                />
              </div>

              {/* LIVE JUDICIAL SPEECH BUBBLE IN THE ARENA */}
              {isJudgeSpeaking && activeTurn && (
                <div className="mt-2 max-w-xl animate-fade-in bg-gradient-to-b from-[#2a1409] to-[#170a04] border-2 border-amber-400 p-3 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.85)] relative z-20 text-left">
                  {/* Arrow pointing up to Judge */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-b-8 border-b-amber-400" />
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-1 mb-1.5 text-[10px] font-mono">
                    <span className="font-bold text-amber-300 uppercase flex items-center gap-1">
                      <Scale className="h-3 w-3 text-amber-400" />
                      <span>The Bench Inquires / Observes</span>
                    </span>
                    <span className="text-amber-200/60 font-mono">
                      {activeTurn.timestamp || "Official Record"}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm font-serif text-amber-50 leading-relaxed font-medium">
                    "{activeTurn.text}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STAGE TIER 2: ADVOCATE BAR (DEFENSE vs OPPOSITION COUNSEL) */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mt-6 pt-5 border-t border-amber-500/20 relative z-10 transition-all duration-300 ${
            activeCam === "bench" ? "opacity-30 scale-95" : "opacity-100 scale-100"
          }`}
        >
          {/* Left: Defense Bar (Advocate / You) */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-1 px-2.5 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-[10px] font-mono text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span>Defense Bar (You)</span>
            </div>

            <div
              className={`relative transition-transform duration-200 ${
                isAdvocateSpeaking
                  ? "scale-105 drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                  : ""
              }`}
              style={{ width: 104 }}
            >
              <PixelSprite matrix={PIXEL_DEFENSE_IDLE} pixelSize={3.8} />
            </div>

            <span className="text-[10px] font-mono text-neutral-400 mt-1">
              Defense Briefcase & Statutory Codes
            </span>

            {/* LIVE DEFENSE SPEECH BUBBLE IN THE ARENA */}
            {isAdvocateSpeaking && activeTurn && (
              <div className="mt-2 w-full max-w-sm animate-fade-in bg-gradient-to-b from-[#1f0d38] to-[#120624] border-2 border-purple-400 p-3 rounded-2xl shadow-xl text-left relative z-20">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-b-6 border-b-purple-400" />
                <div className="flex items-center justify-between border-b border-purple-500/30 pb-1 mb-1.5 text-[10px] font-mono">
                  <span className="font-bold text-purple-300 uppercase">
                    Your Submissions Before Bench
                  </span>
                  <span className="text-purple-200/60 font-mono">
                    {activeTurn.timestamp || "Just Now"}
                  </span>
                </div>
                <p className="text-xs text-purple-50 leading-relaxed font-sans">
                  "{activeTurn.text}"
                </p>
              </div>
            )}
          </div>

          {/* Right: Opposition Bar (Public Prosecutor / State Counsel) */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`mb-1 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-md transition-colors ${
                isOppositionSpeaking
                  ? "bg-rose-950/90 border-rose-400 text-rose-200 animate-pulse"
                  : "bg-rose-950/60 border-rose-500/30 text-rose-300"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span>Opposition (Public Prosecutor)</span>
            </div>

            <div
              className={`relative transition-transform duration-200 ${
                isOppositionSpeaking
                  ? "scale-105 drop-shadow-[0_0_15px_rgba(244,63,94,0.7)]"
                  : ""
              }`}
              style={{ width: 104 }}
            >
              <PixelSprite
                matrix={
                  isOppositionSpeaking ? PIXEL_OPPOSITION_OBJECT : PIXEL_OPPOSITION_IDLE
                }
                pixelSize={3.8}
              />
            </div>

            <span className="text-[10px] font-mono text-neutral-400 mt-1">
              State Case Diary Dossier
            </span>

            {/* LIVE OPPOSITION SPEECH BUBBLE IN THE ARENA */}
            {isOppositionSpeaking && activeTurn && (
              <div className="mt-2 w-full max-w-sm animate-fade-in bg-gradient-to-b from-[#2a0b0b] to-[#170505] border-2 border-rose-400 p-3 rounded-2xl shadow-xl text-left relative z-20">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-b-6 border-b-rose-400" />
                <div className="flex items-center justify-between border-b border-rose-500/30 pb-1 mb-1.5 text-[10px] font-mono">
                  <span className="font-bold text-rose-300 uppercase flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-rose-400" />
                    <span>State Opposition & Objection</span>
                  </span>
                  <span className="text-rose-200/60 font-mono">
                    {activeTurn.timestamp || "Official Record"}
                  </span>
                </div>
                <p className="text-xs text-rose-50 leading-relaxed font-sans font-medium">
                  "{activeTurn.text}"
                </p>
              </div>
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
              <span className="uppercase tracking-wider text-[11px]">
                Courtroom Spectator Gallery
              </span>
            </div>
            <div className="text-[11px] text-amber-200/80 italic flex items-center gap-1 bg-black/60 px-3 py-0.5 rounded-full border border-amber-500/20">
              <MessageSquare className="h-3 w-3 text-amber-400" />
              <span>{crowdWhisper}</span>
            </div>
          </div>

          {/* Panoramic Pixel Crowd Bench */}
          <div className="relative rounded-xl overflow-hidden bg-black/60 border border-amber-500/30 p-2 shadow-inner">
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

      {/* ══════════════════════════════════════════════════════════════════
          INTEGRATED ADVOCATE'S PODIUM (FIGHT THE CASE RIGHT AT THE COURT!)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-gradient-to-r from-[#24130a] via-[#170a04] to-[#0f0502] border-2 border-amber-500/60 p-4 md:p-5 shadow-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow">
              <Mic className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider block">
                Advocate's Speaking Podium (You)
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                Address the Bench directly • Submit legal grounds and argue against the State
              </span>
            </div>
          </div>

          {/* Stepper to browse recent statements */}
          {allTurns.length > 1 && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-black/60 px-2.5 py-1 rounded-full border border-amber-500/30 text-[10px] font-mono text-neutral-300">
              <span>Turn {viewTurnIndex + 1} of {allTurns.length}</span>
              <button
                type="button"
                onClick={() => setViewTurnIndex((prev) => Math.max(0, prev - 1))}
                disabled={viewTurnIndex <= 0}
                className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                title="Previous statement"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setViewTurnIndex((prev) => Math.min(allTurns.length - 1, prev + 1))
                }
                disabled={viewTurnIndex >= allTurns.length - 1}
                className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                title="Next statement"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* The Main Input Form Right At The Courtroom */}
        <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Step to the podium: State your submission, cite provisions or answer the Bench..."
              value={inputArgument}
              onChange={(e) => onInputChange && onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFormSubmit(e);
                }
              }}
              disabled={isSubmittingTurn}
              className="w-full px-4 py-3 text-xs md:text-sm text-white placeholder-neutral-400 bg-black/80 border-2 border-amber-500/50 focus:border-amber-300 rounded-xl outline-none shadow-inner transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingTurn || !inputArgument.trim()}
            className="bg-amber-400 hover:bg-amber-300 text-black font-extrabold disabled:opacity-40 px-6 py-3 rounded-xl text-xs md:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-transform hover:scale-105 shrink-0"
          >
            {isSubmittingTurn ? (
              <>
                <Gavel className="h-4 w-4 animate-spin" />
                <span>Court Deliberating...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Submit to Bench</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Statutory Submission Pills */}
        <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono text-amber-300 uppercase font-bold shrink-0">
            Quick Submissions:
          </span>
          <button
            type="button"
            onClick={() =>
              onQuickSubmission &&
              onQuickSubmission(
                "Hon'ble Bench, under Satender Kumar Antil v. CBI, this matter falls strictly within Category A. Recovery of the property is already effected and the accused has clean police antecedents."
              )
            }
            disabled={isSubmittingTurn}
            className="apple-glass-pill px-3 py-1.5 text-[11px] text-amber-300 hover:text-white border-amber-500/30 cursor-pointer bg-black/50 hover:bg-amber-500/20 transition-colors"
          >
            ⚖️ Cite Satender Antil & Category A
          </button>
          <button
            type="button"
            onClick={() =>
              onQuickSubmission &&
              onQuickSubmission(
                "The accused is an indigent first-time offender entitled to statutory release under Section 479(1) Proviso of BNSS, 2023 having undergone requisite detention."
              )
            }
            disabled={isSubmittingTurn}
            className="apple-glass-pill px-3 py-1.5 text-[11px] text-amber-300 hover:text-white border-amber-500/30 cursor-pointer bg-black/50 hover:bg-amber-500/20 transition-colors"
          >
            📜 Argue Section 479 BNSS Release
          </button>
          <button
            type="button"
            onClick={() =>
              onQuickSubmission &&
              onQuickSubmission(
                "I object to the admissibility of the electronic printouts under Section 63 BSA, 2023. The investigating agency failed to produce a valid certificate."
              )
            }
            disabled={isSubmittingTurn}
            className="apple-glass-pill px-3 py-1.5 text-[11px] text-amber-300 hover:text-white border-amber-500/30 cursor-pointer bg-black/50 hover:bg-amber-500/20 transition-colors"
          >
            ⚠️ Raise Section 63 BSA Objection
          </button>
        </div>
      </div>
    </div>
  );
}
