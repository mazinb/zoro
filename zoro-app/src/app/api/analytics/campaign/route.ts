import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

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
    let authenticatedUserId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const supabaseClient = getSupabaseClient(token);
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (!authError && user) {
          authenticatedUserId = user.id;
        }
      } catch (authErr) {
        // Continue without authenticated user if auth fails
        if (process.env.NODE_ENV === 'development') {
          console.error('Auth error in campaign tracking:', authErr);
        }
      }
    }

    const supabase = getSupabaseClient();
    // Handle userId - if it's an anonymous user ID (starts with 'user_'), set to null
    // Otherwise, if it's a UUID, use it
    const finalUserId = authenticatedUserId || 
      (userId && !userId.startsWith('user_') && userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? userId : null);

    // Update or create campaign record
    const { data: existingCampaign, error: selectError } = await supabase
      .from('analytics_campaigns')
      .select('id, unique_users, total_clicks, user_ids')
      .eq('campaign_name', campaignName)
      .maybeSingle();

    if (selectError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error selecting campaign:', selectError);
      }
      return NextResponse.json(
        { error: 'Failed to query campaign', details: selectError.message },
        { status: 500 }
      );
    }

    if (existingCampaign) {
      // Check if this is a new unique user for this campaign
      const existingUserIds = (existingCampaign.user_ids as string[]) || [];
      const isNewUser = finalUserId && !existingUserIds.includes(finalUserId);
      
      const uniqueUsers = isNewUser
        ? (existingCampaign.unique_users || 0) + 1
        : existingCampaign.unique_users || 0;

      const updatedUserIds = isNewUser && finalUserId
        ? [...existingUserIds, finalUserId]
        : existingUserIds;

      const { error: updateError } = await supabase
        .from('analytics_campaigns')
        .update({
          last_visit_at: new Date().toISOString(),
          unique_users: uniqueUsers,
          total_clicks: (existingCampaign.total_clicks || 0) + 1,
          user_ids: updatedUserIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCampaign.id);

      if (updateError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error updating campaign:', updateError);
        }
        return NextResponse.json(
          { error: 'Failed to update campaign', details: updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Create new campaign
      const { error: insertError } = await supabase.from('analytics_campaigns').insert({
        campaign_name: campaignName,
        campaign_source: campaignSource || null,
        campaign_medium: campaignMedium || null,
        campaign_term: campaignTerm || null,
        campaign_content: campaignContent || null,
        unique_users: finalUserId ? 1 : 0,
        total_clicks: 1,
        total_sessions: 0,
        user_ids: finalUserId ? [finalUserId] : [],
      });

      if (insertError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error inserting campaign:', insertError);
        }
        return NextResponse.json(
          { error: 'Failed to create campaign', details: insertError.message },
          { status: 500 }
        );
      }
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

