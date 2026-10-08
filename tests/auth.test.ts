import { renderHook } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../lib/firebase', () => ({
    auth: {}
}));

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(),
    signInWithPopup: vi.fn(() => Promise.resolve({ user: { uid: 'test-123' } })),
    GoogleAuthProvider: vi.fn(),
    onAuthStateChanged: vi.fn((auth, cb) => { cb({ uid: 'test-123' }); return () => {}; })
}));

describe('useAuth hook', () => {
    it('returns logged in user upon auth state change', () => {
        const { result } = renderHook(() => useAuth());
        expect(result.current.user?.uid).toBe('test-123');
    });
});
