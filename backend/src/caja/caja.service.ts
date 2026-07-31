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
import { ProductosService } from '../productos/productos.service.js';
import { TipoIsv } from '../productos/schemas/tipo-isv.enum.js';

import {
  CorteCaja,
  CorteCajaDocument,
  CorteEstado,
} from './schemas/corte-caja.schema.js';
import { Counter, CounterDocument } from './schemas/counter.schema.js';
import {
  Factura,
  FacturaDocument,
  FacturaEstado,
  MetodoPago,
  TipoDocumento,
} from './schemas/factura.schema.js';

import type { CobrarMesaDto } from './dto/cobrar-mesa.dto.js';
import type {
  CorteCajaResponse,
  CuentaPendienteResponse,
  FacturaResponse,
  PaginatedResponse,
  ReporteDiario,
} from './interfaces/factura-response.interface.js';

const EVENTO_FACTURA_CREADA = 'factura.creada';

@Injectable()
export class CajaService {
  private readonly isvTasa15: number;
  private readonly isvTasa18: number;

  constructor(
    @InjectModel(Factura.name)
    private readonly facturaModel: Model<FacturaDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(CorteCaja.name)
    private readonly corteModel: Model<CorteCajaDocument>,
    private readonly configService: ConfigService,
    private readonly mesasService: MesasService,
    private readonly ordenesService: OrdenesService,
    private readonly productosService: ProductosService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const tasa15 = Number(this.configService.get<string>('ISV_TASA_15'));
    const tasa18 = Number(this.configService.get<string>('ISV_TASA_18'));

    // Las variables de env llegan como string: se validan antes de usar
    this.isvTasa15 = Number.isFinite(tasa15) && tasa15 > 0 ? tasa15 : 0.15;
    this.isvTasa18 = Number.isFinite(tasa18) && tasa18 > 0 ? tasa18 : 0.18;
  }

  async abrirCaja(
    cajeroId: string,
    fondoInicial: number,
  ): Promise<CorteCajaResponse> {
    this._validarObjectId(cajeroId);

    const abierto = await this.corteModel
      .findOne({
        cajero: new Types.ObjectId(cajeroId),
        estado: CorteEstado.ABIERTO,
      })
      .exec();

    if (abierto) {
      throw new BadRequestException(
        'El cajero ya tiene una caja abierta. Ciérrela antes de abrir una nueva.',
      );
    }

    const corteCreado = await this.corteModel
      .create({
        cajero: new Types.ObjectId(cajeroId),
        fondoInicial: this._round(fondoInicial),
        estado: CorteEstado.ABIERTO,
        aperturaEn: new Date(),
      })
      .catch((error: { code?: number }) => {
        if (error?.code === 11000) {
          throw new BadRequestException(
            'El cajero ya tiene una caja abierta. Ciérrela antes de abrir una nueva.',
          );
        }

        throw error;
      });

    const cortePopulado = await this.corteModel
      .findById(corteCreado._id)
      .populate('cajero', 'nombre')
      .lean()
      .exec();

    if (!cortePopulado)
      throw new NotFoundException('Corte no encontrado después de abrir');

    return this._corteToResponse(cortePopulado);
  }

  async cerrarCaja(
    cajeroId: string,
    totalReal: number,
  ): Promise<CorteCajaResponse> {
    this._validarObjectId(cajeroId);

    const corte = await this.corteModel
      .findOne({
        cajero: new Types.ObjectId(cajeroId),
        estado: CorteEstado.ABIERTO,
      })
      .exec();

    if (!corte) {
      throw new BadRequestException(
        'No hay una caja abierta para este cajero.',
      );
    }

    const facturas = await this.facturaModel
      .find({
        cajero: new Types.ObjectId(cajeroId),
        estado: FacturaEstado.PAGADA,
        createdAt: { $gte: corte.aperturaEn },
      })
      .exec();

    let totalEsperado = 0;
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    let totalPropinas = 0;

    for (const f of facturas) {
      totalEsperado += f.total;
      totalPropinas += f.propina ?? 0;

      if (f.metodoPago === MetodoPago.EFECTIVO) totalEfectivo += f.total;
      if (f.metodoPago === MetodoPago.TARJETA) totalTarjeta += f.total;
      if (f.metodoPago === MetodoPago.TRANSFERENCIA)
        totalTransferencia += f.total;
    }

    corte.totalEsperado = this._round(totalEsperado + corte.fondoInicial);
    corte.totalReal = this._round(totalReal);
    corte.diferencia = this._round(
      totalReal - (totalEsperado + corte.fondoInicial),
    );
    corte.totalEfectivo = this._round(totalEfectivo);
    corte.totalTarjeta = this._round(totalTarjeta);
    corte.totalTransferencia = this._round(totalTransferencia);
    corte.totalPropinas = this._round(totalPropinas);
    corte.cantidadFacturas = facturas.length;
    corte.estado = CorteEstado.CERRADO;
    corte.cierreEn = new Date();

    await corte.save();

    const cortePopulado = await this.corteModel
      .findById(corte._id)
      .populate('cajero', 'nombre')
      .lean()
      .exec();

    if (!cortePopulado) {
      throw new NotFoundException('Corte no encontrado después de cerrar');
    }

    return this._corteToResponse(cortePopulado);
  }

  async obtenerCuenta(mesaId: string): Promise<CuentaPendienteResponse> {
    this._validarObjectId(mesaId);

    const mesa = await this.mesasService.buscarPorId(mesaId);

    if (mesa.estado !== MesaEstado.CUENTA_PEDIDA) {
      throw new BadRequestException(
        `La mesa no tiene una cuenta pendiente. Estado actual: ${mesa.estado}`,
      );
    }

    const ordenes = await this.ordenesService.listarEntregadasPorMesa(mesaId);

    if (ordenes.length === 0) {
      throw new BadRequestException(
        'No hay órdenes entregadas para facturar en esta mesa',
      );
    }

    return this._calcularCuenta(ordenes, mesa);
  }

  async cobrarMesa(
    mesaId: string,
    cajeroId: string,
    dto: CobrarMesaDto,
  ): Promise<FacturaResponse> {
    this._validarObjectId(mesaId);
    this._validarObjectId(cajeroId);

    await this._validarCajaAbierta(cajeroId);

    const fechaLimiteStr =
      this.configService.get<string>('COMERCIO_FECHA_LIMITE_EMISION') ??
      '2026-12-31';

    // El CAI es válido hasta el final del día en zona de Honduras (UTC-6)
    const fechaLimiteEmision = new Date(`${fechaLimiteStr}T23:59:59.999-06:00`);

    if (isNaN(fechaLimiteEmision.getTime())) {
      throw new BadRequestException(
        `COMERCIO_FECHA_LIMITE_EMISION inválida: "${fechaLimiteStr}". Use el formato YYYY-MM-DD`,
      );
    }

    if (new Date() > fechaLimiteEmision) {
      throw new BadRequestException(
        `El CAI ha expirado. Fecha límite de emisión: ${fechaLimiteStr}. Solicite un nuevo CAI al SAR.`,
      );
    }

    const cuenta = await this.obtenerCuenta(mesaId);

    const propina = this._round(dto.propina ?? 0);
    const total = this._round(
      cuenta.subtotal + cuenta.isv15 + cuenta.isv18 + propina,
    );

    let montoRecibido = 0;
    let cambio = 0;

    if (dto.metodoPago === MetodoPago.EFECTIVO) {
      if (dto.montoRecibido === undefined || dto.montoRecibido === null) {
        throw new BadRequestException(
          'Para pagos en efectivo debe indicar el monto recibido',
        );
      }

      montoRecibido = dto.montoRecibido;

      if (montoRecibido < total) {
        throw new BadRequestException(
          `El monto recibido (L ${montoRecibido.toFixed(2)}) es menor al total (L ${total.toFixed(2)})`,
        );
      }

      cambio = this._round(montoRecibido - total);
    }

    // El correlativo se genera ANTES de cerrar la mesa: si falla
    // (rango agotado), la mesa queda intacta en CUENTA_PEDIDA
    const correlativo = await this._generarCorrelativo();
    const numeroFactura = this._formatearNumeroFactura(correlativo);
    const comercioNombre =
      this.configService.get<string>('COMERCIO_NOMBRE') ?? '';
    const comercioRtn = this.configService.get<string>('COMERCIO_RTN') ?? '';
    const cai = this.configService.get<string>('COMERCIO_CAI') ?? '';

    await this.mesasService.cerrarMesaAtomicamente(mesaId);

    let factura: FacturaDocument;

    try {
      factura = await this.facturaModel.create({
        correlativo,
        numeroFactura,
        comercioNombre,
        comercioRtn,
        cai,
        fechaLimiteEmision,
        tipoDocumento: TipoDocumento.FACTURA,
        mesa: new Types.ObjectId(mesaId),
        mesero: new Types.ObjectId(cuenta.mesero.id),
        cajero: new Types.ObjectId(cajeroId),
        clienteNombre: dto.clienteNombre,
        clienteRtn: dto.clienteRtn,
        items: cuenta.items.map((item) => ({
          producto: new Types.ObjectId(item.productoId),
          nombreProducto: item.nombreProducto,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          tipoIsv: item.tipoIsv,
          isv: item.isv,
        })),
        subtotal: cuenta.subtotal,
        totalExento: cuenta.totalExento,
        totalGravado15: cuenta.totalGravado15,
        totalGravado18: cuenta.totalGravado18,
        isv15: cuenta.isv15,
        isv18: cuenta.isv18,
        propina,
        montoRecibido,
        cambio,
        total,
        metodoPago: dto.metodoPago,
        estado: FacturaEstado.PAGADA,
      });
    } catch {
      await this._restaurarCobroFallido(mesaId, cuenta.mesero.id);

      throw new BadRequestException(
        'Error al guardar la factura. Se restauró el estado de la mesa, intente nuevamente.',
      );
    }

    this.eventEmitter.emit(EVENTO_FACTURA_CREADA, {
      facturaId: factura._id.toString(),
      correlativo,
      numeroFactura,
      total,
      mesaId,
      metodoPago: dto.metodoPago,
      timestamp: new Date(),
    });

    const facturaPopulada = await this.facturaModel
      .findById(factura._id)
      .populate('mesa', 'numero')
      .populate('mesero', 'nombre')
      .populate('cajero', 'nombre')
      .exec();

    // Si el populate falla, se devuelve la factura sin referencias
    // pobladas en vez de un 404 que llevaría al cajero a reintentar
    // y duplicar el cobro.
    if (!facturaPopulada) {
      return this._toResponse(factura);
    }

    return this._toResponse(facturaPopulada);
  }

  async listarFacturas(
    pagina = 1,
    limite = 20,
  ): Promise<PaginatedResponse<FacturaResponse>> {
    if (!Number.isInteger(pagina) || pagina < 1) {
      throw new BadRequestException('La página debe ser un entero mayor a 0');
    }

    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new BadRequestException(
        'El límite debe ser un entero entre 1 y 100',
      );
    }

    const skip = (pagina - 1) * limite;
    const [facturas, total] = await Promise.all([
      this.facturaModel
        .find()
        .populate('mesa', 'numero')
        .populate('mesero', 'nombre')
        .populate('cajero', 'nombre')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limite)
        .exec(),
      this.facturaModel.countDocuments().exec(),
    ]);

    return {
      data: facturas.map((f) => this._toResponse(f)),
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  async buscarFactura(id: string): Promise<FacturaResponse> {
    this._validarObjectId(id);

    const factura = await this.facturaModel
      .findById(id)
      .populate('mesa', 'numero')
      .populate('mesero', 'nombre')
      .populate('cajero', 'nombre')
      .exec();

    if (!factura)
      throw new NotFoundException(`Factura con id ${id} no encontrada`);

    return this._toResponse(factura);
  }

  async anularFactura(
    id: string,
    dto: { motivo: string },
  ): Promise<FacturaResponse> {
    this._validarObjectId(id);

    const factura = await this.facturaModel
      .findById(id)
      .populate('mesa', 'numero')
      .populate('mesero', 'nombre')
      .populate('cajero', 'nombre')
      .exec();

    if (!factura)
      throw new NotFoundException(`Factura con id ${id} no encontrada`);
    if (factura.estado === FacturaEstado.ANULADA)
      throw new BadRequestException('La factura ya fue anulada anteriormente');

    factura.estado = FacturaEstado.ANULADA;
    factura.motivoAnulacion = dto.motivo;
    factura.fechaAnulacion = new Date();

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
      .find({ createdAt: { $gte: inicio, $lte: fin } })
      .populate('cajero', 'nombre')
      .exec();

    const pagadas = facturas.filter((f) => f.estado === FacturaEstado.PAGADA);
    const anuladas = facturas.filter((f) => f.estado === FacturaEstado.ANULADA);

    const sum = (campo: (f: FacturaDocument) => number) =>
      pagadas.reduce((s, f) => s + campo(f), 0);

    const desgloseMetodo = (mp: MetodoPago) =>
      pagadas
        .filter((f) => f.metodoPago === mp)
        .reduce((s, f) => s + f.total, 0);

    const mapaCajero = new Map<
      string,
      { nombre: string; total: number; cantidad: number }
    >();

    for (const f of pagadas) {
      const cajero = f.cajero as unknown as {
        _id: Types.ObjectId;
        nombre: string;
      } | null;

      if (!cajero) {
        continue;
      }

      const id = cajero._id.toString();
      const existente = mapaCajero.get(id) ?? {
        nombre: cajero.nombre,
        total: 0,
        cantidad: 0,
      };
      existente.total += f.total;
      existente.cantidad += 1;
      mapaCajero.set(id, existente);
    }

    return {
      fecha: fechaBase,
      totalFacturado: sum((f) => f.total),
      totalIsv15: sum((f) => f.isv15),
      totalIsv18: sum((f) => f.isv18),
      totalExento: sum((f) => f.totalExento),
      totalPropinas: sum((f) => f.propina ?? 0),
      cantidadFacturas: pagadas.length,
      facturasAnuladas: anuladas.length,
      desglosePorMetodoPago: {
        EFECTIVO: desgloseMetodo(MetodoPago.EFECTIVO),
        TARJETA: desgloseMetodo(MetodoPago.TARJETA),
        TRANSFERENCIA: desgloseMetodo(MetodoPago.TRANSFERENCIA),
      },
      desglosePorCajero: Array.from(mapaCajero.entries()).map(
        ([cajeroId, data]) => ({
          cajeroId,
          cajeroNombre: data.nombre,
          total: data.total,
          cantidad: data.cantidad,
        }),
      ),
    };
  }

  private async _validarCajaAbierta(cajeroId: string): Promise<void> {
    const corte = await this.corteModel
      .findOne({
        cajero: new Types.ObjectId(cajeroId),
        estado: CorteEstado.ABIERTO,
      })
      .exec();

    if (!corte) {
      throw new BadRequestException(
        'Debe abrir caja antes de cobrar. Use POST /caja/apertura',
      );
    }
  }

  private async _calcularCuenta(
    ordenes: Array<{
      items: Array<{
        productoId: string;
        nombreProducto: string;
        precioUnitario: number;
        cantidad: number;
      }>;
    }>,
    mesa: {
      id: string;
      numero: number;
      meseroActual: { id: string; nombre: string } | null;
    },
  ): Promise<CuentaPendienteResponse> {
    const itemsRaw: Array<{
      productoId: string;
      nombreProducto: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }> = [];

    const idsUnicos = new Set<string>();

    for (const orden of ordenes) {
      for (const item of orden.items) {
        itemsRaw.push({
          productoId: item.productoId,
          nombreProducto: item.nombreProducto,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: this._round(item.precioUnitario * item.cantidad),
        });

        idsUnicos.add(item.productoId);
      }
    }

    const mapaProductos = await this.productosService.buscarVarios(
      Array.from(idsUnicos),
    );

    const itemsConIsv = itemsRaw.map((item) => {
      const producto = mapaProductos.get(item.productoId);
      const tipoIsv = producto?.tipoIsv ?? TipoIsv.GRAVADO_15;
      let isv = 0;

      if (tipoIsv === TipoIsv.GRAVADO_15)
        isv = this._round(item.subtotal * this.isvTasa15);
      if (tipoIsv === TipoIsv.GRAVADO_18)
        isv = this._round(item.subtotal * this.isvTasa18);

      return { ...item, tipoIsv, isv };
    });

    let subtotal = 0,
      totalExento = 0,
      totalGravado15 = 0,
      totalGravado18 = 0,
      isv15 = 0,
      isv18 = 0;

    for (const item of itemsConIsv) {
      subtotal += item.subtotal;

      if (item.tipoIsv === TipoIsv.EXENTO) totalExento += item.subtotal;
      if (item.tipoIsv === TipoIsv.GRAVADO_15) {
        totalGravado15 += item.subtotal;
        isv15 += item.isv;
      }
      if (item.tipoIsv === TipoIsv.GRAVADO_18) {
        totalGravado18 += item.subtotal;
        isv18 += item.isv;
      }
    }

    isv15 = this._round(isv15);
    isv18 = this._round(isv18);
    subtotal = this._round(subtotal);
    totalExento = this._round(totalExento);
    totalGravado15 = this._round(totalGravado15);
    totalGravado18 = this._round(totalGravado18);

    if (!mesa.meseroActual) {
      throw new BadRequestException(
        'La mesa no tiene un mesero asignado. No se puede facturar.',
      );
    }

    return {
      mesaId: mesa.id,
      numero: mesa.numero,
      mesero: mesa.meseroActual,
      items: itemsConIsv,
      subtotal,
      totalExento,
      totalGravado15,
      totalGravado18,
      isv15,
      isv18,
    };
  }

  private _round(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  private _esErrorDeTipo(error: unknown): boolean {
    const mensaje = (error as { message?: string })?.message ?? '';
    return (
      mensaje.toLowerCase().includes('non-numeric') ||
      mensaje.toLowerCase().includes('cannot apply $inc')
    );
  }

  private async _generarCorrelativo(): Promise<number> {
    const rangoInicial = Number(
      this.configService.get<string>('COMERCIO_RANGO_INICIAL'),
    );
    const rangoFinal = Number(
      this.configService.get<string>('COMERCIO_RANGO_FINAL'),
    );

    // Env llega como string: solo usar valores numéricos válidos
    const ini =
      Number.isFinite(rangoInicial) && rangoInicial > 0 ? rangoInicial : 1;
    const fin =
      Number.isFinite(rangoFinal) && rangoFinal > ini ? rangoFinal : 100000;

    let actual;

    try {
      actual = await this.counterModel
        .findOneAndUpdate(
          { nombre: 'factura' },
          { $inc: { secuencial: 1 } },
          { new: true, upsert: true },
        )
        .exec();
    } catch (error) {
      const codigo = (error as { code?: number })?.code;

      // Dos cobros concurrentes con contador inexistente: el primer upsert
      // inserta y el segundo recibe E11000. Se reintenta una sola vez.
      if (codigo !== 11000) {
        // Contador corrupto (secuencial como string del bug anterior):
        // se repara con el valor inicial y se reintenta el incremento
        if (codigo === 14 || codigo === 16837 || this._esErrorDeTipo(error)) {
          await this.counterModel
            .updateOne({ nombre: 'factura' }, { $set: { secuencial: ini } })
            .exec();

          actual = await this.counterModel
            .findOneAndUpdate(
              { nombre: 'factura' },
              { $inc: { secuencial: 1 } },
              { new: true },
            )
            .exec();
        } else {
          throw error;
        }
      } else {
        actual = await this.counterModel
          .findOneAndUpdate(
            { nombre: 'factura' },
            { $inc: { secuencial: 1 } },
            { new: true },
          )
          .exec();
      }
    }

    if (!actual) {
      throw new BadRequestException(
        'No se pudo generar el correlativo de factura',
      );
    }

    // Si el contador quedó con un valor no numérico (string), se repara
    if (typeof actual.secuencial !== 'number') {
      await this.counterModel
        .updateOne({ nombre: 'factura' }, { $set: { secuencial: ini } })
        .exec();

      return ini;
    }

    if (actual.secuencial < ini) {
      await this.counterModel
        .updateOne({ nombre: 'factura' }, { $set: { secuencial: ini } })
        .exec();

      return ini;
    }

    if (actual.secuencial > fin) {
      throw new BadRequestException(
        `Se ha agotado el rango de facturación (${ini} - ${fin}). Solicite un nuevo CAI al SAR.`,
      );
    }

    return actual.secuencial;
  }

  private async _restaurarCobroFallido(
    mesaId: string,
    meseroId: string,
  ): Promise<void> {
    try {
      await this.mesasService.abrirMesa(mesaId, meseroId);
      await this.mesasService.solicitarCuenta(mesaId);
    } catch {
      // La restauración es best-effort: si falla, la mesa queda libre,
      // pero el error original se propaga. El correlativo NO se decrementa
      // porque reutilizarlo bajo concurrencia podría duplicar facturas.
    }
  }

  private _formatearNumeroFactura(correlativo: number): string {
    const establecimiento = this.configService.get<string>(
      'COMERCIO_ESTABLECIMIENTO',
      '001',
    );
    const puntoEmision = this.configService.get<string>(
      'COMERCIO_PUNTO_EMISION',
      '001',
    );
    return `${establecimiento}-${puntoEmision}-${correlativo.toString().padStart(6, '0')}`;
  }

  private _toResponse(doc: FacturaDocument): FacturaResponse {
    const obj = doc.toObject();

    const mesaRaw = obj.mesa as unknown as {
      _id: Types.ObjectId;
      numero: number;
    } | null;
    const meseroRaw = obj.mesero as unknown as {
      _id: Types.ObjectId;
      nombre: string;
    } | null;
    const cajeroRaw = obj.cajero as unknown as {
      _id: Types.ObjectId;
      nombre: string;
    } | null;

    return {
      id: doc._id.toString(),
      correlativo: obj.correlativo,
      numeroFactura: obj.numeroFactura,
      comercioNombre: obj.comercioNombre,
      comercioRtn: obj.comercioRtn,
      cai: obj.cai,
      fechaLimiteEmision: obj.fechaLimiteEmision,
      tipoDocumento: obj.tipoDocumento,
      mesa: {
        id: mesaRaw?._id?.toString() ?? '',
        numero: mesaRaw?.numero ?? 0,
      },
      mesero: {
        id: meseroRaw?._id?.toString() ?? '',
        nombre: meseroRaw?.nombre ?? '',
      },
      cajero: {
        id: cajeroRaw?._id?.toString() ?? '',
        nombre: cajeroRaw?.nombre ?? '',
      },
      clienteNombre: obj.clienteNombre,
      clienteRtn: obj.clienteRtn,
      items: obj.items.map((item) => ({
        productoId: (
          item.producto as unknown as { _id: Types.ObjectId }
        )._id.toString(),
        nombreProducto: item.nombreProducto,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        tipoIsv: item.tipoIsv,
        isv: item.isv,
      })),
      subtotal: obj.subtotal,
      totalExento: obj.totalExento,
      totalGravado15: obj.totalGravado15,
      totalGravado18: obj.totalGravado18,
      isv15: obj.isv15,
      isv18: obj.isv18,
      propina: obj.propina,
      montoRecibido: obj.montoRecibido,
      cambio: obj.cambio,
      total: obj.total,
      metodoPago: obj.metodoPago,
      estado: obj.estado,
      motivoAnulacion: obj.motivoAnulacion,
      fechaAnulacion: obj.fechaAnulacion,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async listarCortes(): Promise<CorteCajaResponse[]> {
    const cortes = await this.corteModel
      .find()
      .populate('cajero', 'nombre')
      .sort({ aperturaEn: -1 })
      .exec();

    return cortes.map((corte) => this._corteToResponse(corte));
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
  private _corteToResponse(doc: any): CorteCajaResponse {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const cajeroRaw = obj.cajero as unknown as {
      _id: Types.ObjectId;
      nombre: string;
    } | null;

    return {
      id: obj._id.toString(),
      cajero: {
        id: cajeroRaw?._id?.toString() ?? '',
        nombre: cajeroRaw?.nombre ?? '',
      },
      fondoInicial: obj.fondoInicial,
      totalEsperado: obj.totalEsperado,
      totalReal: obj.totalReal,
      diferencia: obj.diferencia,
      totalEfectivo: obj.totalEfectivo,
      totalTarjeta: obj.totalTarjeta,
      totalTransferencia: obj.totalTransferencia,
      totalPropinas: obj.totalPropinas,
      cantidadFacturas: obj.cantidadFacturas,
      estado: obj.estado,
      aperturaEn: obj.aperturaEn,
      cierreEn: obj.cierreEn,
    };
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

  private _validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException(`El id "${id}" no es un ObjectId válido`);
  }
}
