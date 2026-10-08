'use client';

import React from 'react';
import { Mic, RotateCcw } from 'lucide-react';
import { LiveSessionStatus } from '@/hooks/useLiveSession';

interface VoiceStageProps {
    status: LiveSessionStatus;
    onStart: () => void;
}

export function VoiceStage({ status, onStart }: VoiceStageProps) {
    const isConnecting = status === 'connecting';

    return (
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-lg mx-auto py-12 px-4 text-center select-none">
            {/* Concentric SVG rings & central microphone button */}
            <div className="relative flex items-center justify-center w-72 h-72 mb-8 group">
                {/* Outermost ring */}
                <div
                    className={`absolute inset-0 rounded-full border border-zinc-200 transition-transform duration-700 pointer-events-none ${
                        isConnecting
                            ? 'scale-110 border-zinc-400 animate-ping opacity-25'
                            : 'scale-100 group-hover:scale-105 opacity-60'
                    }`}
                />

                {/* Middle ring */}
                <div
                    className={`absolute inset-6 rounded-full border border-zinc-300 transition-transform duration-500 pointer-events-none ${
                        isConnecting
                            ? 'scale-105 border-zinc-400 animate-pulse opacity-40'
                            : 'scale-100 group-hover:scale-102 opacity-70'
                    }`}
                />

                {/* Inner ring */}
                <div
                    className={`absolute inset-12 rounded-full border border-zinc-300 transition-all duration-300 pointer-events-none ${
                        isConnecting ? 'border-zinc-500 opacity-60' : 'group-hover:border-zinc-400 opacity-80'
                    }`}
                />

                {/* Primary round microphone button */}
                <button
                    type="button"
                    onClick={onStart}
                    disabled={isConnecting}
                    aria-label={isConnecting ? 'Connexion en cours' : 'Démarrer la session orale'}
                    className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-md cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 ${
                        isConnecting
                            ? 'bg-zinc-800 text-zinc-300 scale-95'
                            : 'bg-brand-cta text-white hover:bg-zinc-800 hover:scale-105 active:scale-95'
                    }`}
                >
                    {isConnecting ? (
                        <RotateCcw className="w-8 h-8 animate-spin stroke-[2]" />
                    ) : (
                        <Mic className="w-8 h-8 stroke-[2]" />
                    )}
                </button>
            </div>

            {/* Status texts in French */}
            <div className="space-y-2 max-w-sm">
                <h2 className="font-display text-xl font-medium text-brand-textPrimary tracking-tight">
                    {isConnecting ? 'Connexion au tuteur IA...' : 'Prêt pour la pratique orale'}
                </h2>
                <p className="font-sans text-sm text-brand-textMuted leading-relaxed">
                    {isConnecting
                        ? 'Initialisation du flux audio bidirectionnel à 16kHz.'
                        : 'Cliquez sur le microphone pour démarrer une conversation spontanée en français.'}
                </p>
            </div>
        </div>
    );
}
