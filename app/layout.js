import './globals.css';

export const metadata = {
  title: 'Araç İletişim',
  description: 'Araç sürücüsü iletişim sayfası',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
