import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, getPerplexityClient, PRODUCT_SEARCH_PROMPT, buildProductSearchPrompt } from '@/lib/openai';
import { searchForDocumentation, DocSearchResult } from '@/lib/docSearch';
import { ScanRequest, ScanResponse, ProductRecommendation, DocStatus, DocChecklist } from '@/types';

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

interface AIMaterial {
  name: string;
  normalized_category: string;
  category_confidence: number;
  notes_for_user: string;
  recommendations: AIRecommendation[];
}

interface AIBatchResponse {
  materials: AIMaterial[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ScanRequest = await request.json();
    
    if (!body.project || !body.materials || body.materials.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: project and materials are required' },
        { status: 400 }
      );
    }

    const model = body.settings?.model || 'sonar-pro';
    const conservativeMode = body.settings?.conservativeMode || false;

    // Process each material
    const processedMaterials = await Promise.all(
      body.materials.map(async (material) => {
        // STAGE 1: Get product recommendations
        const productPrompt = buildProductSearchPrompt(
          material,
          body.project.goals,
          body.project.zip,
          conservativeMode
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
          return {
            name: material.name,
            normalized_category: 'Other',
            category_confidence: 0,
            notes_for_user: 'Failed to get AI response',
            recommendations: [],
          };
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

        let parsedResponse: AIMaterial;
        try {
          parsedResponse = JSON.parse(jsonStr);
        } catch {
          console.error('Failed to parse AI response:', responseText);
          return {
            name: material.name,
            normalized_category: 'Other',
            category_confidence: 0,
            notes_for_user: 'Failed to parse AI response',
            recommendations: [],
          };
        }

        // Sort recommendations by known documentation
        const sortedRecs = [...(parsedResponse.recommendations || [])].sort((a, b) => {
          const aScore = (a.has_known_epd ? 3 : 0) + (a.has_known_hpd ? 2 : 0) + (a.has_known_declare ? 1 : 0);
          const bScore = (b.has_known_epd ? 3 : 0) + (b.has_known_hpd ? 2 : 0) + (b.has_known_declare ? 1 : 0);
          return bScore - aScore;
        });

        // STAGE 2: Search for documentation for each product
        // Run SEQUENTIALLY with delay to avoid rate limiting
        const perplexityKey = process.env.PERPLEXITY_API_KEY;
        const recommendations: ExtendedRecommendation[] = [];
        
        // Helper to add delay between API calls
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        for (let i = 0; i < Math.min(sortedRecs.length, 3); i++) {
          const rec = sortedRecs[i];
          
          // Add delay between searches to avoid rate limiting (except first)
          if (i > 0) {
            await delay(500); // 500ms delay between searches
          }
          
          const docChecklist: DocChecklist = {
            epd: { status: 'unverified', doc_url: null, registry_id: null },
            hpd: { status: 'unverified', doc_url: null, registry_id: null },
            declare: { status: 'unverified', doc_url: null, registry_id: null },
            voc: { status: 'unverified', doc_url: null, registry_id: null },
          };

          let docSearch: DocSearchResult | undefined;

          if (perplexityKey && rec.product_label) {
            try {
              docSearch = await searchForDocumentation(
                rec.product_label,
                rec.manufacturer || null,
                perplexityKey
              );

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
              }
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
            product_url: verifiedProductUrl || rec.product_url || null, // Prefer verified URL
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

        return {
          name: parsedResponse.name || material.name,
          normalized_category: parsedResponse.normalized_category || 'Other',
          category_confidence: parsedResponse.category_confidence || 0.5,
          notes_for_user: parsedResponse.notes_for_user || '',
          recommendations: sortedRecommendations,
        };
      })
    );

    const result: ScanResponse = {
      materials: processedMaterials,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (errorMessage.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local' },
        { status: 500 }
      );
    }
    if (errorMessage.includes('PERPLEXITY_API_KEY')) {
      return NextResponse.json(
        { error: 'Perplexity API key is not configured. Add PERPLEXITY_API_KEY to .env.local for real-time product search.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: `Scan failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
