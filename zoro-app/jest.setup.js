import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill fetch and Request/Response
const { TextEncoder: TextEncoderImpl, TextDecoder: TextDecoderImpl } = require('util');
global.TextEncoder = TextEncoderImpl;
global.TextDecoder = TextDecoderImpl;

if (typeof global.Request === 'undefined') {
    global.Request = class Request {
        constructor(input, init) {
            Object.defineProperty(this, 'url', { value: input, writable: true, configurable: true });
            this.headers = new Headers(init?.headers);
            this.method = init?.method || 'GET';
            this.body = init?.body;
        }
        json() { return Promise.resolve(JSON.parse(this.body)); }
    };
    global.Response = class Response {
        constructor(body, init) {
            this.body = body;
            this.status = init?.status || 200;
        }
        json() { return Promise.resolve(this.body); }
    };
    global.Headers = class Headers {
        constructor(init) { this.map = new Map(Object.entries(init || {})); }
        get(key) { return this.map.get(key.toLowerCase()); }
    };
}
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
        })),
    })),
}))
