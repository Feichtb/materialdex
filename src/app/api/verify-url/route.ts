import { NextRequest, NextResponse } from 'next/server';
import { quickValidateUrl, EVIDENCE_PATTERNS, extractDomain } from '@/lib/urlValidator';

/**
 * API endpoint for Step 2 & 3 of verification pipeline:
 * - Fetch URL and validate HTTP 200
 * - Extract content and check for evidence patterns
 */

interface VerifyUrlRequest {
  url: string;
  docType: 'epd' | 'hpd' | 'declare' | 'voc';
  productName?: string;
  manufacturer?: string;
}

interface VerifyUrlResponse {
  url: string;
  isValid: boolean;
  statusCode?: number;
  finalUrl?: string;
  domain?: string;
  evidenceFound: boolean;
  evidenceSnippets: string[];
  registryId?: string | null;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyUrlRequest = await request.json();
    
    if (!body.url || !body.docType) {
      return NextResponse.json(
        { error: 'URL and docType are required' },
        { status: 400 }
      );
    }

    const { url, docType } = body;

    // Step 2a: Quick validation (domain, junk patterns)
    const quickCheck = quickValidateUrl(url, docType);
    if (!quickCheck.isValid) {
      return NextResponse.json({
        url,
        isValid: false,
        evidenceFound: false,
        evidenceSnippets: [],
        error: quickCheck.reason,
      });
    }

    // Step 2b: Fetch the URL and check HTTP status
    let response: Response;
    let finalUrl = url;
    
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Materialdex/1.0; +https://materialdex.app)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      finalUrl = response.url; // Get final URL after redirects
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Fetch failed';
      return NextResponse.json({
        url,
        isValid: false,
        evidenceFound: false,
        evidenceSnippets: [],
        error: `Failed to fetch: ${errorMsg}`,
      });
    }

    // Check HTTP status
    if (!response.ok) {
      return NextResponse.json({
        url,
        isValid: false,
        statusCode: response.status,
        finalUrl,
        evidenceFound: false,
        evidenceSnippets: [],
        error: `HTTP ${response.status}`,
      });
    }

    // Step 2c: Get content and check for evidence
    const contentType = response.headers.get('content-type') || '';
    let textContent = '';
    
    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      textContent = await response.text();
    } else if (contentType.includes('application/pdf')) {
      // For PDFs, we can't easily extract text server-side
      // Just validate the URL is accessible
      return NextResponse.json({
        url,
        isValid: true,
        statusCode: response.status,
        finalUrl,
        domain: extractDomain(finalUrl),
        evidenceFound: true, // Assume PDF is valid if accessible
        evidenceSnippets: ['PDF document accessible'],
      });
    } else {
      textContent = await response.text();
    }

    // Step 3: Evidence extraction - check for patterns
    const patterns = EVIDENCE_PATTERNS[docType] || [];
    const evidenceSnippets: string[] = [];
    let registryId: string | null = null;
    
    for (const pattern of patterns) {
      const matches = textContent.match(pattern);
      if (matches) {
        // Extract context around the match
        const matchIndex = textContent.indexOf(matches[0]);
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(textContent.length, matchIndex + matches[0].length + 50);
        const snippet = textContent.slice(start, end).replace(/\s+/g, ' ').trim();
        
        if (snippet && !evidenceSnippets.includes(snippet)) {
          evidenceSnippets.push(snippet);
        }

        // Try to extract registry ID for EPD
        if (docType === 'epd') {
          // Look for EPD number patterns
          const epdMatch = textContent.match(/EPD[-\s]?(?:IES[-\s])?0*(\d+)/i);
          const spMatch = textContent.match(/S-P-0*(\d+)/i);
          if (epdMatch) registryId = epdMatch[1];
          else if (spMatch) registryId = spMatch[1];
        }
      }
    }

    // Also check for product/manufacturer name as additional evidence
    let productNameFound = false;
    let manufacturerFound = false;
    
    if (body.productName) {
      const productPattern = new RegExp(body.productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (productPattern.test(textContent)) {
        evidenceSnippets.push(`Product name "${body.productName}" found in document`);
        productNameFound = true;
      }
    }

    if (body.manufacturer) {
      const mfgPattern = new RegExp(body.manufacturer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (mfgPattern.test(textContent)) {
        evidenceSnippets.push(`✓ Manufacturer "${body.manufacturer}" verified in document`);
        manufacturerFound = true;
      } else {
        // Check for manufacturer keywords (words from the manufacturer name)
        const mfgWords = body.manufacturer.toLowerCase().split(/[\s-]+/).filter(w => w.length > 2);
        const contentLower = textContent.toLowerCase();
        const foundWords = mfgWords.filter(word => contentLower.includes(word));
        
        if (foundWords.length >= Math.ceil(mfgWords.length * 0.6)) {
          evidenceSnippets.push(`Manufacturer keywords found: ${foundWords.join(', ')}`);
          manufacturerFound = true;
        } else {
          evidenceSnippets.push(`⚠️ Manufacturer "${body.manufacturer}" NOT found in document - verify this is the correct product`);
        }
      }
    }

    const evidenceFound = evidenceSnippets.length > 0;

    // Step 4: Acceptance rule
    const result: VerifyUrlResponse = {
      url,
      isValid: evidenceFound, // Only valid if we found evidence
      statusCode: response.status,
      finalUrl,
      domain: extractDomain(finalUrl),
      evidenceFound,
      evidenceSnippets: evidenceSnippets.slice(0, 5), // Limit to 5 snippets
      registryId,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('URL verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed', isValid: false, evidenceFound: false, evidenceSnippets: [] },
      { status: 500 }
    );
  }
}

