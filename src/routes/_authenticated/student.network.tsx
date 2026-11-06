import { createFileRoute } from "@tanstack/react-router";
import { useUserRole } from "@/lib/user-role";
import { ProfessionalNetworkView } from "@/components/ProfessionalNetworkView";

export const Route = createFileRoute("/_authenticated/student/network")({
  head: () => ({
    meta: [
      { title: "Student Professional Network — TRANA" },
      { name: "description", content: "Connect with verified advocates, peers, and legal scholars across Indian law schools and High Courts." },
      { property: "og:title", content: "Student Professional Network — TRANA" },
    ],
  }),
  component: StudentNetworkPage,
});

function StudentNetworkPage() {
  const { user } = Route.useRouteContext();
  const { studentProfile } = useUserRole(user?.id, user?.email);

  const currentUser = {
    id: user?.id || "student-current",
    name: user?.name || user?.email?.split("@")[0] || "Law Student",
    email: user?.email,
    role: "student" as const,
    roleLabel: `Law Student (${studentProfile?.degree || "LL.B Scholar"})`,
    affiliation: studentProfile?.university || "National Law University",
    city: studentProfile?.city || "New Delhi",
  };

  return <ProfessionalNetworkView currentUser={currentUser} baseRoute="/student" />;
}

