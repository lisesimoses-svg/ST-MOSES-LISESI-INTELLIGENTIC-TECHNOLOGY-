import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-6-astra';

const server = http.createServer(async (req, res) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': 'same-origin' };
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try { const html = await readFile(path.join(__dirname, 'index.html')); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); }
    catch { res.writeHead(500); res.end('Imeshindikana kufungua ukurasa.'); }
    return;
  }
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, headers); res.end(JSON.stringify({ ok: true, configured: Boolean(API_KEY) })); return;
  }
  if (req.method !== 'POST' || req.url !== '/api/chat') {
    res.writeHead(404, headers); res.end(JSON.stringify({ error: 'Njia haijapatikana.' })); return;
  }
  if (!API_KEY) { res.writeHead(503, headers); res.end(JSON.stringify({ error: 'API key haijawekwa kwenye seva bado.' })); return; }
  try {
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 100_000) throw new Error('Ujumbe ni mkubwa mno.'); }
    const parsed = JSON.parse(body || '{}');
    const messages = Array.isArray(parsed.messages) ? parsed.messages.slice(-12) : [];
    if (!messages.length) { res.writeHead(400, headers); res.end(JSON.stringify({ error: 'Andika swali kwanza.' })); return; }
    const modeNames = { chat: 'msaidizi wa jumla', education: 'mwalimu na mtaalamu wa elimu', writing: 'msaidizi wa uandishi', business: 'mshauri wa biashara na usimamizi wa shule' };
    const mode = modeNames[parsed.mode] || modeNames.chat;
    const input = messages.map(m => `${m.role === 'assistant' ? 'ST MOSES AI' : 'Mtumiaji'}: ${String(m.content || '').slice(0, 6000)}`).join('\n\n');
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        instructions: `Wewe ni ST MOSES AI, msaidizi mwenye heshima na ufasaha. Jibu kwa lugha aliyotumia mtumiaji; Kiswahili ni lugha ya msingi. Unasaidia walimu, wanafunzi na wajasiriamali hasa Tanzania. Kwa hali ya ${mode}, toa majibu sahihi, yanayoeleweka na ya vitendo. Tengeneza mitihani kwa mpangilio mzuri na tofautisha maswali na majibu. Usibuni taarifa rasmi au sheria; sema pale ambapo huna uhakika.`,
        input
      })
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      const message = result?.error?.message || 'Huduma ya AI imerudisha hitilafu.';
      res.writeHead(upstream.status, headers); res.end(JSON.stringify({ error: message })); return;
    }
    const reply = (result.output || []).flatMap(item => item.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n').trim();
    res.writeHead(200, headers); res.end(JSON.stringify({ reply: reply || 'Samahani, sijapata jibu la maandishi.' }));
  } catch (error) {
    res.writeHead(500, headers); res.end(JSON.stringify({ error: error.message || 'Hitilafu ya seva.' }));
  }
});
server.listen(PORT, () => console.log(`ST MOSES AI inaendesha kwenye port ${PORT}`));
