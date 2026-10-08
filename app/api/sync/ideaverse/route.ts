import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface IdeaverseSyncRequest {
    userId?: string;
    date?: string;
    minutesSpoken: number;
    flashcardsLearned?: number;
    errorsCorrected?: number;
    summary?: string;
}

export async function POST(req: NextRequest) {
    let body: IdeaverseSyncRequest;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
        userId,
        date,
        minutesSpoken,
        flashcardsLearned = 0,
        errorsCorrected = 0,
        summary = ''
    } = body;

    if (typeof minutesSpoken !== 'number' || minutesSpoken < 0 || isNaN(minutesSpoken)) {
        return NextResponse.json(
            { error: 'minutesSpoken must be a valid non-negative number' },
            { status: 400 }
        );
    }

    const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date().toISOString().split('T')[0];

    const markdownEntry = [
        `\n### Sessão de Francês - ${targetDate}`,
        `- **Tempo Falado**: ${minutesSpoken} min`,
        `- **Flashcards Aprendidos**: ${flashcardsLearned}`,
        `- **Erros Corrigidos**: ${errorsCorrected}`,
        ...(summary ? [`- **Resumo Executivo**: ${summary}`] : []),
        ...(userId ? [`- **Usuário**: \`${userId}\``] : []),
        ''
    ].join('\n');

    const defaultVaultPath = 'G:/Meu Drive/Ideaverse/Daily Logs';
    const vaultPath = process.env.IDEAVERSE_PATH || defaultVaultPath;

    let fileWritten = false;
    let targetFilePath: string | undefined = undefined;

    try {
        if (fs.existsSync(vaultPath)) {
            targetFilePath = path.join(vaultPath, `${targetDate}.md`);
            if (fs.existsSync(targetFilePath)) {
                fs.appendFileSync(targetFilePath, markdownEntry, 'utf-8');
            } else {
                const initialContent = `# Daily Log - ${targetDate}\n${markdownEntry}`;
                fs.writeFileSync(targetFilePath, initialContent, 'utf-8');
            }
            fileWritten = true;
        }
    } catch (err) {
        console.warn('Could not write directly to Ideaverse vault path:', err);
        fileWritten = false;
    }

    return NextResponse.json({
        success: true,
        date: targetDate,
        entry: markdownEntry.trim(),
        fileWritten,
        ...(fileWritten && targetFilePath ? { targetPath: targetFilePath } : {})
    });
}
