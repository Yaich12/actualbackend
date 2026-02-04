import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../../components/ui/button";
import ClinicHeroTemplate from "./ClinicHeroTemplate";
import { useLanguage } from "../language/LanguageProvider";
import { getPublicAssetUrl } from "../../utils/publicAssets";
import { buildApiUrl } from "../../utils/runtimeUrls";

const PreviewImage = ({ src, alt, className, fallbackSrc }) => {
  const handleError = (e) => {
    if (!fallbackSrc) return;
    const img = e.currentTarget;
    if (img?.dataset?.didFallback === "1") return;
    img.dataset.didFallback = "1";
    img.src = fallbackSrc;
  };

  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={src} alt={alt} className={className} onError={handleError} data-did-fallback="0" />;
};

const DraftNotice = ({ title, description, note }) => (
  <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-slate-700">
    <p className="font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-sm text-slate-600">{description}</p>
    <p className="mt-2 text-xs text-slate-500">{note}</p>
  </div>
);

const TypingIndicator = () => (
  <div className="flex items-center gap-1">
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
  </div>
);

const ChatbotPanel = ({ clinicContext, labels }) => {
  const clinicName = `${clinicContext?.clinicName || ""}`.trim();
  const profession = `${clinicContext?.profession || ""}`.trim();
  const servicesKey = Array.isArray(clinicContext?.services)
    ? clinicContext.services.filter(Boolean).join("|")
    : "";
  const welcomeMessage = labels?.welcomeMessage || "";
  const [messages, setMessages] = useState([
    { id: "welcome", role: "assistant", text: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    setMessages([{ id: `welcome-${Date.now()}`, role: "assistant", text: welcomeMessage }]);
    setInput("");
    setError("");
  }, [welcomeMessage, profession, servicesKey]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const userMessage = { id: `user-${Date.now()}`, role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl("/api/builder/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          clinicContext,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const replyText = `${data?.reply || ""}`.trim();
      if (!replyText) {
        throw new Error("empty-response");
      }

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", text: replyText },
      ]);
    } catch (err) {
      setError(labels?.errorFallback || "");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute bottom-6 right-6 w-[280px] max-w-[90vw] rounded-3xl border border-black/10 bg-white/95 p-4 shadow-xl">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
          {labels?.brandShort || ""}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {labels?.headerLabel}
          </p>
          <p className="text-sm font-semibold text-slate-900">{labels?.headerTitle}</p>
        </div>
      </div>

      <div
        ref={listRef}
        className="mt-3 max-h-44 space-y-3 overflow-y-auto pr-1 text-xs"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className={`rounded-2xl px-3 py-2 ${isUser ? "bg-slate-100 text-slate-700" : "bg-slate-900 text-slate-50"}`}
              >
                <p className={`text-[10px] font-semibold ${isUser ? "text-slate-400" : "text-blue-200"}`}>
                  {isUser ? labels?.roles?.user : labels?.roles?.assistant}
                </p>
                <p>{message.text}</p>
              </motion.div>
            );
          })}
          {isLoading ? (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-slate-500"
            >
              <TypingIndicator />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {error ? (
        <div className="mt-2 text-[11px] text-rose-500">
          {error}
        </div>
      ) : null}

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={labels?.inputPlaceholder}
          className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 outline-none focus:border-slate-300"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {labels?.send}
        </button>
      </form>
    </div>
  );
};

function BuilderPreview({ config }) {
  const { t, getArray } = useLanguage();
  const draftNoticeLabels = useMemo(
    () => ({
      title: t("features.websiteBuilder.preview.draft.title"),
      description: t("features.websiteBuilder.preview.draft.description"),
      note: t("features.websiteBuilder.preview.draft.note"),
    }),
    [t]
  );
  const chatLabels = useMemo(
    () => ({
      headerLabel: t("features.websiteBuilder.preview.chat.headerLabel"),
      headerTitle: t("features.websiteBuilder.preview.chat.headerTitle"),
      brandShort: t("common.brandShort"),
      welcomeMessage: t("features.websiteBuilder.preview.chat.welcome", {
        clinicName: t("features.websiteBuilder.preview.chat.clinicFallback"),
      }),
      roles: {
        user: t("features.websiteBuilder.preview.chat.roles.user"),
        assistant: t("features.websiteBuilder.preview.chat.roles.assistant"),
      },
      inputPlaceholder: t("features.websiteBuilder.preview.chat.inputPlaceholder"),
      send: t("features.websiteBuilder.preview.chat.send"),
      errorFallback: t("features.websiteBuilder.preview.chat.errorFallback"),
    }),
    [t]
  );
  const navFallback = getArray("features.websiteBuilder.preview.navLinks", []);
  const heroStatsFallback = getArray("features.websiteBuilder.preview.heroStats", []);
  const placeholder = t("common.placeholder");

  if (!config) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-white/80">
        <div className="text-sm">{t("features.websiteBuilder.preview.empty.title")}</div>
        <div className="mt-2 text-lg font-semibold text-white">
          {t("features.websiteBuilder.preview.empty.heading")}
        </div>
        <div className="mt-1 text-sm text-white/70">
          {t("features.websiteBuilder.preview.empty.description")}
        </div>
      </div>
    );
  }

  const services = Array.isArray(config.services) ? config.services : [];
  const trustBullets = Array.isArray(config?.trust?.bullets) ? config.trust.bullets : [];
  const theme = config?.theme || {};
  const navLinks = Array.isArray(config?.nav?.links) ? config.nav.links : navFallback;
  const heroImageUrl =
    config?.hero?.imageUrl || getPublicAssetUrl("hero-2/pexels-cottonbro-7581072.jpg");
  const heroAlt = config?.hero?.imageAlt || t("features.websiteBuilder.preview.hero.imageAlt");
  const primaryCta = config?.hero?.ctaPrimary || config?.hero?.ctaText || t("features.websiteBuilder.preview.hero.ctaPrimary");
  const secondaryCta = config?.hero?.ctaSecondary || t("features.websiteBuilder.preview.hero.ctaSecondary");
  const about = config?.about || {};
  const credentials = Array.isArray(about.credentials) ? about.credentials : [];
  const aboutBullets = Array.isArray(about.bullets) ? about.bullets : [];
  const gallery = config?.gallery || {};
  const galleryImages = Array.isArray(gallery.images) ? gallery.images : [];
  const safeFallbackHero = getPublicAssetUrl("hero-2/pexels-cottonbro-7581072.jpg");
  const secondaryHeroImageUrl =
    galleryImages[0]?.url || about.photoUrl || heroImageUrl || safeFallbackHero;
  const heroStats =
    Array.isArray(config?.hero?.stats) && config.hero.stats.length
      ? config.hero.stats
      : heroStatsFallback;
  const clinicContext = {
    clinicName: config?.clinicName || "",
    profession: config?.profession || "",
    city: config?.city || "",
    tone: config?.tone || "",
    services: services.map((service) => service?.title).filter(Boolean),
  };

  return (
    <div
      className="relative rounded-3xl border border-black/10 p-6 md:p-8"
      style={{ background: theme.background || "#f7f3ec", color: theme.text || "#1f1f1f" }}
    >
      <div className="w-full">
        {/* Top nav */}
        <div className="flex items-center justify-between gap-6">
          <div
            className="text-lg font-medium"
            style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" }}
          >
            {config.clinicName}
          </div>
          <nav className="hidden items-center gap-8 text-sm md:flex" style={{ color: theme.mutedText || "#5b5b5b" }}>
            {navLinks.slice(0, 3).map((l, idx) => (
              <a key={`${l}-${idx}`} href="#live-builder-demo" className="hover:opacity-80">
                {l}
              </a>
            ))}
          </nav>
          <a
            href="#booking-flow"
            className="rounded-full px-5 py-2 text-sm font-medium shadow-sm"
            style={{ background: theme.accent || "#7a8b6a", color: theme.accentText || "#ffffff" }}
          >
            {primaryCta}
          </a>
        </div>
        {config?.template?.name ? (
          <div className="mt-3 text-[11px] uppercase tracking-[0.25em]" style={{ color: theme.mutedText || "#5b5b5b" }}>
            {t("features.websiteBuilder.preview.templateLabel")}: {config.template.name}
          </div>
        ) : null}
        <DraftNotice
          title={draftNoticeLabels.title}
          description={draftNoticeLabels.description}
          note={draftNoticeLabels.note}
        />
        <div className="mt-6">
          <ClinicHeroTemplate
            headline={config?.hero?.headline || config.clinicName}
            supportingText={config?.hero?.subheadline || about.bio || ""}
            primaryButtonText={primaryCta}
            secondaryButtonText={secondaryCta}
            imageUrl={heroImageUrl}
            secondaryImageUrl={secondaryHeroImageUrl}
            imageAlt={heroAlt}
            secondaryImageAlt={galleryImages[0]?.alt || t("features.websiteBuilder.preview.hero.secondaryImageAlt")}
            badgeText={config?.hero?.badgeText || t("features.websiteBuilder.preview.hero.badge")}
            primaryHref="#booking-flow"
            secondaryHref="#live-builder-demo"
            stats={heroStats}
          />
        </div>

        {/* About */}
        <div className="mt-12 grid gap-8 md:grid-cols-[320px,1fr]">
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-[0.25em]" style={{ color: theme.accent || "#7a8b6a" }}>
              {(about.eyebrow || t("features.websiteBuilder.preview.about.eyebrow")).toString()}
            </div>
            {about?.photoUrl ? (
              <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/70 p-2 shadow-sm">
                <PreviewImage
                  src={about.photoUrl}
                  fallbackSrc={getPublicAssetUrl("hero-2/pexels-yankrukov-5793991.jpg")}
                  alt={
                    about?.name
                      ? t("features.websiteBuilder.preview.about.photoAltNamed", { name: about.name })
                      : t("features.websiteBuilder.preview.about.photoAlt")
                  }
                  className="h-72 w-full rounded-[22px] object-contain md:h-80"
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-4">
            <div
              className="text-4xl md:text-5xl"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" }}
            >
              {(about.name || config.clinicName).toString()}
            </div>
            <div className="text-lg" style={{ color: theme.mutedText || "#5b5b5b" }}>
              {(about.titleLine || config.profession).toString()}
            </div>
            {about.bio ? (
              <p className="max-w-3xl text-base leading-relaxed" style={{ color: theme.mutedText || "#5b5b5b" }}>
                {about.bio}
              </p>
            ) : null}

            {aboutBullets.length ? (
              <div className="pt-1">
                <div className="text-sm font-semibold">
                  {about.bulletsTitle || t("features.websiteBuilder.preview.about.bulletsTitle")}
                </div>
                <ul className="mt-3 grid gap-2 text-sm" style={{ color: theme.mutedText || "#5b5b5b" }}>
                  {aboutBullets.slice(0, 5).map((b, idx) => (
                    <li key={`${b}-${idx}`} className="flex items-start gap-2">
                      <span className="mt-[7px] inline-block h-2 w-2 rounded-full" style={{ background: theme.accent || "#7a8b6a" }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {credentials.length ? (
              <div className="pt-2">
                <div className="text-sm font-semibold">
                  {about.credentialsTitle || t("features.websiteBuilder.preview.about.credentialsTitle")}
                </div>
                <ul className="mt-3 grid gap-2 text-sm" style={{ color: theme.mutedText || "#5b5b5b" }}>
                  {credentials.slice(0, 5).map((c, idx) => (
                    <li key={`${c}-${idx}`} className="flex items-start gap-2">
                      <span className="mt-[7px] inline-block h-2 w-2 rounded-full" style={{ background: theme.accent || "#7a8b6a" }} />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* Gallery */}
        {galleryImages.length ? (
          <div className="mt-12">
            <div className="text-sm font-semibold">
              {gallery.heading || t("features.websiteBuilder.preview.gallery.title")}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {galleryImages.slice(0, 3).map((img, idx) => (
                <figure key={`${img?.url || "img"}-${idx}`} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                  <PreviewImage
                    src={img.url}
                    fallbackSrc={safeFallbackHero}
                    alt={img.alt || t("features.websiteBuilder.preview.gallery.imageAlt")}
                    className="h-56 w-full bg-black/5 object-contain md:h-72"
                  />
                </figure>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Sections (compact preview) */}
      <div className="mt-12 grid w-full gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-black/10 bg-white/70 p-6">
          <div className="text-sm font-semibold">{t("features.websiteBuilder.preview.sections.services")}</div>
          <div className="mt-4 grid gap-3">
            {services.slice(0, 3).map((s, idx) => (
              <div key={`${s?.title || "service"}-${idx}`} className="rounded-xl border border-black/10 bg-white p-4">
                <div className="font-medium">
                  {s?.title || t("features.websiteBuilder.preview.sections.serviceFallback")}
                </div>
                {s?.description ? (
                  <div className="mt-1 text-sm" style={{ color: theme.mutedText || "#5b5b5b" }}>
                    {s.description}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white/70 p-6">
          <div className="text-sm font-semibold">{t("features.websiteBuilder.preview.sections.trust")}</div>
          <ul className="mt-4 grid gap-3 text-sm" style={{ color: theme.mutedText || "#5b5b5b" }}>
            {trustBullets.slice(0, 3).map((b, idx) => (
              <li key={`${b}-${idx}`} className="rounded-xl border border-black/10 bg-white p-4">
                {b}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid w-full gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-black/10 bg-white/70 p-6">
          <div className="text-sm font-semibold">{t("features.websiteBuilder.preview.sections.contact")}</div>
          <div className="mt-4 grid gap-2 text-sm" style={{ color: theme.mutedText || "#5b5b5b" }}>
            <div>
              <span className="opacity-70">
                {t("features.websiteBuilder.preview.sections.contactAddress")}:
              </span>{" "}
              {config?.contact?.address || placeholder}
            </div>
            <div>
              <span className="opacity-70">
                {t("features.websiteBuilder.preview.sections.contactPhone")}:
              </span>{" "}
              {config?.contact?.phone || placeholder}
            </div>
            <div>
              <span className="opacity-70">
                {t("features.websiteBuilder.preview.sections.contactEmail")}:
              </span>{" "}
              {config?.contact?.email || placeholder}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white/70 p-6">
          <div className="text-sm font-semibold">{t("features.websiteBuilder.preview.sections.booking")}</div>
          <div className="mt-3 text-sm" style={{ color: theme.mutedText || "#5b5b5b" }}>
            {config?.booking?.note || ""}
          </div>
          <div className="mt-5">
            <Button asChild>
              <a href="#booking-flow">{config?.booking?.ctaText || primaryCta}</a>
            </Button>
          </div>
        </section>
      </div>
      <ChatbotPanel
        clinicContext={clinicContext}
        labels={{
          ...chatLabels,
          welcomeMessage: t("features.websiteBuilder.preview.chat.welcome", {
            clinicName:
              clinicContext?.clinicName ||
              t("features.websiteBuilder.preview.chat.clinicFallback"),
          }),
        }}
      />
    </div>
  );
}

export default BuilderPreview;
