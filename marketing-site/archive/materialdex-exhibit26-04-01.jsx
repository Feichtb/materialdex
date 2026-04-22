import { useState, useEffect, useRef } from "react";

/* ═══ Design Tokens ═══ */
const T = {
  mono: "'Courier New', monospace",
  serif: "Georgia, 'Times New Roman', serif",
  accent: "#D4915E",
  bg: "#0C0C0C",
  card: "rgba(255,255,255,0.025)",
  border: "rgba(255,255,255,0.06)",
  hi: "#fff",
  md: "rgba(255,255,255,0.65)",
  lo: "rgba(255,255,255,0.38)",
  xlo: "rgba(255,255,255,0.2)",
  red: "#E05555",
  green: "#7CB342",
};

/* ═══ Hooks ═══ */
function useInView(ref, th = 0.2) {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: th });
    o.observe(ref.current);
    return () => o.disconnect();
  }, [ref, th]);
  return v;
}
function useScrollP(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const s = window.scrollY;
      setP(Math.min(1, Math.max(0, (s - (r.top + s - window.innerHeight)) / (r.bottom - r.top + window.innerHeight))));
    };
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, [ref]);
  return p;
}

/* ═══ Shared ═══ */
const Label = ({ children }) => <p style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 3.5, textTransform: "uppercase", color: T.accent, marginBottom: 16 }}>{children}</p>;
const Prose = ({ children, style }) => <p style={{ fontFamily: T.serif, fontSize: 17, color: T.md, lineHeight: 1.8, margin: "0 0 20px", ...style }}>{children}</p>;
const Wrap = ({ children, dark, style }) => <section style={{ padding: "100px 20px", background: dark ? "#080808" : T.bg, ...style }}><div style={{ maxWidth: 680, margin: "0 auto" }}>{children}</div></section>;

function FadeIn({ children, delay = 0, style }) {
  const r = useRef(null);
  const v = useInView(r, 0.12);
  return <div ref={r} style={{ opacity: v ? 1 : 0, transform: v ? "none" : "translateY(26px)", transition: `all 0.8s ${delay}ms cubic-bezier(0.16,1,0.3,1)`, ...style }}>{children}</div>;
}

function Stat({ n, label, delay }) {
  const r = useRef(null);
  const v = useInView(r, 0.2);
  return (
    <div ref={r} style={{ flex: "1 1 140px", textAlign: "center", padding: "22px 12px", opacity: v ? 1 : 0, transform: v ? "none" : "translateY(18px)", transition: `all 0.7s ${delay}ms cubic-bezier(0.16,1,0.3,1)` }}>
      <p style={{ fontFamily: T.serif, fontSize: 38, color: T.accent, margin: "0 0 4px", fontWeight: 400 }}>{n}</p>
      <p style={{ fontFamily: T.mono, fontSize: 9, color: T.lo, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>{label}</p>
    </div>
  );
}

/* ═══ HERO ═══ */
function Hero() {
  const ref = useRef(null);
  const p = useScrollP(ref);
  return (
    <section ref={ref} style={{ minHeight: "170vh", position: "relative", background: T.bg }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`, backgroundSize: "48px 48px", opacity: Math.min(1, p * 3) }} />
        <div style={{ textAlign: "center", padding: "0 24px", position: "relative", zIndex: 1, maxWidth: 760 }}>
          <p style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: T.accent, marginBottom: 28, opacity: Math.min(1, p * 5), transform: `translateY(${Math.max(0, 14 - p * 70)}px)` }}>An Exhibit by Ben Feicht</p>
          <h1 style={{ fontFamily: T.serif, fontSize: "clamp(28px, 6.5vw, 60px)", fontWeight: 400, fontStyle: "italic", color: T.hi, lineHeight: 1.15, margin: 0, opacity: Math.min(1, p * 3.5), transform: `translateY(${Math.max(0, 32 - p * 120)}px)` }}>
            How Do Architects Know They're Choosing the Right Materials?
          </h1>
          <div style={{ width: 40, height: 1, background: T.accent, margin: "30px auto", opacity: Math.min(1, (p - 0.06) * 5), transform: `scaleX(${Math.min(1, (p - 0.05) * 4)})` }} />
          <p style={{ fontFamily: T.serif, fontSize: "clamp(14px, 2vw, 18px)", color: T.lo, maxWidth: 480, margin: "0 auto", lineHeight: 1.7, opacity: Math.min(1, (p - 0.1) * 4), transform: `translateY(${Math.max(0, 18 - (p - 0.08) * 80)}px)` }}>
            A story about building a house, chasing sustainability documentation, and discovering what AI-assisted research reveals about materials you thought you already knew.
          </p>
        </div>
        <div style={{ position: "absolute", bottom: 30, opacity: Math.max(0, 1 - p * 5), textAlign: "center" }}>
          <div style={{ width: 1, height: 28, background: "linear-gradient(transparent, rgba(255,255,255,0.25))", margin: "0 auto 5px" }} />
          <p style={{ fontFamily: T.mono, fontSize: 9, color: T.xlo, letterSpacing: 3 }}>SCROLL</p>
        </div>
      </div>
    </section>
  );
}

/* ═══ ORIGIN — THE HOUSE ═══ */
function Origin() {
  return (
    <Wrap>
      <FadeIn><Label>Nicks Bend, North Carolina</Label></FadeIn>
      <FadeIn delay={80}><Prose>I asked myself this question for the first time when I was designing my first house — not for a client at a firm, but on my own. A small project in rural North Carolina, 2,800 miles from everything I knew.</Prose></FadeIn>
      <FadeIn delay={160}><Prose>I did what every architect does. I referenced materials I'd worked with before. Wood framing, standing seam metal roof, fiber cement siding. They were familiar. But familiar doesn't mean right for <em>this</em> project.</Prose></FadeIn>
      <FadeIn delay={240}><Prose>And what does "right" even mean? For this house I had constraints that competed with each other:</Prose></FadeIn>
      <FadeIn delay={320}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 24px" }}>
          {["Net-zero energy", "Air-tight envelope", "Low embodied carbon", "Local materials", "Easy to construct remotely"].map((c, i) => (
            <span key={i} style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, background: "rgba(212,145,94,0.07)", border: "1px solid rgba(212,145,94,0.16)", padding: "5px 12px", borderRadius: 3 }}>{c}</span>
          ))}
        </div>
      </FadeIn>
      <FadeIn delay={400}><Prose>That's a lot of constraints. And I was picking materials the way most architects do — from memory and habit, not from a systematic search of what actually existed.</Prose></FadeIn>
    </Wrap>
  );
}

/* ═══ WHY IT MATTERS ═══ */
function WhyItMatters() {
  return (
    <Wrap dark>
      <FadeIn><Label>Why This Matters</Label></FadeIn>
      <FadeIn delay={80}><h2 style={{ fontFamily: T.serif, fontSize: "clamp(21px, 4vw, 32px)", fontWeight: 400, color: T.hi, lineHeight: 1.3, marginBottom: 20 }}>Construction is one of the largest carbon emitters on Earth.</h2></FadeIn>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 0, margin: "16px 0 32px", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
        <Stat n="40%" label="Global CO₂ from buildings" delay={150} />
        <Stat n="11%" label="From materials alone" delay={300} />
        <Stat n="500+ mi" label="Avg material transport" delay={450} />
      </div>
      <FadeIn delay={200}><Prose>Every material has hidden ingredients — binders, coatings, plasticizers — that most architects never see. And many travel hundreds of miles from factories to job sites, even when closer alternatives exist.</Prose></FadeIn>
      <FadeIn delay={300}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20, margin: "20px 0" }}>
          <p style={{ fontFamily: T.mono, fontSize: 9, color: T.lo, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Hidden Ingredients in Common Materials</p>
          {[
            { m: "Vinyl Flooring (LVP)", h: "Phthalate plasticizers, heavy metal stabilizers, chlorine-based PVC", r: "high" },
            { m: "Spray Foam Insulation", h: "Isocyanates, blowing agents, amine catalysts", r: "high" },
            { m: "Acoustic Ceiling Tile", h: "Formaldehyde binders, mineral fibers, antimicrobial treatments", r: "med" },
            { m: "Standard Latex Paint", h: "VOCs, ethylene glycol, crystalline silica, fungicides", r: "med" },
          ].map((x, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none", gap: 12, flexWrap: "wrap" }}>
              <p style={{ fontFamily: T.serif, fontSize: 13.5, color: T.hi, margin: 0, flex: "1 1 140px", fontWeight: 600 }}>{x.m}</p>
              <p style={{ fontFamily: T.serif, fontSize: 12.5, color: T.lo, margin: 0, flex: "2 1 200px", lineHeight: 1.4 }}>{x.h}</p>
              <span style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: 1, color: x.r === "high" ? T.red : T.accent, background: x.r === "high" ? "rgba(224,85,85,0.08)" : "rgba(212,145,94,0.08)", padding: "2px 7px", borderRadius: 2, flexShrink: 0 }}>{x.r === "high" ? "HIGH CONCERN" : "MODERATE"}</span>
            </div>
          ))}
        </div>
      </FadeIn>
    </Wrap>
  );
}

/* ═══ ZGF / LEED ═══ */
function ZGF() {
  return (
    <Wrap>
      <FadeIn><Label>What I Learned at ZGF Architects</Label></FadeIn>
      <FadeIn delay={80}><Prose>I first saw this at scale during my time at ZGF, working on LEED projects. Chasing material credits meant tracking down EPDs, HPDs, and Declare labels for dozens of products.</Prose></FadeIn>
      <FadeIn delay={160}><Prose>Half the manufacturer websites had broken links. EPDs were expired or covered a different product. We'd spend an entire afternoon on a single material and still not be confident we had the right documents.</Prose></FadeIn>
      <FadeIn delay={240}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20, margin: "20px 0" }}>
          <p style={{ fontFamily: T.mono, fontSize: 9, color: T.lo, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>The Documentation That Actually Matters</p>
          {[
            { abbr: "EPD", name: "Environmental Product Declaration", desc: "Lifecycle carbon footprint — cradle to grave. The carbon receipt.", c: "#4A90D9" },
            { abbr: "HPD", name: "Health Product Declaration", desc: "Full ingredient disclosure. What's in it and what it does to people.", c: "#E8A87C" },
            { abbr: "DL", name: "Declare Label", desc: "Third-party transparency. The nutrition label for building products.", c: "#7CB342" },
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", alignItems: "flex-start" }}>
              <div style={{ flex: "0 0 42px", height: 42, borderRadius: 5, background: `${d.c}15`, border: `1px solid ${d.c}30`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: d.c }}>{d.abbr}</div>
              <div>
                <p style={{ fontFamily: T.serif, fontSize: 14, color: T.hi, margin: "0 0 3px", fontWeight: 600 }}>{d.name}</p>
                <p style={{ fontFamily: T.serif, fontSize: 12.5, color: T.lo, margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </FadeIn>
      <FadeIn delay={320}><Prose>My colleague Peter Harrison led an internal initiative at ZGF — a simple system that flagged materials with a red dot when documentation was missing. It helped interior designers make faster decisions. But it was manual, internal to the firm, and couldn't scale.</Prose></FadeIn>
      <FadeIn delay={400}><Prose style={{ fontStyle: "italic", color: T.lo, borderLeft: `2px solid ${T.accent}`, paddingLeft: 16 }}>The problem wasn't that architects didn't care. It was that the research infrastructure didn't match the pace of practice.</Prose></FadeIn>
    </Wrap>
  );
}

/* ═══ NC CHALLENGE ═══ */
function NC() {
  return (
    <Wrap dark>
      <FadeIn><Label>Back to North Carolina</Label></FadeIn>
      <FadeIn delay={80}><h2 style={{ fontFamily: T.serif, fontSize: "clamp(21px, 4vw, 30px)", fontWeight: 400, color: T.hi, lineHeight: 1.3, marginBottom: 18 }}>Everything I knew was from Portland. This project was across the country.</h2></FadeIn>
      <FadeIn delay={160}><Prose>Different climate zone. Different craft traditions. Different supply chains. The materials I'd used in Oregon weren't necessarily right for North Carolina's heat and humidity.</Prose></FadeIn>
      <FadeIn delay={240}>
        <div style={{ display: "flex", gap: 12, margin: "24px 0", flexWrap: "wrap" }}>
          {[
            { label: "Climate", pdx: "Marine / Zone 4C", nc: "Humid subtropical / 4A" },
            { label: "Timber", pdx: "Douglas Fir, W. Red Cedar", nc: "SE Yellow Pine, Red Oak" },
            { label: "Trades", pdx: "Metal fab, curtain wall", nc: "Stick frame, wood crafts" },
          ].map((r, i) => (
            <div key={i} style={{ flex: "1 1 180px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: 14 }}>
              <p style={{ fontFamily: T.mono, fontSize: 9, color: T.lo, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{r.label}</p>
              <p style={{ fontFamily: T.serif, fontSize: 12.5, color: T.lo, margin: "0 0 4px" }}><span style={{ fontFamily: T.mono, fontSize: 8, color: T.xlo }}>PDX</span> {r.pdx}</p>
              <p style={{ fontFamily: T.serif, fontSize: 12.5, color: T.md, margin: 0 }}><span style={{ fontFamily: T.mono, fontSize: 8, color: T.accent }}>NC</span> {r.nc}</p>
            </div>
          ))}
        </div>
      </FadeIn>
      <FadeIn delay={320}><Prose>The house met its goals — net-zero energy, happy clients, a building that felt right in its landscape. But I wasn't satisfied I'd made the <em>best possible</em> material decisions. I'd made the best I could with the information I had time to find.</Prose></FadeIn>
      <FadeIn delay={400}><Prose style={{ fontStyle: "italic", color: T.lo, borderLeft: `2px solid ${T.accent}`, paddingLeft: 16 }}>There's a difference between a good outcome and a good process. The house was good. The process of finding materials was not.</Prose></FadeIn>
    </Wrap>
  );
}

/* ═══ AI IDEA + REVIT ═══ */
function AIIdea() {
  const [open, setOpen] = useState(null);
  const parts = [
    { name: "Standing Seam Metal Roof", c: "#8B8B8B", d: "Listed as 'Metal Panel - Standing Seam'. But which product? Which manufacturer? What coating chemistry? The Revit name tells you nothing." },
    { name: "Batt Insulation", c: "#E8C85A", d: "Listed as 'Insulation - Batt'. Fiberglass? Mineral wool? Sheep's wool? Each has different EPDs, health profiles, and costs." },
    { name: "CMU Foundation", c: "#A0907A", d: "Listed as 'Concrete Masonry Unit'. CMU from the plant 20 miles away has a completely different carbon footprint than CMU shipped 300 miles." },
    { name: "Wood Flooring", c: "#C49A6C", d: "Listed as 'Wood - Flooring'. Local red oak? Imported bamboo? Reclaimed pine? The model doesn't distinguish." },
    { name: "Fiber Cement Siding", c: "#B5A898", d: "Listed as 'Fiber Cement Panel'. One manufacturer has a Declare label. Another doesn't. Both look identical in the model." },
  ];
  return (
    <Wrap>
      <FadeIn><Label>What If AI Could Search For You?</Label></FadeIn>
      <FadeIn delay={80}><Prose>My Revit model already had every material — wood flooring, CMU block, insulation, metal roof. The categories were there. But from generic categories, I had no systematic way to find which <em>specific products</em> were best for each role.</Prose></FadeIn>
      <FadeIn delay={160}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20, margin: "20px 0" }}>
          <p style={{ fontFamily: T.mono, fontSize: 9, color: T.lo, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Tap a material — see what Revit knows and what it doesn't</p>
          {parts.map((p, i) => (
            <div key={i}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: "100%", textAlign: "left", cursor: "pointer", background: open === i ? `${p.c}12` : "rgba(255,255,255,0.012)", border: `1px solid ${open === i ? `${p.c}40` : T.border}`, borderRadius: open === i ? "5px 5px 0 0" : 5, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: open === i ? 0 : 4, transition: "all 0.2s" }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: p.c, flexShrink: 0 }} />
                <span style={{ fontFamily: T.serif, fontSize: 13.5, color: open === i ? T.hi : T.md }}>{p.name}</span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.xlo, marginLeft: "auto" }}>{open === i ? "−" : "+"}</span>
              </button>
              {open === i && (
                <div style={{ background: `${p.c}08`, border: `1px solid ${p.c}20`, borderTop: "none", borderRadius: "0 0 5px 5px", padding: "12px 14px", marginBottom: 4 }}>
                  <p style={{ fontFamily: T.serif, fontSize: 13, color: T.md, margin: 0, lineHeight: 1.55 }}>{p.d}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </FadeIn>
      <FadeIn delay={240}><Prose>So I built a Revit plugin. It reads your material list and uses AI-assisted research — similar to how Perplexity searches — but pointed at building product databases, EPD repositories, and manufacturer documentation.</Prose></FadeIn>
      <FadeIn delay={320}><Prose>For each material, it suggests real products near your project location with verified sustainability documentation. I also added project-specific goals — for North Carolina, I told it I cared about air-tight assemblies and easy on-site assembly.</Prose></FadeIn>
    </Wrap>
  );
}

/* ═══ DEMO ═══ */
function Demo() {
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState(0);
  const mats = [
    { name: "Concrete — Foundation", res: [
      { p: "CarbonCure Ready Mix", m: "CarbonCure Technologies", epd: true, hpd: false, dec: false, n: "CO₂ injected during mixing — 40% lower carbon, same strength", top: true },
      { p: "ECOPact", m: "Holcim", epd: true, hpd: false, dec: false, n: "30–100% carbon reduction depending on mix" },
      { p: "EcoCem GGBS", m: "Ecocem", epd: true, hpd: false, dec: false, n: "Ground slag cement, 50% embodied carbon reduction" },
    ]},
    { name: "Insulation — Walls", res: [
      { p: "Havelock Wool", m: "Havelock Wool", epd: true, hpd: true, dec: true, n: "Carbon negative, naturally fire resistant, zero off-gassing", top: true },
      { p: "Comfortbatt", m: "Rockwool", epd: true, hpd: true, dec: false, n: "Mineral wool — excellent fire and acoustic" },
      { p: "EcoBatt", m: "Knauf", epd: true, hpd: true, dec: false, n: "High recycled content fiberglass" },
    ]},
    { name: "Flooring — Interior", res: [
      { p: "Marmoleum", m: "Forbo", epd: true, hpd: true, dec: true, n: "Natural linoleum, carbon neutral manufacturing", top: true },
      { p: "noraplan sentica", m: "nora systems", epd: true, hpd: true, dec: false, n: "Natural rubber, zero PVC" },
      { p: "Lonseal Loneco", m: "Lonseal", epd: true, hpd: false, dec: false, n: "Bio-based content, good lifecycle" },
    ]},
  ];
  const scan = () => { setScanning(true); setDone(false); setTimeout(() => { setScanning(false); setDone(true); }, 2200); };
  const Badge = ({ ok, label }) => ok ? <span style={{ fontFamily: T.mono, fontSize: 8, color: T.green, background: "rgba(124,179,66,0.1)", padding: "2px 6px", borderRadius: 2 }}>{label}</span> : null;

  return (
    <Wrap dark style={{ padding: "100px 20px" }}>
      <FadeIn><Label>Interactive — Try Materialdex</Label></FadeIn>
      <FadeIn delay={80}><h2 style={{ fontFamily: T.serif, fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 400, color: T.hi, marginBottom: 6, lineHeight: 1.3 }}>See what your model is missing.</h2></FadeIn>
      <FadeIn delay={120}><Prose style={{ marginBottom: 24 }}>This simulates a project with three materials. The real plugin scans your entire Revit material list.</Prose></FadeIn>
      <FadeIn delay={160}>
        <div style={{ background: "#111", borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden" }}>
          <div style={{ background: "#1a1a1a", padding: "9px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: T.accent }} />
              <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.lo }}>Materialdex — Sample_Residence.rvt</span>
            </div>
            <span style={{ fontFamily: T.mono, fontSize: 8, color: T.xlo }}>v1.0</span>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
              {mats.map((m, i) => (
                <button key={i} onClick={() => setTab(i)} style={{ background: tab === i ? "rgba(212,145,94,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${tab === i ? "rgba(212,145,94,0.25)" : T.border}`, borderRadius: 3, padding: "5px 10px", cursor: "pointer", fontFamily: T.mono, fontSize: 10, color: tab === i ? T.accent : T.lo }}>{m.name}</button>
              ))}
            </div>
            {!done && (
              <button onClick={scan} disabled={scanning} style={{ background: scanning ? "rgba(212,145,94,0.05)" : "rgba(212,145,94,0.1)", border: `1px solid ${T.accent}`, color: T.accent, fontFamily: T.mono, fontSize: 11, padding: "9px 18px", borderRadius: 3, cursor: scanning ? "wait" : "pointer", width: "100%", marginBottom: 10, letterSpacing: 0.5 }}>
                {scanning ? "Searching EPD repositories, manufacturer databases, Declare directory..." : "▶  SCAN MATERIALS"}
              </button>
            )}
            {scanning && (
              <div style={{ height: 3, background: "rgba(255,255,255,0.03)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", background: T.accent, borderRadius: 2, animation: "bar 2s ease-in-out forwards" }} />
              </div>
            )}
            {done && mats[tab].res.map((r, i) => (
              <div key={i} style={{ background: r.top ? "rgba(124,179,66,0.04)" : "rgba(255,255,255,0.012)", border: `1px solid ${r.top ? "rgba(124,179,66,0.12)" : T.border}`, borderRadius: 5, padding: 12, marginBottom: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <div>
                    <p style={{ fontFamily: T.serif, fontSize: 13.5, color: T.hi, margin: 0 }}>{r.p}{r.top && <span style={{ fontFamily: T.mono, fontSize: 8, color: T.green, marginLeft: 6 }}>★ TOP</span>}</p>
                    <p style={{ fontFamily: T.mono, fontSize: 9.5, color: T.xlo, margin: "2px 0 0" }}>{r.m}</p>
                  </div>
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
                    <Badge ok={r.epd} label="EPD" /><Badge ok={r.hpd} label="HPD" /><Badge ok={r.dec} label="DECLARE" />
                  </div>
                </div>
                <p style={{ fontFamily: T.serif, fontSize: 12, color: T.lo, margin: "7px 0 0", lineHeight: 1.4 }}>{r.n}</p>
              </div>
            ))}
            {done && <p style={{ fontFamily: T.mono, fontSize: 9, color: T.xlo, marginTop: 12, fontStyle: "italic" }}>⚠ Simulated results for demonstration.</p>}
          </div>
        </div>
      </FadeIn>
    </Wrap>
  );
}

/* ═══ DISCOVERIES + HONESTY ═══ */
function Discoveries() {
  return (
    <Wrap>
      <FadeIn><Label>What I Discovered</Label></FadeIn>
      <FadeIn delay={80}><h2 style={{ fontFamily: T.serif, fontSize: "clamp(21px, 4vw, 30px)", fontWeight: 400, color: T.hi, lineHeight: 1.3, marginBottom: 18 }}>Even concrete had better options I'd never encountered.</h2></FadeIn>
      <FadeIn delay={160}><Prose>Low-carbon ready-mix concrete. Available from local suppliers near the project site. Cost premium under 3%. Published EPDs. I had eight years of experience specifying concrete and had never come across these products.</Prose></FadeIn>
      <FadeIn delay={240}><Prose>For nearly every material category, Materialdex surfaced products I hadn't seen in any spec database, any manufacturer lunch-and-learn, any material library. Not because they were obscure — because the discovery channels architects rely on are narrow.</Prose></FadeIn>
      <FadeIn delay={320}>
        <div style={{ background: "rgba(212,145,94,0.04)", border: "1px solid rgba(212,145,94,0.12)", borderRadius: 8, padding: 22, margin: "24px 0" }}>
          <Prose style={{ margin: 0, color: T.md }}>I no longer needed years of expertise picking sustainable materials to make good choices. The system let me choose from verified options as a baseline — shifting the question from <em>"what exists?"</em> to <em>"which of these good options fits best?"</em></Prose>
        </div>
      </FadeIn>
      <FadeIn delay={400}><Label>What Doesn't Work Yet</Label></FadeIn>
      <FadeIn delay={480}><Prose>It also makes mistakes. During testing, it recommended Accoya siding — a great product — but linked to documentation from New Zealand. I know US documentation exists, but the system wasn't surfacing it.</Prose></FadeIn>
      <FadeIn delay={560}><Prose>Because it does live research, it's susceptible to inconsistent manufacturer sites, regional database gaps, and occasional outdated links. It's a starting point that expands your search radius dramatically — not a replacement for professional judgment.</Prose></FadeIn>
    </Wrap>
  );
}

/* ═══ CLOSING ═══ */
function Closing() {
  return (
    <section style={{ padding: "100px 20px 110px", background: T.bg }}>
      <div style={{ maxWidth: 580, margin: "0 auto", textAlign: "center" }}>
        <FadeIn>
          <h2 style={{ fontFamily: T.serif, fontSize: "clamp(22px, 5vw, 36px)", fontWeight: 400, fontStyle: "italic", color: T.hi, lineHeight: 1.3, marginBottom: 18 }}>The information exists. The path to it doesn't — yet.</h2>
        </FadeIn>
        <FadeIn delay={100}>
          <Prose style={{ textAlign: "center" }}>Materialdex is free. It costs me per use, but I'd rather architects have access to better material information than optimize for revenue. Give it a try and see what you've been missing.</Prose>
        </FadeIn>
        <FadeIn delay={200}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "28px 24px", margin: "32px 0" }}>
            <div style={{ display: "inline-block", background: T.accent, color: T.bg, fontFamily: T.mono, fontSize: 12, letterSpacing: 2, fontWeight: 700, padding: "12px 32px", borderRadius: 4, cursor: "pointer", marginBottom: 10 }}>DOWNLOAD FOR REVIT</div>
            <p style={{ fontFamily: T.mono, fontSize: 10, color: T.xlo, margin: "6px 0 14px" }}>Free · Revit 2025 & 2026 · Windows</p>
            <div style={{ width: 28, height: 1, background: T.border, margin: "0 auto 12px" }} />
            <p style={{ fontFamily: T.mono, fontSize: 10, color: T.lo, margin: 0, lineHeight: 1.6 }}>Or just take this with you: AI-assisted search can help you find better materials without needing to be the expert yourself.</p>
          </div>
        </FadeIn>
        <FadeIn delay={300}>
          <div style={{ width: 28, height: 1, background: T.border, margin: "36px auto 20px" }} />
          <p style={{ fontFamily: T.serif, fontSize: 13.5, color: T.lo, lineHeight: 1.6 }}>Part of an ongoing series exploring how designers can see broken systems more clearly — and what happens when you try to fix them.</p>
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, marginTop: 12 }}>benfeicht.com</p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ═══ APP ═══ */
export default function App() {
  return (
    <div style={{ background: T.bg, color: T.hi }}>
      <style>{`*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}body{background:${T.bg}}button{font-family:inherit}@keyframes bar{0%{width:0}55%{width:70%}100%{width:100%}}`}</style>
      <Hero />
      <Origin />
      <WhyItMatters />
      <ZGF />
      <NC />
      <AIIdea />
      <Demo />
      <Discoveries />
      <Closing />
    </div>
  );
}
