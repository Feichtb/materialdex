'use client';

import { useEffect } from 'react';

export function useRevitTheme() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    body.style.backgroundColor = 'var(--revit-darker)';
    body.style.color = 'var(--revit-text)';
  }, []);
}
