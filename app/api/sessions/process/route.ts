import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { db } from '../../../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface ExtractionPayload {
    grammarMistakes?: Array<{
        original: string;
        correction: string;
        explanation: string;
    }>;
    flashcards?: Array<{
        front: string;
        back: string;
        context: string;
    }>;
    exercises?: Array<{
        type: string;
        prompt: string;
        answer: string;
        options?: string[];
        explanation: string;
    }>;
}

export async function POST(req: NextRequest) {
    try {
        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { transcript, userId } = body || {};

        if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
            return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
        }

        const client = new GoogleGenAI({ apiKey });

        const prompt = `You are an expert French language tutor analyzing a conversation transcript between a student and an AI tutor.
Analyze the following transcript to extract:
1. "grammarMistakes": An array of grammatical or conjugation errors made by the student, with:
   - "original": the incorrect phrase or sentence
   - "correction": the corrected French version
   - "explanation": a concise grammatical explanation
2. "flashcards": An array of useful vocabulary items, idioms, or expressions for the student to memorize, with:
   - "front": French term or phrase
   - "back": English translation / definition
   - "context": sample sentence from the transcript or realistic usage
3. "exercises": An array of active recall exercises (e.g. fill-in-the-blank) targeting identified weaknesses or new vocabulary, with:
   - "type": "fill-in-the-blank"
   - "prompt": French sentence with a "___" blank
   - "answer": the correct missing word or phrase
   - "options": an array of 4 choices (including the correct answer)
   - "explanation": grammatical reason for the answer

Transcript:
"""
${transcript}
"""

Return a valid JSON object matching this structure:
{
  "grammarMistakes": [...],
  "flashcards": [...],
  "exercises": [...]
}`;

        const response = await client.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            },
        });

        let parsedData: ExtractionPayload = {
            grammarMistakes: [],
            flashcards: [],
            exercises: [],
        };

        if (response?.text) {
            try {
                parsedData = JSON.parse(response.text);
            } catch (err) {
                console.error('Failed to parse Gemini JSON output:', err);
            }
        }

        const effectiveUserId = userId || 'anonymous';
        const createdAt = new Date().toISOString();

        const rawFlashcards = parsedData.flashcards || [];
        const savedFlashcards = [];
        for (const card of rawFlashcards) {
            const docRef = await addDoc(collection(db, 'flashcards'), {
                ...card,
                userId: effectiveUserId,
                createdAt,
            });
            savedFlashcards.push({
                id: docRef.id,
                userId: effectiveUserId,
                ...card,
            });
        }

        const rawExercises = parsedData.exercises || [];
        const savedExercises = [];
        for (const ex of rawExercises) {
            const docRef = await addDoc(collection(db, 'exercises'), {
                ...ex,
                userId: effectiveUserId,
                createdAt,
            });
            savedExercises.push({
                id: docRef.id,
                userId: effectiveUserId,
                ...ex,
            });
        }

        return NextResponse.json({
            success: true,
            grammarMistakes: parsedData.grammarMistakes || [],
            flashcards: savedFlashcards,
            exercises: savedExercises,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
