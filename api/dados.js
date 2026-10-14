// Devolve os totais por dia: { dias: { "2026-10-06": { convite_enviado: 10, ... } } }
// Soma duas fontes: contagens antigas (só data, não mudam mais) e eventos novos (com hora, dia decidido aqui).
// Poucos comandos por leitura: dados antigos ficam em memória e a resposta é cacheada no edge da Vercel.
const { pipeline } = require('./_redis');
const { BLOQUEADOS, diaDe } = require('./_config');

// só as métricas que o dashboard lê dos webhooks
const USADAS = ['convite_enviado', 'convite_entregue', 'confirmou_presenca'];

let legado = null; // { t, out }
async function carregarLegado() {
  if (legado && Date.now() - legado.t < 6 * 3600e3) return legado.out;
  const [dias] = await pipeline([['SMEMBERS', 'dias']]);
  const lista = (dias || []).sort().slice(-120);
  const cmds = [];
  lista.forEach(d => USADAS.forEach(m => {
    cmds.push(['SCARD', `ev:${d}:${m}`]);
    BLOQUEADOS.forEach(b => cmds.push(['SISMEMBER', `ev:${d}:${m}`, b]));
  }));
  const r = cmds.length ? await pipeline(cmds) : [];
  const passo = 1 + BLOQUEADOS.length;
  const out = {};
  lista.forEach((d, i) => {
    out[d] = {};
    USADAS.forEach((m, j) => {
      const k = (i * USADAS.length + j) * passo;
      let n = r[k] || 0;
      for (let b = 1; b < passo; b++) n -= r[k + b] || 0;
      out[d][m] = Math.max(n, 0);
    });
  });
  legado = { t: Date.now(), out };
  return out;
}

module.exports = async (req, res) => {
  // o edge da Vercel guarda a resposta por 45s: muitas telas abertas = uma só consulta ao banco
  res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=300');
  try {
    const [antigo, novos] = await Promise.all([
      carregarLegado(),
      pipeline(USADAS.map(m => ['ZRANGE', `evt:${m}`, '0', '-1'])),
    ]);
    const out = JSON.parse(JSON.stringify(antigo));

    // eventos com hora -> (dia, métrica) -> contatos únicos
    const porDia = {};
    USADAS.forEach((m, i) => (novos[i] || []).forEach(membro => {
      const [id, ms] = String(membro).split('|');
      if (!id || BLOQUEADOS.includes(id)) return;
      const d = diaDe(+ms);
      ((porDia[d] = porDia[d] || {})[m] = porDia[d][m] || new Set()).add(id);
    }));
    Object.keys(porDia).forEach(d => {
      out[d] = out[d] || Object.fromEntries(USADAS.map(x => [x, 0]));
      USADAS.forEach(m => { out[d][m] = (out[d][m] || 0) + (porDia[d][m] ? porDia[d][m].size : 0); });
    });

    res.status(200).json({ atualizado: new Date().toISOString(), dias: out });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ erro: e.message });
  }
};
