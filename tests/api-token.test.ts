import { POST } from '../app/api/gemini-token/route';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockCreate = vi.fn().mockResolvedValue({ name: 'ephemeral-mock-xyz' });

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: vi.fn().mockImplementation(function () {
            return {
                authTokens: {
                    create: mockCreate
                }
            };
        })
    };
});

describe('POST /api/gemini-token', () => {
    beforeEach(() => {
        process.env.GEMINI_API_KEY = 'test-api-key';
    });

    it('returns an ephemeral token from authTokens.create', async () => {
        const res = await POST();
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.token).toBe('ephemeral-mock-xyz');
    });

    it('returns 500 if GEMINI_API_KEY is missing', async () => {
        delete process.env.GEMINI_API_KEY;
        const res = await POST();
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe('GEMINI_API_KEY is not set');
    });

    it('returns 500 if client.authTokens.create rejects', async () => {
        mockCreate.mockRejectedValueOnce(new Error('SDK Network Error'));
        const res = await POST();
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe('SDK Network Error');
    });

    it('returns 500 if client.authTokens.create does not return a token name', async () => {
        mockCreate.mockResolvedValueOnce({});
        const res = await POST();
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe('Ephemeral token not returned');
    });
});
