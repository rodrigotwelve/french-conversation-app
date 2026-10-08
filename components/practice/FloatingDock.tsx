'use client';

import React from 'react';
import { Mic, MicOff, RotateCcw } from 'lucide-react';
import { LiveSessionStatus } from '@/hooks/useLiveSession';
import { AudioLevels } from '@/hooks/useAudioPipeline';
import { WaveformCanvas } from './WaveformCanvas';

interface FloatingDockProps {
    status: LiveSessionStatus;
    isSpeaking: boolean;
    elapsedSeconds: number;
    getAudioLevels?: () => AudioLevels;
    onToggleSession: () => void;
}

function formatTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function FloatingDock({
    status,
    isSpeaking,
    elapsedSeconds,
    getAudioLevels,
    onToggleSession,
}: FloatingDockProps) {
    const isLive = status === 'live';
    const isConnecting = status === 'connecting';

    let statusLabel = 'Prêt';
    let statusDotColor = 'bg-zinc-400';

    if (isConnecting) {
        statusLabel = 'Connexion...';
        statusDotColor = 'bg-brand-warning animate-pulse';
    } else if (isLive) {
        if (isSpeaking) {
            statusLabel = 'Le tuteur parle...';
            statusDotColor = 'bg-brand-success animate-pulse';
        } else {
            statusLabel = 'En écoute';
            statusDotColor = 'bg-brand-success';
        }
    }

    return (
        <div className="w-full max-w-2xl mx-auto px-4 pb-6 select-none">
            <div className="bg-white/95 backdrop-blur-md border border-brand-border shadow-lg rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 transition-all">
                {/* Left: Status indicator badge */}
                <div className="flex items-center space-x-2.5 min-w-[140px]">
                    <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${statusDotColor}`} />
                    <span className="font-sans text-xs font-medium text-brand-textPrimary truncate">
                        {statusLabel}
                    </span>
                </div>

                {/* Center: Live Waveform & Session Timer */}
                <div className="flex items-center space-x-4">
                    <WaveformCanvas
                        getAudioLevels={getAudioLevels}
                        isLive={isLive}
                        width={130}
                        height={26}
                        className="hidden sm:block"
                    />

                    <div className="font-mono text-sm font-medium text-brand-textPrimary tracking-wider px-2 py-1 bg-zinc-100/80 rounded border border-zinc-200/60">
                        {formatTimer(elapsedSeconds)}
                    </div>
                </div>

                {/* Right: Primary Action Button */}
                <div className="flex items-center justify-end min-w-[140px]">
                    {isLive ? (
                        <button
                            type="button"
                            onClick={onToggleSession}
                            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-rose-700 text-white font-sans text-xs font-medium transition-all shadow-xs cursor-pointer group"
                        >
                            <MicOff className="w-3.5 h-3.5 stroke-[2] group-hover:rotate-12 transition-transform" />
                            <span>Terminer</span>
                        </button>
                    ) : isConnecting ? (
                        <button
                            type="button"
                            disabled
                            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-zinc-200 text-zinc-500 font-sans text-xs font-medium cursor-not-allowed"
                        >
                            <RotateCcw className="w-3.5 h-3.5 animate-spin stroke-[2]" />
                            <span>Connexion...</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onToggleSession}
                            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-cta hover:bg-zinc-800 text-white font-sans text-xs font-medium transition-all shadow-xs cursor-pointer"
                        >
                            <Mic className="w-3.5 h-3.5 stroke-[2]" />
                            <span>Démarrer</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
