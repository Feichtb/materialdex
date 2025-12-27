'use client';

import { useEffect, useState } from 'react';
import { ProjectInfo } from '@/types';

interface RevitProjectInfo {
  name: string;
  zip: string;
  address?: string;
  projectId?: string; // Unique identifier for the Revit project (document path)
}

export function useRevitProject() {
  const [projectInfo, setProjectInfo] = useState<RevitProjectInfo | null>(null);

  useEffect(() => {
    // Set up handler for project info from Revit
    const handleProjectInfo = (info: RevitProjectInfo) => {
      setProjectInfo(info);
    };

    // Set up handler
    if (typeof window !== 'undefined') {
      window.onRevitProjectInfo = handleProjectInfo;

      // Check for queued project info
      if (window.revitProjectInfoQueue && window.revitProjectInfoQueue.length > 0) {
        const queued = window.revitProjectInfoQueue.shift();
        if (queued) {
          handleProjectInfo(queued);
        }
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.onRevitProjectInfo = undefined;
      }
    };
  }, []);

  // Request project info from Revit on mount if running in plugin
  useEffect(() => {
    if (typeof window !== 'undefined' && window.revitBridge?.isRevitPlugin) {
      // Small delay to ensure bridge is fully initialized
      const timer = setTimeout(() => {
        if (window.revitBridge?.requestProjectInfo) {
          window.revitBridge.requestProjectInfo();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, []);

  return projectInfo;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    revitBridge?: {
      isRevitPlugin: boolean;
      sendToRevit: (data: any) => void;
      receiveMaterials: (materials: any) => void;
      receiveTheme: (theme: any) => void;
      receiveProjectInfo?: (info: RevitProjectInfo) => void;
      requestTheme: () => void;
      requestMaterials?: (skip: number, take: number) => void;
      requestProjectInfo?: () => void;
    };
    onRevitProjectInfo?: (info: RevitProjectInfo) => void;
    revitProjectInfoQueue?: RevitProjectInfo[];
  }
}

