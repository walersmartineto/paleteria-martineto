'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  registrarBaseCajaMartineto,
  registrarMovimientoMartineto,
} from '@/lib/martinetoQueries';
import { supabase } from '@/lib/supabase';

const LISTA_EMPAQUES_MARTINETO = [
  'Caja Mostac',
  'Muñeco Gold',
  'Muñeco Lego',
  'Vaso Soft',
  'Corralito',
  'Doritos',
  'Frascos Chamoy',
  'Vaso Gomita Enchilada',
  'Vaso 12 onzas',
];

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

const formatearMoneda = (val: number | string): string => {
  if (val === '' || val === null || val === undefined) return '';
  const num = typeof val === 'string' ? Number(val.replace(/\D/g, '')) : val;
  if (isNaN(num) || num === 0) return '';
  return `$ ${num.toLocaleString('es-CO')}`;
};

const desformatearMoneda = (val: string): number | '' => {
  const soloNumeros = val.replace(/\D/g, '');
  return soloNumeros === '' ? '' : Number(soloNumeros);
};

type CategoriaTab = 'paletas' | 'richi' | 'produccion' | 'insumos' | 'aseo';

export default function MartinetoPOSPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);

  const [baseCaja, setBaseCaja] = useState<number | ''>('');
  const [baseGuardada, setBaseGuardada] = useState(false);
  const [aperturaRealizada, setAperturaRealizada] = useState(false);

  const [tipoMovimiento, setTipoMovimiento] = useState<string>('apertura');
  const [totalPaletasInventario, setTotalPaletasInventario] = useState<number | ''>('');
  const [cantidadesInventario, setCantidadesInventario] = useState<{ [item: string]: number | '' }>({});
  const [observacionesInventario, setObservacionesInventario] = useState<string>('');

  // MESAS Y VENTAS
  const [mesas, setMesas] = useState<any[]>([]);
  const [mesaActivaId, setMesaActivaId] = useState<any | null>(null);
  const [productosVenta, setProductosVenta] = useState<any[]>([]);
  const [listaCategoriasVenta, setListaCategoriasVenta] = useState<string[]>([]);
  const [categoriaVentaSel, setCategoriaVentaSel] = useState<string>('TODAS');
  const [errorLecturaBD, setErrorLecturaBD] = useState<string | null>(null);

  // RAPPI ACTIVOS
  const [pedidosRappi, setPedidosRappi] = useState<any[]>([]);

  // MODAL DE COBRO / PAGO MIXTO
  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState<number | ''>('');
  const [pagoNequi, setPagoNequi] = useState<number | ''>('');
  const [pagoDaviplata, setPagoDaviplata] = useState<number | ''>('');
  const [procesandoPago, setProcesandoPago] = useState(false);

  // REQUISICIONES / PEDIDOS A BODEGA (DESDE TABLA "producto")
  const [productosInsumosBD, setProductosInsumosBD] = useState<any[]>([]);
  const [mostrarPedidos, setMostrarPedidos] = useState(false);
  const [tabPedido, setTabPedido] = useState<CategoriaTab>('paletas');

  const [pedidosCategorias, setPedidosCategorias] = useState<{
    paletas: { [key: string]: number };
    richi: { [key: string]: number };
    produccion: { [key: string]: number };
    insumos: { [key: string]: number };
    aseo: { [key: string]: number };
  }>({
    paletas: {},
    richi: {},
    produccion: {},
    insumos: {},
    aseo: {},
  });

  const [observacionPedido, setObservacionPedido] = useState<string>('');

  // MODAL CREAR NUEVO PRODUCTO EN BD
  const [mostrarModalNuevoProd, setMostrarModalNuevoProd] = useState(false);
  const [nuevoProdNombre, setNuevoProdNombre] = useState('');
  const [nuevoProdCategoria, setNuevoProdCategoria] = useState('Paleta');
  const [nuevoProdGrupo, setNuevoProdGrupo] = useState('');
  const [nuevoProdDondeComprar, setNuevoProdDondeComprar] = useState('Plaza de Mercado');
  const [dondeComprarPersonalizado, setDondeComprarPersonalizado] = useState('');
  const [esProductoGlobal, setEsProductoGlobal] = useState(true);
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  // NÓMINA
  const [tipoDia, setTipoDia] = useState<string>('entre_semana');
  const [horasDia, setHorasDia] = useState<number | ''>('');
  const [horasNoche, setHorasNoche] = useState<number | ''>('');
  const [totalNomina, setTotalNomina] = useState<number>(18000);

  const [cargando, setCargando] = useState(true);
  const SEDE_ID_MARTINETO = 1;

  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const bloqueadoPorApertura = !baseGuardada || !aperturaRealizada;

  const listaLugaresCompraUnica = Array.from(
    new Set([
      ...LUGARES_COMPRA_INICIALES,
      ...productosInsumosBD
        .map((p) => p.donde_comprar)
        .filter((lugar): lugar is string => Boolean(lugar && lugar.trim() !== '')),
    ])
  ).sort();

  useEffect(() => {
    const sesionLocal = localStorage.getItem('martineto_session');
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }
    const ses = JSON.parse(sesionLocal);
    setSesion(ses);
    cargarInicial();
  }, [router]);

  async function cargarInicial() {
    setCargando(true);
    setErrorLecturaBD(null);

    try {
      // 1. Cargar Mesas
      const mesasRes = await supabase
        .from('mesa')
        .select('*')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .order('id', { ascending: true });

      let listaMesas = mesasRes.data || [];
      if (listaMesas.length === 0) {
        listaMesas = [
          { id: 101, nombre: 'Mesa 1', estado: 'Libre', sede_id: SEDE_ID_MARTINETO },
          { id: 102, nombre: 'Mesa 2', estado: 'Libre', sede_id: SEDE_ID_MARTINETO },
          { id: 103, nombre: 'Mesa 3', estado: 'Libre', sede_id: SEDE_ID_MARTINETO },
          { id: 104, nombre: 'Mesa 4', estado: 'Libre', sede_id: SEDE_ID_MARTINETO },
          { id: 105, nombre: 'Mesa 5', estado: 'Libre', sede_id: SEDE_ID_MARTINETO },
          { id: 106, nombre: 'Corredor 1', estado: 'Libre', sede_id: SEDE_ID_MARTINETO },
          { id: 107, nombre: 'Corredor 2', estado: 'Libre', sede_id: SEDE_ID_MARTINETO },
        ];
      }

      setMesas(
        listaMesas.map((m: any) => ({
          ...m,
          items: [],
          total: 0,
          estado: 'Libre',
        }))
      );

      // 2. Cargar Productos de Venta POS
      const { data: prodsVentaBD, error: errVenta } = await supabase
        .from('produc_ven_martineto')
        .select('*');

      if (errVenta) {
        setErrorLecturaBD(`Error BD: ${errVenta.message}`);
      }

      if (prodsVentaBD && prodsVentaBD.length > 0) {
        const prodsVentaLimpios = prodsVentaBD.map((p: any) => {
          const catTexto = String(p.categoria || p.Categoria || p.CATEGORIA || 'General').trim();
          return {
            ...p,
            id: p.id,
            nombre: p.nombre || p.Nombre || 'Sin Nombre',
            precio: Number(p.precio || p.Precio || 0),
            categoriaLimpia: catTexto.toLowerCase(),
            categoriaMostrar: catTexto.toUpperCase(),
          };
        });

        setProductosVenta(prodsVentaLimpios);

        const catsSet = new Set<string>();
        prodsVentaLimpios.forEach((p) => {
          if (p.categoriaMostrar) catsSet.add(p.categoriaMostrar);
        });

        setListaCategoriasVenta(Array.from(catsSet));
        setCategoriaVentaSel('TODAS');
      } else {
        setErrorLecturaBD('La tabla produc_ven_martineto no devolvió registros.');
      }

      // 3. Cargar Insumos desde "producto"
      const { data: prodsInsumosBD } = await supabase
        .from('producto')
        .select('*')
        .or(`sede_id.eq.${SEDE_ID_MARTINETO},sede_id.eq.0,sede_id.is.null`);

      if (prodsInsumosBD) {
        setProductosInsumosBD(
          prodsInsumosBD.map((p: any) => ({
            ...p,
            nombre: p.nombre || p.Nombre || '',
            categoriaLimpia: String(p.categoria || p.Categoria || 'general').trim().toLowerCase(),
            grupoLimpio: String(p.grupo || p.Grupo || '').trim().toLowerCase(),
            donde_comprar: p.donde_comprar || '',
          }))
        );
      }
    } catch (e: any) {
      setErrorLecturaBD(`Excepción: ${e.message || 'Error de conexión'}`);
    } finally {
      setCargando(false);
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

    const grupoAInsertar =
      nuevoProdCategoria === 'Paleta'
        ? nuevoProdGrupo.trim() || 'Paleta'
        : nuevoProdCategoria;

    const payload = {
      nombre: nombreLimpio,
      categoria: nuevoProdCategoria,
      grupo: grupoAInsertar,
      donde_comprar: dondeComprarFinal,
      sede_id: esProductoGlobal ? 0 : SEDE_ID_MARTINETO,
      activo: true,
    };

    const { data, error } = await supabase.from('producto').insert([payload]).select();

    if (error) {
      alert('Error guardando en la base de datos: ' + error.message);
      setGuardandoProducto(false);
      return;
    }

    alert(`✅ ¡Producto "${nombreLimpio}" creado con éxito!`);

    if (data && data.length > 0) {
      const nuevoObj = {
        ...data[0],
        nombre: data[0].nombre,
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

  const esRappiActivo = typeof mesaActivaId === 'string' && mesaActivaId.startsWith('rappi_');
  const mesaActiva = !esRappiActivo ? mesas.find((m) => m.id === mesaActivaId) || null : null;
  const rappiActivo = esRappiActivo ? pedidosRappi.find((r) => r.id === mesaActivaId) || null : null;
  const itemActivoActual = esRappiActivo ? rappiActivo : mesaActiva;

  const productosFiltradosVenta = productosVenta.filter((p) => {
    if (!categoriaVentaSel || categoriaVentaSel === 'TODAS') return true;
    return p.categoriaLimpia === categoriaVentaSel.toLowerCase();
  });

  const insumosFiltrados = productosInsumosBD.filter((prod) => {
    const cat = String(prod?.categoriaLimpia || '');

    if (tabPedido === 'paletas') return cat.includes('paleta');
    if (tabPedido === 'richi') return cat.includes('richi') || cat.includes('empaque') || cat.includes('plástico');
    if (tabPedido === 'produccion') return cat.includes('produccion') || cat.includes('prod');
    if (tabPedido === 'insumos') return cat.includes('insumo') || cat.includes('topping');
    if (tabPedido === 'aseo') return cat.includes('aseo') || cat.includes('limpieza');

    return true;
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number, keysList: string[]) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextKey = keysList[currentIndex + 1];
      if (nextKey && inputRefs.current?.[nextKey]) {
        inputRefs.current[nextKey]?.focus();
        inputRefs.current[nextKey]?.select();
      }
    }
  }

  async function handleGuardarBase() {
    const monto = baseCaja === '' ? 0 : Number(baseCaja);
    const usuarioId = sesion?.usuario_id || sesion?.id;
    const exito = await registrarBaseCajaMartineto(SEDE_ID_MARTINETO, usuarioId, monto, sesion?.turno_id);
    if (exito) {
      setBaseGuardada(true);
      alert('¡Base inicial guardada correctamente!');
    } else {
      alert('Error al guardar la base.');
    }
  }

  async function handleGuardarInventario() {
    if (!baseGuardada) {
      alert('⚠️ Primero guarda la Base de Caja.');
      return;
    }
    const usuarioId = sesion?.usuario_id || sesion?.id;

    const detalleEmpaquesLimpio: { [key: string]: number } = {};
    Object.keys(cantidadesInventario).forEach((key) => {
      const val = cantidadesInventario[key];
      if (val !== '' && val !== null && val !== undefined) {
        detalleEmpaquesLimpio[key] = Number(val);
      }
    });

    const exito = await registrarMovimientoMartineto(
      SEDE_ID_MARTINETO,
      usuarioId,
      tipoMovimiento,
      Number(totalPaletasInventario) || 0,
      {},
      detalleEmpaquesLimpio,
      observacionesInventario,
      sesion?.turno_id
    );

    if (exito) {
      alert(`¡${tipoMovimiento.toUpperCase()} registrada con éxito!`);
      if (tipoMovimiento === 'apertura') {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
      }
    } else {
      alert('Error al registrar inventario.');
    }
  }

  async function enviarPedidoBodega() {
    const usuarioId = sesion?.usuario_id || sesion?.id;

    const limpiarCategoria = (catObj: { [key: string]: number }) => {
      const res: { [key: string]: number } = {};
      Object.entries(catObj || {}).forEach(([nom, cant]) => {
        if (typeof cant === 'number' && cant > 0) {
          res[nom] = cant;
        }
      });
      return res;
    };

    const paletasLimpias = limpiarCategoria(pedidosCategorias.paletas);
    const richiLimpias = limpiarCategoria(pedidosCategorias.richi);
    const produccionLimpias = limpiarCategoria(pedidosCategorias.produccion);
    const insumosLimpias = limpiarCategoria(pedidosCategorias.insumos);
    const aseoLimpias = limpiarCategoria(pedidosCategorias.aseo);

    const totalItems =
      Object.keys(paletasLimpias).length +
      Object.keys(richiLimpias).length +
      Object.keys(produccionLimpias).length +
      Object.keys(insumosLimpias).length +
      Object.keys(aseoLimpias).length;

    if (totalItems === 0) {
      alert('⚠️ Por favor ingresa al menos un producto con cantidad mayor a 0.');
      return;
    }

    const payload = {
      sede_id: SEDE_ID_MARTINETO,
      usuario_id: usuarioId,
      estado: 'pendiente',
      observaciones: observacionPedido || '',
      pedidos_paletas: paletasLimpias,
      pedidos_richi: richiLimpias,
      pedidos_produccion: produccionLimpias,
      pedidos_insumos: insumosLimpias,
      pedidos_aseo: aseoLimpias,
    };

    const { error } = await supabase.from('pedidos_insumos').insert([payload]);

    if (!error) {
      alert('¡Pedido enviado a bodega con éxito!');
      setPedidosCategorias({
        paletas: {},
        richi: {},
        produccion: {},
        insumos: {},
        aseo: {},
      });
      setObservacionPedido('');
    } else {
      alert('Error al guardar en la base de datos: ' + error.message);
    }
  }

  function agregarNuevoRappi() {
    const nuevoId = `rappi_${Date.now()}`;
    const numeroRappi = pedidosRappi.length + 1;
    const nuevoPedido = {
      id: nuevoId,
      nombre: `Rappi ${numeroRappi}`,
      estado: 'Preparando',
      items: [],
      total: 0,
    };
    setPedidosRappi((prev) => [...prev, nuevoPedido]);
    setMesaActivaId(nuevoId);
  }

  function moverMesaA(destinoId: number) {
    if (!mesaActiva || mesaActiva.items.length === 0) {
      alert('⚠️ No hay ítems en esta mesa para mover.');
      return;
    }

    const mesaDestino = mesas.find((m) => m.id === destinoId);

    if (!mesaDestino) return;

    if (mesaDestino.estado !== 'Libre') {
      alert(`⚠️ La mesa ${mesaDestino.nombre} ya está ocupada o pagada.`);
      return;
    }

    setMesas((prev) =>
      prev.map((m) => {
        if (m.id === mesaActivaId) {
          return { ...m, items: [], total: 0, estado: 'Libre' };
        }
        if (m.id === destinoId) {
          return {
            ...m,
            items: mesaActiva.items,
            total: mesaActiva.total,
            estado: 'Ocupada',
          };
        }
        return m;
      })
    );

    setMesaActivaId(destinoId);
    alert(`🚚 Pedido trasladado con éxito de ${mesaActiva.nombre} a ${mesaDestino.nombre}.`);
  }

  async function agregarProductoAMesa(producto: any, esParaLlevar: boolean = false) {
    if (!mesaActivaId) {
      alert('⚠️ Selecciona una mesa o un pedido Rappi primero en la columna izquierda.');
      return;
    }

    const nombreProd = (producto.nombre || '').toLowerCase();

    // LÓGICA Vaso 12oz
    const usaVaso12 =
      nombreProd.includes('yogurneto') ||
      nombreProd.includes('malteada') ||
      nombreProd.includes('soda') ||
      nombreProd.includes('jugo') ||
      nombreProd.includes('limonada');

    if (usaVaso12) {
      setCantidadesInventario((prev) => {
        const actual = Number(prev['Vaso 12 onzas']) || 0;
        return { ...prev, 'Vaso 12 onzas': Math.max(0, actual - 1) };
      });
    }

    // LÓGICA Corralito / Waffle
    const usaCorralito = nombreProd.includes('corralito') || nombreProd.includes('waffle');
    if (usaCorralito) {
      const esParaLlevarAuto = esRappiActivo || esParaLlevar;
      const descuentoCorralito = esParaLlevarAuto ? 2 : 1;

      setCantidadesInventario((prev) => {
        const actual = Number(prev['Corralito']) || 0;
        return { ...prev, Corralito: Math.max(0, actual - descuentoCorralito) };
      });
    }

    const precioNumerico = Number(producto.precio || producto.Precio || 0);
    const etiquetaLlevar = esRappiActivo || esParaLlevar ? ' (LLEVAR)' : '';
    const nombreFinalItem = `${producto.nombre}${etiquetaLlevar}`;

    // MANEJO DE ADICIONES MÚLTIPLES EN MESA YA PAGADA
    if (!esRappiActivo && mesaActiva?.estado === 'Pagada') {
      setMesas((prevMesas) =>
        prevMesas.map((m) => {
          if (m.id !== mesaActivaId) return m;

          const existe = m.items.some(
            (i: any) => i.id === producto.id && i.nombre === nombreFinalItem
          );

          let nuevosItems;
          if (existe) {
            nuevosItems = m.items.map((i: any) =>
              i.id === producto.id && i.nombre === nombreFinalItem
                ? { ...i, cantidad: i.cantidad + 1 }
                : i
            );
          } else {
            nuevosItems = [
              ...m.items,
              { ...producto, nombre: nombreFinalItem, precio: precioNumerico, cantidad: 1 },
            ];
          }

          const nuevoTotal = nuevosItems.reduce(
            (acc: number, i: any) => acc + Number(i.precio || 0) * Number(i.cantidad || 0),
            0
          );

          return {
            ...m,
            items: nuevosItems,
            total: nuevoTotal,
            estado: 'Ocupada',
          };
        })
      );
      return;
    }

    // MESA EN CURSO O RAPPI
    if (esRappiActivo) {
      setPedidosRappi((prev) =>
        prev.map((r) => {
          if (r.id !== mesaActivaId) return r;

          const existe = r.items.some(
            (i: any) => i.id === producto.id && i.nombre === nombreFinalItem
          );

          let nuevosItems;
          if (existe) {
            nuevosItems = r.items.map((i: any) =>
              i.id === producto.id && i.nombre === nombreFinalItem
                ? { ...i, cantidad: i.cantidad + 1 }
                : i
            );
          } else {
            nuevosItems = [
              ...r.items,
              { ...producto, nombre: nombreFinalItem, precio: precioNumerico, cantidad: 1 },
            ];
          }

          const nuevoTotal = nuevosItems.reduce(
            (acc: number, i: any) => acc + Number(i.precio || 0) * Number(i.cantidad || 0),
            0
          );

          return { ...r, items: nuevosItems, total: nuevoTotal };
        })
      );
    } else {
      setMesas((prevMesas) =>
        prevMesas.map((m) => {
          if (m.id !== mesaActivaId) return m;

          const existe = m.items.some(
            (i: any) => i.id === producto.id && i.nombre === nombreFinalItem
          );

          let nuevosItems;
          if (existe) {
            nuevosItems = m.items.map((i: any) =>
              i.id === producto.id && i.nombre === nombreFinalItem
                ? { ...i, cantidad: i.cantidad + 1 }
                : i
            );
          } else {
            nuevosItems = [
              ...m.items,
              { ...producto, nombre: nombreFinalItem, precio: precioNumerico, cantidad: 1 },
            ];
          }

          const nuevoTotal = nuevosItems.reduce(
            (acc: number, i: any) => acc + Number(i.precio || 0) * Number(i.cantidad || 0),
            0
          );

          return {
            ...m,
            items: nuevosItems,
            total: nuevoTotal,
            estado: m.estado === 'Libre' ? 'Ocupada' : m.estado,
          };
        })
      );
    }
  }

  async function descontarProductoDeMesa(productoId: number) {
    if (!mesaActivaId) return;

    if (esRappiActivo) {
      setPedidosRappi((prev) =>
        prev.map((r) => {
          if (r.id !== mesaActivaId) return r;
          const itemsActuales = [...r.items];
          const index = itemsActuales.findIndex((i: any) => i.id === productoId);
          if (index >= 0) {
            if (itemsActuales[index].cantidad > 1) {
              itemsActuales[index].cantidad -= 1;
            } else {
              itemsActuales.splice(index, 1);
            }
          }
          const nuevoTotal = itemsActuales.reduce(
            (acc: number, i: any) => acc + Number(i.precio || 0) * Number(i.cantidad || 0),
            0
          );
          return { ...r, items: itemsActuales, total: nuevoTotal };
        })
      );
    } else {
      setMesas((prev) =>
        prev.map((m) => {
          if (m.id === mesaActivaId) {
            const itemsActuales = [...m.items];
            const index = itemsActuales.findIndex((i) => i.id === productoId);
            if (index >= 0) {
              if (itemsActuales[index].cantidad > 1) {
                itemsActuales[index].cantidad -= 1;
              } else {
                itemsActuales.splice(index, 1);
              }
            }
            const nuevoTotal = itemsActuales.reduce(
              (acc: number, i: any) => acc + Number(i.precio || 0) * Number(i.cantidad || 0),
              0
            );
            const nuevoEstado = itemsActuales.length === 0 ? 'Libre' : m.estado;

            return { ...m, items: itemsActuales, total: nuevoTotal, estado: nuevoEstado };
          }
          return m;
        })
      );
    }
  }

  function marcarRappiPreparado() {
    if (!rappiActivo || rappiActivo.items.length === 0) {
      alert('⚠️ El pedido Rappi está vacío.');
      return;
    }
    setPedidosRappi((prev) =>
      prev.map((r) => (r.id === mesaActivaId ? { ...r, estado: 'Preparado' } : r))
    );
    alert('🍳 Pedido marcado como PREPARADO.');
  }

  async function entregarRappi() {
    if (!rappiActivo || rappiActivo.items.length === 0) {
      alert('⚠️ No hay productos en este pedido Rappi.');
      return;
    }

    const usuarioId = sesion?.usuario_id || sesion?.id;

    const payloadVenta = {
      sede_id: SEDE_ID_MARTINETO,
      usuario_id: usuarioId ? String(usuarioId) : null,
      monto_total: rappiActivo.total,
      pago_efectivo: 0,
      pago_nequi: 0,
      pago_daviplata: 0,
      cambio: 0,
      estado: 'rappi',
      items: rappiActivo.items,
    };

    const { error } = await supabase.from('venta').insert([payloadVenta]);

    if (error) {
      alert('Error guardando pedido Rappi en la tabla "venta": ' + error.message);
      return;
    }

    setPedidosRappi((prev) => prev.filter((r) => r.id !== mesaActivaId));
    setMesaActivaId(null);
    alert('🚀 ¡Pedido Rappi entregado y liberado!');
  }

  function marcarEntregado() {
    if (!mesaActiva || mesaActiva.items.length === 0) {
      alert('⚠️ No hay productos en la orden.');
      return;
    }
    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaActivaId ? { ...m, estado: 'Entregado' } : m
      )
    );
    alert('✅ Pedido marcado como Entregado.');
  }

  function abrirModalCobro() {
    if (!mesaActiva || mesaActiva.items.length === 0) {
      alert('⚠️ No hay productos en la orden para cobrar.');
      return;
    }
    setPagoEfectivo(mesaActiva.total);
    setPagoNequi('');
    setPagoDaviplata('');
    setMostrarModalCobro(true);
  }

  async function procesarCobroMesa() {
    if (!mesaActiva) return;

    const efec = Number(pagoEfectivo) || 0;
    const neq = Number(pagoNequi) || 0;
    const dav = Number(pagoDaviplata) || 0;
    const sumaPagos = efec + neq + dav;

    if (sumaPagos < mesaActiva.total) {
      alert(`⚠️ La suma abonada ($ ${sumaPagos.toLocaleString('es-CO')}) es menor al total de la orden.`);
      return;
    }

    setProcesandoPago(true);
    const usuarioId = sesion?.usuario_id || sesion?.id;

    const payloadVenta = {
      sede_id: SEDE_ID_MARTINETO,
      usuario_id: usuarioId ? String(usuarioId) : null,
      monto_total: mesaActiva.total,
      pago_efectivo: efec,
      pago_nequi: neq,
      pago_daviplata: dav,
      cambio: Math.max(0, sumaPagos - mesaActiva.total),
      estado: 'pagado',
      items: mesaActiva.items,
    };

    const { error } = await supabase.from('venta').insert([payloadVenta]);

    if (error) {
      alert('Error registrando la venta: ' + error.message);
      setProcesandoPago(false);
      return;
    }

    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaActivaId
          ? { ...m, estado: 'Pagada' }
          : m
      )
    );

    setProcesandoPago(false);
    setMostrarModalCobro(false);
    alert('✅ ¡Pago registrado con éxito!');
  }

  function liberarMesa() {
    if (!mesaActivaId) return;

    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaActivaId
          ? { ...m, items: [], total: 0, estado: 'Libre' }
          : m
      )
    );
    alert('🧹 Mesa liberada y lista.');
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#004e8c] flex items-center justify-center text-white text-xs font-bold font-sans">
        Cargando Martineto POS...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#004e8c] text-[#f1f5f9] p-4 font-sans max-w-[1600px] mx-auto space-y-4">
      {/* HEADER */}
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-base md:text-lg font-black text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00a4ef] inline-block"></span>
            🍦 MARTINETO POS (Sede Principal)
          </h1>
          <p className="text-xs text-sky-200 mt-1">
            Operador en Turno: <b className="text-white">{sesion?.nombre || 'Iris'}</b> ({sesion?.turno_nombre || 'MAÑANA / APERTURA'})
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('martineto_session');
            router.push('/login');
          }}
          className="bg-[#003d6d] hover:bg-rose-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          🚪 Salir
        </button>
      </header>

      {/* PASO 1: BASE INICIAL */}
      <div className="bg-[#0b2b48] border border-emerald-400/50 p-4 rounded-2xl space-y-2 shadow-md">
        <span className="text-xs md:text-sm font-black text-emerald-300 block">💵 Paso 1: Base Inicial para Empezar el Día (Efectivo en Caja):</span>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Monto en efectivo $"
            value={formatearMoneda(baseCaja)}
            onChange={(e) => setBaseCaja(desformatearMoneda(e.target.value))}
            disabled={baseGuardada}
            className="w-full bg-[#051829] border border-[#0066b3] text-emerald-300 font-black text-sm rounded-xl p-3 outline-none"
          />
          <button
            onClick={handleGuardarBase}
            disabled={baseGuardada}
            className={`font-bold px-6 rounded-xl text-xs ${baseGuardada ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'}`}
          >
            {baseGuardada ? '✓ Base Guardada' : 'Guardar Base'}
          </button>
        </div>
      </div>

      {bloqueadoPorApertura && (
        <div className="bg-amber-950/80 border border-amber-400/60 p-3 rounded-xl text-center text-xs text-amber-200 font-bold">
          ⚠️ ATENCIÓN: Debes registrar la Base y el <b>Conteo de Apertura</b> para habilitar las ventas y operaciones del sistema.
        </div>
      )}

      {/* INVENTARIO Y PEDIDOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* INVENTARIO */}
        <div className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md">
          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
            <h2 className="text-xs md:text-sm font-black text-white flex items-center gap-1.5">🍦 Conteo de Inventario</h2>
            <span className="bg-[#0078d4] text-white font-black text-[10px] px-3 py-1 rounded-full uppercase">{tipoMovimiento}</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-sky-300 font-bold block uppercase">Acción a registrar:</span>
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value)}
              disabled={!aperturaRealizada && baseGuardada}
              className="w-full bg-[#051829] border border-[#0066b3] text-white font-black text-xs rounded-xl p-2.5 outline-none cursor-pointer"
            >
              {!aperturaRealizada && <option value="apertura">👤 1. Conteo de Apertura (Obligatorio)</option>}
              <option value="nuevas">📦 Paletas Nuevas (Ingreso)</option>
              <option value="compras">🛒 Compras Directas</option>
              <option value="debaja">⚠️ De Baja / Mermas</option>
              <option value="cierre">🌙 Conteo de Cierre</option>
            </select>
          </div>

          <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-1">
            <span className="text-xs text-sky-200 font-bold block">CANTIDAD TOTAL PARA [{tipoMovimiento.toUpperCase()}]:</span>
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-white font-black flex items-center gap-1">🍦 Total Paletas:</span>
              <input
                ref={(el) => { inputRefs.current['totalPaletas'] = el; }}
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={totalPaletasInventario}
                onChange={(e) => setTotalPaletasInventario(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                onKeyDown={(e) => handleKeyDown(e, -1, LISTA_EMPAQUES_MARTINETO)}
                className="w-28 bg-[#0e385e] text-sky-200 font-black text-center text-sm rounded-lg p-2 outline-none border border-[#0066b3]"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            <span className="text-xs text-sky-300 font-bold block uppercase">CONTEO DE EMPAQUES Y VASOS:</span>
            {LISTA_EMPAQUES_MARTINETO.map((item, idx) => (
              <div key={item} className="flex justify-between items-center bg-[#051829] p-2 rounded-lg border border-[#0066b3]">
                <span className="text-xs text-white font-bold flex items-center gap-1.5">📦 {item}:</span>
                <input
                  ref={(el) => { inputRefs.current[item] = el; }}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={cantidadesInventario[item] ?? ''}
                  onChange={(e) =>
                    setCantidadesInventario({
                      ...cantidadesInventario,
                      [item]: e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')),
                    })
                  }
                  onKeyDown={(e) => handleKeyDown(e, idx, LISTA_EMPAQUES_MARTINETO)}
                  className="w-24 bg-[#0e385e] text-sky-200 font-black text-center text-xs rounded p-1.5 outline-none border border-[#0066b3]"
                />
              </div>
            ))}
          </div>

          <textarea
            placeholder="Observaciones de inventario..."
            value={observacionesInventario}
            onChange={(e) => setObservacionesInventario(e.target.value)}
            className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2 rounded-xl outline-none resize-none h-14"
          />

          <button
            onClick={handleGuardarInventario}
            disabled={!baseGuardada}
            className="w-full bg-[#0078d4] hover:bg-[#0086e6] text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
          >
            💾 Guardar {tipoMovimiento}
          </button>
        </div>

        {/* PEDIDOS A BODEGA */}
        <div className={`bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
            <h2 className="text-xs md:text-sm font-black text-white flex items-center gap-1.5">🚚 Pedidos de Insumos</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setMostrarModalNuevoProd(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-xl cursor-pointer"
              >
                ➕ Crear Producto
              </button>
              <button
                onClick={() => setMostrarPedidos(!mostrarPedidos)}
                className="bg-[#051829] hover:bg-[#003d6d] text-sky-200 border border-[#0066b3] font-bold text-xs px-3 py-1 rounded-xl cursor-pointer"
              >
                {mostrarPedidos ? 'Ocultar' : 'Hacer Pedido'}
              </button>
            </div>
          </div>
          {mostrarPedidos && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-1">
                {(
                  [
                    { id: 'paletas', label: 'paletas' },
                    { id: 'richi', label: 'richi' },
                    { id: 'produccion', label: 'producción' },
                    { id: 'insumos', label: 'insumos' },
                    { id: 'aseo', label: 'aseo' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTabPedido(tab.id)}
                    className={`py-1 rounded text-[10px] font-black uppercase cursor-pointer ${tabPedido === tab.id ? 'bg-[#00a4ef] text-white' : 'bg-[#051829] text-sky-300 border border-[#0066b3]'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {insumosFiltrados.length === 0 ? (
                  <p className="text-xs text-sky-400 italic text-center py-4">No hay productos disponibles en esta categoría.</p>
                ) : (
                  insumosFiltrados.map((prod) => (
                    <div key={prod.id || prod.nombre} className="flex justify-between items-center bg-[#051829] p-2 rounded-xl border border-[#0066b3]">
                      <div>
                        <p className="text-xs text-white font-bold">{prod.nombre}</p>
                        {prod.grupo && <p className="text-[10px] text-sky-300">{prod.grupo}</p>}
                      </div>
                      <input
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
                        className="w-20 bg-[#0e385e] text-sky-200 font-black text-center text-xs rounded-lg p-1.5 outline-none border border-[#0066b3]"
                      />
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={enviarPedidoBodega}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-md"
              >
                🚀 Enviar Pedido a Bodega
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DISEÑO EN COLUMNAS DINÁMICAS */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-start ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
        
        {/* COLUMNA 1: MESAS Y RAPPI */}
        <div className={`${!mesaActivaId ? 'lg:col-span-12' : itemActivoActual && itemActivoActual.items.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'} bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md transition-all duration-300`}>
          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
            <h2 className="text-xs md:text-sm font-black text-white">🪑 Mesas y Rappi</h2>
            <button
              onClick={agregarNuevoRappi}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase cursor-pointer shadow"
            >
              + Rappi
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
            {pedidosRappi.map((rappi) => {
              const activa = mesaActivaId === rappi.id;
              const estaPreparado = rappi.estado === 'Preparando';

              return (
                <div
                  key={rappi.id}
                  onClick={() => setMesaActivaId(rappi.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center shadow-md ${
                    activa
                      ? 'border-white ring-2 ring-white bg-rose-700'
                      : estaPreparado
                      ? 'bg-amber-700/90 border-amber-400'
                      : 'bg-rose-950/80 border-rose-500 hover:bg-rose-900'
                  }`}
                >
                  <div>
                    <p className="font-black text-xs text-white uppercase">📦 {rappi.nombre}</p>
                    <p className="text-[10px] font-bold text-rose-200 mt-0.5">{rappi.estado}</p>
                  </div>
                  <p className="text-xs text-emerald-300 font-black">$ {rappi.total.toLocaleString('es-CO')}</p>
                </div>
              );
            })}

            {mesas.map((mesa) => {
              const ocupada = mesa.estado === 'Ocupada';
              const entregado = mesa.estado === 'Entregado';
              const pagada = mesa.estado === 'Pagada';
              const activa = mesaActivaId === mesa.id;

              let estiloColor = 'bg-[#051829] border-[#0066b3] hover:border-[#00a4ef]';
              let textoEstadoColor = 'text-sky-300';

              if (activa) {
                estiloColor = 'border-white ring-2 ring-white bg-[#0078d4]';
                textoEstadoColor = 'text-white';
              } else if (pagada) {
                estiloColor = 'bg-purple-900/90 border-purple-500';
                textoEstadoColor = 'text-purple-200';
              } else if (entregado) {
                estiloColor = 'bg-blue-800/90 border-blue-400';
                textoEstadoColor = 'text-blue-200';
              } else if (ocupada) {
                estiloColor = 'bg-amber-800/90 border-amber-500';
                textoEstadoColor = 'text-amber-200';
              }

              return (
                <div
                  key={mesa.id}
                  onClick={() => setMesaActivaId(mesa.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center shadow-md ${estiloColor}`}
                >
                  <div>
                    <p className="font-black text-xs text-white uppercase">{mesa.nombre}</p>
                    <p className={`text-[10px] font-bold capitalize mt-0.5 ${textoEstadoColor}`}>{mesa.estado}</p>
                  </div>
                  <p className="text-xs text-emerald-300 font-black">$ {mesa.total.toLocaleString('es-CO')}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMNA 2: CATEGORÍAS Y PRODUCTOS (SOLO APARECE SI SE SELECCIONA UNA MESA/RAPPI) */}
        {mesaActivaId && (
          <div className={`${itemActivoActual && itemActivoActual.items.length > 0 ? 'lg:col-span-5' : 'lg:col-span-8'} bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md transition-all duration-300`}>
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-xs md:text-sm font-black text-white">📂 Categorías y Productos</h2>
              <span className="text-xs text-sky-200 font-bold">Activo: <b className="text-emerald-300">{itemActivoActual ? itemActivoActual.nombre : 'Ninguno'}</b></span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategoriaVentaSel('TODAS')}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase cursor-pointer transition-all ${categoriaVentaSel === 'TODAS' ? 'bg-[#00a4ef] text-white border border-white' : 'bg-[#0e385e] text-sky-200 border border-[#0066b3]'}`}
              >
                🌟 TODAS
              </button>
              {listaCategoriasVenta.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaVentaSel(cat)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase cursor-pointer transition-all ${categoriaVentaSel.toLowerCase() === cat.toLowerCase() ? 'bg-[#00a4ef] text-white border border-white' : 'bg-[#0e385e] text-sky-200 border border-[#0066b3]'}`}
                >
                  🏷️ {cat}
                </button>
              ))}
            </div>

            <div className="max-h-[420px] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
              {productosFiltradosVenta.length === 0 ? (
                <p className="text-xs text-sky-400 italic col-span-full py-6 text-center">No hay productos en esta categoría.</p>
              ) : (
                productosFiltradosVenta.map((prod) => {
                  const esCorralito = (prod.nombre || '').toLowerCase().includes('corralito') || (prod.nombre || '').toLowerCase().includes('waffle');

                  return (
                    <div key={prod.id || prod.nombre} className="bg-[#0e385e] border border-[#0066b3] p-2.5 rounded-xl flex flex-col justify-between shadow-sm">
                      <div>
                        <p className="font-bold text-white text-xs truncate">{prod.nombre}</p>
                        <p className="text-[10px] text-sky-300 uppercase mt-0.5">{prod.categoriaMostrar}</p>
                        <p className="text-xs text-emerald-300 font-black mt-1">$ {Number(prod.precio || 0).toLocaleString('es-CO')}</p>
                      </div>

                      {esCorralito ? (
                        <div className="grid grid-cols-2 gap-1 mt-2 pt-1 border-t border-[#0066b3]">
                          <button
                            onClick={() => agregarProductoAMesa(prod, false)}
                            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[9px] py-1 rounded text-center cursor-pointer"
                          >
                            🍽️ Mesa
                          </button>
                          <button
                            onClick={() => agregarProductoAMesa(prod, true)}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[9px] py-1 rounded text-center cursor-pointer"
                            title="Usa tapa extra: descuenta 2 del inventario de Corralito"
                          >
                            🛵 Llevar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => agregarProductoAMesa(prod, false)}
                          className="w-full bg-[#0066b3] hover:bg-[#0078d4] text-white font-bold text-[10px] py-1.5 rounded-lg mt-2 cursor-pointer"
                        >
                          ➕ Agregar
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* COLUMNA 3: FACTURA / PEDIDO (SOLO APARECE SI LA MESA ACTIVA TIENE PRODUCTOS) */}
        {itemActivoActual && itemActivoActual.items.length > 0 && (
          <div className="lg:col-span-4 bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md transition-all duration-300">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-xs md:text-sm font-black text-white">🧾 Factura / Pedido</h2>
              <span className="bg-[#051829] text-sky-300 text-[10px] px-2.5 py-1 rounded-lg border border-[#0066b3] uppercase font-bold">
                {esRappiActivo ? rappiActivo?.estado : mesaActiva ? mesaActiva.estado : 'Sin Selección'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="max-h-[240px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs text-white">
                  <thead>
                    <tr className="border-b border-[#0066b3] text-sky-300">
                      <th className="py-1 px-1">Prod</th>
                      <th className="py-1 px-1 text-center">Cant</th>
                      <th className="py-1 px-1 text-right">Total</th>
                      <th className="py-1 px-1 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemActivoActual.items.map((i: any, idx: number) => (
                      <tr key={idx} className="border-b border-[#0066b3]/30">
                        <td className="py-2 px-1 font-bold">{i.nombre}</td>
                        <td className="py-2 px-1 text-center font-black text-sky-200">{i.cantidad}</td>
                        <td className="py-2 px-1 text-right font-black text-emerald-300">$ {(Number(i.precio || 0) * i.cantidad).toLocaleString('es-CO')}</td>
                        <td className="py-2 px-1 text-center">
                          <button
                            onClick={() => descontarProductoDeMesa(i.id)}
                            className="bg-rose-900/80 hover:bg-rose-700 text-white px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                          >
                            ➖
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOVER MESAS */}
              {!esRappiActivo && mesaActiva && mesaActiva.items.length > 0 && (
                <div className="bg-[#051829] p-2.5 rounded-xl border border-[#0066b3] space-y-1">
                  <label className="text-[10px] text-sky-200 font-bold block uppercase">
                    🔄 Cambiar esta cuenta a otra mesa:
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        moverMesaA(Number(e.target.value));
                        e.target.value = '';
                      }
                    }}
                    className="w-full bg-[#0e385e] text-emerald-300 font-bold text-xs p-2 rounded-lg outline-none cursor-pointer border border-[#0066b3]"
                  >
                    <option value="" disabled>
                      -- Seleccionar Mesa Libre --
                    </option>
                    {mesas
                      .filter((m) => m.id !== mesaActivaId && m.estado === 'Libre')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          🪑 Mover a {m.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-black text-white pt-2 border-t border-[#0066b3]">
                <span>Total a Pagar:</span>
                <span className="text-emerald-400 text-base">$ {itemActivoActual.total.toLocaleString('es-CO')}</span>
              </div>

              {esRappiActivo ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {rappiActivo?.estado === 'Preparando' ? (
                    <button
                      onClick={marcarRappiPreparado}
                      className="col-span-2 bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-md"
                    >
                      🍳 Marcar como Preparado
                    </button>
                  ) : (
                    <button
                      onClick={entregarRappi}
                      className="col-span-2 bg-rose-600 hover:bg-rose-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-lg transition-all"
                    >
                      🚀 Entregar Rappi
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {mesaActiva?.estado === 'Pagada' ? (
                    <button
                      onClick={liberarMesa}
                      className="col-span-2 bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-md"
                    >
                      🧹 Liberar Mesa
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={marcarEntregado}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-md"
                        title="Cambia estado a Entregado"
                      >
                        🚀 Entregado
                      </button>
                      <button
                        onClick={abrirModalCobro}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-md"
                      >
                        💳 Pagar
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL CREAR NUEVO PRODUCTO EN SUPABASE */}
      {mostrarModalNuevoProd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b2b48] border-2 border-emerald-400 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2">
              <h3 className="text-sm font-black text-white uppercase">➕ Crear Nuevo Producto / Insumo</h3>
              <button onClick={() => setMostrarModalNuevoProd(false)} className="text-sky-300 hover:text-white font-black text-sm">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-sky-200 font-bold block mb-1">Nombre del Producto *:</label>
                <input
                  type="text"
                  placeholder="Ej. Leche condensada"
                  value={nuevoProdNombre}
                  onChange={(e) => setNuevoProdNombre(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none"
                />
              </div>

              <div className={`grid ${nuevoProdCategoria === 'Paleta' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                <div>
                  <label className="text-xs text-sky-200 font-bold block mb-1">Categoría General *:</label>
                  <select
                    value={nuevoProdCategoria}
                    onChange={(e) => setNuevoProdCategoria(e.target.value)}
                    className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none"
                  >
                    <option value="Paleta">🍦 Paleta</option>
                    <option value="Richi">📦 Richi / Empaque</option>
                    <option value="Produccion">⚙️ Producción</option>
                    <option value="Insumos">BS Insumos / Toppings</option>
                    <option value="Aseo">🧹 Aseo</option>
                  </select>
                </div>

                {nuevoProdCategoria === 'Paleta' && (
                  <div>
                    <label className="text-xs text-sky-200 font-bold block mb-1">Grupo / Tipo Específico:</label>
                    <input
                      type="text"
                      placeholder="Ej. Frutal, Crema, Soft..."
                      value={nuevoProdGrupo}
                      onChange={(e) => setNuevoProdGrupo(e.target.value)}
                      className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-sky-200 font-bold block mb-1">Dónde Comprar *:</label>
                <select
                  value={nuevoProdDondeComprar}
                  onChange={(e) => setNuevoProdDondeComprar(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none cursor-pointer"
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
                    className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none mt-2"
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

      {/* MODAL COBRO MIXTO */}
      {mostrarModalCobro && mesaActiva && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b2b48] border-2 border-[#00a4ef] rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2">
              <h3 className="text-sm font-black text-white uppercase">💳 COBRAR {mesaActiva.nombre}</h3>
              <button onClick={() => setMostrarModalCobro(false)} className="text-sky-300 hover:text-white font-black text-sm">✕</button>
            </div>

            <div className="bg-[#051829] p-3 rounded-xl border border-[#0066b3] text-center space-y-1">
              <span className="text-xs text-sky-200 font-bold block">TOTAL A PAGAR:</span>
              <span className="text-2xl font-black text-emerald-400">$ {mesaActiva.total.toLocaleString('es-CO')}</span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-sky-200 font-bold block mb-1">💵 Efectivo ($):</label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatearMoneda(pagoEfectivo)}
                  onChange={(e) => setPagoEfectivo(desformatearMoneda(e.target.value))}
                  className="w-full bg-[#051829] border border-[#0066b3] text-emerald-300 font-black text-sm p-2 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-sky-200 font-bold block mb-1">💜 Nequi ($):</label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatearMoneda(pagoNequi)}
                  onChange={(e) => setPagoNequi(desformatearMoneda(e.target.value))}
                  className="w-full bg-[#051829] border border-[#0066b3] text-purple-300 font-black text-sm p-2 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-sky-200 font-bold block mb-1">🔴 Daviplata ($):</label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatearMoneda(pagoDaviplata)}
                  onChange={(e) => setPagoDaviplata(desformatearMoneda(e.target.value))}
                  className="w-full bg-[#051829] border border-[#0066b3] text-rose-300 font-black text-sm p-2 rounded-xl outline-none"
                />
              </div>
            </div>

            {(() => {
              const abonado = (Number(pagoEfectivo) || 0) + (Number(pagoNequi) || 0) + (Number(pagoDaviplata) || 0);
              const diferencia = abonado - mesaActiva.total;

              return (
                <div className="bg-[#051829] p-3 rounded-xl border border-[#0066b3] space-y-1">
                  <div className="flex justify-between text-xs font-bold text-white">
                    <span>Total Abonado:</span>
                    <span>$ {abonado.toLocaleString('es-CO')}</span>
                  </div>
                  {diferencia >= 0 ? (
                    <div className="flex justify-between text-xs font-black text-emerald-400">
                      <span>Cambio / Devueltas:</span>
                      <span>$ {diferencia.toLocaleString('es-CO')}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-xs font-black text-rose-400">
                      <span>Falta por Pagar:</span>
                      <span>$ {Math.abs(diferencia).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex gap-2">
              <button
                onClick={() => setMostrarModalCobro(false)}
                className="w-1/2 bg-[#051829] hover:bg-[#003d6d] text-sky-200 border border-[#0066b3] font-bold py-2 rounded-xl text-xs uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={procesarCobroMesa}
                disabled={procesandoPago}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs uppercase cursor-pointer shadow-md disabled:opacity-50"
              >
                {procesandoPago ? 'Procesando...' : '✓ Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN NÓMINA Y TURNO */}
      <div className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md">
        <h2 className="text-xs md:text-sm font-black text-white border-b border-[#0066b3]/50 pb-2">⚙️ Cambio de Turno / Nómina</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div>
            <label className="text-[10px] text-sky-300 font-bold block mb-1">Tipo de Día:</label>
            <select
              value={tipoDia}
              onChange={(e) => setTipoDia(e.target.value)}
              className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2 rounded-xl outline-none"
            >
              <option value="entre_semana">Entre semana (lunes a sábado)</option>
              <option value="festivo">Domingo o Festivo</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-sky-300 font-bold block mb-1">Horas Día:</label>
            <input
              type="text"
              placeholder="0"
              value={horasDia}
              onChange={(e) => setHorasDia(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
              className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2 rounded-xl text-center font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] text-sky-300 font-bold block mb-1">Horas Noche:</label>
            <input
              type="text"
              placeholder="0"
              value={horasNoche}
              onChange={(e) => setHorasNoche(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
              className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2 rounded-xl text-center font-bold"
            />
          </div>
        </div>
        <div className="bg-[#051829] p-3 rounded-xl border border-[#00a4ef] flex justify-between items-center">
          <span className="text-xs font-bold text-white uppercase">Total Nómina:</span>
          <span className="text-sm font-black text-rose-400">$ {totalNomina.toLocaleString('es-CO')}</span>
        </div>
        <button
          onClick={() => alert('Turno registrado y cerrado con éxito.')}
          className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer"
        >
          💾 Registrar Nómina y Cambio de Turno
        </button>
      </div>
    </main>
  );
}