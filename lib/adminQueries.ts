import { supabase } from './supabase';

export interface ResumenCajaConsolidado {
  total_efectivo: number;
  total_nequi: number;
  total_daviplata: number;
  total_gastos: number;
  total_nomina: number;
  venta_neto_global: number;
}

// Obtener Consolidado de Caja y Nómina (Admin)
export async function obtenerConsolidadoCajaAdmin(
  fecha: string, // Formato "YYYY-MM-DD"
  sedeId?: number
): Promise<ResumenCajaConsolidado> {

  // 1. Consulta Cierres de Caja
  let queryCaja = supabase
    .from('caja')
    .select('efectivo_cierre, nequi, daviplata, monto_gasto, fecha, sede_id');

  if (sedeId) {
    queryCaja = queryCaja.eq('sede_id', sedeId);
  }

  const { data: cajaData } = await queryCaja;

  // Filtrar por fecha en cliente o servidor
  const cajasFiltradas = (cajaData || []).filter(row => 
    row.fecha && String(row.fecha).startsWith(fecha)
  );

  // 2. Consulta Registros de Nómina
  let queryNomina = supabase
    .from('nomina')
    .select('monto, total_pagado, fecha_pago, fecha, sede_id');

  if (sedeId) {
    queryNomina = queryNomina.eq('sede_id', sedeId);
  }

  const { data: nominaData } = await queryNomina;

  const nominasFiltradas = (nominaData || []).filter(row => {
    const fPago = row.fecha_pago ? String(row.fecha_pago) : '';
    const fGen = row.fecha ? String(row.fecha) : '';
    return fPago.startsWith(fecha) || fGen.startsWith(fecha);
  });

  // Calcular acumulados
  let total_efectivo = 0;
  let total_nequi = 0;
  let total_daviplata = 0;
  let total_gastos = 0;

  cajasFiltradas.forEach(row => {
    total_efectivo += Number(row.efectivo_cierre || 0);
    total_nequi += Number(row.nequi || 0);
    total_daviplata += Number(row.daviplata || 0);
    total_gastos += Number(row.monto_gasto || 0);
  });

  let total_nomina = 0;
  nominasFiltradas.forEach(row => {
    total_nomina += Number(row.monto || row.total_pagado || 0);
  });

  const totalVenta = total_efectivo + total_nequi + total_daviplata;
  const venta_neto_global = totalVenta - total_gastos - total_nomina;

  return {
    total_efectivo,
    total_nequi,
    total_daviplata,
    total_gastos,
    total_nomina,
    venta_neto_global
  };
}