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
      campaignName,
      campaignSource,
      campaignMedium,
      campaignTerm,
      campaignContent,
      linkUrl,
      linkText,
      pageUrl,
      pagePath,
    } = body;

    if (!campaignName) {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 }
      );
    }

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

    // Track campaign click as an event
    await supabase.from('analytics_events').insert({
      session_id: sessionId,
      user_id: authenticatedUserId || (userId?.startsWith('user_') ? null : userId) || null,
      event_type: 'campaign_click',
      event_name: 'campaign_click',
      event_category: 'campaign',
      event_label: campaignName,
      page_url: pageUrl,
      page_path: pagePath,
      metadata: {
        campaignName,
        campaignSource,
        campaignMedium,
        campaignTerm,
        campaignContent,
        linkUrl,
        linkText,
      },
    });

    // Update or create campaign record
    const { data: existingCampaign } = await supabase
      .from('analytics_campaigns')
      .select('id, unique_users, total_clicks')
      .eq('campaign_name', campaignName)
      .maybeSingle();

    if (existingCampaign) {
      // Check if this is a new unique user for this campaign
      const { data: userEvents } = await supabase
        .from('analytics_events')
        .select('user_id')
        .eq('event_label', campaignName)
        .eq('event_type', 'campaign_click')
        .eq('user_id', authenticatedUserId || userId)
        .limit(1)
        .maybeSingle();

      const isNewUser = !userEvents;
      const uniqueUsers = isNewUser
        ? (existingCampaign.unique_users || 0) + 1
        : existingCampaign.unique_users || 0;

      await supabase
        .from('analytics_campaigns')
        .update({
          last_visit_at: new Date().toISOString(),
          unique_users: uniqueUsers,
          total_clicks: (existingCampaign.total_clicks || 0) + 1,
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
        total_clicks: 1,
        total_sessions: 0,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Only log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in analytics campaign route:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

