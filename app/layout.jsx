import './globals.css';

export const metadata = {
  title: 'Flux.ai Lite',
  description: 'Minimal PCB editor inspired by Flux.ai'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
