import { render } from '@testing-library/react';
import Layout from '../app/layout';

test('Layout includes Syne, Inter, and IBM Plex Mono fonts', () => {
    render(<Layout><div>Test</div></Layout>);
    expect(document.body.className).toContain('--font-inter');
    expect(document.body.className).toContain('--font-syne');
    expect(document.body.className).toContain('--font-ibm-plex-mono');
});

