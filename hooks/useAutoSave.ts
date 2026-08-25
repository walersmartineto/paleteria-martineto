'use client';
import { useState, useEffect } from 'react';

/**
 * Hook para guardar y restaurar datos automáticamente en la memoria del dispositivo (localStorage).
 * Funciona en Celulares, Tablets y Computadores.
 * 
 * @param key Clave única para identificar la pantalla/formulario (ej: 'borrador_caja')
 * @param initialValue Valor inicial del estado
 */
export function useAutoSave<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // 1. Carga inicial: Intenta rescatar lo que quedó guardado en el dispositivo
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error al recuperar datos guardados en "${key}":`, error);
      return initialValue;
    }
  });

  // 2. Guardado en tiempo real: Se ejecuta automáticamente con cada cambio en el formulario
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error(`Error al guardar automáticamente en "${key}":`, error);
      }
    }
  }, [key, state]);

  // 3. Limpieza: Elimina el borrador del dispositivo cuando se guarda con éxito en Supabase
  const clearSave = () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
        setState(initialValue);
      } catch (error) {
        console.error(`Error al limpiar el borrador de "${key}":`, error);
      }
    }
  };

  return [state, setState, clearSave];
}