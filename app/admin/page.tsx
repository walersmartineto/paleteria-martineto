'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSede } from '@/context/SedeContext';

export default function AdminPage() {
  const router = useRouter();
  const { sedeData } = useSede();

  // Fecha de referencia global
  const fechaHoy = new Date().toISOString().split('T')[0];
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(fechaHoy);
  const [sedeSeleccionada, setSedeSeleccionada] = useState<string>('todos');

  // Control de Módulos Principales
  const [moduloAbierto, setModuloAbierto] = useState<string | null>(null);

  // Sub-control interno de Logística
  const [subPestanaLogistica, setSubPestanaLogistica] = useState<'compras' | 'despachos'>('compras');

  // Sub-control interno de Cierres
  const [subPestanaCierres, setSubPestanaCierres] = useState<'caja' | 'descuadres'>('caja');

  // Estados de Datos
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productosBD, setProductosBD] = useState<any[]>([]);
  const [registrosCaja, setRegistrosCaja] = useState<any[]>([]);
  const [inventarioMovimientos, setInventarioMovimientos] = useState<any[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [editandoProveedor, setEditandoProveedor] = useState<{ [nombre: string]: string }>({});

  // Acordeones internos
  const [acordeonesCompras, setAcordeonesCompras] = useState<{ [key: string]: boolean }>({});
  const [acordeonesDespachos, setAcordeonesDespachos] = useState<{ [key: string]: boolean }>({});
  const [acordeonesCierres, setAcordeonesCierres] = useState<{ [key: string]: boolean }>({ global: true });
  const [acordeonesDescuadres, setAcordeonesDescuadres] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    cargarDatosAdmin();
  }, [fechaSeleccionada]);

  async function cargarDatosAdmin() {
    setCargando(true);
    try {
      const inicioDia = `${fechaSeleccionada}T00:00:00`;
      const finDia = `${fechaSeleccionada}T23:59:59`;

      // Calcular fecha de ayer para auditoría de descuadres
      const fechaObj = new Date(fechaSeleccionada + 'T00:00:00');
      fechaObj.setDate(fechaObj.getDate() - 1);
      const fechaAyerStr = fechaObj.toISOString().split('T')[0];

      // 1. Pedidos
      const { data: pedidosData } = await supabase
        .from('pedidos_insumos')
        .select('*')
        .gte('fecha', inicioDia)
        .lte('fecha', finDia);

      // 2. Productos
      const { data: prodData } = await supabase
        .from('producto')
        .select('id, nombre, donde_comprar');

      // 3. Cierres de caja (Filtrado por fecha estricta YYYY-MM-DD)
      const { data: cajaDataRaw } = await supabase
        .from('caja')
        .select('*');

      const cajaData = (cajaDataRaw || []).filter(row => row.fecha && String(row.fecha).startsWith(fechaSeleccionada));

      // 4. Inventario diario
      const { data: invData } = await supabase
        .from('inventario_diario')
        .select('*');

      // Filtramos movimientos correspondientes a la fecha seleccionada o al día anterior
      const invDataFiltrado = (invData || []).filter(row => {
        if (!row.fecha) return false;
        const fStr = String(row.fecha);
        return fStr.startsWith(fechaSeleccionada) || fStr.startsWith(fechaAyerStr);
      });

      setPedidos(pedidosData || []);
      setProductosBD(prodData || []);
      setRegistrosCaja(cajaData);
      setInventarioMovimientos(invDataFiltrado);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setCargando(false);
    }
  }

  // --- LOGISTICA ---
  const pedidosPendientesCompra = pedidos.filter(p => p.estado === 'pendiente');
  const pedidosListosParaEntrega = pedidos.filter(p => p.estado === 'comprado');

  const consolidadoCompras = (() => {
    const mapaProveedores: { [prov: string]: { items: any; idsPedidosSet: Set<number> } } = {};
    pedidosPendientesCompra.forEach(p => {
      const jsonItems = { ...(p.pedidos_paletas || {}), ...(p.pedidos_richi || {}), ...(p.pedidos_produccion || {}), ...(p.pedidos_insumos || {}) };
      Object.entries(jsonItems).forEach(([nombreProd, cantidad]) => {
        const cantNum = Number(cantidad) || 0;
        if (cantNum <= 0) return;
        const prodEnBD = productosBD.find(item => String(item.nombre).trim().toLowerCase() === String(nombreProd).trim().toLowerCase());
        const prov = prodEnBD?.donde_comprar && prodEnBD.donde_comprar.trim() !== '' ? prodEnBD.donde_comprar : '⚠️ Faltan datos de dónde comprar';

        if (!mapaProveedores[prov]) mapaProveedores[prov] = { items: {}, idsPedidosSet: new Set() };
        mapaProveedores[prov].idsPedidosSet.add(p.id);
        if (!mapaProveedores[prov].items[nombreProd]) mapaProveedores[prov].items[nombreProd] = { cantidad: 0, idProd: prodEnBD?.id };
        mapaProveedores[prov].items[nombreProd].cantidad += cantNum;
      });
    });
    return mapaProveedores;
  })();

  const despachosPorSede = (() => {
    const mapaSedes: { [sede: string]: { productos: any; idsPedidos: number[] } } = {};
    pedidosListosParaEntrega.forEach(p => {
      const nombreSede = p.sede_id === 1 ? 'Sede Martineto' : p.sede_id === 2 ? 'Sede Centro' : p.sede_id === 3 ? 'Sede Viva' : 'Sede Ositos';
      if (sedeSeleccionada !== 'todos' && String(p.sede_id) !== sedeSeleccionada) return;
      if (!mapaSedes[nombreSede]) mapaSedes[nombreSede] = { productos: {}, idsPedidos: [] };
      if (!mapaSedes[nombreSede].idsPedidos.includes(p.id)) mapaSedes[nombreSede].idsPedidos.push(p.id);

      const jsonItems = { ...(p.pedidos_paletas || {}), ...(p.pedidos_richi || {}), ...(p.pedidos_produccion || {}), ...(p.pedidos_insumos || {}) };
      Object.entries(jsonItems).forEach(([k, v]) => {
        const cant = Number(v) || 0;
        if (cant > 0) mapaSedes[nombreSede].productos[k] = (mapaSedes[nombreSede].productos[k] || 0) + cant;
      });
    });
    return mapaSedes;
  })();

  // --- CIERRES DE CAJA ---
  const CierreGlobal = registrosCaja.reduce((acc, row) => {
    const efec = Number(row.efectivo_cierre) || 0;
    const neq = Number(row.nequi) || 0;
    const dav = Number(row.daviplata) || 0;
    const gas = Number(row.monto_gasto) || 0;
    return {
      efectivo: acc.efectivo + efec,
      nequi: acc.nequi + neq,
      daviplata: acc.daviplata + dav,
      gastos: acc.gastos + gas,
      totalVenta: acc.totalVenta + (efec + neq + dav)
    };
  }, { efectivo: 0, nequi: 0, daviplata: 0, gastos: 0, totalVenta: 0 });

  const cierresPorSede = (() => {
    const mapa: { [sede: string]: any } = {};
    registrosCaja.forEach(row => {
      const nombreSede = row.sede_id === 1 ? 'Sede Martineto' : row.sede_id === 2 ? 'Sede Centro' : row.sede_id === 3 ? 'Sede Viva' : 'Sede Ositos';
      if (sedeSeleccionada !== 'todos' && String(row.sede_id) !== sedeSeleccionada) return;

      const efec = Number(row.efectivo_cierre) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      const gas = Number(row.monto_gasto) || 0;

      if (!mapa[nombreSede]) {
        mapa[nombreSede] = {
          efectivo: 0,
          nequi: 0,
          daviplata: 0,
          gastos: 0,
          totalVenta: 0,
          motivosGastos: [],
          estado: row.estado || 'abierta'
        };
      }

      mapa[nombreSede].efectivo += efec;
      mapa[nombreSede].nequi += neq;
      mapa[nombreSede].daviplata += dav;
      mapa[nombreSede].gastos += gas;
      mapa[nombreSede].totalVenta += (efec + neq + dav);
      if (row.motivo_gasto) mapa[nombreSede].motivosGastos.push(row.motivo_gasto);
    });
    return mapa;
  })();

  // --- CONSULTA DE DESCUADRES (Cierre de Ayer vs Apertura de Hoy) ---
  const auditoriaDescuadres = (() => {
    const fechaObj = new Date(fechaSeleccionada + 'T00:00:00');
    fechaObj.setDate(fechaObj.getDate() - 1);
    const fechaAyerStr = fechaObj.toISOString().split('T')[0];

    const mapaSedDescuadres: { [sedeName: string]: { diferencias: { producto: string; cierreAyer: number; aperturaHoy: number; dif: number }[]; sedeId: number } } = {};

    const sedesIds = [1, 2, 3, 4];
    sedesIds.forEach(idSede => {
      const nombreSede = idSede === 1 ? 'Sede Martineto' : idSede === 2 ? 'Sede Centro' : idSede === 3 ? 'Sede Viva' : 'Sede Ositos';
      if (sedeSeleccionada !== 'todos' && String(idSede) !== sedeSeleccionada) return;

      // Cierre de ayer por coincidencia exacta de YYYY-MM-DD
      const registroCierreAyer = inventarioMovimientos.find(m => 
        Number(m.sede_id) === idSede && 
        String(m.tipo_movimiento || '').toLowerCase().includes('cierre') && 
        m.fecha && String(m.fecha).startsWith(fechaAyerStr)
      );

      // Apertura de hoy por coincidencia exacta de YYYY-MM-DD
      const registroAperturaHoy = inventarioMovimientos.find(m => 
        Number(m.sede_id) === idSede && 
        String(m.tipo_movimiento || '').toLowerCase().includes('apertura') && 
        m.fecha && String(m.fecha).startsWith(fechaSeleccionada)
      );

      const jsonCierreAyer = registroCierreAyer?.inventario_json || registroCierreAyer?.datos_json || {};
      const jsonAperturaHoy = registroAperturaHoy?.inventario_json || registroAperturaHoy?.datos_json || {};

      const todosProductosSet = new Set([...Object.keys(jsonCierreAyer), ...Object.keys(jsonAperturaHoy)]);
      const diferenciasLista: { producto: string; cierreAyer: number; aperturaHoy: number; dif: number }[] = [];

      todosProductosSet.forEach(prodName => {
        const valCierre = Number(jsonCierreAyer[prodName]) || 0;
        const valApertura = Number(jsonAperturaHoy[prodName]) || 0;
        const dif = valApertura - valCierre;

        diferenciasLista.push({
          producto: prodName,
          cierreAyer: valCierre,
          aperturaHoy: valApertura,
          dif: dif
        });
      });

      if (diferenciasLista.length > 0) {
        mapaSedDescuadres[nombreSede] = {
          sedeId: idSede,
          diferencias: diferenciasLista
        };
      }
    });

    return mapaSedDescuadres;
  })();

  // --- ACCIONES ---
  async function guardarProveedorInteligente(nombreProducto: string, idProd?: number) {
    const nuevoProv = editandoProveedor[nombreProducto];
    if (!nuevoProv || !nuevoProv.trim()) { alert('⚠️ Escribe el lugar de compra.'); return; }
    if (idProd) {
      await supabase.from('producto').update({ donde_comprar: nuevoProv.trim() }).eq('id', idProd);
    } else {
      await supabase.from('producto').insert([{ nombre: nombreProducto, donde_comprar: nuevoProv.trim(), categoria: 'General', activo: true, sede_id: 0 }]);
    }
    alert(`✅ Guardado: ${nuevoProv}`);
    cargarDatosAdmin();
  }

  async function marcarProveedorComoComprado(idsPedidosSet: Set<number>) {
    const ids = Array.from(idsPedidosSet);
    if (ids.length === 0) return;
    if (!confirm('¿Has comprado ya estos insumos? Pasarán a Despachos.')) return;
    await supabase.from('pedidos_insumos').update({ estado: 'comprado' }).in('id', ids);
    cargarDatosAdmin();
  }

  async function marcarPedidosComoEntregados(idsPedidos: number[]) {
    if (!confirm('¿Deseas marcar el pedido como ENTREGADO?')) return;
    await supabase.from('pedidos_insumos').update({ estado: 'entregado' }).in('id', idsPedidos);
    cargarDatosAdmin();
  }

  const toggleModulo = (id: string) => {
    setModuloAbierto(prev => prev === id ? null : id);
  };

  return (
    <main className="min-h-screen bg-[#004e8c] text-white p-3 font-sans max-w-md mx-auto space-y-4 pb-20">
      
      {/* HEADER */}
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-sm font-black text-white">🛡️ ADMIN CENTRAL</h1>
          <p className="text-[10px] text-sky-200">Panel de Control General</p>
        </div>
        <button onClick={() => router.back()} className="bg-[#031d35] hover:bg-[#003d6d] px-3 py-1.5 rounded-xl text-xs font-bold border border-[#0066b3] cursor-pointer">Volver</button>
      </header>

      {/* CALENDARIO GENERAL */}
      <div className="bg-[#0b2b48] border border-[#0066b3] p-3 rounded-2xl shadow-md">
        <label className="text-[10px] font-extrabold text-sky-300 uppercase block mb-1">📅 Fecha de Consulta:</label>
        <input type="date" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-3 rounded-xl text-xs outline-none" />
      </div>

      {cargando ? <div className="text-center py-10 text-xs font-bold text-sky-200">Cargando datos...</div> : (
        <div className="space-y-3">

          {/* MÓDULO 1: GESTIÓN LOGÍSTICA */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('logistica')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-amber-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'logistica' ? '▼' : '▶'}</span> 🚚 1. GESTIÓN LOGÍSTICA E INSUMOS
              </span>
              <span className="bg-[#031d35] text-sky-200 text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                {pedidosPendientesCompra.length + pedidosListosParaEntrega.length} activos
              </span>
            </button>

            {moduloAbierto === 'logistica' && (
              <div className="p-3 pt-0 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button onClick={() => setSubPestanaLogistica('compras')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaLogistica === 'compras' ? 'bg-[#0078d4] border-[#00a4ef]' : 'bg-[#0b2b48] border-[#0066b3]'}`}>🛒 Por Comprar</button>
                  <button onClick={() => setSubPestanaLogistica('despachos')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaLogistica === 'despachos' ? 'bg-[#0078d4] border-[#00a4ef]' : 'bg-[#0b2b48] border-[#0066b3]'}`}>🚚 Por Entregar</button>
                </div>

                {subPestanaLogistica === 'compras' && (
                  Object.keys(consolidadoCompras).length === 0 ? (
                    <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay compras pendientes.</p>
                  ) : (
                    Object.entries(consolidadoCompras).map(([proveedor, dataProv]) => {
                      const abierto = !!acordeonesCompras[proveedor];
                      const esAlerta = proveedor.includes('Faltan datos');
                      const itemsArray = Object.entries(dataProv.items);

                      return (
                        <div key={proveedor} className={`border rounded-xl overflow-hidden shadow-sm ${esAlerta ? 'border-rose-500 bg-rose-950/20' : 'border-[#0066b3] bg-[#0b2b48]'}`}>
                          <button onClick={() => setAcordeonesCompras(prev => ({ ...prev, [proveedor]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold uppercase text-amber-300">
                            <span>{abierto ? '▼' : '▶'} {proveedor}</span>
                            <span className="text-[10px] bg-[#031d35] px-2 py-0.5 rounded">{itemsArray.length} ítems</span>
                          </button>
                          {abierto && (
                            <div className="p-3 pt-0 space-y-2 border-t border-[#0066b3]/30">
                              <div className="space-y-1.5 pt-2">
                                {itemsArray.map(([nombreProd, info]: any, i) => (
                                  <div key={i} className="bg-[#031d35] p-2.5 rounded-lg border border-[#0066b3]/50 flex justify-between items-center text-xs">
                                    <div>
                                      <p className="font-semibold text-white">{nombreProd}</p>
                                      {esAlerta && (
                                        <div className="flex gap-1 mt-1.5">
                                          <input className="bg-[#0b2b48] border border-rose-500 text-white text-[10px] p-1.5 rounded outline-none w-24" placeholder="Ej. D1" onChange={(e) => setEditandoProveedor({ ...editandoProveedor, [nombreProd]: e.target.value })} />
                                          <button onClick={() => guardarProveedorInteligente(nombreProd, info.idProd)} className="bg-emerald-600 px-2 py-1 rounded text-[10px] font-bold">Guardar</button>
                                        </div>
                                      )}
                                    </div>
                                    <span className="bg-[#0078d4] text-white px-2.5 py-1 rounded font-black text-xs">x{info.cantidad}</span>
                                  </div>
                                ))}
                              </div>
                              {!esAlerta && (
                                <button onClick={() => marcarProveedorComoComprado(dataProv.idsPedidosSet)} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-lg text-xs uppercase">
                                  ✓ Marcar Comprado
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                )}

                {subPestanaLogistica === 'despachos' && (
                  <div className="space-y-2">
                    <select value={sedeSeleccionada} onChange={(e) => setSedeSeleccionada(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white font-bold text-xs p-2 rounded-lg outline-none">
                      <option value="todos">🌐 Todas las Sedes</option>
                      <option value="1">Sede Martineto</option>
                      <option value="2">Sede Centro</option>
                      <option value="3">Sede Viva</option>
                      <option value="4">Sede Ositos</option>
                    </select>

                    {Object.keys(despachosPorSede).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay despachos listos (comprados).</p>
                    ) : (
                      Object.entries(despachosPorSede).map(([nombreSede, dataSede]) => {
                        const abierto = !!acordeonesDespachos[nombreSede];
                        return (
                          <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden">
                            <button onClick={() => setAcordeonesDespachos(prev => ({ ...prev, [nombreSede]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase">
                              <span>{abierto ? '▼' : '▶'} {nombreSede}</span>
                              <span className="text-[10px] bg-[#031d35] px-2 py-0.5 rounded">{Object.keys(dataSede.productos).length} productos</span>
                            </button>
                            {abierto && (
                              <div className="p-3 pt-0 bg-[#031d35] text-xs space-y-2 border-t border-[#0066b3]/30">
                                <div className="space-y-1 pt-1">
                                  {Object.entries(dataSede.productos).map(([k, v]: any, i) => (
                                    <div key={i} className="flex justify-between border-b border-[#0066b3]/20 py-1 text-white">
                                      <span>{k}</span>
                                      <span className="font-bold text-sky-200">x{v}</span>
                                    </div>
                                  ))}
                                </div>
                                <button onClick={() => marcarPedidosComoEntregados(dataSede.idsPedidos)} className="w-full mt-2 bg-emerald-600 text-white font-black py-2 rounded-lg text-xs uppercase">
                                  🚚 Marcar Entregado
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* MÓDULO 2: AUDITORÍA Y CIERRES DE CAJA / DESCUADRES */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('cierres')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'cierres' ? '▼' : '▶'}</span> 💰 2. CIERRES DE CAJA Y DESCUADRES
              </span>
              <span className="bg-[#031d35] text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                ${(CierreGlobal.totalVenta - CierreGlobal.gastos).toLocaleString()}
              </span>
            </button>

            {moduloAbierto === 'cierres' && (
              <div className="p-3 pt-0 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button onClick={() => setSubPestanaCierres('caja')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaCierres === 'caja' ? 'bg-emerald-700 border-emerald-400 text-white' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}>💵 Cierres de Caja</button>
                  <button onClick={() => setSubPestanaCierres('descuadres')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaCierres === 'descuadres' ? 'bg-emerald-700 border-emerald-400 text-white' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}>🔍 Descuadres</button>
                </div>

                <div className="pt-1">
                  <select value={sedeSeleccionada} onChange={(e) => setSedeSeleccionada(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white font-bold text-xs p-2 rounded-lg outline-none">
                    <option value="todos">🌐 Ver Todas las Sedes (Global)</option>
                    <option value="1">Sede Martineto</option>
                    <option value="2">Sede Centro</option>
                    <option value="3">Sede Viva</option>
                    <option value="4">Sede Ositos</option>
                  </select>
                </div>

                {/* VISTA 1: CIERRES DE CAJA */}
                {subPestanaCierres === 'caja' && (
                  <div className="space-y-3">
                    {sedeSeleccionada === 'todos' ? (
                      <>
                        {/* RESUMEN GLOBAL */}
                        <div className="border border-emerald-500/50 bg-[#0b2b48] rounded-xl overflow-hidden">
                          <button onClick={() => setAcordeonesCierres(prev => ({ ...prev, global: !prev.global }))} className="w-full p-3 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-emerald-950/40">
                            <span>{acordeonesCierres.global ? '▼' : '▶'} CONSOLIDADO GLOBAL</span>
                            <span className="text-white">${CierreGlobal.totalVenta.toLocaleString()}</span>
                          </button>
                          {acordeonesCierres.global && (
                            <div className="p-3 space-y-1.5 bg-[#031d35] text-xs border-t border-emerald-500/30">
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💵 Efectivo:</span><span className="font-bold text-emerald-400">${CierreGlobal.efectivo.toLocaleString()}</span></div>
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📲 Nequi:</span><span className="font-bold text-sky-300">${CierreGlobal.nequi.toLocaleString()}</span></div>
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💳 Daviplata:</span><span className="font-bold text-rose-300">${CierreGlobal.daviplata.toLocaleString()}</span></div>
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📉 Gastos:</span><span className="font-bold text-amber-400">-${CierreGlobal.gastos.toLocaleString()}</span></div>
                              <div className="flex justify-between py-1.5 text-xs font-black border-t border-emerald-400 mt-1 text-white"><span>💰 VENTA NETO GLOBAL:</span><span className="text-emerald-300">${(CierreGlobal.totalVenta - CierreGlobal.gastos).toLocaleString()}</span></div>
                            </div>
                          )}
                        </div>

                        {/* LISTADO POR SEDES */}
                        {Object.keys(cierresPorSede).length === 0 ? (
                          <p className="text-center text-xs text-sky-300 py-6 font-semibold">No se encontraron cierres de caja en esta fecha.</p>
                        ) : (
                          Object.entries(cierresPorSede).map(([nombreSede, dataSede]) => {
                            const abierto = !!acordeonesCierres[nombreSede];
                            return (
                              <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden">
                                <button onClick={() => setAcordeonesCierres(prev => ({ ...prev, [nombreSede]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase">
                                  <span>{abierto ? '▼' : '▶'} {nombreSede}</span>
                                  <span className="text-emerald-300 font-bold">${dataSede.totalVenta.toLocaleString()}</span>
                                </button>
                                {abierto && (
                                  <div className="p-3 space-y-1 bg-[#031d35] text-xs border-t border-[#0066b3]/30">
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💵 Efectivo:</span><span className="font-bold text-emerald-400">${dataSede.efectivo.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📲 Nequi:</span><span className="font-bold text-sky-300">${dataSede.nequi.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💳 Daviplata:</span><span className="font-bold text-rose-300">${dataSede.daviplata.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📉 Gastos:</span><span className="font-bold text-amber-400">-${dataSede.gastos.toLocaleString()}</span></div>
                                    {dataSede.motivosGastos.length > 0 && (
                                      <div className="bg-[#0b2b48] p-2 rounded text-[10px] my-1 border border-amber-500/30">
                                        <span className="text-amber-300 font-bold block">Notas de Gastos:</span>
                                        {dataSede.motivosGastos.map((m: string, idx: number) => <p key={idx} className="text-sky-200">• {m}</p>)}
                                      </div>
                                    )}
                                    <div className="flex justify-between py-1 font-black border-t border-sky-500/40 text-white"><span>💰 VENTA NETO:</span><span className="text-emerald-300">${(dataSede.totalVenta - dataSede.gastos).toLocaleString()}</span></div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </>
                    ) : (
                      /* DESPLIEGUE DIRECTO SI SELECCIONÓ UNA SEDE ESPECÍFICA */
                      (() => {
                        const datosSedeSeleccionada = Object.values(cierresPorSede)[0];

                        if (!datosSedeSeleccionada) {
                          return <p className="text-center text-xs text-sky-300 py-6 font-semibold">No se encontraron cierres de caja para esta sede en esta fecha.</p>;
                        }

                        return (
                          <div className="border border-emerald-500/50 bg-[#031d35] p-3 rounded-xl space-y-1.5 text-xs shadow-md">
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💵 Efectivo:</span><span className="font-bold text-emerald-400">${datosSedeSeleccionada.efectivo.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📲 Nequi:</span><span className="font-bold text-sky-300">${datosSedeSeleccionada.nequi.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💳 Daviplata:</span><span className="font-bold text-rose-300">${datosSedeSeleccionada.daviplata.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📉 Gastos:</span><span className="font-bold text-amber-400">-${datosSedeSeleccionada.gastos.toLocaleString()}</span></div>
                            {datosSedeSeleccionada.motivosGastos.length > 0 && (
                              <div className="bg-[#0b2b48] p-2 rounded text-[10px] my-1 border border-amber-500/30">
                                <span className="text-amber-300 font-bold block">Notas de Gastos:</span>
                                {datosSedeSeleccionada.motivosGastos.map((m: string, idx: number) => <p key={idx} className="text-sky-200">• {m}</p>)}
                              </div>
                            )}
                            <div className="flex justify-between py-1.5 text-xs font-black border-t border-emerald-400 mt-1 text-white"><span>💰 VENTA NETO:</span><span className="text-emerald-300">${(datosSedeSeleccionada.totalVenta - datosSedeSeleccionada.gastos).toLocaleString()}</span></div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* VISTA 2: DESCUADRES */}
                {subPestanaCierres === 'descuadres' && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-sky-200 italic px-1">
                      Comparativa del Cierre del día anterior vs. la Apertura de hoy ({fechaSeleccionada}).
                    </p>

                    {Object.keys(auditoriaDescuadres).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay movimientos registrados para comparar entre ayer y hoy.</p>
                    ) : (
                      Object.entries(auditoriaDescuadres).map(([nombreSede, infoSede]) => {
                        const abierto = !!acordeonesDescuadres[nombreSede];
                        const tieneDescuadre = infoSede.diferencias.some(d => d.dif !== 0);

                        return (
                          <div key={nombreSede} className={`border rounded-xl overflow-hidden ${tieneDescuadre ? 'border-amber-500 bg-[#0b2b48]' : 'border-[#0066b3] bg-[#0b2b48]'}`}>
                            <button onClick={() => setAcordeonesDescuadres(prev => ({ ...prev, [nombreSede]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase">
                              <span className="flex items-center gap-1.5">
                                <span>{abierto ? '▼' : '▶'}</span> {nombreSede}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-black ${tieneDescuadre ? 'bg-amber-950 text-amber-300 border border-amber-500' : 'bg-emerald-950 text-emerald-300'}`}>
                                {tieneDescuadre ? '⚠️ Con Diferencias' : '✅ Cuadrado'}
                              </span>
                            </button>

                            {abierto && (
                              <div className="p-3 pt-0 bg-[#031d35] text-xs space-y-2 border-t border-[#0066b3]/30">
                                <div className="grid grid-cols-4 font-black text-[10px] text-sky-300 border-b border-[#0066b3]/40 pb-1 mt-2">
                                  <span>PRODUCTO</span>
                                  <span className="text-center">CIERRE AYER</span>
                                  <span className="text-center">APERT. HOY</span>
                                  <span className="text-right">DIFERENCIA</span>
                                </div>
                                <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                                  {infoSede.diferencias.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-4 items-center text-[11px] border-b border-[#0066b3]/20 py-1 text-white">
                                      <span className="truncate pr-1">{item.producto}</span>
                                      <span className="text-center text-sky-200">{item.cierreAyer}</span>
                                      <span className="text-center text-cyan-200">{item.aperturaHoy}</span>
                                      <span className={`text-right font-black ${item.dif === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {item.dif > 0 ? `+${item.dif}` : item.dif}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* MÓDULO 3: INVENTARIOS Y STOCK GENERAL */}
          <div className="border border-[#0066b3]/60 bg-[#0b2b48]/60 rounded-2xl p-4 flex justify-between items-center text-xs font-bold text-sky-300 opacity-80">
            <span>📦 3. INVENTARIOS Y STOCK GENERAL</span>
            <span className="bg-[#031d35] text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">Próxima Consulta</span>
          </div>

          {/* MÓDULO 4: NÓMINA Y REGISTRO DE TURNOS */}
          <div className="border border-[#0066b3]/60 bg-[#0b2b48]/60 rounded-2xl p-4 flex justify-between items-center text-xs font-bold text-sky-300 opacity-80">
            <span>👥 4. NÓMINA Y REGISTRO DE TURNOS</span>
            <span className="bg-[#031d35] text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">Próxima Consulta</span>
          </div>

        </div>
      )}

    </main>
  );
}