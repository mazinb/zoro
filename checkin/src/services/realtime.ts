import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { workflowService } from './workflow';
import { auditService } from './audit';
import dotenv from 'dotenv';

dotenv.config();

export class RealtimeService {
    private supabase: SupabaseClient;
    private channel: RealtimeChannel | null = null;
    private isConnected = false;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase credentials in .env');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    public initialize() {
        console.log('Initializing Realtime Service...');
        this.setupSubscription();
    }

    private setupSubscription() {
        // Listen to INSERT events on 'form_submissions' table
        this.channel = this.supabase
            .channel('form-submissions-monitor')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'form_submissions',
                },
                async (payload) => {
                    console.log('Received new submission event:', payload.new.id);
                    await auditService.log('realtime_event_received', payload.new.id, 'info', { table: 'form_submissions' });

                    try {
                        await workflowService.processSubmission(payload.new);
                    } catch (error) {
                        console.error('Error processing realtime event:', error);
                    }
                }
            )
            .subscribe((status) => {
                console.log(`Supabase Realtime status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    this.isConnected = true;
                    auditService.log('realtime_connected', undefined, 'success');
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    this.isConnected = false;
                    auditService.log('realtime_disconnected', undefined, 'failure', { status });
                }
            });
    }
}

export const realtimeService = new RealtimeService();
