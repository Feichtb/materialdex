'use client';

import { useState, useEffect } from 'react';

type RevitTheme = 'dark' | 'light';

interface RevitThemeInfo {
  name: RevitTheme;
  isDark: boolean;
}

export function useRevitTheme() {
  const [theme, setTheme] = useState<RevitTheme>('dark'); // Default to dark

  useEffect(() => {
    // Check if we're running in Revit plugin
    if (typeof window === 'undefined') return;

    // Check for existing theme in queue (if bridge initialized before component)
    const checkQueue = () => {
      if ((window as any).revitThemeQueue && (window as any).revitThemeQueue.length > 0) {
        const queuedTheme = (window as any).revitThemeQueue.shift();
        if (queuedTheme) {
          const newTheme = queuedTheme.name || (queuedTheme.isDark ? 'dark' : 'light');
          setTheme(newTheme);
        }
      }
    };

    // Set up handler for theme messages from Revit
    const handleRevitTheme = (themeInfo: RevitThemeInfo) => {
      const newTheme = themeInfo.name || (themeInfo.isDark ? 'dark' : 'light');
      setTheme(newTheme);
    };

    // Register handler
    (window as any).onRevitTheme = handleRevitTheme;

    // Check queue immediately
    checkQueue();

    // Also check periodically for a longer time in case bridge loads after component
    const interval = setInterval(() => {
      checkQueue();
    }, 200);

    // Clean up after 5 seconds
    setTimeout(() => {
      clearInterval(interval);
    }, 5000);

    // Also try to request theme from bridge if it exists
    const requestTheme = () => {
      if ((window as any).revitBridge) {
        checkQueue();
        // Request theme from Revit if bridge supports it
        if ((window as any).revitBridge.requestTheme) {
          (window as any).revitBridge.requestTheme();
        }
      }
    };

    // Try requesting after delays
    setTimeout(requestTheme, 500);
    setTimeout(requestTheme, 1500);
    setTimeout(requestTheme, 3000);
    
    // Also check queue periodically for longer
    const longInterval = setInterval(() => {
      checkQueue();
    }, 500);
    
    setTimeout(() => {
      clearInterval(longInterval);
    }, 10000);

    return () => {
      if ((window as any).onRevitTheme === handleRevitTheme) {
        delete (window as any).onRevitTheme;
      }
    };
  }, []);

  // Apply theme to document root and fix text colors
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    
    // Function to fix text colors in light mode
    const fixLightModeTextColors = () => {
      if (theme !== 'light') return;
      
      const textElements = document.querySelectorAll('[class*="text-revit-text"]');
      textElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const classes = htmlEl.className;
        if (typeof classes === 'string') {
          // Extract opacity value from class name
          let opacity = 1;
          if (classes.includes('/80') || (classes.includes('80') && classes.includes('text-revit-text'))) opacity = 0.8;
          else if (classes.includes('/70') || (classes.includes('70') && classes.includes('text-revit-text'))) opacity = 0.7;
          else if (classes.includes('/60') || (classes.includes('60') && classes.includes('text-revit-text'))) opacity = 0.6;
          else if (classes.includes('/50') || (classes.includes('50') && classes.includes('text-revit-text'))) opacity = 0.5;
          else if (classes.includes('/40') || (classes.includes('40') && classes.includes('text-revit-text'))) opacity = 0.4;
          
          // Apply color directly - use dark text color for light background
          htmlEl.style.color = `rgba(50, 49, 48, ${opacity})`;
          htmlEl.style.opacity = '1';
        }
      });
    };
    
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
      body.style.backgroundColor = '';
      body.style.color = '';
      
      // Remove inline styles in dark mode
      document.querySelectorAll('[class*="text-revit-text"]').forEach((el) => {
        (el as HTMLElement).style.color = '';
        (el as HTMLElement).style.opacity = '';
      });
    } else {
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
      // Force light theme colors
      body.style.backgroundColor = 'var(--revit-darker)';
      body.style.color = 'var(--revit-text)';
      
      // Fix text colors after React renders - run multiple times to catch all elements
      const timeouts = [100, 300, 600, 1000];
      const timeoutIds = timeouts.map(delay => setTimeout(fixLightModeTextColors, delay));
      
      // Watch for new elements being added (debounced)
      let debounceTimer: NodeJS.Timeout;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fixLightModeTextColors, 100);
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
      
      // Cleanup observer and timeouts on theme change
      return () => {
        observer.disconnect();
        timeoutIds.forEach(id => clearTimeout(id));
        clearTimeout(debounceTimer);
      };
    }
  }, [theme]);

  return theme;
}

