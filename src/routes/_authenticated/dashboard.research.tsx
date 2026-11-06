import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/research")({
  beforeLoad: () => {
    throw redirect({ to: "/student" });
  },
  component: () => null,
});
