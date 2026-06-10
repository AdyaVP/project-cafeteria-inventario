import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { UsuariosService } from '../usuarios/usuarios.service.js';
import { UsuarioDocument } from '../usuarios/schemas/usuario.schema.js';
import { UsuarioResponse } from '../usuarios/interfaces/usuario-response.interface.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

const MSG_CREDENCIALES_INVALIDAS = 'Credenciales inválidas';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<{ token: string; user: UsuarioResponse }> {
    let usuario: UsuarioDocument;
    try {
      usuario = await this.usuariosService.buscarPorEmail(dto.email);
    } catch {
      throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
    }

    const passwordValido = await bcrypt.compare(dto.password, usuario.password);
    if (!passwordValido) {
      throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
    }

    if (!usuario.activo) {
      throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
    }

    const payload: JwtPayload = {
      sub: usuario._id.toString(),
      email: usuario.email,
      roles: usuario.roles,
    };

    const token = this.jwtService.sign(payload);

    return { token, user: this._toPublicUser(usuario) };
  }

  async getMe(userId: string): Promise<UsuarioResponse> {
    return this.usuariosService.buscarPorId(userId);
  }

  private _toPublicUser(doc: UsuarioDocument): UsuarioResponse {
    return {
      id: doc._id.toString(),
      nombre: doc.nombre,
      email: doc.email,
      roles: doc.roles,
      activo: doc.activo,
      createdAt: doc.createdAt,
    };
  }
}
