import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import cors from "cors";
import {Request, Response} from "express";

// Initialize Firebase Admin
admin.initializeApp();

// CORS middleware
const corsHandler = cors({origin: true});

// ============================================================================
// TYPES
// ============================================================================

interface Material {
  id: string;
  name: string;
  qty: number;
  unit: string;
}

interface Project {
  name: string;
  zip: string;
  goals: string;
}

interface ScanRequest {
  material: Material;
  project: Project;
  settings?: {
    model: string;
    conservativeMode: boolean;
    useWebSearch: boolean;
  };
  excludeProducts?: string[];
}

interface DocStatus {
  status: "verified" | "unverified" | "user-provided" | "needs-link";
  doc_url: string | null;
  registry_id?: string | null;
}

interface DocChecklist {
  epd: DocStatus;
  hpd: DocStatus;
  declare: DocStatus;
  voc: DocStatus;
}

interface ProductRecommendation {
  product_label: string;
  manufacturer: string | null;
  manufacturer_url: string | null;
  product_url: string | null;
  image_url: string | null;
  rationale: string;
  doc_checklist: DocChecklist;
  distance_miles: number | null;
  confidence: number;
  has_known_epd?: boolean;
  has_known_hpd?: boolean;
  has_known_declare?: boolean;
}

interface AIRecommendation {
  product_label: string;
  manufacturer?: string | null;
  manufacturer_url?: string | null;
  product_url?: string | null;
  rationale?: string;
  has_known_epd?: boolean;
  has_known_hpd?: boolean;
  has_known_declare?: boolean;
  confidence?: number;
}

interface AIResponse {
  name: string;
  normalized_category: string;
  category_confidence: number;
  notes_for_user: string;
  recommendations: AIRecommendation[];
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

interface CategorizedLink {
  url: string;
  title: string;
  snippet: string;
  category: string;
  confidence: number;
  reason: string;
}

// ============================================================================
// OPENAI CLIENTS
// ============================================================================

function getPerplexityClient(): OpenAI {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY not configured");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  return new OpenAI({apiKey});
}

// ============================================================================
// PROMPTS
// ============================================================================

const PRODUCT_SEARCH_PROMPT = `You are a sustainable building materials expert finding products WITH DOCUMENTATION.

CRITICAL: Prioritize products that have published sustainability certifications:
- EPD (Environmental Product Declaration)
- HPD (Health Product Declaration)  
- Declare label (Living Building Challenge)
- GREENGUARD or other VOC certifications

Return JSON:
{
  "name": "material name",
  "normalized_category": "category",
  "category_confidence": 0.9,
  "notes_for_user": "sustainability notes",
  "recommendations": [
    {
      "product_label": "Specific Product Name",
      "manufacturer": "Company Name", 
      "manufacturer_url": "https://manufacturer.com",
      "product_url": "https://manufacturer.com/product-page",
      "rationale": "Why sustainable + mention known certifications",
      "has_known_epd": true,
      "has_known_hpd": false,
      "has_known_declare": false,
      "confidence": 0.85
    }
  ]
}

IMPORTANT:
- Only recommend real, currently available products
- Prefer products you know have EPD/HPD/Declare documentation
- Set has_known_* flags if you know the product has that certification`;

function buildProductSearchPrompt(
  material: Material,
  projectGoals: string,
  projectZip: string,
  conservativeMode: boolean,
  excludeProducts?: string[]
): string {
  const excludeText = excludeProducts && excludeProducts.length > 0 ?
    `\n**IMPORTANT:** Do NOT recommend these products:\n${excludeProducts.map((p) => `- ${p}`).join("\n")}\n` :
    "";

  return `Find sustainable product alternatives for:

**Material:** ${material.name}
**Quantity:** ${material.qty} ${material.unit}
**Location:** ZIP ${projectZip}
**Goals:** ${projectGoals}
${excludeText}
${conservativeMode ? "**Mode:** Conservative - only high-confidence results" : ""}

Find 3 real products from major manufacturers.
PREFER products with published certifications (EPD, HPD, Declare).
Return products most likely to have documentation first.`;
}

// ============================================================================
// URL VALIDATION
// ============================================================================

function isGenericHomepage(url: string): boolean {
  const urlLower = url.toLowerCase();
  const genericHomepages = [
    "https://hpdrepository.hpd-collaborative.org",
    "https://hpdrepository.hpd-collaborative.org/",
    "https://declare.living-future.org",
    "https://declare.living-future.org/",
    "https://spot.ul.com",
    "https://spot.ul.com/",
    "https://www.environdec.com",
    "https://www.environdec.com/",
  ];

  if (genericHomepages.includes(urlLower)) return true;

  try {
    const urlObj = new URL(url);
    if (urlObj.pathname === "/" || urlObj.pathname === "") return true;
  } catch {
    return true;
  }

  return false;
}

function cleanManufacturerName(manufacturer: string): string {
  let cleaned = manufacturer.replace(/\([^)]*\)/g, "").trim();
  cleaned = cleaned.replace(/\s+(LLC|Inc|Corp|Corporation|Company|Co)$/i, "").trim();
  return cleaned;
}

function getManufacturerKeywords(manufacturer: string): string[] {
  const cleaned = cleanManufacturerName(manufacturer);
  const lower = cleaned.toLowerCase();
  return lower.split(/[\s-]+/).filter((w) => w.length > 2);
}

async function validateUrlComplete(
  url: string,
  manufacturer: string | null
): Promise<{valid: boolean; usable: boolean; manufacturerMatch: boolean; reason: string}> {
  console.log(`[VALIDATE] Checking: ${url}`);

  if (isGenericHomepage(url)) {
    return {valid: false, usable: false, manufacturerMatch: false, reason: "Generic homepage"};
  }

  const isPdf = url.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes(".pdf?");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Materialdex/1.0)",
        "Accept": isPdf ? "application/pdf,*/*" : "text/html,*/*",
      },
    });

    clearTimeout(timeout);

    if (response.status === 404) {
      return {valid: false, usable: false, manufacturerMatch: false, reason: "404 Not Found"};
    }

    if (response.status >= 400) {
      return {valid: false, usable: false, manufacturerMatch: false, reason: `HTTP ${response.status}`};
    }

    if (isPdf) {
      return {valid: true, usable: true, manufacturerMatch: true, reason: "PDF file - assuming valid"};
    }

    const content = await response.text();

    if (content.length < 500) {
      return {valid: false, usable: false, manufacturerMatch: false, reason: "Page too short"};
    }

    // Check for error pages
    const contentLower = content.toLowerCase();
    const errorIndicators = ["page not found", "404", "not found", "no results found"];
    const errorCount = errorIndicators.filter((e) => contentLower.includes(e)).length;
    if (errorCount >= 2 && content.length < 2000) {
      return {valid: false, usable: false, manufacturerMatch: false, reason: "Appears to be error page"};
    }

    // Check manufacturer
    let manufacturerMatch = true;
    if (manufacturer) {
      const cleanedMfg = cleanManufacturerName(manufacturer).toLowerCase();
      const mfgKeywords = getManufacturerKeywords(manufacturer);

      if (contentLower.includes(cleanedMfg)) {
        manufacturerMatch = true;
      } else {
        const foundKeywords = mfgKeywords.filter((k) => contentLower.includes(k));
        manufacturerMatch = foundKeywords.length > 0 && foundKeywords.length / mfgKeywords.length >= 0.33;
      }
    }

    return {
      valid: manufacturerMatch,
      usable: true,
      manufacturerMatch,
      reason: manufacturerMatch ? "Valid page with manufacturer" : "Wrong manufacturer",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.log(`[VALIDATE] Error for ${url}: ${msg}`);
    return {valid: true, usable: true, manufacturerMatch: true, reason: `Error (${msg}) - assuming valid`};
  }
}

// ============================================================================
// DOC SEARCH
// ============================================================================

async function searchForDocumentation(
  productName: string,
  manufacturer: string | null,
  perplexityKey: string
): Promise<{categorizedLinks: CategorizedLink[]; byType: Record<string, CategorizedLink[]>}> {
  console.log(`[DOC-SEARCH] Searching for: ${productName} (${manufacturer || "no manufacturer"})`);

  const client = new OpenAI({
    apiKey: perplexityKey,
    baseURL: "https://api.perplexity.ai",
  });

  const searchQueries = [
    {name: "EPD", query: `${manufacturer || productName} EPD environmental product declaration PDF`},
    {name: "HPD", query: `${manufacturer || productName} HPD health product declaration PDF`},
    {name: "Declare", query: `${manufacturer || productName} Declare label Red List Free`},
    {name: "VOC", query: `${manufacturer || productName} GREENGUARD VOC certification`},
    {name: "Product Page", query: `${manufacturer || productName} product specifications page`},
  ];

  const allResults: SearchResult[] = [];

  // Run searches in parallel
  const searchPromises = searchQueries.map(async ({name, query}) => {
    try {
      console.log(`[DOC-SEARCH] Searching ${name}...`);
      const response = await client.chat.completions.create({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `Find ${name} documentation for building products. Return ONLY real URLs as JSON:
{"results": [{"url": "https://...", "title": "...", "snippet": "..."}]}
Do NOT return generic homepages, search pages, or category pages.`,
          },
          {
            role: "user",
            content: `Find ${name} documentation for: ${productName}${manufacturer ? ` by ${manufacturer}` : ""}
Search: ${query}`,
          },
        ],
        temperature: 0,
      });

      const text = response.choices[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]
          .replace(/\}\s*\[\d+\]\s*,/g, "},")
          .replace(/\}\s*\[\d+\]\s*\]/g, "}]")
          .replace(/"\s*\[\d+\]\s*,/g, "\",")
          .replace(/"\s*\[\d+\]\s*\}/g, "\"}"));
        const results = (parsed.results || []).filter((r: SearchResult) =>
          r.url && r.url.startsWith("http"));
        console.log(`[DOC-SEARCH] Found ${results.length} ${name} results`);
        return results;
      }
    } catch (e) {
      console.log(`[DOC-SEARCH] Error searching ${name}:`, e);
    }
    return [];
  });

  const searchResults = await Promise.all(searchPromises);
  searchResults.forEach((results) => allResults.push(...results));

  console.log(`[DOC-SEARCH] Total results: ${allResults.length}`);

  // Validate URLs in parallel
  console.log(`[DOC-SEARCH] Validating ${allResults.length} URLs...`);
  const validationResults = await Promise.all(
    allResults.map(async (result) => {
      const validation = await validateUrlComplete(result.url, manufacturer);
      return {result, validation};
    })
  );

  // Filter and categorize
  const validResults = validationResults
    .filter(({validation}) => validation.valid)
    .map(({result}) => result);

  console.log(`[DOC-SEARCH] Valid results: ${validResults.length}`);

  // Simple categorization based on URL patterns
  const categorizedLinks: CategorizedLink[] = validResults.map((r) => {
    const urlLower = r.url.toLowerCase();
    let category = "product_page";
    if (urlLower.includes("epd") || urlLower.includes("environdec")) category = "epd";
    else if (urlLower.includes("hpd") || urlLower.includes("hpdrepository")) category = "hpd";
    else if (urlLower.includes("declare") || urlLower.includes("living-future")) category = "declare";
    else if (urlLower.includes("greenguard") || urlLower.includes("ul.com")) category = "voc";

    return {
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      category,
      confidence: 0.7,
      reason: `Categorized by URL pattern`,
    };
  });

  // Group by type
  const byType: Record<string, CategorizedLink[]> = {
    epd: categorizedLinks.filter((l) => l.category === "epd"),
    hpd: categorizedLinks.filter((l) => l.category === "hpd"),
    declare: categorizedLinks.filter((l) => l.category === "declare"),
    voc: categorizedLinks.filter((l) => l.category === "voc"),
    product_page: categorizedLinks.filter((l) => l.category === "product_page"),
  };

  console.log(`[DOC-SEARCH] Final: EPD=${byType.epd.length}, HPD=${byType.hpd.length}, Declare=${byType.declare.length}, VOC=${byType.voc.length}`);

  return {categorizedLinks, byType};
}

// ============================================================================
// MAIN SCAN FUNCTION
// ============================================================================

export const scanMaterial = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes - max for Firebase
    memory: "512MB",
  })
  .https.onRequest((req: Request, res: Response) => {
    corsHandler(req, res, async () => {
      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendProgress = (message: string) => {
        res.write(`data: ${JSON.stringify({type: "progress", message})}\n\n`);
      };

      const sendComplete = (data: unknown) => {
        res.write(`data: ${JSON.stringify({type: "complete", message: "Scan complete", data})}\n\n`);
        res.end();
      };

      const sendError = (error: string) => {
        res.write(`data: ${JSON.stringify({type: "error", message: error})}\n\n`);
        res.end();
      };

      try {
        if (req.method !== "POST") {
          sendError("Method not allowed");
          return;
        }

        const body: ScanRequest = req.body;

        if (!body.project || !body.material) {
          sendError("Invalid request: project and material are required");
          return;
        }

        console.log(`[SCAN] Starting scan for: ${body.material.name}`);
        sendProgress("Finding sustainable products...");

        const model = body.settings?.model || "sonar-pro";
        const conservativeMode = body.settings?.conservativeMode || false;

        // STAGE 1: Get product recommendations
        const productPrompt = buildProductSearchPrompt(
          body.material,
          body.project.goals,
          body.project.zip,
          conservativeMode,
          body.excludeProducts
        );

        let responseText: string;

        if (model.startsWith("sonar")) {
          const perplexity = getPerplexityClient();
          const response = await perplexity.chat.completions.create({
            model: model,
            messages: [
              {role: "system", content: PRODUCT_SEARCH_PROMPT},
              {role: "user", content: productPrompt},
            ],
            temperature: 0.1,
          });
          responseText = response.choices[0]?.message?.content || "";
        } else {
          const openai = getOpenAIClient();
          const response = await openai.chat.completions.create({
            model: model,
            messages: [
              {role: "system", content: PRODUCT_SEARCH_PROMPT},
              {role: "user", content: productPrompt},
            ],
            response_format: {type: "json_object"},
            temperature: 0.2,
          });
          responseText = response.choices[0]?.message?.content || "";
        }

        if (!responseText) {
          throw new Error("No response received from AI");
        }

        console.log(`[SCAN] Received AI response (${responseText.length} chars)`);

        // Parse response
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        } else {
          const startIdx = responseText.indexOf("{");
          const endIdx = responseText.lastIndexOf("}");
          if (startIdx !== -1 && endIdx !== -1) {
            jsonStr = responseText.slice(startIdx, endIdx + 1);
          }
        }

        let parsedResponse: AIResponse;
        try {
          parsedResponse = JSON.parse(jsonStr);
        } catch {
          console.error("[SCAN] Failed to parse AI response");
          throw new Error("Failed to parse AI response as JSON");
        }

        console.log(`[SCAN] Parsed ${parsedResponse.recommendations?.length || 0} recommendations`);
        sendProgress(`Found ${parsedResponse.recommendations?.length || 0} product recommendations`);

        // Sort by known documentation
        const sortedRecs = [...(parsedResponse.recommendations || [])].sort((a, b) => {
          const aScore = (a.has_known_epd ? 3 : 0) + (a.has_known_hpd ? 2 : 0) + (a.has_known_declare ? 1 : 0);
          const bScore = (b.has_known_epd ? 3 : 0) + (b.has_known_hpd ? 2 : 0) + (b.has_known_declare ? 1 : 0);
          return bScore - aScore;
        });

        // STAGE 2: Search for documentation
        const perplexityKey = process.env.PERPLEXITY_API_KEY;
        const recommendations: ProductRecommendation[] = [];
        const totalProducts = Math.min(sortedRecs.length, 3);

        for (let i = 0; i < totalProducts; i++) {
          const rec = sortedRecs[i];
          const productNum = i + 1;

          sendProgress(`Product ${productNum} of ${totalProducts}: ${rec.product_label}`);

          const docChecklist: DocChecklist = {
            epd: {status: "unverified", doc_url: null, registry_id: null},
            hpd: {status: "unverified", doc_url: null, registry_id: null},
            declare: {status: "unverified", doc_url: null, registry_id: null},
            voc: {status: "unverified", doc_url: null, registry_id: null},
          };

          let verifiedProductUrl: string | null = null;

          if (perplexityKey && rec.product_label) {
            try {
              sendProgress(`Searching documentation for ${rec.product_label}...`);

              const docSearch = await searchForDocumentation(
                rec.product_label,
                rec.manufacturer || null,
                perplexityKey
              );

              // Update checklist with best links
              if (docSearch.byType.epd.length > 0) {
                docChecklist.epd = {status: "verified", doc_url: docSearch.byType.epd[0].url, registry_id: null};
              }
              if (docSearch.byType.hpd.length > 0) {
                docChecklist.hpd = {status: "verified", doc_url: docSearch.byType.hpd[0].url, registry_id: null};
              }
              if (docSearch.byType.declare.length > 0) {
                docChecklist.declare = {status: "verified", doc_url: docSearch.byType.declare[0].url, registry_id: null};
              }
              if (docSearch.byType.voc.length > 0) {
                docChecklist.voc = {status: "verified", doc_url: docSearch.byType.voc[0].url, registry_id: null};
              }

              // Get product URL
              if (docSearch.byType.product_page.length > 0) {
                verifiedProductUrl = docSearch.byType.product_page[0].url;
              }

              const foundDocs: string[] = [];
              if (docSearch.byType.epd.length > 0) foundDocs.push(`${docSearch.byType.epd.length} EPD`);
              if (docSearch.byType.hpd.length > 0) foundDocs.push(`${docSearch.byType.hpd.length} HPD`);
              if (docSearch.byType.declare.length > 0) foundDocs.push(`${docSearch.byType.declare.length} Declare`);
              if (docSearch.byType.voc.length > 0) foundDocs.push(`${docSearch.byType.voc.length} VOC`);

              if (foundDocs.length > 0) {
                sendProgress(`Found: ${foundDocs.join(", ")}`);
              } else {
                sendProgress("No documentation links found");
              }
            } catch (error) {
              console.error(`[SCAN] Doc search failed for ${rec.product_label}:`, error);
              sendProgress(`Error searching documentation`);
            }
          }

          recommendations.push({
            product_label: rec.product_label || "Unknown Product",
            manufacturer: rec.manufacturer || null,
            manufacturer_url: rec.manufacturer_url || null,
            product_url: verifiedProductUrl || rec.product_url || null,
            image_url: null,
            rationale: rec.rationale || "",
            doc_checklist: docChecklist,
            distance_miles: null,
            confidence: rec.confidence || 0.5,
            has_known_epd: rec.has_known_epd,
            has_known_hpd: rec.has_known_hpd,
            has_known_declare: rec.has_known_declare,
          });
        }

        const result = {
          id: body.material.id,
          name: parsedResponse.name || body.material.name,
          normalized_category: parsedResponse.normalized_category || "Other",
          category_confidence: parsedResponse.category_confidence || 0.5,
          notes_for_user: parsedResponse.notes_for_user || "",
          recommendations,
        };

        console.log(`[SCAN] Complete for ${body.material.name}`);
        sendComplete(result);
      } catch (error) {
        console.error("[SCAN] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        sendError(`Scan failed: ${errorMessage}`);
      }
    });
  });

// Health check endpoint
export const health = functions.https.onRequest((req, res) => {
  corsHandler(req, res, () => {
    res.json({status: "ok", timestamp: new Date().toISOString()});
  });
});

