import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#05070B',
};

export const metadata = {
  title: 'Numaratik • Araç Sürücüsü İletişim',
  description: 'Araç sahibiyle hızlı ve güvenli doğrudan iletişim arayüzü',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-[#05070B] text-[#F7F9FC] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
