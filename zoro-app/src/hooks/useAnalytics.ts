'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  trackEvent,
  trackPageView,
  trackCampaignClick,
  getUTMParams,
} from '@/lib/analytics';

export function useAnalytics() {
  const pathname = usePathname();

  // Track page view on route change
  useEffect(() => {
    trackPageView();
  }, [pathname]);

  // Auto-track campaign when UTM params are present on the URL.
  // Visiting: http://localhost:3000/?utm_source=...&utm_medium=...&utm_campaign=...
  // will create/update a campaign record in the DB (once per session per campaign).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const utm = getUTMParams();
    if (!utm.campaign) return;

    const campaignKey = `zoro_campaign_tracked_${utm.campaign}`;
    const alreadyTracked = sessionStorage.getItem(campaignKey);
    if (alreadyTracked) return;

    // Mark as tracked for this session to avoid duplicates
    sessionStorage.setItem(campaignKey, 'true');

    trackCampaignClick(utm.campaign, {
      source: utm.source,
      medium: utm.medium,
      term: utm.term,
      content: utm.content,
      linkUrl: window.location.href,
      linkText: 'auto_campaign_pageview',
    });
  }, [pathname]);

  // Track button/event click
  const trackClick = useCallback(
    (
      eventName: string,
      properties?: {
        category?: string;
        label?: string;
        elementId?: string;
        elementClass?: string;
        elementText?: string;
        metadata?: Record<string, unknown>;
      },
    ) => {
      trackEvent(eventName, properties);
    },
    [],
  );

  // Track campaign click (manual usage)
  const trackCampaign = useCallback(
    (
      campaignName: string,
      properties?: {
        source?: string;
        medium?: string;
        term?: string;
        content?: string;
        linkUrl?: string;
        linkText?: string;
      },
    ) => {
      trackCampaignClick(campaignName, properties);
    },
    [],
  );

  return {
    trackClick,
    trackCampaign,
    trackEvent,
  };
}

