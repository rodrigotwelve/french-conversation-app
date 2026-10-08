'use client';

import React, { useState } from 'react';
import { Flashcard } from '@/lib/srs';
import { RotateCw, Check, ArrowRight, BookOpen, Layers } from 'lucide-react';

interface FlashcardDeckProps {
    flashcards: Flashcard[];
    onReview: (cardId: string, rating: 1 | 2 | 3) => Promise<void>;
    loading?: boolean;
}

export function FlashcardDeck({ flashcards, onReview, loading }: FlashcardDeckProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewedCount, setReviewedCount] = useState(0);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-brand-textMuted">
                <div className="w-8 h-8 border-2 border-brand-border border-t-brand-textPrimary rounded-full animate-spin mb-4" />
                <p className="font-mono text-xs uppercase tracking-wider">Chargement des cartes...</p>
            </div>
        );
    }

    if (!flashcards || flashcards.length === 0) {
        return (
            <div className="border border-dashed border-brand-border p-12 text-center rounded-lg bg-brand-surface/40 max-w-md mx-auto">
                <BookOpen className="w-8 h-8 text-brand-textMuted mx-auto mb-3" />
                <h3 className="font-display text-lg font-medium text-brand-textPrimary mb-1">
                    Aucune carte disponible
                </h3>
                <p className="text-xs text-brand-textMuted font-sans leading-relaxed">
                    Complétez une session de conversation orale pour générer automatiquement vos premières fiches de révision SRS.
                </p>
            </div>
        );
    }

    const currentCard = flashcards[currentIndex % flashcards.length];
    const isCompleted = reviewedCount >= flashcards.length;

    const handleRating = async (rating: 1 | 2 | 3) => {
        await onReview(currentCard.id, rating);
        setIsFlipped(false);
        setReviewedCount((prev) => prev + 1);
        setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setReviewedCount(0);
    };

    if (isCompleted) {
        return (
            <div className="border border-brand-border bg-brand-surface p-8 rounded-lg max-w-md mx-auto text-center shadow-xs">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="font-display text-xl font-medium text-brand-textPrimary mb-2">
                    Session de révision terminée !
                </h3>
                <p className="text-xs text-brand-textMuted font-sans mb-6">
                    Vous avez révisé {flashcards.length} cartes de vocabulaire. Le système espacé (SRS) a ajusté les prochaines dates d'entraînement.
                </p>
                <button
                    type="button"
                    onClick={handleRestart}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-textPrimary text-brand-canvas text-xs font-mono uppercase tracking-wider rounded-md hover:bg-black transition-colors cursor-pointer"
                >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Recommencer la série</span>
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-lg mx-auto flex flex-col items-center">
            {/* Progress counter */}
            <div className="w-full flex items-center justify-between text-xs font-mono text-brand-textMuted mb-3 px-1">
                <div className="flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>CARTE {currentIndex + 1} SUR {flashcards.length}</span>
                </div>
                <div>
                    <span>{Math.round((reviewedCount / flashcards.length) * 100)}% complété</span>
                </div>
            </div>

            {/* Flashcard container */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => setIsFlipped(!isFlipped)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        setIsFlipped(!isFlipped);
                    }
                }}
                className="w-full min-h-[260px] p-8 bg-brand-surface border border-brand-border rounded-xl shadow-xs flex flex-col justify-between cursor-pointer hover:border-zinc-400 transition-all select-none group"
            >
                <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-100 text-brand-textMuted">
                        {isFlipped ? 'Définition / Traduction' : 'Expression Française'}
                    </span>
                    <span className="text-xs text-brand-textMuted group-hover:text-brand-textPrimary transition-colors flex items-center space-x-1 font-mono">
                        <RotateCw className="w-3 h-3" />
                        <span>Cliquez pour retourner</span>
                    </span>
                </div>

                <div className="my-6 text-center">
                    <h4 className="font-display text-2xl font-medium text-brand-textPrimary leading-snug">
                        {isFlipped ? currentCard.back : currentCard.front}
                    </h4>
                    {currentCard.context && !isFlipped && (
                        <p className="mt-3 text-xs text-brand-textMuted font-sans italic max-w-md mx-auto">
                            « {currentCard.context} »
                        </p>
                    )}
                </div>

                <div className="text-center">
                    <span className="text-[11px] font-mono text-zinc-400">
                        {isFlipped ? 'Évaluez votre rappel ci-dessous' : 'Espace ou Clic pour voir la réponse'}
                    </span>
                </div>
            </div>

            {/* SRS Action Buttons */}
            {isFlipped ? (
                <div className="w-full grid grid-cols-3 gap-3 mt-4">
                    <button
                        type="button"
                        onClick={() => handleRating(1)}
                        className="py-2.5 px-3 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 text-rose-900 text-xs font-mono flex flex-col items-center justify-center transition-colors cursor-pointer"
                    >
                        <span className="font-medium">Difficile</span>
                        <span className="text-[10px] text-rose-700 font-mono mt-0.5">Demain (1j)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleRating(2)}
                        className="py-2.5 px-3 rounded-lg border border-brand-border bg-white hover:bg-zinc-100 text-brand-textPrimary text-xs font-mono flex flex-col items-center justify-center transition-colors cursor-pointer"
                    >
                        <span className="font-medium">Bien</span>
                        <span className="text-[10px] text-brand-textMuted font-mono mt-0.5">+3 jours</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleRating(3)}
                        className="py-2.5 px-3 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 text-xs font-mono flex flex-col items-center justify-center transition-colors cursor-pointer"
                    >
                        <span className="font-medium">Facile</span>
                        <span className="text-[10px] text-emerald-700 font-mono mt-0.5">+4-7 jours</span>
                    </button>
                </div>
            ) : (
                <div className="w-full mt-4 flex justify-center">
                    <button
                        type="button"
                        onClick={() => setIsFlipped(true)}
                        className="px-6 py-2.5 rounded-lg border border-brand-border bg-white hover:bg-zinc-50 text-brand-textPrimary text-xs font-mono uppercase tracking-wider flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                        <span>Révéler la réponse</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
