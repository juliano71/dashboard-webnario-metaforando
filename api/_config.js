// Contatos de teste: não entram na contagem.
const BLOQUEADOS = ['N8JTz3TxRgN4JZaq8OS1'];

// O dia do webinário vai das CORTE_HORA do dia anterior até as CORTE_HORA do próprio dia (Brasília).
// A hora de cada evento é guardada, então mudar o corte aqui reclassifica os eventos novos.
const CORTE_HORA = 18;
const diaDe = ms =>
  new Date(ms + (24 - CORTE_HORA) * 3600e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

module.exports = { BLOQUEADOS, CORTE_HORA, diaDe };
