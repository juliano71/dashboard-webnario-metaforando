// Recebe eventos do fluxo (GoHighLevel/n8n). Uma URL por métrica:
//   POST /api/evento?metrica=aula&key=SEGREDO   (body padrão do webhook, com contact_id)
// Guarda só data + métrica + contact_id (sem nome/e-mail/telefone).
const { pipeline } = require('./_redis');
const { BLOQUEADOS } = require('./_config');

const METRICAS = [
  'pam_venda',          // compra aprovada do PAM (front)
  'convite_enviado',    // tentativa de envio do convite da aula
  'convite_entregue',   // convite da aula entregue
  'confirmou_presenca', // clicou "Sim, Vou Estar Lá"
  'amanha_consigo',     // clicou "Amanhã Consigo"
  'visita', 'aula', 'pitch', 'oferta', 'clique', 'alh_venda',
];

// Dia do webinário: vai das 18h do dia anterior até as 18h do dia (horário de Brasília).
const hojeBR = () => new Date(Date.now() + 6 * 3600e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ ok: false, erro: 'use POST' });

  const segredo = process.env.EVENTO_KEY;
  const q = req.query || {};
  if (segredo && q.key !== segredo) return res.status(401).json({ ok: false, erro: 'chave inválida' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (Array.isArray(b)) b = b[0] && (b[0].body || b[0]);
  b = b || {};

  const metrica = q.metrica || b.metrica;
  if (!METRICAS.includes(metrica)) return res.status(400).json({ ok: false, erro: 'metrica inválida', validas: METRICAS });

  const id = q.contact_id || b.contact_id || b.contactId || (b.contact && b.contact.id);
  if (!id) return res.status(400).json({ ok: false, erro: 'contact_id ausente' });

  if (BLOQUEADOS.includes(String(id))) return res.status(200).json({ ok: true, ignorado: 'contato de teste' });

  const data = /^\d{4}-\d{2}-\d{2}$/.test(q.data || b.data || '') ? (q.data || b.data) : hojeBR();

  try {
    const [novo] = await pipeline([
      ['SADD', `ev:${data}:${metrica}`, String(id)],
      ['SADD', 'dias', data],
    ]);
    return res.status(200).json({ ok: true, data, metrica, novo: novo === 1 });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
};
module.exports.METRICAS = METRICAS;
