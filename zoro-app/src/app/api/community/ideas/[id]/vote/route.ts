import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// POST /api/community/ideas/[id]/vote - Toggle vote (add or remove)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    
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
    
    // Check if already voted
    const { data: existingVote } = await supabase
      .from('community_idea_votes')
      .select('id')
      .eq('user_id', user.id)
      .eq('idea_id', ideaId)
      .single();
    
    if (existingVote) {
      // Remove vote (trigger will update votes_count)
      const { error } = await supabase
        .from('community_idea_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('idea_id', ideaId);
      
      if (error) {
        console.error('Error removing vote:', error);
        return NextResponse.json(
          { error: 'Failed to remove vote', details: error.message },
          { status: 500 }
        );
      }
      
      // Get updated idea
      const { data: idea } = await supabase
        .from('community_ideas')
        .select('votes_count')
        .eq('id', ideaId)
        .single();
      
      return NextResponse.json({ 
        voted: false, 
        votes: idea?.votes_count || 0 
      }, { status: 200 });
    } else {
      // Add vote (trigger will update votes_count)
      const { error } = await supabase
        .from('community_idea_votes')
        .insert({
          user_id: user.id,
          idea_id: ideaId
        });
      
      if (error) {
        console.error('Error adding vote:', error);
        return NextResponse.json(
          { error: 'Failed to add vote', details: error.message },
          { status: 500 }
        );
      }
      
      // Get updated idea
      const { data: idea } = await supabase
        .from('community_ideas')
        .select('votes_count')
        .eq('id', ideaId)
        .single();
      
      return NextResponse.json({ 
        voted: true, 
        votes: idea?.votes_count || 0 
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error in POST /api/community/ideas/[id]/vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

