import React from "react";
import { Calendar, ArrowRight, Phone } from "lucide-react";
import { Button } from "../../components/ui/button";

interface HeroStat {
  value: string;
  label: string;
}

interface ClinicHeroProps {
  headline?: string;
  supportingText?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  imageUrl?: string;
  secondaryImageUrl?: string;
  imageAlt?: string;
  secondaryImageAlt?: string;
  badgeText?: string;
  primaryHref?: string;
  secondaryHref?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  stats?: HeroStat[];
  className?: string;
}

const ImageWithFallback = ({
  src,
  fallbackSrc,
  alt,
  className,
}: {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
}) => {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!fallbackSrc) return;
    const img = e.currentTarget;
    if (img.dataset.didFallback === "1") return;
    img.dataset.didFallback = "1";
    img.src = fallbackSrc;
  };

  return (
    <img
      src={src || fallbackSrc}
      alt={alt}
      className={className}
      onError={handleError}
      data-did-fallback="0"
    />
  );
};

const ClinicHeroTemplate: React.FC<ClinicHeroProps> = ({
  headline = "Advanced Healthcare for Your Whole Family",
  supportingText = "Experience compassionate, personalized care with a clinic that puts your needs first.",
  primaryButtonText = "Book Appointment",
  secondaryButtonText = "Call Us Now",
  imageUrl = "/hero-2/pexels-cottonbro-7581072.jpg",
  secondaryImageUrl = "/hero-2/pexels-yankrukov-5793991.jpg",
  imageAlt = "Modern clinic facility",
  secondaryImageAlt = "Clinic treatment",
  badgeText = "Now accepting new patients",
  primaryHref,
  secondaryHref,
  onPrimaryClick,
  onSecondaryClick,
  stats = [
    { value: "15+", label: "Years experience" },
    { value: "2k+", label: "Happy patients" },
    { value: "4.9★", label: "Patient rating" },
  ],
  className = "",
}) => {
  return (
    <section className={`relative w-full overflow-hidden bg-background ${className}`}>
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,197,253,0.1),transparent_50%)]"></div>
      </div>

      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid min-h-[620px] items-center gap-12 py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div className="flex flex-col justify-center space-y-8">
            <div className="inline-flex items-center gap-2 w-fit">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                </span>
                {badgeText}
              </span>
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl">
              {headline}
            </h1>

            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {supportingText}
            </p>

            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              {primaryHref ? (
                <Button
                  size="lg"
                  className="group px-8 py-6 text-base font-semibold shadow-lg transition-all duration-200 hover:shadow-xl"
                  asChild
                >
                  <a href={primaryHref}>
                    <Calendar className="mr-2 h-5 w-5" />
                    {primaryButtonText}
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </a>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="group px-8 py-6 text-base font-semibold shadow-lg transition-all duration-200 hover:shadow-xl"
                  onClick={onPrimaryClick}
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  {primaryButtonText}
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              )}

              {secondaryHref ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 px-8 py-6 text-base font-semibold hover:bg-accent"
                  asChild
                >
                  <a href={secondaryHref}>
                    <Phone className="mr-2 h-5 w-5" />
                    {secondaryButtonText}
                  </a>
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 px-8 py-6 text-base font-semibold hover:bg-accent"
                  onClick={onSecondaryClick}
                >
                  <Phone className="mr-2 h-5 w-5" />
                  {secondaryButtonText}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-8 border-t border-border pt-8">
              {stats.map((stat, idx) => (
                <div key={`${stat.value}-${idx}`} className="flex flex-col">
                  <span className="text-3xl font-bold text-foreground">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative h-[500px] lg:h-[700px]">
            <div className="absolute inset-0">
              <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl animate-pulse"></div>
              <div
                className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl animate-pulse"
                style={{ animationDelay: "1s" }}
              ></div>
            </div>

            <div className="relative h-full">
              <div className="absolute right-0 top-0 h-3/5 w-4/5 overflow-hidden rounded-3xl border-4 border-white shadow-2xl transition-transform duration-500 hover:scale-[1.02]">
                <ImageWithFallback
                  src={imageUrl}
                  fallbackSrc="/hero-2/pexels-cottonbro-7581072.jpg"
                  alt={imageAlt}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-600/30 to-transparent"></div>
              </div>

              <div className="absolute bottom-0 left-0 h-2/5 w-3/5 overflow-hidden rounded-3xl border-4 border-white shadow-xl transition-transform duration-500 hover:scale-[1.02]">
                <ImageWithFallback
                  src={secondaryImageUrl}
                  fallbackSrc="/hero-2/pexels-yankrukov-5793991.jpg"
                  alt={secondaryImageAlt}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-transparent"></div>
              </div>

              <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded-2xl border border-blue-100 bg-white p-6 shadow-2xl transition-transform duration-300 hover:scale-105">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                    <Calendar className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-foreground">24/7</div>
                    <div className="text-sm text-muted-foreground">Available</div>
                  </div>
                </div>
              </div>

              <div className="absolute left-1/4 top-1/4 h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 opacity-50 blur-xl animate-pulse"></div>
              <div
                className="absolute bottom-1/4 right-1/4 h-16 w-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 opacity-40 blur-lg animate-pulse"
                style={{ animationDelay: "2s" }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClinicHeroTemplate;
