'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Interfaces de datos
interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

interface ItemPedido {
  producto: Producto;
  cantidad: number;
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
  mesaNombre: string;
  total: number;
  metodoPago: string;
  items: ItemPedido[];
}

// Lista oficial Martineto de respaldo
const PRODUCTOS_RESPALDO: Producto[] = [
  { id: 1, nombre: 'Adición', precio: 1000, stock: 10 },
  { id: 2, nombre: 'Chamoy', precio: 13000, stock: 10 },
  { id: 3, nombre: 'Chileta', precio: 1500, stock: 10 },
  { id: 4, nombre: 'Colombina', precio: 2000, stock: 10 },
  { id: 5, nombre: 'Corralito', precio: 13000, stock: 10 },
  { id: 6, nombre: 'Descuento Estudiante', precio: -500, stock: 10 },
  { id: 7, nombre: 'Dorineto', precio: 9000, stock: 10 },
  { id: 8, nombre: 'Fruta Enchilada', precio: 9000, stock: 10 },
  { id: 9, nombre: 'Gomitas Enchiladas', precio: 6000, stock: 10 },
  { id: 10, nombre: 'Jugo Agua', precio: 7000, stock: 10 },
  { id: 11, nombre: 'Jugo en Leche', precio: 8000, stock: 10 },
  { id: 12, nombre: 'Limonada', precio: 7000, stock: 10 },
  { id: 13, nombre: 'Limonada Coco', precio: 8000, stock: 10 },
  { id: 14, nombre: 'Malteada', precio: 12000, stock: 10 },
  { id: 15, nombre: 'Malteada Lego', precio: 14000, stock: 10 },
  { id: 16, nombre: 'Maracumango', precio: 10000, stock: 10 },
  { id: 17, nombre: 'Martifrape', precio: 9000, stock: 10 },
  { id: 18, nombre: 'Oblea Cremosita', precio: 11000, stock: 10 },
  { id: 19, nombre: 'Oblea Helado', precio: 7000, stock: 10 },
  { id: 20, nombre: 'Oblea Martineto', precio: 17000, stock: 10 },
  { id: 21, nombre: 'Oblea Sencilla', precio: 5000, stock: 10 },
  { id: 22, nombre: 'Oblea Tradicional', precio: 7000, stock: 10 },
  { id: 23, nombre: 'Paleta', precio: 6000, stock: 10 },
  { id: 24, nombre: 'Paleta Mango Biche', precio: 7000, stock: 10 },
  { id: 25, nombre: 'Sodas', precio: 6000, stock: 10 },
  { id: 26, nombre: 'Soft', precio: 7000, stock: 10 },
  { id: 27, nombre: 'Yogurneto', precio: 13000, stock: 10 },
];

const MESAS_INICIALES: Mesa[] = [
  { id: 1, nombre: 'Mesa 1', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 2, nombre: 'Mesa 2', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 3, nombre: 'Mesa 3', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 4, nombre: 'Mesa 4', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 5, nombre: 'Mesa 5', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 6, nombre: 'Mesa 6', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 7, nombre: 'Rappi 🛵', tipo: 'domicilio', estado: 'libre', pedidos: [], totalPagado: 0 },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [mesas, setMesas] = useState<Mesa[]>(MESAS_INICIALES);
  const [productos, setProductos] = useState<Producto[]>(PRODUCTOS_RESPALDO);
  const [cargandoProds, setCargandoProds] = useState(true);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);

  // Historial de ventas
  const [historialVentas, setHistorialVentas] = useState<VentaHistorial[]>([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Modal de cobro
  const [mostrarPago, setMostrarPago] = useState(false);
  const [metodosPago, setMetodosPago] = useState({
    efectivo: 0,
    nequi: 0,
    daviplata: 0,
  });

  // Prevenir problemas de hidratación SSR
  useEffect(() => {
    setMounted(true);
    cargarProductosBaseDatos();
  }, []);

  async function cargarProductosBaseDatos() {
    setCargandoProds(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error || !data || data.length === 0) {
        setProductos(PRODUCTOS_RESPALDO);
      } else {
        setProductos(data);
      }
    } catch {
      setProductos(PRODUCTOS_RESPALDO);
    }
    setCargandoProds(false);
  }

  const formatPrecio = (valor: number) => {
    if (!mounted) return valor.toString();
    return valor.toLocaleString('es-CO');
  };

  useEffect(() => {
    if (mesaSeleccionada) {
      const actualizada = mesas.find((m) => m.id === mesaSeleccionada.id);
      if (actualizada) setMesaSeleccionada(actualizada);
    }
  }, [mesas]);

  function modificarCantidad(producto: Producto, delta: number) {
    if (!mesaSeleccionada) return;

    setMesas((prevMesas) =>
      prevMesas.map((m) => {
        if (m.id !== mesaSeleccionada.id) return m;

        let nuevosPedidos = [...m.pedidos];
        const index = nuevosPedidos.findIndex((p) => p.producto.id === producto.id);

        if (index > -1) {
          const nuevaCant = nuevosPedidos[index].cantidad + delta;
          if (nuevaCant <= 0) {
            nuevosPedidos.splice(index, 1);
          } else {
            nuevosPedidos[index].cantidad = nuevaCant;
          }
        } else if (delta > 0) {
          nuevosPedidos.push({ producto, cantidad: 1 });
        }

        return { ...m, pedidos: nuevosPedidos };
      })
    );
  }

  const pedidosMesa = mesaSeleccionada?.pedidos || [];
  const totalMesa = pedidosMesa.reduce(
    (acc, item) => acc + item.producto.precio * item.cantidad,
    0
  );

  const totalPagosIngresados =
    metodosPago.efectivo + metodosPago.nequi + metodosPago.daviplata;

  const cambioDevueltas = Math.max(0, totalPagosIngresados - totalMesa);
  const pendientePorCobrar = Math.max(0, totalMesa - totalPagosIngresados);

  // Registro de venta en el historial local (evitando saturar Supabase)
  function guardarEnHistorial(mesaNombre: string, total: number, metodo: string, items: ItemPedido[]) {
    const nuevaVenta: VentaHistorial = {
      id: Date.now().toString(),
      fechaHora: new Date().toLocaleString('es-CO'),
      mesaNombre,
      total,
      metodoPago: metodo,
      items: [...items],
    };
    setHistorialVentas((prev) => [nuevaVenta, ...prev]);
  }

  function pagarRappiDirecto() {
    if (!mesaSeleccionada || pedidosMesa.length === 0) return;

    guardarEnHistorial('Rappi 🛵', totalMesa, 'Cuenta Rappi', pedidosMesa);

    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaSeleccionada.id
          ? { ...m, estado: 'ocupada_pagado', totalPagado: totalMesa }
          : m
      )
    );

    alert('¡Pedido de Rappi marcado como PAGADO exitosamente!');
  }

  function registrarEstadoMesa(estado: 'ocupada_debe' | 'ocupada_pagado') {
    if (!mesaSeleccionada) return;

    if (estado === 'ocupada_pagado') {
      if (totalPagosIngresados < totalMesa) {
        alert(`Monto insuficiente. Falta $${formatPrecio(pendientePorCobrar)} para completar la cuenta.`);
        return;
      }

      // Generar etiqueta del método de pago
      let metodosUsados = [];
      if (metodosPago.efectivo > 0) metodosUsados.push('Efectivo');
      if (metodosPago.nequi > 0) metodosUsados.push('Nequi');
      if (metodosPago.daviplata > 0) metodosUsados.push('Daviplata');
      const etiquetaPago = metodosUsados.join(' + ') || 'Efectivo';

      guardarEnHistorial(mesaSeleccionada.nombre, totalMesa, etiquetaPago, pedidosMesa);
    }

    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaSeleccionada.id
          ? {
              ...m,
              estado,
              totalPagado: estado === 'ocupada_pagado' ? totalMesa : m.totalPagado,
            }
          : m
      )
    );

    alert(`${mesaSeleccionada.nombre} marcada como: ${estado === 'ocupada_pagado' ? 'PAGADA' : 'OCUPADA (DEBE)'}`);
    setMostrarPago(false);
    setMetodosPago({ efectivo: 0, nequi: 0, daviplata: 0 });
  }

  function liberarMesa(id: number) {
    setMesas((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, estado: 'libre', pedidos: [], totalPagado: 0 } : m
      )
    );
    setMesaSeleccionada(null);
  }

  // Funciones para limpiar historial
  function eliminarVentaHistorial(id: string) {
    setHistorialVentas((prev) => prev.filter((item) => item.id !== id));
  }

  function borrarTodoElHistorial() {
    if (confirm('¿Estás seguro de borrar todo el historial de ventas? Esta acción liberará espacio de la memoria.')) {
      setHistorialVentas([]);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-2 sm:p-4 md:p-6 font-sans text-slate-800">
      {/* Header Dashboard Responsive */}
      <header className="max-w-7xl mx-auto mb-4 sm:mb-6 bg-white p-3 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="text-center md:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Martineto POS</h1>
          <p className="text-xs text-slate-500">Punto de Venta e Inventario</p>
        </div>

        {/* Acceso directo a mesas, Historial y botón Lobby */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 w-full md:w-auto">
          {!mesaSeleccionada && (
            <button
              onClick={() => setMostrarHistorial(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all"
            >
              📜 Ver Historial ({historialVentas.length})
            </button>
          )}

          {mesaSeleccionada && (
            <button
              onClick={() => setMesaSeleccionada(null)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all w-full sm:w-auto mb-1 sm:mb-0"
            >
              🏠 Ir al Lobby
            </button>
          )}

          {mesas.map((m) => (
            <button
              key={m.id}
              onClick={() => setMesaSeleccionada(m)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs border transition-all ${
                mesaSeleccionada?.id === m.id ? 'ring-2 ring-blue-600' : ''
              } ${
                m.estado === 'libre'
                  ? 'bg-green-50 text-green-700 border-green-300'
                  : m.estado === 'ocupada_debe'
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : 'bg-blue-50 text-blue-700 border-blue-300'
              }`}
            >
              {m.nombre}{' '}
              {m.estado === 'libre'
                ? '🟢'
                : m.estado === 'ocupada_debe'
                ? '🔴'
                : '🔵'}
            </button>
          ))}
        </div>
      </header>

      {/* LOBBY / MENU INICIAL */}
      {!mesaSeleccionada ? (
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border-l-8 border-green-500">
              <p className="text-xs font-bold text-slate-400 uppercase">Mesas Libres</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                {mesas.filter((m) => m.estado === 'libre').length}
              </p>
            </div>
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border-l-8 border-red-500">
              <p className="text-xs font-bold text-slate-400 uppercase">Mesas Ocupadas (Debe)</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                {mesas.filter((m) => m.estado === 'ocupada_debe').length}
              </p>
            </div>
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border-l-8 border-blue-500">
              <p className="text-xs font-bold text-slate-400 uppercase">Mesas Pagadas</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                {mesas.filter((m) => m.estado === 'ocupada_pagado').length}
              </p>
            </div>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-700">Estado de Mesas y Canal Rappi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {mesas.map((m) => {
              const totalMesaActual = m.pedidos.reduce(
                (a, b) => a + b.producto.precio * b.cantidad,
                0
              );

              return (
                <div
                  key={m.id}
                  onClick={() => setMesaSeleccionada(m)}
                  className={`bg-white p-4 sm:p-5 rounded-2xl shadow-sm border-2 cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between ${
                    m.estado === 'libre'
                      ? 'border-green-300 hover:border-green-500'
                      : m.estado === 'ocupada_debe'
                      ? 'border-red-300 hover:border-red-500 bg-red-50/30'
                      : 'border-blue-300 hover:border-blue-500 bg-blue-50/30'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-2 sm:mb-3">
                      <h3 className="text-base sm:text-lg font-bold text-slate-800">{m.nombre}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.estado === 'libre'
                            ? 'bg-green-100 text-green-700'
                            : m.estado === 'ocupada_debe'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {m.estado.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {m.pedidos.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-3 sm:py-4">Sin pedidos activos</p>
                    ) : (
                      <ul className="space-y-1 my-2 max-h-24 sm:max-h-28 overflow-hidden text-xs text-slate-600">
                        {m.pedidos.map((p, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span className="truncate max-w-[140px] sm:max-w-[160px]">{p.producto.nombre} x{p.cantidad}</span>
                            <span className="font-bold">${formatPrecio(p.producto.precio * p.cantidad)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t pt-2 sm:pt-3 mt-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Total:</span>
                    <span className="text-sm sm:text-base font-black text-blue-600">
                      ${formatPrecio(totalMesaActual)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA POS: TOMAR PEDIDO */
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Catálogo de Productos */}
          <div className="lg:col-span-2 bg-white p-3 sm:p-5 md:p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-800">
                {mesaSeleccionada.nombre} — Productos
              </h2>
              <span
                className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full ${
                  mesaSeleccionada.estado === 'libre'
                    ? 'bg-green-100 text-green-700'
                    : mesaSeleccionada.estado === 'ocupada_debe'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {mesaSeleccionada.estado.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {/* Grid de Productos */}
            {cargandoProds ? (
              <p className="text-center text-slate-400 py-12 text-sm">
                Cargando productos...
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-1">
                {productos.map((prod) => {
                  const itemAgregado = pedidosMesa.find(
                    (p) => p.producto.id === prod.id
                  );
                  const cantAgregada = itemAgregado ? itemAgregado.cantidad : 0;

                  return (
                    <div
                      key={prod.id}
                      className="border border-slate-200 p-2.5 sm:p-3 rounded-xl bg-slate-50 flex justify-between items-center"
                    >
                      <div className="pr-2 truncate">
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                          {prod.nombre}
                        </h4>
                        <p className="text-xs text-green-600 font-bold mt-0.5">
                          ${formatPrecio(prod.precio)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 bg-white border rounded-xl p-1 shadow-sm shrink-0">
                        <button
                          onClick={() => modificarCantidad(prod, -1)}
                          className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-base sm:text-sm"
                        >
                          -
                        </button>
                        <span className="font-bold text-xs sm:text-sm w-4 text-center">
                          {cantAgregada}
                        </span>
                        <button
                          onClick={() => modificarCantidad(prod, 1)}
                          className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center text-base sm:text-sm"
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

          {/* Historial y Comanda */}
          <div className="bg-white p-3 sm:p-5 md:p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-2 border-b pb-2 sm:pb-3">
                Historial {mesaSeleccionada.nombre}
              </h3>

              {pedidosMesa.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-400 text-center py-8 sm:py-12">
                  Sin productos agregados.
                </p>
              ) : (
                <ul className="space-y-2 max-h-60 sm:max-h-80 md:max-h-96 overflow-y-auto pr-1">
                  {pedidosMesa.map((item) => (
                    <li
                      key={item.producto.id}
                      className="flex justify-between items-center text-xs sm:text-sm text-slate-700 border-b pb-2"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold truncate">{item.producto.nombre}</p>
                        <p className="text-[10px] sm:text-xs text-slate-400">
                          ${formatPrecio(item.producto.precio)} x {item.cantidad}
                        </p>
                      </div>
                      <span className="font-bold text-slate-800 shrink-0">
                        ${formatPrecio(item.producto.precio * item.cantidad)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 sm:mt-6 border-t pt-3 sm:pt-4">
              <div className="flex justify-between text-lg sm:text-xl font-bold text-slate-800 mb-3 sm:mb-4">
                <span>Total Mesa:</span>
                <span className="text-blue-600">${formatPrecio(totalMesa)}</span>
              </div>

              {/* Lógica Especial para Rappi vs Mesas Normales */}
              {mesaSeleccionada.tipo === 'domicilio' ? (
                <button
                  onClick={pagarRappiDirecto}
                  disabled={pedidosMesa.length === 0}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors mb-2 shadow-sm"
                >
                  🛵 Confirmar Pedido Rappi (Automático)
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => registrarEstadoMesa('ocupada_debe')}
                    disabled={pedidosMesa.length === 0}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition-colors"
                  >
                    Ocupada (Debe)
                  </button>
                  <button
                    onClick={() => {
                      setMetodosPago({ efectivo: totalMesa, nequi: 0, daviplata: 0 });
                      setMostrarPago(true);
                    }}
                    disabled={pedidosMesa.length === 0}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-slate-200 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition-colors"
                  >
                    Pagar Pedido
                  </button>
                </div>
              )}

              {mesaSeleccionada.estado !== 'libre' && (
                <button
                  onClick={() => liberarMesa(mesaSeleccionada.id)}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-xl text-xs transition-colors"
                >
                  Liberar / Desocupar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL DE VENTAS CON FECHA Y HORA */}
      {mostrarHistorial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white p-4 sm:p-6 rounded-2xl max-w-xl w-full shadow-xl max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  📜 Historial de Ventas Registradas
                </h3>
                {historialVentas.length > 0 && (
                  <button
                    onClick={borrarTodoElHistorial}
                    className="text-xs bg-red-100 text-red-600 hover:bg-red-200 font-bold px-2.5 py-1 rounded-lg"
                  >
                    🗑️ Borrar Todo
                  </button>
                )}
              </div>

              {historialVentas.length === 0 ? (
                <p className="text-center text-slate-400 py-12 text-sm">
                  No hay ventas registradas en el historial.
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {historialVentas.map((venta) => (
                    <div
                      key={venta.id}
                      className="border border-slate-200 p-3 rounded-xl bg-slate-50 flex justify-between items-start gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">
                            {venta.mesaNombre}
                          </span>
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                            {venta.metodoPago}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          🕒 {venta.fechaHora}
                        </p>
                        <ul className="text-xs text-slate-600 mt-1 space-y-0.5">
                          {venta.items.map((it, i) => (
                            <li key={i}>
                              • {it.producto.nombre} x{it.cantidad} (${formatPrecio(it.producto.precio * it.cantidad)})
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs font-black text-green-600 mt-1">
                          Total: ${formatPrecio(venta.total)}
                        </p>
                      </div>

                      <button
                        onClick={() => eliminarVentaHistorial(venta.id)}
                        className="text-slate-400 hover:text-red-500 text-xs p-1 font-bold"
                        title="Borrar registro"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t">
              <button
                onClick={() => setMostrarHistorial(false)}
                className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cobro para Mesas Normales */}
      {mostrarPago && mesaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white p-4 sm:p-6 rounded-2xl max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
              Cobrar {mesaSeleccionada.nombre}
            </h3>
            <p className="text-xl sm:text-2xl font-black text-blue-600 mb-3 sm:mb-4">
              Total: ${formatPrecio(totalMesa)}
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  💵 ¿Con cuánto paga en Efectivo?
                </label>
                <input
                  type="number"
                  placeholder="Ej: 5000, 10000, 20000"
                  value={metodosPago.efectivo || ''}
                  onChange={(e) =>
                    setMetodosPago({
                      ...metodosPago,
                      efectivo: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-xl p-2.5 text-sm outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  📱 Nequi
                </label>
                <input
                  type="number"
                  placeholder="Monto transferido"
                  value={metodosPago.nequi || ''}
                  onChange={(e) =>
                    setMetodosPago({
                      ...metodosPago,
                      nequi: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  📱 Daviplata
                </label>
                <input
                  type="number"
                  placeholder="Monto transferido"
                  value={metodosPago.daviplata || ''}
                  onChange={(e) =>
                    setMetodosPago({
                      ...metodosPago,
                      daviplata: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl mb-4 text-xs space-y-2 border">
              <div className="flex justify-between">
                <span>Total Recibido:</span>
                <span className="font-bold">${formatPrecio(totalPagosIngresados)}</span>
              </div>

              {pendientePorCobrar > 0 ? (
                <div className="flex justify-between text-red-600 font-bold border-t pt-1">
                  <span>Falta por Cobrar:</span>
                  <span>${formatPrecio(pendientePorCobrar)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-green-600 font-bold border-t pt-1 text-sm">
                  <span>Devueltas / Cambio:</span>
                  <span>${formatPrecio(cambioDevueltas)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                onClick={() => setMostrarPago(false)}
                className="bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs sm:text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => registrarEstadoMesa('ocupada_pagado')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}