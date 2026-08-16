'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PuntosPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sesionLocal = localStorage.getItem('martineto_session');
      if (!sesionLocal) {
        router.replace('/login');
        return;
      }
      try {
        setSesion(JSON.parse(sesionLocal));
      } catch {
        router.replace('/login');
      }
    }
  }, [router]);

  function cerrarSesion() {
    localStorage.removeItem('martineto_session');
    router.push('/login');
  }

  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#0d111a] border border-gray-800 p-6 rounded-3xl space-y-4 shadow-2xl">
        {/* Header Logo */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl mx-auto shadow-lg shadow-purple-900/50">
            🏢
          </div>
          <h1 className="text-lg font-black text-white tracking-wider">SELECCIONAR SEDE</h1>
          <p className="text-xs text-purple-400">
            Bienvenido/a, <b>{sesion?.nombre || 'Operador'}</b>
          </p>
        </div>

        {/* Tarjetas de Sedes y Módulos */}
        <div className="space-y-2.5 pt-2">
          {/* Martineto POS */}
          <button
            onClick={() => router.push('/pos')}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 p-3.5 rounded-2xl flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-xl bg-purple-950/60 border border-purple-800/60">🍦</span>
              <div>
                <p className="font-black text-xs text-white group-hover:text-purple-400 transition-colors">
                  Martineto POS
                </p>
                <p className="text-[10px] text-gray-400">Punto principal de atención y ventas</p>
              </div>
            </div>
            <span className="text-xs text-purple-400 font-bold">➔</span>
          </button>

          {/* Walers Viva */}
          <button
            onClick={() => alert('Módulo de Inventario Viva en desarrollo')}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 p-3.5 rounded-2xl flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-xl bg-amber-950/60 border border-amber-800/60">🛍️</span>
              <div>
                <p className="font-black text-xs text-white group-hover:text-amber-400 transition-colors">
                  Walers Viva
                </p>
                <p className="text-[10px] text-gray-400">Sede Centro Comercial Viva</p>
              </div>
            </div>
            <span className="text-xs text-amber-400 font-bold">➔</span>
          </button>

          {/* Walers Centro */}
          <button
            onClick={() => alert('Módulo de Inventario Centro en desarrollo')}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 p-3.5 rounded-2xl flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-xl bg-sky-950/60 border border-sky-800/60">🏬</span>
              <div>
                <p className="font-black text-xs text-white group-hover:text-sky-400 transition-colors">
                  Walers Centro
                </p>
                <p className="text-[10px] text-gray-400">Sede Sector Centro</p>
              </div>
            </div>
            <span className="text-xs text-sky-400 font-bold">➔</span>
          </button>

          {/* Ositos */}
          <button
            onClick={() => alert('Módulo de Inventario Ositos en desarrollo')}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 p-3.5 rounded-2xl flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60">🐻</span>
              <div>
                <p className="font-black text-xs text-white group-hover:text-emerald-400 transition-colors">
                  Ositos
                </p>
                <p className="text-[10px] text-gray-400">Sede Ositos</p>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-bold">➔</span>
          </button>

          {/* Panel Administrador */}
          <button
            onClick={() => router.push('/admin')}
            className="w-full bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/60 p-3.5 rounded-2xl flex items-center justify-between text-left transition-all group mt-2"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-xl bg-rose-900/40 border border-rose-700/60">⚙️</span>
              <div>
                <p className="font-black text-xs text-rose-300">
                  Panel Administrador
                </p>
                <p className="text-[10px] text-rose-400/80">Gestión global y reportes</p>
              </div>
            </div>
            <span className="text-xs text-rose-400 font-bold">🔒</span>
          </button>
        </div>

        {/* Botón Cerrar Sesión */}
        <button
          onClick={cerrarSesion}
          className="w-full bg-gray-900 hover:bg-rose-950 text-gray-300 hover:text-rose-300 border border-gray-800 font-bold py-2.5 rounded-xl text-xs transition-all mt-3"
        >
          🚪 Cerrar Sesión
        </button>
      </div>
    </main>
  );
}