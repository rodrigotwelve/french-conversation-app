import Layout from '../app/layout';


test('Layout includes Syne, Inter, and IBM Plex Mono fonts', () => {
    // Render Layout replacing document.documentElement or render into document
    const el = Layout({ children: <div>Test</div> });
    // In React 19 / JSX, RootLayout is a function component returning <html><body className="...">...
    expect(el.props.children.props.className).toContain('--font-inter');
    expect(el.props.children.props.className).toContain('--font-syne');
    expect(el.props.children.props.className).toContain('--font-ibm-plex-mono');
});

