import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUserProgress, UserProgress, DEFAULT_PROGRESS } from '../hooks/useUserProgress';
import { useAuth } from '../hooks/useAuth';
import { getDoc, setDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  auth: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, id) => ({ collection, id })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

describe('useUserProgress hook', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      clear: () => {
        store = {};
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    };
  })();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();

    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      loading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default progress when unauthenticated and localStorage is empty', async () => {
    const { result } = renderHook(() => useUserProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.progress).toEqual(DEFAULT_PROGRESS);
  });

  it('loads progress from localStorage if available when unauthenticated', async () => {
    const cachedProgress: UserProgress = {
      currentStreak: 5,
      lastPracticeDate: '2026-10-07',
      totalMinutesSpoken: 45,
      targetLevel: 'B2',
      targetDeadline: 'Avril 2027',
    };
    localStorageMock.setItem('user_progress', JSON.stringify(cachedProgress));

    const { result } = renderHook(() => useUserProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.progress).toEqual(cachedProgress);
  });

  it('sets currentStreak = 1 and updates lastPracticeDate to today when recording first session', async () => {
    const today = new Date().toISOString().split('T')[0];
    const { result } = renderHook(() => useUserProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.recordSessionCompletion(15);
    });

    expect(result.current.progress.currentStreak).toBe(1);
    expect(result.current.progress.lastPracticeDate).toBe(today);
    expect(result.current.progress.totalMinutesSpoken).toBe(15);

    const saved = JSON.parse(localStorageMock.getItem('user_progress') || '{}');
    expect(saved.currentStreak).toBe(1);
    expect(saved.lastPracticeDate).toBe(today);
    expect(saved.totalMinutesSpoken).toBe(15);
  });

  it('increments streak when last practice was yesterday', async () => {
    const todayDate = new Date('2026-10-08T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(todayDate);

    const yesterdayStr = '2026-10-07';
    const cachedProgress: UserProgress = {
      currentStreak: 3,
      lastPracticeDate: yesterdayStr,
      totalMinutesSpoken: 30,
      targetLevel: 'B2',
      targetDeadline: 'Avril 2027',
    };
    localStorageMock.setItem('user_progress', JSON.stringify(cachedProgress));

    const { result } = renderHook(() => useUserProgress());

    await act(async () => {
      await result.current.recordSessionCompletion(10);
    });

    expect(result.current.progress.currentStreak).toBe(4);
    expect(result.current.progress.lastPracticeDate).toBe('2026-10-08');
    expect(result.current.progress.totalMinutesSpoken).toBe(40);
  });

  it('keeps current streak unchanged when last practice was today', async () => {
    const todayDate = new Date('2026-10-08T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(todayDate);

    const todayStr = '2026-10-08';
    const cachedProgress: UserProgress = {
      currentStreak: 4,
      lastPracticeDate: todayStr,
      totalMinutesSpoken: 40,
      targetLevel: 'B2',
      targetDeadline: 'Avril 2027',
    };
    localStorageMock.setItem('user_progress', JSON.stringify(cachedProgress));

    const { result } = renderHook(() => useUserProgress());

    await act(async () => {
      await result.current.recordSessionCompletion(20);
    });

    expect(result.current.progress.currentStreak).toBe(4);
    expect(result.current.progress.lastPracticeDate).toBe('2026-10-08');
    expect(result.current.progress.totalMinutesSpoken).toBe(60);
  });

  it('resets streak to 1 when last practice was earlier than yesterday (broken streak)', async () => {
    const todayDate = new Date('2026-10-08T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(todayDate);

    const olderDateStr = '2026-10-05';
    const cachedProgress: UserProgress = {
      currentStreak: 12,
      lastPracticeDate: olderDateStr,
      totalMinutesSpoken: 120,
      targetLevel: 'B2',
      targetDeadline: 'Avril 2027',
    };
    localStorageMock.setItem('user_progress', JSON.stringify(cachedProgress));

    const { result } = renderHook(() => useUserProgress());

    await act(async () => {
      await result.current.recordSessionCompletion(15);
    });

    expect(result.current.progress.currentStreak).toBe(1);
    expect(result.current.progress.lastPracticeDate).toBe('2026-10-08');
    expect(result.current.progress.totalMinutesSpoken).toBe(135);
  });

  it('fetches progress from Firestore when user is authenticated', async () => {
    const firestoreData: UserProgress = {
      currentStreak: 7,
      lastPracticeDate: '2026-10-07',
      totalMinutesSpoken: 100,
      targetLevel: 'B2',
      targetDeadline: 'Avril 2027',
    };

    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { uid: 'user-xyz' },
      loading: false,
    });

    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true,
      data: () => firestoreData,
    });

    const { result } = renderHook(() => useUserProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.progress).toEqual(firestoreData);
    expect(localStorageMock.getItem('user_progress')).toBe(JSON.stringify(firestoreData));
  });

  it('syncs progress to Firestore when authenticated on recordSessionCompletion', async () => {
    const todayDate = new Date('2026-10-08T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(todayDate);

    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { uid: 'user-xyz' },
      loading: false,
    });

    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => false,
      data: () => null,
    });

    const { result } = renderHook(() => useUserProgress());

    await act(async () => {
      await result.current.recordSessionCompletion(25);
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 'user-xyz' }),
      {
        currentStreak: 1,
        lastPracticeDate: '2026-10-08',
        totalMinutesSpoken: 25,
        targetLevel: 'B2',
        targetDeadline: 'Avril 2027',
      },
      { merge: true }
    );
  });
});
