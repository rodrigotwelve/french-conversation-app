import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/sessions/process/route';
import { NextRequest } from 'next/server';

const mockGenerateContent = vi.fn();
const mockAddDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: vi.fn().mockImplementation(function () {
            return {
                models: {
                    generateContent: mockGenerateContent
                }
            };
        })
    };
});

vi.mock('../../lib/firebase', () => ({
    db: { type: 'mock-db' }
}));

vi.mock('firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args)
}));

function createRequest(body: any) {
    return new NextRequest('http://localhost:3000/api/sessions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

describe('POST /api/sessions/process', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GEMINI_API_KEY = 'test-gemini-key';
        mockAddDoc.mockResolvedValue({ id: 'mock-doc-123' });
        mockCollection.mockImplementation((db: any, name: string) => ({ db, name }));
    });

    it('returns 400 if JSON body is invalid', async () => {
        const req = new NextRequest('http://localhost:3000/api/sessions/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{ invalid-json'
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Invalid JSON body');
    });

    it('returns 400 if transcript is missing or empty', async () => {
        const req = createRequest({ transcript: '' });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/transcript/i);
    });

    it('returns 500 if GEMINI_API_KEY is not set', async () => {
        delete process.env.GEMINI_API_KEY;
        const req = createRequest({ transcript: 'Bonjour, je suis allé au marché.' });
        const res = await POST(req);
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe('GEMINI_API_KEY is not set');
    });

    it('calls Gemini 1.5 Flash, extracts items, saves to Firestore and returns results', async () => {
        const mockExtraction = {
            grammarMistakes: [
                {
                    original: 'Je suis allé au marché hier et je voyais mon ami.',
                    correction: 'Je suis allé au marché hier et j\'ai vu mon ami.',
                    explanation: 'Use passé composé for a completed action, not imparfait.'
                }
            ],
            flashcards: [
                {
                    front: 'le marché',
                    back: 'the market',
                    context: 'Je suis allé au marché hier.'
                }
            ],
            exercises: [
                {
                    type: 'fill-in-the-blank',
                    prompt: 'Hier, j\'___ (voir) mon ami.',
                    answer: 'ai vu',
                    options: ['ai vu', 'voyais', 'vois', 'verrai'],
                    explanation: 'Passé composé with auxiliary avoir.'
                }
            ]
        };

        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify(mockExtraction)
        });

        const req = createRequest({
            transcript: 'User: Je suis allé au marché hier et je voyais mon ami.\nTutor: Ah très bien ! Qu\'as-tu acheté ?',
            userId: 'user-456'
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gemini-1.5-flash',
                contents: expect.stringContaining('Je suis allé au marché'),
                config: expect.objectContaining({
                    responseMimeType: 'application/json'
                })
            })
        );

        // Verify Firestore persistence for flashcards and exercises
        expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'flashcards');
        expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'exercises');
        expect(mockAddDoc).toHaveBeenCalledTimes(2);

        expect(json.success).toBe(true);
        expect(json.grammarMistakes).toHaveLength(1);
        expect(json.flashcards).toHaveLength(1);
        expect(json.flashcards[0].id).toBe('mock-doc-123');
        expect(json.flashcards[0].userId).toBe('user-456');
        expect(json.exercises).toHaveLength(1);
        expect(json.exercises[0].id).toBe('mock-doc-123');
        expect(json.exercises[0].userId).toBe('user-456');
    });

    it('returns 500 when Gemini API fails', async () => {
        mockGenerateContent.mockRejectedValueOnce(new Error('Gemini quota exceeded'));

        const req = createRequest({ transcript: 'Bonjour.' });
        const res = await POST(req);
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe('Gemini quota exceeded');
    });

    it('returns 500 when Firestore persistence fails', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify({
                grammarMistakes: [],
                flashcards: [{ front: 'bonjour', back: 'hello', context: 'bonjour' }],
                exercises: []
            })
        });
        mockAddDoc.mockRejectedValueOnce(new Error('Firestore write error'));

        const req = createRequest({ transcript: 'Bonjour.' });
        const res = await POST(req);
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe('Firestore write error');
    });
});
