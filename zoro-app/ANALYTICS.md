# Analytics System Documentation

## Overview

The Zoro analytics system provides comprehensive tracking of user behavior, campaign performance, and user journeys. It combines **Vercel Analytics** for real-time insights and **Supabase** for detailed customer analytics and custom queries.

**Status**: ✅ Production Ready

---

## Architecture

### Components

1. **Vercel Analytics** - Real-time web analytics (page views, events)
2. **Custom Supabase Analytics** - Detailed event tracking, user journeys, campaign tracking
3. **Client-side tracking** - React hooks and utilities for easy integration
4. **Server-side API routes** - Secure event ingestion

### Database Schema

#### `analytics_sessions`
Tracks user sessions with campaign attribution.

**Key Fields:**
- `session_id` - Unique session identifier
- `user_id` - Authenticated user ID (nullable for anonymous)
- `campaign_source`, `campaign_medium`, `campaign_name` - UTM parameters
- `landing_page` - First page visited
- `device_type`, `browser`, `os` - Device information
- `page_views` - Total page views in session
- `started_at`, `ended_at` - Session timing

#### `analytics_events`
Tracks all user interactions and page views.

**Key Fields:**
- `session_id` - Links to session
- `user_id` - Authenticated user ID (nullable)
- `event_type` - Type: `page_view`, `interaction`, `campaign_click`
- `event_name` - Specific event name (e.g., `cta_get_started_hero`)
- `event_category` - Category: `cta`, `navigation`, `campaign`
- `event_label` - Human-readable label
- `element_id`, `element_class`, `element_text` - Element details
- `page_path`, `page_url` - Page context
- `visit_sequence` - Order of page visits in session
- `metadata` - Additional JSON data
- `created_at` - Timestamp

#### `analytics_campaigns`
Aggregated campaign performance metrics.

**Key Fields:**
- `campaign_name` - Campaign identifier
- `campaign_source`, `campaign_medium` - UTM parameters
- `unique_users` - Count of unique users
- `total_clicks` - Total campaign clicks
- `total_sessions` - Sessions from campaign
- `conversions` - Conversion count
- `first_visit_at`, `last_visit_at` - Campaign timing

---

## Environment Configuration

### Production vs Development

**Analytics is ONLY enabled in production on Vercel.**

The system checks:
- `NODE_ENV === 'production'`
- `NEXT_PUBLIC_VERCEL_ENV === 'production'`

**In development:**
- All tracking functions return early (no API calls)
- Vercel Analytics component is not rendered
- API routes return success without processing
- Console errors are logged for debugging

**In production (Vercel):**
- Full tracking enabled
- Events sent to Vercel Analytics
- Data stored in Supabase
- Silent error handling

### Environment Variables

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

**Optional:**
- `NEXT_PUBLIC_VERCEL_ENV` - Set automatically by Vercel

---

## Usage Examples

### 1. Tracking Page Views

Page views are automatically tracked on route changes via `AnalyticsProvider`.

For manual tracking:
```tsx
import { trackPageView } from '@/lib/analytics';

trackPageView('philosophy'); // Optional page name
```

### 2. Tracking Button Clicks

#### Using TrackedButton Component

```tsx
import { TrackedButton } from '@/components/analytics/TrackedButton';

<TrackedButton
  eventName="cta_get_started_hero"
  eventCategory="cta"
  eventLabel="Get Started (Hero)"
  onClick={() => router.push('/signup')}
>
  Get Started
</TrackedButton>
```

#### Using useAnalytics Hook

```tsx
import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const { trackClick } = useAnalytics();

  return (
    <button
      onClick={() => {
        trackClick('button_click', {
          category: 'navigation',
          label: 'Home Button',
          elementId: 'home-btn',
        });
        router.push('/');
      }}
    >
      Home
    </button>
  );
}
```

### 3. Tracking Campaign Clicks

#### Automatic UTM Tracking

Add UTM parameters to your URLs:
```
https://yoursite.com/?utm_source=email&utm_medium=newsletter&utm_campaign=winter_2024
```

The system automatically captures these on page load.

#### Manual Campaign Tracking

```tsx
import { useAnalytics } from '@/hooks/useAnalytics';

function EmailLink() {
  const { trackCampaign } = useAnalytics();

  return (
    <a
      href="/signup"
      onClick={() => {
        trackCampaign('winter_2024', {
          source: 'email',
          medium: 'newsletter',
          content: 'cta_button',
          linkText: 'Sign Up Now',
        });
      }}
    >
      Sign Up Now
    </a>
  );
}
```

### 4. Tracking Any Element

```tsx
import { TrackedElement } from '@/components/analytics/TrackedElement';

<TrackedElement
  as="div"
  eventName="card_click"
  eventCategory="blog"
  eventLabel="Blog Post Card"
  elementId="blog-card-123"
  onClick={() => router.push('/blog/post-123')}
>
  <h3>Blog Post Title</h3>
  <p>Post excerpt...</p>
</TrackedElement>
```

### 5. Tracking Custom Events

```tsx
import { trackEvent } from '@/lib/analytics';

// Track form submission
await trackEvent('form_submit', {
  category: 'onboarding',
  label: 'Goal Selection Form',
  metadata: {
    goals: ['retirement', 'estate_planning'],
    formStep: 3,
  },
});

// Track video play
trackEvent('video_play', {
  category: 'content',
  label: 'Introduction Video',
  elementId: 'intro-video',
});
```

---

## Tracked Events

### Landing Page CTAs

1. **`cta_get_started_hero`** - "Get Started" button in hero section
2. **`cta_check_in`** - "Check In" button
3. **`cta_advisor_setup`** - "Set up your advisor account" button
4. **`philosophy_nav_click`** - "Our Philosophy" navigation link

### Page Views

- All route changes are automatically tracked
- Philosophy page view is tracked when shown
- Each page view includes `visit_sequence` for journey analysis

---

## SQL Query Examples

Use these queries in your Supabase SQL editor to analyze user behavior.

### Page Visit Order (User Journey)

#### Get complete page visit sequence for a session

```sql
SELECT 
  visit_sequence,
  event_label as page_path,
  page_url,
  created_at,
  metadata->>'deviceType' as device_type,
  metadata->>'browser' as browser
FROM analytics_events
WHERE session_id = 'YOUR_SESSION_ID'
  AND event_type = 'page_view'
ORDER BY visit_sequence ASC;
```

#### Get page visit order for a specific user (across all sessions)

```sql
SELECT 
  s.session_id,
  e.visit_sequence,
  e.event_label as page_path,
  e.created_at,
  s.started_at as session_start
FROM analytics_events e
JOIN analytics_sessions s ON e.session_id = s.session_id
WHERE s.user_id = 'YOUR_USER_ID'
  AND e.event_type = 'page_view'
ORDER BY s.started_at ASC, e.visit_sequence ASC;
```

#### Get most common page visit sequences (first 3 pages)

```sql
WITH page_sequences AS (
  SELECT 
    session_id,
    STRING_AGG(event_label, ' -> ' ORDER BY visit_sequence) as page_sequence,
    COUNT(*) as page_count
  FROM analytics_events
  WHERE event_type = 'page_view'
    AND visit_sequence <= 3
  GROUP BY session_id
)
SELECT 
  page_sequence,
  COUNT(*) as frequency,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM page_sequences
GROUP BY page_sequence
ORDER BY frequency DESC
LIMIT 20;
```

### CTA Click Tracking

#### Get all CTA clicks with details

```sql
SELECT 
  event_name,
  event_label,
  element_id,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions
FROM analytics_events
WHERE event_category = 'cta'
GROUP BY event_name, event_label, element_id
ORDER BY total_clicks DESC;
```

#### Get CTA clicks per user

```sql
SELECT 
  user_id,
  event_label as cta_name,
  COUNT(*) as click_count,
  MIN(created_at) as first_click,
  MAX(created_at) as last_click
FROM analytics_events
WHERE event_category = 'cta'
  AND user_id IS NOT NULL
GROUP BY user_id, event_label
ORDER BY user_id, click_count DESC;
```

#### CTA conversion funnel (clicks to page views)

```sql
SELECT 
  e.event_label as cta_name,
  COUNT(DISTINCT e.session_id) as sessions_with_cta_click,
  COUNT(DISTINCT pv.session_id) as sessions_with_page_view_after,
  ROUND(COUNT(DISTINCT pv.session_id) * 100.0 / NULLIF(COUNT(DISTINCT e.session_id), 0), 2) as conversion_rate
FROM analytics_events e
LEFT JOIN analytics_events pv 
  ON pv.session_id = e.session_id 
  AND pv.event_type = 'page_view'
  AND pv.created_at > e.created_at
WHERE e.event_category = 'cta'
GROUP BY e.event_label
ORDER BY conversion_rate DESC;
```

#### Track the 3 main landing page CTAs

```sql
SELECT 
  event_label,
  element_id,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions,
  ROUND(AVG(EXTRACT(EPOCH FROM (created_at - (SELECT MIN(created_at) FROM analytics_events WHERE session_id = e.session_id)))), 2) as avg_time_to_click_seconds
FROM analytics_events e
WHERE event_category = 'cta'
  AND event_label IN ('Get Started (Hero)', 'Check In', 'Set up advisor account')
GROUP BY event_label, element_id
ORDER BY total_clicks DESC;
```

### Philosophy Page Tracking

#### Track Philosophy page views and clicks

```sql
SELECT 
  'Philosophy Page View' as event_type,
  COUNT(*) as total_views,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions
FROM analytics_events
WHERE event_type = 'page_view'
  AND (event_label = 'philosophy' OR page_path LIKE '%philosophy%')
UNION ALL
SELECT 
  'Philosophy Nav Click' as event_type,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions
FROM analytics_events
WHERE event_name = 'philosophy_nav_click';
```

#### Philosophy page journey (what users do after viewing philosophy)

```sql
SELECT 
  e2.event_label as next_action,
  e2.event_category,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM analytics_events e1
JOIN analytics_events e2 
  ON e2.session_id = e1.session_id
  AND e2.created_at > e1.created_at
  AND e2.visit_sequence > e1.visit_sequence
WHERE e1.event_type = 'page_view'
  AND (e1.event_label = 'philosophy' OR e1.page_path LIKE '%philosophy%')
  AND e2.created_at <= e1.created_at + INTERVAL '1 hour'
GROUP BY e2.event_label, e2.event_category
ORDER BY count DESC
LIMIT 10;
```

### Campaign Tracking

#### Campaign performance overview

```sql
SELECT 
  campaign_name,
  campaign_source,
  campaign_medium,
  unique_users,
  total_clicks,
  total_sessions,
  conversions,
  ROUND(conversions * 100.0 / NULLIF(total_sessions, 0), 2) as conversion_rate,
  first_visit_at,
  last_visit_at
FROM analytics_campaigns
ORDER BY total_clicks DESC;
```

#### Campaign click-through to page views

```sql
SELECT 
  c.campaign_name,
  COUNT(DISTINCT e.session_id) as sessions_with_campaign_click,
  COUNT(DISTINCT pv.session_id) as sessions_with_page_view,
  ROUND(COUNT(DISTINCT pv.session_id) * 100.0 / NULLIF(COUNT(DISTINCT e.session_id), 0), 2) as click_through_rate
FROM analytics_events e
JOIN analytics_sessions s ON e.session_id = s.session_id
JOIN analytics_campaigns c ON s.campaign_name = c.campaign_name
LEFT JOIN analytics_events pv 
  ON pv.session_id = e.session_id
  AND pv.event_type = 'page_view'
  AND pv.created_at > e.created_at
WHERE e.event_type = 'campaign_click'
GROUP BY c.campaign_name
ORDER BY click_through_rate DESC;
```

### User Journey Analysis

#### Complete user journey for a session (all events in order)

```sql
SELECT 
  created_at,
  event_type,
  event_name,
  event_label,
  visit_sequence,
  element_id,
  page_path
FROM analytics_events
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at ASC;
```

#### Most common user paths (first 5 pages)

```sql
WITH ranked_pages AS (
  SELECT 
    session_id,
    visit_sequence,
    event_label as page,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY visit_sequence) as rn
  FROM analytics_events
  WHERE event_type = 'page_view'
    AND visit_sequence <= 5
)
SELECT 
  STRING_AGG(page, ' → ' ORDER BY visit_sequence) as user_path,
  COUNT(*) as frequency
FROM ranked_pages
WHERE rn <= 5
GROUP BY session_id
ORDER BY frequency DESC
LIMIT 20;
```

### Button/Event Clicks Per User

#### Get all button clicks per user with details

```sql
SELECT 
  user_id,
  event_name,
  event_label,
  COUNT(*) as click_count,
  COUNT(DISTINCT session_id) as sessions,
  MIN(created_at) as first_click,
  MAX(created_at) as last_click
FROM analytics_events
WHERE event_type = 'interaction'
  AND user_id IS NOT NULL
GROUP BY user_id, event_name, event_label
ORDER BY user_id, click_count DESC;
```

#### Average clicks per user per event

```sql
SELECT 
  event_name,
  event_label,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_clicks,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT user_id), 0), 2) as avg_clicks_per_user
FROM analytics_events
WHERE event_type = 'interaction'
  AND user_id IS NOT NULL
GROUP BY event_name, event_label
ORDER BY avg_clicks_per_user DESC;
```

#### Get unique users per event

```sql
SELECT 
  event_name,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_clicks
FROM analytics_events
WHERE event_type = 'interaction'
GROUP BY event_name
ORDER BY total_clicks DESC;
```

#### Get clicks per user for a specific event

```sql
SELECT 
  user_id,
  COUNT(*) as click_count
FROM analytics_events
WHERE event_name = 'cta_click'
GROUP BY user_id
ORDER BY click_count DESC;
```

---

## Production Deployment

### Pre-Deployment Checklist

Before deploying to production:

- [x] Analytics disabled in development
- [x] Logging cleaned up
- [x] Test data removed
- [x] Documentation complete
- [x] Build successful
- [x] No linter errors
- [ ] Verify environment variables in Vercel dashboard
- [ ] Test tracking in production preview
- [ ] Monitor first production events

### Post-Deployment Verification

After deployment:

1. **Verify Tracking:**
   - Check Vercel Analytics dashboard for events
   - Query Supabase for new sessions/events
   - Verify no errors in Vercel logs

2. **Monitor Performance:**
   - Check API route response times
   - Monitor database query performance
   - Watch for any errors

3. **Test Campaigns:**
   - Create test campaign with UTM parameters
   - Verify campaign tracking works
   - Check campaign aggregation

### Rollback Plan

If issues occur:
1. Analytics automatically disabled if environment variables missing
2. Can disable by setting `NEXT_PUBLIC_VERCEL_ENV` to non-production value
3. Database queries can be paused via RLS policies

---

## File Structure

```
src/
├── lib/
│   └── analytics.ts              # Core tracking functions
├── hooks/
│   └── useAnalytics.ts           # React hook for tracking
├── components/
│   └── analytics/
│       ├── AnalyticsProvider.tsx # Auto page view tracking
│       ├── TrackedButton.tsx     # Button with auto-tracking
│       └── TrackedElement.tsx    # Generic element tracker
└── app/
    ├── layout.tsx                # Vercel Analytics setup
    └── api/
        └── analytics/
            ├── event/route.ts     # Event tracking endpoint
            ├── pageview/route.ts  # Page view endpoint
            └── campaign/route.ts  # Campaign tracking endpoint
```

---

## Best Practices

1. **Use descriptive event names**: `cta_get_started_hero`, `form_submit`, `video_play`
2. **Include categories**: Helps group related events (`cta`, `navigation`, `campaign`)
3. **Add labels**: Provides context (e.g., which button, which form)
4. **Use metadata**: Store additional context as JSON
5. **Track campaigns**: Always use UTM parameters for marketing campaigns
6. **Test in development**: Use browser console to verify tracking (though it won't save to DB)

---

## Privacy & Compliance

- Anonymous users are tracked with generated session/user IDs
- Authenticated users are linked via `user_id`
- All tracking respects user privacy
- Data is stored securely in Supabase with RLS policies
- No PII is stored in analytics events (except user_id for authenticated users)

---

## Troubleshooting

### Events Not Tracking

1. **Check environment**: Analytics only works in production
2. **Check browser console**: Errors logged in development
3. **Verify API routes**: Check `/api/analytics/*` endpoints
4. **Check Supabase**: Verify RLS policies allow inserts

### Missing Data

1. **Check visit_sequence**: Ensure page views are being tracked
2. **Verify session_id**: Should persist across page views
3. **Check user_id**: May be null for anonymous users

### Performance

- All tracking is asynchronous (non-blocking)
- Failed tracking doesn't affect user experience
- API routes are optimized with indexes

---

## Maintenance

### Regular Tasks

1. **Monitor table sizes**: Analytics tables can grow quickly
2. **Archive old data**: Consider archiving data older than 1 year
3. **Review indexes**: Ensure queries remain fast as data grows
4. **Clean test data**: Remove any test records before production

### Data Retention

Consider implementing data retention policies:
- Keep detailed events for 90 days
- Aggregate older data into summary tables
- Archive campaigns after completion

---

## Future Enhancements

Potential improvements:
- [ ] Real-time analytics dashboard
- [ ] Conversion funnel visualization
- [ ] A/B testing integration
- [ ] Heatmap tracking
- [ ] Session replay
- [ ] Custom event builder UI

---

## Support

For questions or issues:
1. Check this documentation
2. Review SQL examples above
3. Check Supabase logs for API errors
4. Verify environment configuration

---

**Last Updated**: 2025-01-XX  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
