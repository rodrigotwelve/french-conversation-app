'use client';

import React, { useCallback, useRef } from 'react';
import { useLiveSession } from '@/hooks/useLiveSession';
import { useUserProgress } from '@/hooks/useUserProgress';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Flame, AlertCircle, RotateCcw } from 'lucide-react';
import { VoiceStage } from '@/components/practice/VoiceStage';
import { EditorialFeed } from '@/components/practice/EditorialFeed';
import { FloatingDock } from '@/components/practice/FloatingDock';

export default function PracticePage() {
    const { user } = useAuth();
    const { progress, recordSessionCompletion } = useUserProgress();
    const {
        startSession,
        endSession,
        status,
        error,
        elapsedSeconds,
        isConnected,
        isSpeaking,
        transcript,
        getAudioLevels,
    } = useLiveSession();

    const elapsedRef = useRef(elapsedSeconds);
    elapsedRef.current = elapsedSeconds;

    const transcriptRef = useRef(transcript);
    transcriptRef.current = transcript;

    const handleStopSession = useCallback(async () => {
        const currentElapsed = elapsedRef.current;
        const currentTranscript = transcriptRef.current;

        // End active connection
        endSession();

        // 1. Record completed duration in streak & progress
        if (currentElapsed > 0) {
            const minutesSpoken = Math.max(1, Math.round(currentElapsed / 60));
            try {
                await recordSessionCompletion(minutesSpoken);
            } catch (err) {
                console.error('Failed to record session progress', err);
            }
        }

        // 2. Trigger asynchronous session processing for grammar & flashcard extraction
        if (currentTranscript.length > 0) {
            const formatted = currentTranscript
                .map((t) => `${t.role === 'user' ? 'Étudiant' : 'Tuteur'}: ${t.text}`)
                .join('\n');

            if (formatted.trim()) {
                const fetchFn = typeof window !== 'undefined' && window.fetch ? window.fetch : fetch;
                fetchFn('/api/sessions/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transcript: formatted,
                        userId: user?.uid,
                    }),
                }).catch((err) => {
                    console.error('Failed to dispatch session processing', err);
                });
            }
        }
    }, [endSession, recordSessionCompletion, user?.uid]);

    const handleToggleSession = useCallback(async () => {
        if (isConnected || status === 'live') {
            await handleStopSession();
        } else {
            try {
                await startSession();
            } catch (err) {
                console.error('Failed to start session', err);
            }
        }
    }, [isConnected, status, handleStopSession, startSession]);

    const isIdleAndEmpty = status === 'idle' && transcript.length === 0;

    return (
        <div className="h-screen max-h-screen overflow-hidden bg-brand-canvas text-brand-textPrimary flex flex-col justify-between font-sans selection:bg-zinc-200">
            {/* Header: Macro-goal & Authentic Streak */}
            <header className="shrink-0 border-b border-brand-border bg-brand-surface/80 backdrop-blur-xs px-6 py-3.5">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <span className="font-display text-xl font-medium tracking-tight">
                            Atelier Oral
                        </span>
                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded text-xs font-mono bg-zinc-200 text-brand-textPrimary">
                            Niveau {progress.targetLevel || 'B2'}
                        </span>
                    </div>

                    <div className="flex items-center space-x-4 sm:space-x-6">
                        {/* Macro Goal Info */}
                        <div className="flex items-center space-x-2 text-xs font-mono text-brand-textMuted">
                            <Calendar className="w-4 h-4 text-brand-textPrimary stroke-[1.75]" />
                            <span className="hidden md:inline">
                                Objectif : {progress.targetDeadline || 'Avril 2027'} (PVT France)
                            </span>
                            <span className="inline md:hidden">
                                {progress.targetDeadline || 'Avril 2027'}
                            </span>
                        </div>

                        {/* Authentic Streak Metric */}
                        <div className="flex items-center space-x-1.5 text-xs font-mono px-3 py-1 bg-white border border-brand-border rounded-md shadow-xs">
                            <Flame className="w-4 h-4 text-brand-warning stroke-[1.75]" />
                            <span className="font-medium text-brand-textPrimary">
                                {progress.currentStreak}{' '}
                                {progress.currentStreak === 1 ? 'JOUR' : 'JOURS'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Error Notification Banner */}
            {error && (
                <div className="shrink-0 max-w-4xl mx-auto w-full px-6 pt-3">
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-900 text-xs font-sans">
                        <div className="flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-brand-error shrink-0" />
                            <span>{error}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => startSession().catch(() => {})}
                            className="inline-flex items-center space-x-1 font-medium hover:underline text-rose-900 cursor-pointer ml-4"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Réessayer</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Stage Area: Single-viewport transition between VoiceStage and EditorialFeed */}
            <main className="flex-1 overflow-hidden flex flex-col items-center justify-center p-4">
                {isIdleAndEmpty ? (
                    <VoiceStage status={status} onStart={handleToggleSession} />
                ) : (
                    <EditorialFeed
                        transcript={transcript}
                        isSpeaking={isSpeaking}
                        status={status}
                        className="h-full"
                    />
                )}
            </main>

            {/* Floating Dock: Bottom Controls */}
            <footer className="shrink-0">
                <FloatingDock
                    status={status}
                    isSpeaking={isSpeaking}
                    elapsedSeconds={elapsedSeconds}
                    getAudioLevels={getAudioLevels}
                    onToggleSession={handleToggleSession}
                />
            </footer>
        </div>
    );
}
