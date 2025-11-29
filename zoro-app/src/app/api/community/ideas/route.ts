import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

// GET /api/community/ideas - List all community ideas with vote status for user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);
    
    let userId: string | null = null;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }
    
    // Fetch ideas
    const { data: ideas, error: ideasError } = await supabase
      .from('community_ideas')
      .select(`
        *,
        user_profiles!community_ideas_user_id_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false });
    
    if (ideasError) {
      console.error('Error fetching ideas:', ideasError);
      return NextResponse.json(
        { error: 'Failed to fetch ideas', details: ideasError.message },
        { status: 500 }
      );
    }
    
    // If user is authenticated, check which ideas they voted for
    let userVotes: string[] = [];
    if (userId) {
      const { data: votes } = await supabase
        .from('community_idea_votes')
        .select('idea_id')
        .eq('user_id', userId);
      
      userVotes = votes?.map(v => v.idea_id) || [];
    }
    
    // Format response with vote status
    const ideasWithVotes = (ideas || []).map((idea: any) => ({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      votes: idea.votes_count,
      userVoted: userVotes.includes(idea.id),
      author: idea.user_profiles?.full_name || idea.user_profiles?.email || 'Community Member',
      createdAt: idea.created_at
    }));
    
    return NextResponse.json({ ideas: ideasWithVotes }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/community/ideas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/ideas - Create a new community idea
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
    if (!body.title || !body.description || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, category' },
        { status: 400 }
      );
    }
    
    // Create idea
    const { data, error } = await supabase
      .from('community_ideas')
      .insert({
        user_id: user.id,
        title: body.title,
        description: body.description,
        category: body.category,
        votes_count: 0
      })
      .select(`
        *,
        user_profiles!community_ideas_user_id_fkey(full_name, email)
      `)
      .single();
    
    if (error) {
      console.error('Error creating idea:', error);
      return NextResponse.json(
        { error: 'Failed to create idea', details: error.message },
        { status: 500 }
      );
    }
    
    // Format response
    const idea = {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      votes: data.votes_count,
      userVoted: false,
      author: data.user_profiles?.full_name || data.user_profiles?.email || 'You',
      createdAt: data.created_at
    };
    
    return NextResponse.json({ idea }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/community/ideas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

