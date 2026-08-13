import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { Role } from '../common/constants/roles.enum.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { EVENTO_USUARIO_AUTORIZACION_CAMBIADA } from '../usuarios/usuarios.constants.js';
import type { UsuarioAutorizacionCambiadaPayload } from '../usuarios/usuarios.constants.js';

import {
  SALA_COCINA,
  EVENTO_WS_NUEVA_ORDEN,
  EVENTO_WS_ORDEN_ACTUALIZADA,
  EVENTO_WS_MESA_ACTUALIZADA,
  EVENTO_ORDEN_CREADA,
  EVENTO_MESA_ESTADO_CAMBIADO,
} from './cocina.constants.js';

interface OrdenCreadaPayload {
  ordenes: unknown[];
  mesaId: string;
  timestamp: Date;
}

interface MesaCambiadaPayload {
  mesaId: string;
  nuevoEstado: string;
  timestamp: Date;
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  namespace: '/cocina',
})
@Injectable()
export class CocinaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this._extraerToken(client);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const usuario = await this.usuariosService.buscarPorId(payload.sub);

      if (!usuario.activo) {
        client.disconnect();
        return;
      }

      const autorizacionActual: JwtPayload = {
        sub: usuario.id,
        email: usuario.email,
        roles: usuario.roles,
      };

      const clientData = client.data as unknown as Record<string, unknown>;
      clientData.usuario = autorizacionActual;

      // Room personal por usuario: recibe eventos dirigidos a su sesion
      await client.join(`user:${autorizacionActual.sub}`);

      if (autorizacionActual.roles.includes(Role.COCINA)) {
        await client.join(SALA_COCINA);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(): void {}

  @OnEvent(EVENTO_USUARIO_AUTORIZACION_CAMBIADA)
  manejarAutorizacionUsuarioCambiada(
    payload: UsuarioAutorizacionCambiadaPayload,
  ): void {
    this.server.in(`user:${payload.usuarioId}`).disconnectSockets(true);
  }

  @OnEvent(EVENTO_ORDEN_CREADA)
  manejarOrdenCreada(payload: OrdenCreadaPayload): void {
    this.server.to(SALA_COCINA).emit(EVENTO_WS_NUEVA_ORDEN, payload);
  }

  @OnEvent(EVENTO_MESA_ESTADO_CAMBIADO)
  manejarMesaCambiada(payload: MesaCambiadaPayload): void {
    this.server.emit(EVENTO_WS_MESA_ACTUALIZADA, payload);
  }

  emitirEstadoOrden(
    ordenId: string,
    nuevoEstado: OrdenEstado,
    meseroId: string,
    mesa: { id: string; numero: number },
    tipo: string,
  ): void {
    const payload = {
      ordenId,
      mesaId: mesa.id,
      mesaNumero: mesa.numero,
      meseroId,
      tipo,
      nuevoEstado,
      timestamp: new Date(),
    };

    this.server.to(SALA_COCINA).emit(EVENTO_WS_ORDEN_ACTUALIZADA, payload);
    this.server
      .to(`user:${meseroId}`)
      .emit(EVENTO_WS_ORDEN_ACTUALIZADA, payload);
  }

  private _extraerToken(client: Socket): string | null {
    const cookie = client.handshake.headers.cookie;

    if (!cookie) {
      return null;
    }

    const match = cookie.match(/access_token=([^;]+)/);

    return match ? match[1] : null;
  }
}
