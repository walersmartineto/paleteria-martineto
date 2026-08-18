import { supabase } from './supabase';

export interface TarifasOsitos {
  subsidio: number;
  transporte: number;
  horaDiaEntreSemana: number;
  horaNocheEntreSemana: number;
  horaDiaFestivo: number;
  horaNocheFestivo: number;
}

// 1. OBTENER TARIFAS DE NÓMINA DE 12 FRIENDLY BEARS (SEDE 4)
export async function obtenerTarifasOsitos(): Promise<TarifasOsitos> {
  const tarifasDefecto: TarifasOsitos = {
    subsidio: 9600,
    transporte: 8400,
    horaDiaEntreSemana: 7200,
    horaNocheEntreSemana: 10700,
    horaDiaFestivo: 12700,
    horaNocheFestivo: 15200,
  };

  try {
    const { data, error } = await supabase
      .from('configuracion_nomina')
      .select('*')
      .eq('sede_id', 4)
      .single();

    if (error || !data) return tarifasDefecto;

    return {
      subsidio: data.subsidio ?? 9600,
      transporte: data.transporte ?? 8400,
      horaDiaEntreSemana: data.hora_dia_entre_semana ?? 7200,
      horaNocheEntreSemana: data.hora_noche_entre_semana ?? 10700,
      horaDiaFestivo: data.hora_dia_festivo ?? 12700,
      horaNocheFestivo: data.hora_noche_festivo ?? 15200,
    };
  } catch (e) {
    console.error('Error obteniendo tarifas de 12 Friendly Bears:', e);
    return tarifasDefecto;
  }
}

// 2. OBTENER LISTA DE SABORES DISPONIBLES PARA 12 FRIENDLY BEARS
export async function obtenerSaboresOsitos(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('producto')
      .select('id, nombre, precio, es_comun, activo, stock, categoria')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error cargando sabores para 12 Friendly Bears:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Error en obtenerSaboresOsitos:', err);
    return [];
  }
}

// 3. OBTENER USUARIOS OPERARIOS
export async function obtenerUsuariosOperarios(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre_completo, codigo_acceso, tipo_usuario, activo')
      .eq('activo', true)
      .order('nombre_completo', { ascending: true });

    if (error) {
      console.error('Error obteniendo usuarios:', error);
      return [];
    }

    return (data || []).map((u) => ({
      id: u.id,
      nombre: u.nombre_completo,
      pin: u.codigo_acceso,
      rol: u.tipo_usuario,
    }));
  } catch (err) {
    console.error('Error en obtenerUsuariosOperarios:', err);
    return [];
  }
}

// 4. REGISTRAR BASE INICIAL EN LA TABLA CAJA PARA 12 FRIENDLY BEARS
export async function registrarBaseCajaOsitos(
  sedeId: number,
  usuarioId: number,
  montoApertura: number,
  turnoId?: number
): Promise<boolean> {
  try {
    const { error } = await supabase.from('caja').insert([
      {
        sede_id: sedeId,
        usuario_id: usuarioId,
        turno_id: turnoId || null,
        monto_apertura: montoApertura,
        estado: 'abierta',
        fecha: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error('Error insertando base en caja 12 Friendly Bears:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error en registrarBaseCajaOsitos:', err);
    return false;
  }
}

// 5. REGISTRAR MOVIMIENTO DE INVENTARIO PARA 12 FRIENDLY BEARS
export async function registrarMovimientoOsitos(
  sedeId: number,
  usuarioId: number,
  tipoMovimiento: string,
  totalPaletas: number,
  detallePaletas: { [key: string]: number },
  detalleEmpaques: { [key: string]: number },
  observaciones: string,
  turnoId?: number
): Promise<boolean> {
  try {
    const payload: any = {
      sede_id: sedeId,
      usuario_id: usuarioId,
      tipo_movimiento: tipoMovimiento,
      total_paletas: totalPaletas,
      detalle_paletas: detallePaletas,
      detalle_empaques: detalleEmpaques,
      observacion: observaciones || '',
      fecha_registro: new Date().toISOString(),
    };

    if (turnoId) payload.turno_id = turnoId;

    const { error } = await supabase.from('inventario_diario').insert([payload]);

    if (error) {
      console.error('Error guardando movimiento de inventario en 12 Friendly Bears:', JSON.stringify(error, null, 2));
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error en registrarMovimientoOsitos:', err);
    return false;
  }
}

// 6. CREAR PEDIDO DE INSUMOS Y REQUISICIONES DE 12 FRIENDLY BEARS
export async function crearPedidoInsumosOsitos(datos: {
  sedeId: number;
  usuarioId: number;
  paletas: { [key: string]: number };
  richi: { [key: string]: number };
  produccion: { [key: string]: number };
  insumos: { [key: string]: number };
  aseo: { [key: string]: number };
  observaciones: string;
}): Promise<boolean> {
  try {
    const payload = {
      sede_id: datos.sedeId,
      usuario_id: datos.usuarioId,
      pedidos_paletas: datos.paletas,
      pedidos_richi: datos.richi,
      pedidos_produccion: datos.produccion,
      pedidos_insumos: datos.insumos,
      pedidos_aseo: datos.aseo,
      observaciones: datos.observaciones || '',
      estado: 'pendiente',
      fecha: new Date().toISOString(),
    };

    const { error } = await supabase.from('pedidos_insumos').insert([payload]);

    if (error) {
      console.error('Error creando pedido de insumos en 12 Friendly Bears:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error en crearPedidoInsumosOsitos:', err);
    return false;
  }
}

// 7. REGISTRAR NÓMINA Y ACTUALIZAR ARQUEO COMPLETO EN TABLA CAJA PARA 12 FRIENDLY BEARS
export async function registrarNominaYCambioTurnoOsitos(data: {
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
}): Promise<boolean> {
  try {
    const fechaHoy = new Date().toISOString().split('T')[0];

    // A. Registrar pago de nómina
    const { error: errorNomina } = await supabase.from('nomina').insert([
      {
        sede_id: data.sedeId,
        usuario_id: data.usuarioId,
        tipo_dia: data.tipoDia,
        horas_dia: data.horasDia,
        horas_noche: data.horasNoche,
        subsidio_transporte: data.subsidio + data.transporte,
        monto: data.totalPagado,
        concepto: 'Pago de turno',
        fecha_pago: fechaHoy,
      },
    ]);

    if (errorNomina) {
      console.error('Error guardando nómina en 12 Friendly Bears:', errorNomina);
      return false;
    }

    // B. Si es cierre de caja, actualizar la caja abierta más reciente
    if (data.efectivoCaja > 0 || data.nequi > 0 || data.daviplata > 0) {
      const { data: cajaAbierta } = await supabase
        .from('caja')
        .select('id')
        .eq('sede_id', data.sedeId)
        .eq('estado', 'abierta')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cajaAbierta) {
        const { error: errCaja } = await supabase
          .from('caja')
          .update({
            efectivo_cierre: data.efectivoCaja,
            nequi: data.nequi,
            daviplata: data.daviplata,
            monto_gasto: data.gastos,
            motivo_gasto: data.motivoGasto,
            estado: 'cerrada',
          })
          .eq('id', cajaAbierta.id);

        if (errCaja) {
          console.error('Error actualizando la caja en 12 Friendly Bears:', errCaja);
          return false;
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Error en registrarNominaYCambioTurnoOsitos:', err);
    return false;
  }
}