import { PasswordAuthService } from './password-auth.service';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'corte26_super_secret_jwt_key_2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [PasswordAuthService, AuthService, JwtStrategy, GoogleStrategy],
  exports: [JwtStrategy, GoogleStrategy, PassportModule],
})
export class AuthModule {}