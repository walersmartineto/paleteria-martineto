import { supabase } from './supabase';

export interface SedeInfo {
  id: number;
  nombre: string;
  codigo: string;
  descripcion: string;
}

export interface UsuarioLoginInfo {
  id: number;
  nombre_completo: string;
  tipo_usuario: string;
}

// 1. Obtener la lista de sedes activas
export async function obtenerSedes(): Promise<SedeInfo[]> {
  const { data, error } = await supabase
    .from('sede')
    .select('id, nombre, codigo, descripcion')
    .eq('activo', true)
    .order('id', { ascending: true });

  if (error || !data) return [];
  return data;
}

// 2. Obtener la lista de usuarios/empleados activos
export async function obtenerUsuariosOperadores(): Promise<UsuarioLoginInfo[]> {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, nombre_completo, tipo_usuario')
    .eq('activo', true)
    .order('nombre_completo', { ascending: true });

  if (error || !data) return [];
  return data;
}

// 3. Validar código de acceso del empleado
export async function validarAccesoEmpleado(usuarioId: number, codigoAcceso: string) {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, nombre_completo, codigo_acceso, tipo_usuario')
    .eq('id', usuarioId)
    .single();

  if (error || !data) {
    return { exito: false, mensaje: 'Usuario no encontrado' };
  }

  if (data.codigo_acceso.trim() === codigoAcceso.trim()) {
    return { exito: true, usuario: data };
  } else {
    return { exito: false, mensaje: 'Código de acceso incorrecto' };
  }
}

// 4. Iniciar turno de trabajo en la sede
export async function registrarInicioTurno(sedeId: number, usuarioId: number, tipoTurno: string) {
  const { data, error } = await supabase
    .from('turno_trabajo')
    .insert([
      {
        sede_id: sedeId,
        usuario_id: usuarioId,
        tipo_turno: tipoTurno,
        hora_entrada: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error al registrar inicio de turno:', error);
    return null;
  }

  return data;
}