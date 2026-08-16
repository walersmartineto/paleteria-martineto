'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerProductosMartineto,
  obtenerMesasMartineto,
  actualizarEstadoMesa,
  registrarVentaPOS,
  enviarPedidoSuministroPOS,
  ProductoPOS,
  MesaPOS,
} from '@/lib/martinetoQueries';

interface ItemPedido {
  producto: ProductoPOS;
  cantidad: number;
}

export default function DashboardPOSPage() {
  const router = useRouter();

  const [sesion, setSesion] = useState<any>(null);
  const [productos, setProductos] = useState<ProductoPOS[]>([]);
  const [mesas, setMesas] = useState<MesaPOS[]>([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<MesaPOS | null>(null);

  const [pedidosMesa, setPedidosMesa] = useState<{ [mesaId: number]: ItemPedido[] }>({});
  const [pedidosRappi, setPedidosRappi] = useState<ItemPedido[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [mostrarPago, setMostrarPago] = useState(false);
  const [metodosPago, setMetodosPago] = useState({ efectivo: 0, nequi: 0, daviplata: 0 });

  const [mostrarSolicitarSuministro, setMostrarSolicitarSuministro] = useState(false);
  const [itemSolicitado, setItemSolicitado] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sesionLocal = localStorage.getItem('martineto_session');
    
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }

    try {
      const dataSesion = JSON.parse(sesionLocal);
      setSesion(dataSesion);
      cargarDatos(dataSesion.sede_id || 1);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  async function cargarDatos(sedeId: number) {
    setCargando(true);
    const listaProds = await obtenerProductosMartineto();
    const listaMesas = await obtenerMesasMartineto(sedeId);
    setProductos(listaProds);
    setMesas(listaMesas);
    setCargando(false);
  }

  function modificarCantidad(producto: ProductoPOS, delta: number) {
    if (!mesaSeleccionada) return;

    const mesaId = mesaSeleccionada.id;
    const actual = pedidosMesa[mesaId] ? [...pedidosMesa[mesaId]] : [];
    const index = actual.findIndex((i) => i.producto.id === producto.id);

    if (index > -1) {
      const nuevaCant = actual[index].cantidad + delta;
      if (nuevaCant <= 0) {
        actual.splice(index, 1);
      } else {
        actual[index].cantidad = nuevaCant;
      }
    } else if (delta > 0) {
      actual.push({ producto, cantidad: 1 });
    }

    setPedidosMesa({ ...pedidosMesa, [mesaId]: actual });

    if (actual.length > 0 && mesaSeleccionada.estado === 'libre') {
      actualizarEstadoMesa(mesaId, 'ocupada_debe');
      setMesas(mesas.map((m) => (m.id === mesaId ? { ...m, estado: 'ocupada_debe' } : m)));
    }
  }

  const itemsMesaActual = mesaSeleccionada ? pedidosMesa[mesaSeleccionada.id] || [] : [];
  const totalMesaActual = itemsMesaActual.reduce((acc, i) => acc + i.producto.precio * i.cantidad, 0);
  const totalRappi = pedidosRappi.reduce((acc, i) => acc + i.producto.precio * i.cantidad, 0);

  async function handleConfirmarPagoMesa() {
    if (!mesaSeleccionada || itemsMesaActual.length === 0) return;

    const totalIngresado = metodosPago.efectivo + metodosPago.nequi + metodosPago.daviplata;
    if (totalIngresado < totalMesaActual) {
      alert(`Monto insuficiente. Faltan $${(totalMesaActual - totalIngresado).toLocaleString('es-CO')}`);
      return;
    }

    const pagosDetalle = [
      { tipo_pago_id: 1, monto: metodosPago.efectivo },
      { tipo_pago_id: 2, monto: metodosPago.nequi },
      { tipo_pago_id: 3, monto: metodosPago.daviplata },
    ];

    const productosVendidos = itemsMesaActual.map((i) => ({
      producto_id: i.producto.id,
      cantidad: i.cantidad,
      precio_unitario: i.producto.precio,
    }));

    const exito = await registrarVentaPOS(
      sesion.sede_id || 1,
      sesion.usuario_id,
      mesaSeleccionada.id,
      totalMesaActual,
      false,
      pagosDetalle,
      productosVendidos
    );

    if (exito) {
      await actualizarEstadoMesa(mesaSeleccionada.id, 'ocupada_pagado');
      setMesas(mesas.map((m) => (m.id === mesaSeleccionada.id ? { ...m, estado: 'ocupada_pagado' } : m)));
      setMostrarPago(false);
      setMetodosPago({ efectivo: 0, nequi: 0, daviplata: 0 });
      alert('¡Pago registrado con éxito!');
      cargarDatos(sesion.sede_id || 1);
    }
  }

  async function handleConfirmarRappi() {
    if (pedidosRappi.length === 0) return;

    const pagosDetalle = [{ tipo_pago_id: 4, monto: totalRappi }];
    const productosVendidos = pedidosRappi.map((i) => ({
      producto_id: i.producto.id,
      cantidad: i.cantidad,
      precio_unitario: i.producto.precio,
    }));

    const exito = await registrarVentaPOS(
      sesion.sede_id || 1,
      sesion.usuario_id,
      null,
      totalRappi,
      true,
      pagosDetalle,
      productosVendidos
    );

    if (exito) {
      setPedidosRappi([]);
      alert('¡Pedido Rappi registrado y cobrado correctamente!');
      cargarDatos(sesion.sede_id || 1);
    }
  }

  async function handleLiberarMesa(mesaId: number) {
    await actualizarEstadoMesa(mesaId, 'libre');
    setMesas(mesas.map((m) => (m.id === mesaId ? { ...m, estado: 'libre' } : m)));
    setPedidosMesa({ ...pedidosMesa, [mesaId]: [] });
    setMesaSeleccionada(null);
  }

  async function handleEnviarSuministro() {
    if (!itemSolicitado.trim()) return;
    const ok = await enviarPedidoSuministroPOS(sesion.sede_id || 1, sesion.usuario_id, itemSolicitado.trim());
    if (ok) {
      setItemSolicitado('');
      setMostrarSolicitarSuministro(false);
      alert('Solicitud de insumo enviada al Administrador');
    }
  }

  function cerrarSesion() {
    localStorage.removeItem('martineto_session');
    router.push('/login');
  }

  if (cargando && !sesion) {
    return (
      <main className="min-h-screen bg-[#07090e] flex items-center justify-center text-gray-400 text-xs font-bold">
        Cargando sistema...
      </main>
    );
  }

  const prodsFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 p-3 font-sans flex flex-col justify-between max-w-7xl mx-auto space-y-3">
      {/* Header */}
      <header className="bg-[#0d111a] border border-gray-800 p-3 rounded-2xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍦</span>
          <div>
            <h1 className="text-sm font-black text-white">MARTINETO POS</h1>
            <p className="text-[10px] text-gray-400">
              Operador: <b>{sesion?.nombre || 'Operador'}</b> | Sede: <b>{sesion?.sede_nombre || 'Martineto'}</b>
            </p>
          </div>
        </div>
        <button onClick={cerrarSesion} className="bg-gray-800 hover:bg-rose-950 text-gray-300 border border-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold">
          🚪 Salir
        </button>
      </header>

      {/* Mesas Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {mesas.map((m) => (
          <button
            key={m.id}
            onClick={() => setMesaSeleccionada(m)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border ${
              mesaSeleccionada?.id === m.id
                ? 'bg-purple-600 border-purple-400 text-white'
                : m.estado === 'libre'
                ? 'bg-[#0d111a] border-gray-800 text-emerald-400'
                : m.estado === 'ocupada_debe'
                ? 'bg-rose-950/80 border-rose-800 text-rose-400'
                : 'bg-amber-950/80 border-amber-800 text-amber-400'
            }`}
          >
            {m.nombre} ({m.estado === 'libre' ? 'Libre' : m.estado === 'ocupada_debe' ? 'Debe' : 'Pagado'})
          </button>
        ))}
      </div>

      {/* Seccion Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1">
        {/* Catalogo de Productos */}
        <div className="lg:col-span-2 bg-[#0d111a] border border-gray-800 p-3.5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black text-white">
              {mesaSeleccionada ? `Comanda ${mesaSeleccionada.nombre}` : 'Catálogo de Productos'}
            </h2>
            <input
              type="text"
              placeholder="🔍 Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1 text-xs text-white outline-none w-36"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-1">
            {prodsFiltrados.map((p) => {
              const itemMesa = mesaSeleccionada ? (pedidosMesa[mesaSeleccionada.id] || []).find((i) => i.producto.id === p.id) : null;
              const cantMesa = itemMesa ? itemMesa.cantidad : 0;

              return (
                <div key={p.id} className="bg-gray-900/60 border border-gray-800 p-2.5 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-xs text-white">{p.nombre}</p>
                    <p className="text-[10px] text-emerald-400 font-black">${p.precio.toLocaleString('es-CO')}</p>
                    <p className="text-[9px] text-gray-400">Stock: {p.stock ?? 0}</p>
                  </div>
                  {mesaSeleccionada && (
                    <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
                      <button onClick={() => modificarCantidad(p, -1)} className="w-6 h-6 rounded-lg bg-gray-800 text-white font-black text-xs flex items-center justify-center">-</button>
                      <span className="font-black text-xs w-5 text-center text-purple-400">{cantMesa}</span>
                      <button onClick={() => modificarCantidad(p, 1)} className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center">+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumen de Comanda o Rappi */}
        <div className="bg-[#0d111a] border border-gray-800 p-3.5 rounded-2xl space-y-3 flex flex-col justify-between">
          {mesaSeleccionada ? (
            <>
              <div className="space-y-2">
                <h3 className="text-xs font-black text-white border-b border-gray-800 pb-1.5">
                  Resumen {mesaSeleccionada.nombre}
                </h3>
                {itemsMesaActual.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-6">Sin productos en comanda</p>
                ) : (
                  itemsMesaActual.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-gray-900/60 p-2 rounded-xl">
                      <span>{i.producto.nombre} <b>x{i.cantidad}</b></span>
                      <span className="font-black text-purple-400">${(i.producto.precio * i.cantidad).toLocaleString('es-CO')}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-800">
                <p className="text-xs font-black text-emerald-400 flex justify-between">
                  <span>Total Pedido:</span>
                  <span>${totalMesaActual.toLocaleString('es-CO')}</span>
                </p>

                {mesaSeleccionada.estado === 'ocupada_pagado' ? (
                  <button onClick={() => handleLiberarMesa(mesaSeleccionada.id)} className="w-full bg-emerald-600 text-white font-black py-2 rounded-xl text-xs">
                    🔓 Liberar / Desocupar Mesa
                  </button>
                ) : (
                  <button onClick={() => { setMetodosPago({ efectivo: totalMesaActual, nequi: 0, daviplata: 0 }); setMostrarPago(true); }} disabled={itemsMesaActual.length === 0} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black py-2 rounded-xl text-xs">
                    💳 Registrar Pago
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-white border-b border-gray-800 pb-1.5">🛵 Pedido Directo Rappi</h3>
              <p className="text-[10px] text-gray-400">Selecciona productos del catálogo para armar pedido de Rappi</p>
              {pedidosRappi.map((i, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs bg-gray-900/60 p-2 rounded-xl">
                  <span>{i.producto.nombre} <b>x{i.cantidad}</b></span>
                  <span className="font-black text-purple-400">${(i.producto.precio * i.cantidad).toLocaleString('es-CO')}</span>
                </div>
              ))}
              <p className="text-xs font-black text-amber-400 flex justify-between pt-2 border-t border-gray-800">
                <span>Total Rappi:</span>
                <span>${totalRappi.toLocaleString('es-CO')}</span>
              </p>
              <button onClick={handleConfirmarRappi} disabled={pedidosRappi.length === 0} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-black py-2 rounded-xl text-xs">
                🛵 Confirmar y Cobrar Rappi
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Botón Suministros */}
      <button onClick={() => setMostrarSolicitarSuministro(true)} className="w-full bg-gray-900 border border-gray-800 text-amber-400 font-bold py-2 rounded-xl text-xs">
        📦 Solicitar Insumo / Suministro a Administración
      </button>

      {/* Modales */}
      {mostrarPago && mesaSeleccionada && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-3">
            <h3 className="text-xs font-black text-white">Cobrar {mesaSeleccionada.nombre}</h3>
            <p className="text-lg font-black text-emerald-400">${totalMesaActual.toLocaleString('es-CO')}</p>
            <div className="space-y-2 text-xs">
              <input type="number" placeholder="Efectivo" value={metodosPago.efectivo || ''} onChange={(e) => setMetodosPago({ ...metodosPago, efectivo: Number(e.target.value) })} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2 text-white outline-none font-bold" />
              <input type="number" placeholder="Nequi" value={metodosPago.nequi || ''} onChange={(e) => setMetodosPago({ ...metodosPago, nequi: Number(e.target.value) })} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2 text-white outline-none font-bold" />
              <input type="number" placeholder="Daviplata" value={metodosPago.daviplata || ''} onChange={(e) => setMetodosPago({ ...metodosPago, daviplata: Number(e.target.value) })} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2 text-white outline-none font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => setMostrarPago(false)} className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs">Cancelar</button>
              <button onClick={handleConfirmarPagoMesa} className="bg-emerald-600 text-white font-black py-2 rounded-xl text-xs">Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}

      {mostrarSolicitarSuministro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d111a] border border-gray-800 p-5 rounded-3xl max-w-xs w-full space-y-3">
            <h3 className="text-xs font-black text-white">Pedir Suministro a Administración</h3>
            <input type="text" placeholder="Ej: Leche, Escoba, Vasos..." value={itemSolicitado} onChange={(e) => setItemSolicitado(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none font-bold" />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setMostrarSolicitarSuministro(false)} className="bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs">Cancelar</button>
              <button onClick={handleEnviarSuministro} className="bg-amber-600 text-white font-black py-2 rounded-xl text-xs">Enviar Pedido</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}