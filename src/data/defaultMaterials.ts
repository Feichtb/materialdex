import { InputMaterial } from '@/types';

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Default 20 generic Revit-style materials
export const defaultMaterials: InputMaterial[] = [
  {
    id: generateId(),
    name: 'Fiber cement lap siding',
    qty: 2400,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Thermally modified wood cladding',
    qty: 1200,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Standing seam metal roofing',
    qty: 3200,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'EPDM roofing membrane',
    qty: 1800,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Exterior sheathing (plywood)',
    qty: 4000,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Air/water barrier membrane',
    qty: 4000,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Mineral wool batt insulation',
    qty: 800,
    unit: 'cf',
  },
  {
    id: generateId(),
    name: 'Dense-pack cellulose insulation',
    qty: 600,
    unit: 'cf',
  },
  {
    id: generateId(),
    name: 'Closed-cell spray foam insulation',
    qty: 400,
    unit: 'cf',
  },
  {
    id: generateId(),
    name: 'Gypsum wall board (GWB) 5/8"',
    qty: 6000,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Interior paint, low-VOC',
    qty: 5000,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Engineered hardwood flooring',
    qty: 1800,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Porcelain floor tile',
    qty: 800,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Cementitious backer board',
    qty: 400,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Quartz countertop slab',
    qty: 60,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Solid surface countertop',
    qty: 40,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Aluminum-clad wood windows, triple-glazed',
    qty: 24,
    unit: 'ea',
  },
  {
    id: generateId(),
    name: 'Fiberglass exterior door',
    qty: 4,
    unit: 'ea',
  },
  {
    id: generateId(),
    name: 'Composite decking',
    qty: 600,
    unit: 'sf',
  },
  {
    id: generateId(),
    name: 'Concrete slab-on-grade',
    qty: 2000,
    unit: 'cf',
  },
];

export const defaultProjectInfo = {
  name: 'New Construction Project',
  zip: '97205',
  goals: 'Achieve LEED Gold certification. Prioritize low-carbon materials, local sourcing within 500 miles, and Red List-free products. Target 20% reduction in embodied carbon compared to baseline.',
};

export const defaultSettings = {
  model: 'sonar-pro' as const,
  conservativeMode: false,
  neverFabricateUrls: true,
  useWebSearch: true,
  docSearchProvider: 'perplexity-v2' as const,
};

