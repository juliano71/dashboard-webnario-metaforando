// Devolve os totais por dia: { dias: { "2026-10-06": { aula: 10, ... } } }
const { pipeline } = require('./_redis');
const { METRICAS } = require('./evento');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const [dias] = await pipeline([['SMEMBERS', 'dias']]);
    const lista = (dias || []).sort().slice(-120);
    const cmds = [];
    lista.forEach(d => METRICAS.forEach(m => cmds.push(['SCARD', `ev:${d}:${m}`])));
    const r = cmds.length ? await pipeline(cmds) : [];
    const out = {};
    lista.forEach((d, i) => {
      out[d] = {};
      METRICAS.forEach((m, j) => { out[d][m] = r[i * METRICAS.length + j] || 0; });
    });
    res.status(200).json({ atualizado: new Date().toISOString(), dias: out });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};
