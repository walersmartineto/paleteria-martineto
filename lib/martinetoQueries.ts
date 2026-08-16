import { supabase } from './supabase';

export interface ProductoPOS {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  es_comun?: boolean;
}

export interface MesaPOS {
  id: number;
  nombre: string;
  tipo: 'mesa' | 'pasillo';
  estado: 'libre' | 'ocupada_debe' | 'ocupada_pagado';
}

// 1. Cargar productos desde Supabase
export async function obtenerProductosMartineto(): Promise<ProductoPOS[]> {
  const { data, error } = await supabase
    .from('producto')
    .select('*')
    .order('nombre', { ascending: true });

  if (error || !data) return [];
  return data;
}

// 2. Cargar mesas de Martineto
export async function obtenerMesasMartineto(sedeId: number): Promise<MesaPOS[]> {
  const { data, error } = await supabase
    .from('mesa')
    .select('*')
    .eq('sede_id', sedeId)
    .order('id', { ascending: true });

  if (error || !data) return [];
  return data;
}

// 3. Actualizar estado de la mesa (Función requerida)
export async function actualizarEstadoMesa(mesaId: number, estado: string) {
  const { error } = await supabase
    .from('mesa')
    .update({ estado })
    .eq('id', mesaId);

  return !error;
}

// 4. Registrar Venta con Descuento Automático de Stock
export async function registrarVentaPOS(
  sedeId: number,
  usuarioId: number,
  mesaId: number | null,
  montoTotal: number,
  esRappi: boolean,
  pagosDetalle: { tipo_pago_id: number; monto: number }[],
  productosVendidos: { producto_id: number; cantidad: number; precio_unitario: number }[]
) {
  // A. Insertar Encabezado de Venta
  const { data: ventaData, error: ventaError } = await supabase
    .from('venta')
    .insert([
      {
        sede_id: sedeId,
        usuario_id: usuarioId,
        mesa_id: mesaId,
        monto_total: montoTotal,
        es_rappi: esRappi,
        estado: 'cobrado',
      },
    ])
    .select()
    .single();

  if (ventaError || !ventaData) {
    console.error('Error insertando venta:', ventaError);
    return false;
  }

  const ventaId = ventaData.id;

  // B. Insertar Desglose de Métodos de Pago
  const pagosPayload = pagosDetalle
    .filter((p) => p.monto > 0)
    .map((p) => ({
      venta_id: ventaId,
      tipo_pago_id: p.tipo_pago_id,
      monto: p.monto,
    }));

  if (pagosPayload.length > 0) {
    await supabase.from('venta_pago_detalle').insert(pagosPayload);
  }

  // C. Insertar Detalle de Productos
  for (const item of productosVendidos) {
    await supabase.from('venta_detalle').insert([
      {
        venta_id: ventaId,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      },
    ]);
  }

  return true;
}

// 5. Crear Solicitud de Suministros
export async function enviarPedidoSuministroPOS(sedeId: number, usuarioId: number, descripcion: string) {
  const { error } = await supabase.from('pedido_suministro').insert([
    {
      sede_id: sedeId,
      usuario_solicita_id: usuarioId,
      descripcion_libre: descripcion,
      cantidad: 1,
    },
  ]);

  return !error;
}