import { createFileRoute } from "@tanstack/react-router";
import { useLawyerAuth } from "./lawyer";
import { ProfessionalNetworkView } from "@/components/ProfessionalNetworkView";

export const Route = createFileRoute("/_authenticated/lawyer/network")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "TRANA's professional network: connect, collaborate, and exchange research with advocates and law scholars." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerNetworkPage,
});

function LawyerNetworkPage() {
  const { data: myProfile } = useLawyerAuth();

  let courtsLabel = "Supreme Court of India · Delhi High Court";
  if (myProfile?.courts) {
    try {
      const parsed = Array.isArray(myProfile.courts) ? myProfile.courts : JSON.parse(myProfile.courts);
      if (Array.isArray(parsed) && parsed.length > 0) {
        courtsLabel = parsed.slice(0, 2).join(" · ") + (parsed.length > 2 ? ` +${parsed.length - 2} more` : "");
      }
    } catch {
      courtsLabel = String(myProfile.courts);
    }
  }

  const currentUser = {
    id: myProfile?.user_id || myProfile?.id || "advocate-current",
    userId: myProfile?.user_id || myProfile?.id,
    name: myProfile?.full_name || "Advocate Counsel",
    email: myProfile?.email,
    role: "lawyer" as const,
    roleLabel: `Advocate (${myProfile?.bar_reg_no || "Verified Sanad"})`,
    affiliation: courtsLabel,
    city: myProfile?.city || "New Delhi",
  };

  return <ProfessionalNetworkView currentUser={currentUser} baseRoute="/lawyer" />;
}
