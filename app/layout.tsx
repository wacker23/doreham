import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Doreham - Small adventures, Real friends',
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
      <body data-lang="en">
        <Script
          src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
