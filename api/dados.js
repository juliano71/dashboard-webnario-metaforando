// Devolve os totais por dia: { dias: { "2026-10-06": { aula: 10, ... } } }
const { pipeline } = require('./_redis');
const { METRICAS } = require('./evento');
const { BLOQUEADOS } = require('./_config');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const [dias] = await pipeline([['SMEMBERS', 'dias']]);
    const lista = (dias || []).sort().slice(-120);
    const cmds = [];
    // por métrica: total e quantos dos contatos de teste estão no conjunto (para descontar)
    lista.forEach(d => METRICAS.forEach(m => {
      cmds.push(['SCARD', `ev:${d}:${m}`]);
      BLOQUEADOS.forEach(b => cmds.push(['SISMEMBER', `ev:${d}:${m}`, b]));
    }));
    const r = cmds.length ? await pipeline(cmds) : [];
    const out = {};
    const passo = 1 + BLOQUEADOS.length;
    lista.forEach((d, i) => {
      out[d] = {};
      METRICAS.forEach((m, j) => {
        const base = (i * METRICAS.length + j) * passo;
        let n = r[base] || 0;
        for (let b = 1; b < passo; b++) n -= r[base + b] || 0;
        out[d][m] = Math.max(n, 0);
      });
    });
    res.status(200).json({ atualizado: new Date().toISOString(), dias: out });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};
