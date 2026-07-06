import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Doreham 도레함 — small adventures, real friends',
  description:
    'Doreham is a friendship app for immigrants and international residents in Korea. Small groups, real venues, real connection. Persian for the gathering of friends together.',
  openGraph: {
    title: 'Doreham 도레함',
    description: 'Small adventures, real friends. Coming soon to 아산.',
    url: 'https://doreham.co.kr',
    siteName: 'Doreham',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body data-lang="en">{children}</body>
    </html>
  );
}
