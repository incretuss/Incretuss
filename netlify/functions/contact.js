// Netlify Function: POST /api/contact (redirected from /.netlify/functions/contact — see netlify.toml)
//
// Validates and sanitizes a contact-form submission, then sends it as an email through
// the Resend API. Nothing here trusts the frontend's own validation — every check below
// runs again server-side, because this endpoint is public and reachable directly.
const { Resend } = require('resend');
const { getStore } = require('@netlify/blobs');

const MAX_LENGTHS = {
  name: 100,
  company: 100,
  email: 254,
  product: 100,
  message: 5000,
};

// Deliberately simple/conservative — good enough to catch typos and junk without
// rejecting valid addresses. Real deliverability is enforced by Resend, not this regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5; // requests per IP per window

const GENERIC_ERROR = 'Something went wrong on our end. Please try again shortly or email us directly.';

function jsonResponse(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strips newlines/control characters (defends against header/log injection) and
// collapses whitespace. Length limits are enforced separately so we can reject
// oversized input with a clear error instead of silently truncating it.
function cleanField(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n\t\0\x0B\x0C\u0085\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getClientIp(event) {
  const headers = event.headers || {};
  // Netlify sets this to the real client IP on every function invocation.
  if (headers['x-nf-client-connection-ip']) return headers['x-nf-client-connection-ip'];
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

// Serverless-appropriate rate limiting using Netlify Blobs.
//
// Why not the old express-rate-limit approach: that library keeps counters in the
// process's memory, which works for a single long-running Express server but not here —
// each Netlify Function invocation can run in a fresh, isolated instance, so an in-memory
// counter would reset constantly and provide no real protection.
//
// Why Netlify Blobs instead of an external service (e.g. Upstash Redis): Blobs is built
// into Netlify, needs no extra account/service/API key, and is already durable and shared
// across function instances — which is exactly what a fixed-window counter needs. For a
// low-volume business contact form this is sufficient. If this endpoint ever needs to
// survive much higher abuse volumes or needs atomic increments under heavy concurrency,
// Upstash Redis (via @upstash/ratelimit) is the standard upgrade path — it's purpose-built
// for serverless rate limiting with atomic operations, has a generous free tier, and has a
// first-class Netlify integration.
async function checkRateLimit(ip) {
  try {
    const store = getStore({ name: 'contact-rate-limit', consistency: 'strong' });
    const key = `ip:${ip}`;
    const now = Date.now();
    const existing = (await store.get(key, { type: 'json' })) || null;

    let record = existing;
    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      record = { count: 0, windowStart: now };
    }
    record.count += 1;

    await store.setJSON(key, record);

    return record.count <= RATE_LIMIT_MAX;
  } catch (err) {
    // Fail open rather than taking the contact form down if Blobs has an outage —
    // logged so it can be investigated, but a low-volume form staying reachable
    // matters more than a rare missed rate-limit window.
    console.error('Rate limit check failed, allowing request through:', err);
    return true;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { ok: false, error: 'Malformed request body.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse(400, { ok: false, error: 'Malformed request body.' });
  }

  const ip = getClientIp(event);
  const withinLimit = await checkRateLimit(ip);
  if (!withinLimit) {
    return jsonResponse(429, { ok: false, error: 'Too many requests. Please try again later.' });
  }

  // Honeypot field: real visitors never see or fill it in (hidden via CSS in contact.html).
  // A bot that fills it gets an identical "success" response — never a signal that it was
  // caught — while we silently drop the submission before it reaches Resend.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return jsonResponse(200, { ok: true });
  }

  const name = cleanField(payload.name);
  const company = cleanField(payload.company);
  const email = cleanField(payload.email);
  const product = cleanField(payload.product);
  const message = cleanField(payload.message);

  if (!name || !email || !message) {
    return jsonResponse(400, { ok: false, error: 'Name, email, and message are required.' });
  }

  for (const [field, value] of Object.entries({ name, company, email, product, message })) {
    if (value.length > MAX_LENGTHS[field]) {
      return jsonResponse(400, { ok: false, error: `${field} is too long.` });
    }
  }

  if (!EMAIL_RE.test(email)) {
    return jsonResponse(400, { ok: false, error: 'Please provide a valid email address.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const receiver = process.env.CONTACT_RECEIVER_EMAIL;
  const sender = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !receiver || !sender) {
    console.error(
      'Contact function is missing required environment variables:',
      JSON.stringify({
        RESEND_API_KEY: apiKey ? 'set' : 'MISSING',
        CONTACT_RECEIVER_EMAIL: receiver ? 'set' : 'MISSING',
        CONTACT_FROM_EMAIL: sender ? 'set' : 'MISSING',
      })
    );
    return jsonResponse(500, { ok: false, error: GENERIC_ERROR });
  }

  const submittedAt = new Date().toISOString();

  const text = [
    `Name: ${name}`,
    company ? `Company: ${company}` : null,
    `Email: ${email}`,
    product ? `Product of interest: ${product}` : null,
    `Submitted: ${submittedAt}`,
    '',
    message,
  ]
    .filter(Boolean)
    .join('\n');

  const rows = [
    ['Name', name],
    company ? ['Company', company] : null,
    ['Email', email],
    product ? ['Product of interest', product] : null,
    ['Submitted', submittedAt],
  ].filter(Boolean);

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;">
  <h2 style="margin:0 0 16px;font-size:16px;">New enquiry from the Incretuss contact form</h2>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:520px;">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top;">${escapeHtml(
            label
          )}</td><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`
      )
      .join('\n    ')}
  </table>
  <p style="margin:20px 0 6px;color:#666;">Message</p>
  <p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>
</div>`;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: sender,
      to: receiver,
      replyTo: email,
      subject: `New enquiry from ${name}${product ? ` — ${product}` : ''}`,
      text,
      html,
    });

    if (error) {
      console.error('Resend rejected the contact email:', error);
      return jsonResponse(502, { ok: false, error: GENERIC_ERROR });
    }

    console.log('Contact email sent via Resend:', { id: data && data.id, ip });
    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('Unexpected error calling Resend:', err);
    return jsonResponse(502, { ok: false, error: GENERIC_ERROR });
  }
};
