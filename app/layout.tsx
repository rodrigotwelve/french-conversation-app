import type { Metadata } from 'next';
import { Inter, Syne, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['300', '400'] });
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400', '500'] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-ibm-plex-mono', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'Intelligent Euclid',
  description: 'Language learning app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${syne.variable} ${ibmPlexMono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
