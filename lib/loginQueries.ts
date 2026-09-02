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

// 1. Obtener la lista de sedes activas (ORDENADO ALFABÉTICAMENTE A-Z)
export async function obtenerSedes(): Promise<SedeInfo[]> {
  try {
    const { data, error } = await supabase
      .from('sede')
      .select('id, nombre, codigo, descripcion')
      .eq('activo', true)
      .order('nombre', { ascending: true }); // <--- Orden alfabético A-Z por nombre

    if (error || !data) return [];
    return data;
  } catch (err) {
    console.error('Error al obtener sedes:', err);
    return [];
  }
}

// 2. Obtener la lista de usuarios/empleados activos (ORDENADO ALFABÉTICAMENTE A-Z)
export async function obtenerUsuariosOperadores(): Promise<UsuarioLoginInfo[]> {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre_completo, tipo_usuario')
      .eq('activo', true)
      .order('nombre_completo', { ascending: true }); // <--- Orden alfabético A-Z por nombre_completo

    if (error || !data) return [];
    return data;
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    return [];
  }
}

// 3. Validar código de acceso del empleado
export async function validarAccesoEmpleado(usuarioId: number, codigoAcceso: string) {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre_completo, codigo_acceso, tipo_usuario')
      .eq('id', usuarioId)
      .single();

    if (error || !data) {
      return { exito: false, mensaje: 'Usuario no encontrado' };
    }

    if (String(data.codigo_acceso || '').trim() === String(codigoAcceso || '').trim()) {
      return { exito: true, usuario: data };
    } else {
      return { exito: false, mensaje: 'Código de acceso incorrecto' };
    }
  } catch (err: any) {
    return { exito: false, mensaje: err?.message || 'Error al validar acceso' };
  }
}

// 4. Verificar si el operario ya tiene un turno activo en OTRA sede
export async function verificarTurnoActivoUsuario(usuarioId: number, sedeActualId: number) {
  try {
    const { data, error } = await supabase
      .from('turno_trabajo')
      .select('id, sede_id, sede:sede_id(nombre)')
      .eq('usuario_id', usuarioId)
      .is('hora_salida', null); // Busca turnos activos sin hora de salida

    if (error) {
      console.error('Error al verificar turno activo:', error);
      return { tieneTurnoActivo: false };
    }

    if (data && data.length > 0) {
      // Filtrar turnos activos que NO sean de la sede a la que el usuario quiere ingresar
      const turnoEnOtraSede = data.find((t: any) => Number(t.sede_id) !== Number(sedeActualId));
      
      if (turnoEnOtraSede) {
        const nombreSede = (turnoEnOtraSede.sede as any)?.nombre || 'otra sede';
        return { 
          tieneTurnoActivo: true, 
          sedeId: turnoEnOtraSede.sede_id, 
          sede_id: turnoEnOtraSede.sede_id, 
          nombreSede 
        };
      }
    }

    return { tieneTurnoActivo: false };
  } catch (err) {
    console.error('Excepción al verificar turno activo:', err);
    return { tieneTurnoActivo: false };
  }
}

// 5. Iniciar turno de trabajo en la sede (Soporta ambos órdenes de parámetros)
export async function registrarInicioTurno(
  arg1: number,
  arg2: number | string,
  arg3?: string
) {
  try {
    let sedeId: number;
    let usuarioId: number;
    let tipoTurno: string;

    // Adaptador para compatibilidad de orden de parámetros (sedeId, usuarioId, tipoTurno) o (usuarioId, sedeId, tipoTurno)
    if (typeof arg2 === 'string') {
      usuarioId = arg1;
      tipoTurno = arg2;
      sedeId = Number(arg3) || 2;
    } else {
      sedeId = arg1;
      usuarioId = Number(arg2);
      tipoTurno = arg3 || 'manana_apertura';
    }

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
      console.error('Error en Supabase al registrar inicio de turno:', error.message || error);
      return null;
    }

    return data;
  } catch (err: any) {
    console.error('Excepción al registrar inicio de turno:', err?.message || err);
    return null;
  }
}

// 6. Actualizar contraseña/PIN de usuario
export async function actualizarCodigoAcceso(usuarioId: number, codigoActual: string, codigoNuevo: string): Promise<{ exito: boolean; mensaje: string }> {
  try {
    // 1. Validar que la clave actual sea correcta
    const { data: usuario, error: errVal } = await supabase
      .from('usuario')
      .select('id, codigo_acceso')
      .eq('id', usuarioId)
      .single();

    if (errVal || !usuario) {
      return { exito: false, mensaje: 'Usuario no encontrado.' };
    }

    if (String(usuario.codigo_acceso).trim() !== String(codigoActual).trim()) {
      return { exito: false, mensaje: 'La clave actual es incorrecta.' };
    }

    // 2. Actualizar con la nueva clave
    const { error: errUpdate } = await supabase
      .from('usuario')
      .update({ codigo_acceso: codigoNuevo })
      .eq('id', usuarioId);

    if (errUpdate) {
      return { exito: false, mensaje: 'Error al actualizar la clave en la base de datos.' };
    }

    return { exito: true, mensaje: '¡Contraseña actualizada con éxito!' };
  } catch (err) {
    console.error('Error en actualizarCodigoAcceso:', err);
    return { exito: false, mensaje: 'Error de conexión.' };
  }
}