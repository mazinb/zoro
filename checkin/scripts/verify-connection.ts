import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from the current directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

console.log('Testing Supabase Connection with Service Role Key...');
console.log('URL:', supabaseUrl);
console.log('Key (last 4):', supabaseKey.slice(-4));

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function testConnection() {
    try {
        // 1. Try to list users (requires service role / admin rights usually)
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

        if (authError) {
            console.error('❌ Auth Admin Check Failed:', authError.message);
        } else {
            console.log('✅ Auth Admin Check Passed. Access to user list confirmed.');
        }

        // 2. Try to access form_submissions table
        const { data, error: dbError } = await supabase
            .from('form_submissions')
            .select('count')
            .limit(1)
            .maybeSingle();

        if (dbError) {
            console.error('❌ Database Access Failed:', dbError.message);
        } else {
            console.log('✅ Database Access Passed. Can read form_submissions.');
        }

        if (!authError && !dbError) {
            console.log('\n🎉 SUCCESS: Service Role Key is working correctly!');
        } else {
            console.log('\n⚠️ PARTIAL FAILURE: Check permissions above.');
        }

    } catch (err: any) {
        console.error('❌ Unexpected Error:', err.message);
    }
}

testConnection();
