import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

const label: Record<string, string> = { requested: "Requested", upcoming: "Upcoming", completed: "Completed", cancelled: "Cancelled" };

function Consultations() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["consultations"],
    queryFn: async () => (await supabase.from("consultations").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function cancel(id: string) {
    await supabase.from("consultations").update({ status: "cancelled" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["consultations"] });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display text-4xl md:text-5xl">My Consultations</h1>
        {data.length > 0 && (
          <Link
            to="/dashboard/cases"
            className="border border-border bg-card px-4 py-2 text-xs uppercase tracking-wider text-foreground hover:bg-neutral-800 transition-colors flex items-center gap-2 font-mono self-start sm:self-auto"
          >
            <span>Case Tracker (CNR)</span>
          </Link>
        )}
      </div>
      {isLoading ? null : data.length === 0 ? (
        <div className="mt-10 border border-border bg-card p-8">
          <p className="text-sm text-muted-foreground">No consultations yet. Find a lawyer to get started.</p>
          <Link to="/dashboard/lawyers" className="btn-solid mt-6">Find a Lawyer</Link>
        </div>
      ) : (
        <div className="mt-10 overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>{["Date", "Lawyer Name", "Type", "Status", "Action"].map((h) => <th key={h} className="px-5 py-4 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-4">{new Date(c.scheduled_for ?? c.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">{c.lawyer_name}</td>
                  <td className="px-5 py-4 capitalize">{c.consult_type}</td>
                  <td className="px-5 py-4">{label[c.status] ?? c.status}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        to="/dashboard/cases"
                        className="text-xs uppercase tracking-[0.1em] text-emerald-400 hover:underline font-mono"
                      >
                        Track Case
                      </Link>
                      {(c.status === "requested" || c.status === "upcoming") && (
                        <button onClick={() => cancel(c.id)} className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground">Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
