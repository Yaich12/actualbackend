import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { consumePostAuthRedirectTarget } from "./utils/postAuthRedirect";

function PostAuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const target = consumePostAuthRedirectTarget();
    if (target) {
      console.log("[PostAuthRedirect] redirecting to stored target:", target);
      navigate(target, { replace: true });
    }
  }, [user, loading, navigate]);

  return null;
}

export default PostAuthRedirect;


