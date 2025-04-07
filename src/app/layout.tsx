import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, Playfair_Display } from 'next/font/google';
import "./globals.css";
import React from 'react';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Sales Trainer",
  description: "Sales Trainer by Wizy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.className} ${playfair.className} antialiased relative`}
      >
        {children}
        <footer className="absolute bottom-4 left-0 right-0 pointer-events-none">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex justify-center items-center">
            <p className="text-base md:text-lg text-zinc-500">
              Designed by{' '}
              <a
                href="https://twitter.com/MAliyanIshfaq"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-violet-400 hover:text-violet-600 transition-colors pointer-events-auto"
              >
                MAliyanIshfaq
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
