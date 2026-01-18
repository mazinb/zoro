"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeService = exports.RealtimeService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const workflow_1 = require("./workflow");
const audit_1 = require("./audit");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class RealtimeService {
    constructor() {
        this.channel = null;
        this.isConnected = false;
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase credentials in .env');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    initialize() {
        console.log('Initializing Realtime Service...');
        this.setupSubscription();
    }
    setupSubscription() {
        // Listen to INSERT events on 'form_submissions' table
        this.channel = this.supabase
            .channel('form-submissions-monitor')
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'form_submissions',
        }, async (payload) => {
            console.log('Received new submission event:', payload.new.id);
            await audit_1.auditService.log('realtime_event_received', payload.new.id, 'info', { table: 'form_submissions' });
            try {
                await workflow_1.workflowService.processSubmission(payload.new);
            }
            catch (error) {
                console.error('Error processing realtime event:', error);
            }
        })
            .subscribe((status) => {
            console.log(`Supabase Realtime status: ${status}`);
            if (status === 'SUBSCRIBED') {
                this.isConnected = true;
                audit_1.auditService.log('realtime_connected', undefined, 'success');
            }
            else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                this.isConnected = false;
                audit_1.auditService.log('realtime_disconnected', undefined, 'failure', { status });
            }
        });
    }
}
exports.RealtimeService = RealtimeService;
exports.realtimeService = new RealtimeService();
//# sourceMappingURL=realtime.js.map