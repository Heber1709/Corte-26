import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scrypt as derive, createHash, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { sendRegistrationMail } from '../common/invitation-mail';
const scrypt = promisify(derive);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + ((await scrypt(password, salt, 64)) as Buffer).toString('hex');
}
export async function matchesPassword(password: string, hash: string) {
  const [salt, key] = hash.split(':');
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
@Injectable()
export class PasswordAuthService {
  constructor(private prisma: PrismaService, private auth: AuthService) {}
  private email(value: unknown) {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new BadRequestException('Escribe un correo válido.');
    return value.trim().toLowerCase();
  }
  private password(value: unknown) {
    if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new BadRequestException('La contraseña debe tener entre 12 y 128 caracteres.');
    return value;
  }
  async register(body: { email?: unknown; password?: unknown; name?: unknown }) {
    const email = this.email(body.email), password = this.password(body.password);
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) throw new BadRequestException('Escribe tu nombre (máximo 100 caracteres).');
    const message = 'Si el correo puede registrarse, recibirás una invitación. Si ya tienes cuenta, inicia sesión con tu método habitual.';
    if (await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) return { message };
    const previous = await this.prisma.emailRegistration.findUnique({ where: { email } });
    if (previous && Date.now() - previous.sentAt.getTime() < 60000) return { message };
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const data = { name: body.name.trim(), passwordHash: await hashPassword(password), tokenHash, expiresAt: new Date(Date.now() + 86400000), sentAt: new Date() };
    await this.prisma.emailRegistration.upsert({ where: { email }, create: { email, ...data }, update: data });
    const base = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');
    try { await sendRegistrationMail(email, `${base}/login#registration=${token}`); }
    catch (error) { await this.prisma.emailRegistration.deleteMany({ where: { email, tokenHash } }); throw error; }
    return { message };
  }
  async accept(token: unknown) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new BadRequestException('Invitación inválida.');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.$transaction(async tx => {
      const pending = await tx.emailRegistration.findUnique({ where: { tokenHash } });
      if (!pending || pending.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Invitación vencida o ya utilizada. Regístrate nuevamente para recibir otra.');
      const consumed = await tx.emailRegistration.deleteMany({ where: { tokenHash } });
      if (!consumed.count) throw new BadRequestException('Invitación ya utilizada.');
      if (await tx.user.findFirst({ where: { email: { equals: pending.email, mode: 'insensitive' } } })) throw new BadRequestException('Ya existe una cuenta con este correo. Usa tu método de acceso habitual.');
      const user = await tx.user.create({ data: { email: pending.email, name: pending.name, role: 'CLIENT' } });
      await tx.passwordCredential.create({ data: { userId: user.id, hash: pending.passwordHash } });
    });
    return { message: 'Solicitud aceptada. Ya puedes iniciar sesión con tu correo y contraseña.' };
  }
  async login(body: { email?: unknown; password?: unknown }) {
    const email = this.email(body.email), password = this.password(body.password);
    const user = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    const credential = user && await this.prisma.passwordCredential.findUnique({ where: { userId: user.id } });
    const deny = () => new UnauthorizedException('Correo o contraseña incorrectos, cuenta sin confirmar o acceso temporalmente bloqueado.');
    if (!credential || !user || user.accountStatus === 'BLOCKED' || (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now())) throw deny();
    if (!(await matchesPassword(password, credential.hash))) {
      const updated = await this.prisma.passwordCredential.update({ where: { userId: user.id }, data: { failures: { increment: 1 } } });
      if (updated.failures >= 5) await this.prisma.passwordCredential.update({ where: { userId: user.id }, data: { failures: 0, lockedUntil: new Date(Date.now() + 900000) } });
      throw deny();
    }
    await this.prisma.passwordCredential.update({ where: { userId: user.id }, data: { failures: 0, lockedUntil: null } });
    return this.auth.generateToken(user);
  }
}
