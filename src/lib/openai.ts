import OpenAI from 'openai';

// Initialize OpenAI client
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  return new OpenAI({
    apiKey,
  });
}

// Initialize Perplexity client for web search
export function getPerplexityClient(): OpenAI {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set. Add it to .env.local for real-time product search.');
  }
  
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.perplexity.ai',
  });
}

// System prompt for finding products - PREFER DOCUMENTED PRODUCTS
export const PRODUCT_SEARCH_PROMPT = `You are a sustainable building materials expert finding products WITH DOCUMENTATION.

CRITICAL: Prioritize products that have published sustainability certifications:
- EPD (Environmental Product Declaration)
- HPD (Health Product Declaration)  
- Declare label (Living Building Challenge)
- GREENGUARD or other VOC certifications

When recommending products, prefer manufacturers known for transparency and published certifications:
- James Hardie, ROCKWOOL, Owens Corning, CertainTeed, Knauf, etc.
- Products listed on environdec.com, hpdrepository.hpd-collaborative.org, or declare.living-future.org

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
- Set has_known_* flags if you know the product has that certification
- We will search for actual documentation links separately`;

// Build prompt for product search
export function buildProductSearchPrompt(
  material: { name: string; qty: number; unit: string },
  projectGoals: string,
  projectZip: string,
  conservativeMode: boolean,
  excludeProducts?: string[]
): string {
  const excludeText = excludeProducts && excludeProducts.length > 0
    ? `\n**IMPORTANT:** Do NOT recommend these products (already found):\n${excludeProducts.map(p => `- ${p}`).join('\n')}\n`
    : '';

  return `Find sustainable product alternatives for:

**Material:** ${material.name}
**Quantity:** ${material.qty} ${material.unit}
**Location:** ZIP ${projectZip}
**Goals:** ${projectGoals}
${excludeText}
${conservativeMode ? '**Mode:** Conservative - only high-confidence results' : ''}

## REQUIREMENTS

1. Find 3 real products from major manufacturers
2. **PREFER products with published certifications** (EPD, HPD, Declare)
3. Note which certifications you believe exist for each product
4. **DO NOT recommend products that are already in the exclude list above**

## PRIORITY ORDER

1. Products with EPD published on environdec.com
2. Products with HPD on hpdrepository.hpd-collaborative.org  
3. Products with Declare label
4. Products from sustainability-focused manufacturers

Return products most likely to have documentation first.`;
}

// Build prompt for batch scan
export function buildScanPrompt(
  materials: Array<{ name: string; qty: number; unit: string }>,
  projectGoals: string,
  projectZip: string,
  conservativeMode: boolean
): string {
  const materialList = materials
    .map((m, i) => `${i + 1}. ${m.name} (${m.qty} ${m.unit})`)
    .join('\n');

  return `Find sustainable products for these materials:

**Location:** ZIP ${projectZip}
**Goals:** ${projectGoals}

**Materials:**
${materialList}

${conservativeMode ? '**Mode:** Conservative' : ''}

For EACH material:
1. Find 3 real products
2. **PREFER products with published EPD/HPD/Declare documentation**
3. Products from transparent manufacturers (James Hardie, ROCKWOOL, etc.)

Return JSON:
{
  "materials": [
    {
      "name": "material name",
      "normalized_category": "category",
      "category_confidence": 0.9,
      "notes_for_user": "notes",
      "recommendations": [
        {
          "product_label": "Product",
          "manufacturer": "Company",
          "manufacturer_url": "https://...",
          "product_url": "https://...",
          "rationale": "Why sustainable",
          "has_known_epd": true,
          "has_known_hpd": false,
          "has_known_declare": false,
          "confidence": 0.85
        }
      ]
    }
  ]
}`;
}
