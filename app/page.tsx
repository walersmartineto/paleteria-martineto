'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirecciona directamente a la pantalla de login y selección de sede
    router.replace('/login');
  }, [router]);

  return (
    <main className="min-h-screen bg-[#07090e] flex items-center justify-center text-gray-400 text-xs font-bold font-sans">
      Redireccionando a Selección de Sede...
    </main>
  );
}