'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  punto_id?: string;
}

interface ItemPedidoSuministro {
  id: string;
  producto: string;
  comprado: boolean;
  entregado: boolean;
  punto_id: string;
  origen_tabla?: string;
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
  punto_id: string;
  items?: any[];
}

const PUNTOS = [
  { id: 'todos', nombre: '🌐 TODAS LAS SEDES' },
  { id: 'martineto', nombre: '🍦 Martineto' },
  { id: 'osos', nombre: '🐻 Osos' },
  { id: 'centro', nombre: '🏢 Centro' },
];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'historial' | 'stock' | 'pedidos' | 'usuarios'>('historial');
  const [puntoFiltro, setPuntoFiltro] = useState<string>('todos');

  // Estado de acceso autorizado
  const [autorizado, setAutorizado] = useState(false);

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
    // Validar restricción de acceso solo para usuario 1234 y clave 1234
    const sesion = localStorage.getItem('martineto_session');
    
    let usuarioActual = '';
    let claveActual = '';

    if (sesion) {
      try {
        const parsed = JSON.parse(sesion);
        usuarioActual = parsed.usuario || parsed.user || sesion;
        claveActual = parsed.clave || parsed.pass || '';
      } catch {
        usuarioActual = sesion;
      }
    }

    // Verificar si el usuario ingresado en sesión es exactamente 1234
    if (usuarioActual.trim() !== '1234') {
      alert('no eres administrador');
      router.push('/puntos');
      return;
    }

    setAutorizado(true);
    cargarDatos();

    // REALTIME: Ventas
    const canalVentas = supabase
      .channel('realtime-ventas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historial_ventas' }, () => {
        cargarHistorialDB();
      })
      .subscribe();

    // REALTIME: Suministros por sede ('pedidos' para Martineto)
    const canalSuministrosPedidos = supabase
      .channel('realtime-suministros-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarPedidosSuministrosDB();
      })
      .subscribe();

    const canalSuministrosCentro = supabase
      .channel('realtime-suministros-centro')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_centro' }, () => {
        cargarPedidosSuministrosDB();
      })
      .subscribe();

    const canalSuministrosOsos = supabase
      .channel('realtime-suministros-osos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_osos' }, () => {
        cargarPedidosSuministrosDB();
      })
      .subscribe();

    // REALTIME: Stock por sede
    const canalStockMartineto = supabase
      .channel('realtime-stock-martineto')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => {
        cargarStockDB();
      })
      .subscribe();

    const canalStockCentro = supabase
      .channel('realtime-stock-centro')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos_centro' }, () => {
        cargarStockDB();
      })
      .subscribe();

    const canalStockOsos = supabase
      .channel('realtime-stock-osos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos_osos' }, () => {
        cargarStockDB();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalVentas);
      supabase.removeChannel(canalSuministrosPedidos);
      supabase.removeChannel(canalSuministrosCentro);
      supabase.removeChannel(canalSuministrosOsos);
      supabase.removeChannel(canalStockMartineto);
      supabase.removeChannel(canalStockCentro);
      supabase.removeChannel(canalStockOsos);
    };
  }, [router]);

  function cargarDatos() {
    cargarHistorialDB();
    cargarPedidosSuministrosDB();
    cargarStockDB();
    cargarUsuariosDB();
  }

  async function cargarHistorialDB() {
    try {
      const { data, error } = await supabase.from('historial_ventas').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const mapeadas: VentaHistorial[] = data.map((v: any, index: number) => ({
          id: v.id ? String(v.id) : `venta-db-${index}-${Date.now()}`,
          fechaHora: v.fecha_hora || v.fechaHora || '',
          fechaCorta: v.fecha_corta || v.fechaCorta || '',
          mesaNombre: v.mesa_nombre || v.mesaNombre || 'Mesa',
          total: Number(v.total || 0),
          metodoPago: v.metodo_pago || v.metodoPago || 'Efectivo',
          punto_id: v.punto_id || 'martineto',
        }));
        setHistorialVentas(mapeadas);
      } else {
        const hist = JSON.parse(localStorage.getItem('martineto_historial') || '[]');
        setHistorialVentas(hist);
      }
    } catch {
      const hist = JSON.parse(localStorage.getItem('martineto_historial') || '[]');
      setHistorialVentas(hist);
    }
  }

  async function cargarPedidosSuministrosDB() {
    try {
      const [resPedidos, resCentro, resOsos] = await Promise.all([
        supabase.from('pedidos').select('*').not('producto', 'is', null),
        supabase.from('pedidos_centro').select('*'),
        supabase.from('pedidos_osos').select('*'),
      ]);

      let listaConsolidada: ItemPedidoSuministro[] = [];

      if (resPedidos.data) {
        listaConsolidada.push(...resPedidos.data.map((p: any) => ({ 
          ...p, 
          punto_id: 'martineto',
          origen_tabla: 'pedidos' 
        })));
      }
      if (resCentro.data) {
        listaConsolidada.push(...resCentro.data.map((p: any) => ({ 
          ...p, 
          punto_id: 'centro',
          origen_tabla: 'pedidos_centro' 
        })));
      }
      if (resOsos.data) {
        listaConsolidada.push(...resOsos.data.map((p: any) => ({ 
          ...p, 
          punto_id: 'osos',
          origen_tabla: 'pedidos_osos' 
        })));
      }

      setPedidosSuministros(listaConsolidada);
    } catch (e) {
      console.warn('Error cargando suministros consolidados:', e);
    }
  }

  async function cargarStockDB() {
    try {
      const [resMartineto, resCentro, resOsos] = await Promise.all([
        supabase.from('productos').select('*'),
        supabase.from('productos_centro').select('*'),
        supabase.from('productos_osos').select('*'),
      ]);

      let listaConsolidada: Producto[] = [];

      if (resMartineto.data) {
        listaConsolidada.push(...resMartineto.data.map((p: any) => ({ ...p, punto_id: 'martineto' })));
      }
      if (resCentro.data) {
        listaConsolidada.push(...resCentro.data.map((p: any) => ({ ...p, punto_id: 'centro' })));
      }
      if (resOsos.data) {
        listaConsolidada.push(...resOsos.data.map((p: any) => ({ ...p, punto_id: 'osos' })));
      }

      setStockProductos(listaConsolidada);
    } catch (e) {
      console.warn('Error cargando stock consolidado:', e);
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

  async function toggleSuministro(id: string, campo: 'comprado' | 'entregado') {
    const itemTarget = pedidosSuministros.find((i) => i.id === id);
    if (!itemTarget) return;

    const nuevoValor = !itemTarget[campo];

    const actualizados = pedidosSuministros.map((item) =>
      item.id === id ? { ...item, [campo]: nuevoValor } : item
    );
    setPedidosSuministros(actualizados);

    const tablaTarget = itemTarget.origen_tabla || 'pedidos';

    try {
      await supabase
        .from(tablaTarget)
        .update({ [campo]: nuevoValor })
        .eq('id', id);
    } catch (e) {
      console.error('Error actualizando estado del suministro:', e);
    }
  }

  async function crearUsuario() {
    if (!nuevoUsuario.trim() || !nuevaClave.trim()) return;
    setCargandoUsuarios(true);

    const datosNuevos = { usuario: nuevoUsuario.trim(), clave: nuevaClave.trim() };

    try {
      const { data, error } = await supabase.from('usuarios').insert([datosNuevos]).select();
      if (error) {
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

  async function eliminarVenta(id: string) {
    try {
      await supabase.from('historial_ventas').delete().eq('id', id);
    } catch (err) {
      console.error(err);
    }
    const actualizados = historialVentas.filter((v) => v.id !== id);
    setHistorialVentas(actualizados);
  }

  function getStockBadge(stock: number) {
    if (stock <= 5) {
      return 'bg-rose-950/80 text-rose-400 border-rose-800/60';
    }
    if (stock <= 12) {
      return 'bg-amber-950/80 text-amber-400 border-amber-800/60';
    }
    return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60';
  }

  const calcularTotalVentas = (pId?: string) => {
    return historialVentas
      .filter((v) => !pId || pId === 'todos' || (v.punto_id || 'martineto') === pId)
      .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  };

  const historialFiltrado = historialVentas.filter(
    (v) => puntoFiltro === 'todos' || (v.punto_id || 'martineto') === puntoFiltro
  );

  const stockFiltrado = stockProductos.filter(
    (p) => puntoFiltro === 'todos' || (p.punto_id || 'martineto') === puntoFiltro
  );

  const pedidosFiltrados = pedidosSuministros.filter(
    (item) => puntoFiltro === 'todos' || (item.punto_id || 'martineto') === puntoFiltro
  );

  if (!autorizado) {
    return (
      <main className="min-h-screen bg-[#090d14] flex items-center justify-center">
        <p className="text-slate-400 text-sm font-bold">Verificando permisos de administrador...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090d14] text-slate-100 p-4 sm:p-6 font-sans space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Admin */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-xl font-bold shadow-[0_0_15px_rgba(225,29,72,0.5)]">
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">PANEL ADMINISTRADOR GLOBAL</h1>
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                  ● REALTIME EN VIVO
                </span>
              </div>
              <p className="text-xs text-slate-400">Control unificado de Martineto, Osos y Centro</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/puntos')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-2xl text-xs font-black border border-slate-700 transition-all active:scale-95"
          >
            ⬅️ Volver a Puntos
          </button>
        </div>

        {/* METRICAS Y RECAUDO TOTAL */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase">Ventas Totales</p>
            <p className="text-lg font-black text-emerald-400 mt-1">
              ${calcularTotalVentas('todos').toLocaleString('es-CO')}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <p className="text-[10px] font-black text-purple-400 uppercase">🍦 Martineto</p>
            <p className="text-lg font-black text-white mt-1">
              ${calcularTotalVentas('martineto').toLocaleString('es-CO')}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <p className="text-[10px] font-black text-amber-400 uppercase">🐻 Osos</p>
            <p className="text-lg font-black text-white mt-1">
              ${calcularTotalVentas('osos').toLocaleString('es-CO')}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <p className="text-[10px] font-black text-cyan-400 uppercase">🏢 Centro</p>
            <p className="text-lg font-black text-white mt-1">
              ${calcularTotalVentas('centro').toLocaleString('es-CO')}
            </p>
          </div>
        </div>

        {/* FILTRO POR SEDE Y BOTONES NAVEGACIÓN */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-400">Filtrar Sede:</span>
            <select
              value={puntoFiltro}
              onChange={(e) => setPuntoFiltro(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-black text-white outline-none"
            >
              {PUNTOS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
            <button
              onClick={() => setTab('historial')}
              className={`p-2.5 rounded-xl text-xs font-black border transition-all ${
                tab === 'historial'
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              📜 Historial
            </button>
            <button
              onClick={() => setTab('stock')}
              className={`p-2.5 rounded-xl text-xs font-black border transition-all ${
                tab === 'stock'
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              📦 Stock
            </button>
            <button
              onClick={() => setTab('pedidos')}
              className={`p-2.5 rounded-xl text-xs font-black border transition-all ${
                tab === 'pedidos'
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              🧹 Suministros
            </button>
            <button
              onClick={() => setTab('usuarios')}
              className={`p-2.5 rounded-xl text-xs font-black border transition-all ${
                tab === 'usuarios'
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              👥 Usuarios
            </button>
          </div>
        </div>

        {/* VISTA 1: HISTORIAL DE VENTAS */}
        {tab === 'historial' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
            <h2 className="text-base font-black text-white">
              Historial de Ventas ({historialFiltrado.length})
            </h2>
            {historialFiltrado.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center font-bold">
                No hay ventas registradas para este punto.
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {historialFiltrado.map((venta, idx) => (
                  <div
                    key={`${venta.id || 'venta'}-${venta.punto_id || 'p'}-${idx}`}
                    className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex justify-between items-start"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white">{venta.mesaNombre}</span>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase">
                          {venta.punto_id || 'martineto'}
                        </span>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold">
                          {venta.metodoPago}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">🕒 {venta.fechaHora}</p>
                      <p className="text-sm font-black text-emerald-400 mt-2">
                        Total: ${Number(venta.total).toLocaleString('es-CO')}
                      </p>
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
            <h2 className="text-base font-black text-white">
              Inventario / Stock de Productos ({stockFiltrado.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {stockFiltrado.map((p, idx) => (
                <div
                  key={`${p.id}-${p.punto_id}-${idx}`}
                  className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold text-xs text-white">{p.nombre}</p>
                    <p className="text-[10px] text-emerald-400 font-black">
                      ${p.precio.toLocaleString('es-CO')}
                    </p>
                    <span className="text-[8px] font-black uppercase text-purple-400">
                      Sede: {p.punto_id || 'martineto'}
                    </span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${getStockBadge(p.stock)}`}>
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
                    <th className="pb-3 font-black">SEDE</th>
                    <th className="pb-3 font-black">PRODUCTO</th>
                    <th className="pb-3 font-black text-center">COMPRADO</th>
                    <th className="pb-3 font-black text-center">ENTREGADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pedidosFiltrados.map((item, idx) => (
                    <tr key={`${item.punto_id}-${item.id}-${idx}`} className="hover:bg-slate-800/40">
                      <td className="py-3 font-bold text-purple-400 uppercase text-xs">
                        {item.punto_id || 'martineto'}
                      </td>
                      <td className="py-3 font-bold text-white text-sm">{item.producto}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => toggleSuministro(item.id, 'comprado')}
                          className={`w-9 h-9 rounded-xl font-black text-sm border transition-all ${
                            item.comprado
                              ? 'bg-emerald-600 border-emerald-400 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-600'
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
                              ? 'bg-sky-600 border-sky-400 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-600'
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

        {/* VISTA 4: USUARIOS */}
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
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none font-bold"
                />
                <input
                  type="password"
                  placeholder="Clave"
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none font-bold"
                />
              </div>
              <button
                onClick={crearUsuario}
                disabled={cargandoUsuarios}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs transition-all"
              >
                {cargandoUsuarios ? 'Guardando...' : '+ Registrar Usuario'}
              </button>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Usuarios Registrados
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {usuarios.map((u, idx) => (
                  <div
                    key={`${u.id || 'usr'}-${idx}`}
                    className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex justify-between items-center"
                  >
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