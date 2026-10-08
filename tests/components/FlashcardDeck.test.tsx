import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FlashcardDeck } from '../../components/practice/FlashcardDeck';
import { Flashcard } from '../../lib/srs';

describe('FlashcardDeck component', () => {
    const mockCards: Flashcard[] = [
        {
            id: 'card-1',
            userId: 'u1',
            front: 'Bonjour',
            back: 'Hello',
            context: 'Bonjour tout le monde',
        },
        {
            id: 'card-2',
            userId: 'u1',
            front: 'Merci',
            back: 'Thank you',
            context: 'Merci beaucoup',
        },
    ];

    it('renders empty placeholder when no cards provided', () => {
        render(<FlashcardDeck flashcards={[]} onReview={vi.fn()} />);
        expect(screen.getByText('Aucune carte disponible')).toBeDefined();
    });

    it('renders loading state when loading prop is true', () => {
        render(<FlashcardDeck flashcards={mockCards} onReview={vi.fn()} loading={true} />);
        expect(screen.getByText(/Chargement des cartes/i)).toBeDefined();
    });

    it('displays first card front side and allows flipping', () => {
        render(<FlashcardDeck flashcards={mockCards} onReview={vi.fn()} />);

        expect(screen.getByText('Bonjour')).toBeDefined();
        expect(screen.getByText(/« Bonjour tout le monde »/i)).toBeDefined();
        expect(screen.getByText(/CARTE 1 SUR 2/i)).toBeDefined();

        // Reveal answer
        const flipBtn = screen.getByRole('button', { name: /Révéler la réponse/i });
        fireEvent.click(flipBtn);

        expect(screen.getByText('Hello')).toBeDefined();
        expect(screen.getByText('Difficile')).toBeDefined();
        expect(screen.getByText('Bien')).toBeDefined();
        expect(screen.getByText('Facile')).toBeDefined();
    });

    it('calls onReview with appropriate SRS rating and advances card', async () => {
        const onReview = vi.fn().mockResolvedValue(undefined);
        render(<FlashcardDeck flashcards={mockCards} onReview={onReview} />);

        // Flip card
        fireEvent.click(screen.getByRole('button', { name: /Révéler la réponse/i }));

        // Click "Bien" rating (2)
        const goodBtn = screen.getByRole('button', { name: /Bien/i });
        fireEvent.click(goodBtn);

        expect(onReview).toHaveBeenCalledWith('card-1', 2);
    });
});
