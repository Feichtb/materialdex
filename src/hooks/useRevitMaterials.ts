'use client';

import { useEffect, useState, useCallback } from 'react';
import { InputMaterial } from '@/types';
import { generateId } from '@/lib/storage';

interface RevitMaterial {
  Id: string;
  Name: string;
  Quantity: number;
  Unit: string;
  Category: string;
  ElementTypes: string;
}

interface RevitMaterialsResponse {
  materials: RevitMaterial[];
  total: number;
  skip: number;
  hasMore: boolean;
}

export function useRevitMaterials() {
  const [materials, setMaterials] = useState<InputMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert Revit material to InputMaterial
  const convertRevitMaterial = useCallback((rm: RevitMaterial): InputMaterial => {
    // Map Revit units to our unit types
    let unit: 'sf' | 'cf' | 'lf' | 'ea' | 'unknown' = 'unknown';
    const unitLower = rm.Unit?.toLowerCase() || '';
    if (unitLower.includes('sf') || unitLower.includes('sq') || unitLower.includes('square')) {
      unit = 'sf';
    } else if (unitLower.includes('cf') || unitLower.includes('cubic')) {
      unit = 'cf';
    } else if (unitLower.includes('lf') || unitLower.includes('linear')) {
      unit = 'lf';
    } else if (unitLower.includes('ea') || unitLower.includes('each')) {
      unit = 'ea';
    }

    // Round quantity to 2 decimal places
    const roundedQty = Math.round((rm.Quantity || 0) * 100) / 100;

    // Use Revit material ID as stable identifier to preserve scannedMaterials when refreshing
    // Prefix with 'revit-' to distinguish from manually added materials
    const stableId = rm.Id ? `revit-${rm.Id}` : generateId();

    return {
      id: stableId,
      name: rm.Name || 'Unnamed Material',
      qty: roundedQty,
      unit: unit,
    };
  }, []);

  // Request materials from Revit (all materials, no pagination)
  const requestMaterials = useCallback(() => {
    if (typeof window === 'undefined' || !window.revitBridge?.isRevitPlugin) {
      // Not in Revit, don't try to load
      return;
    }

    setIsLoading(true);
    setError(null);

    // Safety timeout - if Revit doesn't respond within 5 seconds, reset loading state
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    try {
      // Request all materials via Revit bridge (skip and take are ignored, all materials sent)
      if (window.revitBridge.requestMaterials) {
        window.revitBridge.requestMaterials(0, 0); // Parameters ignored, all materials sent
      } else {
        setError('Revit bridge does not support material requests');
        setIsLoading(false);
        clearTimeout(timeout);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request materials');
      setIsLoading(false);
      clearTimeout(timeout);
    }

    // Return cleanup function (though callback doesn't use it directly)
    return () => clearTimeout(timeout);
  }, []);

  // Handle materials received from Revit
  useEffect(() => {
    const handleMaterials = (response: RevitMaterialsResponse | RevitMaterial[]) => {
      setIsLoading(false);

      // Handle both old format (array) and new format (object with pagination)
      let materialsArray: RevitMaterial[];
      let responseData: RevitMaterialsResponse;

      if (Array.isArray(response)) {
        // Old format - just an array
        materialsArray = response;
        responseData = {
          materials: materialsArray,
          total: materialsArray.length,
          skip: 0,
          hasMore: false,
        };
      } else {
        // New format - paginated response
        responseData = response;
        materialsArray = response.materials;
      }

      const convertedMaterials = materialsArray.map(convertRevitMaterial);

      // Always replace all materials (no pagination)
      setMaterials(convertedMaterials);

      setTotalCount(responseData.total);
      setHasMore(false); // No pagination, all materials shown
      setError(null);
    };

    // Set up handler
    if (typeof window !== 'undefined') {
      window.onRevitMaterials = handleMaterials;

      // Check for queued materials
      if (window.revitMaterialsQueue && window.revitMaterialsQueue.length > 0) {
        const queued = window.revitMaterialsQueue.shift();
        if (queued) {
          handleMaterials(queued);
        }
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.onRevitMaterials = undefined;
      }
    };
  }, [convertRevitMaterial]);

  // Request initial materials on mount if Revit bridge is available
  useEffect(() => {
    if (typeof window !== 'undefined' && window.revitBridge?.isRevitPlugin) {
      // Small delay to ensure bridge is fully initialized
      const timer = setTimeout(() => {
        requestMaterials();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [requestMaterials]);

  return {
    materials,
    isLoading,
    hasMore: false, // No pagination
    totalCount,
    error,
    loadMore: () => {}, // No-op since we show all materials
    refresh: requestMaterials,
  };
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    revitBridge?: {
      isRevitPlugin: boolean;
      sendToRevit: (data: any) => void;
      receiveMaterials: (materials: any) => void;
      receiveTheme: (theme: any) => void;
      requestTheme: () => void;
      requestMaterials?: (skip: number, take: number) => void;
      extractMaterials?: () => void;
    };
    onRevitMaterials?: (materials: any) => void;
    revitMaterialsQueue?: any[];
  }
}

