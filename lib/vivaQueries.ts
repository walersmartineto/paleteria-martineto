import { supabase } from './supabase';

export interface SaborPaletaViva {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
}

export type TipoMovimientoViva = 'apertura' | 'nuevas' | 'compras' | 'debaja' | 'cierre';

export interface TarifasViva {
  subsidio: number;
  transporte: number;
  horaDiaEntreSemana: number;
  horaNocheEntreSemana: number;
  horaDiaFestivo: number;
  horaNocheFestivo: number;
}

// 1. Obtener Tarifas
export async function obtenerTarifasViva(): Promise<TarifasViva> {
  const { data, error } = await supabase
    .from('configuracion_tarifa')
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return {
      subsidio: 9600,
      transporte: 8400,
      horaDiaEntreSemana: 7200,
      horaNocheEntreSemana: 10700,
      horaDiaFestivo: 12700,
      horaNocheFestivo: 15200,
    };
  }

  return {
    subsidio: Number(data.subsidio) || 9600,
    transporte: Number(data.transporte) || 8400,
    horaDiaEntreSemana: Number(data.hora_dia_entre_semana) || 7200,
    horaNocheEntreSemana: Number(data.hora_noche_entre_semana) || 10700,
    horaDiaFestivo: Number(data.hora_dia_festivo) || 12700,
    horaNocheFestivo: Number(data.hora_noche_festivo) || 15200,
  };
}

// 2. Obtener Sabores (FILTRADO: Excluye categorías de insumos para que no se mezclen)
export async function obtenerSaboresViva(): Promise<SaborPaletaViva[]> {
  const { data: productos, error } = await supabase
    .from('producto')
    .select('id, nombre, precio, categoria')
    // Excluye explícitamente las categorías de insumos
    .not('categoria', 'in', '("Aseo","Plásticos Richi","Insumos")')
    .order('nombre', { ascending: true });

  if (error || !productos) return [];

  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria || 'crema',
    precio: p.precio || 0,
  }));
}

// 3. Registrar Base de Caja
export async function registrarBaseCajaViva(sedeId: number, usuarioId: number, montoBase: number) {
  const payload: any = {
    sede_id: sedeId || 2,
    monto_apertura: montoBase,
    fecha: new Date().toISOString().split('T')[0],
    estado: 'abierta',
  };
  if (usuarioId && !isNaN(Number(usuarioId))) payload.usuario_id = Number(usuarioId);

  const { error } = await supabase.from('caja').insert([payload]);
  return !error;
}

// 4. Registrar Cambio de Turno y Nómina
export async function registrarNominaYCambioTurno(datos: {
  sedeId: number;
  usuarioId?: number;
  tipoDia: 'entre_semana' | 'domingo_festivo';
  horasDia: number;
  horasNoche: number;
  subsidio: number;
  transporte: number;
  totalPagado: number;
  efectivoDejadoCaja: number;
}) {
  const montoFinal = Number(datos.totalPagado) || 0;

  const payloadNomina: any = {
    sede_id: Number(datos.sedeId) || 2,
    fecha: new Date().toISOString().split('T')[0],
    tipo_dia: datos.tipoDia,
    horas_dia: Number(datos.horasDia) || 0,
    horas_noche: Number(datos.horasNoche) || 0,
    subsidio_transporte: (Number(datos.subsidio) || 0) + (Number(datos.transporte) || 0),
    total_pagado: montoFinal,
    monto: montoFinal,
    efectivo_dejadocaja: Number(datos.efectivoDejadoCaja) || 0,
  };

  if (datos.usuarioId && !isNaN(Number(datos.usuarioId))) {
    payloadNomina.usuario_id = Number(datos.usuarioId);
  }

  const { error: errNomina } = await supabase.from('nomina').insert([payloadNomina]);

  if (errNomina) {
    console.error('Error Supabase Nomina:', errNomina.message, errNomina.details);
    return false;
  }

  const payloadGasto: any = {
    sede_id: Number(datos.sedeId) || 2,
    concepto: `Pago Nómina Operario (${datos.tipoDia})`,
    monto: montoFinal,
  };

  if (datos.usuarioId && !isNaN(Number(datos.usuarioId))) {
    payloadGasto.usuario_id = Number(datos.usuarioId);
  }

  await supabase.from('gasto').insert([payloadGasto]);

  return true;
}

// 5. Registrar Movimientos de Inventario
export async function registrarMovimientoViva(
  sedeId: number,
  usuarioId: number,
  tipoMovimiento: TipoMovimientoViva,
  cantidades: { [saborId: number]: number },
  cajasMostrador: number,
  observaciones: string
) {
  const fechaHoy = new Date().toISOString().split('T')[0];

  for (const [saborIdStr, cantidad] of Object.entries(cantidades)) {
    const saborId = Number(saborIdStr);
    if (cantidad <= 0) continue;

    let stockApertura = 0;
    let entradas = 0;
    let stockCierre = 0;

    if (tipoMovimiento === 'apertura') stockApertura = cantidad;
    if (tipoMovimiento === 'nuevas' || tipoMovimiento === 'compras') entradas = cantidad;
    if (tipoMovimiento === 'cierre') stockCierre = cantidad;

    const payloadInv: any = {
      sede_id: sedeId || 2,
      producto_id: saborId,
      fecha: fechaHoy,
      stock_apertura: stockApertura,
      entradas: entradas,
      stock_cierre: stockCierre,
      cajas_mostrador: cajasMostrador,
    };
    if (usuarioId && !isNaN(Number(usuarioId))) payloadInv.usuario_id = Number(usuarioId);

    await supabase.from('inventario_diario').insert([payloadInv]);
  }

  if (observaciones.trim() || tipoMovimiento === 'debaja') {
    const payloadGasto: any = {
      sede_id: sedeId || 2,
      concepto: `[Viva - ${tipoMovimiento.toUpperCase()}] Cajas: ${cajasMostrador}. Obs: ${observaciones}`,
      monto: 0,
    };
    if (usuarioId && !isNaN(Number(usuarioId))) payloadGasto.usuario_id = Number(usuarioId);

    await supabase.from('gasto').insert([payloadGasto]);
  }

  return true;
}

// 6. Crear y Obtener Pedidos de Insumos Categorizados
export async function crearPedidoInsumosViva(
  sedeId: number,
  usuarioId: any,
  categoria: string,
  detalleItems: Record<string, number>,
  observaciones: string
) {
  // Aseguramos que usuarioId sea numérico o string según tu estructura
  const parsedUsuarioId = isNaN(Number(usuarioId)) ? usuarioId : Number(usuarioId);

  const { data, error } = await supabase
    .from('pedidos_insumos_viva') // ⚠️ VERIFICA QUE ESTE SEA EL NOMBRE EXACTO DE TU TABLA
    .insert([
      {
        sede_id: Number(sedeId),
        usuario_id: parsedUsuarioId,
        categoria: categoria,
        detalle_items: detalleItems,
        observaciones: observaciones || '',
        estado: 'pendiente'
      }
    ]);

  if (error) {
    console.error('❌ ERROR EXACTO DE SUPABASE:', error.message, error.details, error.hint);
    return false;
  }

  return true;
}

export async function obtenerPedidosInsumosViva(sedeId: number) {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('sede_id', sedeId || 2)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return data;
}

export async function obtenerUsuariosOperarios() {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre_completo, codigo_acceso, tipo_usuario, activo')
      .eq('activo', true)
      .neq('tipo_usuario', 'administrador'); // Excluye al Administrador Principal

    if (error) {
      console.error('Error obteniendo usuarios de Supabase:', error);
      return [];
    }

    // Mapeamos los campos exactos de tu base de datos
    return (data || []).map((u: any) => ({
      id: u.id,
      nombre: u.nombre_completo,
      pin: u.codigo_acceso,
      tipo: u.tipo_usuario
    }));
  } catch (err) {
    console.error('Excepción al cargar operarios:', err);
    return [];
  }
}