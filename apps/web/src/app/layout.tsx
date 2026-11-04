import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlowForge AI',
  description: 'Visual workflow orchestration platform for AI-powered automation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
