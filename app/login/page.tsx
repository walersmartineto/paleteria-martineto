'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Función exacta para obtener la fecha y hora actual en Colombia (YYYY-MM-DD HH:mm:ss)
const obtenerFechaHoraColombia = () => {
  const fechaHoraLocal = new Date().toLocaleString("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const [datePart, timePart] = fechaHoraLocal.split(', ');
  const [month, day, year] = datePart.split('/');
  return `${year}-${month}-${day} ${timePart}`;
};

export default function PaginaLoginWalers() {
  const router = useRouter();

  const [sedes, setSedes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  const [sedeId, setSedeId] = useState<string>(''); 
  const [usuarioId, setUsuarioId] = useState<string>('');
  const [turno, setTurno] = useState<string>('Mañana / Apertura');
  const [clave, setClave] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      try {
        const { data: dSedes } = await supabase.from('sede').select('*');
        if (dSedes && dSedes.length > 0) {
          const sedesOrdenadas = dSedes.sort((a, b) => {
            const nombreA = (a.nombre || a.nombre_sede || '').toLowerCase();
            const nombreB = (b.nombre || b.nombre_sede || '').toLowerCase();
            return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
          });
          setSedes(sedesOrdenadas);
        } else {
          const sedesDefault = [
            { id: 4, nombre: 'Walers Martineto' },
            { id: 3, nombre: 'Walers Ositos' },
            { id: 2, nombre: 'Walers Centro' },
            { id: 1, nombre: 'Walers Viva' },
            { id: 5, nombre: 'Producción' }
          ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
          setSedes(sedesDefault);
        }

        const { data: dUsuarios, error } = await supabase.from('usuario').select('*');
        if (error) console.error('Error cargando usuario:', error);
        if (dUsuarios) {
          const usuariosMapeados = dUsuarios.map((u: any) => ({
            ...u,
            nombre: u.nombre_completo || u.nombre || u.nombre_usuario || 'Sin nombre',
            contrasena: u.codigo_acceso || u.contrasena || u.pin || '',
            tipo_usuario: String(u.tipo_usuario || u.rol || '').toLowerCase().trim()
          })).sort((a, b) => {
            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
          });

          setUsuarios(usuariosMapeados);
        }
      } catch (e) {
        console.error('Error de conexión:', e);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, []);

  const obtenerNombreUsuario = (u: any) => {
    return (
      u.nombre ||
      u.nombre_completo ||
      u.nombre_usuario ||
      u.operario ||
      u.usuario ||
      u.nombres ||
      u.alias ||
      (u.id ? `ID #${u.id}` : 'Sin nombre')
    );
  };

  const handleIngresar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!sedeId) {
      setErrorMsg('Por favor selecciona una sede.');
      return;
    }

    if (!usuarioId) {
      setErrorMsg('Por favor selecciona tu nombre.');
      return;
    }

    const sedeObj = sedes.find(s => String(s.id) === String(sedeId));
    const nombreSedeLower = (sedeObj?.nombre || sedeObj?.nombre_sede || '').toLowerCase();
    const usuarioObj = usuarios.find(u => String(u.id) === String(usuarioId));

    try {
      if (usuarioObj && usuarioObj.contrasena && String(usuarioObj.contrasena).trim() !== '') {
        if (!clave || String(usuarioObj.contrasena).trim() !== String(clave).trim()) {
          setErrorMsg('Clave o código incorrecto.');
          return;
        }
      }

      // RESTRICCIONES DE ACCESO POR TIPO DE USUARIO
      const tipoUsuario = (usuarioObj?.tipo_usuario || '').toLowerCase();
      const esProductor = tipoUsuario.includes('productor') || tipoUsuario.includes('produccion');
      const esOperador = tipoUsuario.includes('operador') || tipoUsuario.includes('operaria');

      const esSedeProduccion = nombreSedeLower.includes('producción') || nombreSedeLower.includes('produccion');
      const esSedeAdmin = nombreSedeLower.includes('administrador') || nombreSedeLower.includes('admin');

      if (esOperador && (esSedeProduccion || esSedeAdmin)) {
        setErrorMsg('❌ Acceso denegado: Los operadores solo pueden ingresar a las sedes de atención.');
        return;
      }

      if (esProductor && !esSedeProduccion) {
        setErrorMsg('❌ Acceso denegado: Los productores solo pueden ingresar a Producción.');
        return;
      }

      if (esSedeAdmin) {
        router.replace('/admin');
        return;
      }

      if (esSedeProduccion) {
        router.replace('/produccion');
        return;
      }

      // Registro de turno usando hora exacta de Colombia
      const { data: turnoCreado } = await supabase
        .from('turno_trabajo')
        .insert([
          {
            sede_id: Number(sedeId),
            usuario_id: Number(usuarioId),
            nombre: turno,
            hora_entrada: obtenerFechaHoraColombia()
          }
        ])
        .select()
        .single();

      const nuevaSesion = {
        sede_id: Number(sedeId),
        sede_nombre: sedeObj ? (sedeObj.nombre || sedeObj.nombre_sede) : 'Sede Walers',
        usuario_id: Number(usuarioId),
        id: Number(usuarioId),
        nombre: usuarioObj ? obtenerNombreUsuario(usuarioObj) : 'Operador',
        usuario_nombre: usuarioObj ? obtenerNombreUsuario(usuarioObj) : 'Operador',
        turno_id: turnoCreado ? turnoCreado.id : null,
        turno_nombre: turno
      };

      localStorage.setItem('martineto_session', JSON.stringify(nuevaSesion));
      router.replace('/operacion');
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al ingresar al sistema.');
    }
  };

  const usuarioSeleccionadoObj = usuarios.find(u => String(u.id) === String(usuarioId));
  const tipoUsrSel = (usuarioSeleccionadoObj?.tipo_usuario || '').toLowerCase();
  const esProductorSel = tipoUsrSel.includes('productor') || tipoUsrSel.includes('produccion');
  const esOperadorSel = tipoUsrSel.includes('operador') || tipoUsrSel.includes('operaria');

  const sedesFiltradas = sedes.filter(s => {
    const nombre = (s.nombre || s.nombre_sede || '').toLowerCase();
    const esProdSede = nombre.includes('producción') || nombre.includes('produccion');
    const esGlobalSede = nombre.includes('global');

    if (esGlobalSede) return false;

    if (esProductorSel) {
      return esProdSede;
    }

    if (esOperadorSel) {
      return !esProdSede;
    }

    return !esGlobalSede;
  });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#004b87',
      backgroundImage: 'radial-gradient(circle at center, #005a9e 0%, #003366 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#031b33',
        borderRadius: '24px',
        padding: '36px 32px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        border: '1px solid #005a9e',
        borderTop: '4px solid #00d2ff',
        boxSizing: 'border-box'
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#004b87',
            border: '2px solid #0078d4',
            borderRadius: '16px',
            padding: '8px 16px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '28px', marginRight: '6px' }}>🍦</span>
            <span style={{ fontSize: '28px' }}>🍨</span>
          </div>
          
          <h1 style={{
            color: '#ffffff',
            fontSize: '26px',
            fontWeight: '900',
            letterSpacing: '1px',
            margin: '0 0 4px 0',
            textTransform: 'uppercase'
          }}>
            WALERS POS
          </h1>
          <p style={{ color: '#6ba4d8', fontSize: '12px', fontWeight: 'bold', margin: 0 }}>
            Ingreso de Personal y Asistencia por Sede
          </p>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: '#5c0000',
            border: '1px solid #ff4d4d',
            color: '#ffcccc',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '12px',
            textAlign: 'center',
            marginBottom: '16px'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleIngresar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{
              display: 'block',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              👤 SELECCIONA TU NOMBRE:
            </label>
            <select
              value={usuarioId}
              onChange={e => {
                setUsuarioId(e.target.value);
                setSedeId('');
              }}
              disabled={cargando}
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: '#010d1a',
                color: '#ffffff',
                border: '1.5px solid #005a9e',
                borderRadius: '12px',
                padding: '0 14px',
                fontSize: '14px',
                fontWeight: 'bold',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="">
                {cargando ? 'Cargando usuarios...' : '-- Selecciona Usuario --'}
              </option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {obtenerNombreUsuario(u)} {u.tipo_usuario ? `(${u.tipo_usuario})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              🏢 SELECCIONA LA SEDE:
            </label>
            <select
              value={sedeId}
              onChange={e => setSedeId(e.target.value)}
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: '#010d1a',
                color: '#ffffff',
                border: '1.5px solid #005a9e',
                borderRadius: '12px',
                padding: '0 14px',
                fontSize: '14px',
                fontWeight: 'bold',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="">-- Elige una Sede --</option>
              {sedesFiltradas.map(s => (
                <option key={s.id} value={s.id}>{s.nombre || s.nombre_sede}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              ⏰ TURNO:
            </label>
            <select
              value={turno}
              onChange={e => setTurno(e.target.value)}
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: '#010d1a',
                color: '#ffffff',
                border: '1.5px solid #005a9e',
                borderRadius: '12px',
                padding: '0 14px',
                fontSize: '14px',
                fontWeight: 'bold',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="Mañana / Apertura">🌅 Mañana / Apertura</option>
              <option value="Tarde / Cierre">🌆 Tarde / Cierre</option>
              <option value="Día Completo">☀️ Día Completo</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              🔐 CÓDIGO / CLAVE PERSONAL:
            </label>
            <input
              type="password"
              placeholder="••••••"
              value={clave}
              onChange={e => setClave(e.target.value)}
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: '#010d1a',
                color: '#ffffff',
                border: '1.5px solid #005a9e',
                borderRadius: '12px',
                padding: '0 14px',
                fontSize: '18px',
                letterSpacing: '4px',
                textAlign: 'center',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              height: '50px',
              backgroundColor: '#0078d4',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '900',
              letterSpacing: '0.5px',
              cursor: 'pointer',
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 6px 15px rgba(0, 120, 212, 0.4)'
            }}
          >
            🚀 INGRESAR AL SISTEMA
          </button>
        </form>
      </div>
    </div>
  );
}