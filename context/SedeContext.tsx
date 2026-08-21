'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const SedeContext = createContext<any>(null);

export function SedeProvider({ children }: { children: React.ReactNode }) {
  const [sedeData, setSedeData] = useState({
    cargando: true,
    cajaAbierta: false,
    usuario: null,
  });

  async function verificarEstado() {
    const sesionLocal = localStorage.getItem('martineto_session');
    if (!sesionLocal) { 
      setSedeData(prev => ({...prev, cargando: false})); 
      return; 
    }
    
    const ses = JSON.parse(sesionLocal);
    
    const { data } = await supabase
      .from('caja')
      .select('id')
      .eq('sede_id', ses.sede_id)
      .eq('estado', 'abierta')
      .maybeSingle();

    setSedeData({
      cargando: false,
      cajaAbierta: !!data,
      usuario: ses,
    });
  }

  useEffect(() => { verificarEstado(); }, []);

  return (
    <SedeContext.Provider value={{ sedeData, verificarEstado }}>
      {children}
    </SedeContext.Provider>
  );
}

export const useSede = () => useContext(SedeContext);