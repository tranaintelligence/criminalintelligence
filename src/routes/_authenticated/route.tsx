import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { syncUserStatutoryAcknowledgement } from "@/components/StatutoryDisclaimerModal";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      // 1. Direct TRANA session in localStorage
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("trana_session_token");
        const userRaw = localStorage.getItem("trana_user");
        if (token && userRaw) {
          try {
            const userObj = JSON.parse(userRaw);
            if (userObj && (userObj.email || userObj.id)) {
              const authenticatedUser = {
                id: userObj.id || userObj.email,
                email: userObj.email,
                name: userObj.name || userObj.email?.split("@")[0] || "User",
                user_metadata: {
                  full_name: userObj.name,
                  avatar_url: userObj.picture,
                },
              };
              void syncUserStatutoryAcknowledgement(authenticatedUser);
              return {
                user: authenticatedUser,
              };
            }
          } catch {
            // invalid JSON, ignore
          }
        }
      }

      // 2. Supabase session fallback
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        void syncUserStatutoryAcknowledgement({
          id: data.user.id,
          email: data.user.email,
          name: (data.user.user_metadata?.full_name as string) || data.user.email?.split("@")[0] || "User",
        });
        return { user: data.user };
      }

      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    } catch (err) {
      if (err && typeof err === "object" && ("to" in err || "href" in err || "status" in err || "statusCode" in err)) {
        throw err;
      }
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
  },
  component: () => <Outlet />,
});
