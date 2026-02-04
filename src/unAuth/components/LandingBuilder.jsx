import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { setPostAuthRedirectTarget } from "../../utils/postAuthRedirect";
import { getPublicAssetUrl } from "../../utils/publicAssets";
import { useAuth } from "../../AuthContext";
import BuilderPreview from "./BuilderPreview";
import { useLanguage } from "../language/LanguageProvider";
import { buildApiUrl } from "../../utils/runtimeUrls";
import "./landingBuilder.css";

const DRAFT_KEY = "selmaLandingBuilderDraft";
const CONFIG_KEY = "selmaLandingBuilderConfig";
const SCROLL_KEY = "selmaScrollToLiveBuilder";
const SCROLL_DURATION_MS = 1350;

const easeInOutCubic = (value) =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

const animateScrollTo = (targetY, duration = SCROLL_DURATION_MS) => {
  const startY = window.scrollY || window.pageYOffset;
  const distance = targetY - startY;
  let startTime = null;

  const step = (timestamp) => {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    window.scrollTo(0, startY + distance * eased);
    if (elapsed < duration) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
};

const scrollToElementById = (id, duration = SCROLL_DURATION_MS) => {
  if (typeof window === "undefined") return false;
  const element = document.getElementById(id);
  if (!element) return false;
  const targetY = Math.max(0, element.getBoundingClientRect().top + window.pageYOffset - 16);
  animateScrollTo(targetY, duration);
  return true;
};

const defaultDraft = {
  clinicName: "",
  profession: "",
  services: ["", "", ""],
  city: "",
  tone: "professional/calm",
  practitionerName: "",
  yearsExperience: "",
  targetAudience: "",
  approach: "",
  languages: "",
  practitionerPhotoUrl: getPublicAssetUrl("hero-2/pexels-yankrukov-5793991.jpg"),
  aboutBullets: ["", "", ""],
};

const migrateBuilderConfigImages = (config, labels = {}) => {
  if (!config || typeof config !== "object") {
    return config;
  }

  const profession = `${config?.profession || ""}`.toLowerCase();
  const isPsych = profession.includes("psykolog") || profession.includes("terapi") || profession.includes("coach");
  const isLocalAsset = (url) =>
    typeof url === "string" &&
    (url.startsWith("/hero-2/") || url.includes("public%2Fhero-2%2F"));
  const hasCustomGallery = Array.isArray(config?.gallery?.images)
    ? config.gallery.images.some((img) => img?.url && !isLocalAsset(img.url))
    : false;

  const next = { ...config };

  if (isPsych && (!next?.hero?.imageUrl || isLocalAsset(next.hero.imageUrl)) && !hasCustomGallery) {
    next.hero = {
      ...(next.hero || {}),
      imageUrl: getPublicAssetUrl("hero-2/psych-hero-01.jpg"),
    };
    next.gallery = {
      ...(next.gallery || {}),
      images: [
        {
          url: getPublicAssetUrl("hero-2/psych-gallery-01.jpg"),
          alt: labels.psychGalleryAlt1 || "",
        },
        {
          url: getPublicAssetUrl("hero-2/psych-gallery-02.jpg"),
          alt: labels.psychGalleryAlt2 || "",
        },
        {
          url: getPublicAssetUrl("hero-2/psych-gallery-03.jpg"),
          alt: labels.psychGalleryAlt3 || "",
        },
      ],
    };
  }

  return next;
};

function LandingBuilder({
  postAuthRedirectTo = "/website-builder?restoreBuilder=1#live-builder-demo",
  postSaveTo = "/getting-started/start",
  onSaved,
} = {}) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [draft, setDraft] = useState(defaultDraft);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: "" });
  const [photoUpload, setPhotoUpload] = useState({ uploading: false, error: "" });
  const [restored, setRestored] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const imageLabels = useMemo(
    () => ({
      psychGalleryAlt1: t("features.websiteBuilder.liveBuilder.images.psychGallery1"),
      psychGalleryAlt2: t("features.websiteBuilder.liveBuilder.images.psychGallery2"),
      psychGalleryAlt3: t("features.websiteBuilder.liveBuilder.images.psychGallery3"),
    }),
    [t]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedDraft = window.localStorage.getItem(DRAFT_KEY);
    const storedConfig = window.localStorage.getItem(CONFIG_KEY);
    if (storedDraft) {
      try {
        setDraft((prev) => ({ ...prev, ...JSON.parse(storedDraft) }));
        setRestored(true);
      } catch (_) {}
    }
    if (storedConfig) {
      try {
        const parsed = JSON.parse(storedConfig);
        const migrated = migrateBuilderConfigImages(parsed, imageLabels);
        setConfig(migrated);
        window.localStorage.setItem(CONFIG_KEY, JSON.stringify(migrated));
        setShowForm(false);
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    const restoreFlag = searchParams.get("restoreBuilder");
    if (!restoreFlag || typeof window === "undefined") return;
    window.history.replaceState(null, "", "#live-builder-demo");
    window.requestAnimationFrame(() => scrollToElementById("live-builder-demo"));
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldScroll =
      window.location.hash === "#live-builder-demo" ||
      window.sessionStorage.getItem(SCROLL_KEY) === "1";
    if (!shouldScroll) return;
    window.sessionStorage.removeItem(SCROLL_KEY);
    window.requestAnimationFrame(() => scrollToElementById("live-builder-demo"));
  }, []);

  const isValid = useMemo(() => {
    return (
      draft.clinicName.trim() &&
      draft.profession.trim() &&
      draft.city.trim() &&
      draft.services.some((s) => s.trim())
    );
  }, [draft]);

  const persistDraft = (nextDraft) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
  };

const persistConfig = (nextConfig) => {
  if (typeof window === "undefined") return;
  const fallbackUrl = getPublicAssetUrl("hero-2/pexels-cottonbro-7581072.jpg");
  const sanitizeUrl = (url, fallbackValue = fallbackUrl) =>
    typeof url === "string" && url.startsWith("data:") ? fallbackValue : (url || fallbackValue);
  const sanitizedConfig = nextConfig && typeof nextConfig === "object"
    ? {
        ...nextConfig,
        hero: {
          ...(nextConfig.hero || {}),
          imageUrl: sanitizeUrl(nextConfig?.hero?.imageUrl, fallbackUrl),
        },
        about: {
          ...(nextConfig.about || {}),
          photoUrl: sanitizeUrl(nextConfig?.about?.photoUrl, fallbackUrl),
        },
        gallery: {
          ...(nextConfig.gallery || {}),
          images: Array.isArray(nextConfig?.gallery?.images)
            ? nextConfig.gallery.images.map((img) => ({
                ...img,
                url: sanitizeUrl(img?.url, fallbackUrl),
              }))
            : nextConfig.gallery?.images,
        },
      }
    : nextConfig;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(sanitizedConfig));
};

  const updateField = (key, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      persistDraft(next);
      return next;
    });
  };

  const updateService = (idx, value) => {
    setDraft((prev) => {
      const nextServices = [...prev.services];
      nextServices[idx] = value;
      const next = { ...prev, services: nextServices };
      persistDraft(next);
      return next;
    });
  };

  const updateAboutBullet = (idx, value) => {
    setDraft((prev) => {
      const prevBullets = Array.isArray(prev.aboutBullets) ? prev.aboutBullets : ["", "", ""];
      const nextBullets = [...prevBullets];
      nextBullets[idx] = value;
      const next = { ...prev, aboutBullets: nextBullets };
      persistDraft(next);
      return next;
    });
  };

  const handlePhotoFileSelected = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    setPhotoUpload({ uploading: true, error: "" });
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(buildApiUrl("/api/builder/upload-photo"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        let parsed = {};
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch (_) {}
        if (response.status === 404) {
          throw new Error(t("features.websiteBuilder.liveBuilder.upload.errors.endpointMissing"));
        }
        throw new Error(
          parsed?.error || t("features.websiteBuilder.liveBuilder.upload.errors.failedWithStatus", { status: response.status })
        );
      }

      const data = await response.json();
      if (!data?.url) {
        throw new Error(t("features.websiteBuilder.liveBuilder.upload.errors.missingUrl"));
      }

      updateField("practitionerPhotoUrl", data.url);
    } catch (err) {
      const message = err?.message || t("features.websiteBuilder.liveBuilder.upload.errors.generic");
      const isNetworkError =
        /failed to fetch|networkerror|load failed|fetch/i.test(message);
      setPhotoUpload({
        uploading: false,
        error: isNetworkError
          ? t("features.websiteBuilder.liveBuilder.upload.errors.network")
          : message,
      });
      return;
    } finally {
      setPhotoUpload((prev) => ({ ...prev, uploading: false }));
      if (e?.target) e.target.value = "";
    }
  };

  const handleGenerate = async () => {
    setStatus({ loading: true, error: "" });
    try {
      const response = await fetch(buildApiUrl("/api/builder/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicName: draft.clinicName,
          profession: draft.profession,
          services: draft.services.filter((s) => s.trim()).slice(0, 3),
          city: draft.city,
          tone: draft.tone,
          language,
          practitionerName: draft.practitionerName,
          yearsExperience: draft.yearsExperience,
          targetAudience: draft.targetAudience,
          approach: draft.approach,
          languages: draft.languages,
          practitionerPhotoUrl: draft.practitionerPhotoUrl,
          aboutBullets: (draft.aboutBullets || []).filter((b) => `${b || ""}`.trim()).slice(0, 5),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Server ${response.status}`);
      }

      const data = await response.json();
      setConfig(data.config);
      persistConfig(data.config);
      setShowForm(false);
      setStatus({ loading: false, error: "" });
    } catch (e) {
      setStatus({
        loading: false,
        error: e?.message || t("features.websiteBuilder.liveBuilder.generate.error"),
      });
    }
  };

  const handleSaveRequiresLogin = () => {
    persistDraft(draft);
    if (config) persistConfig(config);

    if (!user) {
      setPostAuthRedirectTarget(postAuthRedirectTo);
      navigate("/signup");
      return;
    }

    if (typeof onSaved === "function") {
      onSaved({ draft, config });
      return;
    }

    navigate(postSaveTo);
  };

  const isExpanded = Boolean(config) || isValid;
  const isComplete = Boolean(config) && !showForm;
  const theme = config?.theme || {};
  const builderStyle = {
    "--builder-accent": theme.accent || "#7a8b6a",
    "--builder-accent-2": "#d19a66",
    "--builder-accent-3": "#2f6f8f",
    "--builder-text": theme.text || "#0f172a",
    "--builder-muted": theme.mutedText || "rgba(15, 23, 42, 0.68)",
  };

  const containerMaxWidth = isComplete
    ? "max-w-[1800px]"
    : isExpanded
      ? "max-w-[1400px]"
      : "max-w-6xl";

  const previewIntro = (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-sm font-semibold text-white">
        {t("features.websiteBuilder.liveBuilder.previewIntro.title")}
      </p>
      <p className="mt-1 text-xs text-white/70">
        {t("features.websiteBuilder.liveBuilder.previewIntro.description")}
      </p>
    </div>
  );

  return (
    <div
      id="live-builder-demo"
      className={`landing-builder-shell mx-auto w-full scroll-mt-24 px-4 py-14 ${containerMaxWidth} transition-[max-width] duration-500 ease-out`}
      style={builderStyle}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--builder-muted)" }}>
            {t("features.websiteBuilder.liveBuilder.eyebrow")}
          </div>
          <h2 className="landing-builder-title mt-2 text-3xl font-semibold md:text-4xl">
            {t("features.websiteBuilder.liveBuilder.titlePrefix")}{" "}
            <span className="landing-builder-animated">
              {t("features.websiteBuilder.liveBuilder.titleHighlight")}
            </span>{" "}
            {t("features.websiteBuilder.liveBuilder.titleSuffix")}
          </h2>
          <p className="landing-builder-subtitle mt-2 max-w-2xl text-sm md:text-base">
            <span className="landing-builder-animated">
              {t("features.websiteBuilder.liveBuilder.steps.questions")}
            </span>{" "}
            →{" "}
            <span className="landing-builder-animated">
              {t("features.websiteBuilder.liveBuilder.steps.preview")}
            </span>{" "}
            {t("features.websiteBuilder.liveBuilder.steps.previewSuffix")} →{" "}
            <span className="landing-builder-animated">
              {t("features.websiteBuilder.liveBuilder.steps.save")}
            </span>{" "}
            {t("features.websiteBuilder.liveBuilder.steps.saveSuffix")}
          </p>
          <div className="mt-4 max-w-2xl rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
            <p className="text-white">
              {t("features.websiteBuilder.liveBuilder.note.primary")}
            </p>
            <p className="mt-2 text-white/70">
              {t("features.websiteBuilder.liveBuilder.note.secondary")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {restored ? (
            <Badge variant="secondary">{t("features.websiteBuilder.liveBuilder.badges.restored")}</Badge>
          ) : null}
          <Badge variant="secondary">{t("features.websiteBuilder.liveBuilder.badges.loginRequired")}</Badge>
          {isComplete ? (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              {t("features.websiteBuilder.liveBuilder.actions.edit")}
            </Button>
          ) : null}
        </div>
      </div>

      {isComplete ? (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap gap-3">
            <Button onClick={handleSaveRequiresLogin}>
              {t("features.websiteBuilder.liveBuilder.actions.savePublish")}
            </Button>
            <Button variant="secondary" onClick={handleGenerate}>
              {t("features.websiteBuilder.liveBuilder.actions.generateAgain")}
            </Button>
          </div>
          {previewIntro}
          <div className={`landing-builder-fade-in transition-all duration-500 ease-out`}>
            <BuilderPreview config={config} />
          </div>
        </div>
      ) : (
        <div className={`mt-8 grid gap-6 ${isExpanded ? "lg:grid-cols-12" : "lg:grid-cols-5"} transition-all duration-500 ease-out`}>
          {showForm ? (
            <div className={`rounded-2xl border border-white/10 bg-black/20 p-6 text-white ${isExpanded ? "lg:col-span-4" : "lg:col-span-2"} transition-all duration-500 ease-out`}>
              <div className="grid gap-4">
                <div>
                  <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.clinicName")}</Label>
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                    value={draft.clinicName}
                    onChange={(e) => updateField("clinicName", e.target.value)}
                    placeholder={t("features.websiteBuilder.liveBuilder.form.clinicNamePlaceholder")}
                  />
                </div>
                <div>
                  <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.profession")}</Label>
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                    value={draft.profession}
                    onChange={(e) => updateField("profession", e.target.value)}
                    placeholder={t("features.websiteBuilder.liveBuilder.form.professionPlaceholder")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.practitionerName")}</Label>
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                      value={draft.practitionerName}
                      onChange={(e) => updateField("practitionerName", e.target.value)}
                      placeholder={t("features.websiteBuilder.liveBuilder.form.practitionerNamePlaceholder")}
                    />
                  </div>
                  <div>
                    <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.yearsExperience")}</Label>
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                      value={draft.yearsExperience}
                      onChange={(e) => updateField("yearsExperience", e.target.value)}
                      placeholder={t("features.websiteBuilder.liveBuilder.form.yearsExperiencePlaceholder")}
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.targetAudience")}</Label>
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                    value={draft.targetAudience}
                    onChange={(e) => updateField("targetAudience", e.target.value)}
                    placeholder={t("features.websiteBuilder.liveBuilder.form.targetAudiencePlaceholder")}
                  />
                </div>
                <div>
                  <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.approach")}</Label>
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                    value={draft.approach}
                    onChange={(e) => updateField("approach", e.target.value)}
                    placeholder={t("features.websiteBuilder.liveBuilder.form.approachPlaceholder")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx}>
                      <Label className="text-white">
                        {t("features.websiteBuilder.liveBuilder.form.serviceLabel", { index: idx + 1 })}
                      </Label>
                      <input
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                        value={draft.services[idx]}
                        onChange={(e) => updateService(idx, e.target.value)}
                        placeholder={
                          idx === 0
                            ? t("features.websiteBuilder.liveBuilder.form.servicePlaceholderPrimary")
                            : t("features.websiteBuilder.liveBuilder.form.servicePlaceholderSecondary")
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[0, 1, 2].map((idx) => (
                    <div key={`about-${idx}`}>
                      <Label className="text-white">
                        {t("features.websiteBuilder.liveBuilder.form.aboutBulletLabel", { index: idx + 1 })}
                      </Label>
                      <input
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                        value={(draft.aboutBullets || [])[idx] || ""}
                        onChange={(e) => updateAboutBullet(idx, e.target.value)}
                        placeholder={
                          idx === 0
                            ? t("features.websiteBuilder.liveBuilder.form.aboutBulletPlaceholderPrimary")
                            : t("features.websiteBuilder.liveBuilder.form.aboutBulletPlaceholderSecondary")
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.city")}</Label>
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                      value={draft.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder={t("features.websiteBuilder.liveBuilder.form.cityPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.tone")}</Label>
                    <select
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                      value={draft.tone}
                      onChange={(e) => updateField("tone", e.target.value)}
                    >
                      <option value="professional/calm">
                        {t("features.websiteBuilder.liveBuilder.form.toneOptions.professionalCalm")}
                      </option>
                      <option value="warm/empathetic">
                        {t("features.websiteBuilder.liveBuilder.form.toneOptions.warmEmpathetic")}
                      </option>
                      <option value="energetic/motivating">
                        {t("features.websiteBuilder.liveBuilder.form.toneOptions.energeticMotivating")}
                      </option>
                      <option value="expert/clinical">
                        {t("features.websiteBuilder.liveBuilder.form.toneOptions.expertClinical")}
                      </option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.languages")}</Label>
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                      value={draft.languages}
                      onChange={(e) => updateField("languages", e.target.value)}
                      placeholder={t("features.websiteBuilder.liveBuilder.form.languagesPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label className="text-white">{t("features.websiteBuilder.liveBuilder.form.aboutPhoto")}</Label>
                    <div className="mt-2 grid gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoFileSelected}
                        className="block w-full cursor-pointer rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20"
                        disabled={photoUpload.uploading}
                      />
                      {draft.practitionerPhotoUrl ? (
                        <img
                          src={draft.practitionerPhotoUrl}
                          alt={t("features.websiteBuilder.liveBuilder.form.photoAlt")}
                          className="h-28 w-full rounded-lg border border-white/10 bg-black/20 object-contain"
                          loading="lazy"
                        />
                      ) : null}
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                        value={draft.practitionerPhotoUrl}
                        onChange={(e) => updateField("practitionerPhotoUrl", e.target.value)}
                        placeholder={t("features.websiteBuilder.liveBuilder.form.photoUrlPlaceholder")}
                      />
                      {photoUpload.uploading ? (
                        <div className="text-xs text-white/70">
                          {t("features.websiteBuilder.liveBuilder.form.photoUploading")}
                        </div>
                      ) : null}
                      {photoUpload.error ? (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-100">
                          {photoUpload.error}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                {status.error ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                    {status.error}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleGenerate}
                    disabled={status.loading || !isValid}
                  >
                    {status.loading
                      ? t("features.websiteBuilder.liveBuilder.actions.generating")
                      : t("features.websiteBuilder.liveBuilder.actions.generate")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSaveRequiresLogin}
                    disabled={!config}
                  >
                    {t("features.websiteBuilder.liveBuilder.actions.savePublish")}
                  </Button>
                </div>
                <div className="text-xs text-white/60">
                  {t("features.websiteBuilder.liveBuilder.footerNote")}
                </div>
              </div>
            </div>
          ) : null}

          <div className={`${isExpanded ? (showForm ? "lg:col-span-8" : "lg:col-span-12") : "lg:col-span-3"} ${config ? "landing-builder-fade-in" : ""} transition-all duration-500 ease-out`}>
            {previewIntro}
            <BuilderPreview config={config} />
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingBuilder;
