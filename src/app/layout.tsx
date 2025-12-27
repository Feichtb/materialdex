import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Materialdex - Sustainable Building Materials',
  description: 'Revit-plugin-like prototype for sustainable building material recommendations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

