import { supabase } from './supabase';

export interface ResumenConsolidadoCompras {
  lugar_compra: string;
  nombre_producto: string;
  total_cantidad: number;
  sedes_solicitantes: string[];
  ids_pedidos: number[];
}

export interface PedidoSedeEntrega {
  id: number;
  sede_nombre: string;
  producto_nombre: string;
  cantidad: number;
  comprado: boolean;
  entregado: boolean;
  recibido: boolean;
}

export interface NovedadInventario {
  id: number;
  sede_nombre: string;
  producto_nombre: string;
  usuario_nombre: string;
  stock_cierre_anterior: number;
  stock_apertura_hoy: number;
  diferencia: number;
  fecha_registro: string;
}

export interface EmpleadoTurnoActivo {
  id: number;
  usuario_nombre: string;
  sede_nombre: string;
  tipo_turno: string;
  hora_entrada: string;
  hora_salida?: string;
  pago_dia: number;
  pago_realizado: boolean;
}

export interface UsuarioInfo {
  id: number;
  nombre_completo: string;
  codigo_acceso: string;
  tipo_usuario: string;
  activo: boolean;
}

// 1. Obtener Compras Consolidadas
export async function obtenerComprasConsolidadasAdmin(): Promise<ResumenConsolidadoCompras[]> {
  const { data, error } = await supabase
    .from('pedido_suministro')
    .select(`
      id,
      cantidad,
      comprado,
      sede:sede_id ( nombre ),
      suministro:suministro_id ( nombre, lugar_compra )
    `)
    .eq('comprado', false);

  if (error || !data) return [];

  const agrupado: { [key: string]: ResumenConsolidadoCompras } = {};

  data.forEach((item: any) => {
    const lugar = item.suministro?.lugar_compra || 'Supermercado';
    const prodNombre = item.suministro?.nombre || 'Producto';
    const clave = `${lugar}_${prodNombre}`;

    if (!agrupado[clave]) {
      agrupado[clave] = {
        lugar_compra: lugar,
        nombre_producto: prodNombre,
        total_cantidad: 0,
        sedes_solicitantes: [],
        ids_pedidos: [],
      };
    }

    agrupado[clave].total_cantidad += item.cantidad;
    agrupado[clave].ids_pedidos.push(item.id);

    const sedeNom = item.sede?.nombre || 'Sede';
    if (!agrupado[clave].sedes_solicitantes.includes(sedeNom)) {
      agrupado[clave].sedes_solicitantes.push(sedeNom);
    }
  });

  return Object.values(agrupado);
}

export async function marcarComoComprado(idsPedidos: number[]): Promise<boolean> {
  const { error } = await supabase
    .from('pedido_suministro')
    .update({ comprado: true })
    .in('id', idsPedidos);
  return !error;
}

// 2. Entregas por Sede
export async function obtenerEntregasPorSedeAdmin(): Promise<PedidoSedeEntrega[]> {
  const { data, error } = await supabase
    .from('pedido_suministro')
    .select(`
      id,
      cantidad,
      comprado,
      entregado,
      recibido,
      sede:sede_id ( nombre ),
      suministro:suministro_id ( nombre )
    `)
    .eq('comprado', true)
    .eq('entregado', false);

  if (error || !data) return [];

  return data.map((item: any) => ({
    id: item.id,
    sede_nombre: item.sede?.nombre || 'Sede',
    producto_nombre: item.suministro?.nombre || 'Producto',
    cantidad: item.cantidad,
    comprado: item.comprado,
    entregado: item.entregado,
    recibido: item.recibido,
  }));
}

export async function marcarComoEntregado(idPedido: number): Promise<boolean> {
  const { error } = await supabase
    .from('pedido_suministro')
    .update({ entregado: true, fecha_entrega: new Date().toISOString() })
    .eq('id', idPedido);
  return !error;
}

// 3. Diferencias de Inventario
export async function obtenerDiferenciasInventarioAdmin(): Promise<NovedadInventario[]> {
  const { data, error } = await supabase
    .from('diferencia_inventario')
    .select(`
      id,
      stock_cierre_anterior,
      stock_apertura_hoy,
      diferencia,
      fecha_registro,
      sede:sede_id ( nombre ),
      producto:producto_id ( nombre ),
      usuario:usuario_id ( nombre_completo )
    `)
    .eq('revisado', false)
    .order('fecha_registro', { ascending: false });

  if (error || !data) return [];

  return data.map((item: any) => ({
    id: item.id,
    sede_nombre: item.sede?.nombre || 'Sede',
    producto_nombre: item.producto?.nombre || 'Producto',
    usuario_nombre: item.usuario?.nombre_completo || 'Operador',
    stock_cierre_anterior: item.stock_cierre_anterior,
    stock_apertura_hoy: item.stock_apertura_hoy,
    diferencia: item.diferencia,
    fecha_registro: new Date(item.fecha_registro).toLocaleString('es-CO'),
  }));
}

// 4. Obtener Turnos Activos de Empleados
export async function obtenerTurnosEmpleadosAdmin(): Promise<EmpleadoTurnoActivo[]> {
  const { data, error } = await supabase
    .from('turno_trabajo')
    .select(`
      id,
      tipo_turno,
      hora_entrada,
      hora_salida,
      pago_dia,
      pago_realizado,
      sede:sede_id ( nombre ),
      usuario:usuario_id ( nombre_completo )
    `)
    .order('hora_entrada', { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data.map((item: any) => ({
    id: item.id,
    usuario_nombre: item.usuario?.nombre_completo || 'Empleado',
    sede_nombre: item.sede?.nombre || 'Sede',
    tipo_turno: item.tipo_turno,
    hora_entrada: new Date(item.hora_entrada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    hora_salida: item.hora_salida ? new Date(item.hora_salida).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : 'Trabajando...',
    pago_dia: Number(item.pago_dia || 0),
    pago_realizado: Boolean(item.pago_realizado),
  }));
}

// 5. Gestión de Empleados/Usuarios
export async function obtenerUsuariosAdmin(): Promise<UsuarioInfo[]> {
  const { data, error } = await supabase
    .from('usuario')
    .select('*')
    .order('nombre_completo', { ascending: true });

  if (error || !data) return [];
  return data;
}

export async function crearUsuarioAdmin(nombre: string, codigo: string, tipo: string) {
  const { data, error } = await supabase
    .from('usuario')
    .insert([{ nombre_completo: nombre, codigo_acceso: codigo, tipo_usuario: tipo }])
    .select();

  return { success: !error, data, error };
}