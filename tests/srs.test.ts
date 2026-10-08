import { describe, it, expect } from 'vitest';
import { calculateNextReview, Flashcard } from '../lib/srs';

describe('SRS (Spaced Repetition System) logic', () => {
    const baseCard: Flashcard = {
        id: '1',
        userId: 'user-1',
        front: 'La gare',
        back: 'The train station',
        context: 'Où est la gare ?',
    };

    it('calculates initial review for new card when rating is Good (2)', () => {
        const next = calculateNextReview(baseCard, 2);
        expect(next.repetitions).toBe(1);
        expect(next.intervalDays).toBe(1);
        expect(next.easeFactor).toBe(2.5);
        expect(next.nextReviewDate).toBeDefined();
    });

    it('calculates second review when rating is Good (2)', () => {
        const cardWithOneRep: Flashcard = {
            ...baseCard,
            repetitions: 1,
            intervalDays: 1,
            easeFactor: 2.5,
        };
        const next = calculateNextReview(cardWithOneRep, 2);
        expect(next.repetitions).toBe(2);
        expect(next.intervalDays).toBe(3);
        expect(next.easeFactor).toBe(2.5);
    });

    it('multiplies interval by ease factor on subsequent Good reviews', () => {
        const cardWithTwoReps: Flashcard = {
            ...baseCard,
            repetitions: 2,
            intervalDays: 3,
            easeFactor: 2.5,
        };
        const next = calculateNextReview(cardWithTwoReps, 2);
        expect(next.repetitions).toBe(3);
        expect(next.intervalDays).toBe(8); // Math.round(3 * 2.5) = 8
    });

    it('resets repetitions and sets interval to 1 on Hard rating (1)', () => {
        const matureCard: Flashcard = {
            ...baseCard,
            repetitions: 5,
            intervalDays: 20,
            easeFactor: 2.5,
        };
        const next = calculateNextReview(matureCard, 1);
        expect(next.repetitions).toBe(0);
        expect(next.intervalDays).toBe(1);
        expect(next.easeFactor).toBe(2.3); // ease decremented
    });

    it('rewards Easy rating (3) with higher interval and ease increase', () => {
        const next = calculateNextReview(baseCard, 3);
        expect(next.repetitions).toBe(1);
        expect(next.intervalDays).toBe(2);
        expect(next.easeFactor).toBe(2.65);
    });
});
