'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [userInput, setUserInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!userInput.trim() || !passInput.trim()) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Consultar en Supabase
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('usuario', userInput.trim())
        .eq('clave', passInput.trim());

      let usuarioEncontrado = data && data.length > 0 ? data[0] : null;

      // 2. Fallback local si la consulta falló o no dio resultados
      if (!usuarioEncontrado) {
        const usrsLocal = JSON.parse(localStorage.getItem('martineto_usuarios_admin') || '[]');
        const lista = usrsLocal.length > 0 ? usrsLocal : [{ usuario: '1234', clave: '1234' }];
        
        usuarioEncontrado = lista.find(
          (u: any) =>
            u.usuario.trim().toLowerCase() === userInput.trim().toLowerCase() &&
            u.clave.trim() === passInput.trim()
        );
      }

      if (usuarioEncontrado) {
        // Guardar sesión activa en localStorage
        localStorage.setItem('martineto_session', JSON.stringify({
          usuario: usuarioEncontrado.usuario,
          loggedAt: new Date().toISOString()
        }));

        router.push('/');
      } else {
        setErrorMsg('Usuario o clave incorrectos.');
      }
    } catch (err) {
      setErrorMsg('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-[#0d111a] border border-gray-800 p-6 sm:p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl mx-auto shadow-lg shadow-purple-900/50">
            🍦
          </div>
          <h1 className="text-xl font-black text-white tracking-wider">MARTINETO POS</h1>
          <p className="text-xs text-gray-400">Ingresa tus credenciales para acceder</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs p-3 rounded-xl text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-400 block mb-1 uppercase">Usuario</label>
            <input
              type="text"
              placeholder="Ej: 1234"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500 font-bold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 block mb-1 uppercase">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500 font-bold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs active:scale-95 transition-all shadow-md shadow-purple-900/40"
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </main>
  );  
}