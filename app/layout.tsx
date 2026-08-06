import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Editor Interactivo | Tienda',
  description: 'Fase 1 del editor interactivo estilo Zazzle'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
