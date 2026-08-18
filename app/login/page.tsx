'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerSedes,
  obtenerUsuariosOperadores,
  validarAccesoEmpleado,
  registrarInicioTurno,
  SedeInfo,
  UsuarioLoginInfo,
} from '@/lib/loginQueries';

// Lista de sedes por defecto si la base de datos aún no tiene registros
const SEDES_DEFAULT: SedeInfo[] = [
  { id: 1, nombre: 'Martineto POS', codigo: 'martineto', descripcion: 'Sede Principal Martineto POS' },
  { id: 2, nombre: 'Walers Viva', codigo: 'viva', descripcion: 'Sede CC Viva' },
  { id: 3, nombre: 'Walers Centro', codigo: 'centro', descripcion: 'Sede Sector Centro' },
  { id: 4, nombre: 'Ositos', codigo: 'ositos', descripcion: 'Sede Ositos' },
  { id: 99, nombre: 'Administración Global', codigo: 'admin', descripcion: 'Panel de Control Central' },
];

export default function LoginPage() {
  const router = useRouter();

  const [sedes, setSedes] = useState<SedeInfo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioLoginInfo[]>([]);

  const [sedeSeleccionada, setSedeSeleccionada] = useState<number | ''>('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<number | ''>('');
  const [codigoAcceso, setCodigoAcceso] = useState('');
  const [tipoTurno, setTipoTurno] = useState('manana_apertura');

  const [errorMensaje, setErrorMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  async function cargarDatosIniciales() {
    setCargando(true);
    try {
      const listaSedes = await obtenerSedes();
      const listaUsuarios = await obtenerUsuariosOperadores();

      if (listaSedes && listaSedes.length > 0) {
        setSedes(listaSedes);
      } else {
        setSedes(SEDES_DEFAULT);
      }

      setUsuarios(listaUsuarios || []);
    } catch (err) {
      console.warn('Error al cargar datos de Supabase, usando sedes por defecto:', err);
      setSedes(SEDES_DEFAULT);
    } finally {
      setCargando(false);
    }
  }

  async function handleIngresar(e: React.FormEvent) {
    e.preventDefault();
    setErrorMensaje('');

    if (!sedeSeleccionada) {
      setErrorMensaje('Por favor selecciona una sede o Administración');
      return;
    }
    if (!usuarioSeleccionado) {
      setErrorMensaje('Por favor selecciona tu usuario');
      return;
    }
    if (!codigoAcceso.trim()) {
      setErrorMensaje('Ingresa tu código de acceso');
      return;
    }

    setCargando(true);

    try {
      // 1. Validar clave del usuario
      const resValida = await validarAccesoEmpleado(Number(usuarioSeleccionado), codigoAcceso);

      if (!resValida || !resValida.exito || !resValida.usuario) {
        setErrorMensaje(resValida?.mensaje || 'Código de acceso incorrecto');
        setCargando(false);
        return;
      }

      // 2. Extraer información del usuario y sede seleccionada
      const usuario = resValida.usuario;
      const sedeObj = sedes.find((s) => s.id === Number(sedeSeleccionada));

      const usuarioId = usuario.id;
      const nombreCompleto = usuario.nombre_completo || 'Usuario';
      const tipoUsuario = usuario.tipo_usuario || 'operador';
      const sedeId = sedeObj ? sedeObj.id : Number(sedeSeleccionada);
      const sedeNombre = sedeObj ? sedeObj.nombre : 'Sede General';
      const sedeCodigo = sedeObj ? sedeObj.codigo : 'viva';

      // 3. Caso Administrador o selección de Administración Global
      if (tipoUsuario === 'administrador' || sedeCodigo === 'admin') {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'martineto_session',
            JSON.stringify({
              usuario_id: usuarioId,
              nombre: nombreCompleto,
              rol: 'administrador',
              sede_id: sedeId,
              sede_codigo: 'admin',
              turno: tipoTurno,
            })
          );
        }
        router.push('/admin');
        return;
      }

      // 4. Caso Operador: Registrar Turno en la BD
      let turnoId = null;
      try {
        const turnoObj = await registrarInicioTurno(sedeId, usuarioId, tipoTurno);
        if (turnoObj && turnoObj.id) turnoId = turnoObj.id;
      } catch (errTurno) {
        console.warn('Registro de turno en modo libre:', errTurno);
      }

      // 5. Guardar sesión en LocalStorage con el valor explícito del turno
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'martineto_session',
          JSON.stringify({
            usuario_id: usuarioId,
            nombre: nombreCompleto,
            rol: 'operador',
            sede_id: sedeId,
            sede_nombre: sedeNombre,
            sede_codigo: sedeCodigo,
            turno_id: turnoId,
            turno: tipoTurno,
          })
        );
      }

      // 6. Redirección DIRECTA según la sede elegida
      if (sedeCodigo === 'martineto') {
        router.push('/pos');
      } else if (sedeCodigo === 'viva') {
        router.push('/viva');
      } else if (sedeCodigo === 'centro') {
        router.push('/centro');
      } else if (sedeCodigo === 'ositos') {
        router.push('/ositos');
      } else {
        router.push('/admin');
      }
    } catch (errGlobal) {
      console.error('Error durante el login:', errGlobal);
      setErrorMensaje('Ocurrió un error inesperado al conectar.');
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#0d111a] border border-gray-800 p-6 rounded-3xl space-y-5 shadow-2xl">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-purple-900/50">
            🍦
          </div>
          <h1 className="text-xl font-black text-white tracking-wider">WALERS POS</h1>
          <p className="text-xs text-gray-400">Ingreso de Personal y Asistencia</p>
        </div>

        {errorMensaje && (
          <p className="text-xs text-rose-400 bg-rose-950/60 p-3 rounded-xl border border-rose-800/40 text-center font-bold">
            ⚠️ {errorMensaje}
          </p>
        )}

        <form onSubmit={handleIngresar} className="space-y-4">
          {/* Seleccionar Sede */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1">🏢 Selecciona la Sede / Módulo:</label>
            <select
              value={sedeSeleccionada}
              onChange={(e) => setSedeSeleccionada(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-bold"
            >
              <option value="">-- Elige Sede o Administración --</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo === 'admin' ? '⚙️ ADMINISTRACIÓN GLOBAL' : `🏢 ${s.nombre}`}
                </option>
              ))}
            </select>
          </div>

          {/* Seleccionar Usuario */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1">👤 Selecciona tu Nombre:</label>
            <select
              value={usuarioSeleccionado}
              onChange={(e) => setUsuarioSeleccionado(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-bold"
            >
              <option value="">-- Selecciona Usuario --</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo} ({u.tipo_usuario})
                </option>
              ))}
            </select>
          </div>

          {/* Turno */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1">⏰ Turno (Solo Operadores):</label>
            <select
              value={tipoTurno}
              onChange={(e) => setTipoTurno(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-bold"
            >
              <option value="manana_apertura">Mañana / Apertura</option>
              <option value="tarde_cierre">Tarde / Cierre</option>
              <option value="dia_completo">Día Completo</option>
            </select>
          </div>

          {/* Clave */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1">🔐 Código / Clave Personal:</label>
            <input
              type="password"
              placeholder="Ingresa tu clave"
              value={codigoAcceso}
              onChange={(e) => setCodigoAcceso(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-bold text-center tracking-widest text-lg"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs transition-all shadow-lg shadow-purple-900/40"
          >
            {cargando ? 'Validando...' : '🚀 Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </main>
  );
}