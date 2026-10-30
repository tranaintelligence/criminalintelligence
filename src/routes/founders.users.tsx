import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/founders/users")({
  component: FoundersUsersLayout,
});

function FoundersUsersLayout() {
  return <Outlet />;
}
