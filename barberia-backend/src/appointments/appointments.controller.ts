import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { GetAvailableSlotsDto } from '../dto/get-available-slots.dto';
import { AppointmentStatus } from '@prisma/client';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('available')
  getAvailableSlots(@Query() query: GetAvailableSlotsDto) {
    return this.appointmentsService.getAvailableSlots(
      query.barberId,
      query.serviceId,
      query.date,
    );
  }

  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARBER, Role.ADMIN)
  
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: AppointmentStatus,
  ) {
    return this.appointmentsService.updateStatus(id, status);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.cancelByClient(id);
  }
  @UseGuards(JwtAuthGuard)
  @Get('my-appointments')
  getMyAppointments(@CurrentUser() user: any) {
    return this.appointmentsService.getClientAppointments(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARBER, Role.ADMIN)
  @Get('schedule')
  getSchedule(@CurrentUser() user: any, @Query('date') date: string) {
    return this.appointmentsService.getBarberSchedule(user.sub, date);
  }

}