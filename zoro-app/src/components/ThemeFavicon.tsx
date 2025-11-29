'use client';

import { useEffect, useState } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';

/**
 * ThemeFavicon - Dynamically switches favicon based on theme
 * 
 * This component updates the favicon, icon, and apple-touch-icon
 * based on the current dark/light mode setting. It also checks
 * system preference for immediate initial detection.
 */
export function ThemeFavicon() {
  const { darkMode } = useDarkMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Helper function to find or create favicon link element
    const updateFavicon = (href: string, rel: string = 'icon') => {
      // Handle both 'icon' and 'shortcut icon' rels
      const selectors = rel === 'icon' 
        ? ['link[rel="icon"]', 'link[rel="shortcut icon"]']
        : [`link[rel="${rel}"]`];
      
      selectors.forEach(selector => {
        let link = document.querySelector(selector) as HTMLLinkElement;
        
        if (!link) {
          link = document.createElement('link');
          link.rel = rel === 'icon' && selector.includes('shortcut') ? 'shortcut icon' : rel;
          document.head.appendChild(link);
        }
        
        link.href = href;
      });
    };

    // Determine which theme to use
    const isDark = darkMode;

    // Update favicon.ico
    const favicon = isDark ? '/favicon-dark.ico' : '/favicon-light.ico';
    updateFavicon(favicon, 'icon');

    // Update apple-touch-icon
    const appleIcon = isDark ? '/apple-icon-dark.png' : '/apple-icon-light.png';
    let appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = appleIcon;

    // Update general icon (for PWA and other uses)
    const generalIcon = isDark ? '/icon-dark.png' : '/icon-light.png';
    let iconLink = document.querySelector('link[rel="icon"][type="image/png"]') as HTMLLinkElement;
    
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      iconLink.type = 'image/png';
      iconLink.sizes = '512x512';
      document.head.appendChild(iconLink);
    }
    
    iconLink.href = generalIcon;
  }, [darkMode, mounted]);

  // On initial mount, check system preference for immediate favicon update
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemIsDark = mediaQuery.matches;
    
    // Set initial favicon based on system preference before useDarkMode initializes
    const initialFavicon = systemIsDark ? '/favicon-dark.ico' : '/favicon-light.ico';
    const initialAppleIcon = systemIsDark ? '/apple-icon-dark.png' : '/apple-icon-light.png';
    const initialIcon = systemIsDark ? '/icon-dark.png' : '/icon-light.png';

    // Update immediately if links exist
    const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (faviconLink) faviconLink.href = initialFavicon;

    const appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    if (appleLink) appleLink.href = initialAppleIcon;
  }, []);

  return null; // This component doesn't render anything
}

