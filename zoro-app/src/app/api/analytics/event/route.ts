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
      eventType,
      eventName,
      eventCategory,
      eventLabel,
      elementId,
      elementClass,
      elementText,
      pageUrl,
      pagePath,
      metadata,
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

    // Insert event
    const { error } = await supabase.from('analytics_events').insert({
      session_id: sessionId,
      user_id: authenticatedUserId || (userId?.startsWith('user_') ? null : userId) || null,
      event_type: eventType || 'interaction',
      event_name: eventName,
      event_category: eventCategory || null,
      event_label: eventLabel || null,
      element_id: elementId || null,
      element_class: elementClass || null,
      element_text: elementText || null,
      page_url: pageUrl,
      page_path: pagePath,
      metadata: metadata || {},
    });

    if (error) {
      // Only log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error tracking event:', error);
      }
      return NextResponse.json(
        { error: 'Failed to track event', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Only log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in analytics event route:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

