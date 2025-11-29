import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

// GET /api/blog/posts - List all blog posts
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);
    
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('publish_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching blog posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blog posts', details: error.message },
        { status: 500 }
      );
    }
    
    // If authenticated, also fetch saved/zoro context status for all posts
    let savesData: Record<string, { saved: boolean; zoroContext: boolean }> = {};
    
    if (token) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch all saves for this user in one query
        const { data: saves } = await supabase
          .from('blog_post_saves')
          .select('post_id, type')
          .eq('user_id', user.id);
        
        // Group by post_id
        saves?.forEach(save => {
          if (!savesData[save.post_id]) {
            savesData[save.post_id] = { saved: false, zoroContext: false };
          }
          if (save.type === 'save') {
            savesData[save.post_id].saved = true;
          } else if (save.type === 'zoro_context') {
            savesData[save.post_id].zoroContext = true;
          }
        });
      }
    }
    
    return NextResponse.json({ 
      posts: data || [],
      saves: savesData 
    }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/blog/posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/blog/posts - Create a new blog post
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);
    
    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.title || !body.excerpt || !body.author || !body.publish_date || !body.category || !body.complexity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Convert camelCase to snake_case
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        user_id: user.id,
        title: body.title,
        excerpt: body.excerpt,
        tags: body.tags || [],
        author: body.author,
        publish_date: body.publish_date,
        estimated_read_time: body.estimatedReadTime || 0,
        category: body.category,
        target_audience: body.targetAudience || [],
        complexity: body.complexity,
        jurisdiction: body.jurisdiction || [],
        key_topics: body.keyTopics || [],
        engagement_score: body.engagementScore || 0
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating blog post:', error);
      return NextResponse.json(
        { error: 'Failed to create blog post', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/blog/posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

