'use client';

import React from 'react';
import { useLiveSession } from '@/hooks/useLiveSession';
import { Mic, MicOff, Volume2, Calendar, Flame, Sparkles } from 'lucide-react';

export default function PracticePage() {
    const { startSession, endSession, isConnected, isSpeaking, transcript } = useLiveSession();

    const handleToggleSession = async () => {
        if (isConnected) {
            endSession();
        } else {
            try {
                await startSession();
            } catch (err) {
                console.error('Failed to start session', err);
            }
        }
    };

    return (
        <div className="min-h-screen bg-brand-canvas text-brand-textPrimary flex flex-col justify-between font-sans selection:bg-zinc-200">
            {/* Header: Macro-goal & Streak */}
            <header className="border-b border-brand-border bg-brand-surface px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <span className="font-display text-xl font-medium tracking-tight">
                            Atelier Oral
                        </span>
                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded text-xs font-mono bg-zinc-200 text-brand-textPrimary">
                            Niveau B2
                        </span>
                    </div>

                    <div className="flex items-center space-x-6">
                        {/* Macro Goal Info */}
                        <div className="flex items-center space-x-2 text-xs font-mono text-brand-textMuted">
                            <Calendar className="w-4 h-4 text-brand-textPrimary stroke-[1.75]" />
                            <span>Objectif : Avril 2027 (PVT France)</span>
                        </div>

                        {/* Streak Metric */}
                        <div className="flex items-center space-x-1.5 text-xs font-mono px-3 py-1 bg-white border border-brand-border rounded-md shadow-xs">
                            <Flame className="w-4 h-4 text-brand-warning stroke-[1.75]" />
                            <span className="font-medium text-brand-textPrimary">14 JOURS</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area: Single-viewport orientation */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col space-y-6">
                {/* Status indicator banner */}
                <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-brand-border bg-brand-surface">
                    <div className="flex items-center space-x-3">
                        <div
                            className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                isConnected
                                    ? isSpeaking
                                        ? 'bg-brand-success animate-pulse'
                                        : 'bg-brand-success'
                                    : 'bg-zinc-400'
                            }`}
                        />
                        <span className="text-sm font-sans text-brand-textMuted">
                            {isConnected
                                ? isSpeaking
                                    ? 'Le tuteur parle...'
                                    : 'En écoute active — parlez librement'
                                : 'Session inactive. Prêt pour la conversation.'}
                        </span>
                    </div>

                    {isSpeaking && (
                        <div className="flex items-center space-x-1 text-xs font-mono text-brand-success">
                            <Volume2 className="w-4 h-4 stroke-[1.75]" />
                            <span>Audio actif</span>
                        </div>
                    )}
                </div>

                {/* Conversation Transcription View */}
                <div className="flex-1 min-h-[360px] max-h-[500px] overflow-y-auto border border-brand-border rounded-lg p-5 bg-white flex flex-col space-y-4">
                    {transcript.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-brand-textMuted space-y-3">
                            <Sparkles className="w-8 h-8 text-zinc-300 stroke-[1.5]" />
                            <p className="text-sm font-sans max-w-sm">
                                Cliquez sur le bouton ci-dessous pour lancer la session en direct avec votre tuteur natif IA.
                            </p>
                        </div>
                    ) : (
                        transcript.map((item, index) => (
                            <div
                                key={index}
                                className={`flex flex-col ${
                                    item.role === 'user' ? 'items-end' : 'items-start'
                                }`}
                            >
                                <div className="text-[11px] font-mono text-brand-textMuted uppercase mb-1">
                                    {item.role === 'user' ? 'Vous' : 'Tuteur Gemini'}
                                </div>
                                <div
                                    className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm font-sans leading-relaxed ${
                                        item.role === 'user'
                                            ? 'bg-brand-cta text-white'
                                            : 'bg-brand-surface border border-brand-border text-brand-textPrimary'
                                    }`}
                                >
                                    {item.text}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Controls */}
                <div className="flex justify-center pt-2">
                    <button
                        type="button"
                        onClick={handleToggleSession}
                        className={`inline-flex items-center space-x-3 px-8 py-4 rounded-md font-display text-base font-medium transition-all shadow-xs cursor-pointer ${
                            isConnected
                                ? 'bg-brand-error hover:bg-rose-700 text-white'
                                : 'bg-brand-cta hover:bg-zinc-800 text-white'
                        }`}
                    >
                        {isConnected ? (
                            <>
                                <MicOff className="w-5 h-5 stroke-[2]" />
                                <span>Arrêter la session</span>
                            </>
                        ) : (
                            <>
                                <Mic className="w-5 h-5 stroke-[2]" />
                                <span>Démarrer la conversation</span>
                            </>
                        )}
                    </button>
                </div>
            </main>

            {/* Subtle Footer */}
            <footer className="border-t border-brand-border py-3 text-center text-xs font-mono text-brand-textMuted bg-brand-surface">
                Session bidirectionnelle Gemini 2.0 Flash • Fréquence 16kHz / 24kHz PCM
            </footer>
        </div>
    );
}
