import { useCallback, useEffect, useState } from "react";
import { getIdToken } from "../utils/auth";
import { buildApiUrl } from "../utils/runtimeUrls";

const DEFAULT_STATE = {
  isOwner: false,
  accountId: null,
  hasConnectAccount: false,
  connect: null,
};

const getErrorMessage = (error) => {
  if (!error) return "Ukendt fejl";
  if (typeof error === "string") return error;
  return error?.message || "Ukendt fejl";
};

const authorizedRequest = async (url, options = {}) => {
  const token = await getIdToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(buildApiUrl(url), {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
};

const useStripeConnectStatus = ({ enabled = true } = {}) => {
  const [status, setStatus] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  const refreshStatus = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setError("");
      setStatus(DEFAULT_STATE);
      return null;
    }

    setLoading(true);
    setError("");
    try {
      const data = await authorizedRequest("/api/stripe/connect/status", {
        method: "GET",
      });
      setStatus({
        isOwner: Boolean(data?.isOwner),
        accountId: data?.accountId || null,
        hasConnectAccount: Boolean(data?.hasConnectAccount),
        connect: data?.connect || null,
      });
      return data;
    } catch (requestError) {
      setStatus(DEFAULT_STATE);
      setError(getErrorMessage(requestError));
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const createOnboardingLink = useCallback(
    async (payload = {}) => {
      setActionLoading("onboarding");
      setError("");
      try {
        const data = await authorizedRequest("/api/stripe/connect/create-onboarding-link", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (data?.url) {
          window.location.assign(data.url);
        } else {
          throw new Error("Mangler onboarding-link fra serveren.");
        }
        return data;
      } catch (requestError) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setActionLoading("");
      }
    },
    []
  );

  const createDashboardLink = useCallback(async () => {
    setActionLoading("dashboard");
    setError("");
    try {
      const data = await authorizedRequest("/api/stripe/connect/create-dashboard-link", {
        method: "POST",
      });
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        throw new Error("Mangler dashboard-link fra serveren.");
      }
      return data;
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setActionLoading("");
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!enabled) return undefined;
    const handleFocus = () => {
      refreshStatus();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [enabled, refreshStatus]);

  return {
    status,
    loading,
    error,
    actionLoading,
    refreshStatus,
    createOnboardingLink,
    createDashboardLink,
  };
};

export default useStripeConnectStatus;
