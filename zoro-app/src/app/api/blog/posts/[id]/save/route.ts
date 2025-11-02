import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// POST /api/blog/posts/[id]/save - Toggle save (add or remove)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
    
    // Get type from query parameter or body, default to 'save'
    const url = new URL(request.url);
    let type = url.searchParams.get('type');
    
    // If not in query, try to get from body
    if (!type) {
      try {
        // Clone the request to read body without consuming it
        const clonedRequest = request.clone();
        const body = await clonedRequest.json().catch(() => ({}));
        type = body.type || 'save';
      } catch {
        type = 'save';
      }
    }
    
    if (type !== 'save' && type !== 'zoro_context') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "save" or "zoro_context"' },
        { status: 400 }
      );
    }
  
  // Check if already saved with this type
  const { data: existingSave } = await supabase
    .from('blog_post_saves')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .eq('type', type)
    .single();
  
  if (existingSave) {
    // Remove save
    const { error } = await supabase
      .from('blog_post_saves')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .eq('type', type);
    
    if (error) {
      console.error('Error removing save:', error);
      return NextResponse.json(
        { error: 'Failed to remove save', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ saved: false, type }, { status: 200 });
  } else {
    // Add save
    const { data, error } = await supabase
      .from('blog_post_saves')
      .insert({
        user_id: user.id,
        post_id: postId,
        type: type
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving post:', error);
      return NextResponse.json(
        { error: 'Failed to save post', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ saved: true, type, data }, { status: 200 });
  }
  } catch (error) {
    console.error('Error in POST /api/blog/posts/[id]/save:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/blog/posts/[id]/save - Check if post is saved by user (can specify type in query)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ saved: false, zoroContext: false }, { status: 200 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ saved: false, zoroContext: false }, { status: 200 });
    }
    
    // Get type from query parameter, if specified
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    
    if (type && (type === 'save' || type === 'zoro_context')) {
      // Check specific type
      const { data: save } = await supabase
        .from('blog_post_saves')
        .select('id, type')
        .eq('user_id', user.id)
        .eq('post_id', postId)
        .eq('type', type)
        .single();
      
      if (type === 'save') {
        return NextResponse.json({ saved: !!save, zoroContext: false }, { status: 200 });
      } else {
        return NextResponse.json({ saved: false, zoroContext: !!save }, { status: 200 });
      }
    } else {
      // Check both types
      const { data: saves } = await supabase
        .from('blog_post_saves')
        .select('id, type')
        .eq('user_id', user.id)
        .eq('post_id', postId);
      
      const saved = saves?.some(s => s.type === 'save') || false;
      const zoroContext = saves?.some(s => s.type === 'zoro_context') || false;
      
      return NextResponse.json({ saved, zoroContext }, { status: 200 });
    }
  } catch (error) {
    console.error('Error in GET /api/blog/posts/[id]/save:', error);
    return NextResponse.json({ saved: false, zoroContext: false }, { status: 200 });
  }
}

