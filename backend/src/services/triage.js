// Lightweight OpenAI triage helper.
// No SDK needed; uses global fetch (Node 18+).
import dotenv from 'dotenv';
dotenv.config();

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini'; // fast, inexpensive, good enough for triage

export async function triage({ subject, body }) {
  const key = process.env.OPENAI_API_KEY;
  // Fail safely if no key configured
  if (!key) {
    return {
      category: guessCategory(`${subject}\n${body}`),
      sentiment: 'neutral',
      ai_suggestion: null,
      source: 'local-fallback'
    };
  }

  const system = `
You are a support triage assistant. Classify the ticket and draft a short reply.
Return strict JSON with keys: category, sentiment, reply.
Categories: shipping, refund, bug, vip, other.
Sentiment: positive, neutral, negative.
Keep reply under 120 words, friendly, and actionable. Do not include JSON fences.`;

  const user = `Subject: ${subject}\n\nBody:\n${body}`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
      })
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '{}';
    let parsed;
    try { parsed = JSON.parse(text); } catch {
      parsed = safeJson(text);
    }

    return {
      category: normalizeCategory(parsed.category),
      sentiment: normalizeSentiment(parsed.sentiment),
      ai_suggestion: parsed.reply || null,
      source: 'openai'
    };
  } catch (e) {
    // Fallback on any error
    return {
      category: guessCategory(`${subject}\n${body}`),
      sentiment: 'neutral',
      ai_suggestion: null,
      source: 'error-fallback'
    };
  }
}

// --- helpers ---
function guessCategory(t) {
  const s = t.toLowerCase();
  if (/\btracking|where.*order|deliv|ship|late|eta\b/.test(s)) return 'shipping';
  if (/\brefund|return|chargeback|cancel\b/.test(s)) return 'refund';
  if (/\berror|bug|broken|crash|doesn.?t work\b/.test(s)) return 'bug';
  if (/\bvip|priority|enterprise|manager\b/.test(s)) return 'vip';
  return 'other';
}
function normalizeCategory(c) {
  const v = String(c || '').toLowerCase();
  return ['shipping','refund','bug','vip'].includes(v) ? v : 'other';
}
function normalizeSentiment(s) {
  const v = String(s || '').toLowerCase();
  return ['positive','neutral','negative'].includes(v) ? v : 'neutral';
}
function safeJson(text) {
  // Simple rescue if model wrapped JSON with extra prose
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}
