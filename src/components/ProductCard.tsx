'use client';

import { useState } from 'react';
import { ProductRecommendation, DocType, DocStatus } from '@/types';
import {
  Building2,
  MapPin,
  FileCheck,
  FileQuestion,
  Link,
  Save,
  X,
  ExternalLink,
  Plus,
  Globe,
  ShoppingBag,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Newspaper,
  FolderOpen,
  Leaf,
  Package,
  AlertTriangle,
  Factory,
} from 'lucide-react';
import type { IndustryWideDoc } from '@/data/industryWideEpds';

// Confidence level type
type LinkConfidence = 
  | 'direct_document'
  | 'catalog_page'
  | 'product_line_doc'
  | 'sustainability_page'
  | 'news_article'
  | 'general_page'
  | 'wrong_manufacturer';

// Categorized link from doc search
interface CategorizedLink {
  url: string;
  title: string;
  snippet: string;
  category: 'epd' | 'hpd' | 'declare' | 'voc' | 'product_page' | 'manufacturer' | 'wrong_manufacturer' | 'unknown';
  confidence: number;
  confidenceLevel: LinkConfidence;
  reason: string;
  needsVerification?: boolean;
}

interface DocSearchResult {
  product: string;
  manufacturer: string | null;
  searchQuery: string;
  rawResults: Array<{ url: string; title: string; snippet: string }>;
  categorizedLinks: CategorizedLink[];
  byType: {
    epd: CategorizedLink[];
    hpd: CategorizedLink[];
    declare: CategorizedLink[];
    voc: CategorizedLink[];
    product_page: CategorizedLink[];
    other: CategorizedLink[];
  };
  industryWideEpds?: IndustryWideDoc[];
}

interface ExtendedProductRecommendation extends ProductRecommendation {
  doc_search?: DocSearchResult;
  has_known_epd?: boolean;
  has_known_hpd?: boolean;
  has_known_declare?: boolean;
}

interface ProductCardProps {
  product: ExtendedProductRecommendation;
  onSave: () => void;
  onReject: () => void;
  onAddLink: (docType: DocType, url: string) => void;
}

// Confidence level display config
const CONFIDENCE_DISPLAY: Record<LinkConfidence, { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: React.ReactNode;
  description: string;
}> = {
  direct_document: { 
    label: 'Direct Doc', 
    color: 'text-green-400', 
    bgColor: 'bg-green-400/20',
    icon: <FileText className="w-3 h-3" />,
    description: 'Actual EPD/HPD document or registry page',
  },
  catalog_page: { 
    label: 'Doc Catalog', 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-400/20',
    icon: <FolderOpen className="w-3 h-3" />,
    description: 'Documentation catalog or library page',
  },
  product_line_doc: { 
    label: 'Product Line', 
    color: 'text-lime-400', 
    bgColor: 'bg-lime-400/20',
    icon: <Package className="w-3 h-3" />,
    description: 'Same manufacturer - verify exact product variant',
  },
  sustainability_page: { 
    label: 'Sustainability', 
    color: 'text-yellow-400', 
    bgColor: 'bg-yellow-400/20',
    icon: <Leaf className="w-3 h-3" />,
    description: 'Sustainability page - may contain doc links',
  },
  news_article: { 
    label: 'News', 
    color: 'text-orange-400', 
    bgColor: 'bg-orange-400/20',
    icon: <Newspaper className="w-3 h-3" />,
    description: 'News article (not the actual document)',
  },
  general_page: { 
    label: 'General', 
    color: 'text-gray-400', 
    bgColor: 'bg-gray-400/20',
    icon: <Globe className="w-3 h-3" />,
    description: 'General page - low confidence',
  },
  wrong_manufacturer: { 
    label: 'Wrong Mfg', 
    color: 'text-red-400', 
    bgColor: 'bg-red-400/20',
    icon: <AlertCircle className="w-3 h-3" />,
    description: 'Different manufacturer entirely',
  },
};

// Category display config - renamed as "Reference Links" for research
const CATEGORY_CONFIG: Record<string, { label: string; fullLabel: string; color: string; icon: string; description: string }> = {
  epd: { label: 'EPD', fullLabel: 'EPD Reference Links', color: 'text-green-400', icon: '📋', description: 'Environmental Product Declaration sources' },
  hpd: { label: 'HPD', fullLabel: 'HPD Reference Links', color: 'text-blue-400', icon: '🏥', description: 'Health Product Declaration sources' },
  declare: { label: 'Declare', fullLabel: 'Declare Label References', color: 'text-purple-400', icon: '🏷️', description: 'Living Building Challenge Declare sources' },
  voc: { label: 'VOC', fullLabel: 'VOC / Indoor Air Quality', color: 'text-cyan-400', icon: '🌿', description: 'VOC and GREENGUARD certification sources' },
  product_page: { label: 'Product', fullLabel: 'Product Information', color: 'text-yellow-400', icon: '📦', description: 'Manufacturer product pages' },
  manufacturer: { label: 'Mfg Site', fullLabel: 'Manufacturer Resources', color: 'text-gray-400', icon: '🏭', description: 'General manufacturer resources' },
  wrong_manufacturer: { label: 'Wrong Mfg', fullLabel: 'Unrelated Manufacturers', color: 'text-red-400', icon: '❌', description: 'Links to different manufacturers' },
  unknown: { label: '?', fullLabel: 'Other Links', color: 'text-gray-500', icon: '❓', description: 'Uncategorized links' },
};

// Database search URLs
const getDatabaseSearchUrl = (docType: DocType, productName: string, manufacturer: string | null) => {
  const query = encodeURIComponent(manufacturer ? `${manufacturer} ${productName}` : productName);
  
  switch (docType) {
    case 'epd':
      return `https://www.environdec.com/library?query=${query}`;
    case 'hpd':
      return `https://hpdrepository.hpd-collaborative.org/Pages/Results.aspx?k=${query}`;
    case 'declare':
      return `https://declare.living-future.org/products?search=${query}`;
    case 'voc':
      return `https://spot.ul.com/main-app/products/catalog/search?q=${query}+greenguard`;
    default:
      return null;
  }
};

export default function ProductCard({
  product,
  onSave,
  onReject,
  onAddLink,
}: ProductCardProps) {
  const [showLinkModal, setShowLinkModal] = useState<DocType | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const getStatusDisplay = (doc: DocStatus) => {
    if (doc.status === 'verified' && doc.doc_url) {
      return {
        icon: <FileCheck className="w-4 h-4 text-revit-success" />,
        badgeClass: 'bg-revit-success/20 text-revit-success',
        label: '✓ Found',
      };
    }
    if (doc.status === 'user-provided' && doc.doc_url) {
      return {
        icon: <FileCheck className="w-4 h-4 text-revit-accent" />,
        badgeClass: 'bg-revit-accent/20 text-revit-accent',
        label: 'Added',
      };
    }
    return {
      icon: <FileQuestion className="w-4 h-4 text-revit-text/30" />,
      badgeClass: 'bg-revit-dark text-revit-text/40',
      label: '—',
    };
  };

  const docTypes: { key: DocType; label: string }[] = [
    { key: 'epd', label: 'EPD' },
    { key: 'hpd', label: 'HPD' },
    { key: 'declare', label: 'Declare' },
    { key: 'voc', label: 'VOC' },
  ];

  const handleSubmitLink = () => {
    if (showLinkModal && linkUrl.trim()) {
      onAddLink(showLinkModal, linkUrl.trim());
      setShowLinkModal(null);
      setLinkUrl('');
    }
  };

  const handleUseLink = (docType: DocType, url: string) => {
    onAddLink(docType, url);
  };

  const confidenceLevel =
    product.confidence >= 0.7 ? 'high' : product.confidence >= 0.4 ? 'medium' : 'low';

  // Doc search results
  const docSearch = product.doc_search;
  const hasSearchResults = docSearch && docSearch.categorizedLinks.length > 0;

  // Count verified docs
  const verifiedCount = docTypes.filter(
    ({ key }) => product.doc_checklist[key].status === 'verified' && product.doc_checklist[key].doc_url
  ).length;

  return (
    <div
      className={`
        panel p-4 transition-all
        ${product.saved ? 'ring-2 ring-revit-success' : ''}
        ${product.rejected ? 'opacity-50' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-white">{product.product_label}</h4>
          {product.manufacturer && (
            <div className="flex items-center gap-1 text-sm text-revit-text/70 mt-1">
              <Building2 className="w-3 h-3" />
                  {product.manufacturer_url ? (
                    <a
                      href={product.manufacturer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-revit-accent hover:underline"
                    >
                      {product.manufacturer}
                    </a>
                  ) : (
                    product.manufacturer
                  )}
                </div>
              )}
            </div>

        {/* Confidence */}
        <div className="text-right">
          {verifiedCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-revit-success/20 text-revit-success rounded mb-1 inline-block">
              {verifiedCount} docs
            </span>
          )}
          <div className="confidence-bar w-16">
            <div
              className={`confidence-fill confidence-${confidenceLevel}`}
              style={{ width: `${product.confidence * 100}%` }}
            />
          </div>
          <div className="text-xs text-revit-text/50 mt-0.5">
            {(product.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Product Link */}
      {product.product_url && (
        <a
          href={product.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 mb-3 bg-revit-primary/20 hover:bg-revit-primary/30 border border-revit-primary/40 rounded text-revit-primary font-medium text-sm transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          View Product Page
          <ExternalLink className="w-3 h-3 ml-auto" />
        </a>
      )}

      {/* Rationale */}
      <p className="text-sm text-revit-text/80 mb-3">{product.rationale}</p>

      {/* Distance */}
      <div className="flex items-center gap-1 text-sm text-revit-text/60 mb-3">
        <MapPin className="w-3 h-3" />
        Distance:{' '}
        {product.distance_miles !== null
          ? `${product.distance_miles} miles`
          : 'Unknown'}
      </div>

      {/* Doc checklist */}
      <div className="border-t border-revit-border pt-3 mb-3">
        <div className="text-xs text-revit-text/60 mb-2 uppercase tracking-wide">
          Documentation
        </div>
        <div className="grid grid-cols-4 gap-1">
          {docTypes.map(({ key, label }) => {
            const doc = product.doc_checklist[key];
            const status = getStatusDisplay(doc);
            const searchUrl = getDatabaseSearchUrl(key, product.product_label, product.manufacturer);
            
            return (
              <div
                key={key}
                className="flex flex-col items-center p-2 bg-revit-dark/50 rounded text-center"
              >
                <span className="text-[10px] text-revit-text/50 mb-1">{label}</span>
                
                {doc.doc_url ? (
                  <a
                    href={doc.doc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-[10px] px-1.5 py-0.5 rounded ${status.badgeClass} hover:opacity-80`}
                  >
                    {status.label}
                  </a>
                ) : (
                  <div className="flex items-center gap-0.5">
                    {searchUrl && (
                      <a
                        href={searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-revit-border/50 rounded text-revit-text/30 hover:text-revit-accent"
                        title="Search database"
                      >
                        <Search className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => setShowLinkModal(key)}
                      className="p-1 hover:bg-revit-border/50 rounded text-revit-text/30 hover:text-revit-accent"
                      title="Add link"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Results (Categorized with Confidence Levels) */}
      {hasSearchResults && (
        <div className="border-t border-revit-border pt-3 mb-3">
          <button
            onClick={() => setShowSearchResults(!showSearchResults)}
            className="flex items-center gap-2 text-xs text-revit-text/60 hover:text-revit-text w-full"
          >
            {showSearchResults ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>Reference Links for Research ({docSearch?.categorizedLinks.length} links)</span>
          </button>
          
          {/* Research disclaimer */}
          {showSearchResults && (
            <div className="mt-2 mb-3 text-[10px] text-revit-text/60">
              Note: Verify regional relevance, expiration dates, and product types.
            </div>
          )}
          
          {showSearchResults && docSearch && (
            <div className="mt-2 space-y-3 max-h-80 overflow-y-auto">
              {/* Group by category */}
              {(['epd', 'hpd', 'declare', 'voc', 'product_page'] as const).map(cat => {
                const links = docSearch.byType[cat] || [];
                if (links.length === 0) return null;
                
                const catConfig = CATEGORY_CONFIG[cat];
                
                return (
                  <div key={cat} className="space-y-1">
                    <div className={`text-xs font-medium flex items-center gap-1 ${catConfig.color}`} title={catConfig.description}>
                      <span>{catConfig.icon}</span>
                      {catConfig.fullLabel} ({links.length})
                    </div>
                    {links.map((link, i) => {
                      const confDisplay = CONFIDENCE_DISPLAY[link.confidenceLevel] || CONFIDENCE_DISPLAY.general_page;
                      
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded text-xs border ${confDisplay.bgColor} border-current/20`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="text-revit-text/90 font-medium truncate">
                                {link.title || 'No title'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Confidence level badge */}
                              {/* Confidence level badge */}
                              <span 
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${confDisplay.bgColor} ${confDisplay.color}`}
                                title={confDisplay.description}
                              >
                                {confDisplay.icon}
                                {confDisplay.label}
                              </span>
                              {/* Verify badge for product line docs */}
                              {link.needsVerification && (
                                <span 
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400"
                                  title="Verify this is the correct product variant"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  Verify
                                </span>
                              )}
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-white/10 rounded text-revit-accent"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              {cat !== 'product_page' && (
                                <button
                                  onClick={() => handleUseLink(cat as DocType, link.url)}
                                  className="p-1 hover:bg-white/10 rounded text-revit-success"
                                  title="Use this link"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Reason/explanation */}
                          <div className="text-revit-text/50 text-[10px]">
                            {link.reason}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              
              {/* Wrong/skipped links */}
              {docSearch.categorizedLinks.filter(l => 
                l.category === 'wrong_manufacturer' || l.category === 'manufacturer' || l.category === 'unknown'
              ).length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-revit-text/40 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Skipped / Other
                  </div>
                  {docSearch.categorizedLinks
                    .filter(l => l.category === 'wrong_manufacturer' || l.category === 'manufacturer' || l.category === 'unknown')
                    .map((link, i) => {
                      const confDisplay = CONFIDENCE_DISPLAY[link.confidenceLevel] || CONFIDENCE_DISPLAY.general_page;
                      
                      return (
                        <div
                          key={i}
                          className="p-2 rounded text-xs bg-revit-dark/30 text-revit-text/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{link.title || 'No title'}</div>
                              <div className="truncate text-[10px] flex items-center gap-1 mt-0.5">
                                <span className={`${confDisplay.color}`}>{confDisplay.label}</span>
                                <span>•</span>
                                <span>{link.reason}</span>
                              </div>
                            </div>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-white/10 rounded flex-shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              
              {/* Industry-Wide EPDs Section */}
              {docSearch.industryWideEpds && docSearch.industryWideEpds.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-revit-border/50">
                  <div className="text-xs font-medium text-amber-400 flex items-center gap-1" title="Industry-wide certifications that apply to this product category">
                    <Factory className="w-3 h-3" />
                    Industry-Wide Standards ({docSearch.industryWideEpds.length})
                  </div>
                  <div className="text-[10px] text-revit-text/50 mb-1">
                    Baseline certifications for this product category (not manufacturer-specific)
                  </div>
                  {docSearch.industryWideEpds.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2 rounded text-xs bg-amber-500/10 border border-amber-500/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-revit-text/90 font-medium">
                            {doc.title}
                          </div>
                          <div className="text-[10px] text-amber-400/70 mt-0.5">
                            {doc.issuer}
                          </div>
                          {doc.notes && (
                            <div className="text-[10px] text-revit-text/50 mt-0.5">
                              {doc.notes}
                            </div>
                          )}
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-white/10 rounded text-amber-400 flex-shrink-0"
                          title="View industry-wide EPD"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Legend */}
              <div className="pt-2 border-t border-revit-border/50">
                <div className="text-[10px] text-revit-text/40 mb-1">Confidence Levels:</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(CONFIDENCE_DISPLAY).map(([key, config]) => (
                    <span 
                      key={key} 
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] ${config.bgColor} ${config.color}`}
                      title={config.description}
                    >
                      {config.icon}
                      {config.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-revit-border">
        <button
          onClick={onSave}
          disabled={product.rejected}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded font-medium transition-colors
            ${
              product.saved
                ? 'bg-revit-success text-white'
                : 'bg-revit-success/20 text-revit-success hover:bg-revit-success/30'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <Save className="w-4 h-4" />
          {product.saved ? 'Saved' : 'Save'}
        </button>
        <button
          onClick={onReject}
          disabled={product.saved}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded font-medium transition-colors
            ${
              product.rejected
                ? 'bg-revit-error text-white'
                : 'bg-revit-error/20 text-revit-error hover:bg-revit-error/30'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <X className="w-4 h-4" />
          {product.rejected ? 'Rejected' : 'Reject'}
        </button>
        <button
          onClick={() => setShowLinkModal('epd')}
          className="p-2 bg-revit-accent/20 text-revit-accent hover:bg-revit-accent/30 rounded"
          title="Add documentation link"
        >
          <Link className="w-4 h-4" />
        </button>
      </div>

      {/* Link modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="panel p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Add {showLinkModal.toUpperCase()} Documentation
            </h3>
            
            <div className="mb-4 p-3 bg-revit-dark/50 rounded">
              <p className="text-xs text-revit-text/60 mb-2 flex items-center gap-1">
                <Search className="w-3 h-3" />
                Search the official database:
              </p>
              <a
                href={getDatabaseSearchUrl(showLinkModal, product.product_label, product.manufacturer) || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-3 py-1.5 bg-revit-primary/20 text-revit-primary rounded hover:bg-revit-primary/30 inline-flex items-center gap-1"
              >
                {showLinkModal === 'epd' && 'Environdec Library'}
                {showLinkModal === 'hpd' && 'HPD Repository'}
                {showLinkModal === 'declare' && 'Declare Database'}
                {showLinkModal === 'voc' && 'UL SPOT'}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-sm text-revit-text/70 mb-4">
              Find the document, then paste the URL below.
            </p>
            
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://www.environdec.com/library/epd..."
              className="w-full mb-4"
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => {
                  setShowLinkModal(null);
                  setLinkUrl('');
                }}
                className="px-4 py-2 text-revit-text/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitLink}
                disabled={!linkUrl.trim()}
                className="px-4 py-2 bg-revit-primary text-white rounded disabled:opacity-50"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
