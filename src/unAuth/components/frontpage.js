import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../language/LanguageProvider";
import { getPublicAssetUrl } from "../../utils/publicAssets";
import "./frontpage.css";

const DESKTOP_CLIPS = [
  getPublicAssetUrl("hero/4489829-uhd_3840_2160_25fps.mp4"),
  getPublicAssetUrl("hero/5793441-uhd_3840_2160_25fps.mp4"),
  getPublicAssetUrl("hero/5793444-uhd_3840_2160_25fps.mp4"),
  getPublicAssetUrl("hero/6111110-uhd_3840_2160_25fps.mp4"),
];
const MOBILE_CLIPS = [...DESKTOP_CLIPS];

const HERO_VIDEO_EVENT = "landing-hero-video-change";

const syncHeroVideo = (src, time) => {
  if (typeof window === "undefined") return;
  const safeTime = typeof time === "number" && !Number.isNaN(time) ? time : undefined;
  const payload = { src, time: safeTime };
  const last = window.__landingHeroVideo;
  if (
    last?.src === payload.src &&
    typeof payload.time === "number" &&
    typeof last.time === "number" &&
    Math.abs(last.time - payload.time) < 0.02
  ) {
    return;
  }
  window.__landingHeroVideo = payload;
  window.dispatchEvent(new CustomEvent(HERO_VIDEO_EVENT, { detail: payload }));
};

const isLowMotionOrSlowConnection = () => {
  if (typeof window === "undefined") return false;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = `${connection?.effectiveType || ""}`;
  const slowNetwork = effectiveType.includes("2g");
  return Boolean(reducedMotion || saveData || slowNetwork);
};

function Frontpage() {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [playlist, setPlaylist] = useState(DESKTOP_CLIPS);
  const activeRef = useRef(null);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLowMotionOrSlowConnection()) {
      setVideoEnabled(false);
      return;
    }
    const isMobile = window.matchMedia?.("(max-width: 768px)")?.matches;
    setPlaylist(isMobile ? MOBILE_CLIPS : DESKTOP_CLIPS);
  }, []);

  useEffect(() => {
    setActive(0);
  }, [playlist]);

  const activeClip = useMemo(
    () => playlist[active] ?? DESKTOP_CLIPS[0],
    [playlist, active]
  );

  useEffect(() => {
    if (!videoEnabled) return;
    const video = activeRef.current;
    if (!video) return;
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
    syncHeroVideo(activeClip, 0);
  }, [activeClip, videoEnabled]);

  const handleTimeUpdate = () => {
    const video = activeRef.current;
    if (!video) return;
    const now = window.performance?.now?.() ?? Date.now();
    if (now - lastSyncAtRef.current < 250) return;
    lastSyncAtRef.current = now;
    syncHeroVideo(activeClip, video.currentTime);
  };

  const handleEnded = () => {
    if (playlist.length <= 1) return;
    setActive((current) => (current + 1) % playlist.length);
  };

  return (
    <section className="frontpage">
      <div className="frontpage-video-bg" aria-hidden="true">
        {videoEnabled ? (
          <video
            ref={activeRef}
            className="frontpage-video fade-in"
            src={activeClip}
            autoPlay
            muted
            playsInline
            preload="metadata"
            loop={playlist.length === 1}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
        ) : (
          <div className="frontpage-video-fallback" />
        )}

        <div className="frontpage-video-overlay" />
      </div>

      <div className="frontpage-grid">
        <div className="frontpage-container">
          <h1 className="frontpage-title">
            <span className="frontpage-title-line">{t("landing.frontpage.titleLine1")}</span>
            <span className="frontpage-title-line">
              {t("landing.frontpage.titleLine2")}
              <span className="frontpage-dot">.</span>
            </span>
          </h1>

          <p className="frontpage-subtitle">
            {t("landing.frontpage.subtitle")}
          </p>

          <div className="frontpage-buttons">
            <Link to="/signup" className="frontpage-button primary">
              {t("landing.frontpage.ctaPrimary")}
            </Link>
            <Link to="/selma-copilot" className="frontpage-button secondary">
              {t("landing.frontpage.ctaSecondary")}
            </Link>
          </div>
        </div>
      </div>
      <div id="demo" className="frontpage-anchor" aria-hidden="true" />
    </section>
  );
}

export default Frontpage;
