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
      // Clear materials temporarily - they'll be updated when Revit sends new materials
      // This ensures scannedMaterials are truly project-specific even if material IDs match
      setState(prevState => ({
        ...loaded,
        materials: [], // Clear materials - will be set when Revit sends them
        settings: prevState.settings, // Keep current settings
        // scannedMaterials come from loaded state (project-specific)
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
      // When materials are set from Revit, only preserve scannedMaterials that match the new materials.
      // The scannedMaterials in prev.state should already be project-specific from the loaded state
      // when the project changed. Filter to match the new materials to ensure they remain project-specific.
      const existingMaterialIds = new Set(materials.map(m => m.id));
      
      // If previous materials list was empty (project just changed), only use scannedMaterials
      // that match the new materials. This ensures we don't carry over scannedMaterials from
      // a previous project even if material IDs happen to match.
      // If previous materials existed, filter scannedMaterials to match new materials.
      const preservedScannedMaterials = prev.materials.length === 0
        ? prev.scannedMaterials.filter(sm => existingMaterialIds.has(sm.id))
        : prev.scannedMaterials.filter(sm => existingMaterialIds.has(sm.id));
      
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

