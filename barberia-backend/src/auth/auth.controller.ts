import { Controller, Get, Post, Req, UseGuards, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  
  // (Ojo: Para que esto funcione, necesitas inyectar AuthService en el constructor de este controlador)
  constructor(private readonly authService: AuthService) {}

  // 1. Redirige al usuario a la pantalla de Google
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  // 2. Google devuelve la respuesta aquí y mandamos el JWT
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req) {
    return {
      message: 'Inicio de sesión exitoso',
      tokenData: req.user, 
    };
  }
  // NUEVO: Atajo de desarrollo para el frontend en Angular
  @Post('login')
  async devLogin(@Body() body: { email: string }) {
    // Esto simula lo que haría Google
    const userWithToken = await this.authService.validateOrCreateGoogleUser({
      email: body.email,
      name: 'Usuario de Desarrollo', 
    });
    
    return userWithToken; // Esto devuelve directamente el { accessToken: '...', user: {...} }
  }
}
