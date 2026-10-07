import type { Metadata } from 'next';
import './globals.css';
import { Storefront } from '@/components/storefront';

export const metadata: Metadata = { title: 'Seyora — Thoughtfully made, beautifully yours', description: 'Discover thoughtfully handcrafted pieces, made with creativity, care and a little bit of magic.', openGraph: { title: 'Seyora — Made by hand, made to feel special', description: 'Handcrafted objects for a home with soul.', type: 'website' } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Storefront>{children}</Storefront></body></html>; }
