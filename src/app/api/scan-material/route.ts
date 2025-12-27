import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, getPerplexityClient, PRODUCT_SEARCH_PROMPT, buildProductSearchPrompt } from '@/lib/openai';
import { searchForDocumentation, DocSearchResult } from '@/lib/docSearch';
import { ProductRecommendation, DocStatus } from '@/types';

interface SingleScanRequest {
  material: {
    id: string;
    name: string;
    qty: number;
    unit: string;
  };
  project: {
    name: string;
    zip: string;
    goals: string;
  };
  settings?: {
    model: string;
    conservativeMode: boolean;
    useWebSearch: boolean;
  };
  excludeProducts?: string[]; // Product labels to exclude (for finding more materials)
}

// Extended recommendation with search results for debugging
interface ExtendedRecommendation extends ProductRecommendation {
  doc_search?: DocSearchResult;
  has_known_epd?: boolean;
  has_known_hpd?: boolean;
  has_known_declare?: boolean;
}

// AI response types
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

// Progress update type
interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  message: string;
  data?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body: SingleScanRequest = await request.json();
    
    if (!body.project || !body.material) {
      return NextResponse.json(
        { error: 'Invalid request: project and material are required' },
        { status: 400 }
      );
    }

    // Always use streaming for progress updates
    return streamScanProgress(body);
  } catch (error) {
    console.error('Single material scan error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (errorMessage.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local' },
        { status: 500 }
      );
    }
    if (errorMessage.includes('PERPLEXITY_API_KEY')) {
      return NextResponse.json(
        { error: 'Perplexity API key is not configured. Add PERPLEXITY_API_KEY to .env.local' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: `Scan failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Streaming version with progress updates
async function streamScanProgress(body: SingleScanRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (message: string) => {
        const update: ProgressUpdate = { type: 'progress', message };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
      };

      const sendComplete = (data: any) => {
        const update: ProgressUpdate = { type: 'complete', message: 'Scan complete', data };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
        controller.close();
      };

      const sendError = (error: string) => {
        const update: ProgressUpdate = { type: 'error', message: error };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
        controller.close();
      };

      try {
        const model = body.settings?.model || 'sonar-pro';
        const conservativeMode = body.settings?.conservativeMode || false;

        // STAGE 1: Get product recommendations (preferring documented products)
        sendProgress('Finding sustainable products...');
        const productPrompt = buildProductSearchPrompt(
      body.material,
      body.project.goals,
      body.project.zip,
      conservativeMode,
      body.excludeProducts
    );

        let responseText: string;

        if (model.startsWith('sonar')) {
          const perplexity = getPerplexityClient();
          
          const response = await perplexity.chat.completions.create({
            model: model,
            messages: [
              { role: 'system', content: PRODUCT_SEARCH_PROMPT },
              { role: 'user', content: productPrompt }
            ],
            temperature: 0.1,
          });

          responseText = response.choices[0]?.message?.content || '';
        } else {
          const openai = getOpenAIClient();
          
          const response = await openai.chat.completions.create({
            model: model,
            messages: [
              { role: 'system', content: PRODUCT_SEARCH_PROMPT },
              { role: 'user', content: productPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          });

          responseText = response.choices[0]?.message?.content || '';
        }

        if (!responseText) {
          throw new Error('No response received from AI');
        }

        // Parse product recommendations
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        } else {
          const startIdx = responseText.indexOf('{');
          const endIdx = responseText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            jsonStr = responseText.slice(startIdx, endIdx + 1);
          }
        }

        let parsedResponse: AIResponse;
        try {
          parsedResponse = JSON.parse(jsonStr);
        } catch {
          console.error('Failed to parse AI response:', responseText);
          throw new Error('Failed to parse AI response as JSON');
        }

        // Sort recommendations by known documentation (prefer documented products)
        const sortedRecs = [...(parsedResponse.recommendations || [])].sort((a, b) => {
          const aScore = (a.has_known_epd ? 3 : 0) + (a.has_known_hpd ? 2 : 0) + (a.has_known_declare ? 1 : 0);
          const bScore = (b.has_known_epd ? 3 : 0) + (b.has_known_hpd ? 2 : 0) + (b.has_known_declare ? 1 : 0);
          return bScore - aScore;
        });

        // STAGE 2: Search for documentation for each product
        // Run SEQUENTIALLY with delay to avoid rate limiting
        const perplexityKey = process.env.PERPLEXITY_API_KEY;
        const recommendations: ExtendedRecommendation[] = [];
        const totalProducts = Math.min(sortedRecs.length, 3);
        
        // Helper to add delay between API calls
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        for (let i = 0; i < totalProducts; i++) {
          const rec = sortedRecs[i];
          const productNum = i + 1;
          
          // Add delay between searches to avoid rate limiting (except first)
          if (i > 0) {
            await delay(500); // 500ms delay between searches
          }
          
          // Initialize doc checklist
          const docChecklist: Record<string, DocStatus> = {
            epd: { status: 'unverified', doc_url: null, registry_id: null },
            hpd: { status: 'unverified', doc_url: null, registry_id: null },
            declare: { status: 'unverified', doc_url: null, registry_id: null },
            voc: { status: 'unverified', doc_url: null, registry_id: null },
          };

          let docSearch: DocSearchResult | undefined;

          // Search for all documentation types
          if (perplexityKey && rec.product_label) {
            try {
              sendProgress(`Product ${productNum} of ${totalProducts}: ${rec.product_label}`);
              sendProgress(`Searching documentation for ${rec.product_label}...`);
              
              // Create a progress callback that includes product number context
              const productProgressCallback = (message: string) => {
                sendProgress(`Product ${productNum} of ${totalProducts}: ${message}`);
              };
              
              docSearch = await searchForDocumentation(
                rec.product_label,
                rec.manufacturer || null,
                perplexityKey,
                productProgressCallback
              );
              
              // Send summary of found links
              if (docSearch) {
                const epdCount = docSearch.byType.epd.filter(l => l.category !== 'wrong_manufacturer').length;
                const hpdCount = docSearch.byType.hpd.filter(l => l.category !== 'wrong_manufacturer').length;
                const declareCount = docSearch.byType.declare.filter(l => l.category !== 'wrong_manufacturer').length;
                const vocCount = docSearch.byType.voc.filter(l => l.category !== 'wrong_manufacturer').length;
                const productPageCount = docSearch.byType.product_page.filter(l => l.category !== 'wrong_manufacturer').length;
                
                const linkCounts: string[] = [];
                if (epdCount > 0) linkCounts.push(`${epdCount} EPD`);
                if (hpdCount > 0) linkCounts.push(`${hpdCount} HPD`);
                if (declareCount > 0) linkCounts.push(`${declareCount} Declare`);
                if (vocCount > 0) linkCounts.push(`${vocCount} VOC`);
                if (productPageCount > 0) linkCounts.push(`${productPageCount} product page${productPageCount > 1 ? 's' : ''}`);
                
                if (linkCounts.length > 0) {
                  sendProgress(`Found: ${linkCounts.join(', ')}`);
                } else {
                  sendProgress(`No documentation links found`);
                }
              }

              // Use best link from each category
              // Only auto-select if confidence is high (direct doc or catalog page)
              const autoSelectThreshold = 0.8;
              
              if (docSearch.byType.epd.length > 0) {
                const sorted = docSearch.byType.epd.sort((a, b) => b.confidence - a.confidence);
                const best = sorted[0];
                if (best && best.confidence >= autoSelectThreshold) {
                  docChecklist.epd = {
                    status: 'verified',
                    doc_url: best.url,
                    registry_id: null,
                  };
                }
              }

              if (docSearch.byType.hpd.length > 0) {
                const sorted = docSearch.byType.hpd.sort((a, b) => b.confidence - a.confidence);
                const best = sorted[0];
                if (best && best.confidence >= autoSelectThreshold) {
                  docChecklist.hpd = {
                    status: 'verified',
                    doc_url: best.url,
                    registry_id: null,
                  };
                }
              }

              if (docSearch.byType.declare.length > 0) {
                const sorted = docSearch.byType.declare.sort((a, b) => b.confidence - a.confidence);
                const best = sorted[0];
                if (best && best.confidence >= autoSelectThreshold) {
                  docChecklist.declare = {
                    status: 'verified',
                    doc_url: best.url,
                    registry_id: null,
                  };
                }
              }

              if (docSearch.byType.voc.length > 0) {
                const sorted = docSearch.byType.voc.sort((a, b) => b.confidence - a.confidence);
                const best = sorted[0];
                if (best && best.confidence >= autoSelectThreshold) {
                  docChecklist.voc = {
                    status: 'verified',
                    doc_url: best.url,
                    registry_id: null,
                  };
                }
              }
            } catch (error) {
              console.error('Doc search failed for', rec.product_label, error);
              sendProgress(`Error searching documentation for ${rec.product_label}`);
            }
          } else {
            sendProgress(`Product ${productNum} of ${totalProducts}: Skipping documentation search (no API key)`);
          }

          // Use verified product_page link from doc search (more reliable than AI-generated URLs)
          // Priority: product_page > manufacturer page > any valid link
          let verifiedProductUrl: string | null = null;
          if (docSearch) {
            // First try: product_page category
            if (docSearch.byType.product_page && docSearch.byType.product_page.length > 0) {
              const validProductPages = docSearch.byType.product_page
                .filter(l => l.category !== 'wrong_manufacturer')
                .sort((a, b) => b.confidence - a.confidence);
              if (validProductPages.length > 0) {
                verifiedProductUrl = validProductPages[0].url;
              }
            }
            
            // Fallback: any valid link that's not wrong_manufacturer or unknown
            if (!verifiedProductUrl && docSearch.categorizedLinks.length > 0) {
              const validLinks = docSearch.categorizedLinks
                .filter(l => l.category !== 'wrong_manufacturer' && l.category !== 'unknown')
                .sort((a, b) => b.confidence - a.confidence);
              if (validLinks.length > 0) {
                verifiedProductUrl = validLinks[0].url;
              }
            }
          }

          recommendations.push({
            product_label: rec.product_label || 'Unknown Product',
            manufacturer: rec.manufacturer || null,
            manufacturer_url: rec.manufacturer_url || null,
            product_url: verifiedProductUrl || rec.product_url || null,
            image_url: null,
            rationale: rec.rationale || '',
            doc_checklist: docChecklist as ProductRecommendation['doc_checklist'],
            distance_miles: null,
            confidence: rec.confidence || 0.5,
            doc_search: docSearch,
            has_known_epd: rec.has_known_epd,
            has_known_hpd: rec.has_known_hpd,
            has_known_declare: rec.has_known_declare,
          });
        }

        // Sort recommendations by doc coverage (products with more doc types ranked higher)
        const sortedRecommendations = recommendations.sort((a, b) => {
          const countDocs = (rec: typeof recommendations[0]) => {
            if (!rec.doc_search) return 0;
            let count = 0;
            const byType = rec.doc_search.byType;
            if (byType.epd?.filter(l => l.category !== 'wrong_manufacturer').length > 0) count++;
            if (byType.hpd?.filter(l => l.category !== 'wrong_manufacturer').length > 0) count++;
            if (byType.declare?.filter(l => l.category !== 'wrong_manufacturer').length > 0) count++;
            if (byType.voc?.filter(l => l.category !== 'wrong_manufacturer').length > 0) count++;
            if (byType.product_page?.filter(l => l.category !== 'wrong_manufacturer').length > 0) count++;
            return count;
          };
          return countDocs(b) - countDocs(a);
        });

        const result = {
          id: body.material.id,
          name: parsedResponse.name || body.material.name,
          normalized_category: parsedResponse.normalized_category || 'Other',
          category_confidence: parsedResponse.category_confidence || 0.5,
          notes_for_user: parsedResponse.notes_for_user || '',
          recommendations: sortedRecommendations,
        };

        sendComplete(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        if (errorMessage.includes('OPENAI_API_KEY')) {
          sendError('OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local');
        } else if (errorMessage.includes('PERPLEXITY_API_KEY')) {
          sendError('Perplexity API key is not configured. Add PERPLEXITY_API_KEY to .env.local');
        } else {
          sendError(`Scan failed: ${errorMessage}`);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
