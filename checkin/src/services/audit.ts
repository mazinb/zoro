import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export interface AuditLogEntry {
    action: string;
    resourceId?: string;
    status: 'success' | 'failure' | 'info';
    details?: any;
    timestamp?: string;
}

export class AuditService {
    private supabase: SupabaseClient | null = null;
    private hasAuditTable = false; // Optimistic flag, could check on init

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
        } else {
            console.warn('AuditService: Supabase credentials not found. persistent logging disabled.');
        }
    }

    async log(action: string, resourceId?: string, status: 'success' | 'failure' | 'info' = 'info', details?: any) {
        const entry: AuditLogEntry = {
            action,
            resourceId,
            status,
            details,
            timestamp: new Date().toISOString(),
        };

        // 1. Console Log (always for now)
        console.log(`[AUDIT] [${entry.timestamp}] [${status.toUpperCase()}] ${action} ${resourceId ? `(${resourceId})` : ''}`, details || '');

        // 2. Persist to Supabase if available
        if (this.supabase) {
            try {
                // Try to insert into 'audit_logs', fallback to console error if fails
                const { error } = await this.supabase
                    .from('audit_logs')
                    .insert({
                        action,
                        resource_id: resourceId,
                        status,
                        details: details ? JSON.stringify(details) : null,
                    });

                if (error) {
                    // If table doesn't exist, we might want to suppress this after first failure
                    // For now, just warn
                    console.warn('AuditService: Failed to persist log:', error.message);
                }
            } catch (err) {
                console.error('AuditService: Unexpected error persisting log:', err);
            }
        }
    }
}

export const auditService = new AuditService();
