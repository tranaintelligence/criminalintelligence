import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileText,
  MessageSquare,
  MessagesSquare,
  RefreshCw,
  Scale,
  Shield,
  User,
  Zap,
  Cpu,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Paperclip,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useTranaCredential } from "@/lib/trana-auth";
import {
  getAdminUserDetail,
  getAdminUserChats,
  type AdminUserChatSession,
  type AdminChatMessage,
} from "@/lib/trana-admin-api";
import { downloadCSV } from "@/lib/csv-export";
import { toast } from "sonner";

export const Route = createFileRoute("/founders/users/$userId")({
  head: () => ({
    meta: [
      { title: "User Chat History & Telemetry TRANA Founders" },
      { name: "description", content: "Read-only chat audit and engagement telemetry for citizen inquiry." },
    ],
  }),
  component: FounderUserDetailPage,
});

function FounderUserDetailPage() {
  const params = useParams({ strict: false }) as { userId?: string };
  const rawUserId = params.userId || "";
  let userId = rawUserId;
  try {
    userId = decodeURIComponent(rawUserId);
    if (userId.includes("%")) {
      userId = decodeURIComponent(userId);
    }
  } catch {
    userId = rawUserId;
  }

  const { credential } = useTranaCredential();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // 1. Fetch user detail & founder stats
  const {
    data: userDetail,
    refetch: refetchUser,
    isFetching: isFetchingUser,
    isError: isUserError,
    error: userError,
  } = useQuery({
    queryKey: ["founder-user-detail", userId, credential],
    queryFn: async () => {
      if (!credential || !userId) return null;
      return await getAdminUserDetail(credential, userId);
    },
    enabled: Boolean(credential && userId),
    staleTime: 30000,
  });

  // 2. Fetch full chat sessions & message histories
  const {
    data: chatSessions = [],
    refetch: refetchChats,
    isFetching: isFetchingChats,
    isError: isChatsError,
    error: chatsError,
  } = useQuery({
    queryKey: ["founder-user-chats", userId, credential],
    queryFn: async () => {
      if (!credential || !userId) return [];
      return await getAdminUserChats(credential, userId);
    },
    enabled: Boolean(credential && userId),
    staleTime: 30000,
  });

  // Auto-select the first session if none selected
  const activeSessionId = selectedSessionId || chatSessions[0]?.id || null;
  const currentSession = chatSessions.find((s) => s.id === activeSessionId) || chatSessions[0];

  const stats = userDetail?.stats;

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "—";
    try {
      return new Date(isoStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  // CSV Export for user chat transcripts
  function exportUserChatsCSV() {
    if (!chatSessions || chatSessions.length === 0) {
      toast.error("No chat messages recorded to export for this user.");
      return;
    }

    const headers = [
      "Session ID",
      "Session Title",
      "Session Created At",
      "Session Updated At",
      "Message Index",
      "Sender Role",
      "Model Used",
      "Processing Time (s)",
      "Timestamp",
      "Message Content",
      "Legal Citations / Law Summary",
    ];

    const rows: (string | number | boolean | null | undefined)[][] = [];

    chatSessions.forEach((session) => {
      const messages = session.messages || [];
      if (messages.length === 0) {
        rows.push([
          session.id,
          session.title || "Untitled Session",
          session.created_at,
          session.updated_at,
          0,
          "—",
          "—",
          "—",
          "—",
          "No messages in session",
          "—",
        ]);
      } else {
        messages.forEach((msg, idx) => {
          let summary = "";
          if (msg.structured_content) {
            summary =
              typeof msg.structured_content === "object"
                ? msg.structured_content.summary ||
                  msg.structured_content.plain_english_summary ||
                  msg.structured_content.bail_status ||
                  ""
                : String(msg.structured_content);
          }
          rows.push([
            session.id,
            session.title || "Untitled Session",
            session.created_at,
            session.updated_at,
            idx + 1,
            msg.role === "user" ? "Citizen / User" : "TRANA Legal AI",
            msg.model_used || "—",
            msg.processing_time_seconds ?? "—",
            msg.created_at || "—",
            msg.content || "",
            summary,
          ]);
        });
      }
    });

    const safeEmail = (userDetail?.email || userId).replace(/[^a-zA-Z0-9]/g, "_");
    downloadCSV(
      `trana_chats_${safeEmail}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    );
    toast.success(`Exported ${rows.length} chat message rows to CSV.`);
  }

  return (
    <div className="space-y-6 font-mono text-[#F0F0F0] pb-12">
      {/* Top Breadcrumb & Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/founders/users"
            className="p-2 rounded-lg bg-[#161616] border border-[#2c2c2c] hover:border-white transition-colors text-neutral-300 hover:text-white"
            title="Back to Users Directory"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <Link to="/founders/users" className="hover:underline">
                Users Directory
              </Link>
              <span>/</span>
              <span className="text-amber-200/90 font-medium truncate max-w-[200px] sm:max-w-none">
                {userDetail?.name || userId}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-white mt-0.5">
              {userDetail?.name || "User Details & Chat Audit"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={exportUserChatsCSV}
            disabled={chatSessions.length === 0}
            className="border border-white/40 bg-[#161616] px-3.5 py-2 text-xs uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors flex items-center gap-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download CSV transcript of all sessions for this user"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Chats CSV</span>
          </button>

          <button
            onClick={() => {
              refetchUser();
              refetchChats();
            }}
            disabled={isFetchingUser || isFetchingChats}
            className="border border-[#333333] bg-[#161616] px-3.5 py-2 text-xs uppercase tracking-wider text-white hover:border-white transition-colors flex items-center gap-2 self-start sm:self-auto rounded"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingUser || isFetchingChats ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* User Identity & Key Stats Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Profile Card */}
        <div className="p-5 rounded-xl bg-[#141414] border border-[#242424] space-y-4 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#202020] border border-[#333333] flex items-center justify-center text-amber-200 text-lg font-serif shrink-0">
              {(userDetail?.name || userId).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">
                {userDetail?.name || "Citizen Account"}
              </h2>
              <p className="text-xs text-[#888888] font-mono truncate">
                {userDetail?.email || userId}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#222222] space-y-2 text-xs">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Account Status:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] border ${
                  userDetail?.status === "Active"
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                    : "border-neutral-700 text-neutral-400 bg-neutral-900"
                }`}
              >
                {userDetail?.status || "Active"}
              </span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Joined:</span>
              <span className="text-neutral-200">{formatDate(userDetail?.created_at)}</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Last Active:</span>
              <span className="text-neutral-200">{formatDate(stats?.last_active_at)}</span>
            </div>
          </div>
        </div>

        {/* Founder Telemetry Stats (3 Columns) */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Stat 1: Total Chat Sessions */}
          <div className="p-4 rounded-xl bg-[#141414] border border-[#242424] flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[11px] uppercase tracking-wider">Chat Sessions</span>
              <MessageSquare className="h-4 w-4 text-sky-400" />
            </div>
            <div className="my-2">
              <span className="font-display text-3xl font-semibold text-white">
                {stats?.total_chats ?? chatSessions.length}
              </span>
            </div>
            <span className="text-[10px] text-neutral-500">Legal inquiries initiated</span>
          </div>

          {/* Stat 2: Total Messages */}
          <div className="p-4 rounded-xl bg-[#141414] border border-[#242424] flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[11px] uppercase tracking-wider">Total Messages</span>
              <MessagesSquare className="h-4 w-4 text-purple-400" />
            </div>
            <div className="my-2">
              <span className="font-display text-3xl font-semibold text-white">
                {stats?.total_messages ?? chatSessions.reduce((acc, s) => acc + (s.message_count || 0), 0)}
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 flex justify-between">
              <span>User: {stats?.user_messages_count ?? "—"}</span>
              <span>AI: {stats?.assistant_messages_count ?? "—"}</span>
            </div>
          </div>

          {/* Stat 3: Avg Dialogue Depth */}
          <div className="p-4 rounded-xl bg-[#141414] border border-[#242424] flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[11px] uppercase tracking-wider">Avg Messages / Chat</span>
              <Scale className="h-4 w-4 text-amber-300" />
            </div>
            <div className="my-2">
              <span className="font-display text-3xl font-semibold text-white">
                {stats?.avg_messages_per_chat ?? 0}
              </span>
            </div>
            <span className="text-[10px] text-neutral-500">Dialogue depth</span>
          </div>

          {/* Stat 4: Avg AI Latency */}
          <div className="p-4 rounded-xl bg-[#141414] border border-[#242424] flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[11px] uppercase tracking-wider">Avg Latency</span>
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="my-2">
              <span className="font-display text-3xl font-semibold text-white">
                {stats?.avg_response_time_seconds ? `${stats.avg_response_time_seconds}s` : "< 2.0s"}
              </span>
            </div>
            <span className="text-[10px] text-neutral-500">Statutory engine speed</span>
          </div>
        </div>
      </div>

      {/* Models Breakdown & Attachments Banner */}
      {stats?.models_used && Object.keys(stats.models_used).length > 0 && (
        <div className="p-4 rounded-xl bg-[#111111] border border-[#222222] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-300" />
            <span className="text-neutral-400 font-medium">Models Used by User:</span>
            <div className="flex flex-wrap gap-2 ml-1">
              {Object.entries(stats.models_used).map(([model, count]) => (
                <span
                  key={model}
                  className="px-2.5 py-0.5 rounded-full bg-[#1c1c1c] border border-[#303030] text-amber-200/90 text-[11px] font-mono"
                >
                  {model}: <strong className="text-white">{count}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-neutral-400">
            <Paperclip className="h-4 w-4 text-neutral-500" />
            <span>Uploaded documents: <strong className="text-white">{stats.total_attachments || 0}</strong></span>
          </div>
        </div>
      )}

      {/* Read-Only Chat History Section */}
      <div className="border border-[#222222] rounded-2xl bg-[#0f0f0f] overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-[#222222] bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-amber-300" />
            <span className="text-xs uppercase tracking-wider text-neutral-200 font-semibold">
              Read-Only Chat Audit Console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-neutral-400">
              Viewing {chatSessions.length} {chatSessions.length === 1 ? "session" : "sessions"} recorded
            </span>
            {chatSessions.length > 0 && (
              <button
                type="button"
                onClick={exportUserChatsCSV}
                className="text-[11px] text-amber-300 hover:text-white flex items-center gap-1 font-mono transition-colors"
                title="Download CSV transcript of all sessions for this user"
              >
                <Download className="h-3 w-3" />
                <span>Download CSV</span>
              </button>
            )}
          </div>
        </div>

        {isFetchingChats ? (
          <div className="p-16 text-center text-neutral-400 space-y-3">
            <RefreshCw className="h-8 w-8 mx-auto animate-spin text-amber-300" />
            <p className="text-sm font-medium text-neutral-200">
              Loading chat sessions and message audit...
            </p>
            <p className="text-xs text-neutral-500">
              Retrieving full legal inquiry history from the secure database.
            </p>
          </div>
        ) : isChatsError ? (
          <div className="p-12 text-center text-rose-300 space-y-3 bg-rose-950/20 border-t border-rose-900/30">
            <AlertCircle className="h-8 w-8 mx-auto text-rose-400" />
            <p className="text-sm font-medium">
              Could not retrieve user chat logs.
            </p>
            <p className="text-xs text-rose-400 font-mono">
              {chatsError instanceof Error
                ? chatsError.message
                : "Ensure you are signed in with an authorized admin account."}
            </p>
            <button
              onClick={() => {
                refetchUser();
                refetchChats();
              }}
              className="mt-2 px-3.5 py-1.5 rounded bg-rose-900/50 hover:bg-rose-900 text-white text-xs uppercase tracking-wider"
            >
              Retry
            </button>
          </div>
        ) : chatSessions.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 space-y-3">
            <MessageSquare className="h-10 w-10 mx-auto opacity-30 text-amber-200" />
            <p className="text-sm font-medium text-neutral-300">
              No chat sessions recorded for this user yet.
            </p>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              When the citizen initiates statutory inquiries or chats with TRANA AI, the dialog history and citations will appear here in read-only mode.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[550px]">
            {/* Left Sessions Column (4 cols) */}
            <div className="md:col-span-4 border-r border-[#222222] bg-[#111111] overflow-y-auto max-h-[650px] divide-y divide-[#1c1c1c]">
              <div className="p-3 text-[10px] font-mono uppercase tracking-widest text-neutral-400 bg-[#161616]">
                Sessions Timeline
              </div>
              {chatSessions.map((session) => {
                const isSelected = session.id === currentSession?.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full text-left p-4 transition-colors relative block ${
                      isSelected
                        ? "bg-[#1c1c1c] text-white border-l-2 border-amber-400"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-[#161616]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs truncate max-w-[200px] text-white">
                        {session.title || "Untitled Legal Inquiry"}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#242424] text-neutral-300 shrink-0">
                        {session.message_count || session.messages?.length || 0} msgs
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono mt-2">
                      <span>{formatDate(session.updated_at || session.created_at)}</span>
                      {isSelected && (
                        <span className="text-amber-300 text-[10px] font-semibold">Active</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Message History Column (8 cols) */}
            <div className="md:col-span-8 flex flex-col bg-[#0d0d0d] overflow-hidden">
              {/* Session Meta Header */}
              {currentSession && (
                <div className="p-4 border-b border-[#222222] bg-[#121212] flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {currentSession.title || "Untitled Session"}
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      Session ID: {currentSession.id} · Created: {formatDate(currentSession.created_at)}
                    </p>
                  </div>

                  {currentSession.attachments && currentSession.attachments.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-200/90 bg-[#1c1c1c] px-3 py-1 rounded-lg border border-[#2e2e2e]">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>{currentSession.attachments.length} attachment(s)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[580px]">
                {(!currentSession?.messages || currentSession.messages.length === 0) ? (
                  <div className="py-12 text-center text-neutral-500 text-xs">
                    No messages recorded in this session.
                  </div>
                ) : (
                  currentSession.messages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col space-y-1.5 ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      {/* Sender & Timestamp Pill */}
                      <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400 px-1">
                        <span className="font-semibold text-neutral-300">
                          {msg.role === "user" ? userDetail?.name || "Citizen" : "TRANA Statutory AI"}
                        </span>
                        {msg.model_used && (
                          <span className="px-1.5 py-0.2 rounded bg-[#1e1e1e] border border-[#2c2c2c] text-amber-300">
                            {msg.model_used}
                          </span>
                        )}
                        {msg.processing_time_seconds !== undefined && msg.processing_time_seconds !== null && (
                          <span className="text-neutral-500">
                            {Number(msg.processing_time_seconds).toFixed(2)}s
                          </span>
                        )}
                        {msg.created_at && <span>{formatDate(msg.created_at)}</span>}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#222222] border border-[#333333] text-neutral-100 rounded-tr-none"
                            : "bg-[#141414] border border-[#282828] text-neutral-200 rounded-tl-none space-y-2"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>

                        {/* If assistant has structured legal citations */}
                        {msg.role === "assistant" && msg.structured_content && (
                          <div className="mt-3 pt-3 border-t border-[#262626] space-y-2">
                            {msg.structured_content.bail_status && (
                              <div className="text-[11px] text-amber-300/90 font-mono">
                                <strong>Bail Assessment:</strong> {msg.structured_content.bail_status}
                              </div>
                            )}
                            {msg.structured_content.handling_authority && (
                              <div className="text-[11px] text-neutral-400 font-mono">
                                <strong>Authority:</strong> {msg.structured_content.handling_authority}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Read-Only Notice Footer */}
              <div className="p-3 bg-[#111111] border-t border-[#222222] text-center text-[10px] text-neutral-500 font-mono flex items-center justify-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Read-only compliance audit trail. Modifications are restricted.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
