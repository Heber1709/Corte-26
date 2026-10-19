import { gmailConfig, sendGmailInvitation } from '../common/invitation-mail';
import { createHash, randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '@prisma/client';
import { PersonDto, AdminDto } from '../dto/manage.dto';
import { can } from '../common/permissions';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  private superOnly(actor: User) {
    if (actor.role !== 'ADMIN' || !actor.isSuperAdmin) throw new ForbiddenException('Solo el superadministrador puede gestionar administradores');
  }
  administrators(actor: User) {
    this.superOnly(actor);
    return this.prisma.user.findMany({ where: { OR: [{ role: 'ADMIN' }, { adminInviteStatus: { not: null } }] }, select: { id: true, name: true, email: true, permissions: true, isSuperAdmin: true, adminInviteStatus: true, adminInviteExpires: true }, orderBy: { name: 'asc' } });
  }
  async saveAdministrator(actor: User, data: AdminDto) {
    this.superOnly(actor);
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.isSuperAdmin || existing?.id === actor.id) throw new ForbiddenException('No puedes modificar al superadministrador');
    if (existing?.role === 'BARBER') throw new BadRequestException('Esta cuenta es de un barbero. Usa otra cuenta.');
    if (existing?.role === 'ADMIN') {
      await this.prisma.user.update({ where: { id: existing.id }, data: { permissions: data.permissions } });
      return { success: true, status: 'ACTIVE' };
    }
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.INVITATION_FROM?.trim();
    const gmail = process.env.MAIL_PROVIDER === 'gmail';
    if (gmail) gmailConfig();
    if (!gmail && (!apiKey || !from)) throw new ServiceUnavailableException('Falta configurar el envío de invitaciones: RESEND_API_KEY e INVITATION_FROM.');
    if (existing?.adminInviteStatus === 'SENDING' && existing.updatedAt.getTime() > Date.now() - 60000)
      throw new BadRequestException('Ya se está enviando esta invitación. Espera un minuto.');
    if (existing?.adminInviteStatus === 'SENT' && existing.updatedAt.getTime() > Date.now() - 60000)
      throw new BadRequestException('Espera un minuto antes de reenviar la invitación.');
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const values = { permissions: data.permissions, adminInviteHash: hash, adminInviteExpires: new Date(Date.now() + 48 * 3600000), adminInviteStatus: 'SENDING' };
    let pending: { id: number };
    if (existing) {
      const claimed = await this.prisma.user.updateMany({ where: { id: existing.id, role: 'CLIENT', updatedAt: existing.updatedAt }, data: values });
      if (!claimed.count) throw new BadRequestException('La cuenta cambió mientras enviabas la solicitud. Actualiza el listado.');
      pending = existing;
    } else {
      try { pending = await this.prisma.user.create({ data: { email, name: data.name.trim(), ...values } }); }
      catch (error) { if (error.code === 'P2002') throw new BadRequestException('Esta cuenta acaba de cambiar. Actualiza el listado.'); throw error; }
    }
    const base = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');
    const link = base + '/aceptar-invitacion#invitation=' + token;
    try {
      if (gmail) {
        await sendGmailInvitation(email, link);
      } else {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Idempotency-Key': 'admin-invite-' + hash },
        body: JSON.stringify({ from, to: [email], subject: 'Invitación de administrador · Barbería Corte-26',
          text: 'Te invitaron a administrar Barbería Corte-26. Para aceptar, abre el enlace e inicia sesión con este mismo correo de Google. La invitación vence en 48 horas.\n\n' + link,
          html: '<p>Te invitaron a administrar Barbería Corte-26.</p><p>Inicia sesión con este mismo correo de Google y confirma tu aceptación. El enlace vence en 48 horas.</p><p><a href="' + link.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">Aceptar invitación</a></p>' })
      });
      if (!response.ok) throw new Error('mail rejected');
      const result = await response.json();
      if (!result.id) throw new Error('mail not confirmed');
      }
    } catch {
      await this.prisma.user.updateMany({ where: { id: pending.id, adminInviteHash: hash }, data: { adminInviteStatus: 'FAILED', adminInviteHash: null } });
      throw new ServiceUnavailableException('No se pudo enviar el correo. Revisa el proveedor y el remitente; puedes volver a intentar.');
    }
    await this.prisma.user.updateMany({ where: { id: pending.id, adminInviteHash: hash, adminInviteStatus: 'SENDING' }, data: { adminInviteStatus: 'SENT' } });
    return { success: true, status: 'SENT' };
  }
  async acceptAdministrator(actor: User, token: string) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new BadRequestException('Invitación inválida');
    const hash = createHash('sha256').update(token).digest('hex');
    const result = await this.prisma.user.updateMany({ where: {
      id: actor.id, role: 'CLIENT', accountStatus: 'ACTIVE', isSuperAdmin: false,
      adminInviteHash: hash, adminInviteStatus: 'SENT', adminInviteExpires: { gt: new Date() },
    }, data: { role: 'ADMIN', adminInviteStatus: 'ACCEPTED', adminInviteHash: null, adminInviteExpires: null } });
    if (!result.count) throw new BadRequestException('La invitación venció, fue cancelada o ya fue aceptada. Debes entrar con el correo invitado.');
    return { success: true };
  }
  async revokeAdministrator(actor: User, id: number) {
    this.superOnly(actor);
    const result = await this.prisma.user.updateMany({ where: { id, OR: [{ role: 'ADMIN' }, { adminInviteStatus: { not: null } }], isSuperAdmin: false, NOT: { id: actor.id } }, data: { role: 'CLIENT', permissions: [], adminInviteHash: null, adminInviteExpires: null, adminInviteStatus: null } });
    if (!result.count) throw new BadRequestException('No se puede quitar ese administrador');
    return { success: true };
  }
  getBarbers() {
    return this.prisma.user.findMany({
      where: { role: Role.BARBER, accountStatus: 'ACTIVE' },
      select: { id: true, name: true, profilePhoto: true },
      orderBy: { name: 'asc' },
    });
  }
  async getProfile(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { adminInviteHash, ...profile } = user;
    return profile;
  }
  async reactivate(actor: User, id: number) {
    if (!can(actor, 'LOYALTY')) throw new ForbiddenException();
    const user = await this.getProfile(id);
    if (user.role !== 'CLIENT')
      throw new BadRequestException('Solo se reactivan clientes');
    return this.prisma.user.update({
      where: { id },
      data: { accountStatus: 'ACTIVE', strikes: 0 },
    });
  }
  list(actor: User, role: Role = Role.CLIENT) {
    return this.prisma.user.findMany({
      where: actor.role === 'BARBER' || can(actor, role === 'BARBER' ? 'BARBERS' : 'CLIENTS') || (role === 'CLIENT' && (can(actor, 'APPOINTMENTS') || can(actor, 'LOYALTY'))) ? { role } : { id: actor.id },
      include: {
        clientAppointments: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
  async save(actor: User, data: PersonDto, role: Role, id?: number) {
    if (
      !(can(actor, role === 'BARBER' ? 'BARBERS' : 'CLIENTS') || (role === 'CLIENT' && actor.role === 'BARBER'))
    )
      throw new ForbiddenException();
    if (id) {
      const existing = await this.getProfile(id);
      if (existing.role !== role) throw new ForbiddenException();
    }
    try {
      const values = {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone || null,
        ...(role === 'BARBER' && data.profilePhoto !== undefined
          ? { profilePhoto: data.profilePhoto }
          : {}),
      };
      return id
        ? await this.prisma.user.update({ where: { id }, data: values })
        : await this.prisma.user.create({ data: { ...values, role } });
    } catch (e) {
      if (e.code === 'P2002')
        throw new BadRequestException('Ese correo ya está registrado');
      throw e;
    }
  }
}
