'use client';

import { useEffect, useState } from 'react';
import { ProjectInfo, RevitProjectInfo } from '@/types';

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

// Window interface is extended in @/types/index.ts

