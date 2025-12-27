/**
 * Industry-Wide EPDs and HPDs
 * 
 * These are Environmental Product Declarations and Health Product Declarations
 * that cover entire product categories rather than specific manufacturer products.
 * They are created by industry associations and can be used as fallbacks when
 * manufacturer-specific documentation isn't available.
 * 
 * These provide a baseline for comparison and research.
 */

export interface IndustryWideDoc {
  id: string;
  type: 'epd' | 'hpd';
  title: string;
  issuer: string;
  url: string;
  registryId?: string;
  categories: string[]; // Material categories this applies to
  keywords: string[]; // Keywords to match against material names
  validUntil?: string; // Expiration date if known
  notes?: string;
}

// Known industry-wide EPDs from major industry associations
export const industryWideEpds: IndustryWideDoc[] = [
  // Concrete and Cement
  {
    id: 'nrmca-concrete',
    type: 'epd',
    title: 'Industry Average EPD for Ready Mixed Concrete',
    issuer: 'National Ready Mixed Concrete Association (NRMCA)',
    url: 'https://www.nrmca.org/association-resources/sustainability/epd-program/',
    categories: ['concrete', 'masonry'],
    keywords: ['concrete', 'ready mix', 'cement', 'slab', 'foundation', 'footing'],
    notes: 'Industry average for ready-mixed concrete products. Individual manufacturer EPDs may vary.',
  },
  {
    id: 'pca-cement',
    type: 'epd',
    title: 'Industry Average EPD for Portland Cement',
    issuer: 'Portland Cement Association (PCA)',
    url: 'https://www.cement.org/sustainability/environmental-product-declarations',
    categories: ['concrete', 'masonry', 'cement'],
    keywords: ['cement', 'portland', 'concrete'],
    notes: 'Industry average for portland cement. Basis for concrete mix designs.',
  },
  
  // Steel and Metals
  {
    id: 'aisc-structural-steel',
    type: 'epd',
    title: 'Industry-Wide EPD for Structural Steel',
    issuer: 'American Institute of Steel Construction (AISC)',
    url: 'https://www.aisc.org/why-steel/sustainability/',
    categories: ['steel', 'metals', 'structural'],
    keywords: ['steel', 'structural steel', 'steel beam', 'steel column', 'wide flange', 'i-beam'],
    notes: 'Industry average for fabricated structural steel. Covers hot-rolled sections.',
  },
  {
    id: 'sma-steel-deck',
    type: 'epd',
    title: 'Industry Average EPD for Steel Deck',
    issuer: 'Steel Deck Institute (SDI)',
    url: 'https://www.sdi.org/epd/',
    categories: ['steel', 'decking', 'roofing'],
    keywords: ['steel deck', 'metal deck', 'roof deck', 'floor deck'],
    notes: 'Industry average for steel roof and floor deck products.',
  },
  {
    id: 'mca-metal-roofing',
    type: 'epd',
    title: 'Industry Average EPD for Metal Roofing/Siding',
    issuer: 'Metal Construction Association (MCA)',
    url: 'https://www.metalconstruction.org/index.php/education/sustainability',
    categories: ['roofing', 'siding', 'metals'],
    keywords: ['metal roofing', 'standing seam', 'metal siding', 'metal panel', 'metal cladding'],
    notes: 'Industry average for architectural metal roofing and wall panels.',
  },
  
  // Wood and Forest Products
  {
    id: 'apa-plywood',
    type: 'epd',
    title: 'Industry-Wide EPD for Softwood Plywood',
    issuer: 'APA - The Engineered Wood Association',
    url: 'https://www.apawood.org/sustainability',
    categories: ['wood', 'sheathing', 'structural'],
    keywords: ['plywood', 'sheathing', 'osb', 'oriented strand board', 'structural panel'],
    notes: 'Industry average for softwood plywood and OSB structural panels.',
  },
  {
    id: 'awc-dimension-lumber',
    type: 'epd',
    title: 'Industry-Wide EPD for North American Softwood Lumber',
    issuer: 'American Wood Council (AWC)',
    url: 'https://www.awc.org/sustainability/epd',
    categories: ['wood', 'structural', 'framing'],
    keywords: ['lumber', 'softwood', 'framing', 'dimension lumber', 'stud', '2x4', '2x6'],
    notes: 'Industry average for dimension lumber used in wood frame construction.',
  },
  {
    id: 'nwfa-hardwood-flooring',
    type: 'epd',
    title: 'Industry-Wide EPD for Hardwood Flooring',
    issuer: 'National Wood Flooring Association (NWFA)',
    url: 'https://www.nwfa.org/sustainability.aspx',
    categories: ['flooring', 'wood'],
    keywords: ['hardwood flooring', 'wood flooring', 'engineered hardwood', 'solid hardwood'],
    notes: 'Industry average for solid and engineered hardwood flooring.',
  },
  
  // Insulation
  {
    id: 'naima-fiberglass',
    type: 'epd',
    title: 'Industry-Wide EPD for Fiberglass Insulation',
    issuer: 'North American Insulation Manufacturers Association (NAIMA)',
    url: 'https://insulationinstitute.org/epd/',
    categories: ['insulation'],
    keywords: ['fiberglass', 'glass wool', 'batt insulation', 'blown insulation', 'fiber glass'],
    notes: 'Industry average for fiberglass batt and blown insulation products.',
  },
  {
    id: 'naima-mineral-wool',
    type: 'epd',
    title: 'Industry-Wide EPD for Mineral Wool Insulation',
    issuer: 'North American Insulation Manufacturers Association (NAIMA)',
    url: 'https://insulationinstitute.org/epd/',
    categories: ['insulation'],
    keywords: ['mineral wool', 'rock wool', 'stone wool', 'slag wool'],
    notes: 'Industry average for mineral wool insulation products.',
  },
  {
    id: 'cima-cellulose',
    type: 'epd',
    title: 'Industry-Wide EPD for Cellulose Insulation',
    issuer: 'Cellulose Insulation Manufacturers Association (CIMA)',
    url: 'https://www.cellulose.org/sustainability/',
    categories: ['insulation'],
    keywords: ['cellulose', 'dense pack', 'loose fill', 'recycled paper'],
    notes: 'Industry average for cellulose insulation products.',
  },
  
  // Gypsum
  {
    id: 'gypsum-association',
    type: 'epd',
    title: 'Industry-Wide EPD for Gypsum Board',
    issuer: 'Gypsum Association',
    url: 'https://www.gypsum.org/sustainability/epd/',
    categories: ['gypsum', 'drywall', 'interior'],
    keywords: ['gypsum', 'drywall', 'sheetrock', 'wallboard', 'gwb', 'gypsum board'],
    notes: 'Industry average for gypsum wallboard products.',
  },
  
  // Glass
  {
    id: 'gmi-flat-glass',
    type: 'epd',
    title: 'Industry-Wide EPD for Flat Glass',
    issuer: 'Glass Manufacturing Industry Council (GMIC)',
    url: 'https://www.gmic.org/sustainability/',
    categories: ['glass', 'glazing', 'windows'],
    keywords: ['glass', 'flat glass', 'float glass', 'window glass', 'glazing'],
    notes: 'Industry average for flat glass products used in windows and facades.',
  },
  
  // Masonry
  {
    id: 'ncma-cmu',
    type: 'epd',
    title: 'Industry-Wide EPD for Concrete Masonry Units',
    issuer: 'National Concrete Masonry Association (NCMA)',
    url: 'https://ncma.org/resource/epd/',
    categories: ['masonry', 'concrete'],
    keywords: ['cmu', 'concrete block', 'masonry block', 'concrete masonry', 'block wall'],
    notes: 'Industry average for concrete masonry units (CMU).',
  },
  {
    id: 'bia-brick',
    type: 'epd',
    title: 'Industry-Wide EPD for Brick',
    issuer: 'Brick Industry Association (BIA)',
    url: 'https://www.gobrick.com/sustainability',
    categories: ['masonry', 'brick'],
    keywords: ['brick', 'clay brick', 'face brick', 'masonry'],
    notes: 'Industry average for clay brick products.',
  },
  
  // Roofing
  {
    id: 'arma-asphalt-shingles',
    type: 'epd',
    title: 'Industry-Wide EPD for Asphalt Roofing Shingles',
    issuer: 'Asphalt Roofing Manufacturers Association (ARMA)',
    url: 'https://www.asphaltroofing.org/sustainability/',
    categories: ['roofing'],
    keywords: ['asphalt shingle', 'composition shingle', 'architectural shingle', 'roofing shingle'],
    notes: 'Industry average for asphalt roofing shingles.',
  },
  {
    id: 'spri-single-ply',
    type: 'epd',
    title: 'Industry-Wide EPD for Single-Ply Roofing',
    issuer: 'Single Ply Roofing Industry (SPRI)',
    url: 'https://www.spri.org/sustainability/',
    categories: ['roofing', 'membrane'],
    keywords: ['epdm', 'tpo', 'pvc', 'single ply', 'membrane roofing', 'roof membrane'],
    notes: 'Industry average for EPDM, TPO, and PVC roofing membranes.',
  },
  
  // Flooring
  {
    id: 'tcna-ceramic-tile',
    type: 'epd',
    title: 'Industry-Wide EPD for Ceramic Tile',
    issuer: 'Tile Council of North America (TCNA)',
    url: 'https://www.tcnatile.com/sustainability.html',
    categories: ['flooring', 'tile'],
    keywords: ['ceramic tile', 'porcelain tile', 'floor tile', 'wall tile'],
    notes: 'Industry average for ceramic and porcelain tile products.',
  },
  {
    id: 'rfci-resilient-flooring',
    type: 'epd',
    title: 'Industry-Wide EPD for Resilient Flooring',
    issuer: 'Resilient Floor Covering Institute (RFCI)',
    url: 'https://www.rfci.com/sustainability/',
    categories: ['flooring', 'resilient'],
    keywords: ['lvt', 'vinyl flooring', 'resilient flooring', 'sheet vinyl', 'vinyl tile'],
    notes: 'Industry average for LVT and resilient flooring products.',
  },
];

/**
 * Find applicable industry-wide EPDs for a material
 */
export function findIndustryWideEpds(materialName: string, category?: string): IndustryWideDoc[] {
  const nameLower = materialName.toLowerCase();
  const categoryLower = category?.toLowerCase() || '';
  
  return industryWideEpds.filter(doc => {
    // Check if any keyword matches the material name
    const keywordMatch = doc.keywords.some(keyword => 
      nameLower.includes(keyword.toLowerCase())
    );
    
    // Check if the category matches
    const categoryMatch = category && doc.categories.some(cat =>
      categoryLower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(categoryLower)
    );
    
    return keywordMatch || categoryMatch;
  });
}

/**
 * Get all unique categories with industry-wide EPDs
 */
export function getCategoriesWithIndustryEpds(): string[] {
  const categories = new Set<string>();
  industryWideEpds.forEach(doc => {
    doc.categories.forEach(cat => categories.add(cat));
  });
  return Array.from(categories).sort();
}

