import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';

import { Mesa, MesaDocument, MesaEstado } from './schemas/mesa.schema.js';
import { Orden, OrdenDocument } from '../ordenes/schemas/orden.schema.js';
import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum.js';
import {
  Usuario,
  UsuarioDocument,
} from '../usuarios/schemas/usuario.schema.js';
import { Role } from '../common/constants/roles.enum.js';

import { MesaResponse } from './interfaces/mesa-response.interface.js';
import { CreateMesaDto } from './dto/create-mesa.dto.js';

const TRANSICIONES_VALIDAS: Record<MesaEstado, MesaEstado[]> = {
  [MesaEstado.LIBRE]: [MesaEstado.OCUPADA],
  [MesaEstado.OCUPADA]: [MesaEstado.CUENTA_PEDIDA],
  [MesaEstado.CUENTA_PEDIDA]: [MesaEstado.LIBRE],
  [MesaEstado.CERRADA]: [],
};

interface MesaDocumentoPopulado extends Omit<MesaDocument, 'meseroActual'> {
  meseroActual: {
    _id: mongoose.Types.ObjectId;
    nombre: string;
  } | null;
}

@Injectable()
export class MesasService {
  constructor(
    @InjectModel(Mesa.name)
    private readonly mesaModel: Model<MesaDocument>,
    @InjectModel(Orden.name)
    private readonly ordenModel: Model<OrdenDocument>,
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async crear(dto: CreateMesaDto): Promise<MesaResponse> {
    const mesaExistente = await this.mesaModel
      .findOne({ numero: dto.numero })
      .lean()
      .exec();

    if (mesaExistente) {
      throw new ConflictException(
        `Ya existe una mesa con el número ${dto.numero}`,
      );
    }

    const mesa = await this.mesaModel.create({
      numero: dto.numero,
      capacidad: dto.capacidad,
      estado: MesaEstado.LIBRE,
      meseroActual: null,
      abiertaEn: null,
      cerradaEn: null,
    });

    const mesaPopulada = await this.mesaModel
      .findById(mesa._id)
      .populate<{
        meseroActual: {
          _id: mongoose.Types.ObjectId;
          nombre: string;
        } | null;
      }>('meseroActual', 'nombre')
      .exec();

    this.eventEmitter.emit('mesa.estado.cambiado', {
      mesaId: mesa._id.toString(),
      nuevoEstado: MesaEstado.LIBRE,
      timestamp: new Date(),
    });

    return this._toResponse(mesaPopulada as unknown as MesaDocumentoPopulado);
  }

  async listarTodas(): Promise<MesaResponse[]> {
    const mesas = await this.mesaModel
      .find()
      .populate<{
        meseroActual: {
          _id: mongoose.Types.ObjectId;
          nombre: string;
        } | null;
      }>('meseroActual', 'nombre')
      .sort({ numero: 1 })
      .exec();

    return mesas.map((mesa) =>
      this._toResponse(mesa as unknown as MesaDocumentoPopulado),
    );
  }

  async buscarPorId(
    id: string,
    session?: ClientSession,
  ): Promise<MesaResponse> {
    this._validarObjectId(id);

    const query = this.mesaModel.findById(id).populate<{
      meseroActual: {
        _id: mongoose.Types.ObjectId;
        nombre: string;
      } | null;
    }>('meseroActual', 'nombre');

    const mesa = session
      ? await query.session(session).exec()
      : await query.exec();

    if (!mesa) {
      throw new NotFoundException(`Mesa con id ${id} no encontrada`);
    }

    return this._toResponse(mesa);
  }

  async confirmarMesaAceptaOrden(
    mesaId: string,
    meseroId: string,
    abiertaEn: Date | null,
    session: ClientSession,
  ): Promise<void> {
    if (!abiertaEn) {
      throw new BadRequestException(
        'La mesa no tiene una sesión abierta válida',
      );
    }

    const resultado = await this.mesaModel
      .updateOne(
        {
          _id: new mongoose.Types.ObjectId(mesaId),
          estado: MesaEstado.OCUPADA,
          meseroActual: new mongoose.Types.ObjectId(meseroId),
          abiertaEn,
        },
        { $set: { ultimaOrdenEn: new Date() } },
        { session },
      )
      .exec();

    if (resultado.matchedCount !== 1) {
      throw new BadRequestException(
        'La mesa cambió de estado mientras se creaba la orden. Intente nuevamente.',
      );
    }
  }

  async confirmarMeseroActivo(
    meseroId: string,
    session: ClientSession,
  ): Promise<boolean> {
    const usuario = await this.usuarioModel
      .findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(meseroId),
          activo: true,
          roles: Role.MESERO,
        },
        { $set: { ultimaAsignacionEn: new Date() } },
        { new: true, session },
      )
      .exec();

    return Boolean(usuario);
  }

  async abrirMesa(mesaId: string, meseroId: string): Promise<MesaResponse> {
    this._validarObjectId(mesaId);
    this._validarObjectId(meseroId);
    const session = await this.mesaModel.db.startSession();
    let mesaIdAbierta: string | null = null;

    try {
      await session.withTransaction(async () => {
        if (!(await this.confirmarMeseroActivo(meseroId, session))) {
          throw new ForbiddenException(
            'El usuario ya no está activo o no tiene rol MESERO',
          );
        }

        const mesa = await this.mesaModel
          .findOneAndUpdate(
            {
              _id: new mongoose.Types.ObjectId(mesaId),
              estado: MesaEstado.LIBRE,
            },
            {
              $set: {
                estado: MesaEstado.OCUPADA,
                meseroActual: new mongoose.Types.ObjectId(meseroId),
                abiertaEn: new Date(),
                cerradaEn: null,
                ultimaOrdenEn: null,
              },
            },
            { new: true, session },
          )
          .exec();

        if (!mesa) {
          throw new ConflictException(
            'La mesa ya no está libre. Actualice la vista e intente nuevamente.',
          );
        }
        mesaIdAbierta = mesa._id.toString();
      });
    } finally {
      await session.endSession();
    }

    if (!mesaIdAbierta) {
      const actual = await this.mesaModel.findById(mesaId).exec();
      if (!actual) {
        throw new NotFoundException(`Mesa con id ${mesaId} no encontrada`);
      }
      throw new BadRequestException(
        `Transición inválida: una mesa en estado ${actual.estado} no puede pasar a OCUPADA`,
      );
    }

    this.eventEmitter.emit('mesa.estado.cambiado', {
      mesaId: mesaIdAbierta,
      nuevoEstado: MesaEstado.OCUPADA,
      timestamp: new Date(),
    });

    const mesaPopulada = await this.mesaModel
      .findById(mesaId)
      .populate<{
        meseroActual: {
          _id: mongoose.Types.ObjectId;
          nombre: string;
        } | null;
      }>('meseroActual', 'nombre')
      .exec();

    return this._toResponse(mesaPopulada as unknown as MesaDocumentoPopulado);
  }

  async solicitarCuenta(
    mesaId: string,
    meseroId: string,
  ): Promise<MesaResponse> {
    this._validarObjectId(mesaId);
    this._validarObjectId(meseroId);
    const session = await this.mesaModel.db.startSession();
    let mesaActualizadaId: string | null = null;

    try {
      await session.withTransaction(async () => {
        const mesaActual = await this.mesaModel
          .findById(mesaId)
          .session(session)
          .exec();

        if (!mesaActual) {
          throw new NotFoundException(`Mesa con id ${mesaId} no encontrada`);
        }
        if (mesaActual.estado !== MesaEstado.OCUPADA) {
          throw new BadRequestException(
            `Transición inválida: una mesa en estado ${mesaActual.estado} no puede pasar a CUENTA_PEDIDA`,
          );
        }
        if (mesaActual.meseroActual?.toString() !== meseroId) {
          throw new ForbiddenException(
            'Solo el mesero asignado puede solicitar la cuenta de esta mesa',
          );
        }
        if (!mesaActual.abiertaEn) {
          throw new BadRequestException(
            'La mesa no tiene una sesión abierta válida',
          );
        }

        const filtroSesion = {
          mesa: new mongoose.Types.ObjectId(mesaId),
          createdAt: { $gte: mesaActual.abiertaEn },
        };
        const [ordenesActivas, ordenesEntregadas] = await Promise.all([
          this.ordenModel
            .countDocuments({
              ...filtroSesion,
              estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
            })
            .session(session)
            .exec(),
          this.ordenModel
            .countDocuments({
              ...filtroSesion,
              estadoGeneral: OrdenEstado.ENTREGADA,
            })
            .session(session)
            .exec(),
        ]);

        if (ordenesActivas > 0) {
          throw new BadRequestException(
            'Hay órdenes sin entregar en esta mesa. Entregue todas las órdenes antes de solicitar la cuenta.',
          );
        }
        if (ordenesEntregadas === 0) {
          throw new BadRequestException(
            'No se puede solicitar la cuenta sin órdenes entregadas en la sesión actual',
          );
        }

        const mesa = await this.mesaModel
          .findOneAndUpdate(
            {
              _id: new mongoose.Types.ObjectId(mesaId),
              estado: MesaEstado.OCUPADA,
              meseroActual: new mongoose.Types.ObjectId(meseroId),
              abiertaEn: mesaActual.abiertaEn,
            },
            { $set: { estado: MesaEstado.CUENTA_PEDIDA } },
            { new: true, session },
          )
          .exec();

        if (!mesa) {
          throw new ConflictException(
            'La mesa cambió mientras se solicitaba la cuenta. Intente nuevamente.',
          );
        }
        mesaActualizadaId = mesa._id.toString();
      });
    } finally {
      await session.endSession();
    }

    if (!mesaActualizadaId) {
      throw new ConflictException(
        'No se pudo solicitar la cuenta. Intente nuevamente.',
      );
    }

    this.eventEmitter.emit('mesa.estado.cambiado', {
      mesaId: mesaActualizadaId,
      nuevoEstado: MesaEstado.CUENTA_PEDIDA,
      timestamp: new Date(),
    });

    const mesaPopulada = await this.mesaModel
      .findById(mesaId)
      .populate<{
        meseroActual: {
          _id: mongoose.Types.ObjectId;
          nombre: string;
        } | null;
      }>('meseroActual', 'nombre')
      .exec();

    return this._toResponse(mesaPopulada as unknown as MesaDocumentoPopulado);
  }

  async cerrarMesa(mesaId: string): Promise<MesaResponse> {
    this._validarObjectId(mesaId);

    const mesa = await this.mesaModel.findById(mesaId).exec();

    if (!mesa) {
      throw new NotFoundException(`Mesa con id ${mesaId} no encontrada`);
    }

    this._validarTransicion(mesa.estado, MesaEstado.LIBRE);

    mesa.estado = MesaEstado.LIBRE;
    mesa.meseroActual = null;
    mesa.abiertaEn = null;
    mesa.cerradaEn = new Date();
    mesa.ultimaOrdenEn = null;

    await mesa.save();

    this.eventEmitter.emit('mesa.estado.cambiado', {
      mesaId: mesa._id.toString(),
      nuevoEstado: MesaEstado.LIBRE,
      timestamp: new Date(),
    });

    const mesaPopulada = await this.mesaModel
      .findById(mesaId)
      .populate<{
        meseroActual: {
          _id: mongoose.Types.ObjectId;
          nombre: string;
        } | null;
      }>('meseroActual', 'nombre')
      .exec();

    return this._toResponse(mesaPopulada as unknown as MesaDocumentoPopulado);
  }

  private _validarTransicion(
    estadoActual: MesaEstado,
    estadoDestino: MesaEstado,
  ): void {
    const transicionesPermitidas = TRANSICIONES_VALIDAS[estadoActual];

    if (!transicionesPermitidas.includes(estadoDestino)) {
      throw new BadRequestException(
        `Transición inválida: una mesa en estado ${estadoActual} no puede pasar a ${estadoDestino}. ` +
          `Estados permitidos desde ${estadoActual}: ${
            transicionesPermitidas.length > 0
              ? transicionesPermitidas.join(', ')
              : 'ninguno'
          }`,
      );
    }
  }

  private _validarObjectId(id: string): void {
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestException(`El id "${id}" no es un ObjectId válido`);
    }
  }

  private _toResponse(doc: MesaDocumentoPopulado): MesaResponse {
    return {
      id: doc._id.toString(),
      numero: doc.numero,
      capacidad: doc.capacidad,
      estado: doc.estado,
      meseroActual: doc.meseroActual
        ? {
            id: doc.meseroActual._id.toString(),
            nombre: doc.meseroActual.nombre,
          }
        : null,
      abiertaEn: doc.abiertaEn,
      cerradaEn: doc.cerradaEn,
    };
  }
}
