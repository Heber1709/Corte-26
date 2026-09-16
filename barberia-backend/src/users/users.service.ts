import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getBarbers() {
    return this.prisma.user.findMany({
      where: { role: Role.BARBER },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, points: true, strikes: true, accountStatus: true, role: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }
}