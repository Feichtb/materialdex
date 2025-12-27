/**
 * URL Validator Module
 * 
 * Validates URLs to ensure they are:
 * 1. Not 404 pages
 * 2. Not generic homepages
 * 3. Not empty search query pages
 * 4. Actually contain content
 */

// Debug flag - set to true to see validation logs
const DEBUG = true;

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log('[URL-VALIDATOR]', ...args);
  }
}

/**
 * Check if a URL is a generic homepage or empty search page
 */
function isGenericHomepageOrEmpty(url: string): boolean {
  const urlLower = url.toLowerCase();
  const urlObj = new URL(url);
  const pathname = urlObj.pathname.toLowerCase();
  
  // Generic registry homepages
  const genericHomepages = [
    'https://hpdrepository.hpd-collaborative.org',
    'https://hpdrepository.hpd-collaborative.org/',
    'https://declare.living-future.org',
    'https://declare.living-future.org/',
    'https://spot.ul.com',
    'https://spot.ul.com/',
    'https://www.environdec.com',
    'https://www.environdec.com/',
  ];
  
  if (genericHomepages.includes(urlLower)) {
    return true;
  }
  
  // Empty search pages (often have ?q= or ?search= with no results)
  if (pathname === '/' && (urlObj.search.includes('q=') || urlObj.search.includes('search='))) {
    return true;
  }
  
  // Very short paths often indicate homepages
  if (pathname === '/' || pathname === '') {
    return true;
  }
  
  return false;
}

/**
 * Validate that a URL is actually usable (not 404, not empty, has content)
 */
export async function validateUrlIsUsable(url: string): Promise<{ valid: boolean; reason: string; is404?: boolean }> {
  debugLog(`Validating URL usability: ${url}`);
  
  // First check: is it a generic homepage?
  if (isGenericHomepageOrEmpty(url)) {
    debugLog(`  → INVALID: Generic homepage or empty page`);
    return { valid: false, reason: 'Generic homepage or empty search page' };
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    debugLog(`  Fetching URL...`);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Materialdex/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeout);

    // Check for 404 or other client errors
    if (response.status === 404) {
      debugLog(`  → INVALID: 404 Not Found`);
      return { valid: false, reason: '404 Not Found', is404: true };
    }
    
    if (response.status >= 400 && response.status < 500) {
      debugLog(`  → INVALID: HTTP ${response.status}`);
      return { valid: false, reason: `HTTP ${response.status}`, is404: false };
    }
    
    // For redirects (3xx), follow them but mark as potentially problematic
    if (response.status >= 300 && response.status < 400) {
      debugLog(`  → VALID: Redirect (${response.status}) - following`);
      // Continue to check content
    }

    // Get page content
    const html = await response.text();
    debugLog(`  Fetched ${html.length} bytes`);
    
    // Check if page has meaningful content (not just empty or error page)
    if (html.length < 500) {
      debugLog(`  → INVALID: Page too short (${html.length} bytes) - likely empty or error page`);
      return { valid: false, reason: 'Page content too short' };
    }
    
    // Check for common error page indicators
    const htmlLower = html.toLowerCase();
    const errorIndicators = [
      'page not found',
      '404',
      'not found',
      'error 404',
      'this page does not exist',
      'no results found',
      'your search did not match',
      'no documents found',
    ];
    
    // If page is mostly error text, reject it
    const errorTextCount = errorIndicators.filter(indicator => htmlLower.includes(indicator)).length;
    if (errorTextCount >= 2 && html.length < 2000) {
      debugLog(`  → INVALID: Appears to be error page`);
      return { valid: false, reason: 'Appears to be error/empty page' };
    }
    
    debugLog(`  → VALID: Usable page with content`);
    return { valid: true, reason: 'Valid page with content' };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    if (error instanceof Error && error.name === 'AbortError') {
      debugLog(`  → INVALID: Timeout`);
      return { valid: false, reason: 'Request timed out' };
    }
    
    debugLog(`  → INVALID: ${errorMsg}`);
    return { valid: false, reason: `Failed to fetch: ${errorMsg}` };
  }
}

/**
 * Clean manufacturer name - remove parenthetical parts and normalize
 */
function cleanManufacturerName(manufacturer: string): string {
  // Remove parenthetical parts like "(Saint‑Gobain)" or "(now Westlake Royal)"
  let cleaned = manufacturer.replace(/\([^)]*\)/g, '').trim();
  
  // Remove common suffixes
  cleaned = cleaned.replace(/\s+(LLC|Inc|Corp|Corporation|Company|Co)$/i, '').trim();
  
  return cleaned;
}

/**
 * Extract main manufacturer name parts (for fuzzy matching)
 */
function getManufacturerKeywords(manufacturer: string): string[] {
  const cleaned = cleanManufacturerName(manufacturer);
  const lower = cleaned.toLowerCase();
  
  // Split by spaces/hyphens and filter out short words and parenthetical content
  const words = lower
    .split(/[\s\-]+/)
    .filter(w => w.length > 2 && !w.startsWith('(') && !w.endsWith(')'));
  
  return words;
}

/**
 * Fetch a URL and check if manufacturer name appears in the page content
 */
export async function validateManufacturerInPage(
  url: string,
  manufacturer: string
): Promise<{ valid: boolean; reason: string }> {
  debugLog(`Validating URL: ${url} for manufacturer: ${manufacturer}`);
  
  if (!manufacturer || manufacturer.trim().length === 0) {
    debugLog(`  → VALID: No manufacturer to verify`);
    return { valid: true, reason: 'No manufacturer to verify' };
  }

  // First check: Does URL itself contain manufacturer name? (very reliable indicator)
  const urlLower = url.toLowerCase();
  const mfgKeywords = getManufacturerKeywords(manufacturer);
  const urlContainsMfg = mfgKeywords.some(keyword => urlLower.includes(keyword));
  
  if (urlContainsMfg) {
    debugLog(`  → VALID: Manufacturer name found in URL`);
    return { valid: true, reason: 'Manufacturer name found in URL' };
  }

  // Check if it's a PDF - PDFs are harder to extract text from, so be more lenient
  const isPdf = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');
  
  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    debugLog(`  Fetching URL...`);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Materialdex/1.0)',
        'Accept': isPdf ? 'application/pdf,*/*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // For manufacturer validation (used after URL usability check), be lenient
      debugLog(`  → VALID (HTTP error): Status ${response.status} - giving benefit of doubt`);
      return { valid: true, reason: `HTTP ${response.status} - assuming valid` };
    }

    // For PDFs, be lenient - text extraction is unreliable
    if (isPdf) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('pdf')) {
        debugLog(`  → VALID: PDF file - assuming valid (text extraction unreliable)`);
        return { valid: true, reason: 'PDF file - text extraction unreliable, assuming valid' };
      }
    }

    // Get page content
    const content = await response.text();
    debugLog(`  Fetched ${content.length} bytes`);
    
    // Check if manufacturer name appears in content
    const contentLower = content.toLowerCase();
    const cleanedMfg = cleanManufacturerName(manufacturer).toLowerCase();
    
    // Direct match with cleaned manufacturer name
    if (contentLower.includes(cleanedMfg)) {
      debugLog(`  → VALID: Found "${cleanedMfg}" in page content`);
      return { valid: true, reason: `Found "${cleanedMfg}" in page content` };
    }
    
    // Check individual keywords (more lenient)
    const foundKeywords = mfgKeywords.filter(keyword => contentLower.includes(keyword));
    
    debugLog(`  Manufacturer keywords: ${mfgKeywords.join(', ')}`);
    debugLog(`  Found keywords: ${foundKeywords.join(', ')} (${foundKeywords.length}/${mfgKeywords.length})`);
    
    // If at least one significant keyword is found, it's probably valid
    // Be more lenient - if any keyword matches, accept it
    if (foundKeywords.length > 0 && mfgKeywords.length > 0) {
      const matchRatio = foundKeywords.length / mfgKeywords.length;
      // Accept if at least 33% of keywords match (very lenient)
      if (matchRatio >= 0.33) {
        debugLog(`  → VALID: Found ${foundKeywords.length}/${mfgKeywords.length} manufacturer keywords`);
        return { valid: true, reason: `Found ${foundKeywords.length}/${mfgKeywords.length} manufacturer keywords` };
      }
    }
    
    debugLog(`  → INVALID: Manufacturer "${manufacturer}" not found in page content`);
    return { 
      valid: false, 
      reason: `Manufacturer "${manufacturer}" not found in page content` 
    };
  } catch (error) {
    // On error (timeout, network issue), give benefit of doubt
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    debugLog(`  → VALID (error): ${errorMsg} - giving benefit of doubt`);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: true, reason: 'Timeout - assuming valid' };
    }
    return { valid: true, reason: `Could not verify (${errorMsg}) - assuming valid` };
  }
}

/**
 * Batch validate multiple URLs for manufacturer presence
 * Only validates first N URLs to limit requests
 */
export async function batchValidateUrls(
  urls: Array<{ url: string; category: string }>,
  manufacturer: string,
  maxToValidate: number = 5
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  if (!manufacturer) {
    urls.forEach(u => results.set(u.url, true));
    return results;
  }

  // Only validate top N URLs
  const toValidate = urls.slice(0, maxToValidate);
  
  // Validate in parallel but with limit
  const validations = await Promise.all(
    toValidate.map(async ({ url }) => {
      const result = await validateManufacturerInPage(url, manufacturer);
      return { url, valid: result.valid };
    })
  );

  validations.forEach(({ url, valid }) => {
    results.set(url, valid);
  });

  // URLs not validated are assumed valid
  urls.slice(maxToValidate).forEach(u => results.set(u.url, true));

  return results;
}

/**
 * Combined URL validation result
 */
export interface CombinedValidationResult {
  valid: boolean;
  usable: boolean;
  manufacturerMatch: boolean;
  reason: string;
  is404?: boolean;
  content?: string; // Cached content for further analysis
}

/**
 * COMBINED validator - validates URL usability AND manufacturer in ONE fetch
 * This is much more efficient than calling validateUrlIsUsable and validateManufacturerInPage separately
 */
export async function validateUrlComplete(
  url: string,
  manufacturer: string | null
): Promise<CombinedValidationResult> {
  debugLog(`Combined validation: ${url} (manufacturer: ${manufacturer || 'none'})`);
  
  // First check: is it a generic homepage?
  if (isGenericHomepageOrEmpty(url)) {
    debugLog(`  → INVALID: Generic homepage or empty page`);
    return { 
      valid: false, 
      usable: false, 
      manufacturerMatch: false, 
      reason: 'Generic homepage or empty search page' 
    };
  }
  
  // Check if manufacturer is in URL (quick win - no fetch needed)
  if (manufacturer) {
    const urlLower = url.toLowerCase();
    const mfgKeywords = getManufacturerKeywords(manufacturer);
    const urlContainsMfg = mfgKeywords.some(keyword => urlLower.includes(keyword));
    
    if (urlContainsMfg) {
      debugLog(`  Manufacturer found in URL - still need to verify URL is usable`);
    }
  }
  
  // Check if it's a PDF
  const isPdf = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout per URL

    debugLog(`  Fetching URL...`);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Materialdex/1.0)',
        'Accept': isPdf ? 'application/pdf,*/*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeout);

    // Check for 404 or other client errors
    if (response.status === 404) {
      debugLog(`  → INVALID: 404 Not Found`);
      return { 
        valid: false, 
        usable: false, 
        manufacturerMatch: false, 
        reason: '404 Not Found', 
        is404: true 
      };
    }
    
    if (response.status >= 400 && response.status < 500) {
      debugLog(`  → INVALID: HTTP ${response.status}`);
      return { 
        valid: false, 
        usable: false, 
        manufacturerMatch: false, 
        reason: `HTTP ${response.status}` 
      };
    }

    // For PDFs, be lenient - text extraction is unreliable
    if (isPdf) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('pdf')) {
        debugLog(`  → VALID: PDF file - assuming valid`);
        return { 
          valid: true, 
          usable: true, 
          manufacturerMatch: true, // Assume valid for PDFs
          reason: 'PDF file - text extraction unreliable, assuming valid' 
        };
      }
    }

    // Get page content
    const content = await response.text();
    debugLog(`  Fetched ${content.length} bytes`);
    
    // Check if page has meaningful content
    if (content.length < 500) {
      debugLog(`  → INVALID: Page too short (${content.length} bytes)`);
      return { 
        valid: false, 
        usable: false, 
        manufacturerMatch: false, 
        reason: 'Page content too short' 
      };
    }
    
    // Check for common error page indicators
    const contentLower = content.toLowerCase();
    const errorIndicators = [
      'page not found',
      '404',
      'not found',
      'error 404',
      'this page does not exist',
      'no results found',
      'your search did not match',
      'no documents found',
    ];
    
    const errorTextCount = errorIndicators.filter(indicator => contentLower.includes(indicator)).length;
    if (errorTextCount >= 2 && content.length < 2000) {
      debugLog(`  → INVALID: Appears to be error page`);
      return { 
        valid: false, 
        usable: false, 
        manufacturerMatch: false, 
        reason: 'Appears to be error/empty page' 
      };
    }
    
    // URL is usable! Now check manufacturer if provided
    let manufacturerMatch = true;
    let manufacturerReason = 'No manufacturer to verify';
    
    if (manufacturer && manufacturer.trim().length > 0) {
      const cleanedMfg = cleanManufacturerName(manufacturer).toLowerCase();
      const mfgKeywords = getManufacturerKeywords(manufacturer);
      
      // Check if manufacturer name appears in content
      if (contentLower.includes(cleanedMfg)) {
        debugLog(`  → Manufacturer "${cleanedMfg}" found in page content`);
        manufacturerMatch = true;
        manufacturerReason = `Found "${cleanedMfg}" in page content`;
      } else {
        // Check individual keywords
        const foundKeywords = mfgKeywords.filter(keyword => contentLower.includes(keyword));
        
        debugLog(`  Manufacturer keywords: ${mfgKeywords.join(', ')}`);
        debugLog(`  Found keywords: ${foundKeywords.join(', ')} (${foundKeywords.length}/${mfgKeywords.length})`);
        
        if (foundKeywords.length > 0 && mfgKeywords.length > 0) {
          const matchRatio = foundKeywords.length / mfgKeywords.length;
          if (matchRatio >= 0.33) {
            manufacturerMatch = true;
            manufacturerReason = `Found ${foundKeywords.length}/${mfgKeywords.length} manufacturer keywords`;
          } else {
            manufacturerMatch = false;
            manufacturerReason = `Manufacturer "${manufacturer}" not found in page content`;
          }
        } else {
          manufacturerMatch = false;
          manufacturerReason = `Manufacturer "${manufacturer}" not found in page content`;
        }
      }
    }
    
    debugLog(`  → ${manufacturerMatch ? 'VALID' : 'INVALID (wrong manufacturer)'}: ${manufacturerReason}`);
    
    return { 
      valid: manufacturerMatch, 
      usable: true, 
      manufacturerMatch, 
      reason: manufacturerReason,
      content // Return content for potential further use
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    if (error instanceof Error && error.name === 'AbortError') {
      debugLog(`  → INVALID: Timeout`);
      return { 
        valid: false, 
        usable: false, 
        manufacturerMatch: false, 
        reason: 'Request timed out' 
      };
    }
    
    debugLog(`  → ERROR: ${errorMsg} - giving benefit of doubt`);
    // On network errors, be lenient
    return { 
      valid: true, 
      usable: true, 
      manufacturerMatch: true, 
      reason: `Could not verify (${errorMsg}) - assuming valid` 
    };
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Quick validation of URL format and basic checks
 */
export function quickValidateUrl(url: string, docType: 'epd' | 'hpd' | 'declare' | 'voc'): { isValid: boolean; reason?: string } {
  try {
    const urlObj = new URL(url);
    
    // Check for obviously invalid domains
    const invalidDomains = ['example.com', 'test.com', 'localhost'];
    if (invalidDomains.includes(urlObj.hostname.toLowerCase())) {
      return { isValid: false, reason: 'Invalid domain' };
    }
    
    // Check for junk patterns
    const junkPatterns = [
      /^https?:\/\/[^/]+\/?$/i, // Just domain, no path
      /\/search\?/i,
      /\/404/i,
      /error/i,
    ];
    
    for (const pattern of junkPatterns) {
      if (pattern.test(url)) {
        return { isValid: false, reason: 'Invalid URL pattern' };
      }
    }
    
    return { isValid: true };
  } catch {
    return { isValid: false, reason: 'Invalid URL format' };
  }
}

/**
 * Evidence patterns for different document types
 */
export const EVIDENCE_PATTERNS: Record<'epd' | 'hpd' | 'declare' | 'voc', RegExp[]> = {
  epd: [
    /environmental\s+product\s+declaration/i,
    /EPD[-\s]?(?:IES[-\s])?\d+/i,
    /S-P-\d+/i,
    /ISO\s+14025/i,
    /EN\s+15804/i,
  ],
  hpd: [
    /health\s+product\s+declaration/i,
    /HPD\s+(?:ID|number|#)?:?\s*\d+/i,
    /hpd\s+collaborative/i,
  ],
  declare: [
    /declare\s+label/i,
    /living\s+building\s+challenge/i,
    /red\s+list/i,
    /declare\s+program/i,
  ],
  voc: [
    /volatile\s+organic\s+compound/i,
    /VOC/i,
    /greenguard/i,
    /floorscore/i,
    /indoor\s+air\s+quality/i,
    /IAQ/i,
  ],
};
