import { supabase } from '@/lib/supabase';

export interface TarifasViva {
  subsidio: number;
  transporte: number;
  horaDiaEntreSemana: number;
  horaNocheEntreSemana: number;
  horaDiaFestivo: number;
  horaNocheFestivo: number;
}

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
      .from('configuracion_tarifas')
      .select('*')
      .single();

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
  } catch (e) {
    console.error('Error cargando tarifas:', e);
    return tarifasPorDefecto;
  }
}

export async function obtenerUsuariosOperarios() {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre_completo, codigo_acceso, tipo_usuario, activo')
      .eq('activo', true)
      .order('nombre_completo', { ascending: true }); // <--- Orden alfabético de operarios

    if (error) {
      console.error('Error obteniendo operarios:', error.message || error);
      return [];
    }

    return (data || []).map((u: any) => ({
      id: u.id,
      nombre: u.nombre_completo,
      pin: u.codigo_acceso,
      rol: u.tipo_usuario,
    }));
  } catch (e) {
    console.error('Error en obtenerUsuariosOperarios:', e);
    return [];
  }
}

export async function obtenerSaboresViva() {
  try {
    const { data, error } = await supabase
      .from('producto')
      .select('*')
      .eq('activo', true)
      .or('sede_id.eq.1,sede_id.eq.0,sede_id.is.null')
      .order('nombre', { ascending: true }); // <--- Orden alfabético de productos

    if (error) {
      console.error('Error cargando sabores viva:', error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('Error en obtenerSaboresViva:', e);
    return [];
  }
}

export async function registrarBaseCajaViva(
  sedeId: number,
  usuarioId: number,
  montoBase: number,
  turnoId?: number | null
) {
  try {
    const payload: any = {
      sede_id: sedeId,
      usuario_id: usuarioId,
      monto_apertura: montoBase,
      estado: 'abierta',
    };

    if (turnoId && !isNaN(Number(turnoId))) {
      payload.turno_id = Number(turnoId);
    }

    const { error } = await supabase
      .from('caja')
      .insert([payload]);

    if (error) {
      console.error('Error al registrar base de caja:', error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error en registrarBaseCajaViva:', err);
    return false;
  }
}

export async function crearPedidoInsumosViva(datos: {
  sedeId: number;
  usuarioId: number;
  paletas: any;
  richi: any;
  insumos: any;
  aseo: any;
  observaciones: string;
}) {
  try {
    const payload = {
      sede_id: datos.sedeId,
      usuario_id: datos.usuarioId,
      pedidos_paletas: datos.paletas,
      pedidos_richi: datos.richi,
      pedidos_insumos: datos.insumos,
      pedidos_aseo: datos.aseo,
      observacion: datos.observaciones || null,
      estado: 'pendiente',
    };

    const { error } = await supabase.from('pedidos_insumos').insert([payload]);

    if (error) {
      console.error('❌ Error detallado enviando pedido:', JSON.stringify(error, null, 2));
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error en crearPedidoInsumosViva:', e);
    return false;
  }
}

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
  turnoId?: number | null;
}) {
  try {
    const payloadNomina: any = {
      sede_id: datos.sedeId,
      usuario_id: datos.usuarioId,
      tipo_dia: datos.tipoDia,
      horas_dia: datos.horasDia,
      horas_noche: datos.horasNoche,
      subsidio_transporte: (Number(datos.subsidio) || 0) + (Number(datos.transporte) || 0),
      monto: datos.totalPagado,
    };

    if (datos.turnoId && !isNaN(Number(datos.turnoId))) {
      payloadNomina.turno_id = Number(datos.turnoId);
    }

    const { error: errNomina } = await supabase.from('nomina').insert([payloadNomina]);

    if (errNomina) {
      console.error('Error al registrar nómina:', errNomina.message || JSON.stringify(errNomina));
      alert(`Error en Nómina: ${errNomina.message || 'Error de campos en la tabla'}`);
      return false;
    }

    if (datos.efectivoCaja > 0 || datos.nequi > 0 || datos.daviplata > 0) {
      const payloadCaja: any = {
        sede_id: datos.sedeId,
        usuario_id: datos.usuarioId,
        efectivo_cierre: datos.efectivoCaja,
        nequi: datos.nequi,
        daviplata: datos.daviplata,
        monto_gasto: datos.gastos,
        motivo_gasto: datos.motivoGasto || null,
        estado: 'cerrada',
      };

      if (datos.turnoId && !isNaN(Number(datos.turnoId))) {
        payloadCaja.turno_id = Number(datos.turnoId);
      }

      const { error: errCaja } = await supabase.from('caja').insert([payloadCaja]);
      if (errCaja) {
        console.error('Error al registrar caja:', errCaja.message || JSON.stringify(errCaja));
      }
    }

    return true;
  } catch (e: any) {
    console.error('Error en registrarNominaYCambioTurno:', e);
    alert(`Error inesperado: ${e?.message || 'Error de ejecución'}`);
    return false;
  }
}