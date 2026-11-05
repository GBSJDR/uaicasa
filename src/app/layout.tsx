import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://uaicasa.com.br'),
  title: 'UaiCasa — Casa com piscina para temporada e festas em São João del-Rei',
  description:
    'Hospede-se ou faça sua festa na UaiCasa: piscina, espaço gourmet com churrasqueira, campo de futebol, área kids e vista para as montanhas de São João del-Rei/MG. Reserva direta com PIX.',
  openGraph: {
    title: 'UaiCasa — São João del-Rei/MG',
    description: 'Temporada e eventos com piscina, churrasqueira e vista para a serra.',
    images: ['/fotos/fachada-piscina.jpg'],
    locale: 'pt_BR',
    type: 'website',
  },
};

export const viewport: Viewport = { themeColor: '#2f5d50' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
