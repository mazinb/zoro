export interface AuditLogEntry {
    action: string;
    resourceId?: string;
    status: 'success' | 'failure' | 'info';
    details?: any;
    timestamp?: string;
}
export declare class AuditService {
    private supabase;
    private hasAuditTable;
    constructor();
    log(action: string, resourceId?: string, status?: 'success' | 'failure' | 'info', details?: any): Promise<void>;
}
export declare const auditService: AuditService;
//# sourceMappingURL=audit.d.ts.map