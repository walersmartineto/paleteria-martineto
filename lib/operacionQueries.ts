import { supabase } from './supabase'; // Ajusta si la ruta a tu cliente supabase es './supabaseClient'

export interface DatosOperacion {
  ventasEfectivo: number;
  totalNequi: number;
  totalDaviplata: number;
  totalRappi: number;
  totalOtros: number;
  detallesOtros: string[];
  totalDescuentos: number;
  motivosDescuentos: string[];
  inventarioProductos: Array<{
    nombre: string;
    apertura: number;
    entradas: number;
    mermas: number;
    vendidos: number;
  }>;
}

/**
 * Consulta las ventas acumuladas del día e inventarios para el módulo de operaciones
 */
export async function obtenerDatosOperacionDia(idSede: string, fechaHoy: string): Promise<DatosOperacion> {
  // 1. Consultar ventas del día en la tabla 'venta' (singular)
  const { data: ventas, error: errorVentas } = await supabase
    .from('venta')
    .select('monto, metodo_pago, otros, detalle_otro, descuento, motivo_descuento, efectivo, nequi, daviplata, rappi')
    .eq('sede_id', idSede)
    .gte('created_at', `${fechaHoy}T00:00:00`)
    .lte('created_at', `${fechaHoy}T23:59:59`);

  if (errorVentas) {
    console.error('Error al obtener ventas del día:', errorVentas);
  }

  let ventasEfectivo = 0;
  let totalNequi = 0;
  let totalDaviplata = 0;
  let totalRappi = 0;
  let totalOtros = 0;
  const detallesOtrosSet = new Set<string>();

  let totalDescuentos = 0;
  const motivosSet = new Set<string>();

  (ventas || []).forEach((v: any) => {
    // Si la tabla maneja montos directos por columna o por metodo_pago
    if (v.efectivo) ventasEfectivo += Number(v.efectivo || 0);
    if (v.nequi) totalNequi += Number(v.nequi || 0);
    if (v.daviplata) totalDaviplata += Number(v.daviplata || 0);
    if (v.rappi) totalRappi += Number(v.rappi || 0);
    
    // Suma de la nueva columna 'otros'
    if (v.otros) {
      totalOtros += Number(v.otros || 0);
      if (v.detalle_otro && v.detalle_otro !== 'EMPTY') {
        detallesOtrosSet.add(v.detalle_otro);
      }
    }

    // Evaluación por método de pago string si el monto viene en una sola columna 'monto'
    const metodo = (v.metodo_pago || '').toLowerCase().trim();
    const monto = Number(v.monto || 0);

    if (monto > 0 && !v.efectivo && !v.nequi && !v.daviplata && !v.rappi && !v.otros) {
      if (metodo === 'efectivo') ventasEfectivo += monto;
      else if (metodo === 'nequi') totalNequi += monto;
      else if (metodo === 'daviplata') totalDaviplata += monto;
      else if (metodo === 'rappi') totalRappi += monto;
      else if (metodo === 'otros') {
        totalOtros += monto;
        if (v.detalle_otro && v.detalle_otro !== 'EMPTY') detallesOtrosSet.add(v.detalle_otro);
      }
    }

    // Descuentos
    if (v.descuento && Number(v.descuento) > 0) {
      totalDescuentos += Number(v.descuento);
      if (v.motivo_descuento) motivosSet.add(v.motivo_descuento);
    }
  });

  // 2. Consultar auditoría de inventario desde 'inventario_diario' o 'productos_para_venta'
  const { data: inventarioData, error: errorInv } = await supabase
    .from('inventario_diario')
    .select('nombre_producto, stock_apertura, entradas, mermas, vendidos')
    .eq('sede_id', idSede);

  if (errorInv) {
    console.error('Error al obtener inventario:', errorInv);
  }

  const inventarioProductos = (inventarioData || []).map((item: any) => ({
    nombre: item.nombre_producto || 'Producto',
    apertura: Number(item.stock_apertura || 0),
    entradas: Number(item.entradas || 0),
    mermas: Number(item.mermas || 0),
    vendidos: Number(item.vendidos || 0),
  }));

  return {
    ventasEfectivo,
    totalNequi,
    totalDaviplata,
    totalRappi,
    totalOtros,
    detallesOtros: Array.from(detallesOtrosSet),
    totalDescuentos,
    motivosDescuentos: Array.from(motivosSet),
    inventarioProductos,
  };
}

/**
 * Guarda el registro del cierre definitivo de caja
 */
export async function guardarCierreCajaBD(datosCierre: any) {
  const { data, error } = await supabase
    .from('turno_trabajo')
    .insert([datosCierre]);

  if (error) {
    console.error('Error guardando cierre en BD:', error);
    throw error;
  }
  return data;
}

/**
 * Registra un nuevo gasto en la tabla 'gasto' de Supabase
 */
export async function registrarGastoBD(datosGasto: {
  monto: number;
  motivo: string;
  metodoPago: string;
  sede_id: number | null;
  usuario_id: number | null;
  turno_id: number | null;
}) {
  const { data, error } = await supabase
    .from('gasto')
    .insert([
      {
        monto: datosGasto.monto,
        descripcion: datosGasto.motivo,
        sede_id: datosGasto.sede_id,
        usuario_id: datosGasto.usuario_id,
        turno_id: datosGasto.turno_id,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error registrando gasto:', error);
    throw error;
  }
  return data;
}

/**
 * Consulta los gastos registrados en el día para la sede activa
 */
export async function obtenerGastosDiaBD(sedeId: number, fechaHoy: string) {
  const { data, error } = await supabase
    .from('gasto')
    .select('id, monto, descripcion, created_at')
    .eq('sede_id', sedeId)
    .gte('created_at', `${fechaHoy}T00:00:00`)
    .lte('created_at', `${fechaHoy}T23:59:59`);

  if (error) {
    console.error('Error al obtener gastos del día:', error);
    return [];
  }

  return (data || []).map((g: any) => ({
    id: String(g.id),
    monto: Number(g.monto || 0),
    motivo: g.descripcion || 'Gasto registrado',
    metodoPago: 'Efectivo',
    hora: g.created_at
      ? new Date(g.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      : '',
  }));
}