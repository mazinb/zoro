import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

const ADMIN_EMAIL = 'mazin.biviji1@gmail.com';

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

        // Check admin email
        if (user.email !== ADMIN_EMAIL) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all submissions
        const { data: submissions, error: fetchError } = await supabase
            .from('form_submissions')
            .select('id, user_id, email, created_at, additional_info, net_worth, primary_goal')
            .order('created_at', { ascending: false });

        if (fetchError) {
            throw fetchError;
        }

        const parsedSubmissions = submissions.map((entry: any) => {
            let info = entry.additional_info;
            if (typeof info === 'string') {
                try {
                    info = JSON.parse(info);
                } catch (e) {
                    info = {};
                }
            }
            return {
                id: entry.id,
                user_id: entry.user_id,
                email: entry.email,
                net_worth: entry.net_worth,
                primary_goal: entry.primary_goal,
                joinedAt: entry.created_at,
                public_name: info?.public_name || '',
                full_info: info
            };
        });

        return NextResponse.json({ submissions: parsedSubmissions });

    } catch (error) {
        console.error('Admin API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
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

        // Check admin email
        if (user.email !== ADMIN_EMAIL) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id, public_name } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        // Fetch existing data
        const { data: submission, error: fetchError } = await supabase
            .from('form_submissions')
            .select('additional_info')
            .eq('id', id)
            .single();

        if (fetchError || !submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        let currentInfo = submission.additional_info;
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
                additional_info: JSON.stringify(newInfo)
            })
            .eq('id', id);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Admin Update API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
