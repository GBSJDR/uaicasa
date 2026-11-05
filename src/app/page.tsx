import Image from 'next/image';
import BookingWidget from '@/components/BookingWidget';
import Gallery from '@/components/Gallery';
import SiteHeader, { Logo, waHref } from '@/components/SiteHeader';
import { brl } from '@/lib/domain/pricing';
import { PROPERTY, RULES } from '@/lib/data/demo';

const STAY_FEATURES = [
  ['🛏️', 'Suítes com ar-condicionado', 'Janelas panorâmicas para os ciprestes e a serra'],
  ['🏊', 'Piscina com cerca infantil', 'Deck de madeira e prainha para as crianças'],
  ['🍖', 'Espaço gourmet', 'Churrasqueira, bancada em granito, pia e forno'],
  ['⚽', 'Campo gramado', 'Com gol e alambrado — pelada garantida'],
  ['🤸', 'Área kids', 'Cama elástica, casinha de madeira e rede de escalada'],
  ['☀️', 'Energia solar', 'Casa sustentável, com fibra óptica'],
];

const EVENT_FEATURES = [
  `Até ${PROPERTY.maxGuestsEvent} convidados`,
  'Área coberta com muro de pedra e iluminação',
  'Mesas e cadeiras incluídas',
  'Churrasqueira e bancada para buffet',
  'Pebolim, cama elástica e campo',
  `Som liberado até as ${PROPERTY.loudMusicUntil}`,
];

const ADDRESS_Q = encodeURIComponent('Rua João Paulo II, 2, Colônia do Marçal, São João del-Rei - MG');

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="relative isolate">
        <SiteHeader transparent />
        <div className="absolute inset-0 -z-10">
          <Image src="/fotos/fachada-piscina.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-serra-escuro/80 via-serra-escuro/50 to-creme" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-28 sm:pt-36">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-white/80">
            São João del-Rei • Minas Gerais
          </p>
          <h1 className="max-w-3xl font-display text-4xl leading-tight text-white sm:text-6xl">
            Sua casa em Minas, com piscina, quintal e vista pra serra.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Hospede a família ou celebre com os amigos. Reserva direta, sem taxas de aplicativo, com PIX e
            contrato na hora.
          </p>
          <div className="mt-8" id="reservar">
            <BookingWidget />
          </div>
        </div>
      </section>

      {/* NÚMEROS */}
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-10 sm:grid-cols-4">
        {[
          [`${PROPERTY.maxGuestsStay}`, 'hóspedes'],
          [`${PROPERTY.maxGuestsEvent}`, 'convidados em festas'],
          [`a partir de ${brl(RULES.stay.basePriceCents).replace(',00', '')}`, 'a diária'],
          ['PIX', 'confirmação na hora'],
        ].map(([n, l]) => (
          <div key={l} className="rounded-2xl bg-white p-5 ring-1 ring-areia">
            <p className="font-display text-2xl text-serra-escuro sm:text-3xl">{n}</p>
            <p className="text-sm text-musgo">{l}</p>
          </div>
        ))}
      </section>

      {/* ESTRUTURA */}
      <section id="estrutura" className="bg-pedra-textura py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl text-serra-escuro sm:text-4xl">Espaço pra todo mundo, uai.</h2>
          <p className="mt-2 max-w-2xl text-musgo">
            Uma casa ampla na Colônia do Marçal, cercada por ciprestes, com tudo pronto para dias de descanso ou de festa.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STAY_FEATURES.map(([icon, title, text]) => (
              <div key={title} className="rounded-2xl bg-white/90 p-5 shadow-sm">
                <span className="text-2xl">{icon}</span>
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="text-sm text-musgo">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALERIA */}
      <section id="galeria" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-6 font-display text-3xl text-serra-escuro sm:text-4xl">Conheça a casa</h2>
        <Gallery />
      </section>

      {/* EVENTOS */}
      <section id="eventos" className="bg-serra-escuro py-16 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image src="/fotos/espaco-gourmet.jpg" alt="Espaço gourmet com churrasqueira iluminado" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-terra">Festas & eventos</p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl">Aniversário, confraternização, chá revelação…</h2>
            <p className="mt-3 text-white/80">
              Alugue a área externa por um dia inteiro ({PROPERTY.eventStartTime}–{PROPERTY.eventEndTime}). Valor a partir de{' '}
              <strong>{brl(RULES.event.basePriceCents)}</strong> com {RULES.event.includedGuests} convidados inclusos.
            </p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {EVENT_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm"><span className="text-terra">✔</span>{f}</li>
              ))}
            </ul>
            <a href="#reservar" className="focus-ring mt-8 inline-block rounded-xl bg-terra px-6 py-3 font-semibold hover:bg-terra-escuro">
              Ver datas para festas
            </a>
          </div>
        </div>
      </section>

      {/* REGRAS */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
        {[
          ['Hospedagem', [`Check-in ${PROPERTY.checkinTime} • Check-out ${PROPERTY.checkoutTime}`, `Mínimo de ${PROPERTY.defaultMinNights} diárias (feriados podem exigir pacote)`, 'Silêncio das 22h às 8h']],
          ['Eventos', [`Reserva com ${PROPERTY.eventMinLeadDays} dias de antecedência`, `Som alto até ${PROPERTY.loudMusicUntil}`, 'Sem vidro na área da piscina']],
          ['Pagamento', ['50% de sinal via PIX na reserva', 'Saldo até a entrada', 'Caução reembolsável após vistoria']],
        ].map(([title, items]) => (
          <div key={title as string} className="rounded-2xl border border-areia p-6">
            <h3 className="font-display text-xl text-serra-escuro">{title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-musgo">
              {(items as string[]).map((i) => <li key={i}>• {i}</li>)}
            </ul>
          </div>
        ))}
      </section>

      {/* LOCALIZAÇÃO */}
      <section id="localizacao" className="bg-pedra-textura py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-3xl text-serra-escuro sm:text-4xl">Onde fica</h2>
            <p className="mt-3 text-lg">Rua João Paulo II, nº 2<br />Colônia do Marçal — São João del-Rei/MG</p>
            <ul className="mt-6 space-y-2 text-sm text-musgo">
              <li>🏛️ Centro histórico de São João del-Rei</li>
              <li>🚂 Maria Fumaça para Tiradentes</li>
              <li>⛰️ Trilhas da Serra do Lenheiro</li>
            </ul>
            <a href={`https://maps.google.com/?q=${ADDRESS_Q}`} target="_blank" rel="noopener" className="focus-ring mt-6 inline-block rounded-xl bg-serra px-5 py-3 font-medium text-white hover:bg-serra-escuro">
              Abrir no Google Maps
            </a>
          </div>
          <iframe
            title="Mapa da UaiCasa"
            src={`https://maps.google.com/maps?q=${ADDRESS_Q}&z=15&output=embed`}
            className="h-80 w-full rounded-2xl border-0 lg:h-full"
            loading="lazy"
          />
        </div>
      </section>

      <footer className="bg-tinta py-10 text-sm text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo light />
          <p>uaicasa.com.br • Reserva direta com o proprietário</p>
          <a href={waHref()} className="text-white hover:underline" target="_blank" rel="noopener">Fale no WhatsApp →</a>
        </div>
      </footer>
    </main>
  );
}
