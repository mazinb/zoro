import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// POST /api/blog/posts/[id]/view - Track view and read time
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    let userId: string | null = null;
    
    // Get user if authenticated
    if (token) {
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );
      
      const { data: { user } } = await supabaseClient.auth.getUser();
      userId = user?.id || null;
    }
    
    const body = await request.json();
    const readTimeSeconds = body.readTimeSeconds || 0;
    
    // Try to find existing view record
    const query = supabase
      .from('blog_post_views')
      .select('id, view_count, read_time_seconds')
      .eq('post_id', postId);
    
    if (userId) {
      query.eq('user_id', userId);
    } else {
      query.is('user_id', null);
    }
    
    const { data: existingView } = await query.single();
    
    if (existingView) {
      // Update existing view
      const { data, error } = await supabase
        .from('blog_post_views')
        .update({
          view_count: existingView.view_count + 1,
          read_time_seconds: readTimeSeconds,
          last_viewed_at: new Date().toISOString()
        })
        .eq('id', existingView.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating view:', error);
        return NextResponse.json(
          { error: 'Failed to update view', details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ view: data }, { status: 200 });
    } else {
      // Create new view record
      const { data, error } = await supabase
        .from('blog_post_views')
        .insert({
          user_id: userId,
          post_id: postId,
          view_count: 1,
          read_time_seconds: readTimeSeconds,
          last_viewed_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating view:', error);
        return NextResponse.json(
          { error: 'Failed to create view', details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ view: data }, { status: 201 });
    }
  } catch (error) {
    console.error('Error in POST /api/blog/posts/[id]/view:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

