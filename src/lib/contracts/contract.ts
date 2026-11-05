/**
 * Gerador de contrato — Locação por Temporada (Lei 8.245/91, arts. 48–50)
 * ou Termo de Uso de Espaço para Eventos. Gera cláusulas estruturadas que
 * alimentam a tela de aceite e o PDF (ver README → "Contratos e PDF").
 */
import { formatBR } from '../domain/dates';
import { brl } from '../domain/pricing';
import type { PropertyConfig, Quote } from '../domain/types';

export interface ContractParty {
  name: string;
  document: string;
  email: string;
  phone: string;
  address: string;
}

export interface Clause {
  title: string;
  text: string;
}

export interface ContractDoc {
  title: string;
  version: string;
  clauses: Clause[];
}

const LANDLORD = 'UaiCasa — Rua João Paulo II, nº 2, Colônia do Marçal, São João del-Rei/MG';
export const CONTRACT_VERSION = '2026.11-v1';

export function buildContract(q: Quote, p: PropertyConfig, tenant: ContractParty): ContractDoc {
  const common: Clause[] = [
    {
      title: 'Das partes',
      text: `LOCADOR: ${LANDLORD}. LOCATÁRIO: ${tenant.name}, CPF/CNPJ ${tenant.document}, residente em ${tenant.address || '—'}, e-mail ${tenant.email}, telefone ${tenant.phone}.`,
    },
    {
      title: 'Do valor e pagamento',
      text: `Valor total da locação: ${brl(q.totalCents)} (inclui taxa de limpeza de ${brl(q.cleaningFeeCents)}${q.extraGuestsCents ? ` e ${brl(q.extraGuestsCents)} de pessoas excedentes` : ''}). Sinal de ${brl(q.amountDueNowCents)} pago via PIX no ato da reserva; saldo de ${brl(q.totalCents - q.amountDueNowCents)} até a data de entrada.`,
    },
    {
      title: 'Da caução',
      text: `Caução de ${brl(q.securityDepositCents)} para cobertura de eventuais danos, paga até a entrada e devolvida em até 5 dias úteis após a vistoria de saída, descontados danos comprovados por fotos.`,
    },
    {
      title: 'Do cancelamento',
      text: 'Cancelamento com mais de 30 dias de antecedência: reembolso integral do sinal. Entre 30 e 15 dias: reembolso de 50%. Menos de 15 dias: sem reembolso, podendo o valor ser convertido em crédito para nova data em até 6 meses, conforme disponibilidade.',
    },
  ];

  if (q.mode === 'stay') {
    return {
      title: 'Contrato de Locação por Temporada',
      version: CONTRACT_VERSION,
      clauses: [
        ...common,
        {
          title: 'Do objeto e prazo',
          text: `Locação residencial por temporada do imóvel situado na Rua João Paulo II, nº 2, São João del-Rei/MG, mobiliado, de ${formatBR(q.startDate)} (check-in a partir das ${p.checkinTime}) a ${formatBR(q.endDate)} (check-out até as ${p.checkoutTime}), totalizando ${q.nights} diária(s), nos termos dos arts. 48 a 50 da Lei 8.245/91.`,
        },
        {
          title: 'Da ocupação',
          text: `Limite de ${q.guests} hóspede(s) declarados (máximo absoluto de ${p.maxGuestsStay}). Visitas e festas não estão incluídas nesta modalidade e dependem de contratação específica de Uso de Espaço para Eventos.`,
        },
        {
          title: 'Das normas de convivência',
          text: 'Silêncio das 22h às 8h, em respeito à vizinhança. Proibido som automotivo. Uso da piscina por menores somente com supervisão de adulto; a cerca de proteção deve permanecer fechada. Animais de estimação mediante consulta prévia.',
        },
      ],
    };
  }

  return {
    title: 'Termo de Uso de Espaço para Eventos (Day Use)',
    version: CONTRACT_VERSION,
    clauses: [
      ...common,
      {
        title: 'Do objeto e horário',
        text: `Cessão de uso da área externa (piscina, espaço gourmet com churrasqueira, gramado, campo e área kids) em ${formatBR(q.startDate)}, das ${p.eventStartTime} às ${p.eventEndTime}${q.lines.length > 1 ? `, acrescido de ${q.lines.slice(1).map((l) => l.label).join(', ')}` : ''}. O uso não inclui pernoite nem acesso às suítes.`,
      },
      {
        title: 'Da capacidade',
        text: `Número de convidados contratado: ${q.guests} (máximo de ${p.maxGuestsEvent}). Convidados acima do contratado serão cobrados conforme tabela vigente; o excesso da capacidade máxima autoriza o encerramento do evento.`,
      },
      {
        title: 'Do som e vizinhança',
        text: `Som alto permitido somente até as ${p.loudMusicUntil}, em conformidade com a legislação municipal de São João del-Rei. Após esse horário, apenas som ambiente baixo.`,
      },
      {
        title: 'Da piscina e churrasqueira',
        text: 'O LOCATÁRIO é responsável pela segurança dos convidados na piscina, devendo manter adulto responsável vigiando crianças. Proibido vidro na área da piscina. Churrasqueira e utensílios devem ser devolvidos limpos de resíduos grossos; carvão e alimentos por conta do LOCATÁRIO.',
      },
      {
        title: 'Da responsabilidade civil',
        text: 'O LOCATÁRIO responde civilmente por danos ao patrimônio, mobiliário (mesas, cadeiras, pebolim, cama elástica, casinha) e a terceiros causados por si ou por seus convidados e fornecedores, autorizando o abatimento na caução e a cobrança do que excedê-la.',
      },
    ],
  };
}

/** Texto canônico (para hash SHA-256 de integridade e geração do PDF) */
export function contractToText(c: ContractDoc): string {
  return [`${c.title} — versão ${c.version}`, ...c.clauses.map((cl, i) => `CLÁUSULA ${i + 1}ª — ${cl.title.toUpperCase()}\n${cl.text}`)].join('\n\n');
}
