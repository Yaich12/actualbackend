import { useEffect, useRef, type ReactNode } from "react";
import { Book, Menu } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Button } from "../ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { cn } from "../../lib/utils";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: ReactNode;
  items?: MenuItem[];
  itemsHeader?: string;
  itemsNote?: string;
  itemsColumns?: number;
  dualList?: {
    left: {
      header?: string;
      note?: string;
      items: MenuItem[];
    };
    right: {
      header?: string;
      note?: string;
      items: MenuItem[];
    };
  };
  featured?: {
    title: string;
    description?: string;
    url?: string;
    image: string;
    alt?: string;
    items?: string[];
    syncWithHeroVideo?: boolean;
  };
}

const HERO_VIDEO_EVENT = "landing-hero-video-change";

type HeroVideoEventDetail = {
  src?: string;
  time?: number;
};

const HeroVideoPreview = ({
  fallbackImage,
  alt,
  className,
}: {
  fallbackImage: string;
  alt: string;
  className?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const video = videoRef.current;
    if (!video) return;

    const syncTime = (time?: number) => {
      if (typeof time !== "number" || Number.isNaN(time)) return;
      pendingTimeRef.current = time;
      if (video.readyState < 1) return;
      const drift = Math.abs(video.currentTime - time);
      if (drift < 0.02) {
        pendingTimeRef.current = null;
        return;
      }
      try {
        video.currentTime = time;
      } catch (_) {}
      pendingTimeRef.current = null;
    };

    const applySync = (detail?: HeroVideoEventDetail) => {
      if (!detail) return;
      const { src, time } = detail;
      if (src && video.dataset.src !== src) {
        video.dataset.src = src;
        video.src = src;
        video.load();
      }
      syncTime(time);
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    const handleLoadedMetadata = () => {
      syncTime(pendingTimeRef.current ?? undefined);
    };

    const initial = (window as typeof window & {
      __landingHeroVideo?: HeroVideoEventDetail;
    }).__landingHeroVideo;
    applySync(initial);

    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<HeroVideoEventDetail>).detail;
      applySync(detail);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    window.addEventListener(HERO_VIDEO_EVENT, handleChange);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      window.removeEventListener(HERO_VIDEO_EVENT, handleChange);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={fallbackImage}
      muted
      playsInline
      autoPlay
      preload="metadata"
      aria-label={alt}
    />
  );
};

interface Navbar1Props {
  logo?: {
    url: string;
    src: string;
    alt: string;
    title: string;
    tagline?: string;
  };
  menu?: MenuItem[];
  mobileExtraLinks?: {
    name: string;
    url: string;
  }[];
  auth?: {
    login?: {
      text: string;
      url: string;
    };
    signup?: {
      text: string;
      url: string;
    };
    loginNode?: ReactNode;
  };
  className?: string;
  containerClassName?: string;
}

const Navbar1 = ({
  logo = {
    url: "/",
    src: "",
    alt: "logo",
    title: "Selma+",
    tagline: "Much more than just a booking system.",
  },
  menu = [
    { title: "Home", url: "#" },
    {
      title: "Products",
      url: "#",
      items: [
        {
          title: "Blog",
          description: "The latest industry news, updates, and info",
          icon: <Book className="size-5 shrink-0" />,
          url: "#",
        },
      ],
    },
  ],
  mobileExtraLinks = [],
  auth = {
    login: { text: "Log in", url: "#" },
    signup: { text: "Sign up", url: "#" },
  },
  className,
  containerClassName,
}: Navbar1Props) => {
  const renderLoginControl = (className?: string) => {
    if (auth.loginNode) {
      return className ? <div className={className}>{auth.loginNode}</div> : auth.loginNode;
    }
    if (!auth.login) {
      return null;
    }
    return (
      <Button asChild variant="outline" size="sm" className={cn("navbar-cta-outline", className)}>
        {auth.login.url.startsWith("/") ? (
          <RouterLink to={auth.login.url}>{auth.login.text}</RouterLink>
        ) : (
          <a href={auth.login.url}>{auth.login.text}</a>
        )}
      </Button>
    );
  };

  const renderSignupControl = (className?: string) => {
    if (!auth.signup) {
      return null;
    }
    return (
      <Button asChild size="sm" className={cn("navbar-cta-btn", className)}>
        {auth.signup.url.startsWith("/") ? (
          <RouterLink to={auth.signup.url}>{auth.signup.text}</RouterLink>
        ) : (
          <a href={auth.signup.url}>{auth.signup.text}</a>
        )}
      </Button>
    );
  };

  return (
    <section className={cn("py-0 w-full", className)}>
      <div className={cn("w-full", containerClassName)}>
        <nav className="hidden justify-between lg:flex w-full">
          <div className="flex items-center gap-6">
            <a href={logo.url} className="flex items-center gap-3">
              {logo.src ? <img src={logo.src} className="w-8" alt={logo.alt} /> : null}
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-semibold text-white">{logo.title}</span>
                {logo.tagline && (
                  <span className="text-xs font-medium text-white/80 whitespace-nowrap">
                    {logo.tagline}
                  </span>
                )}
              </div>
            </a>
            <div className="flex items-center">
              <NavigationMenu>
                <NavigationMenuList>
                  {menu.map((item) => renderMenuItem(item))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
          <div className="flex gap-2">
            {renderSignupControl()}
            {renderLoginControl()}
          </div>
        </nav>
        <div className="block lg:hidden w-full">
          <div className="flex items-center justify-between w-full">
            <a href={logo.url} className="flex items-center gap-3">
              {logo.src ? <img src={logo.src} className="w-8" alt={logo.alt} /> : null}
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-semibold text-white">{logo.title}</span>
                {logo.tagline && (
                  <span className="text-xs font-medium text-white/80 whitespace-nowrap">
                    {logo.tagline}
                  </span>
                )}
              </div>
            </a>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>
                    <a href={logo.url} className="flex items-center gap-2">
                      {logo.src ? <img src={logo.src} className="w-8" alt={logo.alt} /> : null}
                      <span className="text-lg font-semibold">
                        {logo.title}
                      </span>
                    </a>
                  </SheetTitle>
                </SheetHeader>
                <div className="my-6 flex flex-col gap-6">
                  <Accordion
                    type="single"
                    collapsible
                    className="flex w-full flex-col gap-4"
                  >
                    {menu.map((item) => renderMobileMenuItem(item))}
                  </Accordion>
                  {mobileExtraLinks.length > 0 && (
                    <div className="border-t py-4">
                      <div className="grid grid-cols-2 justify-start">
                        {mobileExtraLinks.map((link, idx) => (
                          <a
                            key={idx}
                            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-accent-foreground"
                            href={link.url}
                          >
                            {link.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    {renderSignupControl("w-full justify-center")}
                    {renderLoginControl("w-full flex justify-center")}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </section>
  );
};

const renderMenuItem = (item: MenuItem) => {
  if (item.dualList) {
    const { left, right } = item.dualList;
    const renderListItems = (items: MenuItem[]) =>
      items.map((subItem) => {
        const isRich = Boolean(subItem.icon || subItem.description);
        if (!isRich) {
          return (
            <li key={subItem.title}>
              <NavigationMenuLink asChild>
                <a
                  className="block rounded-2xl px-2 py-2 text-base font-semibold text-slate-900 transition hover:bg-slate-50"
                  href={subItem.url}
                >
                  {subItem.title}
                </a>
              </NavigationMenuLink>
            </li>
          );
        }
        return (
          <li key={subItem.title}>
            <NavigationMenuLink asChild>
              <a
                className="group flex items-start gap-4 rounded-2xl p-3 transition hover:bg-slate-50"
                href={subItem.url}
              >
                {subItem.icon ? (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                    {subItem.icon}
                  </span>
                ) : null}
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {subItem.title}
                  </span>
                  {subItem.description && (
                    <span className="mt-1 block text-xs text-slate-500">
                      {subItem.description}
                    </span>
                  )}
                </span>
              </a>
            </NavigationMenuLink>
          </li>
        );
      });

    return (
      <NavigationMenuItem key={item.title} className="text-white">
        <NavigationMenuTrigger className="rounded-full bg-transparent text-white/90 hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white">
          {item.title}
        </NavigationMenuTrigger>
        <NavigationMenuContent>
          <div className="w-[680px] p-5">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                {left.header ? (
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {left.header}
                  </div>
                ) : null}
                {left.note ? (
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    {left.note}
                  </p>
                ) : null}
                <ul className="mt-4 grid gap-3">
                  {renderListItems(left.items)}
                </ul>
              </div>
              <div className="border-l border-slate-200 pl-6">
                {right.header ? (
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {right.header}
                  </div>
                ) : null}
                {right.note ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {right.note}
                  </p>
                ) : null}
                <ul className="mt-4 grid gap-3">
                  {renderListItems(right.items)}
                </ul>
              </div>
            </div>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  if (item.items) {
    const hasFeatured = Boolean(item.featured);
    const columnCount = item.itemsColumns && item.itemsColumns > 1 ? 2 : 1;
    const listWidthClass = columnCount === 2 ? "w-[560px]" : "w-80";
    const listClassName = cn(
      "grid gap-2",
      columnCount === 2 ? "grid-cols-2 gap-x-4" : "grid-cols-1",
      item.itemsHeader || item.itemsNote ? "mt-3" : ""
    );
    return (
      <NavigationMenuItem key={item.title} className="text-white">
        <NavigationMenuTrigger className="rounded-full bg-transparent text-white/90 hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white">
          {item.title}
        </NavigationMenuTrigger>
        <NavigationMenuContent>
          {hasFeatured ? (
            <div className="w-[680px] p-5">
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_240px]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {item.itemsHeader || "By business size"}
                  </div>
                  <ul className="mt-4 grid gap-3">
                    {item.items.map((subItem) => (
                      <li key={subItem.title}>
                        <NavigationMenuLink asChild>
                          <a
                            className="group flex items-start gap-4 rounded-2xl p-3 transition hover:bg-slate-50"
                            href={subItem.url}
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                              {subItem.icon}
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-slate-900">
                                {subItem.title}
                              </span>
                              {subItem.description && (
                                <span className="mt-1 block text-xs text-slate-500">
                                  {subItem.description}
                                </span>
                              )}
                            </span>
                          </a>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </div>
                {item.featured ? (
                  <div className="flex h-full flex-col gap-4 border-l border-slate-200 pl-6">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">
                        {item.featured.title}
                      </div>
                      {item.featured.description && (
                        <p className="mt-1 text-xs text-slate-500">
                          {item.featured.description}
                        </p>
                      )}
                      {item.featured.items && item.featured.items.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                          {item.featured.items.map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {item.featured.url ? (
                      <a
                        href={item.featured.url}
                        className="group overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm"
                      >
                        {item.featured.syncWithHeroVideo ? (
                          <HeroVideoPreview
                            fallbackImage={item.featured.image}
                            alt={item.featured.alt || item.featured.title}
                            className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <img
                            src={item.featured.image}
                            alt={item.featured.alt || item.featured.title}
                            className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        )}
                      </a>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                        {item.featured.syncWithHeroVideo ? (
                          <HeroVideoPreview
                            fallbackImage={item.featured.image}
                            alt={item.featured.alt || item.featured.title}
                            className="h-36 w-full object-cover"
                          />
                        ) : (
                          <img
                            src={item.featured.image}
                            alt={item.featured.alt || item.featured.title}
                            className="h-36 w-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={cn("p-4 bg-background text-foreground", listWidthClass)}>
              {item.itemsHeader && (
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {item.itemsHeader}
                </div>
              )}
              {item.itemsNote && (
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {item.itemsNote}
                </p>
              )}
              <ul className={listClassName}>
                {item.items.map((subItem) => (
                  <li key={subItem.title}>
                    <NavigationMenuLink asChild>
                      <a
                        className="flex select-none items-start gap-3 rounded-lg p-3 leading-none no-underline outline-none transition-colors hover:bg-muted hover:text-accent-foreground"
                        href={subItem.url}
                      >
                        {subItem.icon ? (
                          <span className="mt-0.5 text-slate-500">
                            {subItem.icon}
                          </span>
                        ) : null}
                        <div>
                          <div className="text-sm font-semibold">
                            {subItem.title}
                          </div>
                          {subItem.description && (
                            <p className="text-sm leading-snug text-muted-foreground">
                              {subItem.description}
                            </p>
                          )}
                        </div>
                      </a>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.title}>
      <a
        className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:text-white"
        href={item.url}
      >
        {item.title}
      </a>
    </NavigationMenuItem>
  );
};

const renderMobileMenuItem = (item: MenuItem) => {
  if (item.items) {
    if (item.dualList) {
      const { left, right } = item.dualList;
      const renderList = (list: MenuItem[]) =>
        list.map((subItem) => (
          <a
            key={subItem.title}
            className="flex select-none gap-4 rounded-md p-3 leading-none outline-none transition-colors hover:bg-muted hover:text-accent-foreground"
            href={subItem.url}
          >
            {subItem.icon ? subItem.icon : null}
            <div>
              <div className="text-sm font-semibold">{subItem.title}</div>
              {subItem.description && (
                <p className="text-sm leading-snug text-muted-foreground">
                  {subItem.description}
                </p>
              )}
            </div>
          </a>
        ));

      return (
        <AccordionItem key={item.title} value={item.title} className="border-b-0">
          <AccordionTrigger className="py-0 font-semibold hover:no-underline">
            {item.title}
          </AccordionTrigger>
          <AccordionContent className="mt-3 space-y-4">
            <div>
              {left.header ? (
                <div className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {left.header}
                </div>
              ) : null}
              {left.note ? (
                <div className="px-3 text-xs font-semibold text-muted-foreground">
                  {left.note}
                </div>
              ) : null}
              <div className="mt-2 space-y-2">
                {renderList(left.items)}
              </div>
            </div>
            <div>
              {right.header ? (
                <div className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {right.header}
                </div>
              ) : null}
              {right.note ? (
                <div className="px-3 text-xs font-semibold text-muted-foreground">
                  {right.note}
                </div>
              ) : null}
              <div className="mt-2 space-y-2">
                {renderList(right.items)}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      );
    }
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="py-0 font-semibold hover:no-underline">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="mt-3 space-y-2">
          {item.itemsHeader && (
            <div className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {item.itemsHeader}
            </div>
          )}
          {item.itemsNote && (
            <div className="px-3 text-xs font-semibold text-muted-foreground">
              {item.itemsNote}
            </div>
          )}
          {item.items.map((subItem) => (
            <a
              key={subItem.title}
              className="flex select-none gap-4 rounded-md p-3 leading-none outline-none transition-colors hover:bg-muted hover:text-accent-foreground"
              href={subItem.url}
            >
              {subItem.icon ? subItem.icon : null}
              <div>
                <div className="text-sm font-semibold">{subItem.title}</div>
                {subItem.description && (
                  <p className="text-sm leading-snug text-muted-foreground">
                    {subItem.description}
                  </p>
                )}
              </div>
            </a>
          ))}
          {item.featured ? (
            <a
              className="flex flex-col gap-2 rounded-md p-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              href={item.featured.url || "#"}
            >
              <span>{item.featured.title}</span>
              {item.featured.items && item.featured.items.length > 0 && (
                <span className="text-xs font-medium text-muted-foreground">
                  {item.featured.items.join(", ")}
                </span>
              )}
              {item.featured.syncWithHeroVideo ? (
                <HeroVideoPreview
                  fallbackImage={item.featured.image}
                  alt={item.featured.alt || item.featured.title}
                  className="h-24 w-full rounded-md object-cover"
                />
              ) : (
                <img
                  src={item.featured.image}
                  alt={item.featured.alt || item.featured.title}
                  className="h-24 w-full rounded-md object-cover"
                  loading="lazy"
                />
              )}
            </a>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <AccordionItem key={item.title} value={item.title} className="border-b-0">
      <AccordionTrigger className="py-0 font-semibold hover:no-underline">
        {item.title}
      </AccordionTrigger>
    </AccordionItem>
  );
};

export { Navbar1 };
