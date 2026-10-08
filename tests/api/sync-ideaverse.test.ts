import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../../app/api/sync/ideaverse/route';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

function createRequest(body: any) {
    return new NextRequest('http://localhost:3000/api/sync/ideaverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

describe('POST /api/sync/ideaverse', () => {
    const originalEnv = process.env.IDEAVERSE_PATH;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.IDEAVERSE_PATH = originalEnv;
        } else {
            delete process.env.IDEAVERSE_PATH;
        }
    });

    it('returns 400 if JSON body is invalid', async () => {
        const req = new NextRequest('http://localhost:3000/api/sync/ideaverse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{ bad-json'
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Invalid JSON body');
    });

    it('returns 400 if minutesSpoken is missing or negative', async () => {
        const req1 = createRequest({});
        const res1 = await POST(req1);
        expect(res1.status).toBe(400);
        const json1 = await res1.json();
        expect(json1.error).toMatch(/minutesSpoken/i);

        const req2 = createRequest({ minutesSpoken: -5 });
        const res2 = await POST(req2);
        expect(res2.status).toBe(400);
        const json2 = await res2.json();
        expect(json2.error).toMatch(/minutesSpoken/i);
    });

    it('generates executive daily log markdown with valid metrics', async () => {
        const testDate = '2026-10-08';
        const req = createRequest({
            date: testDate,
            minutesSpoken: 25,
            flashcardsLearned: 12,
            errorsCorrected: 4,
            summary: 'Pratique de conversation sur la vie quotidienne à Marseille.'
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.success).toBe(true);
        expect(json.date).toBe(testDate);
        expect(json.entry).toContain(`### Sessão de Francês - ${testDate}`);
        expect(json.entry).toContain('**Tempo Falado**: 25 min');
        expect(json.entry).toContain('**Flashcards Aprendidos**: 12');
        expect(json.entry).toContain('**Erros Corrigidos**: 4');
        expect(json.entry).toContain('Pratique de conversation sur la vie quotidienne à Marseille.');
    });

    it('uses current date format (YYYY-MM-DD) if date is omitted', async () => {
        const req = createRequest({
            minutesSpoken: 15
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        const todayRegex = /^\d{4}-\d{2}-\d{2}$/;
        expect(json.date).toMatch(todayRegex);
        expect(json.entry).toContain(`## Sessão de Francês - ${json.date}`);
    });

    it('appends or creates daily log file when IDEAVERSE_PATH directory exists', async () => {
        const tempDir = path.join(process.cwd(), 'tmp-test-ideaverse');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        process.env.IDEAVERSE_PATH = tempDir;

        try {
            const testDate = '2026-10-08';
            const req = createRequest({
                date: testDate,
                minutesSpoken: 30,
                flashcardsLearned: 5,
                summary: 'Discussion avec Atlas.'
            });

            const res = await POST(req);
            expect(res.status).toBe(200);
            const json = await res.json();

            expect(json.success).toBe(true);
            const expectedFile = path.join(tempDir, `${testDate}.md`);
            expect(json.targetPath).toBe(expectedFile);
            expect(fs.existsSync(expectedFile)).toBe(true);

            const fileContent = fs.readFileSync(expectedFile, 'utf-8');
            expect(fileContent).toContain('**Tempo Falado**: 30 min');
        } finally {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    });

    it('handles non-existent IDEAVERSE_PATH directory gracefully without crashing', async () => {
        process.env.IDEAVERSE_PATH = 'Z:/non-existent-drive/Ideaverse/Daily Logs';

        const req = createRequest({
            date: '2026-10-08',
            minutesSpoken: 20
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.success).toBe(true);
        expect(json.fileWritten).toBe(false);
        expect(json.entry).toBeDefined();
    });
});
