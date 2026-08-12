'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  items: ItemPedido[];
}

interface AlertaMensaje {
  titulo: string;
  mensaje: string;
  tipo: 'error' | 'exito' | 'advertencia';
  irAlLobbyAlCerrar?: boolean;
}

const PRODUCTOS_RESPALDO: Producto[] = [
  { id: 1, nombre: 'Adición', precio: 1000, stock: 10 },
  { id: 2, nombre: 'Chamoy', precio: 13000, stock: 10 },
  { id: 3, nombre: 'Chileta', precio: 1500, stock: 10 },
  { id: 4, nombre: 'Colombina', precio: 2000, stock: 10 },
  { id: 5, nombre: 'Corralito', precio: 13000, stock: 10 },
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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mesas, setMesas] = useState<Mesa[]>(MESAS_INICIALES);
  const [productos, setProductos] = useState<Producto[]>(PRODUCTOS_RESPALDO);
  const [cargandoProds, setCargandoProds] = useState(true);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [historialVentas, setHistorialVentas] = useState<VentaHistorial[]>([]);

  const [mostrarPago, setMostrarPago] = useState(false);
  const [metodosPago, setMetodosPago] = useState({
    efectivo: 0,
    nequi: 0,
    daviplata: 0,
  });

  // Modal Login Admin
  const [mostrarLoginAdmin, setMostrarLoginAdmin] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Modal Solicitar Suministros
  const [mostrarSolicitarSuministro, setMostrarSolicitarSuministro] = useState(false);
  const [itemSolicitado, setItemSolicitado] = useState('');

  const [alerta, setAlerta] = useState<AlertaMensaje | null>(null);

  // Cargar estado guardado al iniciar
  useEffect(() => {
    setMounted(true);
    cargarProductosBaseDatos();

    // Recuperar estado de las mesas almacenadas
    const mesasGuardadas = localStorage.getItem('martineto_mesas_pos');
    if (mesasGuardadas) {
      try {
        setMesas(JSON.parse(mesasGuardadas));
      } catch (e) {
        setMesas(MESAS_INICIALES);
      }
    }
  }, []);

  // Guardar mesas en localStorage cada vez que cambien
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('martineto_mesas_pos', JSON.stringify(mesas));
    }
  }, [mesas, mounted]);

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
    return Math.abs(valor).toLocaleString('es-CO');
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

        const nuevosPedidos = m.pedidos.map((item) => ({ ...item }));
        const index = nuevosPedidos.findIndex(
          (p) => p.producto.id === producto.id && !p.pagado
        );

        if (index > -1) {
          const nuevaCant = nuevosPedidos[index].cantidad + delta;
          if (nuevaCant <= 0) {
            nuevosPedidos.splice(index, 1);
          } else {
            nuevosPedidos[index].cantidad = nuevaCant;
          }
        } else if (delta > 0) {
          nuevosPedidos.push({ producto, cantidad: 1, pagado: false });
        }

        const hayPendientes = nuevosPedidos.some((p) => !p.pagado);
        const nuevoEstado = hayPendientes ? 'ocupada_debe' : m.estado;

        return { ...m, pedidos: nuevosPedidos, estado: nuevoEstado };
      })
    );
  }

  function agregarDescuentoItem(nombre: string, valorNegativo: number) {
    if (!mesaSeleccionada) return;

    const productoDescuento: Producto = {
      id: Date.now(),
      nombre,
      precio: valorNegativo,
      stock: 999,
    };

    modificarCantidad(productoDescuento, 1);
  }

  const pedidosMesa = mesaSeleccionada?.pedidos || [];
  
  const subtotalTotalMesa = Math.max(
    0,
    pedidosMesa.reduce((acc, item) => acc + item.producto.precio * item.cantidad, 0)
  );

  const totalPagadoPrevio = mesaSeleccionada?.totalPagado || 0;
  const saldoPendienteMesa = Math.max(0, subtotalTotalMesa - totalPagadoPrevio);

  const totalPagosIngresados =
    metodosPago.efectivo + metodosPago.nequi + metodosPago.daviplata;

  const cambioDevueltas = Math.max(0, totalPagosIngresados - saldoPendienteMesa);
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
      items: items.map((i) => ({ ...i })),
    };
    
    const actual = JSON.parse(localStorage.getItem('martineto_historial') || '[]');
    localStorage.setItem('martineto_historial', JSON.stringify([nuevaVenta, ...actual]));
    setHistorialVentas((prev) => [nuevaVenta, ...prev]);
  }

  function pagarRappiDirecto() {
    if (!mesaSeleccionada || pedidosMesa.length === 0) return;

    const itemsSinPagar = pedidosMesa.filter((i) => !i.pagado);
    guardarEnHistorial('Rappi 🛵', saldoPendienteMesa, 'Cuenta Rappi', itemsSinPagar);

    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaSeleccionada.id
          ? {
              ...m,
              estado: 'ocupada_pagado',
              totalPagado: subtotalTotalMesa,
              pedidos: m.pedidos.map((p) => ({ ...p, pagado: true })),
            }
          : m
      )
    );

    setAlerta({
      titulo: '¡Pedido Rappi Exitoso!',
      mensaje: 'El saldo del pedido ha sido registrado como cobrado.',
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
    }

    setMesas((prev) =>
      prev.map((m) => {
        if (m.id !== mesaSeleccionada.id) return m;

        const nuevosPedidosMarcados = m.pedidos.map((p) =>
          estado === 'ocupada_pagado' ? { ...p, pagado: true } : p
        );

        return {
          ...m,
          estado,
          totalPagado: estado === 'ocupada_pagado' ? subtotalTotalMesa : m.totalPagado,
          pedidos: nuevosPedidosMarcados,
        };
      })
    );

    setMostrarPago(false);
    setMetodosPago({ efectivo: 0, nequi: 0, daviplata: 0 });

    setAlerta({
      titulo: estado === 'ocupada_pagado' ? '¡Pago Registrado!' : 'Mesa en Espera',
      mensaje: `${mesaSeleccionada.nombre} actualizada correctamente.`,
      tipo: 'exito',
      irAlLobbyAlCerrar: true,
    });
  }

  function liberarMesa(id: number) {
    const mesaTarget = mesas.find((m) => m.id === id);
    if (!mesaTarget) return;

    const subtotal = Math.max(0, mesaTarget.pedidos.reduce((a, b) => a + b.producto.precio * b.cantidad, 0));
    const saldoPendiente = subtotal - mesaTarget.totalPagado;

    if (saldoPendiente > 0) {
      setAlerta({
        titulo: 'No se puede desocupar',
        mensaje: `La ${mesaTarget.nombre} tiene una cuenta pendiente de $${formatPrecio(saldoPendiente)}. Cobrar antes de liberar.`,
        tipo: 'error',
      });
      return;
    }

    setMesas((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, estado: 'libre', pedidos: [], totalPagado: 0 }
          : m
      )
    );

    setAlerta({
      titulo: 'Mesa Liberada',
      mensaje: `${mesaTarget.nombre} lista para nuevos clientes.`,
      tipo: 'exito',
      irAlLobbyAlCerrar: true,
    });
  }

  function validarLoginAdmin() {
    if (userInput === '1234' && passInput === '1234') {
      setUserInput('');
      setPassInput('');
      setErrorLogin('');
      setMostrarLoginAdmin(false);
      router.push('/admin');
    } else {
      setErrorLogin('Usuario o clave incorrectos.');
    }
  }

  function enviarSolicitudSuministro() {
    if (!itemSolicitado.trim()) return;

    const solicitudesPrevias = JSON.parse(localStorage.getItem('martineto_pedidos_admin') || '[]');
    const nuevaSolicitud = {
      id: Date.now().toString(),
      producto: itemSolicitado.trim(),
      comprado: false,
      entregado: false,
    };

    localStorage.setItem('martineto_pedidos_admin', JSON.stringify([...solicitudesPrevias, nuevaSolicitud]));
    setItemSolicitado('');
    setMostrarSolicitarSuministro(false);

    setAlerta({
      titulo: 'Solicitud Enviada',
      mensaje: 'El pedido de suministros ha sido registrado para el administrador.',
      tipo: 'exito',
    });
  }

  function cerrarAlerta() {
    if (alerta?.irAlLobbyAlCerrar) {
      setMesaSeleccionada(null);
    }
    setAlerta(null);
  }

  const productosCatalogo = productos.filter(
    (p) => p.precio > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#0d1117] text-gray-100 p-3 sm:p-6 font-sans selection:bg-purple-600 selection:text-white pb-24 lg:pb-6">
      {/* Header en fondo oscuro neutro */}
      <header className="max-w-7xl mx-auto mb-6 bg-[#161b22] p-4 sm:p-5 rounded-3xl border border-gray-800 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-xl shadow-lg shadow-purple-900/40">
              🍦
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                MARTINETO <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/50">POS 2026</span>
              </h1>
              <p className="text-xs text-gray-400">Punto de Venta e Inventario</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setMesaSeleccionada(null)}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all border flex items-center gap-2 active:translate-y-0.5 ${
              !mesaSeleccionada
                ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
            }`}
          >
            🏠 Ir al Lobby
          </button>

          <button
            onClick={() => setMostrarSolicitarSuministro(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all border border-amber-500/50 flex items-center gap-2 active:translate-y-0.5"
          >
            📦 Pedir Suministros
          </button>

          <button
            onClick={() => setMostrarLoginAdmin(true)}
            className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all border border-rose-500/50 flex items-center gap-2 active:translate-y-0.5"
          >
            🔐 Admin
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
            {mesas.map((m) => {
              const isSelected = mesaSeleccionada?.id === m.id;
              let statusStyle = "bg-gray-800 border-gray-700 text-gray-300";
              if (m.estado === 'libre') statusStyle = "bg-emerald-950/40 border-emerald-600/50 text-emerald-400";
              if (m.estado === 'ocupada_debe') statusStyle = "bg-rose-950/60 border-rose-500 text-rose-400";
              if (m.estado === 'ocupada_pagado') statusStyle = "bg-cyan-950/60 border-cyan-500 text-cyan-300";

              return (
                <button
                  key={m.id}
                  onClick={() => setMesaSeleccionada(m)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all whitespace-nowrap active:scale-95 ${statusStyle} ${
                    isSelected ? 'ring-2 ring-purple-400 scale-105' : ''
                  }`}
                >
                  {m.nombre}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* LOBBY / MONITOR FÍSICO DE SALA DE MESAS */}
      {!mesaSeleccionada ? (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#161b22] p-5 rounded-3xl border border-gray-800 shadow-xl">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Mesas Libres</p>
              <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">
                {mesas.filter((m) => m.estado === 'libre').length}
              </p>
            </div>
            <div className="bg-[#161b22] p-5 rounded-3xl border border-rose-900/50 shadow-xl">
              <p className="text-xs font-black text-rose-400 uppercase tracking-wider">Por Cobrar (Debe)</p>
              <p className="text-3xl sm:text-4xl font-black text-rose-400 mt-1">
                {mesas.filter((m) => m.estado === 'ocupada_debe').length}
              </p>
            </div>
            <div className="bg-[#161b22] p-5 rounded-3xl border border-cyan-900/50 shadow-xl">
              <p className="text-xs font-black text-cyan-300 uppercase tracking-wider">Pagadas en Mesa</p>
              <p className="text-3xl sm:text-4xl font-black text-cyan-300 mt-1">
                {mesas.filter((m) => m.estado === 'ocupada_pagado').length}
              </p>
            </div>
          </div>

          <h2 className="text-lg font-black text-gray-300 tracking-wide">PLANO FÍSICO DE SALA</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {mesas.map((m) => {
              const totalConsumos = Math.max(
                0,
                m.pedidos.reduce((a, b) => a + b.producto.precio * b.cantidad, 0)
              );
              const pendienteMesa = Math.max(0, totalConsumos - m.totalPagado);

              let borderCard = "border-2 border-emerald-600/40 bg-[#161b22]";
              let badgeStyle = "bg-emerald-950 text-emerald-400 border-emerald-700/50";
              let sillaColor = "bg-emerald-500 shadow-md";
              let mesaBg = "bg-gray-800/80 border-gray-700";

              if (m.estado === 'ocupada_debe') {
                borderCard = "border-2 border-rose-500 bg-rose-950/20";
                badgeStyle = "bg-rose-950 text-rose-400 border-rose-700/50";
                sillaColor = "bg-rose-500 shadow-md animate-pulse";
                mesaBg = "bg-rose-950/40 border-rose-700/50";
              } else if (m.estado === 'ocupada_pagado') {
                borderCard = "border-2 border-cyan-500 bg-cyan-950/20";
                badgeStyle = "bg-cyan-950 text-cyan-300 border-cyan-700/50";
                sillaColor = "bg-cyan-400 shadow-md";
                mesaBg = "bg-cyan-950/40 border-cyan-700/50";
              }

              return (
                <div
                  key={m.id}
                  onClick={() => setMesaSeleccionada(m)}
                  className={`p-5 rounded-3xl cursor-pointer transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between relative overflow-hidden shadow-xl ${borderCard}`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        {m.nombre}
                      </h3>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${badgeStyle}`}>
                        {m.estado.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="my-4 flex justify-center items-center py-3 relative">
                      <div className={`relative w-32 h-20 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${mesaBg}`}>
                        {m.pedidos.length > 0 ? (
                          <div className="flex items-center gap-1 bg-gray-900 px-2 py-0.5 rounded-full border border-amber-500/40 shadow-md animate-bounce">
                            <span className="text-base">🍦</span>
                            <span className="text-[10px] font-black text-amber-400">{m.pedidos.length} Ítems</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            DISPONIBLE
                          </span>
                        )}

                        <div className={`absolute -top-3 w-10 h-2.5 rounded-full transition-all ${sillaColor}`} />
                        <div className={`absolute -bottom-3 w-10 h-2.5 rounded-full transition-all ${sillaColor}`} />
                        <div className={`absolute -left-3 w-2.5 h-10 rounded-full transition-all ${sillaColor}`} />
                        <div className={`absolute -right-3 w-2.5 h-10 rounded-full transition-all ${sillaColor}`} />
                      </div>
                    </div>

                    {m.pedidos.length === 0 ? (
                      <p className="text-xs text-gray-500 py-1 text-center font-bold">Sin consumos</p>
                    ) : (
                      <ul className="space-y-1 my-2 max-h-24 overflow-hidden text-xs text-gray-300">
                        {m.pedidos.map((p, idx) => (
                          <li key={idx} className="flex justify-between items-center">
                            <span className="truncate max-w-[140px]">
                              {p.producto.nombre} <b className="text-purple-400">x{p.cantidad}</b>
                            </span>
                            <span className={`font-bold ${p.producto.precio < 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                              {p.producto.precio < 0 ? '-' : ''}${formatPrecio(p.producto.precio * p.cantidad)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-gray-800 pt-3 mt-3 space-y-1">
                    {m.totalPagado > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold">Pagado:</span>
                        <span className="text-cyan-300 font-black">${formatPrecio(m.totalPagado)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400">Pendiente:</span>
                      <span className="text-lg font-black text-rose-400">
                        ${formatPrecio(pendienteMesa)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA POS / CATÁLOGO Y COMANDA CON ALTO CONTRASTE */
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Catálogo de Productos */}
          <div className="lg:col-span-2 bg-[#161b22] p-4 sm:p-6 rounded-3xl border border-gray-800 shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h2 className="text-xl font-black text-white">
                  {mesaSeleccionada.nombre}
                </h2>
                <p className="text-xs text-gray-400">Catálogo de productos Martineto</p>
              </div>

              <input
                type="text"
                placeholder="🔍 Buscar producto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full sm:w-64 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {cargandoProds ? (
              <div className="text-center text-gray-500 py-20 font-bold animate-pulse">
                Cargando productos...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {productosCatalogo.map((prod) => {
                  const itemAgregado = pedidosMesa.find(
                    (p) => p.producto.id === prod.id && !p.pagado
                  );
                  const cantAgregada = itemAgregado ? itemAgregado.cantidad : 0;

                  return (
                    <div
                      key={prod.id}
                      className="bg-[#21262d] hover:bg-[#272c34] border border-gray-700 p-3.5 rounded-2xl flex justify-between items-center transition-all shadow-md"
                    >
                      <div className="pr-2 truncate">
                        <h4 className="font-bold text-white text-sm truncate">
                          {prod.nombre}
                        </h4>
                        <p className="text-xs text-emerald-400 font-extrabold mt-0.5">
                          ${formatPrecio(prod.precio)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 bg-gray-900 p-1.5 rounded-2xl border border-gray-800 shrink-0">
                        <button
                          onClick={() => modificarCantidad(prod, -1)}
                          className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-rose-600 active:scale-95 text-white font-black flex items-center justify-center text-lg transition-all"
                        >
                          -
                        </button>
                        <span className="font-black text-sm w-6 text-center text-purple-400">
                          {cantAgregada}
                        </span>
                        <button
                          onClick={() => modificarCantidad(prod, 1)}
                          className="w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black flex items-center justify-center text-lg transition-all"
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

          {/* Columna Derecha: Panel de Comanda */}
          <div className="bg-[#161b22] p-4 sm:p-6 rounded-3xl border border-gray-800 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
                <h3 className="text-lg font-black text-white">
                  Resumen de Comanda
                </h3>
                <span className="text-xs font-bold text-gray-400">
                  {pedidosMesa.length} ítems
                </span>
              </div>

              {pedidosMesa.length === 0 ? (
                <div className="text-center py-16 text-gray-600 space-y-2">
                  <p className="text-4xl">🛒</p>
                  <p className="text-xs font-bold">Mesa sin pedidos</p>
                </div>
              ) : (
                <ul className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                  {pedidosMesa.map((item, idx) => {
                    const esDescuento = item.producto.precio < 0;

                    return (
                      <li
                        key={idx}
                        className={`flex justify-between items-center text-xs p-2.5 rounded-2xl border ${
                          esDescuento
                            ? 'bg-amber-950/40 border-amber-600/50 text-amber-300'
                            : item.pagado
                            ? 'bg-cyan-950/30 border-cyan-800/40 text-gray-400'
                            : 'bg-gray-900 border-gray-800 text-gray-200'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold truncate flex items-center gap-1.5">
                            {item.producto.nombre}
                            {item.pagado && (
                              <span className="text-[9px] bg-cyan-900/50 text-cyan-300 px-1.5 py-0.5 rounded-full border border-cyan-700/50 font-bold">
                                PAGADO
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {esDescuento ? 'Descuento' : `$${formatPrecio(item.producto.precio)}`} x {item.cantidad}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`font-black text-sm shrink-0 ${esDescuento ? 'text-amber-400' : item.pagado ? 'text-cyan-300' : 'text-purple-400'}`}>
                            {esDescuento ? '-' : ''}${formatPrecio(item.producto.precio * item.cantidad)}
                          </span>

                          {!item.pagado && (
                            <button
                              onClick={() => modificarCantidad(item.producto, -1)}
                              className="text-gray-500 hover:text-rose-400 text-xs px-1 font-bold"
                              title="Quitar"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 pt-3 border-t border-gray-800">
                <p className="text-xs font-black text-gray-400 mb-2">
                  🏷️ APLICAR DESCUENTO
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => agregarDescuentoItem('Descuento Estudiante', -500)}
                    className="bg-amber-950/30 hover:bg-amber-900/40 text-amber-400 border border-amber-600/50 font-bold py-2 rounded-xl text-xs transition-all active:scale-95"
                  >
                    Estudiante (-$500)
                  </button>
                  <button
                    onClick={() => agregarDescuentoItem('Descuento Especial', -1000)}
                    className="bg-amber-950/30 hover:bg-amber-900/40 text-amber-400 border border-amber-600/50 font-bold py-2 rounded-xl text-xs transition-all active:scale-95"
                  >
                    Especial (-$1.000)
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-800 pt-4 space-y-2">
              <div className="bg-gray-900 p-3.5 rounded-2xl border border-gray-800 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-400 font-medium">
                  <span>Monto Total Consumos:</span>
                  <span className="font-bold text-white">${formatPrecio(subtotalTotalMesa)}</span>
                </div>

                {totalPagadoPrevio > 0 && (
                  <div className="flex justify-between text-cyan-300 font-bold border-t border-gray-800 pt-1">
                    <span>Pagado previamente:</span>
                    <span>-${formatPrecio(totalPagadoPrevio)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-black border-t border-gray-800 pt-2 text-rose-400">
                  <span>Saldo Pendiente:</span>
                  <span>${formatPrecio(saldoPendienteMesa)}</span>
                </div>
              </div>

              {mesaSeleccionada.tipo === 'domicilio' ? (
                <button
                  onClick={pagarRappiDirecto}
                  disabled={saldoPendienteMesa === 0}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-black py-3.5 rounded-2xl text-xs sm:text-sm active:scale-95 transition-all border border-orange-500/50"
                >
                  🛵 Confirmar Pedido Rappi
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => registrarEstadoMesa('ocupada_debe')}
                    disabled={pedidosMesa.length === 0}
                    className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black py-3 rounded-2xl text-xs active:scale-95 transition-all border border-rose-500/50"
                  >
                    Ocupada (Debe)
                  </button>
                  <button
                    onClick={() => {
                      setMetodosPago({ efectivo: saldoPendienteMesa, nequi: 0, daviplata: 0 });
                      setMostrarPago(true);
                    }}
                    disabled={saldoPendienteMesa === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3 rounded-2xl text-xs active:scale-95 transition-all border border-emerald-500/50"
                  >
                    Pagar Novedad
                  </button>
                </div>
              )}

              {mesaSeleccionada.estado !== 'libre' && (
                <button
                  onClick={() => liberarMesa(mesaSeleccionada.id)}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-2xl text-xs active:scale-95 transition-all border border-gray-700 mt-1"
                >
                  Liberar / Desocupar Mesa
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL COBRO */}
      {mostrarPago && mesaSeleccionada && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-gray-800 p-6 rounded-3xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-white mb-1">
              Cobrar {mesaSeleccionada.nombre}
            </h3>
            <p className="text-2xl font-black text-emerald-400 mb-4">
              Saldo Pendiente: ${formatPrecio(saldoPendienteMesa)}
            </p>

            <div className="space-y-3.5 mb-5">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">
                  💵 Efectivo
                </label>
                <input
                  type="number"
                  placeholder="Monto entregado"
                  value={metodosPago.efectivo || ''}
                  onChange={(e) =>
                    setMetodosPago({
                      ...metodosPago,
                      efectivo: Number(e.target.value),
                    })
                  }
                  className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-3 text-sm text-white outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">
                  📱 Nequi
                </label>
                <input
                  type="number"
                  placeholder="Monto Nequi"
                  value={metodosPago.nequi || ''}
                  onChange={(e) =>
                    setMetodosPago({
                      ...metodosPago,
                      nequi: Number(e.target.value),
                    })
                  }
                  className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-3 text-sm text-white outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">
                  📱 Daviplata
                </label>
                <input
                  type="number"
                  placeholder="Monto Daviplata"
                  value={metodosPago.daviplata || ''}
                  onChange={(e) =>
                    setMetodosPago({
                      ...metodosPago,
                      daviplata: Number(e.target.value),
                    })
                  }
                  className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-3 text-sm text-white outline-none focus:border-purple-500 font-bold"
                />
              </div>
            </div>

            <div className="bg-gray-900 p-3.5 rounded-2xl mb-5 text-xs space-y-2 border border-gray-800">
              <div className="flex justify-between text-gray-400 font-bold">
                <span>Total Recibido:</span>
                <span className="text-white">${formatPrecio(totalPagosIngresados)}</span>
              </div>

              {pendienteEnModal > 0 ? (
                <div className="flex justify-between text-rose-400 font-black border-t border-gray-800 pt-2">
                  <span>Falta por Cobrar:</span>
                  <span>${formatPrecio(pendienteEnModal)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-emerald-400 font-black border-t border-gray-800 pt-2 text-sm">
                  <span>Devueltas / Cambio:</span>
                  <span>${formatPrecio(cambioDevueltas)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMostrarPago(false)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-2xl text-xs active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => registrarEstadoMesa('ocupada_pagado')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-2xl text-xs active:scale-95 transition-all"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LOGIN ADMIN */}
      {mostrarLoginAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-gray-800 p-6 rounded-3xl max-w-xs w-full shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <p className="text-3xl">🔐</p>
              <h3 className="text-lg font-black text-white">Panel Administrador</h3>
              <p className="text-xs text-gray-400">Ingresa tus credenciales</p>
            </div>

            {errorLogin && (
              <p className="text-xs text-rose-400 bg-rose-950/60 p-2 rounded-xl border border-rose-800/40 text-center font-bold">
                {errorLogin}
              </p>
            )}

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Usuario"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-3 text-xs text-white outline-none focus:border-rose-500 font-bold"
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-3 text-xs text-white outline-none focus:border-rose-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setMostrarLoginAdmin(false)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={validarLoginAdmin}
                className="bg-rose-600 hover:bg-rose-500 text-white font-black py-2.5 rounded-xl text-xs active:scale-95 transition-all"
              >
                Ingresar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEDIR SUMINISTROS */}
      {mostrarSolicitarSuministro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-gray-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <p className="text-3xl">🧹</p>
              <h3 className="text-lg font-black text-white">Pedir Suministros</h3>
              <p className="text-xs text-gray-400">Solicita artículos de aseo o insumos requeridos</p>
            </div>

            <input
              type="text"
              placeholder="Ej: Escoba, Jabón de losas, Balde..."
              value={itemSolicitado}
              onChange={(e) => setItemSolicitado(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-3 text-xs text-white outline-none focus:border-amber-500 font-bold"
            />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setMostrarSolicitarSuministro(false)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={enviarSolicitudSuministro}
                className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs active:scale-95 transition-all"
              >
                Enviar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTA NATIVA CON DIRECCIONAMIENTO AL LOBBY */}
      {alerta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-gray-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl border bg-gray-800 border-gray-700">
              {alerta.tipo === 'error' ? '⚠️' : alerta.tipo === 'exito' ? '✅' : '🔔'}
            </div>

            <div>
              <h3 className="text-lg font-black text-white">{alerta.titulo}</h3>
              <p className="text-xs text-gray-400 mt-2 font-medium leading-relaxed">
                {alerta.mensaje}
              </p>
            </div>

            <button
              onClick={cerrarAlerta}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-2xl text-xs transition-all active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}