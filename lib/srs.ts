export interface Flashcard {
    id: string;
    userId: string;
    front: string;
    back: string;
    context?: string;
    createdAt?: string;
    // SRS attributes (SM-2 lite)
    repetitions?: number;
    intervalDays?: number;
    easeFactor?: number;
    nextReviewDate?: string; // YYYY-MM-DD
}

export interface ReviewRating {
    // 1: Hard, 2: Good, 3: Easy
    rating: 1 | 2 | 3;
}

export function calculateNextReview(
    card: Flashcard,
    rating: 1 | 2 | 3,
    today = new Date().toISOString().split('T')[0]
): { repetitions: number; intervalDays: number; easeFactor: number; nextReviewDate: string } {
    let reps = card.repetitions || 0;
    let interval = card.intervalDays || 1;
    let ease = card.easeFactor || 2.5;

    if (rating === 1) {
        // Hard / Reset
        reps = 0;
        interval = 1;
        ease = Math.max(1.3, ease - 0.2);
    } else if (rating === 2) {
        // Good
        if (reps === 0) {
            interval = 1;
        } else if (reps === 1) {
            interval = 3;
        } else {
            interval = Math.round(interval * ease);
        }
        reps += 1;
    } else {
        // Easy (3)
        if (reps === 0) {
            interval = 2;
        } else if (reps === 1) {
            interval = 4;
        } else {
            interval = Math.round(interval * ease * 1.3);
        }
        reps += 1;
        ease += 0.15;
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    const nextReviewDate = nextDate.toISOString().split('T')[0];

    return {
        repetitions: reps,
        intervalDays: interval,
        easeFactor: Number(ease.toFixed(2)),
        nextReviewDate,
    };
}
