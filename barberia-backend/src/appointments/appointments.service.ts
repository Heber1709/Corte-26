import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus, AccountStatus } from '@prisma/client';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Cálculo de horarios libres (11:00 a 19:30 + 5 min buffer)
  async getAvailableSlots(barberId: number, serviceId: number, dateStr: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const totalDurationWithBuffer = service.durationMinutes + 5; //[cite: 1, 2]

    // Horario laboral: 11:00 a 19:30
    const openingTime = new Date(`${dateStr}T11:00:00`);
    const closingTime = new Date(`${dateStr}T19:30:00`);

    const bookedAppointments = await this.prisma.appointment.findMany({
      where: {
        barberId,
        startTime: { gte: openingTime },
        endTime: { lte: closingTime },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      orderBy: { startTime: 'asc' },
    });

    const availableSlots: { time: string }[] = [];
    let cursor = new Date(openingTime);

    while (cursor.getTime() + totalDurationWithBuffer * 60000 <= closingTime.getTime()) {
      const slotEndWithBuffer = new Date(cursor.getTime() + totalDurationWithBuffer * 60000);

      const hasConflict = bookedAppointments.some((appointment) => {
        const appointmentStart = new Date(appointment.startTime).getTime();
        const appointmentEndWithBuffer =
          new Date(appointment.endTime).getTime() + 5 * 60000;
        return (
          cursor.getTime() < appointmentEndWithBuffer &&
          slotEndWithBuffer.getTime() > appointmentStart
        );
      });

      if (!hasConflict) {
        const hours = cursor.getHours().toString().padStart(2, '0');
        const minutes = cursor.getMinutes().toString().padStart(2, '0');
        availableSlots.push({ time: `${hours}:${minutes}` });
      }

      cursor = new Date(cursor.getTime() + 15 * 60000);
    }

    return availableSlots;
  }

  // 2. Agendar Cita
  async create(dto: CreateAppointmentDto) {
    const client = await this.prisma.user.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    if (client.accountStatus === AccountStatus.BLOCKED || client.strikes >= 3) { //[cite: 1, 2]
      throw new ForbiddenException(
        'Your account has been suspended due to 3 or more no-shows. Contact support.',
      );
    }

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const startTime = new Date(`${dto.date}T${dto.time}:00`);
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60000);
    const endTimeWithBuffer = new Date(
      startTime.getTime() + (service.durationMinutes + 5) * 60000,
    );

    // Validación de límites de horario
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    const endMinutes = endTime.getMinutes();

    if (startHour < 11 || endHour > 19 || (endHour === 19 && endMinutes > 30)) { //[cite: 1, 2]
      throw new BadRequestException('Appointment exceeds business hours (11:00 - 19:30)');
    }

    const overlappingAppointment = await this.prisma.appointment.findFirst({
      where: {
        barberId: dto.barberId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startTime: { lt: endTimeWithBuffer },
        endTime: { gt: new Date(startTime.getTime() - 5 * 60000) },
      },
    });

    if (overlappingAppointment) {
      throw new BadRequestException('Barber is unavailable at this scheduled time');
    }

    let isPaidWithPoints = false;
    let earnedPoints = Math.floor(Number(service.price)); //[cite: 1, 2]

    if (dto.paidWithPoints) {
      if (!service.requiredPoints || client.points < service.requiredPoints) { //[cite: 1, 2]
        throw new BadRequestException(
          `Insufficient points. Required: ${service.requiredPoints} points.`,
        );
      }
      isPaidWithPoints = true;
      earnedPoints = 0;
    }

    return this.prisma.$transaction(async (tx) => {
      if (isPaidWithPoints) {
        await tx.user.update({
          where: { id: client.id },
          data: { points: { decrement: service.requiredPoints! } },
        });
      }

      return tx.appointment.create({
        data: {
          clientId: dto.clientId,
          barberId: dto.barberId,
          serviceId: dto.serviceId,
          startTime,
          endTime,
          chargedPrice: service.price, //[cite: 1, 2]
          earnedPoints,
          paidWithPoints: isPaidWithPoints,
          status: AppointmentStatus.PENDING,
        },
      });
    });
  }

  // 3. Actualizar estado
  async updateStatus(appointmentId: number, newStatus: AppointmentStatus) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { client: true },
      });

      if (!appointment) throw new NotFoundException('Appointment not found');

      if (
        newStatus === AppointmentStatus.COMPLETED &&
        appointment.status !== AppointmentStatus.COMPLETED
      ) {
        if (!appointment.paidWithPoints && appointment.earnedPoints > 0) { //[cite: 1, 2]
          await tx.user.update({
            where: { id: appointment.clientId },
            data: { points: { increment: appointment.earnedPoints } }, //[cite: 1, 2]
          });
        }
      }

      if (
        newStatus === AppointmentStatus.NO_SHOW &&
        appointment.status !== AppointmentStatus.NO_SHOW
      ) {
        const totalStrikes = appointment.client.strikes + 1; //[cite: 1, 2]
        await tx.user.update({
          where: { id: appointment.clientId },
          data: {
            strikes: totalStrikes,
            accountStatus:
              totalStrikes >= 3 ? AccountStatus.BLOCKED : appointment.client.accountStatus, //[cite: 1, 2]
          },
        });
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: { status: newStatus },
      });
    });
  }

  // 4. Cancelar con al menos 1 hora de anticipación
  async cancelByClient(appointmentId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    const now = new Date().getTime();
    const appointmentStartTime = new Date(appointment.startTime).getTime();

    if (appointmentStartTime - now < 60 * 60 * 1000) { //[cite: 1, 2]
      throw new BadRequestException(
        'Appointments can only be cancelled at least 1 hour in advance',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (appointment.paidWithPoints) {
        const service = await tx.service.findUnique({
          where: { id: appointment.serviceId },
        });
        if (service?.requiredPoints) {
          await tx.user.update({
            where: { id: appointment.clientId },
            data: { points: { increment: service.requiredPoints } },
          });
        }
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CANCELLED },
      });
    });
  }
  // 5. Historial de Citas del Cliente
  async getClientAppointments(clientId: number) {
    return this.prisma.appointment.findMany({
      where: { clientId },
      include: {
        barber: { select: { name: true } },
        service: { select: { name: true, price: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  // 6. Agenda del Barbero para un día específico
  async getBarberSchedule(barberId: number, dateStr: string) {
    const startOfDay = new Date(`${dateStr}T00:00:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59`);
    
    return this.prisma.appointment.findMany({
      where: {
        barberId,
        startTime: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        client: { select: { name: true, phone: true, strikes: true } },
        service: { select: { name: true, durationMinutes: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }
}