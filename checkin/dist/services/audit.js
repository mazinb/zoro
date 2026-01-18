"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class AuditService {
    constructor() {
        this.supabase = null;
        this.hasAuditTable = false; // Optimistic flag, could check on init
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
            this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        }
        else {
            console.warn('AuditService: Supabase credentials not found. persistent logging disabled.');
        }
    }
    async log(action, resourceId, status = 'info', details) {
        const entry = {
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
            }
            catch (err) {
                console.error('AuditService: Unexpected error persisting log:', err);
            }
        }
    }
}
exports.AuditService = AuditService;
exports.auditService = new AuditService();
//# sourceMappingURL=audit.js.map