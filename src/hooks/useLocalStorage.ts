'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppState, InputMaterial, ScannedMaterial, ProjectInfo, AppSettings, ProductRecommendation, DocType } from '@/types';
import {
  loadState,
  saveState,
  getDefaultState,
  updateProject,
  updateMaterial,
  addMaterial,
  removeMaterial,
  updateScannedMaterials,
  upsertScannedMaterial,
  updateProductRecommendation,
  updateSettings,
  clearState,
  generateId,
  getCurrentProjectId,
} from '@/lib/storage';

export function useAppState() {
  const [state, setState] = useState<AppState>(getDefaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(
    typeof window !== 'undefined' ? getCurrentProjectId() : undefined
  );

  // Load state from localStorage on mount
  useEffect(() => {
    const projectId = getCurrentProjectId();
    const loaded = loadState(projectId);
    setState(loaded);
    setCurrentProjectId(projectId);
    setIsLoaded(true);
  }, []);

  // Detect project changes and switch storage
  useEffect(() => {
    if (!isLoaded) return;
    
    const newProjectId = state.project?.projectId;
    
    // If project ID changed, load the new project's data
    if (newProjectId && newProjectId !== currentProjectId) {
      console.log(`Project changed from ${currentProjectId} to ${newProjectId}, loading project-specific data`);
      const loaded = loadState(newProjectId);
      // Preserve settings from current state (settings are global, not project-specific)
      // Use loaded scannedMaterials (project-specific) - don't preserve old project's scannedMaterials
      setState(prevState => ({
        ...loaded,
        settings: prevState.settings, // Keep current settings
        // scannedMaterials should come from loaded state (project-specific)
        // materials will be updated when Revit sends new materials
      }));
      setCurrentProjectId(newProjectId);
    }
  }, [state.project?.projectId, currentProjectId, isLoaded]);

  // Save state whenever it changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      saveState(state);
    }
  }, [state, isLoaded]);

  // Project actions
  const setProject = useCallback((project: Partial<ProjectInfo>) => {
    setState(prev => updateProject(prev, project));
  }, []);

  // Material actions
  const setMaterial = useCallback((materialId: string, updates: Partial<InputMaterial>) => {
    setState(prev => updateMaterial(prev, materialId, updates));
  }, []);

  const addNewMaterial = useCallback((material: Omit<InputMaterial, 'id'>) => {
    setState(prev => addMaterial(prev, material));
  }, []);

  const deleteMaterial = useCallback((materialId: string) => {
    setState(prev => removeMaterial(prev, materialId));
  }, []);

  const setMaterials = useCallback((materials: InputMaterial[]) => {
    setState(prev => {
      // Check if this is a completely new set of materials (likely a project change)
      // by comparing material IDs with current materials
      const currentMaterialIds = new Set(prev.materials.map(m => m.id));
      
      // Check for overlap - if no materials match and we had materials before, this might be a new project
      const hasOverlap = prev.materials.length > 0 && materials.length > 0 && 
                         materials.some(m => currentMaterialIds.has(m.id));
      
      // When materials are set from Revit:
      // - If there's overlap with previous materials, preserve scannedMaterials for matching materials
      // - If no overlap AND we had materials before, this indicates a project change.
      //   In this case, only preserve scannedMaterials that match the new materials.
      //   The scannedMaterials in prev.state should already be project-specific from the loaded state,
      //   so we just filter to match the new materials.
      const existingMaterialIds = new Set(materials.map(m => m.id));
      
      // Always filter scannedMaterials to only include ones for materials that exist in the new list
      // This ensures scannedMaterials remain project-specific
      const preservedScannedMaterials = prev.scannedMaterials.filter(
        sm => existingMaterialIds.has(sm.id)
      );
      
      return {
        ...prev,
        materials,
        scannedMaterials: preservedScannedMaterials,
      };
    });
  }, []);

  // Scanned materials actions
  const setScannedMaterials = useCallback((scannedMaterials: ScannedMaterial[]) => {
    setState(prev => updateScannedMaterials(prev, scannedMaterials));
  }, []);

  const updateSingleScannedMaterial = useCallback((scannedMaterial: ScannedMaterial) => {
    setState(prev => upsertScannedMaterial(prev, scannedMaterial));
  }, []);

  // Product actions
  const saveProduct = useCallback((materialId: string, productLabel: string) => {
    setState(prev => updateProductRecommendation(prev, materialId, productLabel, { saved: true, rejected: false }));
  }, []);

  const rejectProduct = useCallback((materialId: string, productLabel: string) => {
    setState(prev => updateProductRecommendation(prev, materialId, productLabel, { rejected: true, saved: false }));
  }, []);

  const updateProductDoc = useCallback((
    materialId: string,
    productLabel: string,
    docType: DocType,
    url: string
  ) => {
    setState(prev => {
      const material = prev.scannedMaterials.find(m => m.id === materialId);
      if (!material) return prev;
      
      const product = material.recommendations.find(r => r.product_label === productLabel);
      if (!product) return prev;

      const newDocChecklist = {
        ...product.doc_checklist,
        [docType]: {
          status: 'user-provided' as const,
          doc_url: url,
        },
      };

      return updateProductRecommendation(prev, materialId, productLabel, {
        doc_checklist: newDocChecklist,
      });
    });
  }, []);

  // Settings actions
  const setSettings = useCallback((settings: Partial<AppSettings>) => {
    setState(prev => updateSettings(prev, settings));
  }, []);

  // Scanning state
  const setScanning = useCallback((isScanning: boolean) => {
    setState(prev => ({ ...prev, isScanning }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    const newState = clearState(state.project?.projectId);
    setState(newState);
  }, [state.project?.projectId]);

  return {
    state,
    isLoaded,
    // Project
    setProject,
    // Materials
    setMaterial,
    addNewMaterial,
    deleteMaterial,
    setMaterials,
    // Scanned
    setScannedMaterials,
    updateSingleScannedMaterial,
    // Products
    saveProduct,
    rejectProduct,
    updateProductDoc,
    // Settings
    setSettings,
    // Scanning
    setScanning,
    // Utils
    reset,
    generateId,
  };
}

