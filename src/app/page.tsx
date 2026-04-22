'use client';

import { useEffect } from 'react';
import { useAppState } from '@/hooks/useLocalStorage';
import { useRevitTheme } from '@/hooks/useRevitTheme';
import { useRevitMaterials } from '@/hooks/useRevitMaterials';
import { useRevitProject } from '@/hooks/useRevitProject';
import MinimalLayout from '@/components/MinimalLayout';
import { Loader2 } from 'lucide-react';

export default function Home() {
  // Get theme from Revit
  useRevitTheme();
  
  // Get materials from Revit
  const revitMaterials = useRevitMaterials();
  
  // Get project info from Revit
  const revitProject = useRevitProject();
  
  const {
    state,
    isLoaded,
    setMaterial,
    setMaterials,
    updateSingleScannedMaterial,
    saveProduct,
    rejectProduct,
    updateProductDoc,
    setSettings,
    setProject,
  } = useAppState();

  // Sync Revit materials with app state when they change (only when running in Revit plugin)
  const isRevitPlugin = typeof window !== 'undefined' && window.revitBridge?.isRevitPlugin;
  
  useEffect(() => {
    if (isRevitPlugin && revitMaterials.materials.length > 0 && isLoaded) {
      // Update app state with Revit materials (already sorted by quantity descending)
      // Sort again to ensure order is maintained
      const sortedMaterials = [...revitMaterials.materials].sort((a, b) => {
        // Primary sort: quantity descending (most used first)
        if (b.qty !== a.qty) {
          return b.qty - a.qty;
        }
        // Secondary sort: alphabetical when quantities are equal
        return a.name.localeCompare(b.name);
      });
      // When setting materials from Revit, only preserve scannedMaterials that match
      // the new materials. This ensures project-specific scannedMaterials are maintained.
      setMaterials(sortedMaterials);
    }
  }, [revitMaterials.materials, isLoaded, setMaterials, isRevitPlugin]);

  // Sync Revit project info with app state
  useEffect(() => {
    if (isRevitPlugin && revitProject && isLoaded) {
      // Extract ZIP code from address if available, or use the zip field
      let zip = revitProject.zip;
      if (!zip && revitProject.address) {
        // Try to extract ZIP from address (look for 5-digit pattern)
        const zipMatch = revitProject.address.match(/\b\d{5}(-\d{4})?\b/);
        if (zipMatch) {
          zip = zipMatch[0];
        }
      }
      
      // Check if project ID changed (project switch)
      const projectIdChanged = revitProject.projectId && revitProject.projectId !== state.project.projectId;
      
      setProject({
        name: revitProject.name || state.project.name,
        zip: zip || state.project.zip,
        goals: projectIdChanged ? state.project.goals : state.project.goals, // Keep existing goals unless project changed
        projectId: revitProject.projectId || state.project.projectId, // Include projectId
      });
    }
  }, [revitProject, isLoaded, setProject, isRevitPlugin, state.project]);

  // Show loading state while hydrating
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-revit-darker">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-revit-primary animate-spin" />
          <span className="text-revit-text">Loading Materialdex...</span>
        </div>
      </div>
    );
  }

  // Use Revit materials if available and running in Revit plugin, otherwise use state materials
  // Ensure materials are sorted by quantity descending, then alphabetically
  const displayMaterials = (isRevitPlugin && revitMaterials.materials.length > 0
    ? revitMaterials.materials
    : state.materials
  ).sort((a, b) => {
    // Primary sort: quantity descending (most used first)
    if (b.qty !== a.qty) {
      return b.qty - a.qty;
    }
    // Secondary sort: alphabetical when quantities are equal
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen h-screen">
      <MinimalLayout
        materials={displayMaterials}
        scannedMaterials={state.scannedMaterials}
        project={state.project}
        settings={state.settings}
        onMaterialChange={setMaterial}
        onSingleScanComplete={updateSingleScannedMaterial}
        onSaveProduct={saveProduct}
        onRejectProduct={rejectProduct}
        onAddLink={(materialId, productLabel, docType, url) => {
          updateProductDoc(materialId, productLabel, docType, url);
        }}
        onLoadMoreMaterials={undefined}
        hasMoreMaterials={false}
        isLoadingMaterials={revitMaterials.isLoading}
        onSettingsChange={setSettings}
        onProjectChange={setProject}
        onRefresh={() => {
          if (isRevitPlugin && revitMaterials.refresh) {
            revitMaterials.refresh();
          }
        }}
      />
    </div>
  );
}
