import { DocSearchResult } from '@/lib/docSearch';

// Material unit types
export type MaterialUnit = 'sf' | 'cf' | 'lf' | 'ea' | 'unknown';

// Document verification status
export type VerificationStatus = 'verified' | 'unverified' | 'user-provided' | 'needs-link';

// Document types for sustainability certification
export type DocType = 'epd' | 'hpd' | 'declare' | 'voc';

// Document status in checklist
export interface DocStatus {
  status: VerificationStatus;
  doc_url: string | null;
  registry_id?: string | null; // EPD number, HPD ID, Declare ID, etc.
}

// Document checklist for a product
export interface DocChecklist {
  epd: DocStatus;
  hpd: DocStatus;
  declare: DocStatus;
  voc: DocStatus;
}

// Product recommendation
export interface ProductRecommendation {
  product_label: string;
  manufacturer: string | null;
  manufacturer_url: string | null;
  product_url: string | null;
  image_url: string | null; // Product image from web search
  rationale: string;
  doc_checklist: DocChecklist;
  distance_miles: number | null;
  confidence: number;
  saved?: boolean;
  rejected?: boolean;
  doc_search?: DocSearchResult; // Documentation search results with links
}

// Input material from user
export interface InputMaterial {
  id: string;
  name: string;
  qty: number;
  unit: MaterialUnit;
  ignored?: boolean;
  saved?: boolean;
  mapped?: boolean;
}

// Scanned material with AI results
export interface ScannedMaterial {
  id: string;
  name: string;
  qty: number;
  unit: MaterialUnit;
  normalized_category: string;
  category_confidence: number;
  notes_for_user: string;
  recommendations: ProductRecommendation[];
  ignored?: boolean;
  saved?: boolean;
  mapped?: boolean;
}

// Project information
export interface ProjectInfo {
  name: string;
  zip: string;
  goals: string;
  projectId?: string; // Unique identifier for the Revit project (document path)
}

// API request for scanning
export interface ScanRequest {
  project: ProjectInfo;
  materials: Array<{
    name: string;
    qty: number;
    unit: MaterialUnit;
  }>;
  settings?: {
    model: string;
    conservativeMode: boolean;
  };
}

// API response from scanning
export interface ScanResponse {
  materials: Array<{
    name: string;
    normalized_category: string;
    category_confidence: number;
    notes_for_user: string;
    recommendations: ProductRecommendation[];
  }>;
  error?: string;
}

// Verify request
export interface VerifyRequest {
  materialName: string;
  productLabel: string;
  docType: DocType;
  url: string;
}

// Verify response
export interface VerifyResponse {
  success: boolean;
  status: VerificationStatus;
  message?: string;
}

// App settings
export interface AppSettings {
  model: 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | 'sonar-pro' | 'sonar';
  conservativeMode: boolean;
  neverFabricateUrls: boolean; // Always true, enforced
  useWebSearch: boolean; // Use web search for real product data
  docSearchProvider: 'perplexity' | 'perplexity-v2' | 'exa'; // Provider for doc URL searches (Stage 2)
}

// Application state
export interface AppState {
  project: ProjectInfo;
  materials: InputMaterial[];
  scannedMaterials: ScannedMaterial[];
  settings: AppSettings;
  lastScanTime: string | null;
  isScanning: boolean;
}

// Filter options for materials table
export interface MaterialFilters {
  searchQuery: string;
  showUnmappedOnly: boolean;
  showIgnored: boolean;
  showSaved: boolean;
}

// Export format types
export type ExportFormat = 'csv' | 'pdf';

// Revit project info from plugin
export interface RevitProjectInfo {
  name: string;
  zip?: string;
  address?: string;
  projectId?: string; // Unique identifier for the Revit project (document path)
  projectPath?: string;
  projectName?: string;
  projectNumber?: string;
  clientName?: string;
}

// Unified RevitBridge interface - all properties that any module might use
export interface RevitBridge {
  isRevitPlugin: boolean;
  sendToRevit: (data: any) => void;
  receiveMaterials: (materials: any) => void;
  receiveTheme: (theme: any) => void;
  requestTheme: () => void;
  requestMaterials?: (skip: number, take: number) => void;
  receiveProjectInfo?: (info: RevitProjectInfo) => void;
  requestProjectInfo?: () => void;
  extractMaterials?: () => void;
}

// Extend Window interface for TypeScript - single source of truth
declare global {
  interface Window {
    revitBridge?: RevitBridge;
    onRevitMaterials?: (materials: any) => void;
    revitMaterialsQueue?: any[];
    onRevitProjectInfo?: (info: RevitProjectInfo) => void;
    revitProjectInfoQueue?: RevitProjectInfo[];
  }
}

