'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerSedes,
  obtenerUsuariosOperadores,
  validarAccesoEmpleado,
  registrarInicioTurno,
  actualizarCodigoAcceso,
  verificarTurnoActivoUsuario,
  SedeInfo,
  UsuarioLoginInfo,
} from '@/lib/loginQueries';

const SEDES_DEFAULT: SedeInfo[] = [
  { id: 1, nombre: 'Martineto POS', codigo: 'martineto', descripcion: 'Sede Principal Martineto POS' },
  { id: 2, nombre: 'Walers Viva', codigo: 'viva', descripcion: 'Sede CC Viva' },
  { id: 3, nombre: 'Walers Centro', codigo: 'centro', descripcion: 'Sede Sector Centro' },
  { id: 4, nombre: 'Ositos', codigo: 'ositos', descripcion: 'Sede Ositos' },
  { id: 99, nombre: 'Administración Global', codigo: 'admin', descripcion: 'Panel de Control Central' },
];

const LOGOS_SEDES: { [codigo: string]: string } = {
  ositos: '/ositos.png.jpeg',
};

const obtenerEmojiUsuario = (nombre: string) => {
  const nombreLimpio = nombre.toLowerCase();
  
  if (nombreLimpio.includes('iris') || nombreLimpio.includes('ingeniera')) return '💻';
  if (nombreLimpio.includes('admin')) return '⚙️';
  if (nombreLimpio.includes('juliana noriega')) return '🌸';
  if (nombreLimpio.includes('juliana suspes')) return '🍦';
  if (nombreLimpio.includes('mary')) return '✨';
  if (nombreLimpio.includes('maye')) return '🌺';
  if (nombreLimpio.includes('rudy')) return '🎯';
  if (nombreLimpio.includes('sofi')) return '⭐';
  if (nombreLimpio.includes('valentina')) return '🍓';
  if (nombreLimpio.includes('william')) return '🚀';

  return '👤';
};

const obtenerEmojiSedeFallback = (codigo: string) => {
  const cod = codigo.toLowerCase();
  if (cod === 'martineto') return '🍨🪑';
  if (cod === 'viva' || cod === 'centro') return '🍦';
  if (cod === 'admin') return '⚙️';
  return '🏢';
};

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

  const [mostrarModalClave, setMostrarModalClave] = useState(false);
  const [usuarioCambioId, setUsuarioCambioId] = useState<number | ''>('');
  const [claveActual, setClaveActual] = useState('');
  const [claveNueva, setClaveNueva] = useState('');
  const [claveConfirmar, setClaveConfirmar] = useState('');
  const [mensajeModal, setMensajeModal] = useState({ texto: '', esError: false });
  const [cargandoModal, setCargandoModal] = useState(false);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  async function cargarDatosIniciales() {
    setCargando(true);
    try {
      const listaSedes = await obtenerSedes();
      const listaUsuarios = await obtenerUsuariosOperadores();

      if (listaSedes && listaSedes.length > 0) {
        const sedesFiltradas = listaSedes.filter(
          (s) => s.id !== 0 && s.codigo !== 'global' && s.codigo !== 'produccion'
        );
        setSedes(sedesFiltradas);
      } else {
        setSedes(SEDES_DEFAULT);
      }

      const usuariosFiltrados = (listaUsuarios || []).filter(
        (u) => !u.nombre_completo.toLowerCase().includes('mireya')
      );
      setUsuarios(usuariosFiltrados);

    } catch (err) {
      console.warn('Error al cargar datos de Supabase, usando sedes por defecto:', err);
      setSedes(SEDES_DEFAULT);
    } finally {
      setCargando(false);
    }
  }

  const handleCambioSede = (idSede: number) => {
    setSedeSeleccionada(idSede);

    const sedeObj = sedes.find((s) => s.id === idSede);
    if (sedeObj) {
      const cod = (sedeObj.codigo || '').toLowerCase();
      if (cod === 'martineto' || cod === 'admin') {
        setTipoTurno('dia_completo');
      } else {
        setTipoTurno('manana_apertura');
      }
    }
  };

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
      const resValida = await validarAccesoEmpleado(Number(usuarioSeleccionado), codigoAcceso);

      if (!resValida || !resValida.exito || !resValida.usuario) {
        setErrorMensaje(resValida?.mensaje || 'Código de acceso incorrecto');
        setCargando(false);
        return;
      }

      const usuario = resValida.usuario;
      const sedeObj = sedes.find((s) => s.id === Number(sedeSeleccionada));

      const usuarioId = usuario.id;
      const nombreCompleto = usuario.nombre_completo || 'Usuario';
      const tipoUsuario = (usuario.tipo_usuario || 'operador').toLowerCase();
      const sedeId = sedeObj ? sedeObj.id : Number(sedeSeleccionada);
      const sedeNombre = sedeObj ? sedeObj.nombre : 'Sede General';
      const sedeCodigo = sedeObj ? sedeObj.codigo : 'viva';

      if (tipoUsuario === 'operador' && sedeCodigo === 'admin') {
        setErrorMensaje('⛔ Un usuario Operador solo tiene acceso a Puntos de Venta.');
        setCargando(false);
        return;
      }

      // 🛑 VALIDACIÓN: Verificar turno activo previo ÚNICAMENTE si el usuario es de tipo 'operador'
      if (tipoUsuario === 'operador' && sedeCodigo !== 'admin') {
        try {
          const turnoActivoOtro = typeof verificarTurnoActivoUsuario === 'function' 
            ? await verificarTurnoActivoUsuario(usuarioId, sedeId) 
            : null;

          if (turnoActivoOtro && turnoActivoOtro.tieneTurnoActivo) {
            setErrorMensaje(`⛔ Ya tienes un turno activo en la sede "${turnoActivoOtro.nombreSede}". Cierra sesión o finaliza tu turno allá antes de ingresar a otra.`);
            setCargando(false);
            return;
          }
        } catch (errValidacion) {
          console.warn('No se pudo verificar turno activo previo:', errValidacion);
        }
      }

      if (sedeCodigo === 'admin') {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'martineto_session',
            JSON.stringify({
              usuario_id: usuarioId,
              nombre: nombreCompleto,
              rol: tipoUsuario,
              sede_id: sedeId,
              sede_codigo: 'admin',
              turno: tipoTurno,
            })
          );
        }
        router.push('/admin');
        return;
      }

      let turnoId = null;
      try {
        const turnoObj = await registrarInicioTurno(sedeId, usuarioId, tipoTurno);
        if (turnoObj && turnoObj.id) turnoId = turnoObj.id;
      } catch (errTurno) {
        console.warn('Registro de turno en modo libre:', errTurno);
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'martineto_session',
          JSON.stringify({
            usuario_id: usuarioId,
            nombre: nombreCompleto,
            rol: tipoUsuario,
            sede_id: sedeId,
            sede_nombre: sedeNombre,
            sede_codigo: sedeCodigo,
            turno_id: turnoId,
            turno: tipoTurno,
          })
        );
      }

      if (sedeCodigo === 'martineto') {
        router.push('/pos');
      } else if (sedeCodigo === 'viva') {
        router.push('/viva');
      } else if (sedeCodigo === 'centro') {
        router.push('/centro');
      } else if (sedeCodigo === 'ositos') {
        router.push('/ositos');
      } else {
        router.push('/pos');
      }
    } catch (errGlobal) {
      console.error('Error durante el login:', errGlobal);
      setErrorMensaje('Ocurrió un error inesperado al conectar.');
      setCargando(false);
    }
  }

  async function handleCambiarClave(e: React.FormEvent) {
    e.preventDefault();
    setMensajeModal({ texto: '', esError: false });

    if (!usuarioCambioId) {
      setMensajeModal({ texto: 'Selecciona tu usuario.', esError: true });
      return;
    }
    if (!claveActual.trim() || !claveNueva.trim() || !claveConfirmar.trim()) {
      setMensajeModal({ texto: 'Completa todos los campos de contraseña.', esError: true });
      return;
    }
    if (claveNueva !== claveConfirmar) {
      setMensajeModal({ texto: 'Las nuevas contraseñas no coinciden.', esError: true });
      return;
    }

    setCargandoModal(true);
    const resultado = await actualizarCodigoAcceso(Number(usuarioCambioId), claveActual, claveNueva);
    setCargandoModal(false);

    if (resultado.exito) {
      setMensajeModal({ texto: resultado.mensaje, esError: false });
      setTimeout(() => {
        setMostrarModalClave(false);
        setUsuarioCambioId('');
        setClaveActual('');
        setClaveNueva('');
        setClaveConfirmar('');
        setMensajeModal({ texto: '', esError: false });
      }, 2000);
    } else {
      setMensajeModal({ texto: resultado.mensaje, esError: true });
    }
  }

  return (
    <main className="min-h-screen bg-[#004e8c] text-[#f1f5f9] flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#0b2b48] border border-[#0066b3] p-6 md:p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 via-[#00a4ef] to-emerald-400"></div>

        <div className="text-center space-y-2 pt-2">
          <div className="w-20 h-20 rounded-2xl bg-[#003d6d] border border-[#0066b3] flex items-center justify-center p-2 mx-auto shadow-lg overflow-hidden">
            <img
              src="/login.png.jpeg"
              alt="Walers POS Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-wider">WALERS POS</h1>
          <p className="text-xs text-sky-200 font-medium">Ingreso de Personal y Asistencia</p>
        </div>

        {errorMensaje && (
          <p className="text-xs text-rose-200 bg-rose-950/80 p-3 rounded-xl border border-rose-500/60 text-center font-bold shadow-sm">
            ⚠️ {errorMensaje}
          </p>
        )}

        <form onSubmit={handleIngresar} className="space-y-4">
          <div>
            <label className="text-[11px] font-extrabold text-sky-200 block mb-1 uppercase tracking-wider">
              🏢 Selecciona la Sede / Módulo:
            </label>
            <select
              value={sedeSeleccionada}
              onChange={(e) => handleCambioSede(Number(e.target.value))}
              className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-3 text-xs md:text-sm text-white outline-none font-bold cursor-pointer focus:border-[#00a4ef] transition-colors"
            >
              <option value="">-- Elige Sede o Administración --</option>
              {sedes
                .filter((s) => s.id !== 0 && s.codigo !== 'global' && s.codigo !== 'produccion')
                .map((s) => {
                  const logoSede = LOGOS_SEDES[s.codigo];
                  return (
                    <option key={s.id} value={s.id}>
                      {logoSede ? '🧸' : obtenerEmojiSedeFallback(s.codigo)} {s.codigo === 'admin' ? 'ADMINISTRACIÓN GLOBAL' : s.nombre}
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-extrabold text-sky-200 block mb-1 uppercase tracking-wider">
              👤 Selecciona tu Nombre:
            </label>
            <select
              value={usuarioSeleccionado}
              onChange={(e) => setUsuarioSeleccionado(Number(e.target.value))}
              className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-3 text-xs md:text-sm text-white outline-none font-bold cursor-pointer focus:border-[#00a4ef] transition-colors"
            >
              <option value="">-- Selecciona Usuario --</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {obtenerEmojiUsuario(u.nombre_completo)} {u.nombre_completo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-extrabold text-sky-200 block mb-1 uppercase tracking-wider">
              ⏰ Turno:
            </label>
            <select
              value={tipoTurno}
              onChange={(e) => setTipoTurno(e.target.value)}
              className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-3 text-xs md:text-sm text-white outline-none font-bold cursor-pointer focus:border-[#00a4ef] transition-colors"
            >
              <option value="manana_apertura">🌅 Mañana / Apertura</option>
              <option value="tarde_cierre">🌙 Tarde / Cierre</option>
              <option value="dia_completo">☀️ Día Completo</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-extrabold text-sky-200 block mb-1 uppercase tracking-wider">
              🔐 Código / Clave Personal:
            </label>
            <input
              type="password"
              placeholder="••••••"
              value={codigoAcceso}
              onChange={(e) => setCodigoAcceso(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-3 text-sky-200 outline-none font-black text-center tracking-widest text-lg focus:border-[#00a4ef] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-[#0078d4] hover:bg-[#0086e6] disabled:opacity-50 text-white font-black py-3.5 rounded-xl text-xs md:text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#003d6d] cursor-pointer mt-2"
          >
            {cargando ? 'Validando...' : '🚀 Ingresar al Sistema'}
          </button>
        </form>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setMostrarModalClave(true)}
            className="text-xs text-sky-300 hover:text-white font-bold underline transition-colors cursor-pointer"
          >
            🔑 ¿Cambiar tu contraseña o PIN?
          </button>
        </div>

        <div className="pt-2 text-center border-t border-[#0066b3]/40">
          <p className="text-[10px] text-sky-300 font-semibold">
            WALERS POS System v2.0 • Punto de Venta e Inventario
          </p>
        </div>

      </div>

      {mostrarModalClave && (
        <div className="fixed inset-0 bg-[#051829]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border border-[#0066b3] p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            
            <div className="text-center space-y-1 border-b border-[#0066b3]/50 pb-3">
              <h3 className="text-base font-black text-white tracking-wide">
                🔑 Cambiar Contraseña / PIN
              </h3>
              <p className="text-xs text-sky-200">
                Ingresa tus datos para actualizar tu clave de acceso
              </p>
            </div>

            {mensajeModal.texto && (
              <p className={`text-xs p-2.5 rounded-xl text-center font-bold border ${mensajeModal.esError ? 'bg-rose-950/80 border-rose-500/60 text-rose-200' : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'}`}>
                {mensajeModal.texto}
              </p>
            )}

            <form onSubmit={handleCambiarClave} className="space-y-3">
              <div>
                <label className="text-[10px] font-extrabold text-sky-200 block mb-1 uppercase">
                  Selecciona tu Usuario:
                </label>
                <select
                  value={usuarioCambioId}
                  onChange={(e) => setUsuarioCambioId(Number(e.target.value))}
                  className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-2.5 text-xs text-white font-bold outline-none cursor-pointer focus:border-[#00a4ef]"
                >
                  <option value="">-- Elige tu nombre --</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {obtenerEmojiUsuario(u.nombre_completo)} {u.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-sky-200 block mb-1 uppercase">
                  Contraseña Actual:
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={claveActual}
                  onChange={(e) => setClaveActual(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-2.5 text-xs text-white font-bold outline-none text-center tracking-widest focus:border-[#00a4ef]"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-sky-200 block mb-1 uppercase">
                  Nueva Contraseña:
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={claveNueva}
                  onChange={(e) => setClaveNueva(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-2.5 text-xs text-white font-bold outline-none text-center tracking-widest focus:border-[#00a4ef]"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-sky-200 block mb-1 uppercase">
                  Confirmar Nueva Contraseña:
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={claveConfirmar}
                  onChange={(e) => setClaveConfirmar(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-2.5 text-xs text-white font-bold outline-none text-center tracking-widest focus:border-[#00a4ef]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalClave(false)}
                  className="w-1/2 bg-[#051829] hover:bg-[#0e385e] text-sky-200 font-bold py-2.5 rounded-xl text-xs border border-[#0066b3] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoModal}
                  className="w-1/2 bg-[#0078d4] hover:bg-[#0086e6] text-white font-black py-2.5 rounded-xl text-xs uppercase shadow-md cursor-pointer disabled:opacity-50"
                >
                  {cargandoModal ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </main>
  );
}