/**
 * Documentation Search Module
 * 
 * Searches for ALL documentation types (EPD, HPD, Declare, VOC) in one query,
 * then uses AI to categorize each result with confidence levels.
 * Also includes industry-wide EPDs as fallback/baseline references.
 * 
 * NEW: Validates URLs by fetching content and checking for manufacturer name.
 */

import OpenAI from 'openai';
import { findIndustryWideEpds, IndustryWideDoc } from '@/data/industryWideEpds';
import { validateUrlComplete, CombinedValidationResult } from './urlValidator';

// Debug flag - set to true to see search logs
const DEBUG = true;

// URL validation is always enabled for quality results
// We use combined validation (one fetch instead of two) to be efficient

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log('[DOC-SEARCH]', ...args);
  }
}

/**
 * Detect likely fabricated/hallucinated URLs
 * AI tends to generate URLs that look plausible but don't exist
 */
function isFabricatedUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  // Pattern 1: Generic product-based PDF names (AI loves these)
  // e.g., "HardiePlankEPD.pdf", "ProductName-HPD.pdf"
  if (/[a-z]+epd\.pdf|[a-z]+hpd\.pdf|[a-z]+-epd\.pdf|[a-z]+-hpd\.pdf/i.test(urlLower)) {
    // Allow known registry URLs
    if (!urlLower.includes('environdec.com') && 
        !urlLower.includes('hpdrepository') && 
        !urlLower.includes('ul.com')) {
      return true;
    }
  }
  
  // Pattern 2: UUIDs in URLs (often fabricated)
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  if (uuidPattern.test(url) && !urlLower.includes('ul.com') && !urlLower.includes('spot.ul.com')) {
    // UUIDs in random domains are suspicious
    return true;
  }
  
  // Pattern 3: Overly specific file paths that look generated
  // e.g., "/documents/sustainability/epd/product-name-2024-epd.pdf"
  if (/\/documents\/.*\/epd\/.*epd.*\.pdf$/i.test(urlLower)) {
    return true;
  }
  
  // Pattern 4: Very long paths with product name repeated
  const pathParts = url.split('/');
  if (pathParts.length > 8) {
    return true; // Suspiciously deep paths
  }
  
  // Pattern 5: URLs that have the exact product name in a suspiciously clean format
  // This catches things like "manufacturer.com/product-exact-name-EPD.pdf"
  if (/\/([\w-]+)-(epd|hpd|declare)\.pdf$/i.test(urlLower)) {
    // But allow actual registries
    if (!urlLower.includes('environdec') && !urlLower.includes('hpdrepository')) {
      return true;
    }
  }
  
  return false;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export type LinkConfidence = 
  | 'direct_document'      // Actual EPD/HPD/Declare PDF or registry page
  | 'catalog_page'         // Product catalog/library page with doc
  | 'product_line_doc'     // Doc for same manufacturer, possibly different variant
  | 'sustainability_page'  // Sustainability page that may link to docs
  | 'news_article'         // News/announcement about certification
  | 'general_page'         // General page, low confidence
  | 'wrong_manufacturer';  // Different manufacturer entirely

export interface CategorizedLink {
  url: string;
  title: string;
  snippet: string;
  category: 'epd' | 'hpd' | 'declare' | 'voc' | 'product_page' | 'manufacturer' | 'wrong_manufacturer' | 'unknown';
  confidence: number;
  confidenceLevel: LinkConfidence;
  reason: string;
  needsVerification?: boolean; // True if user should double-check this is the right variant
}

export interface DocSearchResult {
  product: string;
  manufacturer: string | null;
  searchQuery: string;
  rawResults: SearchResult[];
  categorizedLinks: CategorizedLink[];
  byType: {
    epd: CategorizedLink[];
    hpd: CategorizedLink[];
    declare: CategorizedLink[];
    voc: CategorizedLink[];
    product_page: CategorizedLink[];
    other: CategorizedLink[];
  };
  industryWideEpds: IndustryWideDoc[]; // Fallback industry-wide documentation
}

// Confidence level descriptions for UI
export const CONFIDENCE_DESCRIPTIONS: Record<LinkConfidence, { label: string; score: number; color: string }> = {
  direct_document: { label: 'Direct Doc', score: 1.0, color: 'text-green-400' },
  catalog_page: { label: 'Doc Catalog', score: 0.85, color: 'text-green-300' },
  product_line_doc: { label: 'Product Line', score: 0.75, color: 'text-lime-400' }, // Same mfg, verify variant
  sustainability_page: { label: 'Sustainability', score: 0.6, color: 'text-yellow-400' },
  news_article: { label: 'News', score: 0.2, color: 'text-orange-400' },
  general_page: { label: 'General', score: 0.3, color: 'text-gray-400' },
  wrong_manufacturer: { label: 'Wrong Mfg', score: 0, color: 'text-red-400' },
};

/**
 * Search for all documentation types at once, INCLUDING product pages
 * With optional progress callback
 */
export async function searchForDocumentation(
  productName: string,
  manufacturer: string | null,
  perplexityApiKey: string,
  onProgress?: (message: string) => void
): Promise<DocSearchResult> {
  return searchForDocumentationWithProgress(productName, manufacturer, perplexityApiKey, onProgress);
}

/**
 * Search for all documentation types at once, INCLUDING product pages
 * With progress callback support
 */
export async function searchForDocumentationWithProgress(
  productName: string,
  manufacturer: string | null,
  perplexityApiKey: string,
  onProgress?: (message: string) => void
): Promise<DocSearchResult> {
  debugLog(`Starting doc search for: ${productName} (manufacturer: ${manufacturer || 'not specified'})`);
  
  const searchTerms = manufacturer 
    ? `${manufacturer} ${productName}`
    : productName;
  
  // Search for documentation AND product pages
  const searchQuery = `${searchTerms} product page OR EPD environmental product declaration OR HPD health product declaration OR Declare label OR specifications`;

  const client = new OpenAI({
    apiKey: perplexityApiKey,
    baseURL: 'https://api.perplexity.ai',
  });

  let rawResults: SearchResult[] = [];

  try {
    // Run SEPARATE targeted searches for each document type
    // This ensures we actually find EPDs/HPDs instead of just product pages
    
    const searchQueries = [
      {
        name: 'EPD',
        query: `${manufacturer || productName} EPD environmental product declaration PDF`,
        sites: 'environdec.com OR manufacturer website'
      },
      {
        name: 'HPD',
        query: `${manufacturer || productName} HPD health product declaration PDF`,
        sites: 'hpdrepository.hpd-collaborative.org OR manufacturer website'
      },
      {
        name: 'Declare',
        query: `${manufacturer || productName} Declare label Red List Free`,
        sites: 'declare.living-future.org OR manufacturer website'
      },
      {
        name: 'VOC',
        query: `${manufacturer || productName} GREENGUARD VOC certification`,
        sites: 'spot.ul.com OR manufacturer website'
      },
      {
        name: 'Product Page',
        query: `${manufacturer || productName} product page`,
        sites: 'manufacturer website'
      }
    ];

    // Run searches in parallel with timeout
    const searchPromises = searchQueries.map(async ({ name, query, sites }) => {
      try {
        debugLog(`\nSearching for ${name}...`);
        onProgress?.(`Searching ${name} pages...`);
        
        const searchResponse = await client.chat.completions.create({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: `You are finding ${name} documentation for building products.

## YOUR TASK:
Find REAL, WORKING links for ${name} documentation.

## CRITICAL REQUIREMENTS:
- Return ONLY URLs that are REAL and WORKING (not 404s, not homepages)
- Each URL must be a SPECIFIC page/document (not a generic homepage or search page)
- For EPDs/HPDs: Look for PDFs with "EPD" or "HPD" in filename
- Return up to 5 results per search

## RETURN FORMAT:
Return ONLY real URLs as JSON (no citation numbers):
{
  "results": [
    {"url": "https://example.com/document.pdf", "title": "Document Title", "snippet": "Description..."}
  ]
}

## DO NOT RETURN:
- Generic homepages
- Empty search pages
- Category pages without specific products
- Citation numbers like [1] or [4]`,
            },
            {
              role: 'user',
              content: `Find ${name} documentation for:
Product: ${productName}
${manufacturer ? `Manufacturer: ${manufacturer}` : ''}

Search query: ${query}
Check these sites: ${sites}

Return SPECIFIC document pages (NOT homepages, NOT category pages).`,
            },
          ],
          temperature: 0,
        });

        const searchText = searchResponse.choices[0]?.message?.content || '';
        
        try {
          const jsonMatch = searchText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let cleanedJson = jsonMatch[0]
              .replace(/\}\s*\[\d+\]\s*,/g, '},')
              .replace(/\}\s*\[\d+\]\s*\]/g, '}]')
              .replace(/"\s*\[\d+\]\s*,/g, '",')
              .replace(/"\s*\[\d+\]\s*\}/g, '"}');
            
            const parsed = JSON.parse(cleanedJson);
            const results = (parsed.results || [])
              .filter((r: SearchResult) => r.url && r.url.startsWith('http'))
              .filter((r: SearchResult) => !isFabricatedUrl(r.url));
            
            debugLog(`  Found ${results.length} ${name} results`);
            if (results.length > 0) {
              onProgress?.(`Found ${results.length} ${name} page${results.length > 1 ? 's' : ''}`);
            }
            return results;
          }
        } catch (e) {
          debugLog(`  Failed to parse ${name} search: ${e}`);
        }
        return [];
      } catch (e) {
        debugLog(`  Error searching for ${name}: ${e}`);
        return [];
      }
    });

    // Wait for all searches to complete
    const allSearchResults = await Promise.all(searchPromises);
    
    // Combine all results
    rawResults = allSearchResults.flat();
    
    // Count results by type
    const resultCounts: Record<string, number> = {};
    searchQueries.forEach(({ name }, index) => {
      resultCounts[name] = allSearchResults[index].length;
    });
    
    debugLog(`\nTotal results from all searches: ${rawResults.length}`);
    onProgress?.(`Found ${rawResults.length} total pages (${Object.entries(resultCounts).filter(([_, count]) => count > 0).map(([name, count]) => `${count} ${name}`).join(', ')})`);
    rawResults.forEach((r, i) => {
      debugLog(`  ${i + 1}. ${r.title} - ${r.url}`);
    });

    // Step 2: Categorize each link with confidence levels
    debugLog(`\nStep 2: Categorizing ${rawResults.length} links...`);
    onProgress?.(`Categorizing ${rawResults.length} links by document type...`);
    
    let categorizedLinks = await categorizeLinks(
      rawResults,
      productName,
      manufacturer,
      client
    );
    
    debugLog(`After categorization: ${categorizedLinks.length} links`);
    categorizedLinks.forEach((l, i) => {
      debugLog(`  ${i + 1}. [${l.category}] ${l.title} - confidence: ${l.confidence}`);
    });
    
    // Count by category
    const categoryCounts: Record<string, number> = {};
    categorizedLinks.forEach(link => {
      if (link.category !== 'wrong_manufacturer') {
        categoryCounts[link.category] = (categoryCounts[link.category] || 0) + 1;
      }
    });
    
    const categorySummary = Object.entries(categoryCounts)
      .map(([cat, count]) => `${count} ${cat.toUpperCase()}`)
      .join(', ');
    if (categorySummary) {
      onProgress?.(`Categorized: ${categorySummary}`);
    }

    // Step 3: COMBINED validation - validates URL usability AND manufacturer in ONE fetch
    // This validates ALL URLs including registry URLs (they can also be wrong/fabricated)
    debugLog(`\nStep 3: Combined URL validation (usability + manufacturer)`);
    
    // Filter out already-rejected links
    const linksToValidate = categorizedLinks
      .filter(l => l.category !== 'wrong_manufacturer' && l.category !== 'unknown');
    
    debugLog(`Validating ${linksToValidate.length} links...`);
    onProgress?.(`Validating ${linksToValidate.length} URLs...`);
    
    // Validate in parallel - ONE fetch per URL validates both usability and manufacturer
    const validationResults = await Promise.all(
      linksToValidate.map(async (link, index) => {
        try {
          if (index % 2 === 0 || index === linksToValidate.length - 1) {
            onProgress?.(`Validating URLs... (${index + 1}/${linksToValidate.length})`);
          }
          const result = await validateUrlComplete(link.url, manufacturer);
          return { url: link.url, result };
        } catch (e) {
          debugLog(`  Validation error for ${link.url}: ${e}`);
          return { 
            url: link.url, 
            result: { 
              valid: true, 
              usable: true, 
              manufacturerMatch: true, 
              reason: 'Validation error - assuming valid' 
            } as CombinedValidationResult
          };
        }
      })
    );

    debugLog(`Validation results:`);
    validationResults.forEach(({ url, result }) => {
      debugLog(`  ${result.valid ? '✓' : '✗'} ${url}`);
      debugLog(`    Usable: ${result.usable}, Manufacturer: ${result.manufacturerMatch}`);
      debugLog(`    Reason: ${result.reason}`);
    });

    // Update links based on validation
    const validationMap = new Map(validationResults.map(r => [r.url, r.result]));
    
    const beforeCount = categorizedLinks.filter(l => l.category !== 'wrong_manufacturer').length;
    
    categorizedLinks = categorizedLinks.map(link => {
      const validation = validationMap.get(link.url);
      if (validation) {
        if (!validation.usable) {
          // URL is not usable (404, empty page, etc.)
          return {
            ...link,
            category: 'unknown' as const,
            confidenceLevel: 'general_page' as const,
            confidence: 0,
            reason: `REJECTED (not usable): ${validation.reason}`,
          };
        } else if (!validation.manufacturerMatch) {
          // URL is usable but wrong manufacturer
          return {
            ...link,
            category: 'wrong_manufacturer' as const,
            confidenceLevel: 'wrong_manufacturer' as const,
            confidence: 0,
            reason: `REJECTED: ${validation.reason}`,
          };
        }
      }
      return link;
    });
    
    // Filter out invalid links
    categorizedLinks = categorizedLinks.filter(l => l.category !== 'unknown' || !validationMap.has(l.url));
    
    const afterCount = categorizedLinks.filter(l => l.category !== 'wrong_manufacturer').length;
    debugLog(`Links: ${beforeCount} before validation → ${afterCount} after validation`);
    
    const removedCount = beforeCount - afterCount;
    if (removedCount > 0) {
      onProgress?.(`Removed ${removedCount} invalid/wrong manufacturer link${removedCount > 1 ? 's' : ''}`);
    } else {
      onProgress?.(`All ${afterCount} links validated successfully`);
    }

    // Sort by confidence within each category
    const sortedLinks = [...categorizedLinks].sort((a, b) => b.confidence - a.confidence);

    // Group by type (exclude wrong_manufacturer from main categories)
    const byType = {
      epd: sortedLinks.filter(l => l.category === 'epd'),
      hpd: sortedLinks.filter(l => l.category === 'hpd'),
      declare: sortedLinks.filter(l => l.category === 'declare'),
      voc: sortedLinks.filter(l => l.category === 'voc'),
      product_page: sortedLinks.filter(l => l.category === 'product_page'),
      other: sortedLinks.filter(l => ['manufacturer', 'unknown', 'wrong_manufacturer'].includes(l.category)),
    };
    
    debugLog(`\nFinal results by type:`);
    debugLog(`  EPD: ${byType.epd.length} links`);
    debugLog(`  HPD: ${byType.hpd.length} links`);
    debugLog(`  Declare: ${byType.declare.length} links`);
    debugLog(`  VOC: ${byType.voc.length} links`);
    debugLog(`  Product Page: ${byType.product_page.length} links`);
    debugLog(`  Other/Rejected: ${byType.other.length} links`);
    
    // Send final summary
    const finalCounts: string[] = [];
    if (byType.epd.length > 0) finalCounts.push(`${byType.epd.length} EPD`);
    if (byType.hpd.length > 0) finalCounts.push(`${byType.hpd.length} HPD`);
    if (byType.declare.length > 0) finalCounts.push(`${byType.declare.length} Declare`);
    if (byType.voc.length > 0) finalCounts.push(`${byType.voc.length} VOC`);
    if (byType.product_page.length > 0) finalCounts.push(`${byType.product_page.length} product page${byType.product_page.length > 1 ? 's' : ''}`);
    
    if (finalCounts.length > 0) {
      onProgress?.(`Documentation search complete: ${finalCounts.join(', ')}`);
    } else {
      onProgress?.(`Documentation search complete: No links found`);
    }
    
    // Find applicable industry-wide EPDs as fallback/baseline references
    const industryWideEpds = findIndustryWideEpds(productName);

    return {
      product: productName,
      manufacturer,
      searchQuery,
      rawResults,
      categorizedLinks: sortedLinks,
      byType,
      industryWideEpds,
    };
  } catch (error) {
    console.error('Documentation search error:', error);
    // Still try to find industry-wide EPDs even if search fails
    const industryWideEpds = findIndustryWideEpds(productName);
    return {
      product: productName,
      manufacturer,
      searchQuery,
      rawResults: [],
      categorizedLinks: [],
      byType: { epd: [], hpd: [], declare: [], voc: [], product_page: [], other: [] },
      industryWideEpds,
    };
  }
}

/**
 * Check if manufacturer name (or variations) appears in text content
 */
function manufacturerFoundInText(manufacturer: string, text: string): boolean {
  if (!manufacturer || !text) return false;
  
  const textLower = text.toLowerCase();
  const mfgLower = manufacturer.toLowerCase();
  
  // Direct match
  if (textLower.includes(mfgLower)) return true;
  
  // Common variations/keywords for manufacturer names
  const mfgWords = mfgLower.split(/[\s-]+/).filter(w => w.length > 2);
  
  // Check if majority of words are found
  const foundWords = mfgWords.filter(word => textLower.includes(word));
  if (foundWords.length >= Math.ceil(mfgWords.length * 0.6)) return true;
  
  return false;
}

/**
 * Use AI to categorize each link with detailed confidence levels
 */
async function categorizeLinks(
  results: SearchResult[],
  productName: string,
  manufacturer: string | null,
  client: OpenAI
): Promise<CategorizedLink[]> {
  if (results.length === 0) return [];

  const linksText = results.map((r, i) => 
    `${i + 1}. URL: ${r.url}\n   Title: ${r.title}\n   Snippet: ${r.snippet}`
  ).join('\n\n');

  try {
    const response = await client.chat.completions.create({
      model: 'sonar',
      messages: [
        {
          role: 'system',
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
- "direct_document": Actual EPD/HPD PDF, or registry page (environdec.com/library/epd###, etc)
- "catalog_page": Documentation catalog, library, or downloads page
- "product_line_doc": Doc for SAME manufacturer but possibly different product variant (STILL USEFUL!)
- "sustainability_page": Sustainability page that MAY CONTAIN links to actual docs
- "news_article": News/press release/announcement (NOT the actual doc)
- "general_page": General info page
- "wrong_manufacturer": Completely different manufacturer (SKIP these)

## CRITICAL MANUFACTURER CHECK:
- Look for the manufacturer name in the URL domain, title, and snippet
- If the target manufacturer is "James Hardie" but the link is about "CertainTeed", mark as "wrong_manufacturer"
- Same industry does NOT mean same manufacturer - be strict about this!

## CRITICAL RULES:
1. BE LENIENT about product variants! If same manufacturer, it's useful even if slightly different product
2. Only mark "wrong_manufacturer" if it's a COMPLETELY DIFFERENT company
3. Mark "product_line_doc" if the doc is for same manufacturer's product line/family
4. A NEWS ARTICLE announcing an EPD is NOT the actual EPD - mark as "news_article"
5. CHECK IF MANUFACTURER NAME appears in title/snippet - if not, increase suspicion of wrong manufacturer

Return JSON array:
[
  {
    "index": 1,
    "category": "epd",
    "confidenceLevel": "product_line_doc",
    "reason": "EPD covers manufacturer's siding product line - verify exact variant",
    "needsVerification": true,
    "manufacturerFound": true
  }
]`,
        },
        {
          role: 'user',
          content: `Categorize these links for:
Product: ${productName}
${manufacturer ? `Manufacturer: ${manufacturer}` : ''}

Links to categorize:
${linksText}

IMPORTANT:
- Be LENIENT about product variants within the same manufacturer
- Only mark "wrong_manufacturer" if it's a completely different company
- If doc is for same manufacturer but different product variant, use "product_line_doc" and set needsVerification: true
- CHECK if the manufacturer name "${manufacturer || 'unknown'}" appears in each link's title or snippet
- If manufacturer name is NOT found and it's not a registry page, be more skeptical`,
        },
      ],
      temperature: 0,
    });

    const responseText = response.choices[0]?.message?.content || '';
    
    let categories: Array<{
      index: number;
      category: string;
      confidenceLevel: LinkConfidence;
      reason: string;
      needsVerification?: boolean;
      manufacturerFound?: boolean;
    }> = [];
    
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        categories = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('Failed to parse categorization:', responseText);
    }

    // Merge with original results and calculate numeric confidence
    return results.map((result, i) => {
      const cat = categories.find(c => c.index === i + 1);
      
      let confidenceLevel: LinkConfidence = 'general_page';
      let category = 'unknown';
      let reason = 'Could not categorize';
      let needsVerification = false;
      
      if (cat) {
        confidenceLevel = cat.confidenceLevel || 'general_page';
        category = cat.category || 'unknown';
        reason = cat.reason || '';
        needsVerification = cat.needsVerification || false;
      }
      
      // FORCE correct categorization based on URL patterns (AI often gets this wrong)
      const urlLowerForCat = result.url.toLowerCase();
      const titleLowerForCat = result.title.toLowerCase();
      
      // Exclude technical reports and other non-EPD documents
      const isTechnicalReport = 
        urlLowerForCat.includes('icc-es.org') ||
        urlLowerForCat.includes('icc-es') ||
        titleLowerForCat.includes('icc-es') ||
        titleLowerForCat.includes('technical report') ||
        titleLowerForCat.includes('esr-');
      
      // EPD detection - multiple sources
      if (urlLowerForCat.includes('environdec.com/library/epd')) {
        category = 'epd';
        confidenceLevel = 'direct_document';
        reason = 'EPD from International EPD System (environdec.com)';
        debugLog(`  Force-categorized as EPD (environdec): ${result.url}`);
      }
      // EPD from manufacturer site (PDF with EPD in name or title) - but NOT technical reports
      else if (!isTechnicalReport && (
               (urlLowerForCat.includes('epd') && urlLowerForCat.endsWith('.pdf')) ||
               (titleLowerForCat.includes('epd') && (titleLowerForCat.includes('pdf') || titleLowerForCat.includes('environmental'))) ||
               (titleLowerForCat.includes('environmental product declaration')))) {
        category = 'epd';
        confidenceLevel = 'direct_document';
        reason = 'EPD document (PDF)';
        debugLog(`  Force-categorized as EPD (PDF): ${result.url}`);
      }
      // HPD detection - repository
      else if (urlLowerForCat.includes('hpdrepository.hpd-collaborative.org') && urlLowerForCat.includes('/repository/')) {
        category = 'hpd';
        confidenceLevel = 'direct_document';
        reason = 'HPD from HPD Repository';
      }
      // HPD from manufacturer site (PDF with HPD in name or title)
      else if ((urlLowerForCat.includes('hpd') && urlLowerForCat.endsWith('.pdf')) ||
               (titleLowerForCat.includes('hpd') && titleLowerForCat.includes('pdf')) ||
               (titleLowerForCat.includes('health product declaration'))) {
        category = 'hpd';
        confidenceLevel = 'direct_document';
        reason = 'HPD document (PDF)';
        debugLog(`  Force-categorized as HPD (PDF): ${result.url}`);
      }
      // Declare detection
      else if (urlLowerForCat.includes('declare.living-future.org/products/')) {
        category = 'declare';
        confidenceLevel = 'direct_document';
        reason = 'Declare label from Living Future';
      }
      // Declare from title
      else if (titleLowerForCat.includes('declare label') || titleLowerForCat.includes('red list free')) {
        category = 'declare';
        confidenceLevel = 'direct_document';
        reason = 'Declare/Red List Free certification';
        debugLog(`  Force-categorized as Declare: ${result.url}`);
      }
      // GREENGUARD/VOC detection from UL SPOT
      else if (urlLowerForCat.includes('spot.ul.com') && urlLowerForCat.includes('/main-app/products/')) {
        category = 'voc';
        confidenceLevel = 'direct_document';
        reason = 'GREENGUARD/VOC from UL SPOT';
      }
      // GREENGUARD from title/URL
      else if (titleLowerForCat.includes('greenguard') || urlLowerForCat.includes('greenguard')) {
        category = 'voc';
        confidenceLevel = 'direct_document';
        reason = 'GREENGUARD certification';
        debugLog(`  Force-categorized as VOC/GREENGUARD: ${result.url}`);
      }
      
      // Filter out generic registry homepages (not useful)
      const isGenericHomepage = 
        result.url === 'https://hpdrepository.hpd-collaborative.org' ||
        result.url === 'https://hpdrepository.hpd-collaborative.org/' ||
        result.url === 'https://declare.living-future.org' ||
        result.url === 'https://declare.living-future.org/' ||
        result.url === 'https://spot.ul.com' ||
        result.url === 'https://spot.ul.com/' ||
        result.url === 'https://www.environdec.com' ||
        result.url === 'https://www.environdec.com/';
      
      if (isGenericHomepage) {
        category = 'unknown';
        confidenceLevel = 'general_page';
        reason = 'Generic registry homepage - not a specific product';
        debugLog(`  Rejected generic homepage: ${result.url}`);
      }
      
      // Manufacturer check - skip for registry URLs with specific product paths
      const isSpecificRegistryUrl = 
        (urlLowerForCat.includes('environdec.com/library/epd')) ||
        (urlLowerForCat.includes('hpdrepository') && urlLowerForCat.includes('/repository/')) ||
        (urlLowerForCat.includes('declare.living-future.org/products/')) ||
        (urlLowerForCat.includes('spot.ul.com') && urlLowerForCat.includes('/products/'));
      
      if (manufacturer && !isSpecificRegistryUrl && !isGenericHomepage) {
        const combinedText = `${result.title} ${result.snippet} ${result.url}`;
        const mfgFound = manufacturerFoundInText(manufacturer, combinedText);
        
        // If manufacturer NOT found, flag for verification
        if (!mfgFound) {
          needsVerification = true;
          reason = `⚠️ "${manufacturer}" not in title/snippet - needs URL verification. ${reason}`;
          debugLog(`  Flagging for verification: ${result.url}`);
        }
      }
      
      // Apply additional URL-based heuristics
      const urlLower = result.url.toLowerCase();
      const titleLower = result.title.toLowerCase();
      
      // Detect news articles by URL patterns
      if (urlLower.includes('/news/') || urlLower.includes('/blog/') || 
          urlLower.includes('/press/') || urlLower.includes('/article/') ||
          titleLower.includes('publishes') || titleLower.includes('announces') ||
          titleLower.includes('receives') || titleLower.includes('achieves')) {
        confidenceLevel = 'news_article';
        reason = 'News article or announcement (not the actual document)';
      }
      
      // Boost registry URLs
      if (urlLower.includes('environdec.com/library/epd') ||
          urlLower.includes('hpdrepository.hpd-collaborative.org') ||
          urlLower.includes('declare.living-future.org/products/')) {
        confidenceLevel = 'direct_document';
      }
      
      // Detect catalog/documentation pages
      if (urlLower.includes('/catalog/') || urlLower.includes('/documentation/') ||
          urlLower.includes('/downloads/') || urlLower.includes('/resources/')) {
        if (confidenceLevel !== 'direct_document') {
          confidenceLevel = 'catalog_page';
        }
      }
      
      // Detect sustainability pages
      if (urlLower.includes('/sustainability') && confidenceLevel === 'general_page') {
        confidenceLevel = 'sustainability_page';
        reason = 'Sustainability page - may contain links to actual documents';
      }
      
      // If it's a product line doc, mark it as needing verification
      if (confidenceLevel === 'product_line_doc') {
        needsVerification = true;
        if (!reason.toLowerCase().includes('verify')) {
          reason = reason + ' (verify exact product variant)';
        }
      }
      
      // Get numeric confidence from level
      const confidence = CONFIDENCE_DESCRIPTIONS[confidenceLevel]?.score || 0.3;

      return {
        ...result,
        category: category as CategorizedLink['category'],
        confidence,
        confidenceLevel,
        reason,
        needsVerification,
      };
    });
  } catch (error) {
    console.error('Categorization error:', error);
    return results.map(r => ({
      ...r,
      category: 'unknown' as const,
      confidence: 0,
      confidenceLevel: 'general_page' as LinkConfidence,
      reason: 'Categorization failed',
    }));
  }
}

/**
 * Build manual search URL
 */
export function buildDocSearchUrl(productName: string, manufacturer: string | null): string {
  const query = encodeURIComponent(
    `${manufacturer ? manufacturer + ' ' : ''}${productName} EPD environmental product declaration PDF`
  );
  return `https://www.google.com/search?q=${query}`;
}
