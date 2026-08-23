'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const LUGARES_COMPRA_INICIALES = [
  'Avicampo',
  'Carnaval del Dulce',
  'Chispazo',
  'D1',
  'Flesman',
  'Makro',
  'Plaza de Mercado',
  'Plasticos Richi',
];

type CategoriaPedidoTab = 'richi' | 'insumos' | 'aseo';

export default function ModuloProduccionPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);
  
  // PRODUCCIÓN
  const [productosProduccion, setProductosProduccion] = useState<any[]>([]);
  const [gruposDisponibles, setGruposDisponibles] = useState<string[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>('TODOS');
  const [cantidadesFabricadas, setCantidadesFabricadas] = useState<{ [id: string]: number | '' }>({});
  const [observacionProduccion, setObservacionProduccion] = useState<string>('');
  
  // PEDIDOS A BODEGA (Sede 11, Usuario 11)
  const [productosInsumosBD, setProductosInsumosBD] = useState<any[]>([]);
  const [mostrarPedidos, setMostrarPedidos] = useState(false);
  const [tabPedido, setTabPedido] = useState<CategoriaPedidoTab>('richi');
  const [pedidosCategorias, setPedidosCategorias] = useState<{
    richi: { [key: string]: number };
    insumos: { [key: string]: number };
    aseo: { [key: string]: number };
  }>({
    richi: {},
    insumos: {},
    aseo: {},
  });
  const [observacionPedido, setObservacionPedido] = useState<string>('');

  // MODAL CREAR NUEVO PRODUCTO
  const [mostrarModalNuevoProd, setMostrarModalNuevoProd] = useState(false);
  const [nuevoProdNombre, setNuevoProdNombre] = useState('');
  const [nuevoProdCategoria, setNuevoProdCategoria] = useState('Richi');
  const [nuevoProdGrupo, setNuevoProdGrupo] = useState('');
  const [nuevoProdDondeComprar, setNuevoProdDondeComprar] = useState('Plaza de Mercado');
  const [dondeComprarPersonalizado, setDondeComprarPersonalizado] = useState('');
  const [esProductoGlobal, setEsProductoGlobal] = useState(true);
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardandoProduccion, setGuardandoProduccion] = useState(false);
  const [errorBD, setErrorBD] = useState<string | null>(null);

  const SEDE_ID_PRODUCCION = 11;
  const USUARIO_ID_PRODUCCION = 11; // Mireya

  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    const sesionLocal = localStorage.getItem('martineto_session');
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }
    setSesion(JSON.parse(sesionLocal));
    cargarDatosIniciales();
  }, [router]);

  async function cargarDatosIniciales() {
    setCargando(true);
    setErrorBD(null);

    try {
      // 1. Cargar productos donde donde_comprar = 'produccion'
      const { data: dataProd, error: errProd } = await supabase
        .from('producto')
        .select('*')
        .ilike('donde_comprar', 'produccion');

      if (errProd) throw new Error(errProd.message);

      if (dataProd) {
        const listaMapeada = dataProd.map((p: any) => {
          const grupoTexto = String(p.grupo || p.Grupo || 'General').trim();
          return {
            ...p,
            id: p.id,
            nombre: p.nombre || p.Nombre || 'Sin Nombre',
            stock: Number(p.stock || 0),
            grupoLimpio: grupoTexto.toLowerCase(),
            grupoMostrar: grupoTexto.toUpperCase(),
          };
        });

        setProductosProduccion(listaMapeada);

        const gruposSet = new Set<string>();
        listaMapeada.forEach((p) => {
          if (p.grupoMostrar) gruposSet.add(p.grupoMostrar);
        });
        setGruposDisponibles(Array.from(gruposSet).sort());
      }

      // 2. Cargar todos los productos para los pedidos de insumos/richi/aseo
      const { data: dataInsumos, error: errInsumos } = await supabase
        .from('producto')
        .select('*')
        .or(`sede_id.eq.${SEDE_ID_PRODUCCION},sede_id.eq.0,sede_id.is.null`);

      if (dataInsumos) {
        setProductosInsumosBD(
          dataInsumos.map((p: any) => ({
            ...p,
            nombre: p.nombre || p.Nombre || '',
            categoriaLimpia: String(p.categoria || p.Categoria || 'general').trim().toLowerCase(),
            grupoLimpio: String(p.grupo || p.Grupo || '').trim().toLowerCase(),
            donde_comprar: p.donde_comprar || '',
          }))
        );
      }
    } catch (e: any) {
      setErrorBD(`Error al cargar datos: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }

  const productosFiltradosProduccion = productosProduccion.filter((p) => {
    if (grupoSeleccionado === 'TODOS') return true;
    return p.grupoMostrar === grupoSeleccionado;
  });

  const insumosFiltradosPedidos = productosInsumosBD.filter((prod) => {
    const cat = String(prod?.categoriaLimpia || '');
    if (tabPedido === 'richi') return cat.includes('richi') || cat.includes('empaque') || cat.includes('plástico');
    if (tabPedido === 'insumos') return cat.includes('insumo') || cat.includes('topping');
    if (tabPedido === 'aseo') return cat.includes('aseo') || cat.includes('limpieza');
    return false;
  });

  const listaLugaresCompraUnica = Array.from(
    new Set([
      ...LUGARES_COMPRA_INICIALES,
      ...productosInsumosBD
        .map((p) => p.donde_comprar)
        .filter((lugar): lugar is string => Boolean(lugar && lugar.trim() !== '')),
    ])
  ).sort();

  async function guardarProduccion() {
    const itemsAProcesar: { id: any; nombre: string; stockActual: number; fabricado: number }[] = [];

    Object.entries(cantidadesFabricadas).forEach(([idProd, cant]) => {
      const num = Number(cant) || 0;
      if (num > 0) {
        const prod = productosProduccion.find((p) => String(p.id) === String(idProd));
        if (prod) {
          itemsAProcesar.push({
            id: prod.id,
            nombre: prod.nombre,
            stockActual: Number(prod.stock || 0),
            fabricado: num,
          });
        }
      }
    });

    if (itemsAProcesar.length === 0) {
      alert('⚠️ Por favor ingresa al menos una cantidad mayor a 0 para registrar la producción.');
      return;
    }

    setGuardandoProduccion(true);

    try {
      for (const item of itemsAProcesar) {
        const nuevoStock = item.stockActual + item.fabricado;
        const { error } = await supabase
          .from('producto')
          .update({ stock: nuevoStock })
          .eq('id', item.id);

        if (error) {
          throw new Error(`No se pudo actualizar el stock de ${item.nombre}: ${error.message}`);
        }
      }

      alert('✅ ¡Producción guardada con éxito! Las unidades se sumaron automáticamente al stock.');
      
      setCantidadesFabricadas({});
      setObservacionProduccion('');
      await cargarDatosIniciales();
    } catch (e: any) {
      alert('❌ Error: ' + e.message);
    } finally {
      setGuardandoProduccion(false);
    }
  }

  async function enviarPedidoBodega() {
    const limpiarCategoria = (catObj: { [key: string]: number }) => {
      const res: { [key: string]: number } = {};
      Object.entries(catObj || {}).forEach(([nom, cant]) => {
        if (typeof cant === 'number' && cant > 0) {
          res[nom] = cant;
        }
      });
      return res;
    };

    const richiLimpias = limpiarCategoria(pedidosCategorias.richi);
    const insumosLimpias = limpiarCategoria(pedidosCategorias.insumos);
    const aseoLimpias = limpiarCategoria(pedidosCategorias.aseo);

    const totalItems =
      Object.keys(richiLimpias).length +
      Object.keys(insumosLimpias).length +
      Object.keys(aseoLimpias).length;

    if (totalItems === 0) {
      alert('⚠️ Por favor ingresa al menos un producto con cantidad mayor a 0 para hacer el pedido.');
      return;
    }

    const payload = {
      sede_id: SEDE_ID_PRODUCCION,
      usuario_id: USUARIO_ID_PRODUCCION,
      estado: 'pendiente',
      observaciones: observacionPedido || '',
      pedidos_paletas: {},
      pedidos_produccion: {},
      pedidos_richi: richiLimpias,
      pedidos_insumos: insumosLimpias,
      pedidos_aseo: aseoLimpias,
    };

    const { error } = await supabase.from('pedidos_insumos').insert([payload]);

    if (!error) {
      alert('🚀 ¡Pedido enviado a bodega con éxito!');
      setPedidosCategorias({ richi: {}, insumos: {}, aseo: {} });
      setObservacionPedido('');
      setMostrarPedidos(false);
    } else {
      alert('❌ Error al enviar el pedido: ' + error.message);
    }
  }

  async function crearNuevoProductoBD() {
    const nombreLimpio = nuevoProdNombre.trim();
    const dondeComprarFinal =
      nuevoProdDondeComprar === 'Otro'
        ? dondeComprarPersonalizado.trim()
        : nuevoProdDondeComprar.trim();

    if (!nombreLimpio) {
      alert('⚠️ El nombre del producto es obligatorio.');
      return;
    }

    if (!dondeComprarFinal) {
      alert('⚠️ Debe especificar el lugar de compra o proveedor.');
      return;
    }

    setGuardandoProducto(true);

    const grupoAInsertar = nuevoProdGrupo.trim() || nuevoProdCategoria;

    const payload = {
      nombre: nombreLimpio,
      categoria: nuevoProdCategoria,
      grupo: grupoAInsertar,
      donde_comprar: dondeComprarFinal,
      stock: 0,
      sede_id: esProductoGlobal ? 0 : SEDE_ID_PRODUCCION,
      activo: true,
    };

    const { data, error } = await supabase.from('producto').insert([payload]).select();

    if (error) {
      alert('❌ Error guardando producto: ' + error.message);
      setGuardandoProducto(false);
      return;
    }

    alert(`✅ ¡Producto "${nombreLimpio}" creado con éxito!`);

    if (data && data.length > 0) {
      const nuevoObj = {
        ...data[0],
        nombre: data[0].nombre,
        stock: Number(data[0].stock || 0),
        categoriaLimpia: String(data[0].categoria || '').trim().toLowerCase(),
        grupoLimpio: String(data[0].grupo || '').trim().toLowerCase(),
        donde_comprar: data[0].donde_comprar || '',
      };
      setProductosInsumosBD((prev) => [...prev, nuevoObj]);
    }

    setNuevoProdNombre('');
    setNuevoProdGrupo('');
    setNuevoProdDondeComprar(LUGARES_COMPRA_INICIALES[0]);
    setDondeComprarPersonalizado('');
    setMostrarModalNuevoProd(false);
    setGuardandoProducto(false);
  }

  function handleKeyDownPedido(e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const siguienteProd = insumosFiltradosPedidos[currentIndex + 1];
      if (siguienteProd) {
        const refKey = `pedido_${siguienteProd.nombre}`;
        const inputElem = inputRefs.current[refKey];
        if (inputElem) {
          inputElem.focus();
          inputElem.select();
        }
      }
    }
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#004e8c] flex items-center justify-center text-xs font-bold text-white font-sans">
        Cargando Módulo de Producción...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#004e8c] text-[#f1f5f9] p-4 font-sans max-w-4xl mx-auto space-y-4">
      {/* HEADER */}
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-base md:text-lg font-black text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block"></span>
            🏭 MÓDULO DE PRODUCCIÓN (Sede Principal)
          </h1>
          <p className="text-xs text-sky-200 mt-1">
            Operario: <b className="text-white">{sesion?.nombre || 'Mireya'}</b> (Sede Producción)
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('martineto_session');
            router.replace('/login');
          }}
          className="bg-rose-950 hover:bg-rose-900 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          🚪 Salir
        </button>
      </header>

      {errorBD && (
        <div className="bg-rose-950 border border-rose-500 p-3 rounded-xl text-xs text-rose-200 font-bold">
          {errorBD}
        </div>
      )}

      {/* REGISTRO DE PRODUCCIÓN */}
      <div className="bg-[#0b2b48] border border-cyan-400/50 p-5 rounded-2xl space-y-4 shadow-md">
        <div className="border-b border-[#0066b3]/50 pb-3">
          <h2 className="text-sm font-black text-cyan-300 uppercase">
            Registro Diario de Fabricación
          </h2>
          <p className="text-xs text-sky-200 mt-1">
            Selecciona el grupo de paletas e ingresa cuántas unidades fabricaste hoy. El sistema actualizará el stock de inmediato.
          </p>
        </div>

        {/* BOTONES DE FILTRADO POR GRUPO */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setGrupoSeleccionado('TODOS')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase cursor-pointer transition-all ${
              grupoSeleccionado === 'TODOS'
                ? 'bg-cyan-500 text-white border-2 border-white'
                : 'bg-[#051829] text-sky-300 border border-[#0066b3]'
            }`}
          >
            🌟 TODOS
          </button>
          {gruposDisponibles.map((grupo) => (
            <button
              key={grupo}
              onClick={() => setGrupoSeleccionado(grupo)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase cursor-pointer transition-all ${
                grupoSeleccionado === grupo
                  ? 'bg-cyan-500 text-white border-2 border-white'
                  : 'bg-[#051829] text-sky-300 border border-[#0066b3]'
              }`}
            >
              🏷️ {grupo}
            </button>
          ))}
        </div>

        {productosFiltradosProduccion.length === 0 ? (
          <div className="text-center py-10 text-sky-300 text-xs italic">
            No hay productos de producción registrados en este grupo.
          </div>
        ) : (
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {productosFiltradosProduccion.map((prod) => (
              <div
                key={prod.id}
                className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center shadow-sm"
              >
                <div>
                  <p className="font-bold text-white text-xs md:text-sm">{prod.nombre}</p>
                  <p className="text-[11px] text-sky-300 mt-0.5">
                    Grupo: <span className="text-cyan-300 uppercase font-bold">{prod.grupoMostrar}</span> | Stock actual:{' '}
                    <span className="text-emerald-400 font-black">{prod.stock}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-cyan-300 font-bold hidden sm:inline">Fabricado hoy:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={cantidadesFabricadas[prod.id] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCantidadesFabricadas({
                        ...cantidadesFabricadas,
                        [prod.id]: val === '' ? '' : Number(val),
                      });
                    }}
                    className="w-24 bg-[#0e385e] text-cyan-200 font-black text-center text-sm rounded-xl p-2.5 outline-none border border-cyan-500/50"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5 pt-2">
          <label className="text-xs text-sky-200 font-bold block">Observaciones de producción (opcional):</label>
          <textarea
            placeholder="Escribe detalles del lote, sabores especiales o novedades..."
            value={observacionProduccion}
            onChange={(e) => setObservacionProduccion(e.target.value)}
            className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-3 rounded-xl outline-none resize-none h-16 font-bold"
          />
        </div>

        <button
          onClick={guardarProduccion}
          disabled={guardandoProduccion || productosProduccion.length === 0}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {guardandoProduccion ? 'Actualizando Stock...' : '✨ Guardar Producción y Actualizar Stock'}
        </button>
      </div>

      {/* SECCIÓN DE PEDIDOS A BODEGA */}
      <div className="bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md">
        <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-3">
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-1.5">
              🚚 Pedidos de Insumos y Materiales
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMostrarModalNuevoProd(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-xl cursor-pointer"
            >
              ➕ Crear Producto
            </button>
            <button
              onClick={() => setMostrarPedidos(!mostrarPedidos)}
              className="bg-[#051829] hover:bg-[#003d6d] text-sky-200 border border-[#0066b3] font-bold text-xs px-3 py-2 rounded-xl cursor-pointer"
            >
              {mostrarPedidos ? 'Ocultar Pedido' : 'Hacer Pedido'}
            </button>
          </div>
        </div>

        {mostrarPedidos && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'richi', label: '📦 Richi' },
                  { id: 'insumos', label: '🥛 Insumos' },
                  { id: 'aseo', label: '🧹 Aseo' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTabPedido(tab.id)}
                  className={`py-2 rounded-xl text-xs font-black uppercase cursor-pointer transition-all ${
                    tabPedido === tab.id
                      ? 'bg-[#00a4ef] text-white border-2 border-white'
                      : 'bg-[#051829] text-sky-300 border border-[#0066b3]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {insumosFiltradosPedidos.length === 0 ? (
                <p className="text-xs text-sky-400 italic text-center py-6">No hay productos disponibles en esta categoría.</p>
              ) : (
                insumosFiltradosPedidos.map((prod, idx) => (
                  <div key={prod.id || prod.nombre} className="flex justify-between items-center bg-[#051829] p-2.5 rounded-xl border border-[#0066b3]">
                    <div>
                      <p className="text-xs text-white font-bold">{prod.nombre}</p>
                      {prod.grupo && <p className="text-[10px] text-sky-300">{prod.grupo}</p>}
                    </div>
                    <input
                      ref={(el) => { inputRefs.current[`pedido_${prod.nombre}`] = el; }}
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={pedidosCategorias[tabPedido]?.[prod.nombre] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPedidosCategorias({
                          ...pedidosCategorias,
                          [tabPedido]: { ...pedidosCategorias[tabPedido], [prod.nombre]: val === '' ? 0 : Number(val) },
                        });
                      }}
                      onKeyDown={(e) => handleKeyDownPedido(e, idx)}
                      className="w-24 bg-[#0e385e] text-sky-200 font-black text-center text-xs rounded-lg p-2 outline-none border border-[#0066b3]"
                    />
                  </div>
                ))
              )}
            </div>

            <textarea
              placeholder="Observaciones adicionales para el pedido..."
              value={observacionPedido}
              onChange={(e) => setObservacionPedido(e.target.value)}
              className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-3 rounded-xl outline-none resize-none h-16 font-bold"
            />

            <button
              onClick={enviarPedidoBodega}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-md"
            >
              🚀 Enviar Pedido a Bodega
            </button>
          </div>
        )}
      </div>

      {/* MODAL CREAR NUEVO PRODUCTO */}
      {mostrarModalNuevoProd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b2b48] border-2 border-emerald-400 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2">
              <h3 className="text-sm font-black text-white uppercase">➕ Crear Nuevo Insumo / Material</h3>
              <button onClick={() => setMostrarModalNuevoProd(false)} className="text-sky-300 hover:text-white font-black text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-sky-200 font-bold block mb-1">Nombre del Producto *:</label>
                <input
                  type="text"
                  placeholder="Ej. Vasos, Servilletas..."
                  value={nuevoProdNombre}
                  onChange={(e) => setNuevoProdNombre(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-sky-200 font-bold block mb-1">Categoría General *:</label>
                <select
                  value={nuevoProdCategoria}
                  onChange={(e) => setNuevoProdCategoria(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none font-bold"
                >
                  <option value="Richi">📦 Richi / Empaque</option>
                  <option value="Insumos">🥛 Insumos / Toppings</option>
                  <option value="Aseo">🧹 Aseo</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-sky-200 font-bold block mb-1">Dónde Comprar *:</label>
                <select
                  value={nuevoProdDondeComprar}
                  onChange={(e) => setNuevoProdDondeComprar(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none cursor-pointer font-bold"
                >
                  {listaLugaresCompraUnica.map((lugar) => (
                    <option key={lugar} value={lugar}>
                      🛒 {lugar}
                    </option>
                  ))}
                  <option value="Otro">✏️ Otro (Escribir nuevo lugar)...</option>
                </select>

                {nuevoProdDondeComprar === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Escribe el nuevo lugar de compra..."
                    value={dondeComprarPersonalizado}
                    onChange={(e) => setDondeComprarPersonalizado(e.target.value)}
                    className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none mt-2 font-bold"
                  />
                )}
              </div>

              <div>
                <label className="text-xs text-sky-200 font-bold block mb-1">Visibilidad / Sede *:</label>
                <select
                  value={esProductoGlobal ? '0' : 'local'}
                  onChange={(e) => setEsProductoGlobal(e.target.value === '0')}
                  className="w-full bg-[#051829] border border-[#0066b3] text-emerald-300 font-black text-xs p-2.5 rounded-xl outline-none cursor-pointer"
                >
                  <option value="0">🌍 Para TODAS las Sedes</option>
                  <option value="local">🏢 Exclusivo de esta Sede</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMostrarModalNuevoProd(false)}
                className="w-1/2 bg-[#051829] hover:bg-[#003d6d] text-sky-200 border border-[#0066b3] font-bold py-2 rounded-xl text-xs uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={crearNuevoProductoBD}
                disabled={guardandoProducto}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs uppercase cursor-pointer shadow-md disabled:opacity-50"
              >
                {guardandoProducto ? 'Guardando...' : '💾 Guardar en BD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}