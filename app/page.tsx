'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Interfaces
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

interface UsuarioSistema {
  id: string;
  usuario: string;
  clave: string;
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
  { id: 1, nombre: 'MESA 01', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 2, nombre: 'MESA 02', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 3, nombre: 'MESA 03', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 4, nombre: 'MESA 04', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 5, nombre: 'MESA 05', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 6, nombre: 'MESA 06', tipo: 'mesa', estado: 'libre', pedidos: [], totalPagado: 0 },
  { id: 7, nombre: 'Rappi 🛵', tipo: 'domicilio', estado: 'libre', pedidos: [], totalPagado: 0 },
];

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState<UsuarioSistema | null>(null);
  const [mesas, setMesas] = useState<Mesa[]>(MESAS_INICIALES);
  const [productos, setProductos] = useState<Producto[]>(PRODUCTOS_RESPALDO);
  const [cargandoProds, setCargandoProds] = useState(true);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // Control de vistas: 'tarjetas' | 'plano'
  const [vistaActual, setVistaActual] = useState<'tarjetas' | 'plano'>('tarjetas');

  const [historialVentas, setHistorialVentas] = useState<VentaHistorial[]>([]);

  const [mostrarPago, setMostrarPago] = useState(false);
  const [metodosPago, setMetodosPago] = useState({
    efectivo: 0,
    nequi: 0,
    daviplata: 0,
  });

  // Modal Traslado
  const [mesaAMover, setMesaAMover] = useState<Mesa | null>(null);
  const [mesaDestinoId, setMesaDestinoId] = useState<number | null>(null);

  // Modal Login Admin
  const [mostrarLoginAdmin, setMostrarLoginAdmin] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Modal Solicitar Suministros
  const [mostrarSolicitarSuministro, setMostrarSolicitarSuministro] = useState(false);
  const [itemSolicitado, setItemSolicitado] = useState('');

  const [alerta, setAlerta] = useState<AlertaMensaje | null>(null);

  // Verificación e Suscripción Realtime
  useEffect(() => {
    setMounted(true);
    const sesionStr = localStorage.getItem('martineto_sesion_activa');
    if (!sesionStr) {
      router.push('/login');
      return;
    } else {
      try {
        setUsuarioActual(JSON.parse(sesionStr));
      } catch (e) {
        router.push('/login');
        return;
      }
    }

    cargarProductosBaseDatos();
    cargarMesasBaseDatos();

    // SUSCRIPCIÓN TIEMPO REAL A SUPABASE
    const canalMesas = supabase
      .channel('cambios_mesas_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const mesaActualizada = payload.new as Mesa;
            setMesas((prev) =>
              prev.map((m) => (m.id === mesaActualizada.id ? mesaActualizada : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalMesas);
    };
  }, [router]);

  // Sincronizar mesa seleccionada si hay cambios externos en vivo
  useEffect(() => {
    if (mesaSeleccionada) {
      const actualizada = mesas.find((m) => m.id === mesaSeleccionada.id);
      if (actualizada) setMesaSeleccionada(actualizada);
    }
  }, [mesas]);

  async function cargarMesasBaseDatos() {
    try {
      const { data, error } = await supabase.from('mesas').select('*').order('id', { ascending: true });
      if (!error && data && data.length > 0) {
        setMesas(data as Mesa[]);
      }
    } catch {
      setMesas(MESAS_INICIALES);
    }
  }

  async function cargarProductosBaseDatos() {
    setCargandoProds(true);
    try {
      const { data, error } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
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

  // Guardar Cambios en Supabase en Tiempo Real
  async function actualizarMesaDB(mesaObj: Mesa) {
    // Actualización Optimista local
    setMesas((prev) => prev.map((m) => (m.id === mesaObj.id ? mesaObj : m)));
    
    await supabase.from('mesas').upsert({
      id: mesaObj.id,
      nombre: mesaObj.nombre,
      tipo: mesaObj.tipo,
      estado: mesaObj.estado,
      pedidos: mesaObj.pedidos,
      totalPagado: mesaObj.totalPagado,
    });
  }

  const formatPrecio = (valor: number) => {
    if (!mounted) return valor.toString();
    return Math.abs(valor).toLocaleString('es-CO');
  };

  function cerrarSesion() {
    localStorage.removeItem('martineto_sesion_activa');
    router.push('/login');
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
        nuevosPedidos[index].cantidad = nuevaCant;
      }
    } else if (delta > 0) {
      nuevosPedidos.push({ producto, cantidad: 1, pagado: false });
    }

    const hayPendientes = nuevosPedidos.some((p) => !p.pagado);
    const nuevoEstado = hayPendientes ? 'ocupada_debe' : mesaSeleccionada.estado;

    const mesaActualizada: Mesa = {
      ...mesaSeleccionada,
      pedidos: nuevosPedidos,
      estado: nuevoEstado,
    };

    actualizarMesaDB(mesaActualizada);
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

    const mesaActualizada: Mesa = {
      ...mesaSeleccionada,
      estado: 'ocupada_pagado',
      totalPagado: subtotalTotalMesa,
      pedidos: mesaSeleccionada.pedidos.map((p) => ({ ...p, pagado: true })),
    };

    actualizarMesaDB(mesaActualizada);

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

    const mesaActualizada: Mesa = {
      ...mesaSeleccionada,
      estado,
      totalPagado: estado === 'ocupada_pagado' ? subtotalTotalMesa : mesaSeleccionada.totalPagado,
      pedidos: mesaSeleccionada.pedidos.map((p) => (estado === 'ocupada_pagado' ? { ...p, pagado: true } : p)),
    };

    actualizarMesaDB(mesaActualizada);

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

    const mesaLiberada: Mesa = { ...mesaTarget, estado: 'libre', pedidos: [], totalPagado: 0 };
    actualizarMesaDB(mesaLiberada);

    setAlerta({
      titulo: 'Mesa Liberada',
      mensaje: `${mesaTarget.nombre} lista para nuevos clientes.`,
      tipo: 'exito',
      irAlLobbyAlCerrar: true,
    });
  }

  function transferirMesa() {
    if (!mesaAMover || !mesaDestinoId) return;

    const destino = mesas.find((m) => m.id === mesaDestinoId);
    if (!destino) return;

    const mesaDestinoActualizada: Mesa = {
      ...destino,
      estado: mesaAMover.estado,
      pedidos: [...destino.pedidos, ...mesaAMover.pedidos],
      totalPagado: destino.totalPagado + mesaAMover.totalPagado,
    };

    const mesaOrigenLiberada: Mesa = {
      ...mesaAMover,
      estado: 'libre',
      pedidos: [],
      totalPagado: 0,
    };

    actualizarMesaDB(mesaDestinoActualizada);
    actualizarMesaDB(mesaOrigenLiberada);

    const origenNombre = mesaAMover.nombre;
    const destinoNombre = destino.nombre;

    setMesaAMover(null);
    setMesaDestinoId(null);

    setAlerta({
      titulo: '¡Mesa Movida!',
      mensaje: `El pedido de ${origenNombre} se ha trasladado a ${destinoNombre}.`,
      tipo: 'exito',
    });
  }

  function validarLoginAdmin() {
    const usrs = JSON.parse(localStorage.getItem('martineto_usuarios_admin') || '[]');
    const listaUsuarios = usrs.length > 0 ? usrs : [{ id: '1', usuario: '1234', clave: '1234' }];

    const esValido = listaUsuarios.some(
      (u: UsuarioSistema) =>
        u.usuario.trim().toLowerCase() === userInput.trim().toLowerCase() && u.clave.trim() === passInput.trim()
    );

    if (esValido) {
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

  const totalPorCobrarCalculado = mesas
    .filter((m) => m.estado === 'ocupada_debe')
    .reduce((acc, m) => {
      const sub = m.pedidos.reduce((a, b) => a + b.producto.precio * b.cantidad, 0);
      return acc + Math.max(0, sub - m.totalPagado);
    }, 0);

  return (
    <main className="h-screen w-screen bg-[#07090e] text-gray-100 p-3 sm:p-5 font-sans flex flex-col justify-between overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-4 pr-1 space-y-4">
        {/* HEADER */}
        <header className="max-w-7xl mx-auto bg-[#0d111a] p-3.5 sm:p-4 rounded-2xl border border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-xl shadow-md shadow-purple-900/50">
              🍦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wider">MARTINETO</h1>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-900/60 text-purple-300 border border-purple-700/50">
                  POS REALTIME
                </span>
              </div>
              <p className="text-xs text-gray-400">Punto de Venta & Inventario</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-3 py-1 rounded-full font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {usuarioActual ? usuarioActual.usuario : 'Sistema activo'}
            </span>
            <button
              onClick={cerrarSesion}
              title="Cerrar sesión"
              className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 hover:border-rose-500 hover:text-rose-400 flex items-center justify-center text-sm text-gray-300 relative transition-all"
            >
              👤
            </button>
          </div>
        </header>

        {/* TABS MESAS HORIZONTAL */}
        <div className="max-w-7xl mx-auto bg-[#0d111a] p-1.5 rounded-2xl border border-gray-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {mesas.map((m) => {
            const isSelected = mesaSeleccionada?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMesaSeleccionada(m)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500 shadow-sm'
                    : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
                }`}
              >
                {m.nombre}
              </button>
            );
          })}
        </div>

        {/* CONTENIDO PRINCIPAL */}
        {!mesaSeleccionada ? (
          <div className="max-w-7xl mx-auto space-y-4">
            {/* RESUMEN METRICAS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#0d111a] p-3.5 rounded-2xl border border-gray-800/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 text-xl shrink-0">
                  🪑
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">MESAS LIBRES</p>
                  <p className="text-xl font-black text-emerald-400 leading-tight">
                    {mesas.filter((m) => m.estado === 'libre').length}
                  </p>
                  <p className="text-[10px] text-gray-500 font-semibold">disponibles</p>
                </div>
              </div>

              <div className="bg-[#0d111a] p-3.5 rounded-2xl border border-rose-900/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 text-xl shrink-0">
                  🎟️
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-rose-400 uppercase tracking-tight">POR COBRAR</p>
                  <p className="text-lg font-black text-rose-400 leading-tight truncate">
                    ${formatPrecio(totalPorCobrarCalculado)}
                  </p>
                  <p className="text-[10px] text-gray-500 font-semibold">pendiente</p>
                </div>
              </div>

              <div className="bg-[#0d111a] p-3.5 rounded-2xl border border-cyan-900/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400 text-xl shrink-0">
                  👥
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-cyan-300 uppercase tracking-tight">PAGADAS EN MESA</p>
                  <p className="text-xl font-black text-cyan-300 leading-tight">
                    {mesas.filter((m) => m.estado === 'ocupada_pagado').length}
                  </p>
                  <p className="text-[10px] text-gray-500 font-semibold">activas</p>
                </div>
              </div>
            </div>

            {/* BARRA DE VISTAS (TARJETAS vs PLANO) */}
            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-2">
                <span className="text-purple-400 text-lg">🏢</span>
                <div>
                  <h2 className="text-base font-black text-white tracking-wide">SALÓN</h2>
                  <p className="text-xs text-gray-400">
                    {mesas.filter((m) => m.estado === 'libre').length} disponibles •{' '}
                    {mesas.filter((m) => m.estado !== 'libre').length} ocupadas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[#0d111a] p-1 rounded-xl border border-gray-800">
                <button
                  onClick={() => setVistaActual('tarjetas')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    vistaActual === 'tarjetas'
                      ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>░░</span> Vista tarjetas
                </button>
                <button
                  onClick={() => setVistaActual('plano')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    vistaActual === 'plano'
                      ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🗺️</span> Plano (Listado)
                </button>
              </div>
            </div>

            {/* RENDERING VISTA TARJETAS O VISTA PLANO */}
            {vistaActual === 'tarjetas' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {mesas.map((m) => {
                  const totalConsumos = Math.max(0, m.pedidos.reduce((a, b) => a + b.producto.precio * b.cantidad, 0));
                  const pendienteMesa = Math.max(0, totalConsumos - m.totalPagado);
                  const totalItems = m.pedidos.reduce((acc, p) => acc + p.cantidad, 0);

                  let cardBorder = 'border-emerald-600/40 bg-[#0c1313]';
                  let badgeStyle = 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60';
                  let mesaBg = 'bg-[#111f1c] border-emerald-500/40';
                  let sillaColor = 'bg-emerald-500';
                  let estadoTexto = 'LIBRE';
                  let accionTexto = 'Sin consumos';

                  if (m.estado === 'ocupada_debe') {
                    cardBorder = 'border-rose-600/50 bg-[#160d13]';
                    badgeStyle = 'bg-rose-950/80 text-rose-400 border-rose-700/60';
                    mesaBg = 'bg-[#25121a] border-rose-500/50';
                    sillaColor = 'bg-rose-500';
                    estadoTexto = 'POR COBRAR';
                    accionTexto = 'VER CUENTA >';
                  } else if (m.estado === 'ocupada_pagado') {
                    cardBorder = 'border-amber-500/50 bg-[#17130b]';
                    badgeStyle = 'bg-amber-950/80 text-amber-400 border-amber-700/60';
                    mesaBg = 'bg-[#261c0d] border-amber-500/50';
                    sillaColor = 'bg-amber-500';
                    estadoTexto = 'OCUPADA';
                    accionTexto = 'VER PEDIDO >';
                  }

                  return (
                    <div
                      key={m.id}
                      onClick={() => setMesaSeleccionada(m)}
                      className={`p-3.5 rounded-2xl cursor-pointer transition-all border flex flex-col justify-between shadow-lg ${cardBorder}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black text-white">{m.nombre}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wider ${badgeStyle}`}>
                          ● {estadoTexto}
                        </span>
                      </div>

                      <div className="my-2 flex justify-center items-center py-2">
                        <div className={`relative w-28 h-16 rounded-2xl border flex flex-col items-center justify-center transition-all ${mesaBg}`}>
                          {m.estado === 'libre' ? (
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                              LIBRE
                            </span>
                          ) : m.estado === 'ocupada_debe' ? (
                            <div className="flex flex-col items-center">
                              <span className="text-rose-400 text-sm">🎟️</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-amber-400 text-xs">👥</span>
                              <span className="text-[8px] font-black text-amber-300 mt-0.5">3 personas</span>
                            </div>
                          )}

                          <div className={`absolute -top-2 w-8 h-1.5 rounded-full ${sillaColor}`} />
                          <div className={`absolute -bottom-2 w-8 h-1.5 rounded-full ${sillaColor}`} />
                          <div className={`absolute -left-2 w-1.5 h-6 rounded-full ${sillaColor}`} />
                          <div className={`absolute -right-2 w-1.5 h-6 rounded-full ${sillaColor}`} />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1 border-t border-gray-800/60">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-bold flex items-center gap-1">
                            🛍️ {totalItems} productos
                          </span>
                          <span
                            className={`font-black text-xs ${
                              m.estado === 'libre'
                                ? 'text-emerald-400'
                                : m.estado === 'ocupada_debe'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            ${formatPrecio(m.estado === 'libre' ? 0 : pendienteMesa)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 pt-0.5">
                          {m.estado !== 'libre' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMesaAMover(m);
                              }}
                              className="bg-purple-900/40 hover:bg-purple-700 text-purple-300 hover:text-white border border-purple-700/50 font-black py-1 rounded-xl text-[9px] transition-all"
                            >
                              ⇄ Mover
                            </button>
                          )}

                          {m.estado === 'ocupada_pagado' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                liberarMesa(m.id);
                              }}
                              className="bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/50 font-black py-1 rounded-xl text-[9px] transition-all"
                            >
                              🔓 Liberar
                            </button>
                          ) : (
                            <p
                              className={`text-[9px] font-black text-center col-span-1 self-center ${
                                m.estado === 'libre' ? 'text-gray-500 col-span-2' : 'text-rose-400'
                              }`}
                            >
                              {accionTexto}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VISTA PLANO (LISTADO DIRECTO Y MINIMALISTA) */
              <div className="bg-[#0d111a] border border-gray-800 rounded-2xl divide-y divide-gray-800/80">
                {mesas.map((m) => {
                  const totalConsumos = Math.max(0, m.pedidos.reduce((a, b) => a + b.producto.precio * b.cantidad, 0));
                  const pendienteMesa = Math.max(0, totalConsumos - m.totalPagado);
                  const totalItems = m.pedidos.reduce((acc, p) => acc + p.cantidad, 0);

                  return (
                    <div
                      key={m.id}
                      onClick={() => setMesaSeleccionada(m)}
                      className="p-3.5 flex items-center justify-between hover:bg-gray-900/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 ${
                            m.estado === 'libre'
                              ? 'bg-emerald-500 shadow-sm shadow-emerald-500'
                              : m.estado === 'ocupada_debe'
                              ? 'bg-rose-500 shadow-sm shadow-rose-500'
                              : 'bg-amber-500 shadow-sm shadow-amber-500'
                          }`}
                        />
                        <div>
                          <p className="font-black text-white text-xs">{m.nombre}</p>
                          <p className="text-[10px] text-gray-400">
                            {m.estado === 'libre'
                              ? 'Disponible'
                              : `${totalItems} productos en consumo`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`font-black text-xs ${
                            m.estado === 'libre'
                              ? 'text-emerald-400'
                              : m.estado === 'ocupada_debe'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          ${formatPrecio(m.estado === 'libre' ? 0 : pendienteMesa)}
                        </span>

                        <span className="text-xs text-gray-500 font-bold">›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* COMANDA DE LA MESA */
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-[#0d111a] p-4 rounded-2xl border border-gray-800 flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-black text-white">{mesaSeleccionada.nombre}</h2>
                  <p className="text-xs text-gray-400">Catálogo de productos Martineto</p>
                </div>
                <input
                  type="text"
                  placeholder="🔍 Buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-44 bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>

              {cargandoProds ? (
                <p className="text-center text-xs text-gray-500 py-6">Cargando productos...</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                  {productosCatalogo.map((prod) => {
                    const itemAgregado = pedidosMesa.find((p) => p.producto.id === prod.id && !p.pagado);
                    const cantAgregada = itemAgregado ? itemAgregado.cantidad : 0;

                    return (
                      <div
                        key={prod.id}
                        className="bg-[#121722] border border-gray-800 p-2.5 rounded-xl flex justify-between items-center"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-white text-xs truncate">{prod.nombre}</p>
                          <p className="text-[10px] text-emerald-400 font-black">${formatPrecio(prod.precio)}</p>
                        </div>

                        <div className="flex items-center gap-1.5 bg-gray-900 p-1 rounded-xl border border-gray-800 shrink-0">
                          <button
                            onClick={() => modificarCantidad(prod, -1)}
                            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-rose-600 text-white font-black text-sm flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-black text-xs w-5 text-center text-purple-400">{cantAgregada}</span>
                          <button
                            onClick={() => modificarCantidad(prod, 1)}
                            className="w-7 h-7 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-sm flex items-center justify-center"
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

            <div className="bg-[#0d111a] p-4 rounded-2xl border border-gray-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <h3 className="text-xs font-black text-white">Resumen de Comanda</h3>
                  <span className="text-[10px] text-gray-400 font-bold">{pedidosMesa.length} ítems</span>
                </div>

                {pedidosMesa.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-4">Mesa sin pedidos</p>
                ) : (
                  <ul className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-380px)] pr-1">
                    {pedidosMesa.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between items-center text-[11px] bg-gray-900/60 p-2 rounded-xl border border-gray-800/80"
                      >
                        <span className="truncate max-w-[180px] font-medium text-gray-200">
                          {item.producto.nombre} <b className="text-purple-400">x{item.cantidad}</b>
                        </span>
                        <span className="font-black text-purple-300">
                          ${formatPrecio(item.producto.precio * item.cantidad)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-800">
                <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800 text-[11px] space-y-1">
                  <div className="flex justify-between text-gray-400">
                    <span>Consumos:</span>
                    <span className="font-bold text-white">${formatPrecio(subtotalTotalMesa)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400 font-black text-xs border-t border-gray-800 pt-1">
                    <span>Saldo Pendiente:</span>
                    <span>${formatPrecio(saldoPendienteMesa)}</span>
                  </div>
                </div>

                {mesaSeleccionada.tipo === 'domicilio' ? (
                  <button
                    onClick={pagarRappiDirecto}
                    disabled={saldoPendienteMesa === 0}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs"
                  >
                    🛵 Confirmar Pedido Rappi
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => registrarEstadoMesa('ocupada_debe')}
                      disabled={pedidosMesa.length === 0}
                      className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs"
                    >
                      Ocupada (Debe)
                    </button>
                    <button
                      onClick={() => {
                        setMetodosPago({
                          efectivo: saldoPendienteMesa,
                          nequi: 0,
                          daviplata: 0,
                        });
                        setMostrarPago(true);
                      }}
                      disabled={saldoPendienteMesa === 0}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs"
                    >
                      Pagar Novedad
                    </button>
                  </div>
                )}

                {mesaSeleccionada.estado !== 'libre' && (
                  <button
                    onClick={() => liberarMesa(mesaSeleccionada.id)}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2 rounded-xl text-xs"
                  >
                    Liberar / Desocupar Mesa
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NAV INFERIOR */}
      <nav className="w-full max-w-7xl mx-auto bg-[#0a0d14]/95 backdrop-blur-md border-t border-gray-800/80 px-4 py-2 z-40 shrink-0">
        <div className="flex justify-around items-center text-center">
          <button
            onClick={() => setMesaSeleccionada(null)}
            className={`flex flex-col items-center gap-0.5 relative ${
              !mesaSeleccionada ? 'text-purple-400 font-bold' : 'text-gray-500'
            }`}
          >
            <span className="text-xl">🏠</span>
            <span className="text-[10px]">Inicio</span>
            {!mesaSeleccionada && <span className="w-8 h-0.5 bg-purple-500 rounded-full absolute -top-2"></span>}
          </button>

          <button
            onClick={() => setMesaSeleccionada(mesas[0])}
            className={`flex flex-col items-center gap-0.5 relative ${
              mesaSeleccionada ? 'text-purple-400 font-bold' : 'text-gray-500'
            }`}
          >
            <span className="text-xl">🪑</span>
            <span className="text-[10px]">Mesas</span>
            {mesaSeleccionada && <span className="w-8 h-0.5 bg-purple-500 rounded-full absolute -top-2"></span>}
          </button>

          <button
            onClick={() => setMostrarSolicitarSuministro(true)}
            className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-amber-400 transition-colors"
          >
            <span className="text-xl">📦</span>
            <span className="text-[10px]">Pedir Suministros</span>
          </button>

          <button
            onClick={() => setMostrarLoginAdmin(true)}
            className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-rose-400 transition-colors"
          >
            <span className="text-xl">🛡️</span>
            <span className="text-[10px]">Admin</span>
          </button>
        </div>
      </nav>

      {/* MODAL TRASLADO */}
      {mesaAMover && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-4">
            <div className="text-center space-y-1">
              <p className="text-2xl">⇄</p>
              <h3 className="text-sm font-black text-white">Mover {mesaAMover.nombre}</h3>
              <p className="text-[11px] text-gray-400">
                Selecciona la mesa destino para transferir el pedido completo.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Mesa Destino:</label>
              <select
                value={mesaDestinoId || ''}
                onChange={(e) => setMesaDestinoId(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none font-bold"
              >
                <option value="">-- Seleccionar Mesa --</option>
                {mesas
                  .filter((m) => m.id !== mesaAMover.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} {m.estado !== 'libre' ? '(Ocupada - Combinar)' : '(Libre)'}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  setMesaAMover(null);
                  setMesaDestinoId(null);
                }}
                className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={transferirMesa}
                disabled={!mesaDestinoId}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black py-2 rounded-xl text-xs transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COBRO */}
      {mostrarPago && mesaSeleccionada && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-4">
            <h3 className="text-sm font-black text-white">Cobrar {mesaSeleccionada.nombre}</h3>
            <p className="text-xl font-black text-emerald-400">Pendiente: ${formatPrecio(saldoPendienteMesa)}</p>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-gray-400 font-bold block mb-1">💵 Efectivo</label>
                <input
                  type="number"
                  value={metodosPago.efectivo || ''}
                  onChange={(e) => setMetodosPago({ ...metodosPago, efectivo: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-white outline-none font-bold"
                />
              </div>
              <div>
                <label className="text-gray-400 font-bold block mb-1">📱 Nequi</label>
                <input
                  type="number"
                  value={metodosPago.nequi || ''}
                  onChange={(e) => setMetodosPago({ ...metodosPago, nequi: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-white outline-none font-bold"
                />
              </div>
              <div>
                <label className="text-gray-400 font-bold block mb-1">📱 Daviplata</label>
                <input
                  type="number"
                  value={metodosPago.daviplata || ''}
                  onChange={(e) => setMetodosPago({ ...metodosPago, daviplata: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-white outline-none font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setMostrarPago(false)}
                className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => registrarEstadoMesa('ocupada_pagado')}
                className="bg-emerald-600 text-white font-black py-2 rounded-xl text-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LOGIN ADMIN */}
      {mostrarLoginAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-3">
            <div className="text-center space-y-1">
              <p className="text-2xl">🔐</p>
              <h3 className="text-sm font-black text-white">Panel Administrador</h3>
            </div>

            {errorLogin && (
              <p className="text-[10px] text-rose-400 bg-rose-950/60 p-2 rounded-xl border border-rose-800/40 text-center font-bold">
                {errorLogin}
              </p>
            )}

            <input
              type="text"
              placeholder="Usuario"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none font-bold"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none font-bold"
            />

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setMostrarLoginAdmin(false)}
                className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={validarLoginAdmin}
                className="bg-rose-600 text-white font-black py-2 rounded-xl text-xs"
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
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-3">
            <div className="text-center space-y-1">
              <p className="text-2xl">🧹</p>
              <h3 className="text-sm font-black text-white">Pedir Suministros</h3>
            </div>

            <input
              type="text"
              placeholder="Ej: Escoba, Jabón..."
              value={itemSolicitado}
              onChange={(e) => setItemSolicitado(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none font-bold"
            />

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setMostrarSolicitarSuministro(false)}
                className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={enviarSolicitudSuministro}
                className="bg-amber-600 text-white font-black py-2 rounded-xl text-xs"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALERTA NATIVA */}
      {alerta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full text-center space-y-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl border bg-gray-800 border-gray-700">
              {alerta.tipo === 'error' ? '⚠️' : alerta.tipo === 'exito' ? '✅' : '🔔'}
            </div>

            <div>
              <h3 className="text-sm font-black text-white">{alerta.titulo}</h3>
              <p className="text-[11px] text-gray-400 mt-1 font-medium leading-relaxed">{alerta.mensaje}</p>
            </div>

            <button
              onClick={cerrarAlerta}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 rounded-xl text-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}