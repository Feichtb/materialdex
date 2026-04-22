import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, getPerplexityClientWithKey, PRODUCT_SEARCH_PROMPT, buildProductSearchPrompt } from '@/lib/openai';
import { searchForDocumentation, DocSearchResult } from '@/lib/docSearch';
import { ProductRecommendation, DocStatus, DocChecklist } from '@/types';

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
    docSearchProvider?: 'perplexity' | 'perplexity-v2' | 'exa';
  };
  excludeProducts?: string[]; // Product labels to exclude (for finding more materials)
  userApiKey?: string;        // User's own Perplexity API key (BYOK)
  deviceId?: string;          // Device identifier for usage tracking
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
  type: 'progress' | 'complete' | 'cancelled' | 'error';
  message: string;
  data?: any;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[scan-material] POST request received');
    const body: SingleScanRequest = await request.json();
    console.log('[scan-material] Request body parsed successfully');
    
    if (!body.project || !body.material) {
      console.error('[scan-material] Invalid request: missing project or material');
      return NextResponse.json(
        { error: 'Invalid request: project and material are required' },
        { status: 400 }
      );
    }

    // In production, free scans route to Firebase — Netlify only handles BYOK
    if (!body.userApiKey && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    // Validate user API key if provided
    if (body.userApiKey !== undefined) {
      if (typeof body.userApiKey !== 'string' || body.userApiKey.trim().length < 20 || body.userApiKey.length > 200) {
        return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 });
      }
      body.userApiKey = body.userApiKey.trim();
    }

    // Always use streaming for progress updates
    console.log('[scan-material] Starting streaming scan');
    return streamScanProgress(body);
  } catch (error) {
    console.error('[scan-material] POST handler error');
    console.error('[scan-material] Error object:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error('[scan-material] Error message:', errorMessage);
    console.error('[scan-material] Error stack:', errorStack);
    
    if (errorMessage.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }
    if (errorMessage.includes('PERPLEXITY_API_KEY')) {
      return NextResponse.json(
        { error: 'Perplexity API key is not configured' },
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
      let streamClosed = false;
      
      const sendProgress = (message: string) => {
        if (streamClosed) {
          console.warn('[scan-material] Attempted to send progress after stream closed');
          return;
        }
        try {
          const update: ProgressUpdate = { type: 'progress', message };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
        } catch (err) {
          console.log('[scan-material] Stream closed by client during progress send');
          streamClosed = true;
          cleanupAndClose();
        }
      };

      // Keep reference to keepalive interval for cleanup
      let keepaliveInterval: NodeJS.Timeout | null = null;
      
      const cleanupAndClose = () => {
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
          keepaliveInterval = null;
        }
        streamClosed = true;
        try {
          controller.close();
        } catch {}
      };
      
      const sendComplete = (data: any) => {
        if (streamClosed) {
          console.warn('[scan-material] Attempted to send complete after stream closed');
          return;
        }
        try {
          const update: ProgressUpdate = { type: 'complete', message: 'Scan complete', data };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
          cleanupAndClose();
        } catch (err) {
          console.error('[scan-material] Error sending complete:', err);
          cleanupAndClose();
        }
      };

      const sendCancelled = (data: any) => {
        if (streamClosed) {
          console.warn('[scan-material] Attempted to send cancelled after stream closed');
          return;
        }
        try {
          const update: ProgressUpdate = { type: 'cancelled', message: 'Scan cancelled', data };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
          cleanupAndClose();
        } catch (err) {
          console.error('[scan-material] Error sending cancelled:', err);
          cleanupAndClose();
        }
      };

      const sendError = (error: string) => {
        if (streamClosed) {
          console.warn('[scan-material] Attempted to send error after stream closed');
          return;
        }
        try {
          const update: ProgressUpdate = { type: 'error', message: error };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
          cleanupAndClose();
        } catch (err) {
          console.error('[scan-material] Error sending error message:', err);
          cleanupAndClose();
        }
      };

      // Set up keepalive interval to prevent Netlify timeout
      // Send a SSE comment every 8 seconds to keep the connection alive
      keepaliveInterval = setInterval(() => {
        try {
          if (!streamClosed) {
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
            console.log('[scan-material] Sent keepalive');
          }
        } catch {
          // Stream closed, stop keepalive
          if (keepaliveInterval) {
            clearInterval(keepaliveInterval);
            keepaliveInterval = null;
          }
        }
      }, 8000);

      try {
        const model = body.settings?.model || 'sonar-pro';
        const conservativeMode = body.settings?.conservativeMode || false;
        const docSearchProvider = body.settings?.docSearchProvider || 'perplexity';
        const exaApiKey = process.env.EXA_API_KEY;

        // Resolve the Perplexity key: user-supplied BYOK takes precedence over server env key
        const perplexityApiKey = (body.userApiKey && body.userApiKey.length > 0)
          ? body.userApiKey
          : process.env.PERPLEXITY_API_KEY;

        if (!perplexityApiKey && model.startsWith('sonar')) {
          sendError('No Perplexity API key available. Add your key in the app settings.');
          return;
        }

        // Cost accumulator for this scan
        let totalCostUsd = 0;
        let stage1InputTokens = 0;
        let stage1OutputTokens = 0;

        // Log scan start for debugging
        console.log(`[scan-material] Starting scan for material: ${body.material.name} (${body.material.id})`);
        console.log(`[scan-material] Model: ${model}, Conservative: ${conservativeMode}, DocProvider: ${docSearchProvider}`);
        console.log(`[scan-material] Project: ${body.project.name}, ZIP: ${body.project.zip}`);

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
          const perplexity = getPerplexityClientWithKey(perplexityApiKey!);

          const response = await perplexity.chat.completions.create({
            model: model,
            messages: [
              { role: 'system', content: PRODUCT_SEARCH_PROMPT },
              { role: 'user', content: productPrompt }
            ],
            temperature: 0.1,
          });

          responseText = response.choices[0]?.message?.content || '';

          // Track Stage 1 cost (sonar-pro product recommendation call)
          const usage = (response as any).usage;
          if (usage) {
            stage1InputTokens = usage.prompt_tokens ?? 0;
            stage1OutputTokens = usage.completion_tokens ?? 0;
            if (usage.total_cost != null) {
              totalCostUsd += usage.total_cost;
            } else {
              const rate = model === 'sonar-pro' ? { input: 3, output: 15 } : { input: 1, output: 1 };
              totalCostUsd += (stage1InputTokens / 1_000_000) * rate.input + (stage1OutputTokens / 1_000_000) * rate.output;
            }
          }
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
          console.error('[scan-material] No response received from AI');
          console.error('[scan-material] Model:', model);
          console.error('[scan-material] Material:', body.material.name);
          throw new Error('No response received from AI');
        }
        
        console.log(`[scan-material] Received AI response (${responseText.length} chars)`);

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
          console.log(`[scan-material] Parsed ${parsedResponse.recommendations?.length || 0} recommendations`);
        } catch (parseError) {
          console.error('[scan-material] Failed to parse AI response as JSON');
          console.error('[scan-material] Parse error:', parseError);
          console.error('[scan-material] Response text (first 500 chars):', responseText.substring(0, 500));
          console.error('[scan-material] Extracted JSON string (first 500 chars):', jsonStr.substring(0, 500));
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
        const perplexityKey = perplexityApiKey;
        const recommendations: ExtendedRecommendation[] = [];
        const totalProducts = Math.min(sortedRecs.length, 3);
        
        // Helper to add delay between API calls
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        for (let i = 0; i < totalProducts; i++) {
          // Check if stream is closed (client cancelled)
          if (streamClosed) {
            console.log(`[scan-material] Stream closed, returning ${recommendations.length} completed products`);
            const partialResult = {
              id: body.material.id,
              name: parsedResponse.name || body.material.name,
              normalized_category: parsedResponse.normalized_category || 'Other',
              category_confidence: parsedResponse.category_confidence || 0.5,
              notes_for_user: `Partial scan results (${recommendations.length} of ${totalProducts} products completed)`,
              recommendations,
            };
            sendCancelled(partialResult);
            return;
          }

          const rec = sortedRecs[i];
          const productNum = i + 1;
          
          // Add delay between searches to avoid rate limiting (except first)
          if (i > 0) {
            await delay(500); // 500ms delay between searches
          }
          
          // Check again after delay
          if (streamClosed) {
            console.log(`[scan-material] Stream closed after delay, returning ${recommendations.length} completed products`);
            const partialResult = {
              id: body.material.id,
              name: parsedResponse.name || body.material.name,
              normalized_category: parsedResponse.normalized_category || 'Other',
              category_confidence: parsedResponse.category_confidence || 0.5,
              notes_for_user: `Partial scan results (${recommendations.length} of ${totalProducts} products completed)`,
              recommendations,
            };
            sendCancelled(partialResult);
            return;
          }
          
          // Initialize doc checklist
          const docChecklist: DocChecklist = {
            epd: { status: 'unverified', doc_url: null, registry_id: null },
            hpd: { status: 'unverified', doc_url: null, registry_id: null },
            declare: { status: 'unverified', doc_url: null, registry_id: null },
            voc: { status: 'unverified', doc_url: null, registry_id: null },
          };

          let docSearch: DocSearchResult | undefined;

          // Search for all documentation types
          if (perplexityKey && rec.product_label) {
            try {
              // Check if stream is closed before starting search
              if (streamClosed) {
                console.log(`[scan-material] Stream closed before search, returning ${recommendations.length} completed products`);
                const partialResult = {
                  id: body.material.id,
                  name: parsedResponse.name || body.material.name,
                  normalized_category: parsedResponse.normalized_category || 'Other',
                  category_confidence: parsedResponse.category_confidence || 0.5,
                  notes_for_user: `Partial scan results (${recommendations.length} of ${totalProducts} products completed)`,
                  recommendations,
                };
                sendCancelled(partialResult);
                return;
              }

              sendProgress(`Product ${productNum} of ${totalProducts}: ${rec.product_label}`);
              sendProgress(`Searching documentation for ${rec.product_label}...`);
              
              // Create a progress callback that includes product number context
              const productProgressCallback = (message: string) => {
                if (!streamClosed) {
                  sendProgress(`Product ${productNum} of ${totalProducts}: ${message}`);
                }
              };
              
              docSearch = await searchForDocumentation(
                rec.product_label,
                rec.manufacturer || null,
                perplexityKey,
                productProgressCallback,
                docSearchProvider,
                exaApiKey,
              );

              // Accumulate doc search costs
              if (docSearch.costSummary) {
                totalCostUsd += docSearch.costSummary.estimatedUsd;
              }
              
              // Check if stream closed during search
              if (streamClosed) {
                console.log(`[scan-material] Stream closed during search, returning ${recommendations.length} completed products`);
                const partialResult = {
                  id: body.material.id,
                  name: parsedResponse.name || body.material.name,
                  normalized_category: parsedResponse.normalized_category || 'Other',
                  category_confidence: parsedResponse.category_confidence || 0.5,
                  notes_for_user: `Partial scan results (${recommendations.length} of ${totalProducts} products completed)`,
                  recommendations,
                };
                sendCancelled(partialResult);
                return;
              }
              
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
              console.error(`[scan-material] Doc search failed for product: ${rec.product_label}`);
              console.error('[scan-material] Error details:', error);
              if (error instanceof Error) {
                console.error('[scan-material] Error message:', error.message);
                console.error('[scan-material] Error stack:', error.stack);
              }
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
            
          }

          recommendations.push({
            product_label: rec.product_label || 'Unknown Product',
            manufacturer: rec.manufacturer || null,
            manufacturer_url: rec.manufacturer_url || null,
            product_url: verifiedProductUrl || rec.product_url || null,
            image_url: null,
            rationale: rec.rationale || '',
            doc_checklist: docChecklist,
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

        console.log(`[scan-material] Scan complete for material: ${body.material.name}`);
        console.log(`[scan-material] Returning ${sortedRecommendations.length} recommendations`);
        console.log(`[scan-material] ====== COST SUMMARY ======`);
        console.log(`[scan-material] Provider: ${docSearchProvider}`);
        console.log(`[scan-material] Stage 1 (product recs): ${stage1InputTokens} in / ${stage1OutputTokens} out tokens`);
        console.log(`[scan-material] Total cost: $${totalCostUsd.toFixed(5)}`);
        console.log(`[scan-material] ==========================`);

        sendComplete({ ...result, costUsd: totalCostUsd, docSearchProvider });
      } catch (error) {
        // Log full error details for Netlify debugging
        console.error('[scan-material] Scan error occurred');
        console.error('[scan-material] Material:', body.material.name, `(${body.material.id})`);
        console.error('[scan-material] Project:', body.project.name);
        console.error('[scan-material] Error object:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
        
        console.error('[scan-material] Error message:', errorMessage);
        console.error('[scan-material] Error stack:', errorStack);
        
        // Log additional context if available
        if (error instanceof Error && 'cause' in error) {
          console.error('[scan-material] Error cause:', (error as any).cause);
        }
        
        // Send user-friendly error message
        if (errorMessage.includes('OPENAI_API_KEY')) {
          console.error('[scan-material] OpenAI API key missing');
          sendError('OpenAI API key is not configured on the server.');
        } else if (errorMessage.includes('PERPLEXITY_API_KEY')) {
          console.error('[scan-material] Perplexity API key missing');
          sendError('Perplexity API key is not configured on the server.');
        } else {
          // Include error message in response for debugging
          const detailedError = process.env.NODE_ENV === 'production' 
            ? `Scan failed: ${errorMessage}` 
            : `Scan failed: ${errorMessage}\n\nStack: ${errorStack}`;
          console.error('[scan-material] Sending error to client:', detailedError);
          sendError(detailedError);
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
