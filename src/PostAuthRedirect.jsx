import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { consumePostAuthRedirectTarget } from "./utils/postAuthRedirect";
import { resolveWorkspaceContext } from "./utils/workspaceContext";

function PostAuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const target = consumePostAuthRedirectTarget();
    if (target) {
      const run = async () => {
        let resolvedTarget = target;
        let reason = "stored-target";
        console.info("[REDIRECT DEBUG] PostAuthRedirect evaluating target", {
          uid: user?.uid || null,
          target,
        });

        if (target.startsWith("/welcome") && user?.uid) {
          try {
            const workspace = await resolveWorkspaceContext(user);
            console.info("[WORKSPACE RESOLVE] PostAuthRedirect resolve result", {
              uid: user.uid,
              workspace,
            });
            if (workspace?.hasWorkspace) {
              resolvedTarget = "/booking";
              reason = "workspace-found";
            } else {
              reason = `workspace-missing:${workspace?.source || "unknown"}`;
            }
          } catch (error) {
            console.error("[PostAuthRedirect] Failed to resolve user workspace", error);
            reason = "workspace-resolve-error";
          }
        }

        console.info("[REDIRECT DEBUG] PostAuthRedirect redirecting", {
          uid: user?.uid || null,
          target: resolvedTarget,
          reason,
        });
        navigate(resolvedTarget, { replace: true });
      };

      void run();
    }
  }, [user, loading, navigate]);

  return null;
}

export default PostAuthRedirect;
