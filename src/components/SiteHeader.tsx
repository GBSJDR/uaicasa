import Link from 'next/link';

export const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP ?? '5532999999999').replace(/\D/g, '');
export const waHref = (text = 'Olá! Vim pelo site da UaiCasa e gostaria de mais informações.') =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/uaicasa-simbolo.svg" alt="" width={36} height={36} className="h-9 w-9" />
      <span className={`font-display text-2xl font-semibold tracking-tight ${light ? 'text-white' : 'text-serra-escuro'}`}>
        Uai<span className={light ? 'text-[#e08a5f]' : 'text-terra'}>Casa</span>
      </span>
    </span>
  );
}

export default function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  return (
    <header className={`${transparent ? 'absolute inset-x-0 top-0 z-20' : 'border-b border-areia bg-creme'}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="focus-ring rounded">
          <Logo light={transparent} />
        </Link>
        <nav className={`hidden gap-6 text-sm md:flex ${transparent ? 'text-white/90' : 'text-musgo'}`}>
          <a href="/#galeria" className="hover:underline">Fotos</a>
          <a href="/#estrutura" className="hover:underline">Estrutura</a>
          <a href="/#eventos" className="hover:underline">Festas</a>
          <a href="/#localizacao" className="hover:underline">Localização</a>
        </nav>
        <a
          href={waHref()}
          target="_blank"
          rel="noopener"
          className={`focus-ring rounded-full px-4 py-2 text-sm font-medium ${
            transparent ? 'bg-white/15 text-white ring-1 ring-white/40 backdrop-blur hover:bg-white/25' : 'bg-serra text-white hover:bg-serra-escuro'
          }`}
        >
          WhatsApp
        </a>
      </div>
    </header>
  );
}
