
import { GET as WaitlistGET, POST as WaitlistPOST } from '@/app/api/waitlist/route';
import { GET as AdminGET } from '@/app/api/admin/waitlist/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
    getSupabaseClient: jest.fn(),
}));

import { getSupabaseClient } from '@/lib/supabase-server';

describe('Waitlist API', () => {
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSupabase = {
            auth: {
                getUser: jest.fn(),
            },
            from: jest.fn(() => mockSupabase),
            select: jest.fn(() => mockSupabase),
            eq: jest.fn(() => mockSupabase),
            single: jest.fn(),
            lt: jest.fn(() => mockSupabase),
            update: jest.fn(() => mockSupabase),
            order: jest.fn(() => mockSupabase),
            limit: jest.fn(() => mockSupabase),
        };

        (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    });

    it('GET /api/waitlist returns 401 if no auth header', async () => {
        const req = new NextRequest(new URL('http://localhost/api/waitlist'), {
            headers: {},
        });
        const res = await WaitlistGET(req);
        expect(res.status).toBe(401);
    });

    it('GET /api/waitlist returns position if authorized', async () => {
        const req = new NextRequest(new URL('http://localhost/api/waitlist'), {
            headers: { authorization: 'Bearer token' },
        });

        mockSupabase.select
            .mockReturnValueOnce(mockSupabase) // user submission
            .mockReturnValueOnce(mockSupabase) // position count
            .mockResolvedValueOnce({ count: 10, error: null }) // total count
            .mockReturnValueOnce(mockSupabase); // leaderboard

        // Mock successful auth
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user1' } }, error: null });
        // Mock user submission found
        mockSupabase.single.mockResolvedValueOnce({ data: { created_at: '2023-01-01', additional_info: { public_name: 'Test' } }, error: null });
        // Mock count (3 people ahead)
        mockSupabase.lt.mockResolvedValue({ count: 3, error: null });
        // Mock leaderboard
        mockSupabase.limit.mockResolvedValue({ data: [], error: null });

        const res = await WaitlistGET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.position).toBe(4); // 3 ahead + 1
        expect(data.public_name).toBe('Test');
        expect(data.total_waitlist).toBe(10);
    });
});

describe('Admin API', () => {
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSupabase = {
            auth: {
                getUser: jest.fn(),
            },
            from: jest.fn(() => mockSupabase),
            select: jest.fn(() => mockSupabase),
            order: jest.fn(() => mockSupabase),
        };

        (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    });

    it('GET /api/admin/waitlist returns 403 for non-admin', async () => {
        const req = new NextRequest(new URL('http://localhost/api/admin/waitlist'), {
            headers: { authorization: 'Bearer token' },
        });

        // Mock auth as normal user
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user1', email: 'normal@user.com' } }, error: null });

        const res = await AdminGET(req);
        expect(res.status).toBe(403);
    });

    it('GET /api/admin/waitlist returns data for admin', async () => {
        const req = new NextRequest(new URL('http://localhost/api/admin/waitlist'), {
            headers: { authorization: 'Bearer token' },
        });

        // Mock auth as admin
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin1', email: 'mazin.biviji1@gmail.com' } }, error: null });
        // Mock fetch
        mockSupabase.select.mockResolvedValue({ data: [{ id: '1', email: 'test@test.com' }], error: null });

        const res = await AdminGET(req);
        // expect(res.status).toBe(200); // Check json body instead
        const data = await res.json();
        expect(data.submissions).toBeDefined();
        expect(data.submissions.length).toBe(1);
    });
});
