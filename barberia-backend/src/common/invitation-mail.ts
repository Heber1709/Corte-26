import { ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
export function gmailConfig() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) throw new ServiceUnavailableException('Falta configurar GMAIL_USER y GMAIL_APP_PASSWORD en el backend.');
  return { host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 };
}
export async function sendGmailInvitation(to: string, link: string) {
  const config = gmailConfig();
  const transporter = nodemailer.createTransport(config);
  try {
    const info = await transporter.sendMail({
      from: { name: 'Barbería Corte-26', address: config.auth.user }, to,
      subject: 'Invitación de administrador · Barbería Corte-26',
      text: 'Te invitaron a administrar Barbería Corte-26. Abre el enlace, inicia sesión con este mismo correo de Google y acepta. Vence en 48 horas.\n\n' + link,
      html: '<p>Te invitaron a administrar Barbería Corte-26.</p><p>Inicia sesión con este mismo correo de Google y confirma tu aceptación. El enlace vence en 48 horas.</p><p><a href="' + link.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">Aceptar invitación</a></p>',
    });
    if (!info.accepted?.length || info.rejected?.length) throw new Error('Correo no aceptado por Gmail');
  } finally { transporter.close(); }
}
