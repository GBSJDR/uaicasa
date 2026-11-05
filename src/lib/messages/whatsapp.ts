/** Templates de mensagens para WhatsApp (envio manual via wa.me ou API oficial no futuro). */
export type TemplateKey = 'confirmacao' | 'comprovante' | 'checkin' | 'localizacao' | 'guia' | 'cobranca_saldo';

export interface TemplateVars {
  nome: string;
  codigo: string;
  modalidade: 'stay' | 'event';
  entrada: string; // dd/mm/aaaa
  saida: string;
  pessoas: number;
  total: string;
  pago: string;
  saldo: string;
}

export const ADDRESS = 'Rua João Paulo II, nº 2 — Colônia do Marçal, São João del-Rei/MG';
export const MAPS_URL = 'https://maps.google.com/?q=Rua+João+Paulo+II,+2,+Colônia+do+Marçal,+São+João+del-Rei+-+MG';

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  confirmacao: 'Confirmação da reserva',
  comprovante: 'Comprovante de pagamento',
  cobranca_saldo: 'Lembrete do saldo',
  checkin: 'Instruções de check-in',
  localizacao: 'Localização',
  guia: 'Guia da casa',
};

export function renderTemplate(key: TemplateKey, v: TemplateVars): string {
  const quando = v.modalidade === 'stay' ? `de *${v.entrada}* a *${v.saida}*` : `no dia *${v.entrada}*`;
  const tipo = v.modalidade === 'stay' ? 'hospedagem' : 'evento';
  switch (key) {
    case 'confirmacao':
      return `Olá, ${v.nome}! 🏡\n\nSua ${tipo} na *UaiCasa* está *confirmada* ${quando}.\n\n📋 Reserva: *${v.codigo}*\n👥 ${v.pessoas} pessoa(s)\n💰 Total: ${v.total} • Pago: ${v.pago} • Saldo: ${v.saldo}\n\nQualquer dúvida é só chamar por aqui. Uai, vai ser bão demais! 😄`;
    case 'comprovante':
      return `Oi, ${v.nome}! Recebemos seu pagamento PIX de *${v.pago}* referente à reserva *${v.codigo}*. ✅\nSaldo restante: ${v.saldo}.\nO contrato assinado segue em anexo.`;
    case 'cobranca_saldo':
      return `Oi, ${v.nome}! Passando pra lembrar do saldo de *${v.saldo}* da reserva *${v.codigo}* (${quando}). Posso te enviar o PIX?`;
    case 'checkin':
      return v.modalidade === 'stay'
        ? `Oi, ${v.nome}! Seu check-in é dia *${v.entrada} a partir das 14h* e o check-out dia *${v.saida} até as 11h*.\n\n🔑 Vamos te receber no portão.\n📶 Wi-Fi: UaiCasa • senha enviada na chegada\n🏊 Piscina: crianças sempre com um adulto por perto\n🔇 Silêncio das 22h às 8h\n\nBoa estadia!`
        : `Oi, ${v.nome}! Seu evento é dia *${v.entrada}*, com acesso a partir das 10h e encerramento às 22h. 🎉\n\n🔊 Som alto até 22h\n🔥 Carvão e gelo por conta do anfitrião da festa\n🚫 Sem vidro na área da piscina\n\nFaremos a vistoria de entrada com você.`;
    case 'localizacao':
      return `📍 *UaiCasa*\n${ADDRESS}\n\n${MAPS_URL}\n\nReferência: subindo a Colônia do Marçal, a casa com o muro de pedra e os ciprestes.`;
    case 'guia':
      return `📖 *Guia da UaiCasa*\n\n🏊 Piscina com prainha para as crianças\n🍖 Espaço gourmet com churrasqueira, pia e forno\n⚽ Campo gramado com gol\n🤸 Cama elástica, casinha de madeira com rede de escalada e pebolim\n☀️ Energia solar\n\nPerto: centro histórico de SJDR, Maria Fumaça para Tiradentes, trilhas da Serra do Lenheiro.`;
  }
}

export function waLink(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
