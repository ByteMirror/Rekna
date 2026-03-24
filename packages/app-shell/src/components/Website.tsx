import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  buildLatestReleaseAssetUrl,
  desktopDownloadVariants as sharedDesktopDownloadVariants,
  REKNA_GITHUB_REPOSITORY_URL,
  type DesktopDownloadFamily,
} from "@linea/shared";
import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useState } from "react";

import reknaDesktopIcon from "../../../../apps/desktop/icon.iconset/icon_512x512.png";
import lineaAppScreenshot from "../assets/linea-app-screenshot.png";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type FeatureDefinition = {
  body: string;
  eyebrow: string;
  id: string;
  objectPosition: string;
  title: string;
};

type DownloadFamily = DesktopDownloadFamily;

type DownloadVariant = {
  family: Exclude<DownloadFamily, "unknown">;
  href: string;
  id: "linux-x64" | "macos-arm64";
  label: string;
  note: string;
};

type TestimonialDefinition = {
  author: string;
  handle: string;
  id: string;
  quote: string;
  role: string;
};

type WebsiteProps = {
  featureCycleMs?: number;
};

const websiteTheme = {
  "--website-bg": "var(--background)",
  "--website-surface": "color-mix(in oklab, var(--background) 92%, black 8%)",
  "--website-ink": "var(--foreground)",
  "--website-ink-soft":
    "color-mix(in oklab, var(--foreground) 10%, transparent)",
  "--website-muted":
    "color-mix(in oklab, var(--foreground) 68%, transparent)",
  "--website-line":
    "color-mix(in oklab, var(--border) 74%, var(--primary) 26%)",
  "--website-accent": "var(--primary)",
  "--website-accent-soft":
    "color-mix(in oklab, var(--primary) 14%, transparent)",
} as CSSProperties;

const displayFont =
  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif';
const monoFont =
  '"JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace';

const HOMEPAGE_PATH = "/";
const DOWNLOAD_PATH = "/download";
const DOWNLOAD_HASH = "#download";
const DOWNLOAD_SECTION_ID = "download";
const GITHUB_REPO_URL = REKNA_GITHUB_REPOSITORY_URL;

const homepageFeatures: FeatureDefinition[] = [
  {
    body: "Switch currencies and units inline while the result stays locked to the side.",
    eyebrow: "Conversions",
    id: "units-and-fx",
    objectPosition: "52% 12%",
    title: "Units and FX",
  },
  {
    body: "Reuse totals and intermediate results naturally without turning the sheet into a spreadsheet.",
    eyebrow: "Reuse values",
    id: "sheet-memory",
    objectPosition: "50% 48%",
    title: "Sheet memory",
  },
  {
    body: "Move through sheets fast enough that the calculation never loses momentum.",
    eyebrow: "Find fast",
    id: "quiet-search",
    objectPosition: "50% 82%",
    title: "Quiet search",
  },
] as const;

const downloadVariants: DownloadVariant[] = sharedDesktopDownloadVariants.map(
  (variant) => ({
    family: variant.family,
    href: buildLatestReleaseAssetUrl(variant.assetFileName),
    id: variant.id,
    label: variant.label,
    note: variant.note,
  })
);

const homepageTestimonials: TestimonialDefinition[] = [
  {
    author: "Lina Park",
    handle: "@linapark",
    id: "consulting-pricing",
    quote: "The fastest way to price ideas",
    role: "Independent product consultant",
  },
  {
    author: "Ari Weiss",
    handle: "@ariweiss",
    id: "ops-handoff",
    quote: "Fewer spreadsheet handoffs",
    role: "Operations lead at a remote studio",
  },
  {
    author: "Noor Haddad",
    handle: "@noorhaddad",
    id: "date-math",
    quote: "Date math finally feels native",
    role: "Program manager across Berlin and Dubai",
  },
  {
    author: "Marta Silva",
    handle: "@martasilva",
    id: "client-pricing",
    quote: "I can answer the pricing question before the call starts",
    role: "Freelance strategist across Lisbon and London",
  },
  {
    author: "Jules Meyer",
    handle: "@julesmeyer",
    id: "operations-rhythm",
    quote: "Finally a calculator that keeps up with operations",
    role: "Studio operations manager",
  },
  {
    author: "Evan Cole",
    handle: "@evancole",
    id: "budget-sanity",
    quote: "The quickest way to sanity-check a budget",
    role: "Founder running a tiny remote team",
  },
] as const;

export function Website({ featureCycleMs = 3200 }: WebsiteProps) {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  useEffect(() => {
    const previousRootView = document.body.dataset.rootView;
    const existingFavicon = document.querySelector<HTMLLinkElement>(
      'link[rel="icon"]'
    );
    const favicon = existingFavicon ?? document.createElement("link");

    document.body.dataset.rootView = "website";
    favicon.rel = "icon";
    favicon.href = reknaDesktopIcon;

    if (!existingFavicon) {
      document.head.appendChild(favicon);
    }

    return () => {
      if (previousRootView) {
        document.body.dataset.rootView = previousRootView;
      } else {
        delete document.body.dataset.rootView;
      }
    };
  }, []);

  useEffect(() => {
    const shouldScrollToDownload =
      window.location.pathname === DOWNLOAD_PATH ||
      window.location.hash === DOWNLOAD_HASH;

    if (!shouldScrollToDownload) {
      return undefined;
    }

    if (
      window.location.pathname !== HOMEPAGE_PATH ||
      window.location.hash !== DOWNLOAD_HASH
    ) {
      window.history.replaceState({}, "", `${HOMEPAGE_PATH}${DOWNLOAD_HASH}`);
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      scrollToDownloadSection("auto");
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveFeatureIndex((currentIndex) =>
        (currentIndex + 1) % homepageFeatures.length
      );
    }, featureCycleMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [featureCycleMs]);

  const activeFeature =
    homepageFeatures[activeFeatureIndex] ?? homepageFeatures[0];

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[var(--website-bg)] text-[var(--website-ink)]"
      data-theme="dark"
      style={websiteTheme}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--website-accent-soft),transparent_30%),linear-gradient(180deg,color-mix(in_oklab,var(--website-bg)_96%,black_4%),var(--website-bg))]"
      />
      <style>{`
        @keyframes websiteFeatureProgress {
          from {
            transform: scaleX(0);
          }

          to {
            transform: scaleX(1);
          }
        }

        @keyframes websiteTestimonialLaneLeft {
          from {
            transform: translate3d(0, 0, 0);
          }

          to {
            transform: translate3d(-50%, 0, 0);
          }
        }

        @keyframes websiteTestimonialLaneRight {
          from {
            transform: translate3d(-50%, 0, 0);
          }

          to {
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
      <main
        className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-12"
        style={{ fontFamily: monoFont }}
      >
        <WebsiteHeader />
        <Homepage
          activeFeature={activeFeature}
          activeFeatureIndex={activeFeatureIndex}
          featureCycleMs={featureCycleMs}
          onFeatureSelect={setActiveFeatureIndex}
        />
      </main>
    </div>
  );
}

function WebsiteHeader() {
  return (
    <nav className="flex items-center justify-between gap-4 py-2">
      <a
        className="flex items-center gap-3 text-sm tracking-[0.16em] text-[var(--website-ink)]"
        href={HOMEPAGE_PATH}
        onClick={navigateToHomepage}
      >
        <img
          alt="Rekna desktop app icon"
          className="size-12 rounded-[1.1rem]"
          src={reknaDesktopIcon}
        />
        <span className="uppercase">Rekna</span>
      </a>
      <div className="flex items-center gap-5">
        <a
          className="text-[0.72rem] uppercase tracking-[0.18em] text-[var(--website-muted)] transition-colors hover:text-[var(--website-ink)]"
          href={GITHUB_REPO_URL}
          rel="noreferrer"
          target="_blank"
        >
          GitHub
        </a>
        <a
          className="text-[0.72rem] uppercase tracking-[0.18em] text-[var(--website-muted)] transition-colors hover:text-[var(--website-ink)]"
          href={DOWNLOAD_HASH}
          onClick={navigateToDownload}
        >
          Download
        </a>
      </div>
    </nav>
  );
}

function Homepage({
  activeFeature,
  activeFeatureIndex,
  featureCycleMs,
  onFeatureSelect,
}: {
  activeFeature: FeatureDefinition;
  activeFeatureIndex: number;
  featureCycleMs: number;
  onFeatureSelect: (nextIndex: number) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-14 py-10 lg:gap-20 lg:py-14">
      <section className="grid items-center gap-12 lg:grid-cols-[minmax(20rem,21rem)_minmax(0,1fr)] lg:gap-16">
        <div
          className="mx-auto flex w-full max-w-[21rem] flex-col justify-center lg:mx-0 lg:min-h-[30rem]"
          data-testid="feature-column"
        >
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[var(--website-accent)]">
            Rekna
          </p>
          <h1
            className="mt-4 text-5xl leading-[0.9] tracking-[-0.06em] sm:text-6xl"
            style={{ fontFamily: displayFont }}
          >
            Rekna
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--website-muted)]">
            Plain text. Exact totals.
          </p>

          <div
            className="mt-12 flex flex-1 flex-col justify-center"
            data-testid="feature-tabs-shell"
          >
            <div
              className="flex flex-col gap-5"
              data-testid="feature-tabs"
              role="tablist"
              aria-label="Feature previews"
            >
              {homepageFeatures.map((feature, index) => {
                const isActive = index === activeFeatureIndex;

                return (
                  <button
                    aria-label={feature.title}
                    aria-pressed={isActive}
                    className={`group relative flex w-full items-center justify-center overflow-hidden rounded-[1rem] border p-4 text-center transition-[transform,border-color,background-color,color,box-shadow] duration-200 ${
                      isActive
                        ? "border-[var(--website-ink)] bg-[var(--website-ink)] text-[var(--website-bg)] shadow-[0_24px_60px_-48px_rgba(255,255,255,0.1)]"
                        : "border-[var(--website-line)] bg-[color-mix(in_oklab,var(--website-surface)_72%,transparent)] text-[var(--website-muted)] hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--website-ink)_18%,var(--website-line))] hover:text-[var(--website-ink)]"
                    }`}
                    key={feature.id}
                    onClick={() => onFeatureSelect(index)}
                    role="tab"
                    type="button"
                  >
                    <span
                      className="block min-w-0 text-[1.35rem] leading-7 tracking-[-0.03em] text-current sm:text-[1.5rem]"
                      data-testid={`feature-tab-title-${feature.id}`}
                    >
                      {feature.title}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`absolute bottom-3 left-1/2 h-1 w-24 -translate-x-1/2 overflow-hidden rounded-full ${
                        isActive
                          ? "bg-[color-mix(in_oklab,var(--website-bg)_18%,transparent)]"
                          : "bg-[var(--website-ink-soft)]"
                      }`}
                    >
                      <span
                        className={`block h-full w-full origin-left rounded-full ${
                          isActive
                            ? "bg-[var(--website-bg)]"
                            : "bg-[var(--website-ink)]"
                        } ${isActive ? "" : "opacity-0"}`}
                        data-active={isActive ? "true" : "false"}
                        data-testid={`feature-tab-progress-${feature.id}`}
                        style={{
                          animationDuration: `${featureCycleMs}ms`,
                          animationFillMode: "forwards",
                          animationName: isActive
                            ? "websiteFeatureProgress"
                            : "none",
                          animationTimingFunction: "linear",
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="relative min-h-0 lg:self-center">
          <div
            aria-hidden="true"
            className="absolute inset-x-12 top-10 h-40 rounded-full bg-[var(--website-accent-soft)] blur-3xl"
          />
          <figure
            className="relative overflow-hidden rounded-[1.6rem] border border-[var(--website-line)] bg-[var(--website-surface)]"
            data-feature={activeFeature.id}
            data-testid="feature-media"
          >
            <div className="flex items-center justify-between border-b border-[var(--website-line)] px-4 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-[var(--website-muted)]">
              <span>{activeFeature.eyebrow}</span>
              <span data-testid="feature-media-title">{activeFeature.title}</span>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                alt={`${activeFeature.title} preview`}
                className="h-full w-full object-cover transition-[transform,object-position] duration-700 ease-out"
                src={lineaAppScreenshot}
                style={{
                  objectPosition: activeFeature.objectPosition,
                  transform:
                    activeFeature.id === "sheet-memory"
                      ? "scale(1.06)"
                      : activeFeature.id === "quiet-search"
                        ? "scale(1.04)"
                        : "scale(1)",
                }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,21,18,0.02),rgba(18,21,18,0.22))]" />
            </div>
            <figcaption className="border-t border-[var(--website-line)] px-4 py-4 text-sm leading-7 text-[var(--website-muted)]">
              {activeFeature.body}
            </figcaption>
          </figure>
        </div>
      </section>

      <HomepageTestimonials />
      <HomepageDownloadSection />
    </div>
  );
}

function HomepageTestimonials() {
  const leftLaneTestimonials = homepageTestimonials.slice(0, 3);
  const rightLaneTestimonials = homepageTestimonials.slice(3);

  return (
    <section className="relative" data-testid="testimonial-section">
      <div
        aria-hidden="true"
        className="absolute inset-x-20 top-12 h-32 rounded-full bg-[color-mix(in_oklab,var(--website-accent)_8%,transparent)] blur-3xl"
      />
      <div className="relative px-2 py-6 sm:px-3 sm:py-7 lg:px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg leading-none text-[var(--website-accent)]">
              ›
            </span>
            <h2
              className="text-[1.7rem] tracking-[-0.05em] text-[var(--website-ink)] sm:text-[2.2rem]"
              style={{ fontFamily: displayFont }}
            >
              What People Say
            </h2>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <HomepageTestimonialLane
            direction="left"
            laneId="testimonial-lane-left"
            testimonials={leftLaneTestimonials}
          />
          <HomepageTestimonialLane
            direction="right"
            laneId="testimonial-lane-right"
            testimonials={rightLaneTestimonials}
          />
        </div>
      </div>
    </section>
  );
}

function HomepageTestimonialLane({
  direction,
  laneId,
  testimonials,
}: {
  direction: "left" | "right";
  laneId: string;
  testimonials: TestimonialDefinition[];
}) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const marqueeTestimonials = [...testimonials, ...testimonials];

  return (
    <div
      className="overflow-hidden"
      data-direction={direction}
      data-paused={isPaused ? "true" : "false"}
      data-testid={laneId}
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
      }}
    >
      <div
        className="flex w-max gap-5 pr-5"
        data-testid={`${laneId}-track`}
        style={{
          animationDuration: `${direction === "left" ? 28 : 30}s`,
          animationIterationCount: "infinite",
          animationName:
            direction === "left"
              ? "websiteTestimonialLaneLeft"
              : "websiteTestimonialLaneRight",
          animationPlayState: isPaused ? "paused" : "running",
          animationTimingFunction: "linear",
          willChange: "transform",
        }}
      >
        {marqueeTestimonials.map((testimonial, index) => (
          (() => {
            const cardId = `${laneId}-${testimonial.id}-${index}`;

            return (
              <HomepageTestimonialCard
                isHighlighted={activeCardId === cardId}
                key={cardId}
                onMouseEnter={() => {
                  setActiveCardId(cardId);
                  setIsPaused(true);
                }}
                onMouseLeave={() => {
                  setActiveCardId(null);
                  setIsPaused(false);
                }}
                onFocus={() => {
                  setActiveCardId(cardId);
                  setIsPaused(true);
                }}
                onBlur={() => {
                  setActiveCardId(null);
                  setIsPaused(false);
                }}
                testId={`testimonial-card-${cardId}`}
                testimonial={testimonial}
              />
            );
          })()
        ))}
      </div>
    </div>
  );
}

function HomepageTestimonialCard({
  isHighlighted,
  onBlur,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  testId,
  testimonial,
}: {
  isHighlighted: boolean;
  onBlur: () => void;
  onFocus: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  testId: string;
  testimonial: TestimonialDefinition;
}) {
  const initials = testimonial.author
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <article
      className={`group relative flex min-h-[12.5rem] w-[22rem] shrink-0 gap-4 overflow-hidden rounded-[1.75rem] border px-5 py-5 transition-[border-color,background-color,box-shadow] duration-300 sm:w-[28rem] ${
        isHighlighted
          ? "border-[color-mix(in_oklab,var(--website-accent)_60%,var(--website-line))] bg-[color-mix(in_oklab,var(--website-surface)_78%,var(--website-accent-soft))] shadow-[0_34px_90px_-46px_var(--website-accent)]"
          : "border-[color-mix(in_oklab,var(--website-line)_78%,var(--website-accent)_22%)] bg-[color-mix(in_oklab,var(--website-surface)_92%,transparent)] hover:border-[color-mix(in_oklab,var(--website-accent)_50%,var(--website-line))] hover:bg-[color-mix(in_oklab,var(--website-surface)_84%,var(--website-accent-soft))] hover:shadow-[0_28px_70px_-44px_var(--website-accent)]"
      }`}
      data-highlighted={isHighlighted ? "true" : "false"}
      data-testid={testId}
      onBlur={onBlur}
      onFocus={onFocus}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      tabIndex={0}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-10 -bottom-8 h-20 rounded-full blur-2xl transition-opacity duration-300 ${
          isHighlighted
            ? "bg-[color-mix(in_oklab,var(--website-accent)_38%,transparent)] opacity-100"
            : "bg-[color-mix(in_oklab,var(--website-accent)_28%,transparent)] opacity-0"
        }`}
      />
      <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--website-line)_74%,transparent)] bg-[color-mix(in_oklab,var(--website-ink)_8%,transparent)] text-sm tracking-[0.14em] text-[var(--website-ink)]">
        {initials}
      </div>
      <div className="relative min-w-0">
        <p
          className={`text-[1.2rem] leading-8 tracking-[-0.03em] sm:text-[1.35rem] ${
            isHighlighted
              ? "text-[var(--website-ink)]"
              : "text-[var(--website-muted)]"
          }`}
        >
          {testimonial.quote}
        </p>
        <div className="mt-5 space-y-1.5">
          <p
            className={`text-base transition-colors duration-300 ${
              isHighlighted
                ? "text-[color-mix(in_oklab,var(--website-accent)_88%,white_12%)]"
                : "text-[var(--website-accent)]"
            }`}
          >
            {testimonial.handle}
          </p>
          <p
            className={`text-[0.8rem] leading-6 transition-colors duration-300 ${
              isHighlighted
                ? "text-[color-mix(in_oklab,var(--website-muted)_88%,white_12%)]"
                : "text-[var(--website-muted)]"
            }`}
          >
            {testimonial.author}
            {" · "}
            {testimonial.role}
          </p>
        </div>
      </div>
    </article>
  );
}

function HomepageDownloadSection() {
  const detectedFamily = detectDownloadFamily();
  const defaultVariant = getDefaultDownloadVariant(detectedFamily);
  const detectedPlatformLabel = getDownloadFamilyLabel(detectedFamily);

  return (
    <section
      className="flex items-center py-12 scroll-mt-24 sm:py-16"
      data-testid="download-section"
      id={DOWNLOAD_SECTION_ID}
    >
      <div
        className="grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-12"
        data-testid="download-grid"
      >
        <div
          className="flex max-w-2xl flex-col justify-center gap-8 lg:pr-6"
          data-testid="download-copy-column"
        >
          <div>
            <h1
              className="text-4xl tracking-[-0.05em] sm:text-5xl"
              style={{ fontFamily: displayFont }}
            >
              Download Rekna
            </h1>
          </div>

          <div className="flex flex-col items-start gap-3" data-testid="download-actions-row">
            <p
              className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--website-muted)]"
              data-testid="detected-download-platform"
            >
              {detectedFamily === "unknown"
                ? "Default build selected"
                : `${detectedPlatformLabel} detected`}
            </p>
            <div className="inline-flex max-w-full overflow-hidden rounded-full border border-[color-mix(in_oklab,var(--website-line)_72%,var(--website-accent)_28%)] bg-[var(--website-surface)] shadow-[0_18px_48px_-34px_rgba(0,0,0,0.55)]">
              <Button
                asChild
                className="h-10 rounded-none border-0 bg-[var(--website-accent)] px-5 text-[0.76rem] uppercase tracking-[0.14em] text-[var(--website-bg)] hover:bg-[color-mix(in_oklab,var(--website-accent)_86%,black_14%)]"
                size="lg"
              >
                <a data-testid="download-cta" href={defaultVariant.href}>
                  {`Download for ${defaultVariant.label}`}
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
              <DropdownMenu>
                <Button
                  asChild
                  className="h-10 rounded-none border-0 border-l border-[color-mix(in_oklab,var(--website-accent)_34%,var(--website-line))] bg-[var(--website-accent)] px-3 text-[var(--website-bg)] hover:bg-[color-mix(in_oklab,var(--website-accent)_86%,black_14%)]"
                  size="lg"
                >
                  <DropdownMenuTrigger
                    aria-label="Choose a different download"
                    type="button"
                  >
                    <ChevronDown className="size-4" />
                  </DropdownMenuTrigger>
                </Button>
                <DropdownMenuContent
                  align="start"
                  className="w-[17.5rem] rounded-[1.15rem] border-[color-mix(in_oklab,var(--website-line)_76%,var(--website-accent)_24%)] bg-[var(--website-surface)] p-1.5"
                >
                  {downloadVariants.map((variant) => (
                    <DropdownMenuItem
                      asChild
                      className="rounded-[0.95rem] px-3 py-3"
                      key={variant.id}
                    >
                      <a
                        aria-label={variant.label}
                        data-testid={`download-option-${variant.id}`}
                        href={variant.href}
                        rel="noreferrer"
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="text-sm text-[var(--website-ink)]">
                            {variant.label}
                          </span>
                          <span className="text-[0.73rem] leading-5 text-[var(--website-muted)]">
                            {variant.note}
                          </span>
                        </span>
                      </a>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div
          className="flex w-full items-center justify-center lg:justify-end"
          data-testid="download-page-icon-shell"
        >
          <img
            alt="Rekna app icon"
            className="size-48 rounded-[2.8rem] shadow-[0_28px_60px_-34px_var(--website-accent)] sm:size-52"
            src={reknaDesktopIcon}
          />
        </div>
      </div>
    </section>
  );
}

function navigateToHomepage(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();
  window.history.pushState({}, "", HOMEPAGE_PATH);
  window.scrollTo({ behavior: "smooth", top: 0 });
}

function navigateToDownload(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();

  if (
    window.location.pathname !== HOMEPAGE_PATH ||
    window.location.hash !== DOWNLOAD_HASH
  ) {
    window.history.pushState({}, "", `${HOMEPAGE_PATH}${DOWNLOAD_HASH}`);
  }

  scrollToDownloadSection("smooth");
}

function scrollToDownloadSection(behavior: ScrollBehavior) {
  document
    .getElementById(DOWNLOAD_SECTION_ID)
    ?.scrollIntoView({ behavior, block: "start" });
}

function detectDownloadFamily(): DownloadFamily {
  const browserNavigator = window.navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platformText = [
    browserNavigator.userAgentData?.platform,
    browserNavigator.platform,
    browserNavigator.userAgent,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    platformText.includes("mac") ||
    platformText.includes("darwin") ||
    platformText.includes("iphone") ||
    platformText.includes("ipad")
  ) {
    return "macos";
  }

  if (platformText.includes("linux") || platformText.includes("x11")) {
    return "linux";
  }

  return "unknown";
}

function getDefaultDownloadVariant(family: DownloadFamily) {
  if (family === "linux") {
    return downloadVariants.find((variant) => variant.id === "linux-x64")!;
  }

  return downloadVariants.find((variant) => variant.id === "macos-arm64")!;
}

function getDownloadFamilyLabel(family: DownloadFamily) {
  if (family === "macos") {
    return "macOS";
  }

  if (family === "linux") {
    return "Linux";
  }

  return "Recommended";
}
