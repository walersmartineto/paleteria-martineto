'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PUNTO_ID = 'osos'; 
const TABLA_PRODUCTOS = 'productos_osos';
const TABLA_SUMINISTROS = 'pedidos_osos';

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

interface ItemPedido {
  producto: Producto;
  cantidad: number;
  pagado?: boolean;
}

interface Mesa {
  id: number;
  nombre: string;
  tipo: 'mesa' | 'domicilio';
  estado: 'libre' | 'ocupada_debe' | 'ocupada_pagado';
  pedidos: ItemPedido[];
  totalPagado: number;
}

interface VentaHistorial {
  id: string;
  fechaHora: string;
  fechaCorta: string;
  mesaNombre: string;
  total: number;
  metodoPago: string;
  punto_id: string;
  items: ItemPedido[];
}

interface AlertaMensaje {
  titulo: string;
  mensaje: string;
  tipo: 'error' | 'exito' | 'advertencia';
  irAlLobbyAlCerrar?: boolean;
}

const MESAS_INICIALES: Mesa[] = [
  { id: 1, nombre: 'MESA 01', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 2, nombre: 'MESA 02', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 3, nombre: 'MESA 03', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 4, nombre: 'MESA 04', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 5, nombre: 'MESA 05', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 6, nombre: 'MESA 06', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 7, nombre: 'Rappi 🛵', tipo: 'domicilio', estado: 'libre', pedidos: [], totalPagado: 0 },
];

export default function POSOsosPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [mesas, setMesas] = useState<Mesa[]>(MESAS_INICIALES);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [, setHistorialVentas] = useState<VentaHistorial[]>([]);

  const [mostrarPago, setMostrarPago] = useState(false);
  const [metodosPago, setMetodosPago] = useState({ efectivo: 0, nequi: 0, daviplata: 0 });

  const [mostrarSolicitarSuministro, setMostrarSolicitarSuministro] = useState(false);
  const [itemSolicitado, setItemSolicitado] = useState('');

  const [alerta, setAlerta] = useState<AlertaMensaje | null>(null);

  useEffect(() => {
    const sesion = localStorage.getItem('martineto_session');
    if (!sesion) {
      router.push('/login');
      return;
    }

    setMounted(true);
    cargarStockEspecifico();

    const canalProductos = supabase
      .channel(`canal-${TABLA_PRODUCTOS}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLA_PRODUCTOS }, () => {
        cargarStockEspecifico();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalProductos);
    };
  }, [router]);

  async function cargarStockEspecifico() {
    setCargandoProductos(true);
    try {
      const { data, error } = await supabase
        .from(TABLA_PRODUCTOS)
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error cargando productos de Osos:', error.message);
        setProductos([]);
      } else {
        setProductos(data || []);
      }
    } catch (e) {
      console.warn('Excepción cargando stock Osos:', e);
      setProductos([]);
    } finally {
      setCargandoProductos(false);
    }
  }

  async function descontarStock(itemsVendidos: ItemPedido[]) {
    for (const item of itemsVendidos) {
      const pActual = productos.find((p) => p.id === item.producto.id);
      if (pActual) {
        const nuevoStock = Math.max(0, pActual.stock - item.cantidad);
        await supabase.from(TABLA_PRODUCTOS).update({ stock: nuevoStock }).eq('id', pActual.id);
      }
    }
    cargarStockEspecifico();
  }

  const formatPrecio = (valor: number) => {
    if (!mounted) return valor.toString();
    return Math.abs(valor).toLocaleString('es-CO');
  };

  function getStockBadge(stock: number) {
    if (stock <= 5) {
      return { color: 'bg-rose-950/80 text-rose-400 border-rose-800/60', texto: `🔴 Stock: ${stock}` };
    }
    if (stock <= 12) {
      return { color: 'bg-amber-950/80 text-amber-400 border-amber-800/60', texto: `🟡 Stock: ${stock}` };
    }
    return { color: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60', texto: `🟢 Stock: ${stock}` };
  }

  function modificarCantidad(producto: Producto, delta: number) {
    if (!mesaSeleccionada) return;

    const nuevosPedidos = mesaSeleccionada.pedidos.map((item) => ({ ...item }));
    const index = nuevosPedidos.findIndex((p) => p.producto.id === producto.id && !p.pagado);

    if (index > -1) {
      const nuevaCant = nuevosPedidos[index].cantidad + delta;
      if (nuevaCant <= 0) {
        nuevosPedidos.splice(index, 1);
      } else {
        if (delta > 0 && nuevaCant > producto.stock) {
          setAlerta({
            titulo: 'Stock Insuficiente',
            mensaje: `Solo hay ${producto.stock} unidades de ${producto.nombre} disponibles.`,
            tipo: 'advertencia',
          });
          return;
        }
        nuevosPedidos[index].cantidad = nuevaCant;
      }
    } else if (delta > 0) {
      if (producto.stock < 1) {
        setAlerta({
          titulo: 'Producto Agotado',
          mensaje: `No hay stock disponible de ${producto.nombre}.`,
          tipo: 'advertencia',
        });
        return;
      }
      nuevosPedidos.push({ producto, cantidad: 1, pagado: false });
    }

    const hayPendientes = nuevosPedidos.some((p) => !p.pagado);
    const nuevoEstado = hayPendientes ? 'ocupada_debe' : nuevosPedidos.length === 0 ? 'libre' : mesaSeleccionada.estado;

    const mesaActualizada: Mesa = {
      ...mesaSeleccionada,
      pedidos: nuevosPedidos,
      estado: nuevoEstado,
    };

    setMesas((prev) => prev.map((m) => (m.id === mesaActualizada.id ? mesaActualizada : m)));
    setMesaSeleccionada(mesaActualizada);
  }

  const pedidosMesa = mesaSeleccionada?.pedidos || [];
  const subtotalTotalMesa = Math.max(0, pedidosMesa.reduce((acc, item) => acc + item.producto.precio * item.cantidad, 0));
  const totalPagadoPrevio = mesaSeleccionada?.totalPagado || 0;
  const saldoPendienteMesa = Math.max(0, subtotalTotalMesa - totalPagadoPrevio);
  const totalPagosIngresados = metodosPago.efectivo + metodosPago.nequi + metodosPago.daviplata;
  const pendienteEnModal = Math.max(0, saldoPendienteMesa - totalPagosIngresados);

  function guardarEnHistorial(mesaNombre: string, total: number, metodo: string, items: ItemPedido[]) {
    const ahora = new Date();
    const nuevaVenta: VentaHistorial = {
      id: Date.now().toString(),
      fechaHora: ahora.toLocaleString('es-CO'),
      fechaCorta: ahora.toISOString().split('T')[0],
      mesaNombre,
      total,
      metodoPago: metodo,
      punto_id: PUNTO_ID,
      items: items.map((i) => ({ ...i })),
    };

    const actual = JSON.parse(localStorage.getItem('martineto_historial') || '[]');
    localStorage.setItem('martineto_historial', JSON.stringify([nuevaVenta, ...actual]));
    setHistorialVentas((prev) => [nuevaVenta, ...prev]);

    supabase.from('historial_ventas').insert([
      {
        id: nuevaVenta.id,
        fecha_hora: nuevaVenta.fechaHora,
        fecha_corta: nuevaVenta.fechaCorta,
        mesa_nombre: nuevaVenta.mesaNombre,
        total: nuevaVenta.total,
        metodo_pago: nuevaVenta.metodoPago,
        punto_id: PUNTO_ID,
      },
    ]);
  }

  function pagarRappiDirecto() {
    if (!mesaSeleccionada || pedidosMesa.length === 0) return;

    const itemsSinPagar = pedidosMesa.filter((i) => !i.pagado);
    guardarEnHistorial('Rappi 🛵', saldoPendienteMesa, 'Cuenta Rappi', itemsSinPagar);
    
    descontarStock(itemsSinPagar);

    const mesaActualizada: Mesa = {
      ...mesaSeleccionada,
      estado: 'ocupada_pagado',
      totalPagado: subtotalTotalMesa,
      pedidos: mesaSeleccionada.pedidos.map((p) => ({ ...p, pagado: true })),
    };

    setMesas((prev) => prev.map((m) => (m.id === mesaActualizada.id ? mesaActualizada : m)));
    setMesaSeleccionada(mesaActualizada);

    setAlerta({
      titulo: '¡Pedido Rappi Exitoso!',
      mensaje: 'El saldo del pedido ha sido registrado y el stock fue descontado.',
      tipo: 'exito',
      irAlLobbyAlCerrar: true,
    });
  }

  function registrarEstadoMesa(estado: 'ocupada_debe' | 'ocupada_pagado') {
    if (!mesaSeleccionada) return;

    if (estado === 'ocupada_pagado') {
      if (totalPagosIngresados < saldoPendienteMesa) {
        setAlerta({
          titulo: 'Monto Insuficiente',
          mensaje: `Faltan $${formatPrecio(pendienteEnModal)} para completar el pago.`,
          tipo: 'advertencia',
        });
        return;
      }

      let metodosUsados = [];
      if (metodosPago.efectivo > 0) metodosUsados.push('Efectivo');
      if (metodosPago.nequi > 0) metodosUsados.push('Nequi');
      if (metodosPago.daviplata > 0) metodosUsados.push('Daviplata');
      const etiquetaPago = metodosUsados.join(' + ') || 'Efectivo';

      const itemsNuevos = pedidosMesa.filter((p) => !p.pagado);
      guardarEnHistorial(mesaSeleccionada.nombre, saldoPendienteMesa, etiquetaPago, itemsNuevos);

      descontarStock(itemsNuevos);
    }

    const mesaActualizada: Mesa = {
      ...mesaSeleccionada,
      estado,
      totalPagado: estado === 'ocupada_pagado' ? subtotalTotalMesa : mesaSeleccionada.totalPagado,
      pedidos: mesaSeleccionada.pedidos.map((p) => (estado === 'ocupada_pagado' ? { ...p, pagado: true } : p)),
    };

    setMesas((prev) => prev.map((m) => (m.id === mesaActualizada.id ? mesaActualizada : m)));
    setMesaSeleccionada(mesaActualizada);

    setMostrarPago(false);
    setMetodosPago({ efectivo: 0, nequi: 0, daviplata: 0 });

    setAlerta({
      titulo: estado === 'ocupada_pagado' ? '¡Pago Registrado!' : 'Mesa en Espera',
      mensaje: `${mesaSeleccionada.nombre} actualizada e inventario descontado.`,
      tipo: 'exito',
      irAlLobbyAlCerrar: true,
    });
  }

 async function enviarSolicitudSuministro() {
  if (!itemSolicitado.trim()) return;

  const nuevaSolicitud = {
    producto: itemSolicitado.trim(),
    comprado: false,
    entregado: false,
  };

  try {
    const { error } = await supabase.from('pedidos_osos').insert([nuevaSolicitud]);
    if (error) {
      console.error('Error enviando suministro a Osos:', error.message);
    }
  } catch (e) {
    console.error('Error enviando suministro a Osos:', e);
  }

  setItemSolicitado('');
  setMostrarSolicitarSuministro(false);

  setAlerta({
    titulo: 'Solicitud Enviada',
    mensaje: 'El pedido de suministros para OSOS fue registrado en pedidos_osos.',
    tipo: 'exito',
  });
}
  const productosCatalogo = productos.filter(
    (p) => p.precio > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main className="min-h-screen w-screen bg-[#07090e] text-gray-100 p-3 sm:p-5 font-sans flex flex-col justify-between relative">
      <div className="flex-1 overflow-y-auto pb-24 pr-1 space-y-4">
        {/* HEADER SEDE OSOS */}
        <header className="max-w-7xl mx-auto bg-[#0d111a] p-3.5 sm:p-4 rounded-2xl border border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center text-xl shadow-md">
              🐻
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wider uppercase">
                  MARTINETO - {PUNTO_ID}
                </h1>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-900/60 text-amber-300 border border-amber-700/50">
                  STOCK INDEPENDIENTE
                </span>
              </div>
              <p className="text-xs text-gray-400">Punto de Venta Local</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/puntos')}
            className="bg-gray-800 hover:bg-rose-950 text-gray-300 hover:text-rose-300 border border-gray-700 hover:border-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
          >
            🚪 Salir
          </button>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        {!mesaSeleccionada ? (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mesas.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setMesaSeleccionada(m)}
                  className="bg-[#0d111a] border border-gray-800 p-4 rounded-2xl cursor-pointer hover:border-amber-500 transition-all text-center"
                >
                  <p className="font-black text-sm text-white">{m.nombre}</p>
                  <p className="text-xs text-gray-400 mt-1 uppercase">{m.estado.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-[#0d111a] p-4 rounded-2xl border border-gray-800 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-black text-white">{mesaSeleccionada.nombre}</h2>
                <input
                  type="text"
                  placeholder="🔍 Buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-44 bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>

              {/* PRODUCTOS */}
              {cargandoProductos ? (
                <p className="text-xs text-gray-500 text-center py-8">Cargando inventario de Osos...</p>
              ) : productosCatalogo.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">No se encontraron productos en productos_osos.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                  {productosCatalogo.map((prod) => {
                    const itemAgregado = pedidosMesa.find((p) => p.producto.id === prod.id && !p.pagado);
                    const cantAgregada = itemAgregado ? itemAgregado.cantidad : 0;
                    const badge = getStockBadge(prod.stock);

                    return (
                      <div
                        key={prod.id}
                        className="bg-[#121722] border border-gray-800 p-2.5 rounded-xl flex justify-between items-center"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-white text-xs truncate">{prod.nombre}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-emerald-400 font-black">${formatPrecio(prod.precio)}</p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${badge.color}`}>
                              {badge.texto}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 bg-gray-900 p-1 rounded-xl border border-gray-800 shrink-0">
                          <button
                            onClick={() => modificarCantidad(prod, -1)}
                            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-rose-600 text-white font-black text-sm flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-black text-xs w-5 text-center text-amber-400">{cantAgregada}</span>
                          <button
                            onClick={() => modificarCantidad(prod, 1)}
                            className="w-7 h-7 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-sm flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RESUMEN PEDIDO */}
            <div className="bg-[#0d111a] p-4 rounded-2xl border border-gray-800 space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-white border-b border-gray-800 pb-2">Comanda Activa</h3>
                <ul className="space-y-1.5 mt-2 max-h-[250px] overflow-y-auto">
                  {pedidosMesa.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center text-[11px] bg-gray-900/60 p-2 rounded-xl">
                      <span>{item.producto.nombre} x{item.cantidad}</span>
                      <span className="font-black">${formatPrecio(item.producto.precio * item.cantidad)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black text-rose-400">Total: ${formatPrecio(saldoPendienteMesa)}</p>
                {mesaSeleccionada.tipo === 'domicilio' ? (
                  <button
                    onClick={pagarRappiDirecto}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-2.5 rounded-xl text-xs"
                  >
                    🛵 Confirmar Pedido Rappi
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMetodosPago({ efectivo: saldoPendienteMesa, nequi: 0, daviplata: 0 });
                      setMostrarPago(true);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs"
                  >
                    Pagar y Descontar Stock
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NAV INFERIOR */}
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-7xl mx-auto bg-[#0a0d14]/95 backdrop-blur-md border-t border-gray-800/80 px-4 py-2.5 z-40">
        <div className="flex justify-around items-center text-center">
          <button onClick={() => setMesaSeleccionada(null)} className="flex flex-col items-center gap-0.5 text-amber-400 font-bold">
            <span className="text-xl">🏠</span>
            <span className="text-[10px]">Inicio</span>
          </button>

          <button
            onClick={() => setMostrarSolicitarSuministro(true)}
            className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-amber-400 transition-colors"
          >
            <span className="text-xl">📦</span>
            <span className="text-[10px]">Pedir Suministros</span>
          </button>
        </div>
      </nav>

      {/* MODAL COBRAR */}
      {mostrarPago && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-3">
            <h3 className="text-sm font-black text-white">Confirmar Pago y Descuento Stock</h3>
            <p className="text-xl font-black text-emerald-400">${formatPrecio(saldoPendienteMesa)}</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => setMostrarPago(false)} className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs">
                Cancelar
              </button>
              <button onClick={() => registrarEstadoMesa('ocupada_pagado')} className="bg-emerald-600 text-white font-black py-2 rounded-xl text-xs">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SOLICITAR SUMINISTROS */}
      {mostrarSolicitarSuministro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-3">
            <h3 className="text-sm font-black text-white">Pedir Suministros ({PUNTO_ID.toUpperCase()})</h3>
            <input
              type="text"
              placeholder="Ej: Servilletas, Cucharas..."
              value={itemSolicitado}
              onChange={(e) => setItemSolicitado(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none font-bold"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setMostrarSolicitarSuministro(false)} className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs">
                Cancelar
              </button>
              <button onClick={enviarSolicitudSuministro} className="bg-amber-600 text-white font-black py-2 rounded-xl text-xs">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALERTA */}
      {alerta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full text-center space-y-3">
            <h3 className="text-sm font-black text-white">{alerta.titulo}</h3>
            <p className="text-[11px] text-gray-400 font-medium">{alerta.mensaje}</p>
            <button onClick={() => { if(alerta.irAlLobbyAlCerrar) setMesaSeleccionada(null); setAlerta(null); }} className="w-full bg-amber-600 text-white font-black py-2 rounded-xl text-xs">
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}