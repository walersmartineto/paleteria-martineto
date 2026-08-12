'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Punto2Page() {
  const router = useRouter();

  useEffect(() => {
    const sesion = localStorage.getItem('martineto_session');
    if (!sesion) router.push('/login');
  }, [router]);

  return (
    <main className="min-h-screen w-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4">
      <div className="bg-[#0d111a] border border-gray-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-4">
        <div className="text-4xl">🏬</div>
        <h1 className="text-lg font-black text-white">MARTINETO VIVA</h1>
        <p className="text-xs text-gray-400">Esta sede se encuentra actualmente en mantenimiento o desarrollo.</p>
        <button
          onClick={() => router.push('/puntos')}
          className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all"
        >
          ← Volver a Puntos
        </button>
      </div>
    </main>
  );
}