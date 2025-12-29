import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import LandingBuilder from "../../unAuth/components/LandingBuilder";

function DigitalFrontPage() {
  const navigate = useNavigate();

  const handleSaved = useCallback(() => {
    try {
      window.localStorage.setItem("selmaDigitalFrontComplete", "1");
    } catch (_) {}
    navigate("/getting-started");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6">
        <Button variant="secondary" onClick={() => navigate("/getting-started")}>
          ← Tilbage
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Trin 2</Badge>
          <span className="text-sm text-white/80">Byg din digitale front</span>
        </div>
      </div>

      <LandingBuilder
        postAuthRedirectTo="/getting-started/digital-front?restoreBuilder=1#live-builder-demo"
        postSaveTo="/getting-started"
        onSaved={handleSaved}
      />
    </div>
  );
}

export default DigitalFrontPage;
