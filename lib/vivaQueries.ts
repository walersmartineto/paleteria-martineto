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

// 3. Registrar Base de Caja directamente en la tabla 'caja'
export async function registrarBaseCajaViva(sedeId: number, usuarioId: number, montoBase: number, turnoId?: number) {
  const idSede = Number(sedeId) || 2;
  const idUsuario = Number(usuarioId);

  if (!idUsuario || isNaN(idUsuario)) {
    console.error('❌ Error: usuarioId no es válido o está ausente.');
    return false;
  }

  // Mapeo exacto de todas las columnas visibles en Supabase
  const payload: any = {
    sede_id: idSede,
    usuario_id: idUsuario,
    monto_apertura: montoBase,
    estado: 'abierta',
    fecha: new Date().toISOString(),
  };

  // Si se cuenta con turno_id lo asignamos, de lo contrario enviamos 1 o el ID activo
  if (turnoId && !isNaN(Number(turnoId))) {
    payload.turno_id = Number(turnoId);
  }

  const { data, error } = await supabase
    .from('caja')
    .insert([payload])
    .select();

  if (error) {
    console.error('❌ Error al insertar en caja:', {
      mensaje: error.message,
      detalles: error.details,
      pista: error.hint,
      codigo: error.code,
    });
    return false;
  }

  return true;
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
// REGISTRO DE INVENTARIO DIARIO EN TABLA UNIFICADA
export async function registrarMovimientoViva(
  sedeId: number,
  usuarioId: number,
  tipoMovimiento: string,
  totalPaletas: number,
  detallePaletasObj: { [saborNombre: string]: number },
  detalleEmpaquesObj: { [itemNombre: string]: number },
  observacion: string,
  turnoId?: number
) {
  try {
    const { error } = await supabase.from('inventario_diario').insert([
      {
        sede_id: sedeId,
        usuario_id: usuarioId,
        turno_id: turnoId || null,
        tipo_movimiento: tipoMovimiento,
        total_paletas: totalPaletas,
        detalle_paletas: detallePaletasObj,
        detalle_empaques: detalleEmpaquesObj,
        observacion: observacion,
        fecha_registro: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error('Error guardando en inventario_diario:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Excepción guardando inventario_diario:', err);
    return false;
  }
}
// 6. Crear y Obtener Pedidos de Insumos Categorizados
export async function crearPedidoInsumosViva(datos: {
  sedeId: number;
  usuarioId: number;
  paletas?: { [key: string]: number };
  richi?: { [key: string]: number };
  insumos?: { [key: string]: number };
  aseo?: { [key: string]: number };
  observaciones?: string;
}) {
  try {
    const payload: Record<string, any> = {
      sede_id: datos.sedeId,
      usuario_id: datos.usuarioId,
      pedidos_paletas: datos.paletas || {},
      pedidos_richi: datos.richi || {},
      pedidos_insumos: datos.insumos || {},
      pedidos_aseo: datos.aseo || {},
      observaciones: datos.observaciones || '',
      estado: 'pendiente',
    };

    // TABLA ÚNICA Y GENERAL PARA TODAS LAS SEDES:
    const { error } = await supabase
      .from('pedidos_insumos')
      .insert([payload]);

    if (error) {
      console.error('Error guardando en pedidos_insumos:', error.message || error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Excepción al guardar pedido:', err?.message || err);
    return false;
  }
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
      .neq('tipo_usuario', 'administrador');

    if (error) {
      console.error('Error obteniendo usuarios de Supabase:', error);
      return [];
    }

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