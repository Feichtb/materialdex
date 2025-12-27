import { NextRequest, NextResponse } from 'next/server';
import { VerifyRequest, VerifyResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    
    if (!body.materialName || !body.productLabel || !body.docType || !body.url) {
      return NextResponse.json(
        { 
          success: false, 
          status: 'unverified',
          message: 'Missing required fields: materialName, productLabel, docType, url' 
        } as VerifyResponse,
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json(
        { 
          success: false, 
          status: 'unverified',
          message: 'Invalid URL format' 
        } as VerifyResponse,
        { status: 400 }
      );
    }

    // Validate doc type
    const validDocTypes = ['epd', 'hpd', 'declare', 'voc'];
    if (!validDocTypes.includes(body.docType)) {
      return NextResponse.json(
        { 
          success: false, 
          status: 'unverified',
          message: `Invalid doc type. Must be one of: ${validDocTypes.join(', ')}` 
        } as VerifyResponse,
        { status: 400 }
      );
    }

    // For now, we simply accept the user-provided URL and mark it as "user-provided"
    // In a production system, you might:
    // 1. Validate the URL is reachable
    // 2. Check if it's from a known certification body
    // 3. Parse metadata from the page
    // 4. Store in a database
    
    // We do NOT scrape or verify content - that's the user's responsibility
    const response: VerifyResponse = {
      success: true,
      status: 'user-provided',
      message: `URL stored for ${body.docType.toUpperCase()} documentation. Please verify the content manually.`
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Verify error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        status: 'unverified',
        message: `Verification failed: ${errorMessage}` 
      } as VerifyResponse,
      { status: 500 }
    );
  }
}

