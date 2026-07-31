import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';

import { Mesa, MesaDocument, MesaEstado } from './schemas/mesa.schema.js';

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

  async buscarPorId(id: string): Promise<MesaResponse> {
    this._validarObjectId(id);

    const mesa = await this.mesaModel
      .findById(id)
      .populate<{
        meseroActual: {
          _id: mongoose.Types.ObjectId;
          nombre: string;
        } | null;
      }>('meseroActual', 'nombre')
      .exec();

    if (!mesa) {
      throw new NotFoundException(`Mesa con id ${id} no encontrada`);
    }

    return this._toResponse(mesa);
  }
  async abrirMesa(mesaId: string, meseroId: string): Promise<MesaResponse> {
    this._validarObjectId(mesaId);
    this._validarObjectId(meseroId);

    const mesa = await this.mesaModel.findById(mesaId).exec();

    if (!mesa) {
      throw new NotFoundException(`Mesa con id ${mesaId} no encontrada`);
    }

    this._validarTransicion(mesa.estado, MesaEstado.OCUPADA);

    mesa.estado = MesaEstado.OCUPADA;
    mesa.meseroActual = new mongoose.Types.ObjectId(meseroId);
    mesa.abiertaEn = new Date();
    mesa.cerradaEn = null;

    await mesa.save();

    this.eventEmitter.emit('mesa.estado.cambiado', {
      mesaId: mesa._id.toString(),
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

  async solicitarCuenta(mesaId: string): Promise<MesaResponse> {
    this._validarObjectId(mesaId);

    const mesa = await this.mesaModel.findById(mesaId).exec();

    if (!mesa) {
      throw new NotFoundException(`Mesa con id ${mesaId} no encontrada`);
    }

    this._validarTransicion(mesa.estado, MesaEstado.CUENTA_PEDIDA);

    mesa.estado = MesaEstado.CUENTA_PEDIDA;

    await mesa.save();

    this.eventEmitter.emit('mesa.estado.cambiado', {
      mesaId: mesa._id.toString(),
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
