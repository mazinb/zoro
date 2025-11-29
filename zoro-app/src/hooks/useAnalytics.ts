'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent, trackPageView, trackCampaignClick } from '@/lib/analytics';

export function useAnalytics() {
  const pathname = usePathname();

  // Track page view on route change
  useEffect(() => {
    trackPageView();
  }, [pathname]);

  // Track button/event click
  const trackClick = useCallback((
    eventName: string,
    properties?: {
      category?: string;
      label?: string;
      elementId?: string;
      elementClass?: string;
      elementText?: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    trackEvent(eventName, properties);
  }, []);

  // Track campaign click
  const trackCampaign = useCallback((
    campaignName: string,
    properties?: {
      source?: string;
      medium?: string;
      term?: string;
      content?: string;
      linkUrl?: string;
      linkText?: string;
    }
  ) => {
    trackCampaignClick(campaignName, properties);
  }, []);

  return {
    trackClick,
    trackCampaign,
    trackEvent,
  };
}

