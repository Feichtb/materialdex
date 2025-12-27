import { NextRequest, NextResponse } from 'next/server';
import { searchForEPD, buildEPDSearchUrl } from '@/lib/epdSearch';

/**
 * API endpoint to search for EPD documents
 * Returns candidate URLs for inspection/debugging
 */

interface SearchEPDRequest {
  productName: string;
  manufacturer?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchEPDRequest = await request.json();
    
    if (!body.productName) {
      return NextResponse.json(
        { error: 'productName is required' },
        { status: 400 }
      );
    }

    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) {
      // Return manual search URL if no API key
      return NextResponse.json({
        product: body.productName,
        manufacturer: body.manufacturer || null,
        candidates: [],
        bestMatch: null,
        manualSearchUrl: buildEPDSearchUrl(body.productName, body.manufacturer || null),
        error: 'PERPLEXITY_API_KEY not configured',
      });
    }

    const result = await searchForEPD(
      body.productName,
      body.manufacturer || null,
      perplexityKey
    );

    // Add manual search URL as fallback
    const manualSearchUrl = buildEPDSearchUrl(body.productName, body.manufacturer || null);

    return NextResponse.json({
      ...result,
      manualSearchUrl,
    });
  } catch (error) {
    console.error('EPD search error:', error);
    return NextResponse.json(
      { error: 'EPD search failed' },
      { status: 500 }
    );
  }
}

