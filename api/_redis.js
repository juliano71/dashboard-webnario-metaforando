// Cliente mínimo do Upstash Redis (REST). Aceita as variáveis do Upstash ou do Vercel KV.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function pipeline(commands) {
  if (!URL_ || !TOKEN) throw new Error('Redis não configurado (variáveis de ambiente ausentes)');
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('Redis HTTP ' + r.status);
  return (await r.json()).map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

module.exports = { pipeline };
