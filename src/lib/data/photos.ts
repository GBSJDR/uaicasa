export type PhotoCategory = 'visao_geral' | 'piscina' | 'festas' | 'suites' | 'cozinha';

export interface Photo {
  src: string;
  alt: string;
  categories: PhotoCategory[];
  w: number;
  h: number;
}

export const CATEGORY_LABELS: Record<PhotoCategory | 'todas', string> = {
  todas: 'Todas',
  visao_geral: 'Visão Geral',
  piscina: 'Área Externa / Piscina',
  festas: 'Estrutura de Festas',
  suites: 'Suítes / Quartos',
  cozinha: 'Cozinha & Gourmet',
};

export const PHOTOS: Photo[] = [
  { src: '/fotos/fachada-piscina.jpg', alt: 'Fachada da casa com deck de madeira e piscina', categories: ['visao_geral', 'piscina'], w: 3048, h: 1408 },
  { src: '/fotos/visao-geral.jpg', alt: 'Vista do alto: casa, área coberta, piscina e montanhas ao fundo', categories: ['visao_geral'], w: 3048, h: 1408 },
  { src: '/fotos/piscina.jpg', alt: 'Piscina com prainha, deck e ciprestes', categories: ['piscina', 'festas'], w: 1600, h: 1200 },
  { src: '/fotos/espaco-gourmet.jpg', alt: 'Espaço gourmet com churrasqueira, bancada de granito e muro de pedra', categories: ['festas', 'cozinha'], w: 1448, h: 1086 },
  { src: '/fotos/mesas-cadeiras.jpg', alt: 'Mesas e cadeiras para eventos junto à bancada', categories: ['festas', 'cozinha'], w: 1600, h: 1200 },
  { src: '/fotos/campo-futebol.jpg', alt: 'Campo de futebol gramado com gol', categories: ['piscina', 'festas'], w: 3048, h: 1408 },
  { src: '/fotos/cama-elastica.jpg', alt: 'Cama elástica com rede de proteção ao lado da piscina', categories: ['piscina', 'festas'], w: 1600, h: 1200 },
  { src: '/fotos/casinha-arvore.jpg', alt: 'Casinha de madeira com escada e rede de escalada', categories: ['piscina', 'festas'], w: 1600, h: 1200 },
  { src: '/fotos/pebolim.jpg', alt: 'Mesa de pebolim na área coberta', categories: ['festas'], w: 1600, h: 1200 },
  { src: '/fotos/suite.jpg', alt: 'Suíte com cama de casal, ar-condicionado e janela panorâmica', categories: ['suites'], w: 655, h: 1600 },
  { src: '/fotos/vista-suite.jpg', alt: 'Vista da suíte para os ciprestes e as montanhas de São João del-Rei', categories: ['suites', 'visao_geral'], w: 1600, h: 655 },
];
