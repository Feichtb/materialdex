'use client';

import { useState, useEffect } from 'react';
import { InputMaterial, ScannedMaterial, ProductRecommendation, DocType, AppSettings, ProjectInfo } from '@/types';
import { DocSearchResult, CategorizedLink } from '@/lib/docSearch';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Loader2,
  Library,
  FileQuestion,
  RefreshCw,
  X,
  Info,
  Plus,
} from 'lucide-react';

// Extended product type that includes doc_search results
interface ExtendedProduct extends ProductRecommendation {
  doc_search?: DocSearchResult;
}

interface MinimalLayoutProps {
  materials: InputMaterial[];
  scannedMaterials: ScannedMaterial[];
  project: ProjectInfo;
  settings: AppSettings;
  onMaterialChange: (id: string, updates: Partial<InputMaterial>) => void;
  onSingleScanComplete: (result: ScannedMaterial) => void;
  onSaveProduct: (materialId: string, productLabel: string) => void;
  onRejectProduct: (materialId: string, productLabel: string) => void;
  onAddLink: (materialId: string, productLabel: string, docType: DocType, url: string) => void;
  onLoadMoreMaterials?: () => void;
  hasMoreMaterials?: boolean;
  isLoadingMaterials?: boolean;
  onSettingsChange?: (settings: Partial<AppSettings>) => void;
  onRefresh?: () => void;
}

type View = 'scan' | 'library';

// Doc type display config
const DOC_TYPE_CONFIG = {
  epd: { label: 'EPD', fullLabel: 'Environmental Product Declaration', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  hpd: { label: 'HPD', fullLabel: 'Health Product Declaration', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  declare: { label: 'Declare', fullLabel: 'Declare Label', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  voc: { label: 'VOC', fullLabel: 'VOC Certification', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  product_page: { label: 'Product', fullLabel: 'Product Page', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
};

export default function MinimalLayout({
  materials,
  scannedMaterials,
  project,
  settings,
  onMaterialChange,
  onSingleScanComplete,
  onSaveProduct,
  onRejectProduct,
  onAddLink,
  onLoadMoreMaterials,
  hasMoreMaterials = false,
  isLoadingMaterials = false,
  onSettingsChange,
  onRefresh,
}: MinimalLayoutProps) {
  const [view, setView] = useState<View>('scan');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [expandedLibraryProduct, setExpandedLibraryProduct] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isFindingMore, setIsFindingMore] = useState(false);

  // Check if running in Revit plugin
  const isRevitPlugin = typeof window !== 'undefined' && window.revitBridge?.isRevitPlugin;

  // Auto-select first material
  useEffect(() => {
    if (!selectedMaterialId && materials.length > 0) {
      setSelectedMaterialId(materials[0].id);
    }
  }, [materials, selectedMaterialId]);

  // Get selected material and its scan results
  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);
  const scannedResult = scannedMaterials.find(m => m.id === selectedMaterialId);

  // Get all saved products across all materials
  const savedProducts = scannedMaterials.flatMap(m => 
    m.recommendations
      .filter(r => r.saved)
      .map(r => ({ ...r, materialId: m.id, materialName: m.name }))
  );

  // Scan single material with progress updates
  const handleScan = async () => {
    if (!selectedMaterial) return;
    
    setIsScanning(true);
    setScanError(null);
    setScanProgress(['Starting scan...']);
    
    try {
      // Use Firebase Functions for production (longer timeout than Netlify's 30s limit)
      const FIREBASE_SCAN_URL = 'https://us-central1-materialdex-677c3.cloudfunctions.net/scanMaterial';
      const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const scanUrl = isLocalhost ? '/api/scan-material' : FIREBASE_SCAN_URL;
      
      console.log('[Materialdex] Scan URL:', scanUrl, 'isLocalhost:', isLocalhost);
      
      const response = await fetch(scanUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          material: selectedMaterial,
          project,
          settings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Scan failed');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: any = null;

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setScanProgress(prev => {
                  // Keep last 8 messages to avoid overwhelming the UI
                  const updated = [...prev, data.message];
                  return updated.slice(-8);
                });
              } else if (data.type === 'complete') {
                result = data.data;
                setScanProgress([]);
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      if (result) {
        onSingleScanComplete(result);
        setExpandedProduct(null);
      } else {
        throw new Error('No result received');
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Scan failed');
      setScanProgress([]);
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle bookmark
  const handleToggleBookmark = (product: ProductRecommendation, materialId: string) => {
    if (product.saved) {
      onRejectProduct(materialId, product.product_label);
    } else {
      onSaveProduct(materialId, product.product_label);
    }
  };

  // Get valid links for a doc type (filter out wrong_manufacturer)
  const getValidLinks = (docSearch: DocSearchResult | undefined, docType: keyof typeof DOC_TYPE_CONFIG): CategorizedLink[] => {
    if (!docSearch) return [];
    
    const links = docSearch.byType[docType as keyof typeof docSearch.byType];
    if (!links) return [];
    
    // Filter out wrong_manufacturer links and sort by confidence
    return links
      .filter(link => link.category !== 'wrong_manufacturer')
      .sort((a, b) => b.confidence - a.confidence);
  };

  // Count valid docs found
  const countValidDocs = (product: ExtendedProduct) => {
    const docSearch = product.doc_search;
    if (!docSearch) return 0;
    
    let count = 0;
    (['epd', 'hpd', 'declare', 'voc'] as const).forEach(type => {
      if (getValidLinks(docSearch, type).length > 0) count++;
    });
    return count;
  };

  // Render doc badges (quick overview)
  const renderDocBadges = (product: ExtendedProduct) => {
    const docSearch = product.doc_search;
    
    return (
      <div className="flex gap-1 flex-wrap">
        {(['epd', 'hpd', 'declare', 'voc'] as const).map(type => {
          const config = DOC_TYPE_CONFIG[type];
          const links = getValidLinks(docSearch, type);
          const count = links.length;
          
          return (
            <span
              key={type}
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                count > 0 
                  ? `${config.bgColor} ${config.color}` 
                  : 'bg-revit-border/30 text-revit-text/40'
              }`}
            >
              {config.label}
              {count > 1 && ` (${count})`}
            </span>
          );
        })}
      </div>
    );
  };

  // Render all links for a doc type
  const renderDocLinks = (docSearch: DocSearchResult | undefined, docType: keyof typeof DOC_TYPE_CONFIG) => {
    const config = DOC_TYPE_CONFIG[docType];
    const links = getValidLinks(docSearch, docType);
    
    if (links.length === 0) {
      return (
        <div className="py-1">
          <div className={`text-xs font-medium ${config.color} mb-1`}>{config.label}</div>
          <div className="text-[10px] text-revit-text/50 flex items-center gap-1">
            <FileQuestion className="w-3 h-3" />
            No links found
          </div>
        </div>
      );
    }
    
    return (
      <div className="py-1">
        <div className={`text-xs font-medium ${config.color} mb-1`}>
          {config.label} ({links.length} link{links.length !== 1 ? 's' : ''})
        </div>
        <div className="space-y-1">
          {links.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 p-1.5 rounded hover:bg-revit-dark/50 group transition-colors"
            >
              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 text-revit-text/50 group-hover:text-revit-success" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-revit-text/80 group-hover:text-revit-text truncate">
                  {link.title || new URL(link.url).hostname}
                </div>
                <div className="text-[9px] text-revit-text/50 truncate">
                  {new URL(link.url).hostname}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  };

  // Handle finding more materials (avoiding duplicates)
  const handleFindMoreMaterials = async () => {
    if (!selectedMaterial || !scannedResult) return;
    
    setIsFindingMore(true);
    setScanError(null);
    
    try {
      // Get existing product labels to avoid duplicates
      const existingProducts = scannedResult.recommendations.map(r => r.product_label.toLowerCase());
      
      const response = await fetch('/api/scan-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material: selectedMaterial,
          project,
          settings,
          excludeProducts: existingProducts, // Pass existing products to avoid duplicates
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Scan failed');
      }

      const result = await response.json();
      
      // Merge new recommendations with existing ones, avoiding duplicates
      const existingProductLabels = new Set(scannedResult.recommendations.map(r => r.product_label.toLowerCase()));
      const newRecommendations = result.recommendations.filter(
        (r: ProductRecommendation) => !existingProductLabels.has(r.product_label.toLowerCase())
      );
      
      // Update scanned material with merged recommendations
      const updatedResult: ScannedMaterial = {
        ...scannedResult,
        recommendations: [...scannedResult.recommendations, ...newRecommendations],
      };
      
      onSingleScanComplete(updatedResult);
      setExpandedProduct(null);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Failed to find more materials');
    } finally {
      setIsFindingMore(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-revit-darker">
      {/* Header - Simplified with refresh and settings */}
      <div className="px-4 py-2.5 bg-revit-panel border-b border-revit-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-revit-success">Materialdex</span>
          {project.name && project.name !== 'New Construction Project' && (
            <span className="text-xs text-revit-text/60">
              • {project.name}
              {project.zip && ` • ${project.zip}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 hover:bg-revit-dark rounded text-revit-text/70 hover:text-revit-text transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {onSettingsChange && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 hover:bg-revit-dark rounded text-revit-text/70 hover:text-revit-text transition-colors"
              title="About"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* View Toggle - Revit 2026 style tabs */}
      <div className="flex border-b border-revit-border bg-revit-dark">
        <button
          onClick={() => setView('scan')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            view === 'scan'
              ? 'bg-revit-panel text-revit-text border-b-2 border-revit-success'
              : 'text-revit-text/60 hover:text-revit-text hover:bg-revit-panel/50'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Scan
        </button>
        <button
          onClick={() => setView('library')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            view === 'library'
              ? 'bg-revit-panel text-revit-text border-b-2 border-revit-success'
              : 'text-revit-text/60 hover:text-revit-text hover:bg-revit-panel/50'
          }`}
        >
          <Library className="w-3.5 h-3.5" />
          Library
          {savedProducts.length > 0 && (
            <span className="bg-revit-success text-revit-darker text-[10px] px-1.5 py-0.5 rounded font-semibold">
              {savedProducts.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'scan' ? (
          <div className="p-3 space-y-3">
            {/* Material Selector - Revit 2026 style */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-revit-text uppercase tracking-wide font-medium">
                  Select Material
                </label>
                {isRevitPlugin && onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isLoadingMaterials}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-revit-text/80 hover:text-revit-text border border-transparent hover:border-revit-border/50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Refresh materials from Revit (only needed if you edited materials in Revit)"
                  >
                    {isLoadingMaterials ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <select
                value={selectedMaterialId || ''}
                onChange={(e) => {
                  setSelectedMaterialId(e.target.value);
                  setExpandedProduct(null);
                }}
                disabled={isRevitPlugin && isLoadingMaterials}
                className={`w-full bg-revit-dark border border-revit-border rounded px-3 py-2 text-sm focus:border-revit-primary focus:outline-none focus:ring-1 focus:ring-revit-primary/20 ${
                  isRevitPlugin && isLoadingMaterials
                    ? 'text-revit-text/50 cursor-not-allowed opacity-50'
                    : 'text-revit-text'
                }`}
              >
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.qty} {m.unit})
                  </option>
                ))}
              </select>
            </div>


            {/* Scan Button - Revit 2026 style with accent color */}
            <div className="space-y-2">
              <button
                onClick={handleScan}
                disabled={isScanning || !selectedMaterial}
                className="w-full py-2.5 bg-revit-success hover:bg-[#3db89f] disabled:bg-revit-border disabled:text-revit-text/40 text-revit-darker font-semibold rounded text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning...
                  </>
                ) : scannedResult ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Re-scan
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Find Products
                  </>
                )}
              </button>
              
              {/* Progress indicator */}
              {scanProgress.length > 0 && (
                <div className="px-3 py-2 bg-revit-primary/10 border border-revit-primary/30 rounded text-xs text-revit-text/80">
                  <div className="flex items-start gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-revit-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      {scanProgress.map((msg, idx) => (
                        <div key={idx} className="text-revit-text/80">
                          {msg}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Find More Materials Button */}
              {scannedResult && scannedResult.recommendations.length > 0 && (
                <button
                  onClick={handleFindMoreMaterials}
                  disabled={isFindingMore || !selectedMaterial}
                  className="w-full py-2 bg-revit-primary/20 hover:bg-revit-primary/30 disabled:bg-revit-border disabled:text-revit-text/40 text-revit-primary font-medium rounded text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {isFindingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finding more...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Find 3 More Materials
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Error - Revit 2026 style */}
            {scanError && (
              <div className="p-2.5 bg-revit-error/10 border border-revit-error/30 rounded text-xs text-revit-error">
                {scanError}
              </div>
            )}

            {/* Results */}
            {scannedResult && (
              <div className="space-y-2">
                <div className="text-[11px] text-revit-text/70 uppercase tracking-wide font-medium">
                  {scannedResult.recommendations.length} Products Found
                </div>

                {scannedResult.recommendations.map((product, idx) => {
                  const extProduct = product as ExtendedProduct;
                  const isExpanded = expandedProduct === product.product_label;
                  const docSearch = extProduct.doc_search;
                  
                  return (
                    <div
                      key={idx}
                      className={`border rounded transition-colors ${
                        product.saved 
                          ? 'border-revit-success/50 bg-revit-success/5' 
                          : 'border-revit-border bg-revit-panel'
                      }`}
                    >
                      {/* Product Header - Clickable */}
                      <button
                        onClick={() => setExpandedProduct(isExpanded ? null : product.product_label)}
                        className="w-full p-3 text-left"
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-revit-text/60" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-revit-text/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-revit-text truncate">
                              {product.product_label}
                            </div>
                            <div className="text-xs text-revit-text/60 truncate">
                              {product.manufacturer || 'Unknown manufacturer'}
                            </div>
                            <div className="mt-1.5">
                              {renderDocBadges(extProduct)}
                            </div>
                          </div>
                          {product.saved && (
                            <BookmarkCheck className="w-4 h-4 text-revit-success flex-shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3 border-t border-revit-border">
                          {/* Rationale */}
                          <p className="text-xs text-revit-text/70 pt-3">
                            {product.rationale}
                          </p>

                          {/* Product Link */}
                          {product.product_url && (
                            <a
                              href={product.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-2 py-1.5 bg-revit-success/10 border border-revit-success/30 rounded text-xs text-revit-success hover:bg-revit-success/20 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Product Page
                            </a>
                          )}

                          {/* All Documentation Links by Type */}
                          <div className="space-y-2 border-t border-revit-border pt-2">
                            <div className="text-[11px] text-revit-text/70 uppercase tracking-wide font-medium">
                              Documentation Links
                            </div>
                            
                            {/* Disclaimer */}
                            <div className="text-[10px] text-revit-text/60 mb-2">
                              Note: Verify regional relevance, expiration dates, and product types.
                            </div>
                            
                            {renderDocLinks(docSearch, 'epd')}
                            {renderDocLinks(docSearch, 'hpd')}
                            {renderDocLinks(docSearch, 'declare')}
                            {renderDocLinks(docSearch, 'voc')}
                          </div>

                          {/* Bookmark Button */}
                          <button
                            onClick={() => handleToggleBookmark(product, scannedResult.id)}
                            className={`w-full py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                              product.saved
                                ? 'bg-revit-success/20 text-revit-success hover:bg-revit-success/30'
                                : 'bg-revit-border text-revit-text hover:bg-revit-border/80'
                            }`}
                          >
                            {product.saved ? (
                              <>
                                <BookmarkCheck className="w-4 h-4" />
                                Saved to Library
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-4 h-4" />
                                Save to Library
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!scannedResult && !isScanning && selectedMaterial && (
              <div className="text-center py-8 text-revit-text/50 text-sm">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Select a material and click</p>
                <p className="text-revit-text/50">Find Products</p>
              </div>
            )}
          </div>
        ) : (
          /* Library View */
          <div className="p-3 space-y-3">
            {savedProducts.length === 0 ? (
              <div className="text-center py-8 text-revit-text/50 text-sm">
                <Library className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No saved products yet</p>
                <p className="text-xs mt-1">Bookmark products to add them here</p>
              </div>
            ) : (
              <>
                <div className="text-[11px] text-revit-text/70 uppercase tracking-wide font-medium">
                  {savedProducts.length} Saved Product{savedProducts.length !== 1 ? 's' : ''}
                </div>

                {savedProducts.map((product, idx) => {
                  const extProduct = product as ExtendedProduct & { materialId: string; materialName: string };
                  const isExpanded = expandedLibraryProduct === `${extProduct.materialId}-${product.product_label}`;
                  const docSearch = extProduct.doc_search;
                  
                  return (
                    <div
                      key={idx}
                      className="border border-revit-success/50 bg-revit-success/5 rounded transition-colors"
                    >
                      {/* Product Header - Clickable */}
                      <button
                        onClick={() => setExpandedLibraryProduct(isExpanded ? null : `${extProduct.materialId}-${product.product_label}`)}
                        className="w-full p-3 text-left"
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-revit-text/60" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-revit-text/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-revit-text truncate">
                              {product.product_label}
                            </div>
                            <div className="text-xs text-revit-text/60 truncate">
                              {product.manufacturer || 'Unknown manufacturer'}
                            </div>
                            <div className="text-[10px] text-revit-text/50 mt-1">
                              For: {extProduct.materialName}
                            </div>
                            <div className="mt-1.5">
                              {renderDocBadges(extProduct)}
                            </div>
                          </div>
                          <BookmarkCheck className="w-4 h-4 text-revit-success flex-shrink-0" />
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3 border-t border-revit-border">
                          {/* Rationale */}
                          <p className="text-xs text-revit-text/70 pt-3">
                            {product.rationale}
                          </p>

                          {/* Product Link */}
                          {product.product_url && (
                            <a
                              href={product.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-2 py-1.5 bg-revit-success/10 border border-revit-success/30 rounded text-xs text-revit-success hover:bg-revit-success/20 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Product Page
                            </a>
                          )}

                          {/* All Documentation Links by Type */}
                          <div className="space-y-2 border-t border-revit-border pt-2">
                            <div className="text-[11px] text-revit-text/70 uppercase tracking-wide font-medium">
                              Documentation Links
                            </div>
                            
                            {/* Disclaimer */}
                            <div className="text-[10px] text-revit-text/60 mb-2">
                              Note: Verify regional relevance, expiration dates, and product types.
                            </div>
                            
                            {renderDocLinks(docSearch, 'epd')}
                            {renderDocLinks(docSearch, 'hpd')}
                            {renderDocLinks(docSearch, 'declare')}
                            {renderDocLinks(docSearch, 'voc')}
                          </div>

                          {/* Remove from Library Button */}
                          <button
                            onClick={() => handleToggleBookmark(product, extProduct.materialId)}
                            className="w-full py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors bg-revit-error/20 text-revit-error hover:bg-revit-error/30"
                          >
                            <X className="w-4 h-4" />
                            Remove from Library
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Info Dialog */}
      {showSettings && onSettingsChange && (
        <InfoDialog
          settings={settings}
          onSettingsChange={onSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// Info Dialog Component
interface InfoDialogProps {
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onClose: () => void;
}

function InfoDialog({ settings, onSettingsChange, onClose }: InfoDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-revit-panel border border-revit-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-revit-border flex items-center justify-between">
          <h2 className="text-xl font-semibold text-revit-text">About</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-revit-dark rounded text-revit-text/70 hover:text-revit-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Description */}
          <div className="space-y-3">
            <p className="text-sm text-revit-text leading-relaxed">
              This plugin helps you find sustainable building material alternatives with verified environmental documentation. 
              Scan your materials to discover products with EPD, HPD, Declare, and VOC certifications, complete with direct links 
              to manufacturer websites and documentation.
            </p>
            <p className="text-sm text-revit-text/80 leading-relaxed">
              Simply select a material and click <span className="text-revit-success font-medium">Find Products</span> to get started.
            </p>
          </div>

          {/* Privacy & Feedback */}
          <div className="pt-4 border-t border-revit-border text-sm text-revit-text/60">
            <a
              href="https://benfeicht.com/materialdex/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-revit-text/60 hover:text-revit-text hover:underline"
            >
              Privacy Policy
            </a>
            {' · '}
            <a
              href="mailto:ben.materaildex@gmail.com"
              className="text-revit-text/60 hover:text-revit-text hover:underline"
            >
              Feedback
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
