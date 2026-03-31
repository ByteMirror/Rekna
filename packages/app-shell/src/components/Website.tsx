import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  desktopDownloadVariants as sharedDesktopDownloadVariants,
  REKNA_GITHUB_LATEST_RELEASE_API_URL,
  REKNA_GITHUB_REPOSITORY_URL,
  type DesktopReleaseAsset,
  resolveDesktopDownloadUrl,
} from "@linea/shared";
import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import reknaDesktopIcon from "../../../../apps/desktop/icon.iconset/icon_512x512.png";
import { Button } from "./ui/button";

type FeatureDefinition = {
  id: string;
  title: string;
  videoSrc: string;
};

type DownloadVariant = {
  href: string;
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
    id: "plain-text-calculations",
    title: "Plain Text Calculations",
    videoSrc: "/videos/rekna-plain-text-calculations.mp4",
  },
  {
    id: "units-and-currency",
    title: "Units & Currency",
    videoSrc: "/videos/rekna-units-and-currency.mp4",
  },
  {
    id: "connected-sheets",
    title: "Connected Sheets",
    videoSrc: "/videos/rekna-connected-sheets.mp4",
  },
] as const;

const fallbackDownloadVariants = buildDownloadVariants();

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

export function Website({ featureCycleMs }: WebsiteProps) {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [downloadVariants, setDownloadVariants] = useState<DownloadVariant[]>(
    fallbackDownloadVariants
  );
  const [featureDurationsMs, setFeatureDurationsMs] = useState<
    Record<string, number>
  >({});

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

  const activeFeature =
    homepageFeatures[activeFeatureIndex] ?? homepageFeatures[0];
  const getFeatureCycleDuration = (featureId: string) =>
    featureCycleMs ?? featureDurationsMs[featureId] ?? 0;
  const activeFeatureCycleMs = getFeatureCycleDuration(activeFeature.id);

  useEffect(() => {
    if (featureCycleMs === undefined || activeFeatureCycleMs <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveFeatureIndex((currentIndex) =>
        (currentIndex + 1) % homepageFeatures.length
      );
    }, activeFeatureCycleMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeFeature.id, activeFeatureCycleMs]);

  useEffect(() => {
    let isDisposed = false;

    void loadDownloadVariants()
      .then((resolvedDownloadVariants) => {
        if (!isDisposed) {
          setDownloadVariants(resolvedDownloadVariants);
        }
      })
      .catch(() => undefined);

    return () => {
      isDisposed = true;
    };
  }, []);

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
          downloadVariants={downloadVariants}
          getFeatureCycleDuration={getFeatureCycleDuration}
          usesTimedFeatureCycle={featureCycleMs !== undefined}
          onFeatureAdvance={() => {
            setActiveFeatureIndex(
              (currentIndex) => (currentIndex + 1) % homepageFeatures.length
            );
          }}
          onFeatureDurationChange={(featureId, durationMs) => {
            setFeatureDurationsMs((currentDurations) => {
              if (currentDurations[featureId] === durationMs) {
                return currentDurations;
              }

              return {
                ...currentDurations,
                [featureId]: durationMs,
              };
            });
          }}
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
        <span
          className="text-[2rem] leading-none tracking-[-0.05em] text-[var(--website-ink)]"
          style={{ fontFamily: displayFont }}
        >
          Rekna
        </span>
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
  downloadVariants,
  getFeatureCycleDuration,
  usesTimedFeatureCycle,
  onFeatureAdvance,
  onFeatureDurationChange,
  onFeatureSelect,
}: {
  activeFeature: FeatureDefinition;
  activeFeatureIndex: number;
  downloadVariants: DownloadVariant[];
  getFeatureCycleDuration: (featureId: string) => number;
  usesTimedFeatureCycle: boolean;
  onFeatureAdvance: () => void;
  onFeatureDurationChange: (featureId: string, durationMs: number) => void;
  onFeatureSelect: (nextIndex: number) => void;
}) {
  const featureVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [featureProgressRatios, setFeatureProgressRatios] = useState<
    Record<string, number>
  >({});

  const updateFeatureProgressRatio = (featureId: string, progress: number) => {
    const nextProgress = clampUnitInterval(progress);

    setFeatureProgressRatios((currentProgressRatios) => {
      if (currentProgressRatios[featureId] === nextProgress) {
        return currentProgressRatios;
      }

      return {
        ...currentProgressRatios,
        [featureId]: nextProgress,
      };
    });
  };

  const syncFeatureProgressRatio = (
    featureId: string,
    video: HTMLVideoElement
  ) => {
    const durationSeconds = video.duration;

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      updateFeatureProgressRatio(featureId, 0);
      return;
    }

    updateFeatureProgressRatio(featureId, video.currentTime / durationSeconds);
  };

  useEffect(() => {
    homepageFeatures.forEach((feature) => {
      const video = featureVideoRefs.current[feature.id];

      if (!usesTimedFeatureCycle) {
        updateFeatureProgressRatio(feature.id, 0);
      }

      if (!video) {
        return;
      }

      if (feature.id === activeFeature.id) {
        try {
          video.currentTime = 0;
        } catch {
          // Ignore seek errors until metadata is ready.
        }

        const playAttempt = video.play();

        if (playAttempt && typeof playAttempt.catch === "function") {
          void playAttempt.catch(() => undefined);
        }

        if (!usesTimedFeatureCycle) {
          syncFeatureProgressRatio(feature.id, video);
        }
        return;
      }

      video.pause();

      try {
        video.currentTime = 0;
      } catch {
        // Ignore seek errors until metadata is ready.
      }
    });
  }, [activeFeature.id, usesTimedFeatureCycle]);

  return (
    <div className="flex flex-1 flex-col gap-14 py-10 lg:gap-20 lg:py-14">
      <section className="grid items-center gap-12 lg:grid-cols-[minmax(20rem,21rem)_minmax(0,1fr)] lg:gap-20">
        <div
          className="mx-auto flex w-full max-w-[21rem] flex-col justify-center lg:mx-0 lg:min-h-[36rem]"
          data-testid="feature-column"
        >
          <h1
            className="text-5xl leading-[0.9] tracking-[-0.06em] sm:text-6xl"
            style={{ fontFamily: displayFont }}
          >
            Rekna
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--website-muted)]">
            A beautiful open-source calculator that lives in markdown files and
            keeps you in flow.
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
                const featureCycleDurationMs = getFeatureCycleDuration(
                  feature.id
                );
                const featureProgressRatio = isActive
                  ? featureProgressRatios[feature.id] ?? 0
                  : 0;

                return (
                  <button
                    aria-label={feature.title}
                    aria-pressed={isActive}
                    className={`group relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[1rem] border pt-4 pb-3 text-center transition-[transform,border-color,background-color,color,box-shadow] duration-200 ${
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
                      className="block min-w-0 px-4 text-[1.35rem] leading-7 tracking-[-0.03em] text-current sm:text-[1.5rem]"
                      data-testid={`feature-tab-title-${feature.id}`}
                    >
                      {feature.title}
                    </span>
                    <span
                      aria-hidden="true"
                      className="block w-full px-4"
                    >
                      <span
                        className={`block h-[3px] w-full overflow-hidden rounded-full ${
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
                            ...(usesTimedFeatureCycle
                              ? {
                                  animationDuration: `${featureCycleDurationMs}ms`,
                                  animationFillMode: "forwards",
                                  animationName:
                                    isActive && featureCycleDurationMs > 0
                                      ? "websiteFeatureProgress"
                                      : "none",
                                  animationTimingFunction: "linear",
                                }
                              : {
                                  transform: `scaleX(${featureProgressRatio})`,
                                  transition: "transform 120ms linear",
                                }),
                          }}
                        />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="relative min-h-0 lg:self-center">
          <div
            className="relative flex items-center justify-center"
            data-feature={activeFeature.id}
            data-testid="feature-media"
          >
            <div
              className="relative mx-auto aspect-[1076/960] h-[22rem] max-w-full sm:h-[27rem] lg:h-[35rem]"
              data-testid="feature-video-shell"
            >
              {homepageFeatures.map((feature) => {
                const isActive = feature.id === activeFeature.id;

                return (
                  <motion.div
                    animate={{
                      filter: isActive ? "blur(0px)" : "blur(10px)",
                      opacity: isActive ? 1 : 0,
                      scale: isActive ? 1 : 0.985,
                    }}
                    className={`absolute inset-0 flex items-center justify-center ${
                      isActive ? "" : "pointer-events-none"
                    }`}
                    data-active={isActive ? "true" : "false"}
                    data-testid={`feature-video-layer-${feature.id}`}
                    initial={false}
                    key={feature.id}
                    transition={{
                      duration: 0.55,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <video
                      aria-hidden={isActive ? "false" : "true"}
                      autoPlay={isActive}
                      className="block h-full w-auto max-w-full rounded-[1.35rem] shadow-[0_30px_80px_-42px_rgba(0,0,0,0.7)]"
                      data-active={isActive ? "true" : "false"}
                      data-testid={`feature-video-${feature.id}`}
                      disablePictureInPicture
                      muted
                      onEnded={() => {
                        if (!usesTimedFeatureCycle) {
                          updateFeatureProgressRatio(feature.id, 1);
                        }

                        if (!usesTimedFeatureCycle && isActive) {
                          onFeatureAdvance();
                        }
                      }}
                      onLoadedMetadata={(event) => {
                        const durationSeconds = event.currentTarget.duration;

                        if (
                          Number.isFinite(durationSeconds) &&
                          durationSeconds > 0
                        ) {
                          onFeatureDurationChange(
                            feature.id,
                            Math.round(durationSeconds * 1000)
                          );
                        }

                        if (!usesTimedFeatureCycle) {
                          syncFeatureProgressRatio(
                            feature.id,
                            event.currentTarget
                          );
                        }
                      }}
                      onTimeUpdate={(event) => {
                        if (!usesTimedFeatureCycle && isActive) {
                          syncFeatureProgressRatio(
                            feature.id,
                            event.currentTarget
                          );
                        }
                      }}
                      playsInline
                      preload="auto"
                      ref={(node) => {
                        featureVideoRefs.current[feature.id] = node;
                      }}
                      src={feature.videoSrc}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <HomepageTestimonials />
      <HomepageDownloadSection downloadVariants={downloadVariants} />
    </div>
  );
}

function clampUnitInterval(value: number) {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
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

function HomepageDownloadSection({
  downloadVariants,
}: {
  downloadVariants: DownloadVariant[];
}) {
  const macVariant = downloadVariants[0]!;

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
              macOS (Apple Silicon)
            </p>
            <div className="inline-flex max-w-full overflow-hidden rounded-full border border-[color-mix(in_oklab,var(--website-line)_72%,var(--website-accent)_28%)] bg-[var(--website-surface)] shadow-[0_18px_48px_-34px_rgba(0,0,0,0.55)]">
              <Button
                asChild
                className="h-10 rounded-none border-0 bg-[var(--website-accent)] px-5 text-[0.76rem] uppercase tracking-[0.14em] text-[var(--website-bg)] hover:bg-[color-mix(in_oklab,var(--website-accent)_86%,black_14%)]"
                size="lg"
              >
                <a data-testid="download-cta" href={macVariant.href}>
                  {`Download for ${macVariant.label}`}
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
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

function buildDownloadVariants(assets?: DesktopReleaseAsset[]) {
  return sharedDesktopDownloadVariants.map((variant) => ({
    href: resolveDesktopDownloadUrl(variant.id, assets),
    label: variant.label,
    note: variant.note,
  }));
}

async function loadDownloadVariants() {
  if (typeof globalThis.fetch !== "function") {
    return fallbackDownloadVariants;
  }

  const response = await globalThis.fetch(REKNA_GITHUB_LATEST_RELEASE_API_URL);

  if (!response.ok) {
    return fallbackDownloadVariants;
  }

  const release = (await response.json()) as {
    assets?: DesktopReleaseAsset[];
  };

  return buildDownloadVariants(
    Array.isArray(release.assets) ? release.assets : undefined
  );
}

