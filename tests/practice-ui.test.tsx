import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceStage } from '../components/practice/VoiceStage';
import { EditorialFeed } from '../components/practice/EditorialFeed';
import { FloatingDock } from '../components/practice/FloatingDock';
import { WaveformCanvas } from '../components/practice/WaveformCanvas';
import PracticePage from '../app/practice/page';

// Mock hooks
const mockStartSession = vi.fn();
const mockEndSession = vi.fn();
let mockLiveSessionState = {
    startSession: mockStartSession,
    endSession: mockEndSession,
    status: 'idle' as const,
    error: null as string | null,
    elapsedSeconds: 0,
    isConnected: false,
    isSpeaking: false,
    transcript: [] as Array<{ role: 'user' | 'model'; text: string; timestamp?: string }>,
    getAudioLevels: () => ({
        inputLevel: 0,
        outputLevel: 0,
        timeDomainData: new Uint8Array(128).fill(128),
    }),
};

const mockRecordSessionCompletion = vi.fn();
let mockProgressState = {
    progress: {
        currentStreak: 5,
        lastPracticeDate: '2026-10-08',
        totalMinutesSpoken: 45,
        targetLevel: 'B2',
        targetDeadline: 'Avril 2027',
    },
    recordSessionCompletion: mockRecordSessionCompletion,
    loading: false,
};

let mockAuthState = {
    user: { uid: 'test-user-123' } as any,
    loading: false,
};

vi.mock('../hooks/useLiveSession', () => ({
    useLiveSession: () => mockLiveSessionState,
}));

vi.mock('../hooks/useUserProgress', () => ({
    useUserProgress: () => mockProgressState,
}));

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => mockAuthState,
}));

describe('Practice UI Components', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLiveSessionState = {
            startSession: mockStartSession,
            endSession: mockEndSession,
            status: 'idle',
            error: null,
            elapsedSeconds: 0,
            isConnected: false,
            isSpeaking: false,
            transcript: [],
            getAudioLevels: () => ({
                inputLevel: 0,
                outputLevel: 0,
                timeDomainData: new Uint8Array(128).fill(128),
            }),
        };
        mockProgressState = {
            progress: {
                currentStreak: 5,
                lastPracticeDate: '2026-10-08',
                totalMinutesSpoken: 45,
                targetLevel: 'B2',
                targetDeadline: 'Avril 2027',
            },
            recordSessionCompletion: mockRecordSessionCompletion,
            loading: false,
        };
    });

    describe('VoiceStage component', () => {
        it('renders idle state with French copy and mic button', () => {
            const onStart = vi.fn();
            render(<VoiceStage status="idle" onStart={onStart} />);

            expect(screen.getByText('Prêt pour la pratique orale')).toBeDefined();
            expect(
                screen.getByText(/Cliquez sur le microphone pour démarrer une conversation/i)
            ).toBeDefined();

            const button = screen.getByRole('button', { name: /Démarrer la session orale/i });
            expect(button).toBeDefined();

            fireEvent.click(button);
            expect(onStart).toHaveBeenCalledTimes(1);
        });

        it('renders connecting state with disabled spinner', () => {
            const onStart = vi.fn();
            render(<VoiceStage status="connecting" onStart={onStart} />);

            expect(screen.getByText('Connexion au tuteur IA...')).toBeDefined();
            const button = screen.getByRole('button', { name: /Connexion en cours/i });
            expect(button.hasAttribute('disabled')).toBe(true);
        });
    });

    describe('EditorialFeed component', () => {
        it('renders empty state placeholder when no transcript', () => {
            render(<EditorialFeed transcript={[]} status="live" />);
            expect(screen.getByText(/Écoute active en cours/i)).toBeDefined();
        });

        it('renders speaker margin labels and dialogue turns', () => {
            const transcript = [
                { role: 'user' as const, text: 'Bonjour, comment allez-vous ?', timestamp: '14:30:00' },
                { role: 'model' as const, text: 'Bonjour ! Je vais très bien.', timestamp: '14:30:02' },
            ];

            render(<EditorialFeed transcript={transcript} isSpeaking={true} status="live" />);

            expect(screen.getByText(/VOUS · 14:30:00/i)).toBeDefined();
            expect(screen.getByText('Bonjour, comment allez-vous ?')).toBeDefined();
            expect(screen.getByText(/TUTEUR · 14:30:02/i)).toBeDefined();
            expect(screen.getByText('Bonjour ! Je vais très bien.')).toBeDefined();
        });
    });

    describe('FloatingDock component', () => {
        it('renders formatted timer and ready status when idle', () => {
            const onToggle = vi.fn();
            render(
                <FloatingDock
                    status="idle"
                    isSpeaking={false}
                    elapsedSeconds={125}
                    onToggleSession={onToggle}
                />
            );

            expect(screen.getByText('Prêt')).toBeDefined();
            expect(screen.getByText('02:05')).toBeDefined(); // 125s = 02:05

            const startBtn = screen.getByRole('button', { name: /Démarrer/i });
            fireEvent.click(startBtn);
            expect(onToggle).toHaveBeenCalledTimes(1);
        });

        it('renders live status and active tutor indicators when speaking', () => {
            const onToggle = vi.fn();
            render(
                <FloatingDock
                    status="live"
                    isSpeaking={true}
                    elapsedSeconds={252}
                    onToggleSession={onToggle}
                />
            );

            expect(screen.getByText('Le tuteur parle...')).toBeDefined();
            expect(screen.getByText('04:12')).toBeDefined(); // 252s = 04:12

            const endBtn = screen.getByRole('button', { name: /Terminer/i });
            fireEvent.click(endBtn);
            expect(onToggle).toHaveBeenCalledTimes(1);
        });
    });

    describe('WaveformCanvas component', () => {
        it('mounts canvas element without crashing', () => {
            const { container } = render(
                <WaveformCanvas
                    getAudioLevels={() => ({
                        inputLevel: 0.5,
                        outputLevel: 0.2,
                        timeDomainData: new Uint8Array(128).fill(140),
                    })}
                    isLive={true}
                />
            );

            const canvas = container.querySelector('canvas');
            expect(canvas).toBeDefined();
            expect(canvas?.getAttribute('aria-label')).toBe('Visualiseur audio');
        });
    });

    describe('PracticePage full integration', () => {
        it('renders Swiss editorial header with level B2, goal, and streak badge', () => {
            render(<PracticePage />);

            expect(screen.getByText('Atelier Oral')).toBeDefined();
            expect(screen.getByText('Niveau B2')).toBeDefined();
            expect(screen.getByText(/Objectif : Avril 2027 \(PVT France\)/i)).toBeDefined();
            expect(screen.getByText('5 JOURS')).toBeDefined();
        });

        it('renders single day streak without plural JOURS when streak is 1', () => {
            mockProgressState.progress.currentStreak = 1;
            render(<PracticePage />);

            expect(screen.getByText('1 JOUR')).toBeDefined();
        });

        it('displays error banner when live session returns an error', () => {
            mockLiveSessionState.error = 'Microphone permission denied';
            render(<PracticePage />);

            expect(screen.getByText('Microphone permission denied')).toBeDefined();
            expect(screen.getByText('Réessayer')).toBeDefined();
        });

        it('transitions from VoiceStage to EditorialFeed when session is live or has transcript', () => {
            const { rerender } = render(<PracticePage />);
            expect(screen.getByText('Prêt pour la pratique orale')).toBeDefined();

            mockLiveSessionState.status = 'live';
            mockLiveSessionState.isConnected = true;
            mockLiveSessionState.transcript = [
                { role: 'user', text: 'Salut !', timestamp: '12:00:00' },
            ];

            rerender(<PracticePage />);
            expect(screen.queryByText('Prêt pour la pratique orale')).toBeNull();
            expect(screen.getByText('Salut !')).toBeDefined();
        });

        it('records progress and triggers session processing on session completion', async () => {
            const mockFetch = vi.fn().mockResolvedValue({ ok: true });
            global.fetch = mockFetch as any;
            (globalThis as any).fetch = mockFetch;
            if (typeof window !== 'undefined') {
                (window as any).fetch = mockFetch;
            }

            mockLiveSessionState.status = 'live';
            mockLiveSessionState.isConnected = true;
            mockLiveSessionState.elapsedSeconds = 120; // 2 minutes
            mockLiveSessionState.transcript = [
                { role: 'user', text: 'Je suis allé au marché hier.', timestamp: '12:00:00' },
                { role: 'model', text: 'Excellent, qu’avez-vous acheté ?', timestamp: '12:00:03' },
            ];

            const { unmount } = render(<PracticePage />);
            const endBtn = screen.getByRole('button', { name: /Terminer/i });
            fireEvent.click(endBtn);

            // Wait for async handleStopSession microtasks to complete
            await Promise.resolve();
            await Promise.resolve();

            expect(mockEndSession).toHaveBeenCalledTimes(1);
            expect(mockRecordSessionCompletion).toHaveBeenCalledWith(2);
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/sessions/process',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('Je suis allé au marché hier.'),
                })
            );

            unmount();
        });
    });
});
