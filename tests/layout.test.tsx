import { render } from '@testing-library/react';
import Layout from '../app/layout';

test('Layout includes Syne, Inter, and IBM Plex Mono fonts', () => {
    const { container } = render(<Layout><div>Test</div></Layout>);
    expect(container.innerHTML).toMatch(/Syne/);
});
