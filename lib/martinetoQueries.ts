import { supabase } from './supabase';

export async function obtenerSaboresMartineto(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('produc_ven_martineto')
      .select('id, nombre, precio, activo, stock, categoria')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error cargando productos de Martineto:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Error en obtenerSaboresMartineto:', err);
    return [];
  }
}

export async function obtenerMesasMartineto(sedeId: number): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('mesa')
      .select('*')
      .eq('sede_id', sedeId)
      .order('id', { ascending: true });

    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function actualizarEstadoMesa(mesaId: number, estado: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('mesa').update({ estado }).eq('id', mesaId);
    return !error;
  } catch (err) {
    return false;
  }
}

export async function registrarBaseCajaMartineto(sedeId: number, usuarioId: number, montoApertura: number, turnoId?: number): Promise<boolean> {
  try {
    // Forzamos estrictamente el sedeId a 4 para Martineto por seguridad
    const sedeFinal = 4;

    const { error } = await supabase.from('caja').insert([
      {
        sede_id: sedeFinal,
        usuario_id: usuarioId,
        turno_id: turnoId || null,
        monto_apertura: montoApertura,
        estado: 'abierta',
        diferencia: 0,
      },
    ]);
    
    if (error) {
      console.error('Error en registrarBaseCajaMartineto:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Excepción en registrarBaseCajaMartineto:', err);
    return false;
  }
}

export async function registrarMovimientoMartineto(
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
    const sedeFinal = 4; // Forzamos estrictamente a 4 para Martineto

    const payload: any = {
      sede_id: sedeFinal,
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
      console.error('Error en registrarMovimientoMartineto:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Excepción en registrarMovimientoMartineto:', err);
    return false;
  }
}