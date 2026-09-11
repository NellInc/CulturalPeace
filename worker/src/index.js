/**
 * Cultural Peace — "Propose an amendment" intake.
 *
 * Browser form  →  this Worker  →  GitHub Issue in GITHUB_REPO.
 *
 * Defences, in order of evaluation:
 *   1. Method / origin / content-type checks (CORS allow-list).
 *   2. Body size cap and per-field length caps.
 *   3. Honeypot field must be empty.
 *   4. Cloudflare Turnstile token verified server-side.
 *   5. Native per-IP rate limit (RATE_LIMITER binding, atomic) when bound.
 *   6. Per-IP hourly cap and duplicate-content rejection in AMEND_KV
 *      (required; the Worker refuses to run without it).
 *
 * User text is placed in fenced code blocks in the issue, so no Markdown,
 * links, HTML or @-mentions from the submitter ever render.
 *
 * The submitter's email is never written into the public issue. It is stored
 * privately in AMEND_KV for 90 days under contact:<issue-number>.
 */

const LIMITS = {
  body: 16 * 1024, // bytes
  passage: 1500,
  proposal: 3000,
  rationale: 3000,
  name: 80,
  email: 254,
  title: 120,
};
const RATE = { perHour: 5, windowSec: 3600 };
const DUPLICATE_TTL = 24 * 3600;
const CONTACT_TTL = 90 * 24 * 3600;
const TURNSTILE_ACTION = 'amend'; // must match the action set on the widget in site.js

const PRINCIPLES = {
  '01': ['Self-Determination & Political Franchise', 'self-determination'],
  '02': ['Banking Neutrality', 'banking-neutrality'],
  '03': ['Immunity from Partiality', 'immunity-from-partiality'],
  '04': ['Freedom from Assault', 'freedom-from-assault'],
  '05': ['Freedom from Political Discrimination', 'freedom-from-political-discrimination'],
  '06': ['Judicial Reporting Embargo', 'judicial-reporting-embargo'],
  '07': ['Statute of Limitations', 'statute-of-limitations'],
  '08': ['Freedom from Secret Exclusion', 'freedom-from-secret-exclusion'],
  '09': ['Transparency of Judgment', 'transparency-of-judgment'],
  '10': ['Freedom of Consciousness', 'freedom-of-consciousness'],
  '11': ['Freedom to Enjoy Culture', 'freedom-to-enjoy-culture'],
  '12': ['Equality of Public Access', 'equality-of-public-access'],
  '13': ['Freedom of Association', 'freedom-of-association'],
  '14': ['There Are No Monopolies on Truth', 'there-are-no-monopolies-on-truth'],
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = allowedOrigin(origin, env);
    const cors = corsHeaders(allowed ? origin : null);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }
    if (!allowed) {
      return json({ error: 'Origin not allowed' }, 403, cors);
    }
    if (!env.GITHUB_TOKEN || !env.TURNSTILE_SECRET || !env.AMEND_KV || !env.RATE_LIMITER) {
      return json({ error: 'Service not configured' }, 503, cors);
    }

    try {
      const result = await handleSubmission(request, env);
      return json(result.body, result.status, cors);
    } catch (err) {
      console.error('amendment intake failed', err);
      return json({ error: 'Something went wrong on our side. Please try again later.' }, 500, cors);
    }
  },
};

async function handleSubmission(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return reject(415, 'Unsupported content type.');
  }

  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > LIMITS.body) return reject(413, 'Submission too large.');
  const raw = await request.text();
  if (raw.length > LIMITS.body) return reject(413, 'Submission too large.');

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return reject(400, 'Malformed request.');
  }
  if (!data || typeof data !== 'object') return reject(400, 'Malformed request.');

  // Honeypot: real users never see or fill this.
  if (typeof data.website === 'string' && data.website.trim() !== '') {
    return reject(400, 'Submission rejected.');
  }

  const principle = String(data.principle || '').padStart(2, '0');
  if (!/^(0[1-9]|1[0-4])$/.test(principle) || !Object.prototype.hasOwnProperty.call(PRINCIPLES, principle)) {
    return reject(400, 'Unknown principle.');
  }

  const passage = clean(data.passage, LIMITS.passage);
  const proposal = clean(data.proposal, LIMITS.proposal);
  const rationale = clean(data.rationale, LIMITS.rationale);
  const name = clean(data.name, LIMITS.name).replace(/\n/g, ' ') || 'Anonymous';
  const email = clean(data.email, LIMITS.email);

  if (!proposal) return reject(400, 'Please include the wording you are proposing.');
  if (!rationale) return reject(400, 'Please say briefly why this change would help.');
  if (proposal.length < 10) return reject(400, 'The proposed wording is too short to act on.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reject(400, 'That email address does not look right.');
  }

  // Atomic native limiter first (cheap, before the Turnstile round-trip).
  const { success: underLimit } = await env.RATE_LIMITER.limit({ key: ip });
  if (!underLimit) return reject(429, 'Too many requests. Please wait a minute and try again.');

  const human = await verifyTurnstile(data.turnstileToken, ip, env);
  if (!human) return reject(403, 'Human check failed. Please reload and try again.');

  // KV counters are best-effort (not atomic); the atomic guard above and the
  // single-use Turnstile token are the hard limits. Counter is written before
  // the GitHub call so a failure downstream still consumes the slot.
  const rateKey = `rate:${await sha256(ip)}`;
  const count = Number((await env.AMEND_KV.get(rateKey)) || 0);
  if (count >= RATE.perHour) {
    return reject(429, 'You have sent several proposals recently. Please wait an hour before sending more.');
  }
  const dupKey = `dup:${await sha256(principle + '\n' + passage + '\n' + proposal)}`;
  if (await env.AMEND_KV.get(dupKey)) {
    return reject(409, 'This proposal has already been received. Thank you.');
  }
  await env.AMEND_KV.put(rateKey, String(count + 1), { expirationTtl: RATE.windowSec });
  await env.AMEND_KV.put(dupKey, '1', { expirationTtl: DUPLICATE_TTL });

  const issue = await createIssue(env, { principle, passage, proposal, rationale, name });

  if (email) {
    await env.AMEND_KV.put(`contact:${issue.number}`, JSON.stringify({ email, name }), {
      expirationTtl: CONTACT_TTL,
    });
  }

  return { status: 201, body: { ok: true, url: issue.html_url, number: issue.number } };
}

function reject(status, message) {
  return { status, body: { error: message } };
}

/** Normalise newlines, drop control characters (keeping newline and tab), trim, cap length. */
function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

async function verifyTurnstile(token, ip, env) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) return false;
  const outcome = await res.json();
  if (outcome.success !== true) return false;
  // The token must have been solved on one of our own hostnames, for our action.
  const hosts = allowedHostnames(env);
  if (!hosts.includes(String(outcome.hostname || '').toLowerCase())) return false;
  if (outcome.action !== TURNSTILE_ACTION) return false;
  return true;
}

function allowedHostnames(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((o) => { try { return new URL(o).hostname.toLowerCase(); } catch { return ''; } })
    .filter(Boolean);
}

async function createIssue(env, { principle, passage, proposal, rationale, name }) {
  const [principleTitle, slug] = PRINCIPLES[principle];
  const safeName = name.replace(/[^\p{L}\p{N}\p{M} .,'\-]/gu, '').trim() || 'Anonymous';
  const title = `Principle ${principle}: amendment proposed by ${safeName}`.slice(0, LIMITS.title);
  const body = [
    `**Principle ${principle} — ${principleTitle}**`,
    `https://culturalpeace.org/#${slug}`,
    '',
    '### Passage in question',
    passage ? fence(passage) : '_Not specified: applies to the principle as a whole._',
    '',
    '### Proposed wording',
    fence(proposal),
    '',
    '### Rationale',
    fence(rationale),
    '',
    '---',
    `Submitted by **${safeName}** via the culturalpeace.org amendment form.`,
    '_Contact details, if given, are held privately and are not published here._',
  ].join('\n');

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'culturalpeace-amendments-worker',
    },
    body: JSON.stringify({ title, body, labels: ['amendment', `principle-${principle}`] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Wrap user text in a fenced code block so no Markdown, links, HTML or
 * @-mentions render. The fence is made longer than any backtick run inside
 * the text so it cannot be closed early.
 */
function fence(text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const f = '`'.repeat(longest + 1);
  return `${f}text\n${text}\n${f}`;
}

function allowedOrigin(origin, env) {
  if (!origin) return false;
  const list = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin);
}

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
