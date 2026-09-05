import { supabase } from './supabase';

export const SEDE_OSITOS_ID = 3; // 12 Friendly Bears

// ==========================================
// 1. CARGA DE CATALOGOS Y MESAS DE OSITOS
// ==========================================
export const fetchProductosOsitos = async () => {
  const { data, error } = await supabase
    .from('produc_ven_ositos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const fetchEmpaquesOsitos = async () => {
  const { data, error } = await supabase
    .from('empaques_ositos')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const fetchMesasOsitos = async () => {
  const { data, error } = await supabase
    .from('mesa')
    .select('*')
    .eq('sede_id', SEDE_OSITOS_ID)
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
};

// ==========================================
// 2. REGISTRO COMPLETO DE VENTAS
// ==========================================
export const registrarVentaOsitos = async ({
  cajaId,
  mesaId,
  usuarioId,
  items,
  montoEfectivo,
  montoNequi,
  montoDaviplata,
  montoTarjeta,
  montoRappi,
  montoTotal,
  descuento = 0,
  observaciones = ''
}: {
  cajaId: number;
  mesaId?: number | null;
  usuarioId: number;
  items: Array<{ id: number; nombre: string; precio: number; cantidad: number }>;
  montoEfectivo: number;
  montoNequi: number;
  montoDaviplata: number;
  montoTarjeta: number;
  montoRappi: number;
  montoTotal: number;
  descuento?: number;
  observaciones?: string;
}) => {
  // A. Insertar Encabezado de Venta
  const { data: venta, error: errorVenta } = await supabase
    .from('venta')
    .insert([
      {
        sede_id: SEDE_OSITOS_ID,
        caja_id: cajaId,
        mesa_id: mesaId || null,
        usuario_id: usuarioId,
        total: montoTotal,
        descuento: descuento,
        monto_efectivo: montoEfectivo,
        monto_nequi: montoNequi,
        monto_daviplata: montoDaviplata,
        monto_tarjeta: montoTarjeta,
        monto_rappi: montoRappi,
        observaciones,
        fecha: new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (errorVenta) throw errorVenta;

  // B. Insertar Detalle de Venta
  const detalles = items.map((item) => ({
    venta_id: venta.id,
    producto_ositos_id: item.id,
    nombre_producto: item.nombre,
    precio_unitario: item.precio,
    cantidad: item.cantidad,
    subtotal: item.precio * item.cantidad
  }));

  const { error: errorDetalle } = await supabase
    .from('venta_detalle')
    .insert(detalles);

  if (errorDetalle) {
    // Si la tabla venta_detalle general no usa producto_ositos_id, se inserta con estructura basica
    await supabase.from('venta_detalle').insert(
      items.map((item) => ({
        venta_id: venta.id,
        nombre_producto: item.nombre,
        precio_unitario: item.precio,
        cantidad: item.cantidad,
        subtotal: item.precio * item.cantidad
      }))
    );
  }

  // C. Liberar Mesa si aplica
  if (mesaId) {
    await supabase
      .from('mesa')
      .update({ estado: 'libre' })
      .eq('id', mesaId);
  }

  return venta;
};

// ==========================================
// 3. VALIDACION Y CAMBIO DE TURNO
// ==========================================
export const validarOperarioLibre = async (usuarioId: number) => {
  const { data, error } = await supabase
    .from('caja')
    .select('id, sede_id, sede(nombre)')
    .eq('usuario_id', usuarioId)
    .eq('estado', 'abierta')
    .neq('sede_id', SEDE_OSITOS_ID);

  if (error) throw error;

  if (data && data.length > 0) {
    const sedeAbierta = (data[0] as any).sede?.nombre || `Sede #${data[0].sede_id}`;
    return {
      disponible: false,
      mensaje: `El operario seleccionado ya tiene un turno abierto en la sede ${sedeAbierta}. Debe cerrar turno allí antes de ingresar a 12 Friendly Bears.`
    };
  }

  return { disponible: true };
};

export const ejecutarCambioTurnoOsitos = async ({
  cajaId,
  usuarioEntranteId,
  efectivoFisicoDejado
}: {
  cajaId: number;
  usuarioEntranteId: number;
  efectivoFisicoDejado: number;
}) => {
  const validacion = await validarOperarioLibre(usuarioEntranteId);
  if (!validacion.disponible) {
    throw new Error(validacion.mensaje);
  }

  const { data, error } = await supabase
    .from('caja')
    .update({
      usuario_id: usuarioEntranteId,
      ultimo_conteo_efectivo: efectivoFisicoDejado,
      updated_at: new Date().toISOString()
    })
    .eq('id', cajaId)
    .select();

  if (error) throw error;
  return data;
};

// ==========================================
// 4. REGISTRO DE GASTOS Y LIQUIDACION DE NOMINA
// ==========================================
export const registrarGastoOsitos = async ({
  usuarioId,
  concepto,
  monto
}: {
  usuarioId: number;
  concepto: string;
  monto: number;
}) => {
  const { data, error } = await supabase
    .from('gastos')
    .insert([
      {
        sede_id: SEDE_OSITOS_ID,
        usuario_id: usuarioId,
        descripcion: concepto,
        monto: monto,
        fecha: new Date().toISOString()
      }
    ]);

  if (error) throw error;
  return data;
};

export const calcularYRegistrarNominaOsitos = async ({
  usuarioId,
  horasDia,
  horasNoche,
  esFestivo
}: {
  usuarioId: number;
  horasDia: number;
  horasNoche: number;
  esFestivo: boolean;
}) => {
  const { data: tarifa, error: errorTarifa } = await supabase
    .from('configuracion_tarifa')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (errorTarifa || !tarifa) {
    throw new Error('No se pudo obtener la configuración de tarifas/salario.');
  }

  const valorHoraDia = esFestivo ? Number(tarifa.hora_festiva_dia) : Number(tarifa.hora_ordinaria_dia);
  const valorHoraNoche = esFestivo ? Number(tarifa.hora_festiva_noche) : Number(tarifa.hora_ordinaria_noche);

  const subtotalHorasDia = horasDia * valorHoraDia;
  const subtotalHorasNoche = horasNoche * valorHoraNoche;

  const totalHoras = horasDia + horasNoche;
  const subsidioTransporte = totalHoras > 0 ? Number(tarifa.subsidio_transporte || 0) : 0;
  const subsidioAlimentacion = totalHoras > 0 ? Number(tarifa.subsidio_alimentacion || 0) : 0;

  const montoTotal = subtotalHorasDia + subtotalHorasNoche + subsidioTransporte + subsidioAlimentacion;

  const { data: nominaRegistrada, error: errorNomina } = await supabase
    .from('nomina')
    .insert([
      {
        sede_id: SEDE_OSITOS_ID,
        usuario_id: usuarioId,
        monto: montoTotal,
        horas_dia: horasDia,
        horas_noche: horasNoche,
        tipo_dia: esFestivo ? 'Festivo/Dominical' : 'Ordinario',
        subsidio_transporte: subsidioTransporte,
        subsidio_alimentacion: subsidioAlimentacion,
        fecha: new Date().toISOString()
      }
    ])
    .select();

  if (errorNomina) throw errorNomina;

  return {
    montoTotal,
    desglose: {
      valorHoraDia,
      valorHoraNoche,
      subtotalHorasDia,
      subtotalHorasNoche,
      subsidioTransporte,
      subsidioAlimentacion
    },
    nominaRegistrada
  };
};

// ==========================================
// 5. CIERRE DEFINITIVO DE CAJA (MARTINETO APPLIED)
// ==========================================
export const calcularYEjecutarCierreCajaOsitos = async ({
  cajaId,
  efectivoDeclarado
}: {
  cajaId: number;
  efectivoDeclarado: number;
}) => {
  const { data: caja, error: errorCaja } = await supabase
    .from('caja')
    .select('*')
    .eq('id', cajaId)
    .single();

  if (errorCaja) throw errorCaja;

  const { data: ventas, error: errorVentas } = await supabase
    .from('venta')
    .select('monto_efectivo')
    .eq('caja_id', cajaId);

  if (errorVentas) throw errorVentas;
  const totalVentasEfectivo = (ventas || []).reduce((acc, v) => acc + (Number(v.monto_efectivo) || 0), 0);

  const { data: gastos, error: errorGastos } = await supabase
    .from('gastos')
    .select('monto')
    .eq('sede_id', SEDE_OSITOS_ID)
    .gte('fecha', caja.fecha_apertura);

  if (errorGastos) throw errorGastos;
  const totalGastos = (gastos || []).reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  const { data: nomina, error: errorNomina } = await supabase
    .from('nomina')
    .select('monto')
    .eq('sede_id', SEDE_OSITOS_ID)
    .gte('fecha', caja.fecha_apertura);

  if (errorNomina) throw errorNomina;
  const totalNomina = (nomina || []).reduce((acc, n) => acc + (Number(n.monto) || 0), 0);

  const baseInicial = Number(caja.base_inicial) || 0;
  const efectivoEsperado = baseInicial + totalVentasEfectivo - totalGastos - totalNomina;
  const descuadre = efectivoDeclarado - efectivoEsperado;

  const { data: cajaCerrada, error: errorCierre } = await supabase
    .from('caja')
    .update({
      estado: 'cerrada',
      fecha_cierre: new Date().toISOString(),
      total_ventas_efectivo: totalVentasEfectivo,
      total_gastos: totalGastos,
      total_nomina: totalNomina,
      efectivo_esperado: efectivoEsperado,
      efectivo_declarado: efectivoDeclarado,
      descuadre: descuadre
    })
    .eq('id', cajaId)
    .select();

  if (errorCierre) throw errorCierre;

  return {
    resumen: {
      baseInicial,
      totalVentasEfectivo,
      totalGastos,
      totalNomina,
      efectivoEsperado,
      efectivoDeclarado,
      descuadre
    },
    cajaCerrada
  };
};