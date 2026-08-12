'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PuntoVenta {
  id: string;
  nombre: string;
  badge: string;
  ruta: string;
  activo: boolean;
  descripcion: string;
  emoji: string;
}

const SEDES: PuntoVenta[] = [
  {
    id: 'martineto',
    nombre: 'Martineto',
    badge: 'ACTIVO',
    ruta: '/',
    activo: true,
    descripcion: 'Punto principal de atención y ventas',
    emoji: '🍦',
  },
  {
    id: 'osos',
    nombre: 'Osos',
    badge: 'ACTIVO',
    ruta: '/punto2',
    activo: true,
    descripcion: 'Sede en etapa de configuración',
    emoji: '🐻',
  },
  {
    id: 'centro',
    nombre: 'Centro',
    badge: 'ACTIVO',
    ruta: '/punto3',
    activo: true,
    descripcion: 'Sede punto centro',
    emoji: '🏢',
  },
];

export default function SeleccionPuntoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');

  // Estados para Modal Admin
  const [mostrarLoginAdmin, setMostrarLoginAdmin] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  useEffect(() => {
    const sesion = localStorage.getItem('martineto_session');
    if (!sesion) {
      router.push('/login');
      return;
    }
    try {
      const data = JSON.parse(sesion);
      setUsuario(data.usuario || 'Operador');
    } catch {
      setUsuario('Operador');
    }
  }, [router]);

  function validarLoginAdmin() {
    const usrs = JSON.parse(localStorage.getItem('martineto_usuarios_admin') || '[]');
    const listaUsuarios = usrs.length > 0 ? usrs : [{ id: '1', usuario: '1234', clave: '1234' }];

    const esValido = listaUsuarios.some(
      (u: any) =>
        u.usuario.trim().toLowerCase() === userInput.trim().toLowerCase() &&
        u.clave.trim() === passInput.trim()
    );

    if (esValido) {
      setUserInput('');
      setPassInput('');
      setErrorLogin('');
      setMostrarLoginAdmin(false);
      router.push('/admin');
    } else {
      setErrorLogin('Usuario o clave incorrectos.');
    }
  }

  function cerrarSesion() {
    localStorage.removeItem('martineto_session');
    router.push('/login');
  }

  return (
    <main className="min-h-screen w-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="bg-[#0d111a] border border-gray-800 p-6 rounded-3xl text-center space-y-3 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl mx-auto shadow-lg shadow-purple-900/50">
            🏬
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-wider">SELECCIONAR SEDE</h1>
            <p className="text-xs text-gray-400">
              Bienvenido/a, <b className="text-purple-400">{usuario}</b>
            </p>
          </div>
        </div>

        {/* Lista de Puntos */}
        <div className="space-y-3">
          {SEDES.map((sed) => (
            <div
              key={sed.id}
              onClick={() => sed.activo && router.push(sed.ruta)}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                sed.activo
                  ? 'bg-[#0d111a] border-purple-800/60 hover:border-purple-500 cursor-pointer hover:scale-[1.02] shadow-lg'
                  : 'bg-[#0a0d14] border-gray-800/40 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-xl shrink-0">
                  {sed.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-white">{sed.nombre}</h2>
                    <span
                      className={`text-[8px] font-black px-2 py-0.5 rounded-md border ${
                        sed.activo
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                          : 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {sed.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">{sed.descripcion}</p>
                </div>
              </div>

              <div className="text-gray-500 text-sm font-bold">
                {sed.activo ? '➔' : '🔒'}
              </div>
            </div>
          ))}

          {/* Opción Directa a Administrador */}
          <div
            onClick={() => setMostrarLoginAdmin(true)}
            className="p-4 rounded-2xl border border-rose-900/50 bg-[#160d13] hover:border-rose-600 cursor-pointer hover:scale-[1.02] shadow-lg transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-xl shrink-0">
                🛡️
              </div>
              <div>
                <h2 className="text-sm font-black text-white">Panel Administrador</h2>
                <p className="text-[11px] text-gray-400">Gestión global y reportes</p>
              </div>
            </div>
            <div className="text-rose-400 text-sm font-bold">🔐</div>
          </div>
        </div>

        {/* Botón Salir */}
        <button
          onClick={cerrarSesion}
          className="w-full bg-gray-900 hover:bg-rose-950/50 text-gray-400 hover:text-rose-300 border border-gray-800 hover:border-rose-800/50 font-bold py-3 rounded-2xl text-xs transition-all"
        >
          🚪 Cerrar Sesión
        </button>
      </div>

      {/* Modal Admin */}
      {mostrarLoginAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-3">
            <div className="text-center space-y-1">
              <p className="text-2xl">🔐</p>
              <h3 className="text-sm font-black text-white">Panel Administrador</h3>
            </div>

            {errorLogin && (
              <p className="text-[10px] text-rose-400 bg-rose-950/60 p-2 rounded-xl border border-rose-800/40 text-center font-bold">
                {errorLogin}
              </p>
            )}

            <input
              type="text"
              placeholder="Usuario"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none font-bold"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none font-bold"
            />

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  setErrorLogin('');
                  setUserInput('');
                  setPassInput('');
                  setMostrarLoginAdmin(false);
                }}
                className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={validarLoginAdmin}
                className="bg-rose-600 hover:bg-rose-500 text-white font-black py-2 rounded-xl text-xs transition-all"
              >
                Ingresar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}