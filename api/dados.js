// Devolve os totais por dia: { dias: { "2026-10-06": { aula: 10, ... } } }
// Soma duas fontes: contagens antigas (só data) e eventos novos (com hora, dia decidido aqui).
const { pipeline } = require('./_redis');
const { METRICAS } = require('./evento');
const { BLOQUEADOS, diaDe } = require('./_config');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // 1) fontes: dias antigos + eventos com hora
    const base = await pipeline([['SMEMBERS', 'dias'], ...METRICAS.map(m => ['ZRANGE', `evt:${m}`, '0', '-1'])]);
    const antigos = (base[0] || []).sort().slice(-120);

    // eventos novos -> (dia, métrica) -> contatos únicos
    const novos = {};
    METRICAS.forEach((m, i) => (base[i + 1] || []).forEach(membro => {
      const [id, ms] = String(membro).split('|');
      if (!id || BLOQUEADOS.includes(id)) return;
      const d = diaDe(+ms);
      ((novos[d] = novos[d] || {})[m] = novos[d][m] || new Set()).add(id);
    }));

    // 2) contagens antigas (descontando contatos de teste)
    const cmds = [];
    antigos.forEach(d => METRICAS.forEach(m => {
      cmds.push(['SCARD', `ev:${d}:${m}`]);
      BLOQUEADOS.forEach(b => cmds.push(['SISMEMBER', `ev:${d}:${m}`, b]));
    }));
    const r = cmds.length ? await pipeline(cmds) : [];
    const passo = 1 + BLOQUEADOS.length;
    const out = {};
    antigos.forEach((d, i) => {
      out[d] = {};
      METRICAS.forEach((m, j) => {
        const k = (i * METRICAS.length + j) * passo;
        let n = r[k] || 0;
        for (let b = 1; b < passo; b++) n -= r[k + b] || 0;
        out[d][m] = Math.max(n, 0);
      });
    });

    // 3) soma os eventos novos, sem contar quem já estava na contagem antiga do mesmo dia
    const checks = [];
    Object.keys(novos).forEach(d => Object.keys(novos[d]).forEach(m => novos[d][m].forEach(id => checks.push([d, m, id]))));
    const ja = checks.length ? await pipeline(checks.map(([d, m, id]) => ['SISMEMBER', `ev:${d}:${m}`, id])) : [];
    checks.forEach(([d, m, id], i) => {
      if (ja[i]) return;
      out[d] = out[d] || Object.fromEntries(METRICAS.map(x => [x, 0]));
      out[d][m] = (out[d][m] || 0) + 1;
    });

    res.status(200).json({ atualizado: new Date().toISOString(), dias: out });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};
