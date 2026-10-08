import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Home from '../app/page';
import LoginPage from '../app/login/page';
import { redirect } from 'next/navigation';

// Mock next/navigation redirect
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Mock useAuth
const mockLoginWithGoogle = vi.fn();
const mockLogout = vi.fn();
let mockAuthState = {
  user: null as any,
  loading: false,
  loginWithGoogle: mockLoginWithGoogle,
  logout: mockLogout,
};

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

describe('Root Route Redirect (app/page.tsx)', () => {
  it('redirects to /practice', () => {
    Home();
    expect(redirect).toHaveBeenCalledWith('/practice');
  });
});

describe('French Login Page (app/login/page.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: null,
      loading: false,
      loginWithGoogle: mockLoginWithGoogle,
      logout: mockLogout,
    };
  });

  it('renders loading state with French copy', () => {
    mockAuthState.loading = true;
    render(<LoginPage />);

    expect(screen.getByText('Authentification en cours...')).toBeDefined();
  });

  it('renders unauthenticated state with French copy and Google login button', () => {
    render(<LoginPage />);

    expect(screen.getByText('Atelier Oral')).toBeDefined();
    expect(
      screen.getByText("Connexion à votre espace d'apprentissage")
    ).toBeDefined();

    const loginButton = screen.getByRole('button', { name: /Continuer avec Google/i });
    expect(loginButton).toBeDefined();

    fireEvent.click(loginButton);
    expect(mockLoginWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('renders authenticated state with user email, access button, and signout button', () => {
    mockAuthState.user = { uid: 'uid-123', email: 'rodrigo@example.com' };
    render(<LoginPage />);

    expect(screen.getByText(/Connecté en tant que/i)).toBeDefined();
    expect(screen.getByText('rodrigo@example.com')).toBeDefined();

    const accessLink = screen.getByRole('link', { name: /Accéder à l'Atelier/i });
    expect(accessLink).toBeDefined();
    expect(accessLink.getAttribute('href')).toBe('/practice');

    const logoutButton = screen.getByRole('button', { name: /Se déconnecter/i });
    expect(logoutButton).toBeDefined();

    fireEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
