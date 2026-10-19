const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { gmailConfig, sendGmailInvitation, invitationProvider } = require('../dist/src/common/invitation-mail');
(async () => {
  for (const value of ['gmail', ' Gmail ', '"gmail"', "'gmail'"]) { process.env.MAIL_PROVIDER = value; assert.equal(invitationProvider(), 'gmail'); }
  process.env.MAIL_PROVIDER = 'invalid'; assert.throws(invitationProvider, /no es válido/);
  process.env.MAIL_PROVIDER = 'resend'; assert.equal(invitationProvider(), 'resend');
  delete process.env.MAIL_PROVIDER; delete process.env.RESEND_API_KEY; delete process.env.INVITATION_FROM;
  delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD;
  assert.throws(gmailConfig, /Falta configurar/);
  assert.throws(invitationProvider, /Production/);
  process.env.GMAIL_USER = 'sender@example.invalid'; process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
  assert.equal(invitationProvider(), 'gmail');
  const config = gmailConfig(); assert.equal(config.auth.pass, 'abcdefghijklmnop'); assert.equal(config.secure, false); assert.equal(config.requireTLS, true); assert.equal(config.port, 587);
  let closed = false;
  nodemailer.createTransport = () => ({ sendMail: async mail => {
    assert.equal(mail.from.address, config.auth.user); assert.equal(mail.to, 'target@example.invalid');
    assert(mail.html.includes('&amp;')); return { accepted: [mail.to], rejected: [] };
  }, close: () => { closed = true; } });
  await sendGmailInvitation('target@example.invalid', 'https://example.invalid/a?x=1&y=2'); assert(closed);
  closed = false;
  nodemailer.createTransport = () => ({ sendMail: async () => ({ accepted: [], rejected: ['target@example.invalid'] }), close: () => { closed = true; } });
  await assert.rejects(sendGmailInvitation('target@example.invalid', 'https://example.invalid')); assert(closed);
  console.log('PASS: configuración Gmail, TLS, remitente, aceptación SMTP y rechazo; sin envío real.');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
