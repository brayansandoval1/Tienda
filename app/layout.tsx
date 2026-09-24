import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RegaloLab | Regalos personalizados en 3D',
  description: 'Diseña regalos únicos, revísalos en 3D y pídelo en minutos.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
