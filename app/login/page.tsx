'use client';

import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { user, loading, loginWithGoogle, logout } = useAuth();

  return (
    <div className="min-h-screen bg-brand-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-display font-semibold tracking-tight text-brand-textPrimary">
          Access Control
        </h2>
        <p className="mt-2 text-center text-sm font-sans text-brand-textMuted">
          Sign in to access the system dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-brand-surface py-8 px-4 shadow-sm border border-brand-border sm:rounded-lg sm:px-10">
          {loading ? (
            <div className="flex justify-center items-center py-6 text-sm font-sans text-brand-textMuted">
              Authenticating session...
            </div>
          ) : user ? (
            <div className="space-y-4">
              <div className="text-sm font-sans text-brand-textPrimary">
                Signed in as <span className="font-mono text-xs font-medium">{user.email || user.uid}</span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full flex justify-center py-2.5 px-4 border border-brand-border rounded-md shadow-sm text-sm font-sans font-medium text-brand-textPrimary bg-brand-canvas hover:bg-brand-surface focus:outline-none transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => loginWithGoogle()}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-md shadow-sm text-sm font-sans font-medium text-white bg-brand-cta hover:opacity-90 focus:outline-none transition-opacity"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
