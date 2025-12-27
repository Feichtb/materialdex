/**
 * Database lookup module for sustainability certifications.
 * 
 * This module provides functions to construct verified URLs from registry IDs
 * and validate documentation links for building products.
 */

// Registry URL patterns - construct verified URLs from IDs
export const REGISTRY_URLS = {
  // EPD International / Environdec - most comprehensive EPD database
  // Pattern: https://www.environdec.com/library/epd{NUMBER}
  // Example: epd5037 for James Hardie products
  environdec: (epdNumber: string) => {
    // Clean up the EPD number - extract just the numeric part
    // Input could be: "epd5037", "EPD-IES-0005037", "S-P-05037", "5037"
    const numericMatch = epdNumber.match(/(\d+)/);
    if (numericMatch) {
      return `https://www.environdec.com/library/epd${numericMatch[1]}`;
    }
    return null;
  },

  // UL SPOT EPD database - uses different ID format
  // Pattern: https://spot.ul.com/main-app/products/detail/{UUID}
  ulSpot: (spotId: string) => {
    if (spotId && spotId.length > 0) {
      return `https://spot.ul.com/main-app/products/detail/${spotId}`;
    }
    return null;
  },

  // HPD Repository
  // Pattern: https://hpdrepository.hpd-collaborative.org/Pages/PublicView.aspx?HPDID={ID}
  hpd: (hpdId: string) => {
    if (hpdId && hpdId.length > 0) {
      return `https://hpdrepository.hpd-collaborative.org/Pages/PublicView.aspx?HPDID=${hpdId}`;
    }
    return null;
  },

  // Declare database (Living Future Institute)
  // Pattern: https://declare.living-future.org/products/{SLUG}
  declare: (declareId: string) => {
    if (declareId && declareId.length > 0) {
      return `https://declare.living-future.org/products/${declareId}`;
    }
    return null;
  },
};

// Build URL from registry ID
export function buildDocumentUrl(
  docType: 'epd' | 'hpd' | 'declare' | 'voc',
  registryId: string | null | undefined
): string | null {
  if (!registryId || registryId.trim() === '') {
    return null;
  }

  const cleanId = registryId.trim();

  switch (docType) {
    case 'epd':
      return REGISTRY_URLS.environdec(cleanId);
    case 'hpd':
      return REGISTRY_URLS.hpd(cleanId);
    case 'declare':
      return REGISTRY_URLS.declare(cleanId);
    case 'voc':
      // VOC doesn't have a standard registry, return null
      return null;
    default:
      return null;
  }
}

// Search URL generators - for manual searching
export function generateSearchUrls(productName: string, manufacturer?: string | null) {
  const query = encodeURIComponent(
    manufacturer ? `${manufacturer} ${productName}` : productName
  );
  
  return {
    epd: {
      environdec: `https://www.environdec.com/library?query=${query}`,
      ulSpot: `https://spot.ul.com/main-app/products/catalog/search?q=${query}`,
    },
    hpd: {
      repository: `https://hpdrepository.hpd-collaborative.org/Pages/Results.aspx?k=${query}`,
    },
    declare: {
      livingFuture: `https://declare.living-future.org/products?search=${query}`,
    },
    general: {
      mindfulMaterials: `https://www.mindfulmaterials.com/materials?search=${query}`,
    },
  };
}

/**
 * Instructions for the AI on how to find EPD numbers
 */
export function getEPDSearchInstructions(): string {
  return `
## Finding EPD Numbers

For EPD (Environmental Product Declaration) documentation, your PRIMARY goal is to find the **EPD registration number**.

### Where to Find EPD Numbers:
1. **Environdec Library** (https://www.environdec.com/library) - Search by manufacturer/product
2. **UL SPOT** (https://spot.ul.com) - Search by product name
3. **Manufacturer sustainability pages** - Often list their EPD numbers

### EPD Number Formats:
- Environdec: "epd5037", "EPD-IES-0005037", "S-P-05037" → extract the number (5037)
- These are the REGISTRATION numbers, not arbitrary IDs

### What to Return:
- If you find an EPD number, return it in the \`registry_id\` field (e.g., "5037" or "epd5037")
- Set \`status\` to "verified" 
- The system will automatically construct the URL: https://www.environdec.com/library/epd{NUMBER}

### Examples:
- James Hardie HardiePlank: EPD number is "5037" → URL becomes https://www.environdec.com/library/epd5037
- ROCKWOOL products: Search environdec.com for their EPD number

### CRITICAL:
- Only return an EPD number if you ACTUALLY FOUND it in a database search
- If unsure, return null - do NOT guess or fabricate numbers
`;
}

/**
 * Full database search instructions for the AI
 */
export function getDatabaseSearchInstructions(): string {
  return `
## Finding Certification Numbers (NOT URLs)

For each product, find the REGISTRY ID/NUMBER for certifications. The system will construct URLs automatically.

${getEPDSearchInstructions()}

## Finding HPD IDs

Search the HPD Repository (https://hpdrepository.hpd-collaborative.org) for the product.
- Return the HPD ID in \`registry_id\` field
- The system will construct the URL automatically

## Finding Declare Labels

Search the Declare database (https://declare.living-future.org/products) for the product.
- Return the product slug or ID in \`registry_id\` field
- The system will construct the URL automatically

## RULES:
1. Focus on finding the REGISTRY NUMBER/ID, not the full URL
2. Set status to "verified" ONLY if you found the ID
3. If you can't find the ID, set registry_id to null and status to "unverified"
4. NEVER fabricate or guess registry numbers
`;
}

/**
 * Validates that a registry ID looks legitimate
 */
export function validateRegistryId(registryId: string | null | undefined, docType: 'epd' | 'hpd' | 'declare' | 'voc'): boolean {
  if (!registryId || registryId.trim() === '') {
    return false;
  }

  const cleanId = registryId.trim();

  switch (docType) {
    case 'epd':
      // EPD numbers should contain digits
      return /\d+/.test(cleanId);
    case 'hpd':
      // HPD IDs are typically alphanumeric
      return cleanId.length > 0 && cleanId.length < 50;
    case 'declare':
      // Declare IDs are slugs or alphanumeric
      return cleanId.length > 0 && cleanId.length < 100;
    default:
      return false;
  }
}

/**
 * Process recommendations to build URLs from registry IDs
 */
export function processDocumentationUrls(recommendations: Array<{
  product_label: string;
  doc_checklist: {
    epd: { status: string; doc_url: string | null; registry_id?: string | null };
    hpd: { status: string; doc_url: string | null; registry_id?: string | null };
    declare: { status: string; doc_url: string | null; registry_id?: string | null };
    voc: { status: string; doc_url: string | null; registry_id?: string | null };
  };
}>) {
  return recommendations.map(rec => {
    const docTypes: Array<'epd' | 'hpd' | 'declare' | 'voc'> = ['epd', 'hpd', 'declare', 'voc'];
    
    const processedChecklist = { ...rec.doc_checklist };
    
    for (const docType of docTypes) {
      const doc = rec.doc_checklist[docType];
      const registryId = doc.registry_id;
      
      if (registryId && validateRegistryId(registryId, docType)) {
        // Build URL from registry ID
        const url = buildDocumentUrl(docType, registryId);
        processedChecklist[docType] = {
          status: 'verified',
          doc_url: url,
          registry_id: registryId,
        };
      } else {
        // No valid registry ID - mark as unverified
        processedChecklist[docType] = {
          status: 'unverified',
          doc_url: null,
          registry_id: null,
        };
      }
    }

    return {
      ...rec,
      doc_checklist: processedChecklist,
    };
  });
}
