# Materialdex Interactive Exhibit — Project Brief

## What this is
An interactive, scroll-driven web piece for benfeicht.com that teaches architects (and curious non-architects) why material selection in mid-Design Development is one of the most consequential sustainability decisions in a building — and that most of those decisions are made without quantified data. The piece ends by introducing Materialdex as the tool that solves this.

## Format
A scroll-driven single-page experience. The spine is an **architectural wall section axonometric** that starts as bare wood stud framing and gains layers as the user scrolls down. Each layer triggers a mini-interaction (quiz, slider, toggle, or animated reveal) with supporting text. The piece concludes with a transition into Materialdex.

The aesthetic reference is Bartosz Ciechanowski / Nicky Case — rich interactive explainers where the reader learns by doing, not just reading. Every section teaches something real about a broken system in design practice.

## Tech / tools
- **3D modeling:** Rhino
- **2D animation / interaction / UI:** Figma (animation, interactive prototypes, motion graphics)
- **Web implementation:** Scroll-driven HTML/CSS/JS — likely a framework like React or vanilla JS with Intersection Observer / GSAP / ScrollTrigger
- **Assets:** Mix of exported Rhino renders, Figma animations, and code-driven interactive elements (sliders, toggles, counters)

## Other Notes
- Refer to the markdown doc marketing-site\Ten material choices architects don't know they're making blind_text_markdown.md for more specific data sources. That is the research document.
- Set up each animation yourself, and I will draw a polished version later on after I can see what works and what doesn't. 

## Graphic Style:
- graphic style is a combination of simple architectural, and what I already worked on redlinebench.benfeicht.com. Refer to Materialdex for color pallete. 

## Layer sequence (scroll order, outside-in)

### Layer 1: Exterior Cladding
**Story:** The replacement cycle changes everything. Brick lasts 150+ years. Vinyl siding lasts 20-40 years. Over a century, the "cheap" option generates more carbon and more landfill waste.

**Key data:**
- Brick: 150+ year service life, 0 replacements in 75 years (BIA 2025 industry EPD, 29 facilities, 39.3% US production)
- Fiber cement (James Hardie HardiePlank): 50-100 year service life, CO₂ reabsorption during use phase (EPD S-P-05037)
- Vinyl siding (CertainTeed MainStreet): Industry EPD claims 50 years, independent sources cite 20-40 years practical life; PVC is ILFI Red Listed
- LMN Architects found up to 58% carbon difference between precast and thin-brick-on-metal-stud wall systems

**Interaction idea:** Timeline animation. Five cladding materials installed side-by-side. Clock fast-forwards through decades. Vinyl fades/cracks at year 25, gets torn off and trucked to landfill, reinstalled. Brick sits unchanged. Running scoreboard shows total replacements and cumulative landfill waste at year 100.

**Named products:** Acme Brick, General Shale, Glen-Gery (BIA members); James Hardie HardiePlank; CertainTeed MainStreet vinyl

---

### Layer 2: Air/Weather Barrier (Adhesives & Sealants)
**Story:** The transparency gap. This is the thinnest, most invisible layer — and the one with the least disclosed chemistry. <5% of construction adhesives/sealants have HPDs. You know more about your breakfast cereal.

**Key data:**
- Vast majority of adhesives, sealants, air barriers have NO HPD, NO Declare label, NO EPD
- Major brands with no standardized disclosure: 3M, Sika, DAP, Loctite/Henkel, GE Silicone, OSI
- VOC ranges are enormous: indoor carpet adhesive capped at 50 g/L, but PVC welding adhesive at 510 g/L, architectural sealant primers at 775 g/L (SCAQMD Rule 1168)
- All polyurethane sealants contain isocyanates (MDI, TDI, HDI) — ILFI Red List respiratory sensitizers
- PROSOCO R-Guard: 5 products with Declare labels, all Red List Free, HPDs completed, VOC <30 g/L
- PROSOCO originally used phthalate plasticizers but reformulated for the Bullitt Center Living Building Challenge (2011)
- Green Science Policy Institute (2023) documents PFAS in roofing membranes, air/vapor barriers, caulks, adhesives, paints, floor finishes

**Interaction idea:** Building cross-section showing dozens of hidden adhesive/sealant locations (around windows, under tiles, at wall junctions, along air barrier seams). Each dot is tappable — most show "INGREDIENTS UNKNOWN" in red. A few (PROSOCO) show green with full ingredient lists. Counter tallies the ratio.

**Named products:** PROSOCO R-Guard (FastFlash, Cat 5, Spray Wrap MVP — all Red List Free); negative examples: 3M, DAP, Loctite (no HPDs)

---

### Layer 3: Insulation
**Story:** The blowing agent that outweighs the building. Legacy XPS's blowing agent alone — the gas trapped inside the foam — has a warming potential 1,430× that of CO₂. Over a building's life, nearly half the climate damage from XPS comes from the gas slowly leaking out.

**Key data:**
- Legacy XPS (Owens Corning Foamular, HFC-134a): 57.8 kg CO₂e/m² at RSI-1; blowing agent diffusion = 28.5 kg CO₂e (49% of total over 75 years)
- HFC-134a GWP: 1,430× CO₂ (IPCC AR5)
- NGX XPS (HFO Opteon 1100): ~11.5 kg CO₂e/m² (~80% reduction, but still 2× non-XPS rigid)
- EPS (pentane, GWP ~4-7): 1.9-3.5 kg CO₂e/m²
- ROCKWOOL Comfortbatt: 1.07-1.4 kg CO₂e/m² (EPD IBU-EPD-RWI-20240078, 2025)
- Dense-pack cellulose (GreenFiber): potentially net carbon-negative at -88.6 kg CO₂e per 100 ft² at R-20 (with biogenic credit)
- Ratio: legacy XPS is 30-100× higher GWP than mineral wool or cellulose
- KPMB Lab: in electric heat pump scenario, legacy XPS embodied carbon may never be repaid
- Health: 16% of spray foam applicator breathing-zone samples exceeded NIOSH limit for MDI (Bello et al. 2019); EPA recommends 24-72 hr vacancy post-installation

**Interaction idea:** A single XPS board slowly exhales rising HFC-134a molecules, each tagged "1,430× CO₂." Mineral wool batt sits inert beside it. Counter tallies cumulative warming over 75 years. Timeline slider lets visitor scrub through the building's life.

**Quiz:** "How much more GWP does traditional XPS have vs. mineral wool at the same R-value?" Answer: 40× or more.

**Named products:** Owens Corning FOAMULAR (legacy, worst); FOAMULAR NGX (transitional); Atlas EPS; ROCKWOOL Comfortbatt (best rigid); GreenFiber cellulose (best overall)

**Caveat:** XPS has superior moisture resistance below grade — mineral wool and cellulose aren't direct substitutes in all assemblies.

---

### Layer 4: Gypsum Board
**Story:** The most boring material with the biggest national-scale impact. Switching to lightweight 5/8" drywall saves 1.1 million metric tons CO₂/year across the US.

**Key data:**
- US consumes ~28 billion ft² of gypsum wallboard annually
- ½" regular: 233 kg CO₂e per 1,000 ft² (2.51/m²)
- 5/8" Type X: 315 kg CO₂e per 1,000 ft²
- USG EcoSmart 5/8": ~249 kg CO₂e (21% less) via 22% weight reduction (1.8 vs 2.2 lb/ft²)
- Drying energy = 68-81% of total GWP — the dominant factor
- National scale: replacing all 5/8" Type X with lightweight = ~1.1 million metric tons CO₂e/year savings
- ~34% of US gypsum supply comes from coal plant FGD — this source is declining as coal plants close
- ~330,700 tons/year of gypsum waste from new construction goes to landfill, producing hydrogen sulfide under anaerobic conditions

**Interaction idea:** US map showing 28 billion ft² of production flowing from plants to sites. Zoom into kiln (68% of energy). Two production lines side-by-side: standard vs. lightweight. Pull back to national scale: 21% savings = 1.1M tons CO₂ = 240,000 cars off road.

**Named products:** USG Sheetrock EcoSmart Panels Firecode X (EPD #141167); National Gypsum Gold Bond XP; Georgia-Pacific DensArmor

---

### Layer 5: Interior Paint (innermost visible surface)
**Story:** "Zero-VOC" isn't zero. Manufacturers shifted from regulated VOCs to unregulated SVOCs. The label measures what evaporates during a standardized test, not what migrates into your air for years.

**Key data:**
- Schieweck & Bock (2015, Building and Environment): "no significant difference in emissions between conventional paints and low-VOC/zero-VOC paints; ultra-low VOC paints showed highest emission potential"
- 2024 study: 40 best-selling paints, 20 SVOCs detected at 10-35,000 ppm in dry films; isothiazolinone preservatives in ~50% of samples
- In 24 "zero/low-VOC" wet paint samples, 11 different VOCs detected including ethylene glycol at 800-20,000 ppm
- EPA: "VOC labels and certification programs may not properly assess all of the VOCs emitted from the product"
- Sherwin-Williams Harmony: NAD found 42-112 g/L VOC when tinted with conventional colorants in dark shades
- Benjamin Moore Natura (zero-VOC, C2C Silver) discontinued March 2021, faced FTC complaint; replacement Eco Spec contains isothiazolinone
- Mineral/lime paint (Ambient Pro+): 0.089 kg CO₂e/m²/coat vs. conventional acrylic 0.492 — 5.5× difference
- Only ECOS Paints has HPD + Declare Red List Free in North American market

**Interaction idea:** Wall with wet paint dries. "VOC" meter drops to zero, label appears. Then second "SVOC" meter slowly rises, 20 compound names floating off surface like heat shimmer. Clock fast-forwards — SVOCs continue for years. Split screen: standard zero-VOC leaking SVOCs vs. Red List Free mineral paint with clean profile.

**Named products:** ECOS Paints (Red List Free, HPD, Declare); Benjamin Moore Eco Spec (Green Seal 11, has isothiazolinone); Sherwin-Williams Harmony (GREENGUARD Gold but 42-112 g/L tinted); Behr/Valspar/Glidden (no HPDs)

---

### Closing: Transition to Materialdex

After that, the visitor has experienced 6 material decisions where data was shocking, hidden, or both. Three framing stats:

1. "The blowing agent in a single layer of legacy XPS insulation can carry more global warming potential than all other building materials in the wall assembly combined" (KPMB Lab, 2021)
2. "Over 430 workers in one US state have contracted an incurable lung disease from a countertop material that 93% of specifiers choose without knowing its silica content" (Cal/OSHA, 2019-2025)
3. "A 'zero-VOC' paint label is tested using a method the EPA itself says 'may not properly assess all of the VOCs emitted from the product'" (EPA Technical Overview)

The message: tools for transparent material comparison exist (EC3, HPD Repository, Declare, Pharos). Specifying without consulting them is the architectural equivalent of prescribing medicine without reading the label.

**Then introduce Materialdex** — the tool that brings EPDs, HPDs, Declare labels, and product data to the point of specification in mid-DD, filtered by project location, requirements, and local craft expertise.

---

## Key sources (for references section)
- KPMB Lab, "Embodied Carbon in Common Insulation Materials," May 2021
- Owens Corning Foamular XPS EPD (2020), Transparency Catalog
- ROCKWOOL EPD IBU-EPD-RWI-20240078 (2025)
- Schieweck & Bock, Building and Environment, 2015, DOI: 10.1016/j.buildenv.2014.11.031
- NWFA/Athena Institute EPDs (2023)
- Interface CQuest GB EPD (2024)
- Salazar et al., Buildings, 2012, DOI: 10.3390/buildings2040542
- Salazar et al., J. Building Engineering, 2021, DOI: 10.1016/j.jobe.2021.102552
- BIA 2025 Industry-Wide EPD
- James Hardie EPD S-P-05037
- Armstrong Ultima EPD #591 (2024), Optima EPD #870 (2025)
- Gypsum Association / Athena Institute LCA (2011/2020)
- USG EcoSmart EPD #141167
- SCAQMD Rule 1168
- PROSOCO R-Guard Declare labels
- Rose et al., MMWR 2019;68:813-818 (silicosis)
- JAMA Internal Medicine, 2023 (CA silicosis cases)
- Natural Stone Institute industry EPD
- ERA/GreenTeam Roofing LCA (2010)
- Bello et al., Int. J. Hygiene Environ. Health, 2019, DOI: 10.1016/j.ijheh.2019.04.010

## Design notes
- The wall section axon should be detailed enough to be architecturally credible but stylized enough to work as a teaching diagram — not a construction document
- Animations should loop cleanly for exhibit context but also work with scroll-triggered interaction for web
- Color palette and typography should match benfeicht.com editorial minimalism — reference architectural material data sheets
- Each section should be self-contained enough that someone scrolling fast still gets the headline, but reward close reading with depth
