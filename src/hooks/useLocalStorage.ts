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
  // Track the project ID that was used when scannedMaterials were last set
  // This ensures we don't preserve scannedMaterials from a different project
  const [scannedMaterialsProjectId, setScannedMaterialsProjectId] = useState<string | undefined>(undefined);

  // Load state from localStorage on mount
  useEffect(() => {
    const projectId = getCurrentProjectId();
    const loaded = loadState(projectId);
    setState(loaded);
    setCurrentProjectId(projectId);
    setScannedMaterialsProjectId(projectId); // Track initial project ID for scannedMaterials
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
      // Reset the tracked project ID for scannedMaterials
      setScannedMaterialsProjectId(newProjectId);
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
      const currentProjectId = prev.project?.projectId;
      const existingMaterialIds = new Set(materials.map(m => m.id));
      
      // When materials are set from Revit, only preserve scannedMaterials that match the new materials.
      // CRITICAL: Only preserve scannedMaterials if they belong to the CURRENT project.
      let preservedScannedMaterials: typeof prev.scannedMaterials;
      
      // Check if scannedMaterials belong to the current project
      if (currentProjectId && currentProjectId === scannedMaterialsProjectId) {
        // scannedMaterials are from the current project - filter to match new materials
        preservedScannedMaterials = prev.scannedMaterials.filter(
          sm => existingMaterialIds.has(sm.id)
        );
      } else if (currentProjectId) {
        // Project changed - reload project-specific scannedMaterials from storage
        // to ensure we have the correct ones for this project
        const loadedState = loadState(currentProjectId);
        // Filter loaded scannedMaterials to match new materials
        preservedScannedMaterials = loadedState.scannedMaterials.filter(
          sm => existingMaterialIds.has(sm.id)
        );
        // Update the tracked project ID
        setScannedMaterialsProjectId(currentProjectId);
        console.log(`Project changed when setting materials: ${scannedMaterialsProjectId} -> ${currentProjectId}, reloaded ${loadedState.scannedMaterials.length} scannedMaterials, filtered to ${preservedScannedMaterials.length}`);
      } else {
        // No project ID - filter normally
        preservedScannedMaterials = prev.scannedMaterials.filter(
          sm => existingMaterialIds.has(sm.id)
        );
      }
      
      return {
        ...prev,
        materials,
        scannedMaterials: preservedScannedMaterials,
      };
    });
  }, [scannedMaterialsProjectId]);

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

