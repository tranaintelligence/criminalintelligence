import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        throw redirect({ to: "/auth", search: { redirect: location.pathname } });
      }
      return { user: data.user };
    } catch (err) {
      if (err && typeof err === "object" && ("to" in err || "href" in err || "status" in err || "statusCode" in err)) {
        throw err;
      }
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
  },
  component: () => <Outlet />,
});
