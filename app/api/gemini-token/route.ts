import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
    }

    try {
        const client = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
        const token = await client.authTokens.create({
            config: {
                uses: 1,
            },
        });

        if (!token?.name) {
            throw new Error('Ephemeral token not returned');
        }

        return NextResponse.json({ token: token.name });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create ephemeral token' },
            { status: 500 }
        );
    }
}
