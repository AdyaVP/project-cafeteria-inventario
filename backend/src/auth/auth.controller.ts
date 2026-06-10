import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Response } from 'express';

import { AuthService } from './auth.service.js';
import { LoginSchema } from './dto/login.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { CreateUsuarioSchema } from '../usuarios/dto/create-usuario.dto.js';
import type { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto.js';
import type { AuthResponse } from './interfaces/auth-response.interface.js';
import type { UsuarioResponse } from '../usuarios/interfaces/usuario-response.interface.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Role } from '../common/constants/roles.enum.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

const COOKIE_NAME = 'access_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { token, user } = await this.authService.login(dto);

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: SEVEN_DAYS_MS,
    });

    return { user, message: 'Login exitoso' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @Res({ passthrough: true }) res: Response,
  ): { message: string } {
    res.clearCookie(COOKIE_NAME);
    return { message: 'Logout exitoso' };
  }

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload): Promise<UsuarioResponse> {
    return this.authService.getMe(user.sub);
  }

  @Roles(Role.ADMIN)
  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateUsuarioSchema))
  async registro(@Body() dto: CreateUsuarioDto): Promise<UsuarioResponse> {
    return this.usuariosService.crear(dto);
  }
}
