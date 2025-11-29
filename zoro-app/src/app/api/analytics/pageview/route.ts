import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Only track in production
const isProduction = process.env.NODE_ENV === 'production' && 
                     process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

export async function POST(request: NextRequest) {
  // Skip tracking in development
  if (!isProduction) {
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    const body = await request.json();
    const {
      sessionId,
      userId,
      campaignSource,
      campaignMedium,
      campaignName,
      campaignTerm,
      campaignContent,
      referrer,
      landingPage,
      userAgent,
      deviceType,
      browser,
      os,
      pageUrl,
      pagePath,
    } = body;

    // Get user if authenticated
    let authenticatedUserId = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (!authError && user) {
        authenticatedUserId = user.id;
      }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Check if session exists
    const { data: existingSession } = await supabase
      .from('analytics_sessions')
      .select('id, page_views')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sessionRecord;
    if (existingSession) {
      // Update existing session
      await supabase
        .from('analytics_sessions')
        .update({
          page_views: (existingSession.page_views || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSession.id);
      sessionRecord = existingSession;
    } else {
      // Create new session
      const { data: newSession } = await supabase.from('analytics_sessions').insert({
        user_id: authenticatedUserId || (userId?.startsWith('user_') ? null : userId) || null,
        session_id: sessionId,
        campaign_source: campaignSource || null,
        campaign_medium: campaignMedium || null,
        campaign_name: campaignName || null,
        campaign_term: campaignTerm || null,
        campaign_content: campaignContent || null,
        referrer: referrer || null,
        landing_page: landingPage || pagePath,
        user_agent: userAgent || null,
        device_type: deviceType || null,
        browser: browser || null,
        os: os || null,
        page_views: 1,
      }).select().single();
      sessionRecord = newSession;
    }

    // Track page view as an event with visit sequence
    const { data: maxSequence } = await supabase
      .from('analytics_events')
      .select('visit_sequence')
      .eq('session_id', sessionId)
      .eq('event_type', 'page_view')
      .order('visit_sequence', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = (maxSequence?.visit_sequence || 0) + 1;

    await supabase.from('analytics_events').insert({
      session_id: sessionId,
      user_id: authenticatedUserId || (userId?.startsWith('user_') ? null : userId) || null,
      event_type: 'page_view',
      event_name: 'page_view',
      event_category: 'navigation',
      event_label: pagePath,
      page_url: pageUrl,
      page_path: pagePath,
      visit_sequence: nextSequence,
      metadata: {
        landingPage,
        referrer,
        deviceType,
        browser,
        os,
      },
    });

    // Track campaign if present
    if (campaignName) {
      const { data: existingCampaign } = await supabase
        .from('analytics_campaigns')
        .select('id, unique_users, total_clicks, total_sessions')
        .eq('campaign_name', campaignName)
        .maybeSingle();

      if (existingCampaign) {
        // Update existing campaign
        const uniqueUsers = existingCampaign.unique_users || 0;
        const totalSessions = (existingCampaign.total_sessions || 0) + 1;
        
        await supabase
          .from('analytics_campaigns')
          .update({
            last_visit_at: new Date().toISOString(),
            total_sessions: totalSessions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCampaign.id);
      } else {
        // Create new campaign
        await supabase.from('analytics_campaigns').insert({
          campaign_name: campaignName,
          campaign_source: campaignSource || null,
          campaign_medium: campaignMedium || null,
          campaign_term: campaignTerm || null,
          campaign_content: campaignContent || null,
          unique_users: 1,
          total_sessions: 1,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Only log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in analytics pageview route:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

