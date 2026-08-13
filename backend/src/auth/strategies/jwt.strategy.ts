import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';

const MSG_SESION_INVALIDA = 'La sesión ya no es válida';

function extractFromCookie(req: Request): string | null {
  const cookies = req?.cookies as unknown;

  if (!cookies || typeof cookies !== 'object') {
    return null;
  }

  const token = (cookies as Record<string, unknown>).access_token;
  return typeof token === 'string' ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usuariosService: UsuariosService,
  ) {
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    try {
      const usuario = await this.usuariosService.buscarPorId(payload.sub);

      if (!usuario.activo) {
        throw new UnauthorizedException(MSG_SESION_INVALIDA);
      }

      return {
        sub: usuario.id,
        email: usuario.email,
        roles: usuario.roles,
      };
    } catch {
      throw new UnauthorizedException(MSG_SESION_INVALIDA);
    }
  }
}
