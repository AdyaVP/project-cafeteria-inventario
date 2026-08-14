import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { Role } from '../../common/constants/roles.enum';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const usuarioId = new Types.ObjectId().toHexString();
  const payload = {
    sub: usuarioId,
    email: 'viejo@demo.local',
    roles: [Role.ADMIN],
  };

  let strategy: JwtStrategy;
  let usuariosService: Record<string, jest.Mock>;

  beforeEach(async () => {
    usuariosService = { buscarPorId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: UsuariosService, useValue: usuariosService },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('autoriza con email y roles actuales, no con los claims viejos', async () => {
    usuariosService.buscarPorId.mockResolvedValue({
      id: usuarioId,
      nombre: 'Usuario',
      email: 'actual@demo.local',
      roles: [Role.MESERO],
      activo: true,
      createdAt: new Date(),
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      sub: usuarioId,
      email: 'actual@demo.local',
      roles: [Role.MESERO],
    });
  });

  it('rechaza un usuario desactivado aunque el JWT siga vigente', async () => {
    usuariosService.buscarPorId.mockResolvedValue({
      id: usuarioId,
      nombre: 'Usuario',
      email: payload.email,
      roles: payload.roles,
      activo: false,
      createdAt: new Date(),
    });

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un JWT cuyo usuario ya no existe', async () => {
    usuariosService.buscarPorId.mockRejectedValue(new Error('no existe'));

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
