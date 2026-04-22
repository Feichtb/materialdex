import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   MATERIALDEX — STORY ALTERNATIVE
   Lottie: npm install @lottiefiles/dotlottie-react
═══════════════════════════════════════════════════════════════ */

/* ─── Design Tokens ──────────────────────────────────────────── */
const T = {
  mono:     "'Courier New', monospace",
  serif:    "Georgia, 'Times New Roman', serif",
  /* Accent for decorative elements (rules, borders, progress bars) */
  accent:   "#D4915E",
  /* Accessible amber text on light bg — ~5.4:1 contrast vs #F7F5F0 */
  accentTx: "#8B5830",
  bg:       "#F7F5F0",
  bgAlt:    "#F0EDE7",
  /* High-contrast body text — ~8:1 vs #F7F5F0 */
  ink:      "#1A1814",
  inkMid:   "rgba(26,24,20,0.80)",
  /* Decorative-only — below 4.5:1, do not use for informational text */
  inkFaint: "rgba(26,24,20,0.32)",
  rule:     "rgba(26,24,20,0.10)",
  green:    "#3A6B28",
  red:      "#B83020",
};

/* ─── Hooks ──────────────────────────────────────────────────── */
function useInView(ref, threshold = 0.15) {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setV(true); },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return v;
}

function useScrollProgress(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const num = window.scrollY - (r.top + window.scrollY - window.innerHeight);
      const den = r.bottom - r.top + window.innerHeight;
      setP(Math.min(1, Math.max(0, num / den)));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, [ref]);
  return p;
}

/* Count from 0 to target when started; resets and re-animates each time started toggles true */
function useCountUp(target, duration, started) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!started) { setCount(0); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [started, target, duration]);
  return count;
}

/* ─── Shared Primitives ──────────────────────────────────────── */
const SectionLabel = ({ children }) => (
  <div style={{ marginBottom: 36 }}>
    <span style={{
      fontFamily: T.mono, fontSize: 14, letterSpacing: 3,
      textTransform: "uppercase", color: T.accentTx,
      display: "block", lineHeight: 1.5,
    }}>{children}</span>
    <div style={{ height: 1, background: T.rule, marginTop: 10 }} />
  </div>
);

const Prose = ({ children, style }) => (
  <p style={{
    fontFamily: T.serif, fontSize: 17, color: T.inkMid,
    lineHeight: 1.82, margin: "0 0 22px", ...style,
  }}>{children}</p>
);

const Wrap = ({ children, alt, style }) => (
  <section style={{ padding: "100px 20px", background: alt ? T.bgAlt : T.bg, ...style }}>
    <div style={{ maxWidth: 680, margin: "0 auto" }}>{children}</div>
  </section>
);

function FadeIn({ children, delay = 0, style }) {
  const ref = useRef(null);
  const v = useInView(ref);
  return (
    <div ref={ref} style={{
      opacity: v ? 1 : 0,
      transform: v ? "none" : "translateY(26px)",
      transition: `opacity 0.8s ${delay}ms cubic-bezier(0.16,1,0.3,1),
                   transform 0.8s ${delay}ms cubic-bezier(0.16,1,0.3,1)`,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─── Stat item — invisible until its turn, re-animates each entry ─ */
function StatItem({ value, suffix, label, started }) {
  const count = useCountUp(value, 1200, started);
  return (
    <div style={{
      flex: "1 1 140px", textAlign: "center", padding: "28px 16px",
      opacity: started ? 1 : 0,
      transform: started ? "none" : "translateY(10px)",
      transition: "opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <p style={{
        fontFamily: T.serif, fontSize: 46, color: T.accentTx,
        fontWeight: 400, margin: "0 0 8px", lineHeight: 1,
      }}>{count}{suffix}</p>
      <p style={{
        fontFamily: T.serif, fontSize: 14, color: T.inkMid,
        margin: 0, lineHeight: 1.5,
      }}>{label}</p>
    </div>
  );
}

/* ─── Lottie scroll-scrub with multiply blend ────────────────── */
/* progress 0-1 drives the playhead. White canvas bg disappears   */
/* via mixBlendMode multiply on the paper background.             */
function LottieScrollScrub({ src, progress }) {
  const [Comp, setComp] = useState(null);
  const dlRef = useRef(null);
  const loadedRef = useRef(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    import("@lottiefiles/dotlottie-react")
      .then((m) => setComp(() => m.DotLottieReact))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const dl = dlRef.current;
    if (!dl || !loadedRef.current || !dl.totalFrames) return;
    dl.setFrame(Math.round(progress * (dl.totalFrames - 1)));
  }, [progress]);

  const onRef = useCallback((dl) => {
    dlRef.current = dl;
    if (!dl) return;
    dl.addEventListener("load", () => {
      loadedRef.current = true;
      /* Let the renderer paint at least one frame before pausing.
         requestAnimationFrame ensures the canvas has initialized,
         which is critical for image-based .lottie files (e.g. brick). */
      requestAnimationFrame(() => {
        dl.pause();
        dl.setFrame(Math.round(progressRef.current * (dl.totalFrames - 1)));
      });
    });
  }, []);

  if (!Comp) {
    return (
      <div style={{
        width: "100%", height: "100%",
        background: T.rule, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 2 }}>
          {src.split("/").pop().replace(".lottie", "").toUpperCase()}
        </p>
      </div>
    );
  }

  return (
    /* .lottie-scrub canvas targets the canvas element directly so mix-blend-mode
       composites against the page background, not a sticky stacking context. */
    <div className="lottie-scrub" style={{ width: "100%", height: "100%", lineHeight: 0 }}>
      <Comp
        src={src}
        autoplay={true}
        loop={false}
        dotLottieRefCallback={onRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}

/* ═══ SECTION: HERO ══════════════════════════════════════════════ */
function Hero() {
  const ref = useRef(null);
  const p = useScrollProgress(ref);
  /* Track raw scrollY so the indicator is fully visible at page-load
     (section-relative `p` starts at ~0.36, making opacity already 0). */
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <section ref={ref} style={{ minHeight: "175vh", position: "relative", background: T.bg }}>
      <div style={{
        position: "sticky", top: 0, height: "100vh",
        display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "0 32px", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${T.rule} 1px, transparent 1px),
                            linear-gradient(90deg, ${T.rule} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          opacity: Math.min(1, p * 3),
        }} />

        <div style={{ maxWidth: 680, position: "relative", zIndex: 1 }}>
          <h1 style={{
            fontFamily: T.serif,
            fontSize: "clamp(40px, 7.5vw, 76px)",
            fontWeight: 400, fontStyle: "italic",
            color: T.ink, lineHeight: 1.13, margin: 0,
            opacity: Math.min(1, p * 3.5),
            transform: `translateY(${Math.max(0, 32 - p * 120)}px)`,
          }}>
            How Do Architects Know They're Choosing the Right Materials?
          </h1>

          <div style={{
            width: 40, height: 1, background: T.accent, margin: "28px 0",
            opacity: Math.min(1, (p - 0.06) * 6),
            transform: `scaleX(${Math.min(1, (p - 0.05) * 5)})`,
            transformOrigin: "left",
          }} />

          <div style={{
            opacity: Math.min(1, (p - 0.1) * 5),
            transform: `translateY(${Math.max(0, 16 - (p - 0.08) * 70)}px)`,
          }}>
            <p style={{
              fontFamily: T.serif, fontSize: 15, color: T.inkMid,
              lineHeight: 1.65, margin: "0 0 12px",
            }}>
              Sustainable material selection is harder for architects than it should be. I built a free Revit plugin to help fix that, and here's how I made it.
            </p>
            <a href="#download" style={{
              fontFamily: T.mono, fontSize: 11, letterSpacing: 2,
              color: T.accentTx, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 7,
            }}>
              SKIP TO TRY MATERIALDEX <span style={{ fontSize: 15, lineHeight: 1 }}>↓</span>
            </a>
          </div>
        </div>

        <div style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          opacity: Math.max(0, 1 - scrollY / 120),
        }}>
          <div style={{ width: 1, height: 32, background: `linear-gradient(transparent, ${T.inkFaint})` }} />
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 2.5, margin: 0, whiteSpace: "nowrap" }}>
            SCROLL TO EXPLORE
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══ SECTION: ORIGIN ════════════════════════════════════════════ */
function Origin() {
  const constraints = [
    "I wanted to hit net-zero energy, which meant an air tight envelope and materials optimized for thermal performance.",
    "I wanted low embodied carbon.",
    "I wanted local materials to minimize emissions from material transportation.",
    "And I wanted the project to be suitable for construction methods familiar to local builders, since I was limited in how many site visits I could make to review the construction.",
  ];
  return (
    <Wrap>
      <FadeIn>
        <Prose>
          I asked myself this question when I was designing my first house project on my own.
          At first I did what most architects do, and select materials I had worked with
          before, such as wood framing, standing seam metal roof, and fiber cement siding.
          I had seen them go in before, and seen them perform, so I trusted these materials.
        </Prose>
      </FadeIn>
      <FadeIn delay={90}>
        <Prose>
          But being familiar with a material doesn't mean it's the best choice for this
          project, in this climate, from suppliers available here. And what does "best" even
          mean? For this house, I had a list of constraints that competed with each other:
        </Prose>
      </FadeIn>
      <FadeIn delay={170}>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 12 }}>
          {constraints.map((c, i) => (
            <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ color: T.accent, fontFamily: T.mono, fontSize: 14, lineHeight: 1.8, flexShrink: 0 }}>•</span>
              <span style={{ fontFamily: T.serif, fontSize: 16, color: T.inkMid, lineHeight: 1.8 }}>{c}</span>
            </li>
          ))}
        </ul>
      </FadeIn>
      <FadeIn delay={250}>
        <Prose>
          That's a lot of constraints for each material to satisfy, and I was picking
          materials the way most architects do, from memory and habit not from a systematic
          search of what actually existed.
        </Prose>
      </FadeIn>
    </Wrap>
  );
}

/* ═══ SECTION: WHY IT MATTERS ════════════════════════════════════
   Stats: invisible until triggered, count up one at a time,
   re-animate every time the section enters the viewport.
══════════════════════════════════════════════════════════════════ */
function WhyItMatters() {
  const containerRef = useRef(null);
  const [startedIdx, setStartedIdx] = useState(-1);
  const timerRefs = useRef([]);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      /* Clear any in-flight timers first */
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
      if (e.isIntersecting) {
        setStartedIdx(0);
        timerRefs.current = [
          setTimeout(() => setStartedIdx(1), 1400),
          setTimeout(() => setStartedIdx(2), 2800),
        ];
      } else {
        setStartedIdx(-1);
      }
    }, { threshold: 0.35 });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => { obs.disconnect(); timerRefs.current.forEach(clearTimeout); };
  }, []);

  return (
    <Wrap alt>
      <FadeIn><SectionLabel>Why This Matters</SectionLabel></FadeIn>
      <FadeIn delay={80}>
        <Prose style={{ fontSize: 20, color: T.ink, lineHeight: 1.45, marginBottom: 30 }}>
          Material selection actually has a huge impact on carbon emissions.
        </Prose>
      </FadeIn>

      <div ref={containerRef} style={{
        display: "flex", flexWrap: "wrap",
        borderTop: `1px solid ${T.rule}`,
        borderBottom: `1px solid ${T.rule}`,
        margin: "8px 0 36px",
      }}>
        <StatItem value={40}  suffix="%" label="of global CO2 from buildings"      started={startedIdx >= 0} />
        <StatItem value={11}  suffix="%" label="from building materials alone"      started={startedIdx >= 1} />
        <StatItem value={500} suffix="+" label="avg miles a material travels"       started={startedIdx >= 2} />
      </div>

      <FadeIn delay={160}>
        <Prose>
          The construction industry is one of the largest sources of carbon emissions on
          Earth, and a significant share comes from the materials themselves, including their
          extraction, manufacturing, and transportation. Many materials travel hundreds of
          miles from factory to site, even when closer alternatives exist.
        </Prose>
      </FadeIn>
      <FadeIn delay={240}>
        <Prose>
          What surprised me was that later in the design process for this house, when I was
          picking which insulation types, sealants, or exterior cladding, even seemingly
          similar materials had drastically different environmental impacts:
        </Prose>
      </FadeIn>
    </Wrap>
  );
}

/* ═══ SECTION: MATERIAL SURPRISE (Lottie) ═══════════════════════
   Panels: Dimensional Lumber, Insulation, Sheathing, Sealants.
   Lumber + Insulation share the insulation animation, split 0–50% / 50–100%.
   Animation begins only once the sticky div is centred on screen.
   Page height prevents scrolling past until all panels complete.
══════════════════════════════════════════════════════════════════ */
function MaterialSurprise() {
  const ref = useRef(null);
  const rawP = useScrollProgress(ref);

  /* pStart = fraction of rawP at which the sticky div reaches top of viewport.
     Below pStart the section is still scrolling into view — no animation. */
  const pStartRef = useRef(0);
  useEffect(() => {
    const compute = () => {
      if (!ref.current) return;
      const sH = ref.current.offsetHeight;
      const vh = window.innerHeight;
      pStartRef.current = vh / (sH + vh);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  /* Remap rawP so p=0 when sticky div is centred and p=1 when it exits */
  const pS = pStartRef.current;
  const stickyRange = Math.max(0.01, 1 - 2 * pS);
  const p = Math.max(0, Math.min(1, (rawP - pS) / stickyRange));

  const panels = [
    {
      src:       "animations/Animation_insulation.lottie",
      label:     "Dimensional Lumber",
      animStart: 0,
      animEnd:   0.5,
      fact:      "Only about 10% of U.S. timber harvest carries FSC certification. Dimensional framing lumber in a standard specification has no chain-of-custody documentation attached. The forest of origin, harvesting practices, and carbon sequestered in those studs are invisible. FSC and SFI certification are the only third-party labels that change that.",
    },
    {
      src:       "animations/Animation_insulation.lottie",
      label:     "Insulation",
      animStart: 0.5,
      animEnd:   1,
      fact:      "Legacy XPS rigid foam has 40x the climate impact of mineral wool at the same R-value. Nearly half of that warming doesn't come from making it. It comes from a blowing agent gas that leaks silently out of the foam over the next 75 years.",
    },
    {
      src:       "animations/Animation_sheathing.lottie",
      label:     "Sheathing",
      animStart: 0,
      animEnd:   1,
      fact:      "OSB from a sustainably certified mill and uncertified OSB look identical in your model and on a construction drawing. The environmental difference only shows up if you go looking for the manufacturer's third-party documentation.",
    },
    {
      src:       "animations/Animation_sealants.lottie",
      label:     "Sealants",
      animStart: 0,
      animEnd:   1,
      fact:      "Fewer than 5% of construction adhesives and sealants have published Health Product Declarations. The ingredients bonding a building's envelope, the layer occupants breathe near for 50 years, are largely undisclosed. You can read every ingredient in your breakfast cereal, but not in the caulk sealing your windows.",
    },
  ];

  const segSize = 1 / panels.length;
  const idx = Math.min(panels.length - 1, Math.floor(p * panels.length));
  const panelProgress = (i) => Math.min(1, Math.max(0, (p - i * segSize) / segSize));
  /* Map panel's 0–1 progress through its animStart/animEnd window */
  const mappedProgress = (i) => {
    const pp = panelProgress(i);
    const { animStart = 0, animEnd = 1 } = panels[i];
    return animStart + pp * (animEnd - animStart);
  };

  return (
    <section
      ref={ref}
      /* Height: each panel gets 120vh of scroll distance */
      style={{ minHeight: `${panels.length * 120}vh`, position: "relative", background: "#ffffff" }}
    >
      <div style={{
        position: "sticky", top: 0, height: "100vh",
        display: "flex", flexDirection: "column",
        /* flex-start so labels are never clipped at the top on small/landscape screens.
           paddingTop simulates centering on desktop (calc resolves to ~(50vh - half content))
           but collapses to 0 when the viewport is too short to center without clipping. */
        justifyContent: "flex-start", alignItems: "center",
        paddingTop: "max(0px, calc(50vh - 325px))",
        overflow: "hidden",
      }}>
        {/* Label + category row */}
        <div style={{ width: "100%", maxWidth: 720, padding: "0 32px", marginBottom: 16 }}>
          <SectionLabel>What I Didn't Know I Didn't Know</SectionLabel>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {panels.map((panel, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 7,
                opacity: i === idx ? 1 : 0.45,
                transition: "opacity 0.4s",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i === idx ? T.accentTx : T.inkFaint,
                  transition: "background 0.4s",
                }} />
                <span style={{
                  fontFamily: T.mono, fontSize: 11, letterSpacing: 2,
                  textTransform: "uppercase",
                  color: i === idx ? T.ink : T.inkMid,
                  transition: "color 0.4s",
                }}>{panel.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stacked animation canvases — capped by both vw and vh so nothing overflows on landscape */}
        <div style={{
          position: "relative",
          width: "min(340px, 78vw)",
          height: "min(255px, 58vw, 38vh)",
          flexShrink: 0,
        }}>
          {panels.map((panel, i) => (
            <div key={i} style={{
              position: "absolute", inset: 0,
              opacity: i === idx ? 1 : 0,
              transition: "opacity 0.7s cubic-bezier(0.16,1,0.3,1)",
              pointerEvents: i === idx ? "auto" : "none",
              background: "transparent",
            }}>
              <LottieScrollScrub src={panel.src} progress={mappedProgress(i)} />
            </div>
          ))}
        </div>

        {/* Full-width fact text — minHeight tall enough for the longest panel text on mobile */}
        <div style={{
          width: "100%", maxWidth: 720, padding: "0 32px",
          position: "relative", minHeight: "clamp(120px, 22vh, 180px)", marginTop: 20,
        }}>
          {panels.map((panel, i) => (
            <p key={i} style={{
              position: "absolute", top: 0, left: 32, right: 32,
              fontFamily: T.serif,
              fontSize: "clamp(15px, 2.2vw, 20px)",
              color: T.ink, lineHeight: 1.65, margin: 0,
              opacity: i === idx ? 1 : 0,
              transform: i === idx ? "none" : i < idx ? "translateY(-12px)" : "translateY(12px)",
              transition: "opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1)",
            }}>{panel.fact}</p>
          ))}
        </div>

        {/* Progress + scroll label — extra top gap so they sit clearly below the fact paragraph */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: "clamp(28px, 5vh, 48px)" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {panels.map((_, i) => (
              <div key={i} style={{
                height: 3, borderRadius: 2,
                width: i === idx ? 24 : 8,
                background: i === idx ? T.accent : T.rule,
                transition: "width 0.35s, background 0.35s",
              }} />
            ))}
          </div>
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 2.5, margin: 0 }}>
            SCROLL TO EXPLORE
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══ SECTION: LEED EXPERIENCE ═══════════════════════════════════ */
function LEEDExperience() {
  const [flipped, setFlipped] = useState(null);

  const docs = [
    {
      name:  "Environmental Product Declaration",
      color: "#D4E8F5",
      front: "A verified lifecycle footprint of a product, cradle to grave.",
      back:  "EPDs measure embodied carbon, energy use, and waste across a product's full life, third-party verified to ISO 14025. Without one, you're estimating a product's climate impact from marketing materials rather than measured data.",
      url:   "https://www.environdec.com",
      urlLabel: "environdec.com",
    },
    {
      name:  "Health Product Declaration",
      color: "#F5E4D4",
      front: "Full ingredient disclosure of what's actually in the material.",
      back:  "HPDs require disclosure of every ingredient above 100 ppm, screened against health hazard lists including GreenScreen and IARC. They reveal what occupants will live near for decades. Many common finishes have never published one.",
      url:   "https://www.hpd-collaborative.org",
      urlLabel: "hpd-collaborative.org",
    },
    {
      name:  "Declare Label",
      color: "#D4F0D8",
      front: "Third party transparency for building products.",
      back:  "Declare is the nutrition label for building materials. Products are independently screened against the Living Building Challenge Red List. If a product has a Declare label, a third party has verified what's inside it.",
      url:   "https://www.living-future.org/declare/",
      urlLabel: "living-future.org/declare",
    },
  ];

  return (
    <>
      {/* Bridge paragraph — minimal top gap so it reads as part of the lottie section above */}
      <section style={{ padding: "52px 20px 0", background: T.bg }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <FadeIn>
            <Prose>
              I know when I specified materials for this house, I did not do extensive research
              on the environmental impacts on each material. I took materials that I've heard are
              good sustainable options, but for example I had no idea about the impact of XPS
              insulation for insulated basement spaces compared to other options.
            </Prose>
          </FadeIn>
        </div>
      </section>

      {/* Main section — normal spacing creates the visual break before "My Experience" */}
      <Wrap>
        <FadeIn delay={80}><SectionLabel>My Experience In Speccing Sustainable Materials</SectionLabel></FadeIn>

        <FadeIn delay={140}>
          <Prose>
            My experience in specifying sustainable materials mainly comes from working on LEED
            certified projects. Pursing material credits for LEED meant I would spend hours
            tracking down third party sustainability documentation for dozens of specified
            building products. And often finding new products we could use in the project that
            meet LEED's documentation requirements. Three major document types that LEED and
            Living Building Challenge require are:
          </Prose>
        </FadeIn>

        {/* Flip cards — playing card ratio, solid colors */}
        <FadeIn delay={220}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "4px 0 32px", alignItems: "flex-start", justifyContent: "center" }}>
            {docs.map((doc, i) => (
              <div key={i} style={{ flex: "1 1 180px", maxWidth: 240, minWidth: 160 }}>
                {/* paddingBottom 140% = playing card 5:7 ratio */}
                <div style={{ width: "100%", paddingBottom: "140%", position: "relative" }}>
                  <div
                    onClick={() => setFlipped(flipped === i ? null : i)}
                    style={{ position: "absolute", inset: 0, cursor: "pointer" }}
                  >
                    <div style={{
                      width: "100%", height: "100%", position: "relative",
                      transformStyle: "preserve-3d",
                      WebkitTransformStyle: "preserve-3d",
                      transform: flipped === i ? "rotateY(180deg)" : "rotateY(0deg)",
                      transition: "transform 0.58s cubic-bezier(0.4,0,0.2,1)",
                    }}>
                      {/* Front */}
                      <div style={{
                        position: "absolute", inset: 0,
                        backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                        background: doc.color, borderRadius: 8, padding: "22px 20px",
                        display: "flex", flexDirection: "column",
                      }}>
                        <p style={{
                          fontFamily: T.serif, fontSize: 18, fontStyle: "italic",
                          color: T.ink, lineHeight: 1.2, margin: "0 0 16px",
                        }}>{doc.name}</p>
                        <p style={{
                          fontFamily: T.serif, fontSize: 14, color: T.inkMid,
                          lineHeight: 1.6, flex: 1, margin: 0,
                        }}>{doc.front}</p>
                        <p style={{
                          fontFamily: T.mono, fontSize: 10, color: T.inkMid,
                          letterSpacing: 0.5, margin: "14px 0 0",
                        }}>Tap to flip</p>
                      </div>
                      {/* Back */}
                      <div style={{
                        position: "absolute", inset: 0,
                        backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                        background: doc.color, borderRadius: 8, padding: "22px 20px",
                        display: "flex", flexDirection: "column",
                        transform: "rotateY(180deg)",
                      }}>
                        <p style={{
                          fontFamily: T.serif, fontSize: 13.5, color: T.inkMid,
                          lineHeight: 1.65, flex: 1, margin: 0,
                        }}>{doc.back}</p>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontFamily: T.mono, fontSize: 10, color: T.accentTx,
                            letterSpacing: 0.5, marginTop: 14, display: "block",
                            textDecoration: "none",
                          }}
                        >{doc.urlLabel}</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={300}>
          <Prose>
            Finding these certifications for products you want to use can be an ordeal. Some
            are listed in databases, and others are hidden in the manufacturer websites. And
            other manufacturer websites have sustainability pages that list aspects of the
            product that sound great but aren't actually certified or comprehensive.
          </Prose>
        </FadeIn>
      </Wrap>
    </>
  );
}

/* ═══ SECTION: AFTER THE HOUSE ══════════════════════════════════ */
function AfterTheHouse() {
  return (
    <Wrap alt>
      <FadeIn>
        <Prose>
          After I completed the house project, I was happy with the materials I had selected,
          but I was less happy about the material process. The house ended up being Net-0
          energy, with the lowest blower door rating the contractor had seen, and most
          importantly happy clients! But I wanted to find a better way of finding the best
          materials for the specific project.
        </Prose>
      </FadeIn>
    </Wrap>
  );
}

/* ═══ SECTION: AI IDEA ═══════════════════════════════════════════ */
function AIIdea() {
  return (
    <Wrap>
      <FadeIn><SectionLabel>What If AI Could Do the Material Research For You?</SectionLabel></FadeIn>
      <FadeIn delay={80}>
        <Prose>
          I realized that my Revit model already contained every material on the project, as
          well as data about the climate and region the project is in, so I made a plugin for
          Revit that links this data with an AI researcher that can recommend materials
          specific for that project.
        </Prose>
      </FadeIn>
      <FadeIn delay={160}>
        <Prose>
          For each generic material in your model, it suggests specific real world products
          near your project location, with links to verified third party documentation: EPDs,
          HPDs, and Declare labels that certification programs actually require.
        </Prose>
      </FadeIn>
      <FadeIn delay={240}>
        <Prose>
          I also added a way to tell the system about your project's specific goals. For
          example, on the house project I had told it I wanted to focus on materials that
          craftspeople in the region are used to working with.
        </Prose>
      </FadeIn>
    </Wrap>
  );
}

/* ═══ SECTION: WHAT I LEARNED ════════════════════════════════════ */
function WhatILearned() {
  return (
    <Wrap alt>
      <FadeIn><SectionLabel>What I Learned</SectionLabel></FadeIn>
      <FadeIn delay={80}>
        <Prose>
          For nearly every material category, Materialdex surfaced products I hadn't
          considered before, but met the project goals. I found that its results let me
          choose from verified options as a baseline, shifting the question from "what
          materials exist?" to "which of these good options fits my project best?"
        </Prose>
      </FadeIn>
      <FadeIn delay={160}>
        <Prose>
          I also found mistakes pop up. I was seeing HPD documentation for New Zealand even
          though my project was in the United States. I was also seeing occasionally outdated
          manufacturer website links, and results that didn't include documentation that I
          knew was available online. As an AI based tool, any results aren't replacements for
          professional judgement, but they can act as a starting point to dramatically expand
          your search radius for material selection.
        </Prose>
      </FadeIn>
    </Wrap>
  );
}

/* ═══ SECTION: DEMO ══════════════════════════════════════════════ */

/* Colors mirroring the actual Materialdex app (warm parchment theme) */
const APP = {
  bg:      "#F7F5F0",
  panel:   "#FDFCFA",
  dark:    "#F0EDE7",
  border:  "#DDD8CF",
  text:    "#1A1814",
  primary: "#8B5830",
  success: "#3A6B28",
  error:   "#B83020",
  accent:  "#D4915E",
};

const DOC_COLORS = {
  epd:     { bg: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  hpd:     { bg: "#dbeafe", text: "#1e3a8a", border: "#bfdbfe" },
  declare: { bg: "#f3e8ff", text: "#4c1d95", border: "#e9d5ff" },
  voc:     { bg: "#cffafe", text: "#164e63", border: "#a5f3fc" },
};

const BADGE_LABELS = { epd: "EPD", hpd: "HPD", declare: "Declare", voc: "VOC" };

const DEMO_MATERIALS = [
  {
    name: "Mineral wool batt insulation",
    qty: "800 cf",
    products: [
      {
        name: "Comfortbatt®",
        manufacturer: "ROCKWOOL North America",
        productUrl: "https://www.rockwool.com/north-america/products/comfortbatt/",
        rationale: "Stone wool batt with EPD, HPD, Declare, and GREENGUARD Gold all verified from primary sources. Non-combustible, vapor-open, and moisture-tolerant with zero formaldehyde. Manufactured in Milton, Ontario.",
        docs: {
          epd:     { found: true,  url: "https://www.rockwool.com/group/about-us/sustainability/life-cycle-assessments-and-environmental-product-declarations-at-rockwool/" },
          hpd:     { found: true,  url: "https://hpdrepository.hpd-collaborative.org/repository/HPDs/941_ROCKWOOL_COMFORTBATT_Stone_Wool_Insulation_Interior_Products_Unfaced_.pdf" },
          declare: { found: true,  url: "https://declare.living-future.org/products/stone-wool-interior-products-unfaced-afb-comfortbatt-rockboard-safensound" },
          voc:     { found: true,  url: "https://www.rockwool.com/siteassets/o2-rockwool/documentation/technical-bulletins/commercial/ul-greenguard-certification-program.pdf" },
        },
      },
      {
        name: "Thermafiber® UltraBatt™",
        manufacturer: "Owens Corning",
        productUrl: "https://www.owenscorning.com/en-us/insulation/commercial/formaldehyde-free",
        rationale: "Formaldehyde-free mineral wool with EPD, HPD, Declare, and GREENGUARD Gold all verified. High recycled content.",
        docs: {
          epd:     { found: true,  url: "https://transparencycatalog.com/assets/uploads/pdf/EPD_Thermafiber_Formaldehyde_Free_Mineral_Wool_Owens_Corning.pdf" },
          hpd:     { found: true,  url: "https://hpdrepository.hpd-collaborative.org/repository/HPDs/publish_446_Thermafiber_UltraBatt_Mineral_Wool_Insulation.pdf" },
          declare: { found: true,  url: "https://declare.living-future.org/products/thermafiber-mineral-wool-insulation-formaldehyde-free-faced" },
          voc:     { found: true,  url: "https://www.buildsite.com/pdf/owenscorning/Thermafiber-UltraBatt-FF-Formaldehyde-Free-Mineral-Wool-Insulation-Product-Data-2078943.pdf" },
        },
      },
      {
        name: "Sustainable Insulation™",
        manufacturer: "CertainTeed",
        productUrl: "https://www.certainteed.com/products/building-insulation-products/sustainable-insulation",
        rationale: "Fiber glass batt alternative — EPD and HPD both verified from primary sources. GREENGUARD Gold certified. No Declare label found in this scan.",
        docs: {
          epd:     { found: true,  url: "https://www.buildsite.com/pdf/certainteed/Sustainable-Insulation-Fiber-Glass-Building-Insulation-Environmentally-Responsive-Documentation-2263236.pdf" },
          hpd:     { found: true,  url: "https://hpdrepository.hpd-collaborative.org/repository/HPDs/41_CertainTeed_Sustainable_Insulation_Unfaced_Fiber_Glass_Batt_and_Blanket_Manufactured_in_Kansas_City_KS.pdf" },
          declare: { found: false, url: null },
          voc:     { found: true,  url: "https://www.buildsite.com/pdf/certainteed/CertainTeed-Fiber-Glass-Insulation-Greenguard-Certified-Environmentally-Responsive-Documentation-374553.pdf" },
        },
      },
    ],
  },
  {
    name: "Thermally modified wood cladding",
    qty: "2,400 sf",
    products: [
      {
        name: "Thermally Modified Ash Cladding",
        manufacturer: "Arbor Wood Co.",
        productUrl: "https://arborwoodco.com/ashcladding",
        rationale: "Thermally modified ash with EPD, HPD, and Declare label all verified. Red List Free certified. Zero chemicals or preservatives — modification is heat only.",
        docs: {
          epd:     { found: true,  url: "https://www.labelingsustainability.com/epd-registry/wpssepd00447r" },
          hpd:     { found: true,  url: "https://www.intectural.com/s/HPD-Arbor-Wood.pdf" },
          declare: { found: true,  url: "https://declare.living-future.org/products/thermally-modified-wood" },
          voc:     { found: false, url: null },
        },
      },
      {
        name: "Lunawood ThermoWood®",
        manufacturer: "Lunawood",
        productUrl: "https://lunawood.com/thermowood/",
        rationale: "Finnish thermally modified pine or spruce with published EPD. No biocides or chemical additives — suitable for Living Building Challenge. No HPD or Declare label found in this scan.",
        docs: {
          epd:     { found: true,  url: "https://lunawood.com/wp-content/uploads/2021/09/EPD_44-19_Lunawood-thermowood_1.pdf" },
          hpd:     { found: false, url: null },
          declare: { found: false, url: null },
          voc:     { found: false, url: null },
        },
      },
      {
        name: "Kebony Character Cladding",
        manufacturer: "Kebony USA",
        productUrl: "https://us.kebony.com/modified-wood-products/cladding/kebony-character-cladding/",
        rationale: "Furfuryl alcohol-modified Scots pine cladding. EPD verified from Kebony USA (Norwegian EPD program, ISO 14025-compliant — accepted by LEED v4 globally). No heavy metals or biocides. Durability class comparable to tropical hardwoods.",
        docs: {
          epd:     { found: true,  url: "https://us.kebony.com/wp-content/uploads/2023/01/NEPD-3513-2106_Kebony-Character-Scots-Pine-Cladding.pdf" },
          hpd:     { found: false, url: null },
          declare: { found: false, url: null },
          voc:     { found: false, url: null },
        },
      },
    ],
  },
  {
    name: "Air/water barrier membrane",
    qty: "2,400 sf",
    products: [
      {
        name: "PERM-A-BARRIER® Liquid",
        manufacturer: "GCP Applied Technologies",
        productUrl: "https://gcpat.com/en/products/perm-a-barrier-air-barrier-system",
        rationale: "Fluid-applied air barrier with NSF-certified EPD. Vapor-permeable and VOC content confirmed under 75 g/L per product data sheet. Widely specified on commercial and residential projects.",
        docs: {
          epd:     { found: true,  url: "https://gcpat.com/sites/gcpat.com/files/2023-02/PERM-A-BARRIER-1-EPD-10787.pdf" },
          hpd:     { found: false, url: null },
          declare: { found: false, url: null },
          voc:     { found: true,  url: "https://www.buildsite.com/pdf/gcpat/Perm-A-Barrier-Liquid-Product-Data-1703403.pdf" },
        },
      },
      {
        name: "Air-Bloc® All Weather STPE",
        manufacturer: "Henry Company",
        productUrl: "https://www.henry.com/commercial/products/air-and-vapor-barriers/fluid-applied-permeable-avb/air-bloc-all-weather-stpe/",
        rationale: "Vapor-permeable fluid-applied barrier with HPD verified from primary sources. Low-VOC formulation (<25 g/L per product data sheet — no third-party certification found). Sprayable and rain-ready — can be applied in cold and wet conditions.",
        docs: {
          epd:     { found: false, url: null },
          hpd:     { found: true,  url: "https://hpdrepository.hpd-collaborative.org/repository/HPDs/109_Air_Bloc_All_Weather_STPE.pdf" },
          declare: { found: false, url: null },
          voc:     { found: false, url: null },
        },
      },
      {
        name: "Sikagard® AWB 660",
        manufacturer: "Sika USA",
        productUrl: "https://usa.sika.com/en/construction/repair-protection/coatings-water-repellents/air-barriers/sikagard-awb-660.html",
        rationale: "Fluid-applied vapor-permeable air/water resistive barrier. EPD available on Sika's sustainability portal. Low-VOC meeting requirements in all 50 states.",
        docs: {
          epd:     { found: true,  url: "https://usa.sika.com/en/sustainability/leed-zone/environmental-product-declarations.html" },
          hpd:     { found: false, url: null },
          declare: { found: false, url: null },
          voc:     { found: false, url: null },
        },
      },
    ],
  },
  {
    name: "Interior paint, low-VOC",
    qty: "5,000 sf",
    products: [
      {
        name: "EVEREST® Zero VOC Interior",
        manufacturer: "Dunn-Edwards",
        productUrl: "https://www.dunnedwards.com/product/everest/",
        rationale: "Zero-VOC interior paint with EPD, HPD, and VOC emission certificate all verified from primary sources. No Declare label found. SCS-certified EPD covers the full product line.",
        docs: {
          epd:     { found: true,  url: "https://www.dunnedwards.com/wp-content/uploads/2015/01/SCS-EPD-05978_DunnEdwards_072920.pdf" },
          hpd:     { found: true,  url: "https://hpdrepository.hpd-collaborative.org/repository/HPDs/310_EVER50_EVEREST_Low_Odor_Zero_VOC_Interior_Semi_Gloss_Paint.pdf" },
          declare: { found: false, url: null },
          voc:     { found: true,  url: "https://www.dunnedwards.com/wp-content/uploads/2022/06/EVER50_VOC-Emission_School-Classroom_Test-Certificate_Dunn-Edwards-Corporation_20190816.pdf" },
        },
      },
      {
        name: "MANOR HALL® Interior Latex",
        manufacturer: "PPG Paints",
        productUrl: "https://www.ppgpaints.com/products/interior-paint/manor-hall-interior-latex",
        rationale: "Zero-VOC interior latex. Zero-VOC status confirmed on official PPG product page. HPD not found in this scan — arcat.com link was rejected as unverifiable. No EPD or Declare label found.",
        docs: {
          epd:     { found: false, url: null },
          hpd:     { found: false, url: null },
          declare: { found: false, url: null },
          voc:     { found: true,  url: "https://www.ppgpaints.com/products/interior-paint/manor-hall-interior-latex" },
        },
      },
      {
        name: "ECOS Interior Wall & Ceiling Paint",
        manufacturer: "ECOS Paints",
        productUrl: "https://www.greenbuildingsupply.com/products/ecos-interior-wall-and-ceiling-paint",
        rationale: "True zero-VOC with HPD, Declare, and VOC report all verified. Declare label (Semi-Gloss, 2020) and VOC report (Eggshell, 2016) are finish-specific but same product line. No EPD.",
        docs: {
          epd:     { found: false, url: null },
          hpd:     { found: true,  url: "https://hpdrepository.hpd-collaborative.org/repository/HPDs/publish_93_ECOS_Interior_Matte_White_Base_1492786328.pdf" },
          declare: { found: true,  url: "https://www.greenbuildingsupply.com/cdn/shop/files/doc-ECOS_DECLARE-Interior-Semi-Gloss_SPEC_2020_GreenBuildingSupply.pdf?v=16783249075534445282" },
          voc:     { found: true,  url: "https://www.greenbuildingsupply.com/cdn/shop/files/Doc-ECOS-Eggshell-Light-Paint_VOC-Report_SPEC_2016_GreenBuildingSupply.pdf?v=15200138489640140621" },
        },
      },
    ],
  },
];

const DOC_LABELS = {
  epd:     "Environmental Product Declaration",
  hpd:     "Health Product Declaration",
  declare: "Declare Label Registry",
  voc:     "VOC / GREENGUARD Certification",
};

function DemoProductCard({ product, expanded, onToggle, saved, onSave, animDelay = 0 }) {
  return (
    <div style={{
      border: `1px solid ${APP.border}`, borderRadius: 6,
      overflow: "hidden", background: APP.panel,
      animation: `demo-card-appear 0.5s cubic-bezier(0.16,1,0.3,1) ${animDelay}ms both`,
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", padding: "11px 13px", textAlign: "left",
          background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
          <span style={{ color: `${APP.text}45`, fontSize: 11, marginTop: 2, flexShrink: 0 }}>
            {expanded ? "▾" : "▸"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.serif, fontSize: 14, color: APP.text, lineHeight: 1.3 }}>
              {product.name}
            </div>
            <div style={{
              fontFamily: T.serif, fontSize: 10, color: `${APP.text}55`,
              marginTop: 3,
            }}>
              {product.manufacturer}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {["epd", "hpd", "declare", "voc"].map((key) => {
                const doc = product.docs[key];
                const colors = DOC_COLORS[key];
                return (
                  <span key={key} style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 4,
                    fontFamily: T.serif,
                    background: doc.found ? colors.bg : "rgba(221,216,207,0.4)",
                    color:      doc.found ? colors.text : "rgba(26,24,20,0.4)",
                    fontWeight: 500,
                    border: `1px solid ${doc.found ? colors.border : "rgba(221,216,207,0.6)"}`,
                  }}>
                    {BADGE_LABELS[key]}
                  </span>
                );
              })}
            </div>
          </div>
          {saved && (
            <span style={{ fontSize: 14, color: APP.success, flexShrink: 0, marginTop: 1 }}>✦</span>
          )}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${APP.border}`, padding: "13px 13px 15px", background: APP.bg }}>
          <p style={{
            fontFamily: T.serif, fontSize: 12.5, color: `${APP.text}75`,
            lineHeight: 1.72, marginBottom: 11,
          }}>
            {product.rationale}
          </p>

          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 4, marginBottom: 13,
              background: `${APP.success}12`, border: `1px solid ${APP.success}38`,
              fontFamily: T.serif, fontSize: 10, letterSpacing: 0.5,
              color: APP.success, textDecoration: "none", textTransform: "uppercase",
            }}
          >
            ↗ View Product Page
          </a>

          <div style={{ borderTop: `1px solid ${APP.border}`, paddingTop: 11, marginBottom: 12 }}>
            <div style={{
              fontFamily: T.serif, fontSize: 10, letterSpacing: 1,
              color: APP.primary, textTransform: "uppercase", marginBottom: 9,
            }}>
              Documentation Links
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {["epd", "hpd", "declare", "voc"].map((key) => {
                const doc = product.docs[key];
                const colors = DOC_COLORS[key];
                if (!doc.found) {
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 4, fontFamily: T.serif,
                        background: "rgba(221,216,207,0.4)", color: "rgba(26,24,20,0.4)",
                        fontWeight: 500,
                        border: "1px solid rgba(221,216,207,0.6)",
                      }}>{BADGE_LABELS[key]}</span>
                      <span style={{ fontFamily: T.serif, fontSize: 10, color: `${APP.text}40` }}>
                        No links found
                      </span>
                    </div>
                  );
                }
                return (
                  <a
                    key={key}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 9px", borderRadius: 4,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      textDecoration: "none",
                    }}
                  >
                    <span style={{
                      fontSize: 12, padding: "2px 8px", borderRadius: 4, fontFamily: T.serif,
                      background: "rgba(255,255,255,0.7)", color: colors.text,
                      fontWeight: 600, flexShrink: 0,
                    }}>{BADGE_LABELS[key]}</span>
                    <span style={{ fontFamily: T.serif, fontSize: 11.5, color: colors.text, flex: 1 }}>
                      {DOC_LABELS[key]}
                    </span>
                    <span style={{ fontSize: 11, color: colors.text, opacity: 0.65 }}>↗</span>
                  </a>
                );
              })}
            </div>
            <div style={{
              fontFamily: T.serif, fontSize: 9, color: `${APP.text}40`,
              marginTop: 9, lineHeight: 1.6,
            }}>
              Verify regional relevance, expiration dates, and product variants.
            </div>
          </div>

          {/* Save / saved button */}
          <button
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              width: "100%", padding: "9px", borderRadius: 4, cursor: "pointer",
              fontFamily: T.serif, fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
              background:   saved ? `${APP.success}14` : APP.dark,
              border:       `1px solid ${saved ? APP.success + "55" : APP.border}`,
              color:        saved ? APP.success : `${APP.text}55`,
              transition:   "all 0.2s",
            }}
          >
            {saved ? "✦ Saved to Library" : "Bookmark"}
          </button>
        </div>
      )}
    </div>
  );
}

function Demo() {
  const [selectedMaterial, setSelectedMaterial] = useState(0);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [demoView, setDemoView] = useState("scan");
  const [demoState, setDemoState] = useState("idle"); // idle | loading | results
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [savedItems, setSavedItems] = useState(new Set());

  const material = DEMO_MATERIALS[selectedMaterial];

  /* Loading sequence */
  useEffect(() => {
    if (demoState !== "loading") return;
    setLoadingPhase(0);
    const timers = [
      setTimeout(() => setLoadingPhase(1), 700),
      setTimeout(() => setLoadingPhase(2), 1400),
      setTimeout(() => { setDemoState("results"); }, 2100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [demoState]);

  const handleMaterialChange = (idx) => {
    setSelectedMaterial(idx);
    setExpandedProduct(null);
    setDemoState("idle");
    setLoadingPhase(0);
  };

  const toggleSave = (mi, pi) => {
    const key = `${mi}-${pi}`;
    setSavedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /* Gather all saved products for library view */
  const libraryItems = [];
  DEMO_MATERIALS.forEach((mat, mi) => {
    mat.products.forEach((prod, pi) => {
      if (savedItems.has(`${mi}-${pi}`)) {
        libraryItems.push({ ...prod, materialName: mat.name, mi, pi });
      }
    });
  });

  /* Inline loading progress — mirrors the real app's productStatus display */
  const renderLoadingStatus = () => {
    const products = material.products;
    return (
      <div style={{
        padding: "11px 13px",
        background: `${APP.primary}0B`,
        border: `1px solid ${APP.primary}28`,
        borderRadius: 5,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 9,
          marginBottom: loadingPhase > 0 ? 10 : 0,
        }}>
          <span className="demo-spinner" />
          <span style={{ fontFamily: T.serif, fontSize: 10, letterSpacing: 1, color: APP.primary, textTransform: "uppercase" }}>
            {loadingPhase === 0 ? "Scanning..." : "Finding Documentation..."}
          </span>
        </div>
        {loadingPhase >= 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {products.map((prod, i) => {
              if (loadingPhase < i + 1) return null;
              const foundDocs = Object.entries(prod.docs)
                .filter(([, d]) => d.found)
                .map(([k]) => k.toUpperCase())
                .join(", ");
              const isResolved = loadingPhase > i + 1;
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{
                    fontFamily: T.serif, fontSize: 10, color: APP.primary,
                    fontWeight: 600, flexShrink: 0, minWidth: 66,
                  }}>
                    Product {i + 1}:
                  </span>
                  <span style={{ fontFamily: T.serif, fontSize: 10, color: APP.text }}>
                    {prod.name}
                    <span style={{
                      marginLeft: 6,
                      color: isResolved ? APP.success : `${APP.text}45`,
                    }}>
                      {isResolved ? `— Found: ${foundDocs}` : "— Analyzing..."}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section style={{ padding: "100px 20px", background: "#ffffff" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <FadeIn><SectionLabel>Try It Out</SectionLabel></FadeIn>
        <FadeIn delay={80}>
          <Prose>
            Here are examples of the kind of results Materialdex returns. Select a material
            and click Find Products to see what the app surfaces for a sample project near
            Portland, OR:
          </Prose>
        </FadeIn>
        <FadeIn delay={160}>
          {/* Plugin window chrome */}
          <div style={{
            borderRadius: 7, overflow: "hidden",
            border: `1px solid ${APP.accent}70`,
            boxShadow: "0 2px 12px rgba(26,24,20,0.07)",
            margin: "4px 0 28px",
          }}>

              {/* Title bar */}
              <div style={{
                background: APP.dark, padding: "9px 15px",
                borderBottom: `1px solid ${APP.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: APP.accent }} />
                  <span style={{ fontFamily: T.serif, fontSize: 14, fontStyle: "italic", color: APP.primary, letterSpacing: 0.3 }}>
                    Materialdex
                  </span>
                  <span style={{ fontFamily: T.serif, fontSize: 10, color: `${APP.text}45`, textTransform: "uppercase", letterSpacing: 1 }}>
                    Sample_House.rvt · Portland OR
                  </span>
                </div>
                <span style={{
                  fontFamily: T.mono, fontSize: 9, color: `${APP.text}50`,
                  background: APP.bg, border: `1px solid ${APP.border}`,
                  padding: "2px 8px", borderRadius: 3, letterSpacing: 1.2,
                }}>DEMO</span>
              </div>

              {/* Tab bar */}
              <div style={{ display: "flex", borderBottom: `1px solid ${APP.border}`, background: APP.dark }}>
                {[["scan", "Scan"], ["library", "Library"]].map(([view, label]) => {
                  const isActive = demoView === view;
                  return (
                    <button
                      key={view}
                      onClick={() => setDemoView(view)}
                      style={{
                        flex: 1, padding: "10px 0",
                        fontFamily: T.serif, fontSize: 10, letterSpacing: 1,
                        textTransform: "uppercase", cursor: "pointer",
                        border: "none", background: isActive ? APP.panel : "transparent",
                        color: isActive ? APP.primary : `${APP.text}42`,
                        borderBottom: isActive ? `2px solid ${APP.primary}` : "2px solid transparent",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      }}
                    >
                      {label}
                      {label === "Library" && libraryItems.length > 0 && (
                        <span style={{
                          fontSize: 9, padding: "1px 5px", borderRadius: 3,
                          background: APP.success, color: "#fff", fontWeight: 700,
                        }}>{libraryItems.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* App body */}
              <div style={{ background: APP.bg, padding: 15, minHeight: 200 }}>

                {demoView === "scan" ? (
                  <>
                    {/* Material selector */}
                    <div style={{ marginBottom: 13 }}>
                      <div style={{
                        fontFamily: T.serif, fontSize: 10, letterSpacing: 1,
                        color: APP.primary, textTransform: "uppercase", marginBottom: 6,
                      }}>
                        Select Material
                      </div>
                      <div style={{ position: "relative" }}>
                        <select
                          value={selectedMaterial}
                          onChange={(e) => handleMaterialChange(Number(e.target.value))}
                          style={{
                            width: "100%", background: APP.dark,
                            border: `1px solid ${APP.border}`, borderRadius: 4,
                            padding: "9px 34px 9px 11px", fontSize: 13,
                            fontFamily: T.serif, color: APP.text,
                            appearance: "none", WebkitAppearance: "none", cursor: "pointer",
                          }}
                        >
                          {DEMO_MATERIALS.map((m, i) => (
                            <option key={i} value={i}>{m.name} ({m.qty})</option>
                          ))}
                        </select>
                        <svg viewBox="0 0 10 6" width="10" height="6" style={{
                          position: "absolute", right: 11, top: "50%",
                          transform: "translateY(-50%)", pointerEvents: "none",
                        }}>
                          <path d="M1 1l4 4 4-4" stroke={APP.primary} strokeWidth="1.5" fill="none" />
                        </svg>
                      </div>
                    </div>

                    {/* Idle: Find Products button */}
                    {demoState === "idle" && (
                      <button
                        onClick={() => setDemoState("loading")}
                        style={{
                          width: "100%", padding: "11px",
                          background: APP.success, color: "#fff",
                          border: "none", borderRadius: 4, cursor: "pointer",
                          fontFamily: T.serif, fontSize: 11, letterSpacing: 1,
                          textTransform: "uppercase",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        Find Products
                      </button>
                    )}

                    {/* Loading state */}
                    {demoState === "loading" && renderLoadingStatus()}

                    {/* Results */}
                    {demoState === "results" && (
                      <>
                        <div style={{
                          fontFamily: T.serif, fontSize: 10, letterSpacing: 1,
                          color: APP.primary, textTransform: "uppercase",
                          paddingBottom: 9, marginBottom: 9,
                          borderBottom: `1px solid ${APP.border}`,
                        }}>
                          {material.products.length} Products Found
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                          {material.products.map((product, idx) => {
                            const key = `${selectedMaterial}-${idx}`;
                            return (
                              <DemoProductCard
                                key={key}
                                product={product}
                                expanded={expandedProduct === key}
                                onToggle={() => setExpandedProduct(expandedProduct === key ? null : key)}
                                saved={savedItems.has(key)}
                                onSave={() => toggleSave(selectedMaterial, idx)}
                                animDelay={idx * 130}
                              />
                            );
                          })}
                        </div>
                        <div style={{
                          marginTop: 13, paddingTop: 10, borderTop: `1px solid ${APP.border}`,
                          fontFamily: T.mono, fontSize: 9, color: `${APP.text}35`,
                          letterSpacing: 0.4, lineHeight: 1.7,
                        }}>
                          AI-generated results — verify before specifying.
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  /* Library view */
                  <>
                    {libraryItems.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "36px 16px" }}>
                        <div style={{
                          fontFamily: T.serif, fontSize: 15, color: `${APP.text}40`,
                          fontStyle: "italic", marginBottom: 7,
                        }}>
                          No saved products yet
                        </div>
                        <div style={{ fontFamily: T.serif, fontSize: 10, color: `${APP.text}40` }}>
                          Scan a material and bookmark products to add them here
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{
                          fontFamily: T.serif, fontSize: 10, letterSpacing: 1,
                          color: APP.primary, textTransform: "uppercase",
                          paddingBottom: 9, marginBottom: 9,
                          borderBottom: `1px solid ${APP.border}`,
                        }}>
                          {libraryItems.length} Saved Product{libraryItems.length !== 1 ? "s" : ""}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                          {libraryItems.map((item, idx) => (
                            <div key={idx} style={{
                              border: `1px solid ${APP.success}45`,
                              borderRadius: 6, padding: "12px 13px",
                              background: `${APP.success}07`,
                              animation: `demo-card-appear 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 80}ms both`,
                            }}>
                              <div style={{ fontFamily: T.serif, fontSize: 14, color: APP.text, lineHeight: 1.3, marginBottom: 3 }}>
                                {item.name}
                              </div>
                              <div style={{ fontFamily: T.serif, fontSize: 10, color: `${APP.text}55`, marginBottom: 2 }}>
                                {item.manufacturer}
                              </div>
                              <div style={{ fontFamily: T.serif, fontSize: 10, color: APP.primary, marginBottom: 9 }}>
                                For: {item.materialName}
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 11 }}>
                                {["epd", "hpd", "declare", "voc"].map((key) => {
                                  const doc = item.docs[key];
                                  const colors = DOC_COLORS[key];
                                  return (
                                    <span key={key} style={{
                                      fontSize: 9, padding: "2px 6px", borderRadius: 4,
                                      fontFamily: T.serif,
                                      background: doc.found ? colors.bg : "rgba(221,216,207,0.4)",
                                      color:      doc.found ? colors.text : "rgba(26,24,20,0.4)",
                                      fontWeight: 500,
                                      border: `1px solid ${doc.found ? colors.border : "rgba(221,216,207,0.6)"}`,
                                    }}>
                                      {BADGE_LABELS[key]}
                                    </span>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => toggleSave(item.mi, item.pi)}
                                style={{
                                  fontFamily: T.serif, fontSize: 10, letterSpacing: 0.5,
                                  padding: "5px 11px", borderRadius: 4,
                                  background: `${APP.error}0D`,
                                  border: `1px solid ${APP.error}30`,
                                  color: APP.error, cursor: "pointer",
                                  textTransform: "uppercase",
                                }}
                              >
                                × Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ═══ SECTION: CLOSING / CTA ═════════════════════════════════════ */
function Closing() {
  return (
    <section id="download" style={{ padding: "100px 20px 120px", background: T.bgAlt }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <FadeIn>
          <Prose>
            Materialdex is free to use. It costs me per use to run, but my goal right now is
            to get architects better access to material information. Give it a try on your
            own projects:
          </Prose>
        </FadeIn>
        <FadeIn delay={100}>
          <div style={{
            border: `1px solid ${T.rule}`, borderRadius: 8,
            padding: "36px 28px", margin: "24px 0", background: T.bg,
          }}>
            {/* Update href to real download URL before launch */}
            <a href="#" style={{ textDecoration: "none" }}>
              <div style={{
                display: "inline-block",
                background: T.accentTx, color: "#fff",
                fontFamily: T.mono, fontSize: 12, letterSpacing: 2,
                fontWeight: 700, padding: "14px 36px", borderRadius: 4,
                cursor: "pointer", marginBottom: 14,
              }}>
                DOWNLOAD FOR REVIT
              </div>
            </a>
            <p style={{
              fontFamily: T.serif, fontSize: 14, color: T.inkMid,
              margin: 0, lineHeight: 1.6,
            }}>
              Free. Revit 2025 and 2026. Windows.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ═══ ROOT ═══════════════════════════════════════════════════════ */
export default function App() {
  return (
    <div style={{ background: T.bg, color: T.ink }}>
      <style>{`
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: ${T.bg}; -webkit-font-smoothing: antialiased; }
        button, a { font-family: inherit; }
        .lottie-scrub canvas { mix-blend-mode: multiply; }
        @keyframes demo-card-appear {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes demo-spin {
          to { transform: rotate(360deg); }
        }
        .demo-spinner {
          display: inline-block;
          width: 11px; height: 11px;
          border: 1.5px solid rgba(139,88,48,0.22);
          border-top-color: #8B5830;
          border-radius: 50%;
          animation: demo-spin 0.65s linear infinite;
          flex-shrink: 0;
        }
      `}</style>
      <Hero />
      <Origin />
      <WhyItMatters />
      <MaterialSurprise />
      <LEEDExperience />
      <AfterTheHouse />
      <AIIdea />
      <WhatILearned />
      <Demo />
      <Closing />
    </div>
  );
}
