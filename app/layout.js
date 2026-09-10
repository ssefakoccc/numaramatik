import './globals.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#030712',
};

export const metadata = {
  title: 'Numaratik • Akıllı Araç İletişim',
  description: 'Akıllı QR Araç İletişim ve Güvenlik Sistemi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-[#030712] text-gray-100 antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
