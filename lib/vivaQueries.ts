import { supabase } from './supabase';

export interface TarifasViva {
  subsidio: number;
  transporte: number;
  horaDiaEntreSemana: number;
  horaNocheEntreSemana: number;
  horaDiaFestivo: number;
  horaNocheFestivo: number;
}

// 1. OBTENER TARIFAS DE LA SEDE VIVA
export async function obtenerTarifasViva(): Promise<TarifasViva> {
  const tarifasPorDefecto: TarifasViva = {
    subsidio: 9600,
    transporte: 8400,
    horaDiaEntreSemana: 7200,
    horaNocheEntreSemana: 10700,
    horaDiaFestivo: 12700,
    horaNocheFestivo: 15200,
  };

  try {
    const { data, error } = await supabase
      .from('configuracion_sede')
      .select('*')
      .eq('sede_id', 2)
      .maybeSingle();

    if (error || !data) {
      return tarifasPorDefecto;
    }

    return {
      subsidio: Number(data.subsidio) || tarifasPorDefecto.subsidio,
      transporte: Number(data.transporte) || tarifasPorDefecto.transporte,
      horaDiaEntreSemana: Number(data.hora_dia_entre_semana) || tarifasPorDefecto.horaDiaEntreSemana,
      horaNocheEntreSemana: Number(data.hora_noche_entre_semana) || tarifasPorDefecto.horaNocheEntreSemana,
      horaDiaFestivo: Number(data.hora_dia_festivo) || tarifasPorDefecto.horaDiaFestivo,
      horaNocheFestivo: Number(data.hora_noche_festivo) || tarifasPorDefecto.horaNocheFestivo,
    };
  } catch (err) {
    console.warn('Error al cargar tarifas de Viva, usando por defecto:', err);
    return tarifasPorDefecto;
  }
}

// 2. OBTENER LISTADO DE SABORES Y PRODUCTOS PARA VIVA
export async function obtenerSaboresViva() {
  try {
    const { data, error } = await supabase
      .from('producto')
      .select('id, nombre, categoria, grupo, donde_comprar, sede_id, activo')
      .or('sede_id.eq.2,sede_id.eq.0,sede_id.is.null')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error cargando sabores:', error.message || error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error inesperado en obtenerSaboresViva:', err);
    return [];
  }
}

// 3. OBTENER LISTA DE OPERARIOS
export async function obtenerUsuariosOperarios() {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre_completo, codigo_acceso, tipo_usuario')
      .eq('activo', true)
      .order('nombre_completo', { ascending: true });

    if (error) {
      console.error('Error obteniendo operarios:', error.message || error);
      return [];
    }

    return (data || []).map((u) => ({
      id: u.id,
      nombre: u.nombre_completo,
      pin: u.codigo_acceso,
      rol: u.tipo_usuario,
    }));
  } catch (err) {
    console.error('Error inesperado obteniendo operarios:', err);
    return [];
  }
}

// 4. REGISTRAR BASE DE CAJA
export async function registrarBaseCajaViva(
  sedeId: number,
  usuarioId: number,
  monto: number,
  turnoId?: number | null
) {
  try {
    const { error } = await supabase.from('caja').insert([
      {
        sede_id: sedeId,
        usuario_id: usuarioId,
        monto_apertura: monto,
        estado: 'abierta',
        turno_id: turnoId || null,
      },
    ]);

    if (error) {
      console.error('Error al registrar base de caja:', error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado registrando base:', err);
    return false;
  }
}

// 5. REGISTRAR MOVIMIENTO DE INVENTARIO
export async function registrarMovimientoViva(
  sedeId: number,
  usuarioId: number,
  tipoMovimiento: string,
  totalPaletas: number,
  detallePaletas: { [key: string]: number },
  detalleEmpaques: { [key: string]: number },
  observaciones: string,
  turnoId?: number | null
) {
  try {
    const { error } = await supabase.from('inventario_diario').insert([
      {
        sede_id: sedeId,
        usuario_id: usuarioId,
        tipo_movimiento: tipoMovimiento,
        total_paletas: totalPaletas,
        detalle_paletas: detallePaletas,
        detalle_empaques: detalleEmpaques,
        observacion: observaciones,
        turno_id: turnoId || null,
      },
    ]);

    if (error) {
      console.error('Error registrando inventario Viva:', error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado en inventario Viva:', err);
    return false;
  }
}

// 6. CREAR PEDIDO DE INSUMOS (REQUISICIÓN)
export async function crearPedidoInsumosViva(payload: {
  sedeId: number;
  usuarioId: number;
  paletas: { [key: string]: number };
  richi: { [key: string]: number };
  insumos: { [key: string]: number };
  aseo: { [key: string]: number };
  observaciones: string;
}) {
  try {
    const { error } = await supabase.from('pedidos_insumos').insert([
      {
        sede_id: payload.sedeId,
        usuario_id: payload.usuarioId,
        pedidos_paletas: payload.paletas,
        pedidos_produccion: {},
        pedidos_richi: payload.richi,
        pedidos_insumos: payload.insumos,
        pedidos_aseo: payload.aseo,
        observaciones: payload.observaciones,
        estado: 'PENDIENTE',
      },
    ]);

    if (error) {
      console.error('Error creando pedido de insumos:', error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado enviando pedido:', err);
    return false;
  }
}

// 7. REGISTRAR NÓMINA Y ARQUEO / CAMBIO DE TURNO
export async function registrarNominaYCambioTurno(datos: {
  sedeId: number;
  usuarioId: number;
  tipoDia: string;
  horasDia: number;
  horasNoche: number;
  subsidio: number;
  transporte: number;
  totalPagado: number;
  efectivoCaja: number;
  nequi: number;
  daviplata: number;
  gastos: number;
  motivoGasto: string;
}) {
  try {
    const { error: errorNomina } = await supabase.from('nomina').insert([
      {
        sede_id: datos.sedeId,
        usuario_id: datos.usuarioId,
        monto: datos.totalPagado,
        concepto: 'Pago de turno',
        tipo_dia: datos.tipoDia,
        horas_dia: datos.horasDia,
        horas_noche: datos.horasNoche,
        subsidio_transporte: datos.subsidio + datos.transporte,
        total_pagado: datos.totalPagado,
        efectivo_dejadocaja: datos.efectivoCaja,
      },
    ]);

    if (errorNomina) {
      console.error('Error al registrar nómina:', errorNomina.message || errorNomina);
      return false;
    }

    if (datos.efectivoCaja > 0 || datos.nequi > 0 || datos.daviplata > 0 || datos.gastos > 0) {
      const { error: errorCierre } = await supabase.from('caja').insert([
        {
          sede_id: datos.sedeId,
          usuario_id: datos.usuarioId,
          monto_apertura: datos.efectivoCaja,
          estado: 'cerrada',
        },
      ]);

      if (errorCierre) {
        console.error('Error al registrar arqueo en caja:', errorCierre.message || errorCierre);
      }
    }

    return true;
  } catch (err) {
    console.error('Error inesperado en nómina y cambio de turno:', err);
    return false;
  }
}