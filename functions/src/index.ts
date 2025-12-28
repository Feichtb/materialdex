import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2";
import OpenAI from "openai";
import {Request, Response} from "express";

// Initialize Firebase Admin
admin.initializeApp();

// Set global options for v2 functions
setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

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
  doc_search?: DocSearchResult; // Include doc_search for frontend display
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

type LinkConfidence =
  | "direct_document"
  | "catalog_page"
  | "product_line_doc"
  | "sustainability_page"
  | "news_article"
  | "general_page"
  | "wrong_manufacturer";

interface CategorizedLink {
  url: string;
  title: string;
  snippet: string;
  category: "epd" | "hpd" | "declare" | "voc" | "product_page" | "manufacturer" | "wrong_manufacturer" | "unknown";
  confidence: number;
  confidenceLevel: LinkConfidence;
  reason: string;
  needsVerification?: boolean;
}

interface DocSearchResult {
  categorizedLinks: CategorizedLink[];
  byType: {
    epd: CategorizedLink[];
    hpd: CategorizedLink[];
    declare: CategorizedLink[];
    voc: CategorizedLink[];
    product_page: CategorizedLink[];
  };
}

// Confidence scores
const CONFIDENCE_SCORES: Record<LinkConfidence, number> = {
  direct_document: 1.0,
  catalog_page: 0.85,
  product_line_doc: 0.75,
  sustainability_page: 0.6,
  news_article: 0.2,
  general_page: 0.3,
  wrong_manufacturer: 0,
};

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

/**
 * Detect likely fabricated/hallucinated URLs
 */
function isFabricatedUrl(url: string): boolean {
  const urlLower = url.toLowerCase();

  // Pattern 1: Generic product-based PDF names
  if (/[a-z]+epd\.pdf|[a-z]+hpd\.pdf|[a-z]+-epd\.pdf|[a-z]+-hpd\.pdf/i.test(urlLower)) {
    if (!urlLower.includes("environdec.com") &&
        !urlLower.includes("hpdrepository") &&
        !urlLower.includes("ul.com")) {
      return true;
    }
  }

  // Pattern 2: UUIDs in URLs (often fabricated)
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  if (uuidPattern.test(url) && !urlLower.includes("ul.com") && !urlLower.includes("spot.ul.com")) {
    return true;
  }

  // Pattern 3: Overly specific file paths
  if (/\/documents\/.*\/epd\/.*epd.*\.pdf$/i.test(urlLower)) {
    return true;
  }

  // Pattern 4: Very long paths
  const pathParts = url.split("/");
  if (pathParts.length > 8) {
    return true;
  }

  // Pattern 5: Suspiciously clean format
  if (/\/([\w-]+)-(epd|hpd|declare)\.pdf$/i.test(urlLower)) {
    if (!urlLower.includes("environdec") && !urlLower.includes("hpdrepository")) {
      return true;
    }
  }

  return false;
}

interface CombinedValidationResult {
  valid: boolean;
  usable: boolean;
  manufacturerMatch: boolean;
  reason: string;
}

async function validateUrlComplete(
  url: string,
  manufacturer: string | null
): Promise<CombinedValidationResult> {
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
// AI CATEGORIZATION
// ============================================================================

async function categorizeLinks(
  results: SearchResult[],
  productName: string,
  manufacturer: string | null,
  client: OpenAI
): Promise<CategorizedLink[]> {
  if (results.length === 0) return [];

  const linksText = results.map((r, i) =>
    `${i + 1}. URL: ${r.url}\n   Title: ${r.title}\n   Snippet: ${r.snippet}`
  ).join("\n\n");

  try {
    const response = await client.chat.completions.create({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: `You categorize sustainability documentation links with CONFIDENCE LEVELS.

## Categories:
- "epd": Environmental Product Declaration
- "hpd": Health Product Declaration  
- "declare": Declare label (Living Building Challenge)
- "voc": VOC certification, GREENGUARD
- "product_page": Product information (not certification)
- "manufacturer": General manufacturer page
- "wrong_manufacturer": Documentation for a COMPLETELY DIFFERENT manufacturer
- "unknown": Cannot determine

## Confidence Levels:
- "direct_document": Actual EPD/HPD PDF, or registry page
- "catalog_page": Documentation catalog, library, or downloads page
- "product_line_doc": Doc for SAME manufacturer but possibly different product variant
- "sustainability_page": Sustainability page that MAY CONTAIN links to actual docs
- "news_article": News/press release/announcement (NOT the actual doc)
- "general_page": General info page
- "wrong_manufacturer": Completely different manufacturer

Return JSON array:
[
  {
    "index": 1,
    "category": "epd",
    "confidenceLevel": "direct_document",
    "reason": "EPD PDF from manufacturer",
    "needsVerification": false,
    "manufacturerFound": true
  }
]`,
        },
        {
          role: "user",
          content: `Categorize these links for:
Product: ${productName}
${manufacturer ? `Manufacturer: ${manufacturer}` : ""}

Links to categorize:
${linksText}`,
        },
      ],
      temperature: 0,
    });

    const responseText = response.choices[0]?.message?.content || "";

    let categories: Array<{
      index: number;
      category: string;
      confidenceLevel: LinkConfidence;
      reason: string;
      needsVerification?: boolean;
    }> = [];

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        categories = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse categorization:", responseText);
    }

    return results.map((result, i) => {
      // Skip results with missing required fields
      if (!result.url || !result.title) {
        return {
          url: result.url || "",
          title: result.title || "",
          snippet: result.snippet || "",
          category: "unknown" as const,
          confidence: 0,
          confidenceLevel: "general_page" as LinkConfidence,
          reason: "Missing URL or title",
          needsVerification: false,
        };
      }

      const cat = categories.find((c) => c.index === i + 1);

      let confidenceLevel: LinkConfidence = "general_page";
      let category: CategorizedLink["category"] = "unknown";
      let reason = "Could not categorize";
      let needsVerification = false;

      if (cat) {
        confidenceLevel = cat.confidenceLevel || "general_page";
        category = cat.category as CategorizedLink["category"] || "unknown";
        reason = cat.reason || "";
        needsVerification = cat.needsVerification || false;
      }

      // Force correct categorization based on URL patterns
      const urlLower = result.url.toLowerCase();
      const titleLower = result.title.toLowerCase();

      // EPD detection
      if (urlLower.includes("environdec.com/library/epd")) {
        category = "epd";
        confidenceLevel = "direct_document";
        reason = "EPD from International EPD System";
      } else if ((urlLower.includes("epd") && urlLower.endsWith(".pdf")) ||
                 titleLower.includes("environmental product declaration")) {
        category = "epd";
        confidenceLevel = "direct_document";
        reason = "EPD document (PDF)";
      }
      // HPD detection
      else if (urlLower.includes("hpdrepository.hpd-collaborative.org") && urlLower.includes("/repository/")) {
        category = "hpd";
        confidenceLevel = "direct_document";
        reason = "HPD from HPD Repository";
      } else if ((urlLower.includes("hpd") && urlLower.endsWith(".pdf")) ||
                 titleLower.includes("health product declaration")) {
        category = "hpd";
        confidenceLevel = "direct_document";
        reason = "HPD document (PDF)";
      }
      // Declare detection
      else if (urlLower.includes("declare.living-future.org/products/")) {
        category = "declare";
        confidenceLevel = "direct_document";
        reason = "Declare label from Living Future";
      } else if (titleLower.includes("declare label") || titleLower.includes("red list free")) {
        category = "declare";
        confidenceLevel = "direct_document";
        reason = "Declare/Red List Free certification";
      }
      // VOC detection
      else if (urlLower.includes("spot.ul.com") && urlLower.includes("/products/")) {
        category = "voc";
        confidenceLevel = "direct_document";
        reason = "GREENGUARD/VOC from UL SPOT";
      } else if (titleLower.includes("greenguard") || urlLower.includes("greenguard")) {
        category = "voc";
        confidenceLevel = "direct_document";
        reason = "GREENGUARD certification";
      }

      // Get numeric confidence from level
      const confidence = CONFIDENCE_SCORES[confidenceLevel] || 0.3;

      return {
        ...result,
        category,
        confidence,
        confidenceLevel,
        reason,
        needsVerification,
      };
    });
  } catch (error) {
    console.error("Categorization error:", error);
    return results.map((r) => ({
      url: r.url || "",
      title: r.title || "",
      snippet: r.snippet || "",
      category: "unknown" as const,
      confidence: 0,
      confidenceLevel: "general_page" as LinkConfidence,
      reason: "Categorization failed",
      needsVerification: false,
    }));
  }
}

// ============================================================================
// DOC SEARCH (FULL VERSION WITH PROGRESS)
// ============================================================================

async function searchForDocumentation(
  productName: string,
  manufacturer: string | null,
  perplexityKey: string,
  onProgress?: (message: string) => void
): Promise<DocSearchResult> {
  console.log(`[DOC-SEARCH] Starting for: ${productName} (manufacturer: ${manufacturer || "none"})`);

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

  // Run searches in parallel with progress updates
  const searchPromises = searchQueries.map(async ({name, query}) => {
    try {
      console.log(`[DOC-SEARCH] Searching ${name}...`);
      onProgress?.(`Searching ${name} pages...`);

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
        // Clean up AI response - remove citation numbers like [1], [2] that break JSON
        let cleanedJson = jsonMatch[0]
          // Remove citation numbers in various positions
          .replace(/\[\d+\]/g, "")
          // Fix broken JSON from removed citations
          .replace(/,\s*,/g, ",")
          .replace(/,\s*\}/g, "}")
          .replace(/,\s*\]/g, "]")
          .replace(/\{\s*,/g, "{")
          .replace(/\[\s*,/g, "[");

        try {
          const parsed = JSON.parse(cleanedJson);
          const results = (parsed.results || [])
            .filter((r: SearchResult) => r && r.url && r.url.startsWith("http"))
            .filter((r: SearchResult) => r.title) // Ensure title exists
            .filter((r: SearchResult) => !isFabricatedUrl(r.url));

          console.log(`[DOC-SEARCH] Found ${results.length} ${name} results`);
          if (results.length > 0) {
            onProgress?.(`Found ${results.length} ${name} page${results.length > 1 ? "s" : ""}`);
          }
          return results;
        } catch (parseError) {
          console.log(`[DOC-SEARCH] JSON parse error for ${name}:`, parseError);
          return [];
        }
      }
    } catch (e) {
      console.log(`[DOC-SEARCH] Error searching ${name}:`, e);
    }
    return [];
  });

  const searchResults = await Promise.all(searchPromises);
  searchResults.forEach((results) => allResults.push(...results));

  // Filter out any results with missing fields
  const validResults = allResults.filter((r) => r && r.url && r.title);
  
  console.log(`[DOC-SEARCH] Total results: ${validResults.length}`);
  onProgress?.(`Found ${validResults.length} total pages`);

  // Categorize links using AI
  console.log(`[DOC-SEARCH] Categorizing ${validResults.length} links...`);
  onProgress?.(`Categorizing ${validResults.length} links...`);

  let categorizedLinks = await categorizeLinks(validResults, productName, manufacturer, client);

  // Validate URLs in parallel
  console.log(`[DOC-SEARCH] Validating ${categorizedLinks.length} URLs...`);
  onProgress?.(`Validating ${categorizedLinks.length} URLs...`);

  const linksToValidate = categorizedLinks.filter((l) => l.category !== "wrong_manufacturer" && l.category !== "unknown");

  const validationResults = await Promise.all(
    linksToValidate.map(async (link) => {
      const validation = await validateUrlComplete(link.url, manufacturer);
      return {url: link.url, validation};
    })
  );

  const validationMap = new Map(validationResults.map((r) => [r.url, r.validation]));

  // Update links based on validation
  categorizedLinks = categorizedLinks.map((link) => {
    const validation = validationMap.get(link.url);
    if (validation) {
      if (!validation.usable) {
        return {
          ...link,
          category: "unknown" as const,
          confidenceLevel: "general_page" as LinkConfidence,
          confidence: 0,
          reason: `REJECTED (not usable): ${validation.reason}`,
        };
      } else if (!validation.manufacturerMatch) {
        return {
          ...link,
          category: "wrong_manufacturer" as const,
          confidenceLevel: "wrong_manufacturer" as LinkConfidence,
          confidence: 0,
          reason: `REJECTED: ${validation.reason}`,
        };
      }
    }
    return link;
  });

  // Filter out invalid links
  categorizedLinks = categorizedLinks.filter((l) =>
    l.category !== "unknown" || !validationMap.has(l.url)
  );

  // Sort by confidence
  const sortedLinks = [...categorizedLinks].sort((a, b) => b.confidence - a.confidence);

  // Group by type
  const byType = {
    epd: sortedLinks.filter((l) => l.category === "epd"),
    hpd: sortedLinks.filter((l) => l.category === "hpd"),
    declare: sortedLinks.filter((l) => l.category === "declare"),
    voc: sortedLinks.filter((l) => l.category === "voc"),
    product_page: sortedLinks.filter((l) => l.category === "product_page"),
  };

  console.log(`[DOC-SEARCH] Final: EPD=${byType.epd.length}, HPD=${byType.hpd.length}, Declare=${byType.declare.length}, VOC=${byType.voc.length}`);

  // Send final summary
  const finalCounts: string[] = [];
  if (byType.epd.length > 0) finalCounts.push(`${byType.epd.length} EPD`);
  if (byType.hpd.length > 0) finalCounts.push(`${byType.hpd.length} HPD`);
  if (byType.declare.length > 0) finalCounts.push(`${byType.declare.length} Declare`);
  if (byType.voc.length > 0) finalCounts.push(`${byType.voc.length} VOC`);
  if (byType.product_page.length > 0) finalCounts.push(`${byType.product_page.length} product page${byType.product_page.length > 1 ? "s" : ""}`);

  if (finalCounts.length > 0) {
    onProgress?.(`Documentation search complete: ${finalCounts.join(", ")}`);
  } else {
    onProgress?.(`No documentation links found`);
  }

  return {categorizedLinks: sortedLinks, byType};
}

// ============================================================================
// MAIN SCAN FUNCTION
// ============================================================================

export const scanMaterial = onRequest(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: "512MiB",
    cors: true, // Enable CORS
  },
  (req: Request, res: Response) => {
    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.status(200).end();
      return;
    }

    // Set CORS headers for streaming responses
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Set headers for SSE - disable buffering for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    
    // Flush headers immediately to start streaming
    if (res.flushHeaders) {
      res.flushHeaders();
    }
    
    // Send initial connection message to establish SSE connection
    res.write(": connected\n\n");

    // Wrap the rest in an async function
    (async () => {

      // Keepalive mechanism to force delivery of buffered messages
      // Firebase Functions buffers responses, so we send periodic keepalives
      let keepaliveInterval: NodeJS.Timeout | null = null;
      const startKeepalive = () => {
        keepaliveInterval = setInterval(() => {
          try {
            res.write(": keepalive\n\n");
          } catch (err) {
            // Connection closed, stop keepalive
            if (keepaliveInterval) {
              clearInterval(keepaliveInterval);
              keepaliveInterval = null;
            }
          }
        }, 2000); // Send keepalive every 2 seconds
      };

      const stopKeepalive = () => {
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
          keepaliveInterval = null;
        }
      };

      startKeepalive();

      // Track product statuses for multi-line progress display
      const productStatuses: Array<{productNum: number; productName: string; status: string}> = [];
      
      const sendProgress = (message: string) => {
        try {
          const data = `data: ${JSON.stringify({type: "progress", message})}\n\n`;
          res.write(data);
          console.log(`[SCAN] Progress: ${message}`);
        } catch (err) {
          console.error("[SCAN] Error sending progress:", err);
          stopKeepalive();
        }
      };

      const sendProductStatus = (productStatuses: Array<{productNum: number; productName: string; status: string}>) => {
        try {
          // Sort by productNum to ensure consistent order
          const sorted = [...productStatuses].sort((a, b) => a.productNum - b.productNum);
          const data = `data: ${JSON.stringify({type: "productStatus", products: sorted})}\n\n`;
          res.write(data);
          console.log(`[SCAN] Sent product status:`, sorted.map(p => `P${p.productNum}: ${p.status}`).join(", "));
        } catch (err) {
          console.error("[SCAN] Error sending product status:", err);
          stopKeepalive();
        }
      };

      const updateProductStatus = (productNum: number, productName: string, status: string) => {
        const existingIndex = productStatuses.findIndex(p => p.productNum === productNum);
        if (existingIndex >= 0) {
          productStatuses[existingIndex].status = status;
          productStatuses[existingIndex].productName = productName; // Update name in case it changed
        } else {
          productStatuses.push({productNum, productName, status});
        }
        sendProductStatus(productStatuses);
      };

      const sendComplete = (data: unknown) => {
        stopKeepalive();
        res.write(`data: ${JSON.stringify({type: "complete", message: "Scan complete", data})}\n\n`);
        res.end();
      };

      const sendError = (error: string) => {
        stopKeepalive();
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
        const totalProducts = Math.min(sortedRecs.length, 3);

        // Auto-select threshold - only use links with high confidence
        const autoSelectThreshold = 0.8;

        // Initialize product statuses immediately after finding recommendations
        console.log(`[SCAN] Initializing ${totalProducts} product statuses`);
        for (let i = 0; i < totalProducts; i++) {
          const rec = sortedRecs[i];
          const productName = rec.product_label || "Unknown Product";
          console.log(`[SCAN] Initializing Product ${i + 1}: ${productName}`);
          updateProductStatus(i + 1, productName, "Waiting to start...");
        }
        
        // Force flush the initial statuses
        sendProductStatus(productStatuses);
        
        // Small delay to ensure message is sent and received
        await new Promise(resolve => setTimeout(resolve, 200));

        // Process all products concurrently using Promise.all
        const productPromises = sortedRecs.slice(0, totalProducts).map(async (rec, index) => {
          const productNum = index + 1;
          const productName = rec.product_label || "Unknown Product";

          updateProductStatus(productNum, productName, "Starting search...");

          const docChecklist: DocChecklist = {
            epd: {status: "unverified", doc_url: null, registry_id: null},
            hpd: {status: "unverified", doc_url: null, registry_id: null},
            declare: {status: "unverified", doc_url: null, registry_id: null},
            voc: {status: "unverified", doc_url: null, registry_id: null},
          };

          let verifiedProductUrl: string | null = null;
          let docSearch: DocSearchResult | undefined = undefined;

          if (perplexityKey && rec.product_label) {
            try {
              updateProductStatus(productNum, productName, "Searching documentation...");

              // Create progress callback with product context
              const productProgressCallback = (message: string) => {
                // Update product status with the message directly
                updateProductStatus(productNum, productName, message);
              };

              docSearch = await searchForDocumentation(
                rec.product_label,
                rec.manufacturer || null,
                perplexityKey,
                productProgressCallback
              );

              // Log confidence values for debugging
              if (docSearch.byType.epd.length > 0) {
                console.log(`[SCAN] EPD links found: ${docSearch.byType.epd.length}`);
                docSearch.byType.epd.forEach((link, idx) => {
                  console.log(`[SCAN]   EPD ${idx + 1}: ${link.url} - confidence: ${link.confidence}, level: ${link.confidenceLevel}`);
                });
              }

              // Update checklist with best links (only high confidence)
              if (docSearch.byType.epd.length > 0) {
                const sorted = docSearch.byType.epd.sort((a, b) => b.confidence - a.confidence);
                const best = sorted[0];
                console.log(`[SCAN] Best EPD: ${best.url} - confidence: ${best.confidence} (threshold: ${autoSelectThreshold})`);
                if (best && best.confidence >= autoSelectThreshold) {
                  docChecklist.epd = {status: "verified", doc_url: best.url, registry_id: null};
                } else {
                  console.log(`[SCAN] EPD link below threshold, not auto-selecting`);
                }
              }
              if (docSearch.byType.hpd.length > 0) {
                const sorted = docSearch.byType.hpd.sort((a, b) => b.confidence - a.confidence);
                const best = sorted[0];
                if (best && best.confidence >= autoSelectThreshold) {
                  docChecklist.hpd = {status: "verified", doc_url: best.url, registry_id: null};
                }
              }
              if (docSearch.byType.declare.length > 0) {
                const sorted = docSearch.byType.declare.sort((a, b) => b.confidence - a.confidence);
                const best = sorted[0];
                if (best && best.confidence >= autoSelectThreshold) {
                  docChecklist.declare = {status: "verified", doc_url: best.url, registry_id: null};
                }
              }
              if (docSearch.byType.voc.length > 0) {
                const sorted = docSearch.byType.voc.sort((a, b) => b.confidence - a.confidence);
                const best = sorted[0];
                if (best && best.confidence >= autoSelectThreshold) {
                  docChecklist.voc = {status: "verified", doc_url: best.url, registry_id: null};
                }
              }

              // Get product URL
              if (docSearch.byType.product_page.length > 0) {
                const validPages = docSearch.byType.product_page
                  .filter((l) => l.category !== "wrong_manufacturer")
                  .sort((a, b) => b.confidence - a.confidence);
                if (validPages.length > 0) {
                  verifiedProductUrl = validPages[0].url;
                }
              }

              // Send summary
              const foundDocs: string[] = [];
              if (docSearch.byType.epd.filter((l) => l.confidence >= autoSelectThreshold).length > 0) {
                foundDocs.push("EPD");
              }
              if (docSearch.byType.hpd.filter((l) => l.confidence >= autoSelectThreshold).length > 0) {
                foundDocs.push("HPD");
              }
              if (docSearch.byType.declare.filter((l) => l.confidence >= autoSelectThreshold).length > 0) {
                foundDocs.push("Declare");
              }
              if (docSearch.byType.voc.filter((l) => l.confidence >= autoSelectThreshold).length > 0) {
                foundDocs.push("VOC");
              }

              if (foundDocs.length > 0) {
                updateProductStatus(productNum, productName, `Complete - Found: ${foundDocs.join(", ")}`);
              } else {
                updateProductStatus(productNum, productName, "Complete - No high-confidence docs found");
              }
            } catch (error) {
              console.error(`[SCAN] Doc search failed for ${rec.product_label}:`, error);
              updateProductStatus(productNum, productName, "Error searching documentation");
            }
          } else {
            updateProductStatus(productNum, productName, "Skipped (no API key)");
          }

          return {
            product_label: rec.product_label || "Unknown Product",
            manufacturer: rec.manufacturer || null,
            manufacturer_url: rec.manufacturer_url || null,
            product_url: verifiedProductUrl || rec.product_url || null,
            image_url: null,
            rationale: rec.rationale || "",
            doc_checklist: docChecklist,
            distance_miles: null,
            confidence: rec.confidence || 0.5,
            doc_search: docSearch, // Include doc_search so frontend can display links
            has_known_epd: rec.has_known_epd,
            has_known_hpd: rec.has_known_hpd,
            has_known_declare: rec.has_known_declare,
          };
        });

        // Wait for all product searches to complete concurrently
        const recommendations = await Promise.all(productPromises);
        
        // Mark all as complete
        for (let i = 0; i < totalProducts; i++) {
          const rec = recommendations[i];
          const currentStatus = productStatuses[i]?.status || "Complete";
          if (!currentStatus.includes("Complete") && !currentStatus.includes("Error")) {
            updateProductStatus(i + 1, rec.product_label, "Complete");
          }
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
    })();
  }
);

// Health check endpoint
export const health = onRequest(
  {
    cors: true,
  },
  (req: Request, res: Response) => {
    res.json({status: "ok", timestamp: new Date().toISOString()});
  }
);
