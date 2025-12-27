import { AppState, InputMaterial, ScannedMaterial, ProjectInfo, AppSettings, ProductRecommendation } from '@/types';
import { defaultMaterials, defaultProjectInfo, defaultSettings } from '@/data/defaultMaterials';

const STORAGE_KEY_PREFIX = 'materialdex_state';
const CURRENT_PROJECT_KEY = 'materialdex_current_project';

// Window interface is extended in @/types/index.ts

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Generate a storage key for a specific project
function getStorageKey(projectId?: string): string {
  if (!projectId) {
    // Fallback to default key for non-Revit usage
    return STORAGE_KEY_PREFIX;
  }
  // Create a safe key from projectId (replace invalid characters)
  const safeId = projectId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
  return `${STORAGE_KEY_PREFIX}_${safeId}`;
}

// Hash a string to create a shorter, safe identifier
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Get default app state
export function getDefaultState(): AppState {
  // If running in Revit plugin, start with empty materials (they'll be loaded from Revit)
  const isRevitPlugin = typeof window !== 'undefined' && window.revitBridge?.isRevitPlugin;
  
  return {
    project: { ...defaultProjectInfo },
    materials: isRevitPlugin ? [] : defaultMaterials.map(m => ({ ...m, id: generateId() })),
    scannedMaterials: [],
    settings: { ...defaultSettings },
    lastScanTime: null,
    isScanning: false,
  };
}

// Load state from localStorage for a specific project
export function loadState(projectId?: string): AppState {
  if (typeof window === 'undefined') {
    return getDefaultState();
  }
  
  try {
    const storageKey = getStorageKey(projectId);
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all fields exist
      return {
        ...getDefaultState(),
        ...parsed,
        project: {
          ...defaultProjectInfo,
          ...parsed.project,
          projectId: projectId || parsed.project?.projectId, // Preserve projectId
        },
        settings: {
          ...defaultSettings,
          ...parsed.settings,
          neverFabricateUrls: true, // Always enforce
        },
      };
    }
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
  }
  
  const defaultState = getDefaultState();
  // Set projectId if provided
  if (projectId) {
    defaultState.project.projectId = projectId;
  }
  return defaultState;
}

// Save state to localStorage for a specific project
export function saveState(state: AppState): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    // Don't save isScanning state
    const stateToSave = {
      ...state,
      isScanning: false,
    };
    
    const projectId = state.project?.projectId;
    const storageKey = getStorageKey(projectId);
    
    // Save the state for this project
    localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    
    // Also save the current project ID for reference
    if (projectId) {
      localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
    }
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

// Get the current project ID from localStorage
export function getCurrentProjectId(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  
  try {
    return localStorage.getItem(CURRENT_PROJECT_KEY) || undefined;
  } catch (error) {
    console.error('Failed to get current project ID:', error);
    return undefined;
  }
}

// Update project info
export function updateProject(state: AppState, project: Partial<ProjectInfo>): AppState {
  const newState = {
    ...state,
    project: { ...state.project, ...project },
  };
  saveState(newState);
  return newState;
}

// Update materials
export function updateMaterials(state: AppState, materials: InputMaterial[]): AppState {
  const newState = {
    ...state,
    materials,
  };
  saveState(newState);
  return newState;
}

// Update a single material
export function updateMaterial(state: AppState, materialId: string, updates: Partial<InputMaterial>): AppState {
  const newState = {
    ...state,
    materials: state.materials.map(m => 
      m.id === materialId ? { ...m, ...updates } : m
    ),
  };
  saveState(newState);
  return newState;
}

// Add a new material
export function addMaterial(state: AppState, material: Omit<InputMaterial, 'id'>): AppState {
  const newMaterial: InputMaterial = {
    ...material,
    id: generateId(),
  };
  const newState = {
    ...state,
    materials: [...state.materials, newMaterial],
  };
  saveState(newState);
  return newState;
}

// Remove a material
export function removeMaterial(state: AppState, materialId: string): AppState {
  const newState = {
    ...state,
    materials: state.materials.filter(m => m.id !== materialId),
    scannedMaterials: state.scannedMaterials.filter(m => m.id !== materialId),
  };
  saveState(newState);
  return newState;
}

// Update scanned materials
export function updateScannedMaterials(state: AppState, scannedMaterials: ScannedMaterial[]): AppState {
  const newState = {
    ...state,
    scannedMaterials,
    lastScanTime: new Date().toISOString(),
  };
  saveState(newState);
  return newState;
}

// Update or add a single scanned material
export function upsertScannedMaterial(state: AppState, scannedMaterial: ScannedMaterial): AppState {
  const existingIndex = state.scannedMaterials.findIndex(m => m.id === scannedMaterial.id);
  
  let newScannedMaterials: ScannedMaterial[];
  if (existingIndex >= 0) {
    // Update existing
    newScannedMaterials = [...state.scannedMaterials];
    newScannedMaterials[existingIndex] = scannedMaterial;
  } else {
    // Add new
    newScannedMaterials = [...state.scannedMaterials, scannedMaterial];
  }
  
  // Also mark the input material as mapped
  const newMaterials = state.materials.map(m =>
    m.id === scannedMaterial.id ? { ...m, mapped: true } : m
  );
  
  const newState = {
    ...state,
    scannedMaterials: newScannedMaterials,
    materials: newMaterials,
    lastScanTime: new Date().toISOString(),
  };
  saveState(newState);
  return newState;
}

// Update a product recommendation
export function updateProductRecommendation(
  state: AppState,
  materialId: string,
  productLabel: string,
  updates: Partial<ProductRecommendation>
): AppState {
  const newState = {
    ...state,
    scannedMaterials: state.scannedMaterials.map(m => {
      if (m.id !== materialId) return m;
      return {
        ...m,
        recommendations: m.recommendations.map(r => 
          r.product_label === productLabel ? { ...r, ...updates } : r
        ),
      };
    }),
  };
  saveState(newState);
  return newState;
}

// Update settings
export function updateSettings(state: AppState, settings: Partial<AppSettings>): AppState {
  const newState = {
    ...state,
    settings: { 
      ...state.settings, 
      ...settings,
      neverFabricateUrls: true, // Always enforce
    },
  };
  saveState(newState);
  return newState;
}

// Clear all data for the current project
export function clearState(projectId?: string): AppState {
  if (typeof window !== 'undefined') {
    const storageKey = getStorageKey(projectId);
    localStorage.removeItem(storageKey);
  }
  const defaultState = getDefaultState();
  if (projectId) {
    defaultState.project.projectId = projectId;
  }
  return defaultState;
}

// Get saved products for export
export function getSavedProducts(state: AppState): Array<{
  material: ScannedMaterial;
  product: ProductRecommendation;
}> {
  const saved: Array<{ material: ScannedMaterial; product: ProductRecommendation }> = [];
  
  for (const material of state.scannedMaterials) {
    for (const product of material.recommendations) {
      if (product.saved) {
        saved.push({ material, product });
      }
    }
  }
  
  return saved;
}

