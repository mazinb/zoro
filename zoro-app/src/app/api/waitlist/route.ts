import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = getSupabaseClient(token);

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's submission to find their join date
        const { data: userSubmission, error: submissionError } = await supabase
            .from('form_submissions')
            .select('created_at, additional_info')
            .eq('user_id', user.id)
            .single();

        if (submissionError || !userSubmission) {
            return NextResponse.json({ error: 'User not on waitlist' }, { status: 404 });
        }

        // specific parsing for additional_info if it's a string
        let additionalInfo = userSubmission.additional_info;
        if (typeof additionalInfo === 'string') {
            try {
                additionalInfo = JSON.parse(additionalInfo);
            } catch (e) {
                additionalInfo = {};
            }
        }

        // Calculate position: count how many people joined before
        const { count, error: countError } = await supabase
            .from('form_submissions')
            .select('*', { count: 'exact', head: true })
            .lt('created_at', userSubmission.created_at);

        if (countError) {
            throw countError;
        }

        const position = (count || 0) + 1;

        // Total waitlist count
        const { count: totalCount, error: totalError } = await supabase
            .from('form_submissions')
            .select('*', { count: 'exact', head: true });

        if (totalError) {
            throw totalError;
        }

        // Get leaderboard (Top 50)
        // We fetch raw data and parse name from additional_info
        const { data: leaderboardData, error: leaderboardError } = await supabase
            .from('form_submissions')
            .select('additional_info, created_at')
            .order('created_at', { ascending: true })
            .limit(50);

        if (leaderboardError) {
            throw leaderboardError;
        }

        const leaderboard = leaderboardData.map((entry: any) => {
            let info = entry.additional_info;
            if (typeof info === 'string') {
                try {
                    info = JSON.parse(info);
                } catch (e) {
                    info = {};
                }
            }
            return {
                name: info?.public_name || 'Anonymous User',
                joinedAt: entry.created_at
            };
        });

        return NextResponse.json({
            position,
            total_waitlist: totalCount || 0,
            public_name: additionalInfo?.public_name || '',
            leaderboard
        });

    } catch (error) {
        console.error('Waitlist API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = getSupabaseClient(token);

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { public_name } = body;

        if (!public_name || typeof public_name !== 'string' || public_name.length > 50) {
            return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
        }

        // Fetch existing data first to merge
        const { data: userSubmission, error: fetchError } = await supabase
            .from('form_submissions')
            .select('additional_info')
            .eq('user_id', user.id)
            .single();

        if (fetchError || !userSubmission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        let currentInfo = userSubmission.additional_info;
        if (typeof currentInfo === 'string') {
            try {
                currentInfo = JSON.parse(currentInfo);
            } catch (e) {
                currentInfo = {};
            }
        } else if (!currentInfo) {
            currentInfo = {};
        }

        const newInfo = {
            ...currentInfo,
            public_name
        };

        // Update
        const { error: updateError } = await supabase
            .from('form_submissions')
            .update({
                additional_info: JSON.stringify(newInfo) // Store as string to be consistent
            })
            .eq('user_id', user.id);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true, public_name });

    } catch (error) {
        console.error('Waitlist Update API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
