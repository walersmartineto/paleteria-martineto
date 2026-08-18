import { supabase } from './supabase';

export interface TarifasBears {
  subsidio: number;
  transporte: number;
  horaDiaEntreSemana: number;
  horaNocheEntreSemana: number;
  horaDiaFestivo: number;
  horaNocheFestivo: number;
}

// 1. Obtener tarifas de nómina para 12 Friendly Bears
export async function obtenerTarifasBears(): Promise<TarifasBears> {
  try {
    const { data, error } = await supabase.from('configuracion_tarifas').select('*').single();
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
    return data;
  } catch {
    return {
      subsidio: 9600,
      transporte: 8400,
      horaDiaEntreSemana: 7200,
      horaNocheEntreSemana: 10700,
      horaDiaFestivo: 12700,
      horaNocheFestivo: 15200,
    };
  }
}

// 2. Registrar Base Inicial de Caja para 12 Friendly Bears
export async function registrarBaseCajaBears(sedeId: number, usuarioId: number, monto: number) {
  const { error } = await supabase.from('caja_base').insert([
    {
      sede_id: sedeId,
      usuario_id: usuarioId,
      monto_base: monto,
      fecha: new Date().toISOString(),
    },
  ]);
  return !error;
}

// 3. Registrar Movimiento de Inventario 12 Friendly Bears (TOTAL PALETAS Y EMPAQUES)
export async function registrarMovimientoBears(
  sedeId: number,
  usuarioId: number,
  tipoMovimiento: string,
  totalPaletas: number,
  cajasMostrador: number,
  observaciones: string
) {
  const { data, error } = await supabase.from('inventario_centro').insert([
    {
      sede_id: sedeId,
      usuario_id: usuarioId,
      tipo_movimiento: tipoMovimiento,
      total_paletas: totalPaletas,
      cajas_mostrador: cajasMostrador,
      observaciones: observaciones,
    },
  ]);

  if (error) {
    console.error('Error guardando en inventario de 12 Friendly Bears:', error);
    return false;
  }

  return true;
}

// 4. Crear Pedido de Insumos para 12 Friendly Bears
export async function crearPedidoInsumosBears(
  sedeId: number,
  usuarioId: number,
  categoria: string,
  detalleItems: any,
  observacion: string
) {
  try {
    const { data, error } = await supabase
      .from('pedidos_insumos')
      .insert([
        {
          sede_id: Number(sedeId),
          usuario_id: Number(usuarioId),
          categoria: categoria,
          detalle_items: detalleItems,
          observacion: observacion || '',
          estado: 'PENDIENTE',
        },
      ])
      .select();

    if (error) {
      console.error('Error enviando pedido a pedidos_insumos:', error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Excepción en crearPedidoInsumosBears:', err);
    return false;
  }
}

// 5. Obtener Historial de Pedidos de la Sede 12 Friendly Bears
export async function obtenerPedidosInsumosBears(sedeId: number) {
  const { data, error } = await supabase
    .from('pedidos_insumos')
    .select('*')
    .eq('sede_id', sedeId)
    .order('fecha', { ascending: false })
    .limit(10);

  if (error) return [];
  return data || [];
}