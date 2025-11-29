'use client';

import { track } from '@vercel/analytics';

// Check if analytics should be enabled (only in production)
const isAnalyticsEnabled = () => {
  if (typeof window === 'undefined') return false;
  // Only track in production on Vercel
  return process.env.NODE_ENV === 'production' && 
         process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';
};

// Generate or retrieve a unique session ID
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const storageKey = 'zoro_session_id';
  let sessionId = sessionStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}

// Get or create a user ID (anonymous)
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return '';
  
  const storageKey = 'zoro_user_id';
  let userId = localStorage.getItem(storageKey);
  
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, userId);
  }
  
  return userId;
}

// Parse UTM parameters from URL
export function getUTMParams(): {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
} {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') || undefined,
    medium: params.get('utm_medium') || undefined,
    campaign: params.get('utm_campaign') || undefined,
    term: params.get('utm_term') || undefined,
    content: params.get('utm_content') || undefined,
  };
}

// Get device and browser information
export function getDeviceInfo(): {
  deviceType: string;
  browser: string;
  os: string;
  userAgent: string;
} {
  if (typeof window === 'undefined') {
    return { deviceType: 'unknown', browser: 'unknown', os: 'unknown', userAgent: '' };
  }
  
  const ua = navigator.userAgent;
  let deviceType = 'desktop';
  let browser = 'unknown';
  let os = 'unknown';
  
  // Detect device type
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = 'tablet';
  }
  
  // Detect browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'chrome';
  else if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari';
  else if (ua.includes('Edg')) browser = 'edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'opera';
  
  // Detect OS
  if (ua.includes('Windows')) os = 'windows';
  else if (ua.includes('Mac OS')) os = 'macos';
  else if (ua.includes('Linux')) os = 'linux';
  else if (ua.includes('Android')) os = 'android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'ios';
  
  return { deviceType, browser, os, userAgent: ua };
}

// Track an event (Vercel Analytics only - no custom tracking)
export async function trackEvent(
  eventName: string,
  properties?: {
    category?: string;
    label?: string;
    elementId?: string;
    elementClass?: string;
    elementText?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  
  // Track with Vercel Analytics only
  const vercelProps: Record<string, string | number | boolean> = {};
  if (properties?.category) vercelProps.category = properties.category;
  if (properties?.label) vercelProps.label = properties.label;
  if (properties?.metadata) {
    Object.entries(properties.metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        vercelProps[key] = String(value);
      }
    });
  }
  track(eventName, vercelProps);
}

// Track a page view (Vercel Analytics only - automatic via AnalyticsProvider)
export async function trackPageView(pageName?: string): Promise<void> {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  
  // Vercel Analytics automatically tracks page views via AnalyticsProvider
  // This function is kept for compatibility but doesn't do custom tracking
  if (pageName) {
    track('page_view', { page: pageName });
  }
}

// Track a campaign click (for email, LinkedIn, etc.)
export async function trackCampaignClick(
  campaignName: string,
  properties?: {
    source?: string;
    medium?: string;
    term?: string;
    content?: string;
    linkUrl?: string;
    linkText?: string;
  }
): Promise<void> {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  
  const sessionId = getOrCreateSessionId();
  const userId = getOrCreateUserId();
  const pageUrl = window.location.href;
  const pagePath = window.location.pathname;
  
  // Track with Vercel Analytics
  const vercelProps: Record<string, string> = {
    campaign: campaignName,
  };
  if (properties?.source) vercelProps.source = properties.source;
  if (properties?.medium) vercelProps.medium = properties.medium;
  track('campaign_click', vercelProps);
  
  // Track in our custom analytics
  try {
    await fetch('/api/analytics/campaign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        userId,
        campaignName,
        campaignSource: properties?.source,
        campaignMedium: properties?.medium,
        campaignTerm: properties?.term,
        campaignContent: properties?.content,
        linkUrl: properties?.linkUrl,
        linkText: properties?.linkText,
        pageUrl,
        pagePath,
      }),
    });
  } catch (error) {
    // Silently fail in production, only log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to track campaign click:', error);
    }
  }
}

