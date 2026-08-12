'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

interface ItemPedidoSuministro {
  id: string;
  producto: string;
  comprado: boolean;
  entregado: boolean;
}

interface UsuarioSistema {
  id: string;
  usuario: string;
  clave: string;
}

interface VentaHistorial {
  id: string;
  fechaHora: string;
  fechaCorta: string;
  mesaNombre: string;
  total: number;
  metodoPago: string;
  items: any[];
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'historial' | 'stock' | 'pedidos' | 'usuarios'>('historial');

  // Datos
  const [historialVentas, setHistorialVentas] = useState<VentaHistorial[]>([]);
  const [stockProductos, setStockProductos] = useState<Producto[]>([]);
  const [pedidosSuministros, setPedidosSuministros] = useState<ItemPedidoSuministro[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);

  // Campos para crear usuario
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [nuevaClave, setNuevaClave] = useState('');
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  function cargarDatos() {
    // 1. Historial
    const hist = JSON.parse(localStorage.getItem('martineto_historial') || '[]');
    setHistorialVentas(hist);

    // 2. Pedidos Suministros
    const pedPrevios = JSON.parse(localStorage.getItem('martineto_pedidos_admin') || '[]');
    if (pedPrevios.length === 0) {
      const iniciales: ItemPedidoSuministro[] = [
        { id: '1', producto: 'Escoba', comprado: false, entregado: false },
        { id: '2', producto: 'Balde', comprado: false, entregado: false },
        { id: '3', producto: 'Jabón', comprado: false, entregado: false },
      ];
      localStorage.setItem('martineto_pedidos_admin', JSON.stringify(iniciales));
      setPedidosSuministros(iniciales);
    } else {
      setPedidosSuministros(pedPrevios);
    }

    // 3. Stock Supabase
    cargarStockDB();

    // 4. Usuarios
    cargarUsuariosDB();
  }

  async function cargarStockDB() {
    try {
      const { data, error } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
      if (!error && data) {
        setStockProductos(data);
      }
    } catch (e) {
      console.warn('Error cargando stock:', e);
    }
  }

  async function cargarUsuariosDB() {
    setCargandoUsuarios(true);
    try {
      const { data, error } = await supabase.from('usuarios').select('*');
      if (!error && data && data.length > 0) {
        setUsuarios(data);
        localStorage.setItem('martineto_usuarios_admin', JSON.stringify(data));
      } else {
        cargarUsuariosLocal();
      }
    } catch {
      cargarUsuariosLocal();
    } finally {
      setCargandoUsuarios(false);
    }
  }

  function cargarUsuariosLocal() {
    const usrsLocal = JSON.parse(localStorage.getItem('martineto_usuarios_admin') || '[]');
    setUsuarios(usrsLocal.length > 0 ? usrsLocal : [{ id: '1', usuario: '1234', clave: '1234' }]);
  }

  // Toggle Comprado/Entregado
  function toggleSuministro(id: string, campo: 'comprado' | 'entregado') {
    const actualizados = pedidosSuministros.map((item) =>
      item.id === id ? { ...item, [campo]: !item[campo] } : item
    );
    setPedidosSuministros(actualizados);
    localStorage.setItem('martineto_pedidos_admin', JSON.stringify(actualizados));
  }

  // Crear Usuario en Supabase
  async function crearUsuario() {
    if (!nuevoUsuario.trim() || !nuevaClave.trim()) return;

    setCargandoUsuarios(true);

    const datosNuevos = {
      usuario: nuevoUsuario.trim(),
      clave: nuevaClave.trim(),
    };

    try {
      const { data, error } = await supabase.from('usuarios').insert([datosNuevos]).select();
      
      if (error) {
        console.error('Error detallado de Supabase:', error.message);
        alert('Error al guardar en la base de datos: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        const actualizados = [...usuarios, data[0]];
        setUsuarios(actualizados);
        localStorage.setItem('martineto_usuarios_admin', JSON.stringify(actualizados));
        setNuevoUsuario('');
        setNuevaClave('');
      }
    } catch (e) {
      console.error('Excepción al conectar con Supabase:', e);
    } finally {
      setCargandoUsuarios(false);
    }
  }

  // Eliminar Usuario
  async function eliminarUsuario(id: string) {
    try {
      await supabase.from('usuarios').delete().eq('id', id);
    } catch (err) {
      console.error(err);
    }

    const actualizados = usuarios.filter((u) => u.id !== id);
    setUsuarios(actualizados);
    localStorage.setItem('martineto_usuarios_admin', JSON.stringify(actualizados));
  }

  // Eliminar Historial
  function eliminarVenta(id: string) {
    const actualizados = historialVentas.filter((v) => v.id !== id);
    setHistorialVentas(actualizados);
    localStorage.setItem('martineto_historial', JSON.stringify(actualizados));
  }

  return (
    <main className="min-h-screen bg-[#090d14] text-slate-100 p-4 sm:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Admin */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-xl font-bold shadow-[0_0_15px_rgba(225,29,72,0.5)]">
              ⚙️
            </div>
            <div>
              <h1 className="text-xl font-black text-white">PANEL ADMINISTRADOR</h1>
              <p className="text-xs text-slate-400">Control de inventario, ventas y usuarios</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/puntos')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-2xl text-xs font-black border border-slate-700 transition-all active:scale-95"
          >
            ⬅️ Volver al POS
          </button>
        </div>

        {/* Menú de Navegación Admin */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setTab('historial')}
            className={`p-3.5 rounded-2xl text-xs font-black border transition-all ${
              tab === 'historial'
                ? 'bg-rose-600 border-rose-400 text-white shadow-[0_4px_0_0_#9f1239]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            📜 1. Historial Ventas
          </button>
          <button
            onClick={() => setTab('stock')}
            className={`p-3.5 rounded-2xl text-xs font-black border transition-all ${
              tab === 'stock'
                ? 'bg-rose-600 border-rose-400 text-white shadow-[0_4px_0_0_#9f1239]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            📦 2. Stock General
          </button>
          <button
            onClick={() => setTab('pedidos')}
            className={`p-3.5 rounded-2xl text-xs font-black border transition-all ${
              tab === 'pedidos'
                ? 'bg-rose-600 border-rose-400 text-white shadow-[0_4px_0_0_#9f1239]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            🧹 3. Pedidos Suministros
          </button>
          <button
            onClick={() => setTab('usuarios')}
            className={`p-3.5 rounded-2xl text-xs font-black border transition-all ${
              tab === 'usuarios'
                ? 'bg-rose-600 border-rose-400 text-white shadow-[0_4px_0_0_#9f1239]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            👥 4. Crear Usuarios
          </button>
        </div>

        {/* VISTA 1: HISTORIAL DE VENTAS */}
        {tab === 'historial' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
            <h2 className="text-base font-black text-white">Historial General de Ventas</h2>
            {historialVentas.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center font-bold">No hay ventas registradas.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {historialVentas.map((venta) => (
                  <div key={venta.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex justify-between items-start">
                    <div>
                      <span className="font-black text-sm text-white">{venta.mesaNombre}</span>
                      <span className="text-[10px] ml-2 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold">
                        {venta.metodoPago}
                      </span>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">🕒 {venta.fechaHora}</p>
                      <p className="text-sm font-black text-emerald-400 mt-2">Total: ${venta.total.toLocaleString('es-CO')}</p>
                    </div>
                    <button
                      onClick={() => eliminarVenta(venta.id)}
                      className="text-slate-500 hover:text-rose-400 text-xs font-bold"
                    >
                      ✕ Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA 2: STOCK GENERAL */}
        {tab === 'stock' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
            <h2 className="text-base font-black text-white">Inventario / Stock de Productos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {stockProductos.map((p) => (
                <div key={p.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-xs text-white">{p.nombre}</p>
                    <p className="text-[10px] text-emerald-400 font-black">${p.precio.toLocaleString('es-CO')}</p>
                  </div>
                  <span className="bg-indigo-500/10 text-indigo-400 text-xs font-black px-2.5 py-1 rounded-xl border border-indigo-500/20">
                    Stock: {p.stock}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 3: PEDIDOS SUMINISTROS */}
        {tab === 'pedidos' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
            <h2 className="text-base font-black text-white">Solicitudes de Insumos / Aseo</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-black">PRODUCTO</th>
                    <th className="pb-3 font-black text-center">COMPRADO</th>
                    <th className="pb-3 font-black text-center">ENTREGADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pedidosSuministros.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="py-3 font-bold text-white text-sm">{item.producto}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => toggleSuministro(item.id, 'comprado')}
                          className={`w-9 h-9 rounded-xl font-black text-sm border transition-all ${
                            item.comprado
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_2px_0_0_#065f46]'
                              : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-white'
                          }`}
                        >
                          {item.comprado ? '✓' : 'X'}
                        </button>
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => toggleSuministro(item.id, 'entregado')}
                          className={`w-9 h-9 rounded-xl font-black text-sm border transition-all ${
                            item.entregado
                              ? 'bg-sky-600 border-sky-400 text-white shadow-[0_2px_0_0_#0369a1]'
                              : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-white'
                          }`}
                        >
                          {item.entregado ? '✓' : 'X'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 4: CREAR Y VER USUARIOS */}
        {tab === 'usuarios' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-6">
            <div className="space-y-3 max-w-md">
              <h2 className="text-base font-black text-white">Crear Nuevo Usuario</h2>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Usuario"
                  value={nuevoUsuario}
                  onChange={(e) => setNuevoUsuario(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-rose-500 font-bold"
                />
                <input
                  type="password"
                  placeholder="Clave"
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-rose-500 font-bold"
                />
              </div>
              <button
                onClick={crearUsuario}
                disabled={cargandoUsuarios}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs active:scale-95 transition-all shadow-[0_3px_0_0_#9f1239]"
              >
                {cargandoUsuarios ? 'Guardando...' : '+ Registrar Usuario'}
              </button>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Usuarios Registrados</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {usuarios.map((u) => (
                  <div key={u.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-xs text-white">👤 {u.usuario}</p>
                      <p className="text-[10px] text-slate-500 font-bold">Clave: {u.clave}</p>
                    </div>
                    {u.usuario !== '1234' && (
                      <button
                        onClick={() => eliminarUsuario(u.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2 py-1 bg-rose-950/40 rounded-lg border border-rose-800/40"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}