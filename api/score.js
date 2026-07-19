import { put, list, del } from '@vercel/blob';

const BLOB_PREFIX = 'expense-quiz-scores-';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    switch (req.method) {
      case 'GET':
        return await getScores(req, res);
      case 'POST':
        return await saveScore(req, res);
      case 'DELETE':
        return await clearScores(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

async function getScores(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    const all = [];
    for (const blob of blobs) {
      try {
        const resp = await fetch(blob.url);
        const data = await resp.json();
        all.push(data);
      } catch (e) {
        // skip corrupted entries
      }
    }
    all.sort((a, b) => b.score - a.score || b.correct - a.correct);
    const top = all.slice(0, limit);
    return res.status(200).json(top);
  } catch (e) {
    // Fallback: if no blob store configured, return empty
    return res.status(200).json([]);
  }
}

async function saveScore(req, res) {
  const { name, score, correct, total, sc, mc, jc } = req.body;
  if (score === undefined || correct === undefined || total === undefined) {
    return res.status(400).json({ error: 'Missing required fields: score, correct, total' });
  }
  const now = new Date();
  const ts = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const entry = {
    id: Date.now(),
    name: (name || '匿名用户').slice(0, 20),
    score,
    correct,
    total,
    sc: sc || 0,
    mc: mc || 0,
    jc: jc || 0,
    time: ts,
    created: now.toISOString()
  };
  const key = `${BLOB_PREFIX}${entry.id}`;
  await put(key, JSON.stringify(entry), { contentType: 'application/json', access: 'public' });
  return res.status(200).json({ ok: true });
}

async function clearScores(req, res) {
  const { password } = req.body || {};
  const adminPwd = process.env.ADMIN_PASSWORD;
  if (adminPwd && password !== adminPwd) {
    return res.status(403).json({ error: '密码错误' });
  }
  const { blobs } = await list({ prefix: BLOB_PREFIX });
  for (const blob of blobs) {
    await del(blob.url);
  }
  return res.status(200).json({ ok: true, deleted: blobs.length });
}
