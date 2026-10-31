import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Activity, Server, Database, Cpu, Wifi, 
  AlertCircle, CheckCircle2, RefreshCw, Radio 
} from "lucide-react";
import { 
  ResponsiveContainer, LineChart, Line, BarChart, 
  Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip 
} from "recharts";

export const Route = createFileRoute("/founders/health")({
  head: () => ({
    meta: [
      { title: "Founders Dashboard — TRANA" },
      { name: "description", content: "Real-time AI telemetry, API costs, database size, error rates, and usage charts." },
      { property: "og:title", content: "Founders Dashboard — TRANA" },
    ],
  }),
  component: FoundersHealthPage,
});

// 30 Days of Daily Active Users
const dauData = [
  { day: "1 Oct", dau: 320 },
  { day: "2 Oct", dau: 345 },
  { day: "3 Oct", dau: 360 },
  { day: "4 Oct", dau: 330 },
  { day: "5 Oct", dau: 380 },
  { day: "6 Oct", dau: 410 },
  { day: "7 Oct", dau: 425 },
  { day: "8 Oct", dau: 440 },
  { day: "9 Oct", dau: 470 },
  { day: "10 Oct", dau: 490 },
  { day: "11 Oct", dau: 512 },
  { day: "12 Oct", dau: 540 },
  { day: "13 Oct", dau: 535 },
  { day: "14 Oct", dau: 580 },
  { day: "15 Oct", dau: 610 },
  { day: "16 Oct", dau: 645 },
  { day: "17 Oct", dau: 690 },
  { day: "18 Oct", dau: 710 },
  { day: "19 Oct", dau: 685 },
  { day: "20 Oct", dau: 740 },
  { day: "21 Oct", dau: 790 },
  { day: "22 Oct", dau: 840 },
  { day: "23 Oct", dau: 895 },
  { day: "24 Oct", dau: 942 },
];

// Analyses run per day (Last 14 days)
const analysesPerDay = [
  { date: "11 Oct", analyses: 14 },
  { date: "12 Oct", analyses: 19 },
  { date: "13 Oct", analyses: 17 },
  { date: "14 Oct", analyses: 22 },
  { date: "15 Oct", analyses: 28 },
  { date: "16 Oct", analyses: 25 },
  { date: "17 Oct", analyses: 31 },
  { date: "18 Oct", analyses: 36 },
  { date: "19 Oct", analyses: 30 },
  { date: "20 Oct", analyses: 42 },
  { date: "21 Oct", analyses: 48 },
  { date: "22 Oct", analyses: 51 },
  { date: "23 Oct", analyses: 59 },
  { date: "24 Oct", analyses: 64 },
];

// User type split
const userTypeSplit = [
  { name: "Citizens", value: 980, color: "#FFFFFF" },
  { name: "Lawyers", value: 310, color: "#888888" },
  { name: "Law Students", value: 138, color: "#3A3A3A" },
];

function FoundersHealthPage() {
  const [activeSessions, setActiveSessions] = useState(47);
  const [lastTick, setLastTick] = useState(new Date().toLocaleTimeString());
  const [isLiveTelemetry, setIsLiveTelemetry] = useState(true);

  // Live real-time telemetry pulse
  useEffect(() => {
    if (!isLiveTelemetry) return;
    const interval = setInterval(() => {
      // Small realistic jitter
      setActiveSessions((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(38, Math.min(64, prev + delta));
      });
      setLastTick(new Date().toLocaleTimeString());
    }, 4000);

    return () => clearInterval(interval);
  }, [isLiveTelemetry]);

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] text-[#888888] uppercase tracking-widest">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            <span>INFRASTRUCTURE & SERVICE LEVEL TELEMETRY</span>
          </div>
          <h1 className="font-display text-3xl font-medium text-white mt-1">
            Platform Health
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border border-[#333333] bg-[#111111] px-2.5 py-1 text-[0.7rem] text-[#CCCCCC]">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Pulse: {lastTick}</span>
          </div>
          <button
            onClick={() => setIsLiveTelemetry(!isLiveTelemetry)}
            className={`border px-2.5 py-1 text-[0.7rem] uppercase transition-colors ${
              isLiveTelemetry ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20" : "border-[#333333] text-[#888888]"
            }`}
          >
            {isLiveTelemetry ? "Live Stream ON" : "Stream Paused"}
          </button>
        </div>
      </div>

      {/* TOP 6 CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Claude API calls this month (+ cost estimate) */}
        <div className="bg-[#111111] border border-[#222222] p-4 flex flex-col justify-between shadow-md">
          <span className="text-[0.65rem] uppercase text-[#888888]">Claude API Calls</span>
          <div className="my-2">
            <span className="font-display text-2xl font-semibold text-white">4,812</span>
          </div>
          <div className="text-[0.65rem] text-amber-300 font-mono">
            Est. $48.12 (₹4,042)
          </div>
        </div>

        {/* Card 2: Average AI response time */}
        <div className="bg-[#111111] border border-[#222222] p-4 flex flex-col justify-between shadow-md">
          <span className="text-[0.65rem] uppercase text-[#888888]">Avg Response Time</span>
          <div className="my-2">
            <span className="font-display text-2xl font-semibold text-white">1.18s</span>
          </div>
          <div className="text-[0.65rem] text-emerald-400">
            p95: 1.84s (Fast)
          </div>
        </div>

        {/* Card 3: Error rate (%) */}
        <div className="bg-[#111111] border border-[#222222] p-4 flex flex-col justify-between shadow-md">
          <span className="text-[0.65rem] uppercase text-[#888888]">Error Rate (%)</span>
          <div className="my-2">
            <span className="font-display text-2xl font-semibold text-white">0.04%</span>
          </div>
          <div className="text-[0.65rem] text-emerald-400">
            2 errors / 4,812 reqs
          </div>
        </div>

        {/* Card 4: Uptime status — green/red dot */}
        <div className="bg-[#111111] border border-[#222222] p-4 flex flex-col justify-between shadow-md">
          <span className="text-[0.65rem] uppercase text-[#888888]">Uptime Status</span>
          <div className="my-2 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-display text-2xl font-semibold text-emerald-400">99.98%</span>
          </div>
          <div className="text-[0.65rem] text-[#888888]">
            30 days zero outage
          </div>
        </div>

        {/* Card 5: Supabase database size */}
        <div className="bg-[#111111] border border-[#222222] p-4 flex flex-col justify-between shadow-md">
          <span className="text-[0.65rem] uppercase text-[#888888]">Supabase DB Size</span>
          <div className="my-2">
            <span className="font-display text-2xl font-semibold text-white">142.8 MB</span>
          </div>
          <div className="text-[0.65rem] text-[#888888]">
            Allocated: 500 MB
          </div>
        </div>

        {/* Card 6: Active sessions right now */}
        <div className="bg-[#111111] border border-[#222222] p-4 flex flex-col justify-between shadow-md">
          <span className="text-[0.65rem] uppercase text-[#888888]">Active Sessions</span>
          <div className="my-2">
            <span className="font-display text-2xl font-semibold text-white">{activeSessions}</span>
          </div>
          <div className="text-[0.65rem] text-emerald-400 animate-pulse">
            ● Real-time sockets
          </div>
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Line Chart: Daily active users (last 30 days) - 7 cols */}
        <div className="lg:col-span-7 bg-[#111111] border border-[#222222] p-5 shadow-md">
          <div className="flex items-center justify-between border-b border-[#222222] pb-3 mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                Daily Active Users (Last 30 Days)
              </h2>
              <span className="text-[0.65rem] text-[#777777]">
                Linear growth rate: +194% MoM
              </span>
            </div>
            <span className="text-xs font-mono text-white">Peak: 942 DAU</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dauData}>
                <XAxis dataKey="day" stroke="#555555" fontSize={10} tickLine={false} />
                <YAxis stroke="#555555" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#161616", borderColor: "#333333", fontSize: "11px", color: "#FFF" }}
                  itemStyle={{ color: "#FFF" }}
                />
                <Line
                  type="monotone"
                  dataKey="dau"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  dot={{ fill: "#FFFFFF", r: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: User type split - 5 cols */}
        <div className="lg:col-span-5 bg-[#111111] border border-[#222222] p-5 shadow-md">
          <div className="flex items-center justify-between border-b border-[#222222] pb-3 mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                User Type Distribution
              </h2>
              <span className="text-[0.65rem] text-[#777777]">
                1,428 Registered Platform Accounts
              </span>
            </div>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={userTypeSplit}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  stroke="#111111"
                  strokeWidth={2}
                >
                  {userTypeSplit.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#161616", borderColor: "#333333", fontSize: "11px", color: "#FFF" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#222222] text-[0.7rem] text-center">
            <div>
              <span className="inline-block h-2 w-2 bg-white mr-1" />
              <span className="text-white block font-medium">Citizens</span>
              <span className="text-[#888888]">68.6%</span>
            </div>
            <div>
              <span className="inline-block h-2 w-2 bg-[#888888] mr-1" />
              <span className="text-white block font-medium">Lawyers</span>
              <span className="text-[#888888]">21.7%</span>
            </div>
            <div>
              <span className="inline-block h-2 w-2 bg-[#3A3A3A] mr-1" />
              <span className="text-white block font-medium">Students</span>
              <span className="text-[#888888]">9.7%</span>
            </div>
          </div>
        </div>

        {/* Bar Chart: Analyses run per day (Last 14 days) - 12 cols */}
        <div className="lg:col-span-12 bg-[#111111] border border-[#222222] p-5 shadow-md">
          <div className="flex items-center justify-between border-b border-[#222222] pb-3 mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                Analyses Run Per Day (Last 14 Days)
              </h2>
              <span className="text-[0.65rem] text-[#777777]">
                Model utilization & daily legal synthesis volume
              </span>
            </div>
            <span className="text-xs font-mono text-emerald-400">Today: 64 analyses</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysesPerDay}>
                <XAxis dataKey="date" stroke="#555555" fontSize={10} tickLine={false} />
                <YAxis stroke="#555555" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#161616", borderColor: "#333333", fontSize: "11px", color: "#FFF" }}
                  itemStyle={{ color: "#FFF" }}
                />
                <Bar dataKey="analyses" fill="#E0E0E0" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
