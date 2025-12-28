'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ProjectInfo, RevitProjectInfo } from '@/types';

// Fallback polling interval - only used if plugin doesn't proactively send updates
// Much longer interval since plugin should handle most updates via Idling event
const FALLBACK_POLL_INTERVAL = 30000; // Check every 30 seconds as fallback

export function useRevitProject() {
  const [projectInfo, setProjectInfo] = useState<RevitProjectInfo | null>(null);
  const lastProjectIdRef = useRef<string | null>(null);

  // Request project info from Revit
  const requestProjectInfo = useCallback(() => {
    if (typeof window !== 'undefined' && window.revitBridge?.requestProjectInfo) {
      window.revitBridge.requestProjectInfo();
    }
  }, []);

  // Request materials from Revit
  const requestMaterials = useCallback(() => {
    if (typeof window !== 'undefined' && window.revitBridge?.requestMaterials) {
      window.revitBridge.requestMaterials(0, 0);
    }
  }, []);

  useEffect(() => {
    // Set up handler for project info from Revit
    const handleProjectInfo = (info: RevitProjectInfo) => {
      // Check if project changed
      const newProjectId = info.projectId;
      const oldProjectId = lastProjectIdRef.current;
      
      if (oldProjectId && newProjectId && oldProjectId !== newProjectId) {
        console.log(`[useRevitProject] Project changed: ${oldProjectId} -> ${newProjectId}`);
        // Project changed - also request new materials
        setTimeout(() => {
          requestMaterials();
        }, 100);
      }
      
      lastProjectIdRef.current = newProjectId || null;
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
  }, [requestMaterials]);

  // Request project info from Revit on mount if running in plugin
  // Also set up fallback polling (long interval) in case plugin doesn't send updates
  useEffect(() => {
    if (typeof window !== 'undefined' && window.revitBridge?.isRevitPlugin) {
      // Initial request after a small delay to ensure bridge is initialized
      const initialTimer = setTimeout(() => {
        requestProjectInfo();
      }, 500);

      // Fallback polling with long interval - plugin should handle most updates proactively
      // This is just a safety net in case the Idling event handler doesn't fire
      const pollInterval = setInterval(() => {
        requestProjectInfo();
      }, FALLBACK_POLL_INTERVAL);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(pollInterval);
      };
    }
  }, [requestProjectInfo]);

  return projectInfo;
}

// Window interface is extended in @/types/index.ts

