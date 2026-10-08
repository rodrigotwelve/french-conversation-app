'use client';

import React, { useEffect, useRef } from 'react';
import { LiveTranscriptItem, LiveSessionStatus } from '@/hooks/useLiveSession';
import { Sparkles } from 'lucide-react';

interface EditorialFeedProps {
    transcript: LiveTranscriptItem[];
    isSpeaking?: boolean;
    status?: LiveSessionStatus;
    className?: string;
}

export function EditorialFeed({
    transcript,
    isSpeaking = false,
    status = 'live',
    className = '',
}: EditorialFeedProps) {
    const bottomRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll to latest turn
    useEffect(() => {
        if (bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcript, isSpeaking]);

    return (
        <div
            className={`flex-1 w-full max-w-3xl mx-auto overflow-y-auto px-4 py-6 space-y-8 scroll-smooth ${className}`}
        >
            {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-brand-textMuted space-y-3 min-h-[300px]">
                    <Sparkles className="w-6 h-6 text-zinc-300 stroke-[1.5]" />
                    <p className="font-sans text-sm max-w-sm leading-relaxed text-zinc-500">
                        {status === 'connecting'
                            ? 'Établissement du canal audio...'
                            : 'Écoute active en cours. Parlez en français de vos projets, de votre quotidien ou posez une question.'}
                    </p>
                </div>
            ) : (
                transcript.map((item, index) => {
                    const isLast = index === transcript.length - 1;
                    const isModel = item.role === 'model';
                    const speakerLabel = isModel ? 'TUTEUR' : 'VOUS';
                    const timestampLabel = item.timestamp ? ` · ${item.timestamp}` : '';

                    return (
                        <article
                            key={index}
                            className={`group flex flex-col space-y-1.5 transition-opacity duration-300 ${
                                isLast ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                            }`}
                        >
                            {/* Swiss editorial margin metadata */}
                            <div className="flex items-center space-x-2 text-[11px] font-mono tracking-wider text-brand-textMuted uppercase select-none">
                                <span
                                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                                        isModel ? 'bg-zinc-900' : 'bg-zinc-400'
                                    }`}
                                />
                                <span>
                                    {speakerLabel}
                                    {timestampLabel}
                                </span>
                            </div>

                            {/* Dialogue body */}
                            <div className="pl-3.5 border-l-2 border-zinc-100 text-brand-textPrimary font-sans text-base leading-relaxed">
                                <span>{item.text}</span>
                                {isLast && (isSpeaking || isModel) && (
                                    <span
                                        className="inline-block w-1.5 h-4 ml-1.5 bg-brand-cta animate-pulse align-middle"
                                        aria-hidden="true"
                                    />
                                )}
                            </div>
                        </article>
                    );
                })
            )}
            <div ref={bottomRef} />
        </div>
    );
}
