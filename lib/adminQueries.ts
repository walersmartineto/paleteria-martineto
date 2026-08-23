import { supabase } from './supabase';

export interface ResumenCajaConsolidado {
  total_efectivo: number;
  total_nequi: number;
  total_daviplata: number;
  total_gastos: number;
  venta_neto_global: number;
}

// 0. Obtener Consolidado de Caja (Subacordeón 1)
export async function obtenerConsolidadoCajaAdmin(
  fecha: string, // Espera la fecha en formato "YYYY-MM-DD"
  sedeId?: number
): Promise<ResumenCajaConsolidado> {
  
  let query = supabase
    .from('caja')
    .select('efectivo_cierre, nequi, daviplata, monto_gasto, fecha');

  if (sedeId) {
    query = query.eq('sede_id', sedeId);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return {
      total_efectivo: 0,
      total_nequi: 0,
      total_daviplata: 0,
      total_gastos: 0,
      venta_neto_global: 0,
    };
  }

  // Filtra comparando únicamente el texto de la fecha (YYYY-MM-DD)
  const registrosDelDia = data.filter((row: any) => row.fecha && String(row.fecha).startsWith(fecha));

  return registrosDelDia.reduce(
    (acc: ResumenCajaConsolidado, row: any) => {
      const efectivo = Number(row.efectivo_cierre || 0);
      const nequi = Number(row.nequi || 0);
      const daviplata = Number(row.daviplata || 0);
      const gastos = Number(row.monto_gasto || 0);

      acc.total_efectivo += efectivo;
      acc.total_nequi += nequi;
      acc.total_daviplata += daviplata;
      acc.total_gastos += gastos;
      acc.venta_neto_global += (efectivo + nequi + daviplata - gastos);

      return acc;
    },
    {
      total_efectivo: 0,
      total_nequi: 0,
      total_daviplata: 0,
      total_gastos: 0,
      venta_neto_global: 0,
    }
  );
}