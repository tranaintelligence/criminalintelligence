import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Phone, MessageSquare, FileText, X, Copy, CheckCircle2, XCircle, Clock, UserPlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConsultationChatModal } from "@/components/ConsultationChatModal";

export const Route = createFileRoute("/_authenticated/dashboard/consultations")({
  head: () => ({
    meta: [
      { title: "Citizens Dashboard — TRANA" },
      { name: "description", content: "Your past and upcoming consultations with TRANA lawyers." },
      { property: "og:title", content: "Citizens Dashboard — TRANA" },
      { property: "og:description", content: "Track your consultations." },
    ],
  }),
  component: Consultations,
});

const label: Record<string, string> = { 
  requested: "Requested", 
  confirmed: "Confirmed",
  denied: "Denied",
  upcoming: "Upcoming", 
  completed: "Completed", 
  cancelled: "Cancelled" 
};

function Consultations() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedBrief, setSelectedBrief] = useState<any | null>(null);
  const [activeChat, setActiveChat] = useState<{
    consultationId: string;
    lawyerName: string;
    clientName: string;
    consultType: string;
  } | null>(null);

  const { data: dbData = [], isLoading } = useQuery({
    queryKey: ["consultations"],
    queryFn: async () => (await supabase.from("consultations").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  // Reconcile database consultations and instant local consultations
  const allConsultations = useMemo(() => {
    let localReferrals: any[] = [];
    try {
      if (typeof window !== "undefined") {
        localReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      }
    } catch {
      // ignore
    }

    const list: any[] = [];

    // 1. Add from local storage (latest requested)
    (localReferrals || []).forEach((r) => {
      if (r && r.id) {
        list.push({
          id: r.id,
          created_at: r.created_at || new Date().toISOString(),
          scheduled_for: r.scheduledTime,
          lawyer_name: r.lawyerName || "Advocate Counsel",
          consult_type: r.consultationType?.toLowerCase() || "call",
          status: r.status?.toLowerCase() || "requested",
          note: r.intakeBrief || r.summary,
          intake_brief: r.intakeBrief,
          matter_type: r.matterType || "Legal Consultation Request",
        });
      }
    });

    // 2. Add from Supabase consultations table (deduplicating by ID or timestamp)
    (dbData || []).forEach((row) => {
      const matchIndex = list.findIndex(
        (existing) =>
          existing.id === row.id ||
          existing.id === `REF-${row.id.slice(0, 8).toUpperCase()}` ||
          (existing.lawyer_name === row.lawyer_name &&
            Math.abs(new Date(existing.created_at).getTime() - new Date(row.created_at).getTime()) < 10000)
      );

      const briefText = row.intake_brief || row.note || "";
      let matter = "Legal Consultation Request";
      if (briefText) {
        const matterMatch = briefText.match(/\*\*Matter\*\*:\s*([^\n]+)/);
        if (matterMatch) matter = matterMatch[1].trim();
      }

      const item = {
        id: row.id,
        created_at: row.created_at,
        scheduled_for: row.scheduled_for,
        lawyer_name: row.lawyer_name,
        consult_type: row.consult_type || "call",
        status: (row.status || "requested").toLowerCase(),
        note: row.note,
        intake_brief: row.intake_brief || row.note,
        matter_type: matter,
      };

      if (matchIndex >= 0) {
        // Prefer database record with merged properties
        list[matchIndex] = { ...list[matchIndex], ...item };
      } else {
        list.push(item);
      }
    });

    return list;
  }, [dbData]);

  async function cancel(id: string) {
    await supabase.from("consultations").update({ status: "cancelled" }).eq("id", id);
    try {
      const local = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      const updated = local.map((r: any) => (r.id === id ? { ...r, status: "Cancelled" } : r));
      localStorage.setItem("trana_client_referrals", JSON.stringify(updated));
    } catch {
      // ignore
    }
    qc.invalidateQueries({ queryKey: ["consultations"] });
    qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });
    toast.success("Consultation cancelled.");
  }

  async function consultAnotherLawyer(c: any) {
    const lawyerDisplayName = c.lawyer_name || "the current counsel";
    const confirmed = window.confirm(
      `Are you sure you want to consult another lawyer? This will conclude your current session with ${lawyerDisplayName} and reopen the lawyer directory.`
    );
    if (!confirmed) return;

    // 1. Update Supabase
    try {
      await supabase.from("consultations").update({ status: "cancelled" }).eq("id", c.id);
    } catch (e) {
      console.warn("Supabase update error:", e);
    }

    // 2. Update local referrals
    try {
      const local = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      const updated = local.map((r: any) =>
        r.id === c.id || r.id === `REF-${c.id}` ? { ...r, status: "Cancelled", clientSatisfied: false } : r
      );
      localStorage.setItem("trana_client_referrals", JSON.stringify(updated));
    } catch {
      // ignore
    }

    // 3. Unlock directory by removing from user's requested lawyer set
    try {
      if (user?.id) {
        localStorage.removeItem(`trana_requested_lawyers_${user.id}`);
      }
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("trana_requested_lawyers_")) {
          const arr = JSON.parse(localStorage.getItem(k) || "[]");
          const filtered = arr.filter((item: any) => {
            const id = typeof item === "string" ? item : item?.id;
            const name = typeof item === "object" ? item?.name : "";
            return id !== c.lawyer_id && id !== c.id && (!c.lawyer_name || !name.toLowerCase().includes(c.lawyer_name.toLowerCase()));
          });
          localStorage.setItem(k, JSON.stringify(filtered));
        }
      });
    } catch {
      // ignore
    }

    // 4. Invalidate queries
    qc.invalidateQueries({ queryKey: ["consultations"] });
    qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });
    window.dispatchEvent(new Event("trana_consult_chat_update"));

    toast.info("Session concluded. Redirecting to Lawyer Directory to choose another lawyer.");
    navigate({ to: "/dashboard/lawyers" });
  }

  const clientName =
    (user as any).name || (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Citizen Client";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">My Consultations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your legal consultations, confidential chats with counsel, and track proceedings.
          </p>
        </div>

        {allConsultations.length > 0 && (
          <Link
            to="/dashboard/cases"
            className="border border-border bg-card px-4 py-2 text-xs uppercase tracking-wider text-foreground hover:bg-neutral-800 transition-colors flex items-center gap-2 font-mono self-start sm:self-auto"
          >
            <span>Case Tracker (CNR)</span>
          </Link>
        )}
      </div>

      {isLoading && allConsultations.length === 0 ? null : allConsultations.length === 0 ? (
        <div className="mt-10 border border-border bg-card p-8">
          <p className="text-sm text-muted-foreground">No consultations yet. Find a lawyer to get started.</p>
          <Link to="/dashboard/lawyers" className="btn-solid mt-6">Find a Lawyer</Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-border bg-card shadow-sm">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-[#141414] border-b border-border text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                {["Date", "Lawyer Name", "Subject / Matter", "Type", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-4 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allConsultations.map((c) => {
                const normStatus = (c.status || "").toLowerCase();
                const isConfirmed = normStatus === "confirmed";
                const isDenied = normStatus === "denied";
                const isRequested = normStatus === "requested";

                return (
                  <tr key={c.id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-xs font-mono text-muted-foreground">
                      {new Date(c.scheduled_for ?? c.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 font-medium text-foreground whitespace-nowrap">
                      {c.lawyer_name}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground max-w-[200px] truncate" title={c.matter_type}>
                      {c.matter_type || "Legal Consultation Request"}
                    </td>
                    <td className="px-5 py-4 capitalize whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-xs">
                        {c.consult_type?.toLowerCase().includes("chat") ? (
                          <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
                        ) : (
                          <Phone className="h-3.5 w-3.5 text-sky-400" />
                        )}
                        <span>{c.consult_type}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border rounded font-mono ${
                          isConfirmed
                            ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                            : isDenied
                            ? "border-red-500/50 bg-red-950/40 text-red-400"
                            : isRequested
                            ? "border-amber-500/50 bg-amber-950/40 text-amber-300"
                            : "border-border bg-neutral-900 text-muted-foreground"
                        }`}
                      >
                        {label[normStatus] ?? normStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Open Masked Confidential Chat */}
                        <button
                          type="button"
                          onClick={() =>
                            setActiveChat({
                              consultationId: c.id,
                              lawyerName: c.lawyer_name,
                              clientName,
                              consultType: c.consult_type,
                            })
                          }
                          className="border border-white/30 hover:border-white px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider text-foreground hover:bg-neutral-800 transition-colors flex items-center gap-1"
                          title="Open confidential masked chat with counsel"
                        >
                          <MessageSquare className="h-3 w-3 text-emerald-400" />
                          <span>Open Chat</span>
                        </button>

                        {/* Option for client to consult another lawyer if not satisfied */}
                        {(isConfirmed || isRequested || normStatus === "upcoming") && (
                          <button
                            type="button"
                            onClick={() => consultAnotherLawyer(c)}
                            className="border border-amber-500/50 hover:border-amber-400 bg-amber-950/20 hover:bg-amber-900/40 text-amber-300 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1"
                            title="Not satisfied? Conclude this session and consult another lawyer from the directory"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Consult Another</span>
                          </button>
                        )}

                        {/* View Brief details */}
                        {(c.intake_brief || c.note) && (
                          <button
                            type="button"
                            onClick={() => setSelectedBrief(c)}
                            className="border border-border hover:border-foreground/50 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Details</span>
                          </button>
                        )}

                        <Link
                          to="/dashboard/cases"
                          className="text-xs uppercase tracking-[0.1em] text-emerald-400 hover:underline font-mono px-1"
                        >
                          Track Case
                        </Link>

                        {(normStatus === "requested" || normStatus === "upcoming") && (
                          <button
                            onClick={() => cancel(c.id)}
                            className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-red-400 px-1 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CONFIDENTIAL CONSULTATION CHAT MODAL (CLIENT VIEW) */}
      {activeChat && (
        <ConsultationChatModal
          isOpen={Boolean(activeChat)}
          onClose={() => setActiveChat(null)}
          consultationId={activeChat.consultationId}
          consultationType={activeChat.consultType}
          currentParty="client"
          clientName={activeChat.clientName}
          lawyerName={activeChat.lawyerName}
        />
      )}

      {/* MATTER BRIEF & DETAILS MODAL */}
      {selectedBrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#141414] border border-[#333333] p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-[#282828] pb-4">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-mono">
                  Consultation Brief
                </span>
                <h3 className="mt-1 font-display text-2xl font-medium text-white">
                  Counsel: {selectedBrief.lawyer_name}
                </h3>
                <p className="text-xs text-[#888888] font-mono mt-0.5">
                  Matter: {selectedBrief.matter_type} • Mode: {selectedBrief.consult_type}
                </p>
              </div>
              <button
                onClick={() => setSelectedBrief(null)}
                className="p-1 border border-[#333333] text-[#AAAAAA] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-sm text-[#CCCCCC]">
              <div className="bg-[#0E0E0E] border border-[#222222] p-4 whitespace-pre-wrap font-sans leading-relaxed text-xs md:text-sm">
                {selectedBrief.intake_brief || selectedBrief.note}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#262626] flex justify-end">
              <button
                onClick={() => setSelectedBrief(null)}
                className="bg-white text-black px-5 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
