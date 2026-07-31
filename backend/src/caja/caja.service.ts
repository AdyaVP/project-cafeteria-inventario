import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { MesaEstado } from '../mesas/schemas/mesa.schema.js';
import { MesasService } from '../mesas/mesas.service.js';
import { OrdenesService } from '../ordenes/ordenes.service.js';

import {
  Factura,
  FacturaDocument,
  FacturaEstado,
  MetodoPago,
} from './schemas/factura.schema.js';

import type { EmitirFacturaDto } from './dto/emitir-factura.dto.js';

import type {
  FacturaResponse,
  ItemSnapshotResponse,
  PreCuentaResponse,
  ReporteDiario,
} from './interfaces/factura-response.interface.js';

const EVENTO_FACTURA_CREADA = 'factura.creada';

@Injectable()
export class CajaService {
  private readonly impuestoPorcentaje: number;

  constructor(
    @InjectModel(Factura.name)
    private readonly facturaModel: Model<FacturaDocument>,
    private readonly configService: ConfigService,
    private readonly mesasService: MesasService,
    private readonly ordenesService: OrdenesService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const impuesto = Number(
      this.configService.get<string>('IMPUESTO_PORCENTAJE'),
    );

    // Env llega como string: se valida antes de usar
    this.impuestoPorcentaje =
      Number.isFinite(impuesto) && impuesto >= 0 ? impuesto : 0;
  }

  async generarPreCuenta(mesaId: string): Promise<PreCuentaResponse> {
    this._validarObjectId(mesaId);

    const mesa = await this.mesasService.buscarPorId(mesaId);

    if (mesa.estado !== MesaEstado.CUENTA_PEDIDA) {
      throw new BadRequestException(
        `La mesa no tiene una cuenta pendiente. Estado actual: ${mesa.estado}`,
      );
    }

    // Solo las órdenes de la sesión actual: evita cobrar al siguiente
    // cliente órdenes de una sesión anterior
    const desde = mesa.abiertaEn ?? new Date(0);

    const ordenesPendientes = await this.ordenesService.listarPorMesa(
      mesaId,
      100,
      desde,
    );

    if (ordenesPendientes.length > 0) {
      throw new BadRequestException(
        'Hay órdenes sin entregar en esta mesa. Entregue todas las órdenes antes de facturar.',
      );
    }

    const ordenes = await this.ordenesService.listarEntregadasPorMesa(
      mesaId,
      desde,
    );

    if (ordenes.length === 0) {
      throw new BadRequestException(
        'No hay órdenes entregadas para facturar en esta mesa',
      );
    }

    const items: ItemSnapshotResponse[] = [];
    let subtotal = 0;

    for (const orden of ordenes) {
      for (const item of orden.items) {
        const itemSubtotal = this._round(item.precioUnitario * item.cantidad);

        items.push({
          nombre: item.nombreProducto,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: itemSubtotal,
        });

        subtotal += itemSubtotal;
      }
    }

    subtotal = this._round(subtotal);
    const impuesto = this._round(subtotal * (this.impuestoPorcentaje / 100));
    const total = this._round(subtotal + impuesto);

    return {
      mesa: { id: mesa.id, numero: mesa.numero },
      ordenes: ordenes.map((o) => ({ id: o.id })),
      items,
      subtotal,
      impuesto,
      total,
    };
  }

  async emitirFactura(
    cajeroId: string,
    dto: EmitirFacturaDto,
  ): Promise<FacturaResponse> {
    this._validarObjectId(dto.mesaId);
    this._validarObjectId(cajeroId);

    // PASO 1 — Verificar que la mesa existe y está en CUENTA_PEDIDA
    const mesa = await this.mesasService.buscarPorId(dto.mesaId);

    if (mesa.estado !== MesaEstado.CUENTA_PEDIDA) {
      throw new BadRequestException(
        `La mesa no tiene una cuenta pendiente. Estado actual: ${mesa.estado}`,
      );
    }

    // PASO 2 — Generar el snapshot de ítems en el momento exacto del pago
    const desde = mesa.abiertaEn ?? new Date(0);

    const ordenesPendientes = await this.ordenesService.listarPorMesa(
      dto.mesaId,
      100,
      desde,
    );

    if (ordenesPendientes.length > 0) {
      throw new BadRequestException(
        'Hay órdenes sin entregar en esta mesa. Entregue todas las órdenes antes de facturar.',
      );
    }

    const ordenes = await this.ordenesService.listarEntregadasPorMesa(
      dto.mesaId,
      desde,
    );

    if (ordenes.length === 0) {
      throw new BadRequestException(
        'No hay órdenes entregadas para facturar en esta mesa',
      );
    }

    const itemsSnapshot: ItemSnapshotResponse[] = [];
    let subtotal = 0;

    for (const orden of ordenes) {
      for (const item of orden.items) {
        const itemSubtotal = this._round(item.precioUnitario * item.cantidad);

        itemsSnapshot.push({
          nombre: item.nombreProducto,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: itemSubtotal,
        });

        subtotal += itemSubtotal;
      }
    }

    // PASO 3 — Calcular totales con el porcentaje de impuesto configurado
    subtotal = this._round(subtotal);
    const impuesto = this._round(subtotal * (this.impuestoPorcentaje / 100));
    const total = this._round(subtotal + impuesto);

    // PASO 4 — Crear el documento de factura con estado PAGADA
    const factura = await this.facturaModel.create({
      mesa: new Types.ObjectId(dto.mesaId),
      ordenes: ordenes.map((o) => new Types.ObjectId(o.id)),
      itemsSnapshot,
      subtotal,
      impuesto,
      total,
      metodoPago: dto.metodoPago,
      estado: FacturaEstado.PAGADA,
      cajero: new Types.ObjectId(cajeroId),
      cai: dto.cai,
      rtn: dto.rtn,
      fechaEmision: new Date(),
    });

    // PASO 5 — Cerrar la mesa (queda LIBRE)
    await this.mesasService.cerrarMesa(dto.mesaId);

    // PASO 6 — Emitir evento para que el WebSocket actualice el canvas
    this.eventEmitter.emit('mesa.estado.cambiado', {
      mesaId: dto.mesaId,
      nuevoEstado: MesaEstado.LIBRE,
      timestamp: new Date(),
    });

    this.eventEmitter.emit(EVENTO_FACTURA_CREADA, {
      facturaId: factura._id.toString(),
      total,
      mesaId: dto.mesaId,
      metodoPago: dto.metodoPago,
      timestamp: new Date(),
    });

    // PASO 7 — Retornar la factura emitida
    const facturaPopulada = await this.facturaModel
      .findById(factura._id)
      .populate('mesa', 'numero')
      .populate('cajero', 'nombre')
      .exec();

    if (!facturaPopulada) {
      return this._toResponse(factura);
    }

    return this._toResponse(facturaPopulada);
  }

  async buscarFactura(id: string): Promise<FacturaResponse> {
    this._validarObjectId(id);

    const factura = await this.facturaModel
      .findById(id)
      .populate('mesa', 'numero')
      .populate('cajero', 'nombre')
      .populate('anuladoPor', 'nombre')
      .exec();

    if (!factura) {
      throw new NotFoundException(`Factura con id ${id} no encontrada`);
    }

    return this._toResponse(factura);
  }

  async anularFactura(
    id: string,
    adminId: string,
    justificacion: string,
  ): Promise<FacturaResponse> {
    this._validarObjectId(id);
    this._validarObjectId(adminId);

    const factura = await this.facturaModel
      .findById(id)
      .populate('mesa', 'numero')
      .populate('cajero', 'nombre')
      .populate('anuladoPor', 'nombre')
      .exec();

    if (!factura) {
      throw new NotFoundException(`Factura con id ${id} no encontrada`);
    }

    if (factura.estado === FacturaEstado.ANULADA) {
      throw new BadRequestException('La factura ya fue anulada anteriormente');
    }

    factura.estado = FacturaEstado.ANULADA;
    factura.justificacionAnulacion = justificacion;
    factura.anuladoPor = new Types.ObjectId(adminId);

    await factura.save();

    return this._toResponse(factura);
  }

  async reporteDiario(fecha?: string): Promise<ReporteDiario> {
    const ZONA_HONDURAS = '-06:00';

    if (fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new BadRequestException(
          `Fecha inválida: "${fecha}". Use el formato YYYY-MM-DD`,
        );
      }

      const [anio, mes, dia] = fecha.split('-').map(Number);
      const verificada = new Date(Date.UTC(anio, mes - 1, dia));

      if (
        verificada.getUTCFullYear() !== anio ||
        verificada.getUTCMonth() + 1 !== mes ||
        verificada.getUTCDate() !== dia
      ) {
        throw new BadRequestException(
          `Fecha inválida: "${fecha}". No existe en el calendario.`,
        );
      }
    }

    const hoyHonduras = new Date(Date.now() - 6 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const fechaBase = fecha ?? hoyHonduras;
    const inicio = new Date(`${fechaBase}T00:00:00.000${ZONA_HONDURAS}`);
    const fin = new Date(`${fechaBase}T23:59:59.999${ZONA_HONDURAS}`);

    const facturas = await this.facturaModel
      .find({
        estado: FacturaEstado.PAGADA,
        fechaEmision: { $gte: inicio, $lte: fin },
      })
      .exec();

    const totalCobrado = facturas.reduce((sum, f) => sum + f.total, 0);

    const desgloseMetodo = (mp: MetodoPago) =>
      facturas
        .filter((f) => f.metodoPago === mp)
        .reduce((sum, f) => sum + f.total, 0);

    // Número de mesas distintas atendidas en el día
    const mesasAtendidas = new Set(facturas.map((f) => f.mesa.toString())).size;

    const cantidadFacturas = facturas.length;
    const ticketPromedio =
      cantidadFacturas > 0 ? this._round(totalCobrado / cantidadFacturas) : 0;

    return {
      fecha: fechaBase,
      totalCobrado: this._round(totalCobrado),
      desglosePorMetodoPago: {
        EFECTIVO: this._round(desgloseMetodo(MetodoPago.EFECTIVO)),
        TARJETA: this._round(desgloseMetodo(MetodoPago.TARJETA)),
        TRANSFERENCIA: this._round(desgloseMetodo(MetodoPago.TRANSFERENCIA)),
      },
      mesasAtendidas,
      ticketPromedio,
    };
  }

  private _round(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  private _toResponse(doc: FacturaDocument): FacturaResponse {
    const obj = doc.toObject();

    const mesaRaw = obj.mesa as unknown as {
      _id: Types.ObjectId;
      numero: number;
    } | null;
    const cajeroRaw = obj.cajero as unknown as {
      _id: Types.ObjectId;
      nombre: string;
    } | null;
    const anuladoPorRaw = obj.anuladoPor as unknown as {
      _id: Types.ObjectId;
      nombre: string;
    } | null;

    return {
      id: doc._id.toString(),
      mesa: {
        id: mesaRaw?._id?.toString() ?? '',
        numero: mesaRaw?.numero ?? 0,
      },
      ordenes: (obj.ordenes ?? []).map((o: Types.ObjectId) => ({
        id: o.toString(),
      })),
      itemsSnapshot: (obj.itemsSnapshot ?? []).map(
        (item: {
          nombre: string;
          cantidad: number;
          precioUnitario: number;
          subtotal: number;
        }) => ({
          nombre: item.nombre,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
        }),
      ),
      subtotal: obj.subtotal,
      impuesto: obj.impuesto,
      total: obj.total,
      metodoPago: obj.metodoPago,
      estado: obj.estado,
      cajero: {
        id: cajeroRaw?._id?.toString() ?? '',
        nombre: cajeroRaw?.nombre ?? '',
      },
      cai: obj.cai,
      rtn: obj.rtn,
      fechaEmision: obj.fechaEmision,
      justificacionAnulacion: obj.justificacionAnulacion,
      anuladoPor: anuladoPorRaw
        ? {
            id: anuladoPorRaw._id.toString(),
            nombre: anuladoPorRaw.nombre,
          }
        : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private _validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El id "${id}" no es un ObjectId válido`);
    }
  }
}
