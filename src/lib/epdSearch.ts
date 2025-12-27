/**
 * EPD Search Module
 * 
 * Stage 2 of the pipeline: Search for actual EPD documents
 * using web search, then filter/rank the results.
 */

import OpenAI from 'openai';

export interface EPDCandidate {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  score: number; // Ranking score
  isLikelyEPD: boolean;
}

export interface EPDSearchResult {
  product: string;
  manufacturer: string | null;
  candidates: EPDCandidate[];
  bestMatch: EPDCandidate | null;
  searchQuery: string;
}

// Domains that are likely to have valid EPDs
const EPD_PRIORITY_DOMAINS = [
  'environdec.com',      // Priority 1: Environdec library
  'spot.ul.com',         // Priority 2: UL SPOT
  'nsf.org',             // Priority 3: NSF
  'icc-es.org',          // Priority 4: ICC-ES
];

// Patterns that indicate a real EPD page (not a search results page)
const EPD_POSITIVE_PATTERNS = [
  /\/library\/epd\d+/i,           // environdec.com/library/epd5037
  /\/epd\//i,                      // /epd/ in path
  /epd.*\.pdf/i,                   // EPD PDF files
  /S-P-\d+/i,                      // S-P-##### format
  /EPD-\w+-\d+/i,                  // EPD-XXX-##### format
];

// Patterns that indicate search/listing pages (not the actual EPD)
const EPD_NEGATIVE_PATTERNS = [
  /\/search\?/i,
  /\/search\//i,
  /\/results/i,
  /query=/i,
  /\/catalog\//i,
  /google\./i,
  /bing\./i,
];

/**
 * Score a URL based on how likely it is to be a valid EPD
 */
function scoreEPDUrl(url: string, title: string, snippet: string): number {
  let score = 0;
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  
  // Domain scoring
  for (let i = 0; i < EPD_PRIORITY_DOMAINS.length; i++) {
    if (urlLower.includes(EPD_PRIORITY_DOMAINS[i])) {
      score += (EPD_PRIORITY_DOMAINS.length - i) * 20; // Higher score for priority domains
      break;
    }
  }
  
  // Positive patterns in URL
  for (const pattern of EPD_POSITIVE_PATTERNS) {
    if (pattern.test(url)) {
      score += 15;
    }
  }
  
  // Negative patterns (penalize)
  for (const pattern of EPD_NEGATIVE_PATTERNS) {
    if (pattern.test(url)) {
      score -= 30;
    }
  }
  
  // Title/snippet keywords
  if (titleLower.includes('epd') || titleLower.includes('environmental product declaration')) {
    score += 10;
  }
  if (snippetLower.includes('epd') || snippetLower.includes('environmental product declaration')) {
    score += 5;
  }
  if (titleLower.includes('iso 14025') || snippetLower.includes('iso 14025')) {
    score += 10;
  }
  if (titleLower.includes('en 15804') || snippetLower.includes('en 15804')) {
    score += 10;
  }
  
  // PDF bonus
  if (urlLower.endsWith('.pdf')) {
    score += 10;
  }
  
  return score;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Search for EPD using Perplexity web search
 */
export async function searchForEPD(
  productName: string,
  manufacturer: string | null,
  perplexityApiKey: string
): Promise<EPDSearchResult> {
  const searchQuery = manufacturer 
    ? `${manufacturer} ${productName} EPD environmental product declaration site:environdec.com OR site:spot.ul.com`
    : `${productName} EPD environmental product declaration site:environdec.com OR site:spot.ul.com`;

  const client = new OpenAI({
    apiKey: perplexityApiKey,
    baseURL: 'https://api.perplexity.ai',
  });

  try {
    // Use Perplexity to search and return actual URLs
    const response = await client.chat.completions.create({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are a search assistant. Search for EPD (Environmental Product Declaration) documents.
          
Return ONLY a JSON array of the actual URLs you find, with their titles and snippets.
Do NOT make up URLs - only return URLs that appear in search results.

Format:
{
  "results": [
    {"url": "https://actual-url-from-search", "title": "Page title", "snippet": "Brief description"}
  ]
}

If no results found, return {"results": []}`,
        },
        {
          role: 'user',
          content: `Find EPD documents for: ${manufacturer ? manufacturer + ' ' : ''}${productName}

Search environdec.com and spot.ul.com for the EPD.
Return the actual URLs from the search results.`,
        },
      ],
      temperature: 0,
    });

    const responseText = response.choices[0]?.message?.content || '';
    
    // Parse the response
    let results: Array<{ url: string; title: string; snippet: string }> = [];
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        results = parsed.results || [];
      }
    } catch {
      console.error('Failed to parse EPD search response:', responseText);
    }

    // Score and rank the candidates
    const candidates: EPDCandidate[] = results
      .filter(r => r.url && r.url.startsWith('http'))
      .map(r => {
        const score = scoreEPDUrl(r.url, r.title || '', r.snippet || '');
        return {
          url: r.url,
          title: r.title || '',
          snippet: r.snippet || '',
          domain: extractDomain(r.url),
          score,
          isLikelyEPD: score > 20, // Threshold for "likely EPD"
        };
      })
      .sort((a, b) => b.score - a.score); // Sort by score descending

    // Find best match (highest score above threshold)
    const bestMatch = candidates.find(c => c.isLikelyEPD) || null;

    return {
      product: productName,
      manufacturer,
      candidates,
      bestMatch,
      searchQuery,
    };
  } catch (error) {
    console.error('EPD search error:', error);
    return {
      product: productName,
      manufacturer,
      candidates: [],
      bestMatch: null,
      searchQuery,
    };
  }
}

/**
 * Alternative: Direct search query builder for manual searching
 */
export function buildEPDSearchUrl(productName: string, manufacturer: string | null): string {
  const query = encodeURIComponent(
    `${manufacturer ? manufacturer + ' ' : ''}${productName} EPD environmental product declaration`
  );
  return `https://www.environdec.com/library?query=${query}`;
}

