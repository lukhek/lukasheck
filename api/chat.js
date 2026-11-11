// Mini-Chat-Backend (Vercel Serverless). Key liegt nur als Umgebungsvariable ANTHROPIC_API_KEY.
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
const MAX_OUT = 300;      // kurze Antworten = wenig Tokens
const MAX_TURNS = 6;      // nur die letzten 6 Nachrichten mitsenden
const MAX_CHARS = 400;    // pro Nachricht
const DAILY_LIMIT = 40;   // pro IP und Instanz (grober Schutz)

const SYSTEM = `Du bist der Haut-Assistent von Lukas Heck (Health- und Performance-Trainer, Experte für Longevity). Antworte auf Deutsch (oder in der Sprache der Frage), freundlich, klar, maximal 4 kurze Sätze oder 4 Stichpunkte. Kein Fachjargon ohne Erklärung. Keine Diagnosen, keine Heilversprechen. Bei Hautveränderungen, Schmerzen, Blutungen oder Unsicherheit: Dermatologie empfehlen. Themen außerhalb Haut: kurz sagen, dass du nur zu Haut hilfst.

WISSEN (modernes Hautverständnis):
- Haut ist ein Organ mit Barriere (Hornschicht, Lipide wie Ceramide/Cholesterin/Fettsäuren) und Mikrobiom. Eine intakte Barriere ist wichtiger als viele Produkte.
- Wenig, aber konsequent: Reinigung mild, Feuchtigkeit, täglich Sonnenschutz (LSF 30–50) ist der stärkste Anti-Aging-Hebel.
- Retinoid abends, langsam einführen (2x/Woche), nicht in der Schwangerschaft. Vitamin C morgens als Antioxidans. Niacinamid beruhigt und stützt die Barriere. Hyaluron bindet Wasser, am besten auf leicht feuchter Haut.
- Säuren (AHA/BHA) sparsam, max. 1–3x/Woche. Nicht alles gleichzeitig starten: ein neuer Wirkstoff alle 2–4 Wochen.
- Rötung, Brennen, Spannen = Barriere überlastet: Pause, nur mild reinigen, eincremen, Sonnenschutz.
- Von innen: Schlaf (7–9 h), Proteine, Omega-3, buntes Gemüse, wenig Zucker-Spitzen, Stress senken, nicht rauchen. Glykation und oxidativer Stress altern Haut. Kollagen-Support (Vitamin C, Protein) hat moderate, keine magische Wirkung.
- Haut erneuert sich in ca. 28–40 Tage; Ergebnisse brauchen 8–12 Wochen.
- Kupferpeptide (GHK-Cu) sind ein vielversprechender, aber noch nicht abschließend erforschter Ansatz für Hautdichte und Reparatur.
Wenn passend, am Ende EINEN konkreten Tipp geben.`;

const hits = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server nicht konfiguriert.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const day = new Date().toISOString().slice(0, 10);
  const k = ip + day;
  const n = (hits.get(k) || 0) + 1;
  hits.set(k, n);
  if (hits.size > 2000) hits.clear();
  if (n > DAILY_LIMIT) return res.status(429).json({ error: 'Tageslimit für den Test erreicht.' });

  let msgs = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
  msgs = msgs
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_TURNS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return res.status(400).json({ error: 'Keine Frage.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_OUT, system: SYSTEM, messages: msgs })
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Modellfehler.' });
    const text = (d.content || []).map(b => b.text || '').join('').trim();
    return res.status(200).json({ reply: text, usage: d.usage });
  } catch (e) {
    return res.status(502).json({ error: 'Verbindung fehlgeschlagen.' });
  }
}
