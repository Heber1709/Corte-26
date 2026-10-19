import { PasswordAuthService } from './password-auth.service';
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly passwords: PasswordAuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const userData = req.user;
    const token =
      userData?.tokenData?.accessToken ||
      userData?.accessToken ||
      userData?.token;
    const role =
      userData?.tokenData?.user?.role ||
      userData?.user?.role ||
      userData?.role ||
      'CLIENT';

    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:4200'}/login#token=${encodeURIComponent(token)}&role=${role}`,
    );
  }

  @Post('login')
  login(@Body() body: { email?: unknown; password?: unknown }) { return this.passwords.login(body); }
  @Post('register')
  register(@Body() body: { email?: unknown; password?: unknown; name?: unknown }) { return this.passwords.register(body); }
  @Post('accept-registration')
  accept(@Body('token') token: unknown) { return this.passwords.accept(token); }
}
