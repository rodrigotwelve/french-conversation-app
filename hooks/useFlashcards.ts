'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { Flashcard, calculateNextReview } from '../lib/srs';
import { useAuth } from './useAuth';

const LOCAL_STORAGE_KEY = 'offline_flashcards';

const MOCK_INITIAL_FLASHCARDS: Flashcard[] = [
    {
        id: 'mock-1',
        userId: 'anonymous',
        front: 'Prendre le train en marche',
        back: 'To jump on the bandwagon / catch a moving train',
        context: 'Il a décidé de prendre le train en marche pour le projet B2.',
        repetitions: 0,
        intervalDays: 1,
        easeFactor: 2.5,
    },
    {
        id: 'mock-2',
        userId: 'anonymous',
        front: 'Au fur et à mesure',
        back: 'Gradually / As one goes along',
        context: 'On apprend le vocabulaire au fur et à mesure des sessions.',
        repetitions: 1,
        intervalDays: 3,
        easeFactor: 2.5,
    },
    {
        id: 'mock-3',
        userId: 'anonymous',
        front: 'Faire d’une pierre deux coups',
        back: 'To kill two birds with one stone',
        context: 'En pratiquant le français, il prépare son PVT et valide son B2.',
        repetitions: 0,
        intervalDays: 1,
        easeFactor: 2.5,
    },
];

export interface UseFlashcardsReturn {
    flashcards: Flashcard[];
    loading: boolean;
    error: string | null;
    reviewCard: (cardId: string, rating: 1 | 2 | 3) => Promise<void>;
    reloadCards: () => Promise<void>;
}

export function useFlashcards(): UseFlashcardsReturn {
    const { user, loading: authLoading } = useAuth();
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCards = useCallback(async () => {
        setLoading(true);
        setError(null);

        // 1. If user is authenticated, query Firestore
        if (user) {
            try {
                const q = query(
                    collection(db, 'flashcards'),
                    where('userId', '==', user.uid)
                );
                const querySnapshot = await getDocs(q);
                const items: Flashcard[] = [];
                querySnapshot.forEach((docSnap) => {
                    items.push({ id: docSnap.id, ...docSnap.data() } as Flashcard);
                });

                if (items.length > 0) {
                    setFlashcards(items);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
                    }
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.warn('Firestore fetch failed, falling back to local storage', err);
            }
        }

        // 2. Fallback to localStorage or mock cards
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setFlashcards(parsed);
                        setLoading(false);
                        return;
                    }
                }
            } catch {
                // ignore JSON parse error
            }
        }

        // Default mock cards for smooth offline/first-use experience
        setFlashcards(MOCK_INITIAL_FLASHCARDS);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        if (!authLoading) {
            loadCards();
        }
    }, [authLoading, loadCards]);

    const reviewCard = useCallback(
        async (cardId: string, rating: 1 | 2 | 3) => {
            const card = flashcards.find((c) => c.id === cardId);
            if (!card) return;

            const nextReview = calculateNextReview(card, rating);
            const updatedCard: Flashcard = {
                ...card,
                ...nextReview,
            };

            const nextList = flashcards.map((c) => (c.id === cardId ? updatedCard : c));
            setFlashcards(nextList);

            if (typeof window !== 'undefined') {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
            }

            if (user && !cardId.startsWith('mock-')) {
                try {
                    const cardRef = doc(db, 'flashcards', cardId);
                    await updateDoc(cardRef, nextReview);
                } catch (err) {
                    console.error('Failed to update card SRS in Firestore', err);
                }
            }
        },
        [flashcards, user]
    );

    return {
        flashcards,
        loading,
        error,
        reviewCard,
        reloadCards: loadCards,
    };
}
