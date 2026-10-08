'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export interface UserProgress {
  currentStreak: number;
  lastPracticeDate: string; // "YYYY-MM-DD"
  totalMinutesSpoken: number;
  targetLevel: string; // e.g. "B2"
  targetDeadline: string; // e.g. "Avril 2027"
}

export interface UseUserProgressReturn {
  progress: UserProgress;
  recordSessionCompletion: (minutesSpoken: number) => Promise<void>;
  loading: boolean;
}

export const DEFAULT_PROGRESS: UserProgress = {
  currentStreak: 0,
  lastPracticeDate: '',
  totalMinutesSpoken: 0,
  targetLevel: 'B2',
  targetDeadline: 'Avril 2027',
};

const STORAGE_KEY = 'user_progress';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function useUserProgress(): UseUserProgressReturn {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<UserProgress>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { ...DEFAULT_PROGRESS, ...JSON.parse(stored) };
        }
      } catch {
        // ignore parse error
      }
    }
    return DEFAULT_PROGRESS;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProgress() {
      if (authLoading) return;

      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userRef);

          if (docSnap.exists() && isMounted) {
            const data = docSnap.data() as Partial<UserProgress>;
            const syncedProgress: UserProgress = {
              ...DEFAULT_PROGRESS,
              ...data,
            };
            setProgress(syncedProgress);
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedProgress));
            }
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Failed to fetch user progress from Firestore, falling back to local storage', err);
        }
      }

      // Guest / offline fallback
      if (typeof window !== 'undefined' && isMounted) {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setProgress({ ...DEFAULT_PROGRESS, ...JSON.parse(stored) });
          } else {
            setProgress(DEFAULT_PROGRESS);
          }
        } catch {
          setProgress(DEFAULT_PROGRESS);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    }

    loadProgress();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  const recordSessionCompletion = useCallback(
    async (minutesSpoken: number) => {
      const today = getTodayString();
      const yesterday = getYesterdayString();

      let newStreak = 1;
      if (progress.lastPracticeDate === today) {
        newStreak = progress.currentStreak > 0 ? progress.currentStreak : 1;
      } else if (progress.lastPracticeDate === yesterday) {
        newStreak = progress.currentStreak + 1;
      } else {
        // empty or older than yesterday
        newStreak = 1;
      }

      const newProgress: UserProgress = {
        ...progress,
        currentStreak: newStreak,
        lastPracticeDate: today,
        totalMinutesSpoken: progress.totalMinutesSpoken + minutesSpoken,
      };

      setProgress(newProgress);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
        } catch (err) {
          console.error('Failed to save progress to localStorage', err);
        }
      }

      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, newProgress, { merge: true });
        } catch (err) {
          console.error('Failed to sync progress to Firestore', err);
        }
      }
    },
    [progress, user]
  );

  return {
    progress,
    recordSessionCompletion,
    loading,
  };
}
