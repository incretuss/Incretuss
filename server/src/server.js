import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..', '..');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(siteRoot));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again later.' },
});

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, company, email, product, message, website } = req.body || {};

  // Honeypot field: real visitors never fill this in (it's hidden via CSS).
  if (website) {
    return res.json({ ok: true });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Name, email, and message are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please provide a valid email address.' });
  }

  try {
    await getTransporter().sendMail({
      to: process.env.CONTACT_RECEIVER_EMAIL,
      from: process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER,
      replyTo: `${name} <${email}>`,
      subject: `New enquiry from ${name}${product ? ` — ${product}` : ''}`,
      text: [
        `Name: ${name}`,
        company ? `Company: ${company}` : null,
        `Email: ${email}`,
        product ? `Product of interest: ${product}` : null,
        '',
        message,
      ].filter(Boolean).join('\n'),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to send contact email:', err);
    res.status(502).json({ ok: false, error: 'Could not send your message right now. Please try again later or email us directly.' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Incretuss server listening on port ${PORT}`);
});
