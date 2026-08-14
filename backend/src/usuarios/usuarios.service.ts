import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types, type ClientSession } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { Usuario, UsuarioDocument } from './schemas/usuario.schema.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioRolesDto } from './dto/update-usuario.dto.js';
import { UsuarioResponse } from './interfaces/usuario-response.interface.js';
import { EVENTO_USUARIO_AUTORIZACION_CAMBIADA } from './usuarios.constants.js';
import { Role } from '../common/constants/roles.enum.js';
import {
  Mesa,
  MesaDocument,
  MesaEstado,
} from '../mesas/schemas/mesa.schema.js';
import { Orden, OrdenDocument } from '../ordenes/schemas/orden.schema.js';
import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum.js';

const SALT_ROUNDS = 12;

const MSG_EMAIL_DUPLICADO = 'Ya existe un usuario con este email';
const MSG_USUARIO_NO_ENCONTRADO = 'Usuario no encontrado';
const MSG_ID_INVALIDO = 'ID de usuario inválido';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Mesa.name)
    private readonly mesaModel: Model<MesaDocument>,
    @InjectModel(Orden.name)
    private readonly ordenModel: Model<OrdenDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async crear(dto: CreateUsuarioDto): Promise<UsuarioResponse> {
    const existente = await this.usuarioModel.findOne({ email: dto.email });
    if (existente) {
      throw new ConflictException(MSG_EMAIL_DUPLICADO);
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const usuario = await this.usuarioModel.create({
      ...dto,
      password: hashedPassword,
    });

    return this._toResponse(usuario);
  }

  async buscarPorEmail(email: string): Promise<UsuarioDocument> {
    const usuario = await this.usuarioModel
      .findOne({ email })
      .select('+password');

    if (!usuario) {
      throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
    }

    return usuario;
  }

  async buscarPorId(id: string): Promise<UsuarioResponse> {
    this._validarObjectId(id);

    const usuario = await this.usuarioModel.findById(id);
    if (!usuario) {
      throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
    }

    return this._toResponse(usuario);
  }

  async listarTodos(): Promise<UsuarioResponse[]> {
    const usuarios = await this.usuarioModel
      .find({ activo: true })
      .sort({ nombre: 1 });

    return usuarios.map((doc) => this._toResponse(doc));
  }

  async actualizarRoles(
    id: string,
    dto: UpdateUsuarioRolesDto,
  ): Promise<UsuarioResponse> {
    this._validarObjectId(id);
    const session = await this.usuarioModel.db.startSession();
    let usuarioActualizado: UsuarioResponse | null = null;

    try {
      await session.withTransaction(async () => {
        const usuarioActual = await this.usuarioModel
          .findById(id)
          .session(session);

        if (!usuarioActual) {
          throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
        }

        if (
          usuarioActual.roles.includes(Role.MESERO) &&
          !dto.roles.includes(Role.MESERO)
        ) {
          await this._validarSinTrabajoMeseroActivo(id, session);
        }

        const usuario = await this.usuarioModel.findByIdAndUpdate(
          id,
          { roles: dto.roles },
          { new: true, session },
        );
        if (usuario) {
          usuarioActualizado = this._toResponse(usuario);
        }
      });
    } finally {
      await session.endSession();
    }

    if (!usuarioActualizado) {
      throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
    }

    this.eventEmitter.emit(EVENTO_USUARIO_AUTORIZACION_CAMBIADA, {
      usuarioId: id,
    });

    return usuarioActualizado;
  }

  async desactivar(id: string): Promise<void> {
    this._validarObjectId(id);
    const session = await this.usuarioModel.db.startSession();
    let usuarioDesactivado = false;

    try {
      await session.withTransaction(async () => {
        const usuarioActual = await this.usuarioModel
          .findById(id)
          .session(session);

        if (!usuarioActual) {
          throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
        }
        if (usuarioActual.roles.includes(Role.MESERO)) {
          await this._validarSinTrabajoMeseroActivo(id, session);
        }

        const usuario = await this.usuarioModel.findByIdAndUpdate(
          id,
          { activo: false },
          { new: true, session },
        );
        usuarioDesactivado = Boolean(usuario);
      });
    } finally {
      await session.endSession();
    }

    if (!usuarioDesactivado) {
      throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
    }

    this.eventEmitter.emit(EVENTO_USUARIO_AUTORIZACION_CAMBIADA, {
      usuarioId: id,
    });
  }

  private _toResponse(doc: UsuarioDocument): UsuarioResponse {
    return {
      id: doc._id.toString(),
      nombre: doc.nombre,
      email: doc.email,
      roles: doc.roles,
      activo: doc.activo,
      createdAt: doc.createdAt,
    };
  }

  private _validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(MSG_ID_INVALIDO);
    }
  }

  private async _validarSinTrabajoMeseroActivo(
    id: string,
    session: ClientSession,
  ): Promise<void> {
    const meseroId = new Types.ObjectId(id);
    const [mesaAsignada, ordenActiva] = await Promise.all([
      this.mesaModel
        .exists({
          meseroActual: meseroId,
          estado: { $in: [MesaEstado.OCUPADA, MesaEstado.CUENTA_PEDIDA] },
        })
        .session(session),
      this.ordenModel
        .exists({
          mesero: meseroId,
          estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
        })
        .session(session),
    ]);

    if (mesaAsignada || ordenActiva) {
      throw new ConflictException(
        'No se puede quitar el rol MESERO ni desactivar este usuario mientras tenga mesas u órdenes activas. Finalice o reasigne su trabajo primero.',
      );
    }
  }
}
