'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UsuarioSistema {
  id: string;
  usuario: string;
  clave: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [usuarioInput, setUsuarioInput] = useState('');
  const [claveInput, setClaveInput] = useState('');
  const [error, setError] = useState('');

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!usuarioInput.trim() || !claveInput.trim()) {
      setError('Por favor, ingresa usuario y contraseña.');
      return;
    }

    // Cargar lista de usuarios del admin desde localStorage
    const usuariosRegistrados: UsuarioSistema[] = JSON.parse(
      localStorage.getItem('martineto_usuarios_admin') || '[]'
    );

    // Usuario por defecto si la lista está vacía
    const usuariosValidos =
      usuariosRegistrados.length > 0
        ? usuariosRegistrados
        : [{ id: '1', usuario: '1234', clave: '1234' }];

    // Validar coincidencia
    const usuarioEncontrado = usuariosValidos.find(
      (u) =>
        u.usuario.trim().toLowerCase() === usuarioInput.trim().toLowerCase() &&
        u.clave.trim() === claveInput.trim()
    );

    if (usuarioEncontrado) {
      // Guardar sesión activa (opcional para persistencia)
      localStorage.setItem('martineto_sesion_activa', JSON.stringify(usuarioEncontrado));
      // Redirigir a la vista principal app/page.tsx
      router.push('/');
    } else {
      setError('Usuario o contraseña incorrectos.');
    }
  }

  return (
    <main className="min-h-screen bg-[#07090e] text-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-[#0d111a] border border-gray-800 p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6">
        {/* LOGO Y ENCABEZADO */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-purple-600 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-purple-900/50">
            🍦
          </div>
          <h1 className="text-xl font-black text-white tracking-wider">MARTINETO POS</h1>
          <p className="text-xs text-gray-400">Ingresa tus credenciales para acceder</p>
        </div>

        {/* MENSAJE DE ERROR */}
        {error && (
          <div className="bg-rose-950/70 text-rose-300 border border-rose-800/60 text-xs p-3 rounded-xl font-bold text-center">
            ⚠️ {error}
          </div>
        )}

        {/* FORMULARIO */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300 block">Usuario</label>
            <input
              type="text"
              placeholder="Ej: 1234"
              value={usuarioInput}
              onChange={(e) => setUsuarioInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500 font-bold placeholder-gray-600 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300 block">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={claveInput}
              onChange={(e) => setClaveInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500 font-bold placeholder-gray-600 transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-xl text-xs active:scale-95 transition-all shadow-lg shadow-purple-900/40 mt-2"
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    </main>
  );
}