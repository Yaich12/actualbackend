import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { consumePostAuthRedirectTarget } from "./utils/postAuthRedirect";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

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

        if (target.startsWith("/welcome") && user?.uid) {
          try {
            const snap = await getDoc(doc(db, "users", user.uid));
            const data = snap.exists() ? snap.data() : null;
            if (data?.onboardingComplete === true) {
              resolvedTarget = "/booking";
            }
          } catch (error) {
            console.error("[PostAuthRedirect] Failed to resolve onboarding state", error);
          }
        }

        console.log("[PostAuthRedirect] redirecting to stored target:", resolvedTarget);
        navigate(resolvedTarget, { replace: true });
      };

      void run();
    }
  }, [user, loading, navigate]);

  return null;
}

export default PostAuthRedirect;

