'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAutoSave } from '@/hooks/useAutoSave';

const obtenerFechaHoraColombia = () => {
  const fechaHoraLocal = new Date().toLocaleString("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const [datePart, timePart] = fechaHoraLocal.split(', ');
  const [month, day, year] = datePart.split('/');
  return `${year}-${month}-${day} ${timePart}`;
};

const obtenerFechaCortaColombia = () => {
  const fechaHoraLocal = new Date().toLocaleString("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const [datePart] = fechaHoraLocal.split(', ');
  const [month, day, year] = datePart.split('/');
  return `${year}-${month}-${day}`;
};

const obtenerInicioDiaColombia = () => {
  const fechaHoraLocal = new Date().toLocaleString("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const [datePart] = fechaHoraLocal.split(', ');
  const [month, day, year] = datePart.split('/');
  return `${year}-${month}-${day}T00:00:00`;
};

const formatearMoneda = (val: number | string): string => {
  if (val === '' || val === null || val === undefined) return '';
  const num = typeof val === 'string' ? Number(val.replace(/\D/g, '')) : val;
  if (isNaN(num)) return '';
  return `$ ${num.toLocaleString('es-CO')}`;
};

const desformatearMoneda = (val: string): number | '' => {
  const soloNumeros = String(val).replace(/\D/g, '');
  return soloNumeros === '' ? '' : Number(soloNumeros);
};

type CategoriaTab = 'paletas' | 'richi' | 'produccion' | 'insumos' | 'aseo';
type ModuloPrincipal = 'movimientos' | 'pedidos' | 'gastos' | 'ventas' | 'nomina' | 'cierre';

interface ItemCarrito {
  id: number | string;
  nombre: string;
  precio: number;
  cantidad: number;
  esAdicion?: boolean;
}

interface PedidoRappi {
  id: string;
  codigo: string;
  items: ItemCarrito[];
  fechaHora: string;
}

export default function WalersPOSOperacionPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);
  const [sedeIdActual, setSedeIdActual] = useState<number>(4);
  const [nombreSedeActual, setNombreSedeActual] = useState<string>('Sede Principal');

  const [moduloActivo, setModuloActivo] = useState<ModuloPrincipal>('movimientos');

  // ESTADOS MÓDULO 1
  const [baseCaja, setBaseCaja, limpiarBaseCaja] = useAutoSave<number | ''>('walers_baseCaja', '');
  const [baseGuardada, setBaseGuardada] = useState(false);
  const [guardandoBase, setGuardandoBase] = useState(false);
  const [cajaIdActual, setCajaIdActual] = useState<number | null>(null);
  const [aperturaRealizada, setAperturaRealizada] = useState(false);
  const [cajaDataActual, setCajaDataActual] = useState<any>(null);

  const [empaquesBD, setEmpaquesBD] = useState<any[]>([]);
  const [tipoMovimiento, setTipoMovimiento] = useState<string>('apertura');
  const [totalPaletasInventario, setTotalPaletasInventario, limpiarTotalPaletasInv] = useAutoSave<number | ''>('walers_totalPaletasInv', '');
  const [cantidadesInventario, setCantidadesInventario, limpiarCantidadesInv] = useAutoSave<{ [item: string]: number | '' }>('walers_cantidadesInv', {});
  const [observacionesInventario, setObservacionesInventario, limpiarObsInv] = useAutoSave<string>('walers_obsInv', '');
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);

  // ESTADOS MÓDULO 2 (PEDIDOS)
  const [productosInsumosBD, setProductosInsumosBD] = useState<any[]>([]);
  const [busquedaInsumoPedido, setBusquedaInsumoPedido] = useState<string>('');
  const [historialPedidosBD, setHistorialPedidosBD] = useState<any[]>([]);
  const [tabPedido, setTabPedido] = useState<CategoriaTab>('paletas');
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [eliminandoPedido, setEliminandoPedido] = useState(false);

  const [pedidosCategorias, setPedidosCategorias, limpiarPedidosCat] = useAutoSave<{
    paletas: { [key: string]: number };
    richi: { [key: string]: number };
    produccion: { [key: string]: number };
    insumos: { [key: string]: number };
    aseo: { [key: string]: number };
  }>('walers_pedidosCategorias', {
    paletas: {},
    richi: {},
    produccion: {},
    insumos: {},
    aseo: {},
  });

  const [observacionPedido, setObservacionPedido, limpiarObsPedido] = useAutoSave<string>('walers_obsPedido', '');

  // ESTADOS MÓDULO 3 (GASTOS)
  const [descripcionGasto, setDescripcionGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState<number | ''>('');
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [gastosDiaBD, setGastosDiaBD] = useState<any[]>([]);

  // ESTADOS MÓDULO 4 (VENTAS / RAPPI)
  const [modoVentas, setModoVentas] = useState<'pregunta' | 'pos_propio' | 'externo'>('pregunta');
  const [productosVentaBD, setProductosVentaBD] = useState<any[]>([]);
  const [mesasBD, setMesasBD] = useState<any[]>([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<number | null>(null);
  const [busquedaProductoVenta, setBusquedaProductoVenta] = useState('');
  const [categoriaVentaFiltro, setCategoriaVentaFiltro] = useState<string>('TODAS');

  const [pedidosRappi, setPedidosRappi] = useState<PedidoRappi[]>([]);
  const [rappiSeleccionadoId, setRappiSeleccionadoId] = useState<string | null>(null);
  const [tipoCanalSeleccionado, setTipoCanalSeleccionado] = useState<'mesa' | 'rappi'>('mesa');

  const [carritosPorMesa, setCarritosPorMesa] = useState<{ [mesaId: number]: ItemCarrito[] }>({});
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [valorAdicionInput, setValorAdicionInput] = useState<number | ''>('');

  const [pagoEfectivo, setPagoEfectivo] = useState<number | ''>('');
  const [pagoNequi, setPagoNequi] = useState<number | ''>('');
  const [pagoDaviplata, setPagoDaviplata] = useState<number | ''>('');
  const [pagoOtros, setPagoOtros] = useState<number | ''>('');
  const [detalleOtro, setDetalleOtro] = useState('');
  const [descuentoVenta, setDescuentoVenta] = useState<number | ''>('');
  const [guardandoVenta, setGuardandoVenta] = useState(false);

  const [externoEfectivo, setExternoEfectivo] = useState<number | ''>('');
  const [externoNequi, setExternoNequi] = useState<number | ''>('');
  const [externoDaviplata, setExternoDaviplata] = useState<number | ''>('');
  const [externoRappi, setExternoRappi] = useState<number | ''>('');
  const [externoOtros, setExternoOtros] = useState<number | ''>('');
  const [guardandoExterno, setGuardandoExterno] = useState(false);

  // ESTADOS RESÚMENES DESDE BD
  const [mostrarModalResumenCaja, setMostrarModalResumenCaja] = useState(false);
  const [mostrarModalFacturasPagas, setMostrarModalFacturasPagas] = useState(false);
  const [ventasDiaBD, setVentasDiaBD] = useState<any[]>([]);
  const [cargandoResumenVentas, setCargandoResumenVentas] = useState(false);

  const [mostrarModalNuevoProd, setMostrarModalNuevoProd] = useState(false);
  const [nuevoProdNombre, setNuevoProdNombre] = useState('');
  const [nuevoProdCategoria, setNuevoProdCategoria] = useState('Paleta');
  const [nuevoProdDondeComprar, setNuevoProdDondeComprar] = useState('');
  const [dondeComprarPersonalizado, setDondeComprarPersonalizado] = useState('');
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  // ESTADOS MÓDULO 5 (NÓMINA Y TURNO)
  const [tipoPersonaNomina, setTipoPersonaNomina] = useState<'operador' | 'ayudante'>('operador');
  const [ayudanteSeleccionadoId, setAyudanteSeleccionadoId] = useState<number | string>('');
  const [horasDiaNomina, setHorasDiaNomina] = useState<string>('');
  const [horasNocheNomina, setHorasNocheNomina] = useState<string>('');
  const [montoTotalNomina, setMontoTotalNomina] = useState<number | ''>('');
  const [guardandoNomina, setGuardandoNomina] = useState(false);
  const [nominasDiaBD, setNominasDiaBD] = useState<any[]>([]);

  // ESTADOS MÓDULO 6 (CIERRE)
  const [totalPaletasCierre, setTotalPaletasCierre] = useState<number | ''>('');
  const [cantidadesCierre, setCantidadesCierre] = useState<{ [item: string]: number | '' }>({});
  const [observacionesCierre, setObservacionesCierre] = useState('');
  const [dineroFisicoCierre, setDineroFisicoCierre] = useState<number | ''>('');
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  // CAMBIO DE TURNO
  const [plataDejaEnCaja, setPlataDejaEnCaja] = useState<number | ''>('');
  const [mostrarModalCambioTurno, setMostrarModalCambioTurno] = useState(false);
  const [usuariosBD, setUsuariosBD] = useState<any[]>([]);
  const [usuarioEntranteId, setUsuarioEntranteId] = useState<number | string>('');
  const [claveUsuarioEntrante, setClaveUsuarioEntrante] = useState('');
  const [verificandoCambioTurno, setVerificandoCambioTurno] = useState(false);

  const [cargando, setCargando] = useState(true);

  const bloqueadoPorApertura = !baseGuardada || !aperturaRealizada;

  // Listado de empaques filtrados y ordenados alfabéticamente
  const listaEmpaquesFiltrados = Array.from(
    new Set(
      empaquesBD
        .map((e) => e.nombre)
        .filter((nombre): nombre is string => Boolean(nombre && nombre.toLowerCase() !== 'total paletas'))
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  // Insumos filtrados y ordenados alfabéticamente
  const insumosFiltrados = productosInsumosBD
    .filter((prod) => {
      const cat = String(prod?.categoriaLimpia || '');
      const nombre = String(prod?.nombre || '').toLowerCase();

      const esRichi = cat.includes('richi') || cat.includes('empaque') || cat.includes('plástico');
      const esProduccion = cat.includes('produccion') || cat.includes('prod');
      const esInsumos = cat.includes('insumo') || cat.includes('topping');
      const esAseo = cat.includes('aseo') || cat.includes('limpieza');

      let coincideCat = false;
      if (tabPedido === 'paletas') {
        coincideCat = cat.includes('paleta') || (!esRichi && !esProduccion && !esInsumos && !esAseo);
      } else if (tabPedido === 'richi') {
        coincideCat = esRichi;
      } else if (tabPedido === 'produccion') {
        coincideCat = esProduccion;
      } else if (tabPedido === 'insumos') {
        coincideCat = esInsumos;
      } else if (tabPedido === 'aseo') {
        coincideCat = esAseo;
      }

      const coincideTexto =
        !busquedaInsumoPedido.trim() ||
        nombre.includes(busquedaInsumoPedido.toLowerCase().trim());

      return coincideCat && coincideTexto && prod.activo !== false;
    })
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

  // Lugares de compra únicos ordenados alfabéticamente
  const listaLugaresCompraUnica = Array.from(
    new Set(
      productosInsumosBD
        .map((p) => p.donde_comprar)
        .filter((lugar): lugar is string => Boolean(lugar && lugar.trim() !== ''))
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  // Categorías de venta ordenadas alfabéticamente
  const categoriasVentaDisponibles = Array.from(
    new Set(productosVentaBD.map((p) => p.categoria || 'General').filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  // Productos de venta filtrados y ordenados alfabéticamente
  const productosVentaFiltrados = productosVentaBD.filter((prod) => {
    const coincideTexto =
      !busquedaProductoVenta.trim() ||
      (prod.nombre || '').toLowerCase().includes(busquedaProductoVenta.toLowerCase().trim());

    const coincideCat =
      categoriaVentaFiltro === 'TODAS' ||
      (prod.categoria || '').toLowerCase() === categoriaVentaFiltro.toLowerCase();

    return coincideTexto && coincideCat && prod.activo !== false;
  }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

  useEffect(() => {
    const sesionLocal = localStorage.getItem('martineto_session');
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }
    const ses = JSON.parse(sesionLocal);
    setSesion(ses);

    const sId = Number(ses.sede_id) || 4;
    const sNombre = ses.sede_nombre || 'Sede Walers';
    setSedeIdActual(sId);
    setNombreSedeActual(sNombre);

    cargarInicial(ses, sId);
  }, [router]);

  async function cargarGastosDia(sId: number) {
    const inicioDia = obtenerInicioDiaColombia();

    const { data, error } = await supabase
      .from('gasto')
      .select('*')
      .eq('sede_id', sId)
      .gte('fecha', inicioDia)
      .order('id', { ascending: false });

    if (!error && data) {
      setGastosDiaBD(data);
    }
  }

  async function cargarVentasDiaBD(sId: number) {
    setCargandoResumenVentas(true);
    const inicioDia = obtenerInicioDiaColombia();

    const { data, error } = await supabase
      .from('venta')
      .select('*')
      .eq('sede_id', sId)
      .gte('fecha_hora', inicioDia)
      .order('id', { ascending: false });

    if (!error && data) {
      setVentasDiaBD(data);
    }
    setCargandoResumenVentas(false);
  }

  async function cargarHistorialPedidos(sId: number) {
    const inicioDia = obtenerInicioDiaColombia();

    const { data, error } = await supabase
      .from('pedidos_insumos')
      .select('*')
      .eq('sede_id', sId)
      .gte('fecha', inicioDia)
      .order('id', { ascending: false });

    if (!error && data) {
      setHistorialPedidosBD(data);
    }
  }

  async function cargarProductosParaVenta(sId: number) {
    const { data, error } = await supabase
      .from('productos_para_venta')
      .select('*')
      .eq('sede_id', sId)
      .order('nombre', { ascending: true });

    if (!error && data) {
      setProductosVentaBD(data.sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })));
    }
  }

  async function cargarMesas(sId: number) {
    const { data, error } = await supabase
      .from('mesa')
      .select('*')
      .eq('sede_id', sId)
      .order('id', { ascending: true });

    if (!error && data && data.length > 0) {
      const mesasOrdenadas = data.sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
      setMesasBD(mesasOrdenadas);
      if (!mesaSeleccionada) {
        setMesaSeleccionada(mesasOrdenadas[0].id);
        setTipoCanalSeleccionado('mesa');
      }
    } else {
      setMesasBD([]);
    }
  }

  async function cargarUsuarios() {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre_completo, codigo_acceso, tipo_usuario')
      .order('nombre_completo', { ascending: true });

    if (!error && data) {
      const usuariosMapeados = data.map((u: any) => ({
        ...u,
        nombre: u.nombre_completo || u.nombre || '',
        contrasena: u.codigo_acceso || u.contrasena || '',
      })).sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
      
      setUsuariosBD(usuariosMapeados);
      if (usuariosMapeados.length > 0) {
        setUsuarioEntranteId(usuariosMapeados[0].id);
        setAyudanteSeleccionadoId(usuariosMapeados[0].id);
      }
    }
  }

  async function cargarNominasDia(sId: number) {
    const inicioDia = obtenerInicioDiaColombia();

    const { data, error } = await supabase
      .from('nomina')
      .select('*')
      .eq('sede_id', sId)
      .gte('fecha', inicioDia)
      .order('id', { ascending: false });

    if (!error && data) {
      setNominasDiaBD(data);
    }
  }

  async function agregarPasilloMesa() {
    const totalPasillos = mesasBD.filter((m) => (m.nombre || '').toUpperCase().includes('PASILLO')).length + 1;
    const nombreNuevo = `PASILLO ${totalPasillos < 10 ? '0' + totalPasillos : totalPasillos}`;

    try {
      const { data, error } = await supabase
        .from('mesa')
        .insert([{ sede_id: sedeIdActual, nombre: nombreNuevo }])
        .select();

      if (!error && data && data.length > 0) {
        setMesasBD((prev) => [...prev, ...data].sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })));
        setMesaSeleccionada(data[0].id);
        setTipoCanalSeleccionado('mesa');
      } else {
        alert('Error al agregar pasillo: ' + (error?.message || 'Error desconocido'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  }

  function crearNuevoPedidoRappi() {
    const numRappi = pedidosRappi.length + 1;
    const codigoRappi = `#R-${numRappi < 10 ? '0' + numRappi : numRappi}`;
    const nuevoId = `rappi_${Date.now()}`;

    const nuevoPed: PedidoRappi = {
      id: nuevoId,
      codigo: codigoRappi,
      items: [],
      fechaHora: obtenerFechaHoraColombia(),
    };

    setPedidosRappi((prev) => [...prev, nuevoPed]);
    setRappiSeleccionadoId(nuevoId);
    setTipoCanalSeleccionado('rappi');
  }

  async function cargarInicial(sesionActual: any, sId: number) {
    setCargando(true);

    try {
      let turnoIdActual = sesionActual?.turno_id;
      if (!turnoIdActual) {
        const { data: turnoData } = await supabase
          .from('turno_trabajo')
          .select('id, nombre')
          .eq('sede_id', sId)
          .order('id', { ascending: false })
          .limit(1);

        if (turnoData && turnoData.length > 0) {
          turnoIdActual = turnoData[0].id;
          sesionActual.turno_id = turnoIdActual;
          sesionActual.turno_nombre = turnoData[0].nombre;
          setSesion({ ...sesionActual });
        }
      }

      const { data: empaquesData } = await supabase
        .from('inventario_empaques_sedes')
        .select('*')
        .eq('sede_id', sId)
        .order('nombre', { ascending: true });

      if (empaquesData) {
        setEmpaquesBD(empaquesData.sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })));
      }

      const inicioDia = obtenerInicioDiaColombia();
      const usuarioId = sesionActual?.usuario_id || sesionActual?.id || 2;

      const { data: cajaHoyBD } = await supabase
        .from('caja')
        .select('*')
        .eq('sede_id', sId)
        .eq('usuario_id', usuarioId)
        .gte('fecha', inicioDia)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cajaHoyBD) {
        setBaseCaja(Number(cajaHoyBD.monto_apertura) || 0);
        setBaseGuardada(true);
        setCajaIdActual(cajaHoyBD.id);
        setCajaDataActual(cajaHoyBD);
      } else {
        limpiarBaseCaja();
        setBaseCaja('');
        setBaseGuardada(false);
        setCajaIdActual(null);
        setCajaDataActual(null);
      }

      const { data: invHoyBD } = await supabase
        .from('inventario_diario')
        .select('*')
        .eq('sede_id', sId)
        .gte('fecha_registro', inicioDia)
        .ilike('tipo_movimiento', 'apertura')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invHoyBD) {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
      }

      const { data: prodsInsumosBD } = await supabase
        .from('producto')
        .select('*')
        .eq('sede_id', sId);

      if (prodsInsumosBD) {
        const productosMapeados = prodsInsumosBD.map((p: any) => ({
          ...p,
          nombre: p.nombre || p.Nombre || '',
          categoriaLimpia: String(p.categoria || p.Categoria || 'paleta').trim().toLowerCase(),
          donde_comprar: p.donde_comprar || '',
          activo: p.activo !== false,
        })).sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

        setProductosInsumosBD(productosMapeados);

        const lugaresUnicosBD = Array.from(
          new Set(
            productosMapeados
              .map((p) => p.donde_comprar)
              .filter((lugar): lugar is string => Boolean(lugar && lugar.trim() !== ''))
          )
        ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

        if (lugaresUnicosBD.length > 0) {
          setNuevoProdDondeComprar(lugaresUnicosBD[0]);
        }
      }

      await cargarHistorialPedidos(sId);
      await cargarGastosDia(sId);
      await cargarVentasDiaBD(sId);
      await cargarProductosParaVenta(sId);
      await cargarMesas(sId);
      await cargarUsuarios();
      await cargarNominasDia(sId);
    } catch (e: any) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  const rappiActual = pedidosRappi.find((r) => r.id === rappiSeleccionadoId);
  const carritoActual =
    tipoCanalSeleccionado === 'mesa'
      ? mesaSeleccionada
        ? carritosPorMesa[mesaSeleccionada] || []
        : []
      : rappiActual
      ? rappiActual.items
      : [];

  function agregarProductoACarrito(prod: any) {
    if (tipoCanalSeleccionado === 'mesa') {
      if (!mesaSeleccionada) {
        alert('⚠️ Selecciona primero una mesa o pasillo.');
        return;
      }

      setCarritosPorMesa((prev) => {
        const actual = prev[mesaSeleccionada] || [];
        const existeIdx = actual.findIndex((i) => i.id === prod.id && !i.esAdicion);

        if (existeIdx >= 0) {
          const copia = [...actual];
          copia[existeIdx] = { ...copia[existeIdx], cantidad: copia[existeIdx].cantidad + 1 };
          return { ...prev, [mesaSeleccionada]: copia };
        } else {
          return {
            ...prev,
            [mesaSeleccionada]: [
              ...actual,
              { id: prod.id, nombre: prod.nombre, precio: Number(prod.precio) || 0, cantidad: 1 },
            ],
          };
        }
      });
    } else {
      if (!rappiSeleccionadoId) {
        alert('⚠️ Crea o selecciona primero un pedido de Rappi.');
        return;
      }

      setPedidosRappi((prev) =>
        prev.map((r) => {
          if (r.id === rappiSeleccionadoId) {
            const actual = r.items || [];
            const existeIdx = actual.findIndex((i) => i.id === prod.id && !i.esAdicion);
            let nuevosItems = [];

            if (existeIdx >= 0) {
              nuevosItems = [...actual];
              nuevosItems[existeIdx] = {
                ...nuevosItems[existeIdx],
                cantidad: nuevosItems[existeIdx].cantidad + 1,
              };
            } else {
              nuevosItems = [
                ...actual,
                { id: prod.id, nombre: prod.nombre, precio: Number(prod.precio) || 0, cantidad: 1 },
              ];
            }
            return { ...r, items: nuevosItems };
          }
          return r;
        })
      );
    }
  }

  function agregarAdicionDirecta() {
    const val = valorAdicionInput === '' ? 0 : Number(valorAdicionInput);
    if (val <= 0) {
      alert('⚠️ Ingresa un valor válido para la adición.');
      return;
    }

    if (tipoCanalSeleccionado === 'mesa') {
      if (!mesaSeleccionada) {
        alert('⚠️ Selecciona una mesa primero.');
        return;
      }
      setCarritosPorMesa((prev) => {
        const actual = prev[mesaSeleccionada] || [];
        return {
          ...prev,
          [mesaSeleccionada]: [
            ...actual,
            { id: `adicion_${Date.now()}`, nombre: '➕ Adición', precio: val, cantidad: 1, esAdicion: true },
          ],
        };
      });
    } else {
      if (!rappiSeleccionadoId) {
        alert('⚠️ Selecciona un pedido de Rappi primero.');
        return;
      }
      setPedidosRappi((prev) =>
        prev.map((r) => {
          if (r.id === rappiSeleccionadoId) {
            return {
              ...r,
              items: [
                ...r.items,
                { id: `adicion_${Date.now()}`, nombre: '➕ Adición', precio: val, cantidad: 1, esAdicion: true },
              ],
            };
          }
          return r;
        })
      );
    }

    setValorAdicionInput('');
  }

  function cambiarCantidadItem(id: number | string, delta: number) {
    if (tipoCanalSeleccionado === 'mesa') {
      if (!mesaSeleccionada) return;
      setCarritosPorMesa((prev) => {
        const actual = prev[mesaSeleccionada] || [];
        const mod = actual
          .map((i) => {
            if (i.id === id) {
              const nuevaCant = i.cantidad + delta;
              return nuevaCant > 0 ? { ...i, cantidad: nuevaCant } : null;
            }
            return i;
          })
          .filter(Boolean) as ItemCarrito[];

        return { ...prev, [mesaSeleccionada]: mod };
      });
    } else {
      if (!rappiSeleccionadoId) return;
      setPedidosRappi((prev) =>
        prev.map((r) => {
          if (r.id === rappiSeleccionadoId) {
            const mod = r.items
              .map((i) => {
                if (i.id === id) {
                  const nuevaCant = i.cantidad + delta;
                  return nuevaCant > 0 ? { ...i, cantidad: nuevaCant } : null;
                }
                return i;
              })
              .filter(Boolean) as ItemCarrito[];
            return { ...r, items: mod };
          }
          return r;
        })
      );
    }
  }

  const subtotalMesaActual = carritoActual.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  const descuentoNum = descuentoVenta === '' ? 0 : Number(descuentoVenta);
  const totalACobrar = Math.max(0, subtotalMesaActual - descuentoNum);

  const numEfectivo = pagoEfectivo === '' ? 0 : Number(pagoEfectivo);
  const numNequi = pagoNequi === '' ? 0 : Number(pagoNequi);
  const numDavi = pagoDaviplata === '' ? 0 : Number(pagoDaviplata);
  const numOtros = pagoOtros === '' ? 0 : Number(pagoOtros);

  const totalIngresado = numEfectivo + numNequi + numDavi + numOtros;
  const saldoPendiente = Math.max(0, totalACobrar - totalIngresado);

  function autocompletarMetodoPago(metodo: 'efectivo' | 'nequi' | 'daviplata' | 'otros') {
    const saldoRestanteSinMetodoActual =
      totalACobrar -
      (metodo === 'efectivo' ? 0 : numEfectivo) -
      (metodo === 'nequi' ? 0 : numNequi) -
      (metodo === 'daviplata' ? 0 : numDavi) -
      (metodo === 'otros' ? 0 : numOtros);

    const aCubrir = Math.max(0, saldoRestanteSinMetodoActual);

    if (metodo === 'efectivo') setPagoEfectivo(aCubrir);
    if (metodo === 'nequi') setPagoNequi(aCubrir);
    if (metodo === 'daviplata') setPagoDaviplata(aCubrir);
    if (metodo === 'otros') setPagoOtros(aCubrir);
  }

  async function handleGuardarNomina() {
    if (guardandoNomina) return;

    const monto = montoTotalNomina === '' ? 0 : Number(montoTotalNomina);

    if (monto <= 0) {
      alert('⚠️ Ingresa el total a pagar de nómina.');
      return;
    }

    setGuardandoNomina(true);

    try {
      const usuarioLogueadoId = sesion?.usuario_id || sesion?.id || 2;
      
      let nombreBeneficiario = '';
      let usuarioIdGuardar = Number(usuarioLogueadoId);

      if (tipoPersonaNomina === 'operador') {
        nombreBeneficiario = sesion?.nombre || 'Operador Actual';
        usuarioIdGuardar = Number(sesion?.usuario_id || sesion?.id || 2);
      } else {
        const uAyudante = usuariosBD.find((u) => String(u.id) === String(ayudanteSeleccionadoId));
        nombreBeneficiario = uAyudante ? uAyudante.nombre : 'Ayudante';
        usuarioIdGuardar = ayudanteSeleccionadoId ? Number(ayudanteSeleccionadoId) : Number(usuarioLogueadoId);
      }

      const payload = {
        sede_id: sedeIdActual,
        usuario_id: usuarioIdGuardar,
        monto: monto,
        concepto: `Pago de turno (${nombreBeneficiario})`,
        fecha_pago: obtenerFechaCortaColombia(),
        fecha: obtenerFechaCortaColombia(),
      };

      const { error } = await supabase.from('nomina').insert([payload]);

      if (error) {
        alert('❌ Error al guardar la nómina: ' + error.message);
        return;
      }

      alert('✅ Nómina registrada exitosamente.');
      setHorasDiaNomina('');
      setHorasNocheNomina('');
      setMontoTotalNomina('');
      await cargarNominasDia(sedeIdActual);
    } finally {
      setGuardandoNomina(false);
    }
  }

  async function handleConfirmarCambioTurno() {
    if (verificandoCambioTurno) return;

    if (!usuarioEntranteId) {
      alert('⚠️ Selecciona el operario que recibe el turno.');
      return;
    }

    if (!claveUsuarioEntrante.trim()) {
      alert('⚠️ Ingresa la clave del operario entrante.');
      return;
    }

    const dejandoCajaNum = plataDejaEnCaja === '' ? 0 : Number(plataDejaEnCaja);
    if (dejandoCajaNum < 0) {
      alert('⚠️ La plata que deja en caja no puede ser negativa.');
      return;
    }

    setVerificandoCambioTurno(true);

    try {
      const uEntrante = usuariosBD.find((u) => String(u.id) === String(usuarioEntranteId));

      if (!uEntrante || String(uEntrante.contrasena || '') !== String(claveUsuarioEntrante.trim())) {
        alert('❌ Contraseña incorrecta. Verifica la clave ingresada.');
        return;
      }

      if (cajaIdActual) {
        await supabase
          .from('caja')
          .update({
            efectivo_cierre: dejandoCajaNum,
            estado: 'cerrada'
          })
          .eq('id', cajaIdActual);
      }

      const { data: nuevaCajaData, error: errorNuevaCaja } = await supabase
        .from('caja')
        .insert([
          {
            sede_id: sedeIdActual,
            usuario_id: Number(uEntrante.id),
            monto_apertura: dejandoCajaNum,
            diferencia: 0,
            estado: 'abierta',
            fecha: obtenerFechaHoraColombia()
          }
        ])
        .select();

      if (errorNuevaCaja) {
        alert('❌ Error al abrir caja para el operario entrante: ' + errorNuevaCaja.message);
        return;
      }

      const nuevaSesion = {
        ...sesion,
        usuario_id: uEntrante.id,
        id: uEntrante.id,
        nombre: uEntrante.nombre,
        turno_nombre: 'TURNO TARDE',
      };

      localStorage.setItem('martineto_session', JSON.stringify(nuevaSesion));
      setSesion(nuevaSesion);
      if (nuevaCajaData && nuevaCajaData.length > 0) {
        setCajaIdActual(nuevaCajaData[0].id);
      }

      alert(`✅ Cambio de turno exitoso. Cierre de caja registrado y turno abierto para ${uEntrante.nombre} con $ ${dejandoCajaNum.toLocaleString('es-CO')} en caja.`);
      setMostrarModalCambioTurno(false);
      setClaveUsuarioEntrante('');
      setPlataDejaEnCaja('');
      window.location.reload();
    } finally {
      setVerificandoCambioTurno(false);
    }
  }

  async function handleEntregarPedidoRappiDirecto() {
    if (guardandoVenta) return;

    if (!rappiSeleccionadoId || !rappiActual || rappiActual.items.length === 0) {
      alert('⚠️ El pedido de Rappi no contiene productos.');
      return;
    }

    setGuardandoVenta(true);

    try {
      const usuarioId = sesion?.usuario_id || sesion?.id || 2;
      const turnoId = sesion?.turno_id ? Number(sesion.turno_id) : null;
      const totalRappi = rappiActual.items.reduce((a, b) => a + b.precio * b.cantidad, 0);

      const payloadVenta = {
        sede_id: sedeIdActual,
        mesa_id: null,
        usuario_id: usuarioId,
        turno_id: turnoId,
        monto_total: totalRappi,
        pago_efectivo: 0,
        pago_nequi: 0,
        pago_daviplata: 0,
        pago_rappi: totalRappi,
        otros: 0,
        detalle_otro: `Entrega Directa Rappi ${rappiActual.codigo}`,
        descuento: 0,
        items: rappiActual.items,
        estado: 'pagado',
        tipo_venta: 'rappi',
        fecha_hora: obtenerFechaHoraColombia(),
      };

      const { error } = await supabase.from('venta').insert([payloadVenta]);

      if (error) {
        alert('❌ Error al entregar el pedido de Rappi: ' + error.message);
        return;
      }

      alert(`✅ Pedido ${rappiActual.codigo} entregado y registrado como venta Rappi.`);

      setPedidosRappi((prev) => prev.filter((r) => r.id !== rappiSeleccionadoId));
      setRappiSeleccionadoId(null);
      await cargarVentasDiaBD(sedeIdActual);
      if (mesasBD.length > 0) {
        setMesaSeleccionada(mesasBD[0].id);
        setTipoCanalSeleccionado('mesa');
      }
    } finally {
      setGuardandoVenta(false);
    }
  }

  async function handleFinalizarVentaBD() {
    if (guardandoVenta) return;

    if (carritoActual.length === 0) {
      alert('⚠️ El carrito está vacío.');
      return;
    }

    if (totalIngresado < totalACobrar) {
      alert(`⚠️ Falta por cubrir ${formatearMoneda(saldoPendiente)} para completar la venta.`);
      return;
    }

    setGuardandoVenta(true);

    try {
      const usuarioId = sesion?.usuario_id || sesion?.id || 2;
      const turnoId = sesion?.turno_id ? Number(sesion.turno_id) : null;

      const payloadVenta = {
        sede_id: sedeIdActual,
        mesa_id: mesaSeleccionada,
        usuario_id: usuarioId,
        turno_id: turnoId,
        monto_total: totalACobrar,
        pago_efectivo: numEfectivo,
        pago_nequi: numNequi,
        pago_daviplata: numDavi,
        otros: numOtros,
        detalle_otro: detalleOtro || null,
        descuento: descuentoNum,
        items: carritoActual,
        estado: 'pagado',
        tipo_venta: 'local',
        fecha_hora: obtenerFechaHoraColombia(),
      };

      const { error } = await supabase.from('venta').insert([payloadVenta]);

      if (error) {
        alert('❌ Error al registrar la venta: ' + error.message);
        return;
      }

      alert('✅ ¡Venta registrada exitosamente!');

      if (mesaSeleccionada) {
        setCarritosPorMesa((prev) => ({ ...prev, [mesaSeleccionada]: [] }));
      }

      setPagoEfectivo('');
      setPagoNequi('');
      setPagoDaviplata('');
      setPagoOtros('');
      setDetalleOtro('');
      setDescuentoVenta('');
      setMostrarModalPago(false);
      await cargarVentasDiaBD(sedeIdActual);
    } finally {
      setGuardandoVenta(false);
    }
  }

  async function handleGuardarVentasExternas() {
    if (guardandoExterno) return;

    const usuarioId = sesion?.usuario_id || sesion?.id || 2;
    const efec = externoEfectivo === '' ? 0 : Number(externoEfectivo);
    const neq = externoNequi === '' ? 0 : Number(externoNequi);
    const davi = externoDaviplata === '' ? 0 : Number(externoDaviplata);
    const rap = externoRappi === '' ? 0 : Number(externoRappi);
    const otr = externoOtros === '' ? 0 : Number(externoOtros);

    if (efec < 0 || neq < 0 || davi < 0 || rap < 0 || otr < 0) {
      alert('⚠️ Los valores no pueden ser negativos.');
      return;
    }

    setGuardandoExterno(true);

    try {
      let targetCajaId = cajaIdActual;

      if (!targetCajaId) {
        const inicioDia = obtenerInicioDiaColombia();
        const { data: cajaBD } = await supabase
          .from('caja')
          .select('*')
          .eq('sede_id', sedeIdActual)
          .eq('usuario_id', usuarioId)
          .gte('fecha', inicioDia)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cajaBD) {
          targetCajaId = cajaBD.id;
          setCajaIdActual(cajaBD.id);
          setCajaDataActual(cajaBD);
        }
      }

      if (targetCajaId) {
        const { data, error } = await supabase
          .from('caja')
          .update({
            efectivo_cierre: efec,
            nequi: neq,
            daviplata: davi,
            rappi: rap,
            otros: otr,
          })
          .eq('id', targetCajaId)
          .select()
          .single();

        if (error) {
          alert('❌ Error al actualizar las ventas en caja: ' + error.message);
          return;
        }
        if (data) setCajaDataActual(data);
      } else {
        const { data, error } = await supabase
          .from('caja')
          .insert([
            {
              sede_id: sedeIdActual,
              usuario_id: usuarioId,
              monto_apertura: baseCaja === '' ? 0 : Number(baseCaja),
              efectivo_cierre: efec,
              nequi: neq,
              daviplata: davi,
              rappi: rap,
              otros: otr,
              fecha: obtenerFechaHoraColombia(),
              estado: 'abierta'
            }
          ])
          .select()
          .single();

        if (error) {
          alert('❌ Error al registrar ventas en caja: ' + error.message);
          return;
        }

        if (data) {
          setCajaIdActual(data.id);
          setCajaDataActual(data);
        }
      }

      alert('✅ Totales de ventas guardados en Caja correctamente.');
    } finally {
      setGuardandoExterno(false);
    }
  }

  async function handleGuardarGasto() {
    if (guardandoGasto) return;

    const descLimpia = descripcionGasto.trim();
    const montoNum = montoGasto === '' ? 0 : Number(montoGasto);

    if (!descLimpia) {
      alert('⚠️ Escribe el concepto o descripción del gasto.');
      return;
    }

    if (montoNum <= 0) {
      alert('⚠️ Ingresa un monto de gasto válido mayor a 0.');
      return;
    }

    setGuardandoGasto(true);

    try {
      const usuarioId = sesion?.usuario_id || sesion?.id;
      const turnoId = sesion?.turno_id ? Number(sesion.turno_id) : null;

      const payload = {
        sede_id: sedeIdActual,
        usuario_id: usuarioId ? Number(usuarioId) : null,
        turno_id: turnoId,
        descripcion: descLimpia,
        monto: montoNum,
        fecha: obtenerFechaHoraColombia(),
      };

      const { error } = await supabase.from('gasto').insert([payload]);

      if (error) {
        alert('❌ Error al registrar el gasto: ' + error.message);
        return;
      }

      alert('✅ Gasto registrado correctamente.');
      setDescripcionGasto('');
      setMontoGasto('');
      await cargarGastosDia(sedeIdActual);
    } finally {
      setGuardandoGasto(false);
    }
  }

  async function handleBorrarGastoBD(idGasto: number, desc: string) {
    if (!confirm(`¿Deseas eliminar el gasto "${desc}"?`)) return;

    try {
      const { error } = await supabase.from('gasto').delete().eq('id', idGasto);

      if (error) {
        alert('Error al borrar el gasto: ' + error.message);
      } else {
        alert('✅ Gasto eliminado.');
        await cargarGastosDia(sedeIdActual);
      }
    } catch (e: any) {
      alert('Error en la operación: ' + e.message);
    }
  }

  const totalGastosHoy = gastosDiaBD.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const totalNominasHoy = nominasDiaBD.reduce((acc, n) => acc + (Number(n.monto) || 0), 0);

  async function desactivarProductoDeSede(idProducto: number, nombreProd: string) {
    if (tabPedido === 'paletas') {
      alert('⚠️ Las paletas no se pueden eliminar del catálogo.');
      return;
    }

    if (!confirm(`¿Deseas eliminar permanentemente "${nombreProd}" del catálogo?`)) return;

    try {
      const { error } = await supabase
        .from('producto')
        .update({ activo: false })
        .eq('id', idProducto);

      if (error) {
        alert('Error al desactivar el producto: ' + error.message);
      } else {
        setProductosInsumosBD((prev) => prev.filter((p) => p.id !== idProducto));
        alert(`✅ Producto "${nombreProd}" eliminado.`);
      }
    } catch (e: any) {
      alert('Error en la operación: ' + e.message);
    }
  }

  const obtenerStockActualBD = (nombreEmpaque: string): number => {
    const encontrado = empaquesBD.find(
      (e) => (e.nombre || '').toLowerCase().trim() === nombreEmpaque.toLowerCase().trim()
    );
    return encontrado ? Number(encontrado.stock || 0) : 0;
  };

  async function handleGuardarBase() {
    if (guardandoBase || baseGuardada) return;
    const monto = baseCaja === '' ? 0 : Number(baseCaja);
    const usuarioId = sesion?.usuario_id || sesion?.id || 2;
    const turnoId = sesion?.turno_id ? Number(sesion.turno_id) : null;

    if (monto < 0) {
      alert('⚠️ La base de caja no puede ser negativa.');
      return;
    }

    setGuardandoBase(true);
    try {
      const { data, error } = await supabase.from('caja').insert([
        {
          sede_id: sedeIdActual,
          usuario_id: Number(usuarioId),
          turno_id: turnoId,
          monto_apertura: monto,
          diferencia: 0,
          estado: 'abierta',
          fecha: obtenerFechaHoraColombia()
        }
      ]).select();

      if (error) {
        alert('❌ Error al guardar la base en la caja: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        setCajaIdActual(data[0].id);
        setCajaDataActual(data[0]);
      }

      setBaseGuardada(true);
    } finally {
      setGuardandoBase(false);
    }
  }

  async function handleGuardarInventario() {
    if (guardandoMovimiento) return;

    if (!baseGuardada) {
      alert('⚠️ Primero guarda la Base de Caja.');
      return;
    }

    const usuarioId = sesion?.usuario_id || sesion?.id || 2;
    const fechaRealSQL = obtenerFechaHoraColombia();

    const totalPaletasNum =
      totalPaletasInventario !== ''
        ? Number(totalPaletasInventario)
        : tipoMovimiento === 'apertura'
        ? obtenerStockActualBD('Total Paletas')
        : 0;

    const detalleEmpaquesLimpio: { [key: string]: number } = {};
    const perdidasCalculadas: { [key: string]: number } = {};

    Object.keys(cantidadesInventario).forEach((key) => {
      if (key !== 'Total Paletas') {
        const val = cantidadesInventario[key];
        if (val !== '' && val !== null && val !== undefined) {
          const contadoNum = Number(val);
          detalleEmpaquesLimpio[key] = contadoNum;
          if (tipoMovimiento === 'apertura') {
            const stockViejo = obtenerStockActualBD(key);
            const perdida = stockViejo - contadoNum;
            perdidasCalculadas[key] = perdida > 0 ? perdida : 0;
          }
        } else if (tipoMovimiento === 'apertura') {
          detalleEmpaquesLimpio[key] = obtenerStockActualBD(key);
        } else {
          detalleEmpaquesLimpio[key] = 0;
        }
      }
    });

    if (tipoMovimiento === 'apertura' && Object.keys(detalleEmpaquesLimpio).length === 0) {
      listaEmpaquesFiltrados.forEach((emp) => {
        detalleEmpaquesLimpio[emp] = obtenerStockActualBD(emp);
      });
    }

    setGuardandoMovimiento(true);

    try {
      const { error: errorInsert } = await supabase.from('inventario_diario').insert([
        {
          sede_id: sedeIdActual,
          usuario_id: Number(usuarioId),
          tipo_movimiento: tipoMovimiento,
          total_paletas: totalPaletasNum,
          detalle_paletas: {},
          detalle_empaques: detalleEmpaquesLimpio,
          observaciones: observacionesInventario,
          turno_id: sesion?.turno_id ? Number(sesion.turno_id) : null,
          fecha_registro: fechaRealSQL
        }
      ]);

      if (errorInsert) {
        throw new Error('Error al registrar inventario: ' + (errorInsert.message || JSON.stringify(errorInsert)));
      }

      const stockPaletaViejo = obtenerStockActualBD('Total Paletas');

      for (const [nombreProd, cantDigitada] of Object.entries(detalleEmpaquesLimpio)) {
        const stockActual = obtenerStockActualBD(nombreProd);
        let nuevoStockCalculado = stockActual;

        if (tipoMovimiento === 'apertura') {
          nuevoStockCalculado = cantDigitada;
        } else if (tipoMovimiento === 'nuevas' || tipoMovimiento === 'compras') {
          nuevoStockCalculado = stockActual + cantDigitada;
        } else if (tipoMovimiento === 'debaja') {
          nuevoStockCalculado = Math.max(0, stockActual - cantDigitada);
        }

        const empReg = empaquesBD.find(
          (e) => (e.nombre || '').toLowerCase().trim() === nombreProd.toLowerCase().trim()
        );

        if (empReg) {
          await supabase
            .from('inventario_empaques_sedes')
            .update({ stock: nuevoStockCalculado })
            .eq('id', empReg.id);

          setEmpaquesBD((prev) =>
            prev.map((e) => (e.id === empReg.id ? { ...e, stock: nuevoStockCalculado } : e))
          );
        }
      }

      const paletaReg = empaquesBD.find((e) => (e.nombre || '').toLowerCase().trim() === 'total paletas');
      if (paletaReg) {
        let nuevoStockPaletas = stockPaletaViejo;
        if (tipoMovimiento === 'apertura') {
          nuevoStockPaletas = totalPaletasNum;
        } else if (tipoMovimiento === 'nuevas' || tipoMovimiento === 'compras') {
          nuevoStockPaletas = stockPaletaViejo + totalPaletasNum;
        } else if (tipoMovimiento === 'debaja') {
          nuevoStockPaletas = Math.max(0, stockPaletaViejo - totalPaletasNum);
        }
        await supabase
          .from('inventario_empaques_sedes')
          .update({ stock: nuevoStockPaletas })
          .eq('id', paletaReg.id);
      }

      alert(`✅ ¡${tipoMovimiento.toUpperCase()} registrada con éxito! Stock actualizado en base de datos.`);

      limpiarTotalPaletasInv();
      limpiarCantidadesInv();
      limpiarObsInv();

      if (tipoMovimiento === 'apertura') {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
        setModuloActivo('pedidos');
      }
    } catch (err: any) {
      console.error(err);
      alert('❌ ' + (err.message || 'Error al procesar el movimiento'));
    } finally {
      setGuardandoMovimiento(false);
    }
  }

  async function toggleChuloProductoPedido(pedidoId: number, columnaCategoria: string, nombreProducto: string) {
    try {
      const pedidoOriginal = historialPedidosBD.find((p) => p.id === pedidoId);
      if (!pedidoOriginal) return;

      const mapaCat = { ...(pedidoOriginal[columnaCategoria] || {}) };
      if (!mapaCat[nombreProducto]) return;

      const itemActual = mapaCat[nombreProducto];
      const yaEntregado = typeof itemActual === 'object' && itemActual !== null ? itemActual.entregado : false;

      mapaCat[nombreProducto] = {
        cantidad: typeof itemActual === 'object' && itemActual !== null ? itemActual.cantidad : itemActual,
        entregado: !yaEntregado,
      };

      const { error } = await supabase
        .from('pedidos_insumos')
        .update({ [columnaCategoria]: mapaCat })
        .eq('id', pedidoId);

      if (error) {
        alert('Error al actualizar estado del producto: ' + error.message);
      } else {
        await cargarHistorialPedidos(sedeIdActual);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  }

  async function pasarFaltantesAlListadoActual() {
    let agregadosCount = 0;
    const nuevasCategorias: {
      paletas: { [key: string]: number };
      richi: { [key: string]: number };
      produccion: { [key: string]: number };
      insumos: { [key: string]: number };
      aseo: { [key: string]: number };
    } = {
      paletas: {},
      richi: {},
      produccion: {},
      insumos: {},
      aseo: {},
    };

    const mapeoColumnasATab: { [key: string]: CategoriaTab } = {
      pedidos_paletas: 'paletas',
      pedidos_richi: 'richi',
      pedidos_produccion: 'produccion',
      pedidos_insumos: 'insumos',
      pedidos_aseo: 'aseo',
    };

    for (const ped of historialPedidosBD) {
      let pedidoModificado = false;
      const actualizacionesBD: any = {};

      (['pedidos_paletas', 'pedidos_richi', 'pedidos_produccion', 'pedidos_insumos', 'pedidos_aseo'] as const).forEach((colCat) => {
        const mapa = ped[colCat];
        if (mapa && typeof mapa === 'object') {
          const tabDestino = mapeoColumnasATab[colCat];
          const nuevoMapaCat = { ...mapa };
          let colModificada = false;

          Object.entries(mapa).forEach(([nomProd, val]: [string, any]) => {
            const entregado = typeof val === 'object' && val !== null ? val.entregado : false;
            const cant = typeof val === 'object' && val !== null ? Number(val.cantidad || 0) : Number(val || 0);

            if (!entregado && cant > 0) {
              nuevasCategorias[tabDestino][nomProd] = (nuevasCategorias[tabDestino][nomProd] || 0) + cant;
              agregadosCount++;

              nuevoMapaCat[nomProd] = {
                cantidad: cant,
                entregado: true,
              };
              colModificada = true;
              pedidoModificado = true;
            }
          });

          if (colModificada) {
            actualizacionesBD[colCat] = nuevoMapaCat;
          }
        }
      });

      if (pedidoModificado) {
        await supabase
          .from('pedidos_insumos')
          .update(actualizacionesBD)
          .eq('id', ped.id);
      }
    }

    if (agregadosCount === 0) {
      alert('ℹ️ No hay productos faltantes (sin marcar) en los pedidos de hoy para pasar.');
      return;
    }

    setPedidosCategorias((prev) => ({
      paletas: { ...prev.paletas, ...nuevasCategorias.paletas },
      richi: { ...prev.richi, ...nuevasCategorias.richi },
      produccion: { ...prev.produccion, ...nuevasCategorias.produccion },
      insumos: { ...prev.insumos, ...nuevasCategorias.insumos },
      aseo: { ...prev.aseo, ...nuevasCategorias.aseo },
    }));

    await cargarHistorialPedidos(sedeIdActual);
    alert(`✅ ¡Se han cargado los ${agregadosCount} producto(s) faltante(s) y se han retirado de la lista de pendientes!`);
  }

  async function handleGuardarCierreFinal() {
    if (guardandoCierre) return;

    if (nominasDiaBD.length === 0) {
      alert('⚠️ No se puede realizar el cierre porque falta registrar el pago de nómina del día. Debe existir al menos una nómina.');
      return;
    }

    if (resumenPedidoActual.length > 0) {
      alert('⚠️ Tienes productos seleccionados en el Módulo de Pedidos que aún no han sido enviados a bodega. Debes enviarlos antes de cerrar.');
      return;
    }

    const fisicoNum = dineroFisicoCierre === '' ? 0 : Number(dineroFisicoCierre);

    if (dineroFisicoCierre === '' || fisicoNum < 0) {
      alert('⚠️ Debes digitar cuánto dinero físico hay en caja (Efectivo contado) para poder realizar el cierre (puede ser 0 si la caja quedó vacía).');
      return;
    }

    const efectivoSistema = totalEfectivoJornada;
    const diferenciaCalculada = fisicoNum - efectivoSistema;

    setGuardandoCierre(true);
    try {
      const usuarioId = sesion?.usuario_id || sesion?.id || 2;
      const totalPaletasContadas = totalPaletasCierre === '' ? obtenerStockActualBD('Total Paletas') : Number(totalPaletasCierre);

      const detalleEmpaquesCierre: { [key: string]: number } = {};
      const unidadesVendidas: { [key: string]: number } = {};

      listaEmpaquesFiltrados.forEach((emp) => {
        const val = cantidadesCierre[emp];
        const contado = val !== '' && val !== null && val !== undefined ? Number(val) : obtenerStockActualBD(emp);
        detalleEmpaquesCierre[emp] = contado;

        const stockViejo = obtenerStockActualBD(emp);
        const vendidas = stockViejo - contado;
        unidadesVendidas[emp] = vendidas > 0 ? vendidas : 0;
      });

      const stockPaletaViejo = obtenerStockActualBD('Total Paletas');
      const paletasVendidas = Math.max(0, stockPaletaViejo - totalPaletasContadas);

      await supabase.from('inventario_diario').insert([
        {
          sede_id: sedeIdActual,
          usuario_id: Number(usuarioId),
          tipo_movimiento: 'cierre',
          total_paletas: totalPaletasContadas,
          detalle_paletas: { vendidas: paletasVendidas },
          detalle_empaques: detalleEmpaquesCierre,
          detalle_vendidas: unidadesVendidas,
          observaciones: observacionesCierre || 'Cierre de turno',
          turno_id: sesion?.turno_id ? Number(sesion.turno_id) : null,
          fecha_registro: obtenerFechaHoraColombia()
        }
      ]);

      for (const [nombreEmp, cantContada] of Object.entries(detalleEmpaquesCierre)) {
        const empReg = empaquesBD.find((e) => (e.nombre || '').toLowerCase().trim() === nombreEmp.toLowerCase().trim());
        if (empReg) {
          await supabase.from('inventario_empaques_sedes').update({ stock: cantContada }).eq('id', empReg.id);
        }
      }

      const paletaReg = empaquesBD.find((e) => (e.nombre || '').toLowerCase().trim() === 'total paletas');
      if (paletaReg) {
        await supabase.from('inventario_empaques_sedes').update({ stock: totalPaletasContadas }).eq('id', paletaReg.id);
      }

      if (cajaIdActual) {
        await supabase
          .from('caja')
          .update({
            diferencia: diferenciaCalculada,
            estado: 'cerrada'
          })
          .eq('id', cajaIdActual);
      }

      alert(`✅ Cierre registrado correctamente. ${diferenciaCalculada !== 0 ? `⚠️ Diferencia en efectivo: ${formatearMoneda(Math.abs(diferenciaCalculada))}` : '✓ Sin diferencias en caja.'}`);

      localStorage.removeItem('martineto_session');
      router.replace('/login');
    } catch (e: any) {
      alert('Error al guardar el cierre: ' + e.message);
    } finally {
      setGuardandoCierre(false);
    }
  }

  async function enviarPedidoBodega() {
    if (enviandoPedido) return;
    const usuarioId = sesion?.usuario_id || sesion?.id || 2;

    const limpiarCategoria = (catObj: { [key: string]: number }) => {
      const res: { [key: string]: any } = {};
      Object.entries(catObj || {}).forEach(([nom, cant]) => {
        if (typeof cant === 'number' && cant > 0) {
          res[nom] = { cantidad: cant, entregado: false };
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

    setEnviandoPedido(true);
    try {
      const payload = {
        sede_id: sedeIdActual,
        usuario_id: usuarioId,
        estado: 'pendiente',
        observaciones: observacionPedido || '',
        pedidos_paletas: paletasLimpias,
        pedidos_richi: richiLimpias,
        pedidos_produccion: produccionLimpias,
        pedidos_insumos: insumosLimpias,
        pedidos_aseo: aseoLimpias,
        fecha: obtenerFechaHoraColombia()
      };

      const { error } = await supabase.from('pedidos_insumos').insert([payload]);

      if (!error) {
        alert('¡Pedido enviado a bodega con éxito!');
        limpiarPedidosCat();
        limpiarObsPedido();
        await cargarHistorialPedidos(sedeIdActual);
      } else {
        alert('Error al guardar en la base de datos: ' + error.message);
      }
    } finally {
      setEnviandoPedido(false);
    }
  }

  async function crearNuevoProductoBD() {
    if (guardandoProducto) return;
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

    try {
      const nuevoProductoObj = {
        nombre: nombreLimpio,
        categoria: nuevoProdCategoria,
        grupo: nuevoProdCategoria,
        donde_comprar: dondeComprarFinal,
        sede_id: sedeIdActual,
        activo: true,
        stock: 0,
      };

      const { data, error } = await supabase.from('producto').insert([nuevoProductoObj]).select();

      if (error) {
        alert('Error guardando en la base de datos: ' + error.message);
        return;
      }

      alert(`✅ ¡Producto "${nombreLimpio}" creado con éxito!`);

      if (data && data.length > 0) {
        const prodFormateado = {
          ...data[0],
          nombre: data[0].nombre,
          categoriaLimpia: String(data[0].categoria || '').trim().toLowerCase(),
          donde_comprar: data[0].donde_comprar || '',
          activo: true,
        };

        setProductosInsumosBD((prev) => [...prev, prodFormateado].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })));
      }

      setNuevoProdNombre('');
      if (listaLugaresCompraUnica.length > 0) {
        setNuevoProdDondeComprar(listaLugaresCompraUnica[0]);
      }
      setDondeComprarPersonalizado('');
      setMostrarModalNuevoProd(false);
    } finally {
      setGuardandoProducto(false);
    }
  }

  const obtenerResumenPedidoActual = () => {
    const listaResumen: { categoria: string; nombre: string; cantidad: number }[] = [];
    (Object.keys(pedidosCategorias) as CategoriaTab[]).forEach((cat) => {
      const itemsCat = pedidosCategorias[cat];
      Object.entries(itemsCat || {}).forEach(([nombreProd, cant]) => {
        const num = Number(cant) || 0;
        if (num > 0) {
          listaResumen.push({ categoria: cat, nombre: nombreProd, cantidad: num });
        }
      });
    });
    return listaResumen.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  };

  const resumenPedidoActual = obtenerResumenPedidoActual();

  async function borrarPedidosBD(idsABorrar: number[]) {
    if (idsABorrar.length === 0 || eliminandoPedido) return;
    if (!confirm(`¿Estás segura de eliminar permanentemente este pedido de la Base de Datos?`)) return;

    setEliminandoPedido(true);
    try {
      const { error } = await supabase
        .from('pedidos_insumos')
        .delete()
        .in('id', idsABorrar);

      if (error) {
        alert('Error al eliminar en la base de datos: ' + error.message);
      } else {
        alert('✅ Pedido eliminado correctamente.');
        await cargarHistorialPedidos(sedeIdActual);
      }
    } finally {
      setEliminandoPedido(false);
    }
  }

  const totalEfectivoVentasPos = ventasDiaBD.reduce((acc, v) => acc + (Number(v.pago_efectivo) || 0), 0);
  const totalNequiVentasPos = ventasDiaBD.reduce((acc, v) => acc + (Number(v.pago_nequi) || 0), 0);
  const totalDaviplataVentasPos = ventasDiaBD.reduce((acc, v) => acc + (Number(v.pago_daviplata) || 0), 0);
  const totalRappiVentasPos = ventasDiaBD.reduce((acc, v) => acc + (Number(v.pago_rappi) || 0), 0);
  const totalOtrosVentasPos = ventasDiaBD.reduce((acc, v) => acc + (Number(v.otros) || 0), 0);

  const efectivoBaseCajaInicial = Number(baseCaja || cajaDataActual?.monto_apertura || 0);

  const totalEfectivoJornada = totalEfectivoVentasPos + (Number(cajaDataActual?.efectivo_cierre || externoEfectivo) || 0);
  const totalNequiJornada = totalNequiVentasPos + (Number(cajaDataActual?.nequi || externoNequi) || 0);
  const totalDaviplataJornada = totalDaviplataVentasPos + (Number(cajaDataActual?.daviplata || externoDaviplata) || 0);
  const totalRappiJornada = totalRappiVentasPos + (Number(cajaDataActual?.rappi || externoRappi) || 0);
  const totalOtrosJornada = totalOtrosVentasPos + (Number(cajaDataActual?.otros || externoOtros) || 0);

  const granTotalVentasJornada = totalEfectivoJornada + totalNequiJornada + totalDaviplataJornada + totalRappiJornada + totalOtrosJornada;
  const granTotalVentasBD = totalEfectivoVentasPos + totalNequiVentasPos + totalDaviplataVentasPos + totalRappiVentasPos + totalOtrosVentasPos;

  const diferenciaNominaVentas = granTotalVentasJornada - totalNominasHoy;

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#004e8c] flex items-center justify-center text-xs font-bold font-sans text-white">
        Cargando POS...
      </main>
    );
  }

  const esTurnoMañanaApertura = (sesion?.turno_nombre || '').toLowerCase().includes('mañana') || (sesion?.turno_nombre || '').toLowerCase().includes('apertura');

  const efectivoCajaSistema = totalEfectivoJornada;
  const fisicoNumCierre = dineroFisicoCierre === '' ? 0 : Number(dineroFisicoCierre);
  const diferenciaCierreVal = fisicoNumCierre - efectivoCajaSistema;

  return (
    <main className="min-h-screen bg-[#004e8c] text-[#f1f5f9] p-4 font-sans max-w-[1600px] mx-auto space-y-4 relative">
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-base md:text-lg font-black text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00a4ef] inline-block"></span>
            🍦 {nombreSedeActual.toUpperCase()} (POS)
          </h1>
          <p className="text-xs text-sky-200 mt-1">
            Operador en Turno: <b className="text-white">{sesion?.nombre || sesion?.usuario_nombre || 'Operador'}</b> ({sesion?.turno_nombre || 'DÍA COMPLETO'})
          </p>
        </div>
      </header>

      <nav className="sticky top-2 z-40 flex items-center gap-2 bg-[#0b2b48]/95 backdrop-blur-md p-2 rounded-2xl border border-[#0066b3] shadow-xl overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setModuloActivo('movimientos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
            moduloActivo === 'movimientos' ? 'bg-[#00a4ef] text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3] hover:text-white'
          }`}
        >
          1. 📦 APERTURA Y MOVIMIENTOS
        </button>
        <button
          type="button"
          onClick={() => {
            if (bloqueadoPorApertura) {
              alert('⚠️ Debes registrar primero la Base de Caja y la Apertura en el Módulo 1.');
              return;
            }
            setModuloActivo('pedidos');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
            moduloActivo === 'pedidos' ? 'bg-[#00a4ef] text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3] hover:text-white'
          }`}
        >
          2. 🚚 PEDIDOS
        </button>
        <button
          type="button"
          onClick={() => {
            if (bloqueadoPorApertura) {
              alert('⚠️ Debes registrar primero la Base de Caja y la Apertura en el Módulo 1.');
              return;
            }
            setModuloActivo('gastos');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
            moduloActivo === 'gastos' ? 'bg-amber-600 text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3] hover:text-white'
          }`}
        >
          3. 💸 GASTOS
        </button>
        <button
          type="button"
          onClick={() => {
            if (bloqueadoPorApertura) {
              alert('⚠️ Debes registrar primero la Base de Caja y la Apertura en el Módulo 1.');
              return;
            }
            setModuloActivo('ventas');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
            moduloActivo === 'ventas' ? 'bg-emerald-600 text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3] hover:text-white'
          }`}
        >
          4. 🛒 VENTAS
        </button>
        <button
          type="button"
          onClick={() => {
            if (bloqueadoPorApertura) {
              alert('⚠️ Debes registrar primero la Base de Caja y la Apertura en el Módulo 1.');
              return;
            }
            setModuloActivo('nomina');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
            moduloActivo === 'nomina' ? 'bg-purple-600 text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3] hover:text-white'
          }`}
        >
          5. 💼 NÓMINA / TURNO
        </button>
        <button
          type="button"
          onClick={() => {
            if (bloqueadoPorApertura) {
              alert('⚠️ Debes registrar primero la Base de Caja y la Apertura en el Módulo 1.');
              return;
            }
            setModuloActivo('cierre');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
            moduloActivo === 'cierre' ? 'bg-rose-600 text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3] hover:text-white'
          }`}
        >
          6. 🔒 CIERRE
        </button>
      </nav>

      {bloqueadoPorApertura && (
        <div className="bg-amber-950/80 border border-amber-400/60 p-3 rounded-xl text-center text-xs text-amber-200 font-bold">
          ⚠️ ATENCIÓN: Debes registrar la Base de Caja y el <b>Conteo Físico de Apertura (Módulo 1)</b> para habilitar las funciones.
        </div>
      )}

      {/* MÓDULO 1: APERTURA Y MOVIMIENTOS */}
      {moduloActivo === 'movimientos' && (
        <div className="bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md max-w-2xl mx-auto">
          <div className="bg-[#051829] border-2 border-emerald-400/70 p-4 rounded-xl space-y-3 shadow-inner">
            <span className="text-xs font-black text-emerald-300 block uppercase border-b border-emerald-400/30 pb-1">
              💵 1. Base Inicial de Caja (Efectivo en Caja al Abrir)
            </span>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Monto en efectivo $"
                value={formatearMoneda(baseCaja)}
                onChange={(e) => setBaseCaja(desformatearMoneda(e.target.value))}
                disabled={baseGuardada || guardandoBase}
                className="w-full bg-[#0e385e] border border-[#0066b3] text-emerald-300 font-black text-sm rounded-xl p-2.5 outline-none"
              />
              <button
                type="button"
                onClick={handleGuardarBase}
                disabled={baseGuardada || guardandoBase}
                className={`font-bold px-6 rounded-xl text-xs transition-all ${baseGuardada ? 'bg-emerald-950 text-emerald-300 border border-emerald-500 cursor-default' : guardandoBase ? 'bg-emerald-800 text-white cursor-not-allowed opacity-75' : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'}`}
              >
                {baseGuardada ? '✓ Base Guardada' : guardandoBase ? '⏳ Guardando...' : 'Guardar Base'}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2 pt-2">
            <h2 className="text-sm font-black text-white flex items-center gap-1.5">
              📦 Conteo Físico de Productos y Movimientos de Inventario
            </h2>
            <span className="bg-[#0078d4] text-white font-black text-[10px] px-3 py-1 rounded-full uppercase">{tipoMovimiento}</span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-sky-300 font-bold block uppercase">Acción a registrar:</span>
            <select
              value={tipoMovimiento}
              onChange={(e) => {
                const nuevoTipo = e.target.value;
                setTipoMovimiento(nuevoTipo);
                limpiarTotalPaletasInv();
                limpiarCantidadesInv();
              }}
              disabled={(!aperturaRealizada && baseGuardada) || guardandoMovimiento}
              className="w-full bg-[#051829] border border-[#0066b3] text-white font-black text-xs rounded-xl p-3 outline-none cursor-pointer"
            >
              {!aperturaRealizada && <option value="apertura">👤 Conteo Físico de Apertura (Obligatorio al iniciar día)</option>}
              <option value="nuevas">📦 Paletas Nuevas (Ingreso)</option>
              <option value="compras">🛒 Compras Directas</option>
              <option value="debaja">⚠️ De Baja / Mermas</option>
            </select>
          </div>

          <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-1">
            <span className="text-xs text-sky-200 font-bold block">CANTIDAD TOTAL PARA [{tipoMovimiento.toUpperCase()}]:</span>
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-white font-black flex items-center gap-1">🍦 Total Paletas:</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder={tipoMovimiento === 'apertura' ? String(obtenerStockActualBD('Total Paletas')) : '0'}
                value={totalPaletasInventario}
                onChange={(e) => setTotalPaletasInventario(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                disabled={guardandoMovimiento}
                className="w-28 bg-[#0e385e] text-sky-200 placeholder-sky-300/40 font-black text-center text-sm rounded-lg p-2 outline-none border border-[#0066b3]"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            <span className="text-xs text-sky-300 font-bold block uppercase">
              {tipoMovimiento === 'apertura' ? 'CONTEO DE EMPAQUES (ORDEN ALFABÉTICO):' : `CANTIDADES DE EMPAQUES A REGISTRAR (${tipoMovimiento.toUpperCase()}):`}
            </span>
            {listaEmpaquesFiltrados.map((item) => {
              const stockItem = obtenerStockActualBD(item);

              return (
                <div key={item} className="flex justify-between items-center bg-[#051829] p-2.5 rounded-lg border border-[#0066b3]">
                  <span className="text-xs text-white font-bold flex items-center gap-1.5">📦 {item}:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={tipoMovimiento === 'apertura' ? String(stockItem) : '0'}
                    value={cantidadesInventario[item] ?? ''}
                    onChange={(e) =>
                      setCantidadesInventario({
                        ...cantidadesInventario,
                        [item]: e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')),
                      })
                    }
                    disabled={guardandoMovimiento}
                    className="w-28 bg-[#0e385e] text-sky-200 placeholder-sky-300/40 font-black text-center text-xs rounded p-2 outline-none border border-[#0066b3]"
                  />
                </div>
              );
            })}
          </div>

          <textarea
            placeholder="Observaciones de inventario..."
            value={observacionesInventario}
            onChange={(e) => setObservacionesInventario(e.target.value)}
            disabled={guardandoMovimiento}
            className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none resize-none h-16"
          />

          <button
            type="button"
            onClick={handleGuardarInventario}
            disabled={!baseGuardada || guardandoMovimiento}
            className={`w-full text-white font-black py-3 rounded-xl text-xs uppercase shadow-md transition-all ${
              guardandoMovimiento 
                ? 'bg-sky-900 cursor-not-allowed opacity-75' 
                : 'bg-[#0078d4] hover:bg-[#0086e6] cursor-pointer disabled:opacity-50'
            }`}
          >
            {guardandoMovimiento ? '⏳ Guardando y Actualizando Stock...' : `💾 Guardar Movimiento (${tipoMovimiento})`}
          </button>
        </div>
      )}

      {/* MÓDULO 2: PEDIDOS */}
      {moduloActivo === 'pedidos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">2. 🚚 Seleccionar Pedido a Bodega</h2>
              <button
                type="button"
                onClick={() => setMostrarModalNuevoProd(true)}
                disabled={enviandoPedido || guardandoProducto}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer shadow disabled:opacity-50 flex items-center gap-1"
              >
                <span>➕</span> Crear Nuevo Producto
              </button>
            </div>

            <div className="sticky top-16 z-30 bg-[#0b2b48] pt-2 pb-2 space-y-2 border-b border-[#0066b3]/40">
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { id: 'paletas', label: 'PALETAS' },
                    { id: 'richi', label: 'RICHI' },
                    { id: 'produccion', label: 'PRODUCCIÓN' },
                    { id: 'insumos', label: 'INSUMOS' },
                    { id: 'aseo', label: 'ASEO' },
                  ] as const
                ).map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setTabPedido(tab.id)}
                    disabled={enviandoPedido}
                    className={`py-2 rounded-xl text-xs font-black uppercase cursor-pointer transition-all ${tabPedido === tab.id ? 'bg-[#00a4ef] text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3]'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Buscar producto en esta categoría..."
                  value={busquedaInsumoPedido}
                  onChange={(e) => setBusquedaInsumoPedido(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs font-bold rounded-xl p-2.5 pr-8 outline-none shadow-inner"
                />
                {busquedaInsumoPedido && (
                  <button
                    type="button"
                    onClick={() => setBusquedaInsumoPedido('')}
                    className="absolute right-3 top-3 text-sky-300 hover:text-white font-black text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
              {insumosFiltrados.length === 0 ? (
                <p className="text-xs text-sky-400 italic text-center py-8">No hay productos disponibles en esta categoría.</p>
              ) : (
                insumosFiltrados.map((prod) => (
                  <div key={prod.id || prod.nombre} className="flex justify-between items-center bg-[#051829] p-3 rounded-xl border border-[#0066b3]">
                    <div className="flex items-center gap-2">
                      {tabPedido !== 'paletas' && (
                        <button
                          type="button"
                          onClick={() => desactivarProductoDeSede(prod.id, prod.nombre)}
                          title="Eliminar de la lista"
                          className="text-sky-400 hover:text-rose-400 font-black text-xs px-1 cursor-pointer transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                      <p className="text-xs text-white font-bold">{prod.nombre}</p>
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
                      disabled={enviandoPedido}
                      className="w-24 bg-[#0e385e] text-sky-200 font-black text-center text-xs rounded-lg p-2 outline-none border border-[#0066b3]"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-xs font-black text-sky-200 uppercase flex items-center gap-1.5">
                🛒 LISTADO DEL PEDIDO EN CURSO ({resumenPedidoActual.length} ÍTEMS)
              </h3>
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 bg-[#051829] p-3 rounded-xl border border-[#0066b3]">
              {resumenPedidoActual.length === 0 ? (
                <p className="text-xs text-sky-400 italic text-center py-6">
                  Aún no has seleccionado ningún producto para enviar en este pedido.
                </p>
              ) : (
                resumenPedidoActual.map((item, idx) => (
                  <div key={`${item.categoria}_${item.nombre}_${idx}`} className="bg-[#0e385e] border border-[#0066b3] p-2.5 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white block">{item.nombre}</span>
                      <span className="text-[10px] text-sky-300 uppercase">CAT: {item.categoria}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-600 text-white font-black text-[11px] px-2 py-0.5 rounded-md">
                        {item.cantidad} un.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPedidosCategorias((prev) => {
                            const catActual = { ...prev[item.categoria as CategoriaTab] };
                            delete catActual[item.nombre];
                            return { ...prev, [item.categoria]: catActual };
                          });
                        }}
                        disabled={enviandoPedido}
                        title="Quitar ítem"
                        className="text-sky-300 hover:text-rose-400 font-black text-sm px-1 rounded transition-colors cursor-pointer disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <textarea
              placeholder="Observaciones para el pedido a bodega..."
              value={observacionPedido}
              onChange={(e) => setObservacionPedido(e.target.value)}
              disabled={enviandoPedido}
              className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none resize-none h-16"
            />

            <button
              type="button"
              onClick={enviarPedidoBodega}
              disabled={enviandoPedido}
              className={`w-full font-black py-3 rounded-xl text-xs uppercase shadow-md transition-all flex items-center justify-center gap-2 ${
                enviandoPedido
                  ? 'bg-emerald-800 text-white cursor-not-allowed opacity-75'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              }`}
            >
              <span>🚀</span> {enviandoPedido ? '⏳ ENVIANDO PEDIDO...' : `ENVIAR PEDIDO A BODEGA (${resumenPedidoActual.length} PRODUCTOS)`}
            </button>
          </div>

          <div className="lg:col-span-12 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-3 shadow-md mt-2">
            <div className="flex flex-wrap justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-xs font-black text-sky-200 uppercase">
                📋 CONTROL DE PEDIDOS SOLICITADOS HOY (CHULO POR CADA PRODUCTO)
              </h3>
              <button
                type="button"
                onClick={pasarFaltantesAlListadoActual}
                className="bg-amber-600 hover:bg-amber-500 text-white font-black text-xs px-3 py-1.5 rounded-xl cursor-pointer shadow transition-all flex items-center gap-1.5"
              >
                <span>🔄</span> Pasar Faltantes al Listado de Hoy
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
              {historialPedidosBD.length === 0 ? (
                <p className="text-xs text-sky-400 italic text-center py-6">
                  No hay pedidos solicitados hoy en la base de datos.
                </p>
              ) : (
                historialPedidosBD.map((ped) => {
                  const horaPed = new Date(ped.fecha).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });

                  const tienePendientes = (['pedidos_paletas', 'pedidos_richi', 'pedidos_produccion', 'pedidos_insumos', 'pedidos_aseo'] as const).some((colCat) => {
                    const mapa = ped[colCat];
                    if (!mapa || typeof mapa !== 'object') return false;
                    return Object.values(mapa).some((val: any) => {
                      const entregado = typeof val === 'object' && val !== null ? val.entregado : false;
                      const cant = typeof val === 'object' && val !== null ? Number(val.cantidad || 0) : Number(val || 0);
                      return !entregado && cant > 0;
                    });
                  });

                  if (!tienePendientes) return null;

                  return (
                    <div key={ped.id} className="bg-[#051829] border border-[#0066b3] p-3.5 rounded-xl space-y-2.5">
                      <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
                        <span className="font-black text-white text-xs">
                          Pedido #{ped.id} ({horaPed}) - Haz clic en el chulo de cada producto cuando llegue.
                        </span>
                        <button
                          type="button"
                          onClick={() => borrarPedidosBD([ped.id])}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
                        >
                          🗑️ Eliminar Pedido
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                        {(['pedidos_paletas', 'pedidos_richi', 'pedidos_produccion', 'pedidos_insumos', 'pedidos_aseo'] as const).map((colCat) => {
                          const mapa = ped[colCat];
                          if (!mapa || Object.keys(mapa).length === 0) return null;

                          return Object.entries(mapa).map(([nom, val]: [string, any]) => {
                            const cant = typeof val === 'object' && val !== null ? val.cantidad : val;
                            const entregado = typeof val === 'object' && val !== null ? val.entregado : false;

                            if (entregado) return null;

                            return (
                              <div key={`${ped.id}_${nom}`} className="border p-2 rounded-lg flex justify-between items-center text-xs bg-[#0e385e] border-[#0066b3]">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleChuloProductoPedido(ped.id, colCat, nom)}
                                    title="Marcar como entregado"
                                    className="w-5 h-5 rounded font-black text-xs flex items-center justify-center cursor-pointer transition-all bg-[#051829] border border-sky-400 text-sky-300"
                                  >
                                    ✓
                                  </button>
                                  <span className="font-bold truncate max-w-[130px] text-white">
                                    {nom}
                                  </span>
                                </div>
                                <span className="bg-emerald-600 text-white font-black text-[11px] px-2 py-0.5 rounded-md">
                                  {cant} un.
                                </span>
                              </div>
                            );
                          });
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MÓDULO 3: GASTOS */}
      {moduloActivo === 'gastos' && (
        <div className="bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md max-w-2xl mx-auto">
          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
            <h2 className="text-sm font-black text-white flex items-center gap-1.5">
              3. 💸 Registro de Gastos Directos de Insumos (Descuenta de Caja)
            </h2>
            <span className="text-xs font-black text-amber-300 bg-[#051829] px-3 py-1 rounded-full border border-amber-500/40">
              Total Gastos Insumos: {formatearMoneda(totalGastosHoy) || '$ 0'}
            </span>
          </div>

          <div className="bg-[#051829] border border-[#0066b3] p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="Concepto (ej. 1 kg fresa, plátanos, bolsas...)"
                value={descripcionGasto}
                onChange={(e) => setDescripcionGasto(e.target.value)}
                disabled={guardandoGasto}
                className="md:col-span-7 bg-[#0e385e] border border-[#0066b3] text-white font-bold text-xs rounded-xl p-2.5 outline-none placeholder-sky-300/40"
              />
              <input
                type="text"
                placeholder="Monto $"
                value={formatearMoneda(montoGasto)}
                onChange={(e) => setMontoGasto(desformatearMoneda(e.target.value))}
                disabled={guardandoGasto}
                className="md:col-span-3 bg-[#0e385e] border border-[#0066b3] text-amber-300 font-black text-xs rounded-xl p-2.5 outline-none"
              />
              <button
                type="button"
                onClick={handleGuardarGasto}
                disabled={guardandoGasto}
                className="md:col-span-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl py-2.5 transition-all cursor-pointer shadow disabled:opacity-50"
              >
                {guardandoGasto ? '⏳...' : '+ GASTO'}
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-black text-sky-200 uppercase">
              HISTORIAL DE SALIDAS DE CAJA HOY:
            </h3>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {gastosDiaBD.length === 0 ? (
                <p className="text-xs text-sky-400 italic text-center py-6">
                  No hay gastos de insumos registrados hoy.
                </p>
              ) : (
                gastosDiaBD.map((gasto) => (
                  <div
                    key={gasto.id}
                    className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">{gasto.descripcion}</p>
                      <p className="text-[10px] text-sky-300">
                        Hora:{' '}
                        {new Date(gasto.fecha).toLocaleTimeString('es-CO', {
                          timeZone: 'America/Bogota',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-black text-amber-300 text-sm">
                        {formatearMoneda(gasto.monto)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleBorrarGastoBD(gasto.id, gasto.descripcion)}
                        title="Eliminar gasto"
                        className="text-sky-400 hover:text-rose-400 font-black text-xs px-1 cursor-pointer transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MÓDULO 4: VENTAS Y CANALES DIRECTOS (MESAS, PASILLOS Y RAPPI) */}
      {moduloActivo === 'ventas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 bg-[#0b2b48] border border-[#0066b3] p-3 rounded-2xl shadow-md items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                📊 Accesos Rápidos de Ventas:
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await cargarVentasDiaBD(sedeIdActual);
                  setMostrarModalResumenCaja(true);
                }}
                className="bg-[#0078d4] hover:bg-[#0086e6] text-white font-black text-xs px-4 py-2 rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>📊</span> Resumen de Caja
              </button>
              <button
                type="button"
                onClick={async () => {
                  await cargarVentasDiaBD(sedeIdActual);
                  setMostrarModalFacturasPagas(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2 rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>📋</span> Resumen Facturas Pagas ({ventasDiaBD.length})
              </button>
            </div>
          </div>

          {modoVentas === 'pregunta' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#0b2b48] border-2 border-[#0066b3] w-full max-w-md rounded-2xl p-6 space-y-5 text-center shadow-2xl">
                <div className="text-3xl">🛒</div>
                <h3 className="text-base font-black text-white">
                  ¿Deseas realizar las ventas directamente en este sistema?
                </h3>
                <p className="text-xs text-sky-200">
                  Selecciona <b>SÍ</b> para vender directamente desde las mesas, pasillos y Rappi, o <b>NO</b> para registrar los totales de otro sistema.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModoVentas('externo')}
                    className="w-1/2 bg-[#051829] border border-amber-500/50 hover:bg-[#08223a] text-amber-300 font-black py-3 rounded-xl text-xs uppercase cursor-pointer"
                  >
                    NO (OTRO SISTEMA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVentas('pos_propio')}
                    className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase shadow cursor-pointer"
                  >
                    SÍ (USAR ESTE SISTEMA)
                  </button>
                </div>
              </div>
            </div>
          )}

          {modoVentas === 'externo' && (
            <div className="bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md max-w-xl mx-auto">
              <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
                <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                  📲 Registro de Totales de Ventas (Sistema Externo)
                </h2>
                <button
                  type="button"
                  onClick={() => setModoVentas('pregunta')}
                  className="text-xs text-sky-300 hover:text-white underline font-bold cursor-pointer"
                >
                  Cambiar opción
                </button>
              </div>

              <div className="bg-[#051829] border border-[#0066b3] p-4 rounded-xl space-y-3">
                <div>
                  <label className="text-xs font-bold text-sky-200 block mb-1">
                    💵 Total Efectivo (Según Sistema Externo):
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={formatearMoneda(externoEfectivo)}
                    onChange={(e) => setExternoEfectivo(desformatearMoneda(e.target.value))}
                    disabled={guardandoExterno}
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-emerald-300 font-black text-sm rounded-xl p-2.5 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-sky-200 block mb-1">
                    🟣 Total Nequi:
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={formatearMoneda(externoNequi)}
                    onChange={(e) => setExternoNequi(desformatearMoneda(e.target.value))}
                    disabled={guardandoExterno}
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-purple-300 font-black text-sm rounded-xl p-2.5 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-sky-200 block mb-1">
                    🔴 Total Daviplata:
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={formatearMoneda(externoDaviplata)}
                    onChange={(e) => setExternoDaviplata(desformatearMoneda(e.target.value))}
                    disabled={guardandoExterno}
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-rose-300 font-black text-sm rounded-xl p-2.5 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-sky-200 block mb-1">
                    🟠 Total Rappi:
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={formatearMoneda(externoRappi)}
                    onChange={(e) => setExternoRappi(desformatearMoneda(e.target.value))}
                    disabled={guardandoExterno}
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-orange-400 font-black text-sm rounded-xl p-2.5 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-sky-200 block mb-1">
                    💳 Total Tarjetas / Otros:
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={formatearMoneda(externoOtros)}
                    onChange={(e) => setExternoOtros(desformatearMoneda(e.target.value))}
                    disabled={guardandoExterno}
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-sky-300 font-black text-sm rounded-xl p-2.5 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGuardarVentasExternas}
                  disabled={guardandoExterno}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 rounded-xl uppercase shadow transition-all cursor-pointer disabled:opacity-50 mt-2"
                >
                  {guardandoExterno ? '⏳ Guardando...' : '💾 Guardar Totales en Caja'}
                </button>
              </div>
            </div>
          )}

          {modoVentas === 'pos_propio' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-3 bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-4 shadow-md">
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
                    <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase">
                      🪑 Mesas / Pasillos
                    </span>
                    <button
                      type="button"
                      onClick={agregarPasilloMesa}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer shadow"
                    >
                      + Pasillo (Para Llevar)
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {mesasBD.map((mesa) => {
                      const esActiva = tipoCanalSeleccionado === 'mesa' && mesaSeleccionada === mesa.id;
                      const itemsMesa = carritosPorMesa[mesa.id] || [];
                      const subtotalMesa = itemsMesa.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

                      return (
                        <div
                          key={mesa.id}
                          onClick={() => {
                            setMesaSeleccionada(mesa.id);
                            setTipoCanalSeleccionado('mesa');
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            esActiva
                              ? 'bg-[#0078d4] border-white text-white shadow-lg'
                              : 'bg-[#051829] border-[#0066b3] text-sky-200 hover:border-sky-400'
                          }`}
                        >
                          <div className="flex justify-between items-center font-black text-xs">
                            <span>{mesa.nombre || `MESA ${mesa.id}`}</span>
                            <span className={subtotalMesa > 0 ? 'text-emerald-300' : 'text-sky-400'}>
                              {formatearMoneda(subtotalMesa) || '$ 0'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 border-t border-[#0066b3]/50 pt-3">
                  <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
                    <span className="text-xs font-black text-orange-400 flex items-center gap-1.5 uppercase">
                      🟠 Pedidos Rappi
                    </span>
                    <button
                      type="button"
                      onClick={crearNuevoPedidoRappi}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <span>➕</span> Nuevo Rappi
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {pedidosRappi.length === 0 ? (
                      <p className="text-[11px] text-sky-400 italic py-2 text-center">
                        No hay pedidos activos de Rappi.
                      </p>
                    ) : (
                      pedidosRappi.map((rap) => {
                        const esActivo = tipoCanalSeleccionado === 'rappi' && rappiSeleccionadoId === rap.id;
                        const subtotalRappi = rap.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

                        return (
                          <div
                            key={rap.id}
                            onClick={() => {
                              setRappiSeleccionadoId(rap.id);
                              setTipoCanalSeleccionado('rappi');
                            }}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                              esActivo
                                ? 'bg-orange-600 border-white text-white shadow-lg'
                                : 'bg-[#051829] border-orange-500/40 text-orange-200 hover:border-orange-400'
                            }`}
                          >
                            <div className="flex justify-between items-center font-black text-xs">
                              <span>🛵 Pedido {rap.codigo}</span>
                              <span className="text-white">{formatearMoneda(subtotalRappi) || '$ 0'}</span>
                            </div>
                            <span className="text-[10px] text-orange-100 font-bold block mt-0.5">
                              {rap.items.length > 0 ? `📦 ${rap.items.length} producto(s)` : 'Listo para armar'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md">
                <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
                  <span className="text-xs font-black uppercase text-white">
                    📁 Catálogo de Productos
                  </span>
                  <button
                    type="button"
                    onClick={() => setModoVentas('pregunta')}
                    className="text-[10px] text-sky-300 hover:text-white underline font-bold cursor-pointer"
                  >
                    Cambiar Opción
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="🔍 Buscar producto por nombre..."
                    value={busquedaProductoVenta}
                    onChange={(e) => setBusquedaProductoVenta(e.target.value)}
                    className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs font-bold rounded-xl p-2.5 outline-none"
                  />

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button
                      type="button"
                      onClick={() => setCategoriaVentaFiltro('TODAS')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase cursor-pointer whitespace-nowrap ${
                        categoriaVentaFiltro === 'TODAS'
                          ? 'bg-[#00a4ef] text-white'
                          : 'bg-[#051829] text-sky-300 border border-[#0066b3]'
                      }`}
                    >
                      ⭐ TODAS
                    </button>
                    {categoriasVentaDisponibles.map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setCategoriaVentaFiltro(cat)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase cursor-pointer whitespace-nowrap ${
                          categoriaVentaFiltro.toLowerCase() === cat.toLowerCase()
                            ? 'bg-[#00a4ef] text-white'
                            : 'bg-[#051829] text-sky-300 border border-[#0066b3]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[380px] overflow-y-auto pr-1">
                  {productosVentaFiltrados.length === 0 ? (
                    <p className="text-xs text-sky-400 italic text-center py-10">
                      No hay productos disponibles en esta categoría.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {productosVentaFiltrados.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => agregarProductoACarrito(prod)}
                          className="bg-[#051829] border border-[#0066b3] hover:border-emerald-400 p-2.5 rounded-xl flex flex-col justify-between text-left space-y-2 cursor-pointer transition-all shadow"
                        >
                          <div>
                            <p className="text-xs font-bold text-white line-clamp-2">{prod.nombre}</p>
                            <p className="text-[10px] text-sky-300 uppercase mt-0.5">{prod.categoria || 'General'}</p>
                          </div>
                          <p className="text-xs font-black text-emerald-300">
                            {formatearMoneda(prod.precio)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3 bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md">
                <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
                  <span className="text-xs font-black uppercase text-white">
                    {tipoCanalSeleccionado === 'mesa'
                      ? `🛒 ${mesasBD.find((m) => m.id === mesaSeleccionada)?.nombre || 'MESA'}`
                      : `🛵 RAPPI: ${rappiActual ? rappiActual.codigo : 'NINGUNO'}`}
                  </span>
                </div>

                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 bg-[#051829] p-2.5 rounded-xl border border-[#0066b3]">
                  {carritoActual.length === 0 ? (
                    <p className="text-xs text-sky-400 italic text-center py-8">
                      {tipoCanalSeleccionado === 'mesa'
                        ? 'Mesa o pasillo vacío. Selecciona productos.'
                        : 'Pedido de Rappi vacío. Agrega productos.'}
                    </p>
                  ) : (
                    carritoActual.map((item) => (
                      <div key={item.id} className="bg-[#0e385e] border border-[#0066b3] p-2 rounded-lg flex justify-between items-center text-xs">
                        <div className="max-w-[110px]">
                          <p className="font-bold text-white truncate">{item.nombre}</p>
                          <p className="text-[10px] text-emerald-300 font-bold">{formatearMoneda(item.precio * item.cantidad)}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => cambiarCantidadItem(item.id, -1)}
                            className="bg-[#051829] border border-[#0066b3] text-white font-black text-xs px-2 py-0.5 rounded cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-black text-white text-xs">{item.cantidad}</span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidadItem(item.id, 1)}
                            className="bg-[#051829] border border-[#0066b3] text-white font-black text-xs px-2 py-0.5 rounded cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-[#051829] border border-[#0066b3] p-2.5 rounded-xl space-y-1.5">
                  <span className="text-[11px] text-purple-300 font-black block uppercase">➕ AGREGAR ADICIÓN ($)</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="$ Monto adición"
                      value={formatearMoneda(valorAdicionInput)}
                      onChange={(e) => setValorAdicionInput(desformatearMoneda(e.target.value))}
                      className="w-full bg-[#0e385e] border border-[#0066b3] text-purple-300 font-bold text-xs p-1.5 rounded-lg outline-none"
                    />
                    <button
                      type="button"
                      onClick={agregarAdicionDirecta}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center text-sky-200">
                    <span>Subtotal:</span>
                    <span className="font-bold text-white">{formatearMoneda(subtotalMesaActual) || '$ 0'}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-300 font-black text-sm pt-1 border-t border-[#0066b3]/50">
                    <span>Total:</span>
                    <span>{formatearMoneda(subtotalMesaActual) || '$ 0'}</span>
                  </div>
                </div>

                {tipoCanalSeleccionado === 'mesa' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (carritoActual.length === 0) {
                        alert('⚠️ Agrega al menos un producto al carrito para cobrar.');
                        return;
                      }
                      setMostrarModalPago(true);
                    }}
                    disabled={carritoActual.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 rounded-xl uppercase shadow cursor-pointer disabled:opacity-50"
                  >
                    💳 COBRAR Y REGISTRAR PAGO
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEntregarPedidoRappiDirecto}
                    disabled={carritoActual.length === 0 || guardandoVenta}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black text-xs py-3 rounded-xl uppercase shadow cursor-pointer disabled:opacity-50"
                  >
                    🚀 ENTREGAR Y REGISTRAR RAPPI
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MÓDULO 5: NÓMINA Y CAMBIO DE TURNO */}
      {moduloActivo === 'nomina' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-6 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                5. 💼 Registro de Nómina
              </h2>
              <span className="bg-purple-900/60 border border-purple-500/50 text-purple-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                Turno: {sesion?.turno_nombre || 'General'}
              </span>
            </div>

            <div className="bg-[#051829] border border-[#0066b3] p-4 rounded-xl space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipoPersonaNomina('operador')}
                  className={`w-1/2 py-2 rounded-lg text-xs font-black uppercase cursor-pointer ${
                    tipoPersonaNomina === 'operador'
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#0e385e] text-sky-300 border border-[#0066b3]'
                  }`}
                >
                  👤 Operador ({sesion?.nombre || sesion?.usuario_nombre || 'Actual'})
                </button>
                <button
                  type="button"
                  onClick={() => setTipoPersonaNomina('ayudante')}
                  className={`w-1/2 py-2 rounded-lg text-xs font-black uppercase cursor-pointer ${
                    tipoPersonaNomina === 'ayudante'
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#0e385e] text-sky-300 border border-[#0066b3]'
                  }`}
                >
                  🤝 Ayudante
                </button>
              </div>

              {tipoPersonaNomina === 'ayudante' && (
                <div>
                  <label className="text-xs text-sky-200 font-bold block mb-1">Seleccionar Ayudante:</label>
                  <select
                    value={ayudanteSeleccionadoId}
                    onChange={(e) => setAyudanteSeleccionadoId(e.target.value)}
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-white p-2.5 rounded-xl outline-none font-bold cursor-pointer text-xs"
                  >
                    {usuariosBD.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-sky-200 font-bold block mb-1">Horas Día:</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={horasDiaNomina}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setHorasDiaNomina(val);
                      }
                    }}
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-white font-bold text-xs p-2.5 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-sky-200 font-bold block mb-1">Horas Noche:</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={horasNocheNomina}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setHorasNocheNomina(val);
                      }
                    }}
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-white font-bold text-xs p-2.5 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-sky-200 font-bold block mb-1">Total a Pagar ($):</label>
                <input
                  type="text"
                  placeholder="$ 0"
                  value={formatearMoneda(montoTotalNomina)}
                  onChange={(e) => setMontoTotalNomina(desformatearMoneda(e.target.value))}
                  className="w-full bg-[#0e385e] border border-[#0066b3] text-purple-300 font-black text-sm p-2.5 rounded-xl outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleGuardarNomina}
                disabled={guardandoNomina}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-xs py-3 rounded-xl uppercase shadow cursor-pointer disabled:opacity-50"
              >
                {guardandoNomina ? '⏳ Guardando...' : '💾 Registrar Pago de Nómina'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                🔄 Control y Cambio de Turno
              </h2>
            </div>

            <div className="bg-[#051829] border border-[#0066b3] p-4 rounded-xl space-y-3 text-xs">
              <p className="text-sky-200">
                Operador en Turno actual: <b className="text-white">{sesion?.nombre || sesion?.usuario_nombre}</b>
              </p>
              <p className="text-sky-200">
                Modalidad de Turno: <b className="text-amber-300">{sesion?.turno_nombre || 'DÍA COMPLETO'}</b>
              </p>

              {esTurnoMañanaApertura ? (
                <div className="space-y-3 border-t border-[#0066b3]/50 pt-3">
                  <p className="text-amber-200 font-bold">
                    ⚠️ Turno de Mañana/Apertura detectado: Al entregar turno, se cerrará tu registro de caja y el operario entrante iniciará con el efectivo físico que dejes.
                  </p>

                  <div>
                    <label className="text-sky-200 font-bold block mb-1">
                      💵 ¿Cuánta plata física deja en caja para el siguiente operario?:
                    </label>
                    <input
                      type="text"
                      placeholder="$ 0"
                      value={formatearMoneda(plataDejaEnCaja)}
                      onChange={(e) => setPlataDejaEnCaja(desformatearMoneda(e.target.value))}
                      className="w-full bg-[#0e385e] border border-[#0066b3] text-emerald-300 font-black text-sm p-2.5 rounded-xl outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setMostrarModalCambioTurno(true)}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black text-xs py-3 rounded-xl uppercase shadow cursor-pointer"
                  >
                    🔐 Cerrar Mi Turno y Entregar Caja
                  </button>
                </div>
              ) : (
                <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3] text-sky-200 font-bold">
                  ✓ El turno actual es <b>DÍA COMPLETO</b>. No se solicita cambio de turno obligatorio durante la jornada.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-12 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-3 shadow-md mt-2">
            <h3 className="text-xs font-black text-sky-200 uppercase flex items-center justify-between">
              <span>📋 HISTORIAL DE NÓMINAS PAGADAS HOY ({nominasDiaBD.length})</span>
            </h3>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {nominasDiaBD.length === 0 ? (
                <p className="text-xs text-rose-300 italic text-center py-6 font-bold">
                  ⚠️ No hay pagos de nómina registrados el día de hoy (Requerido para el Cierre).
                </p>
              ) : (
                nominasDiaBD.map((nom) => (
                  <div key={nom.id} className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white">{nom.concepto || 'Pago de turno'}</p>
                      <p className="text-[10px] text-sky-300">
                        Fecha Pago: {nom.fecha_pago || 'Hoy'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-purple-300 text-sm block">
                        {formatearMoneda(nom.monto)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MÓDULO 6: CIERRE */}
      {moduloActivo === 'cierre' && (
        <div className="bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-5 shadow-md max-w-4xl mx-auto">
          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-3">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              🔒 6. MÓDULO DE CIERRE DE TURNO / DÍA
            </h2>
            <span className="bg-rose-900/60 border border-rose-500/50 text-rose-200 text-xs font-black px-3 py-1 rounded-full uppercase">
              Cierre Sede
            </span>
          </div>

          <div className="space-y-3 bg-[#051829] border border-[#0066b3] p-4 rounded-xl">
            <h3 className="text-xs font-black text-sky-300 uppercase">
              📦 Conteo Físico de Empaques y Paletas (Cierre)
            </h3>

            <div className="flex justify-between items-center bg-[#0e385e] p-3 rounded-xl border border-[#0066b3]">
              <span className="text-xs text-white font-black flex items-center gap-1.5">🍦 Total Paletas (Stock actual: {obtenerStockActualBD('Total Paletas')}):</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder={String(obtenerStockActualBD('Total Paletas'))}
                value={totalPaletasCierre}
                onChange={(e) => setTotalPaletasCierre(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                className="w-32 bg-[#051829] text-sky-200 placeholder-sky-300/40 font-black text-center text-sm rounded-lg p-2 outline-none border border-[#0066b3]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {listaEmpaquesFiltrados.map((item) => {
                const stockItem = obtenerStockActualBD(item);
                return (
                  <div key={item} className="flex justify-between items-center bg-[#0e385e] p-2.5 rounded-lg border border-[#0066b3]">
                    <span className="text-xs text-white font-bold truncate max-w-[160px]" title={item}>
                      📦 {item} <span className="text-[10px] text-sky-300 font-normal">({stockItem})</span>:
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={String(stockItem)}
                      value={cantidadesCierre[item] ?? ''}
                      onChange={(e) =>
                        setCantidadesCierre({
                          ...cantidadesCierre,
                          [item]: e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')),
                        })
                      }
                      className="w-28 bg-[#051829] text-sky-200 placeholder-sky-300/40 font-black text-center text-xs rounded p-2 outline-none border border-[#0066b3]"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 bg-[#051829] border border-[#0066b3] p-4 rounded-xl text-xs">
            <h3 className="text-xs font-black text-sky-300 uppercase border-b border-[#0066b3]/50 pb-2">
              📊 Resumen Contable y Totales de Hoy (Incluye Tarjetas / Otros)
            </h3>

            <div className="bg-[#0e385e] border border-emerald-500/60 p-3 rounded-xl flex justify-between items-center mb-2">
              <span className="text-emerald-300 font-black">💵 Base Inicial de Caja (Apertura Módulo 1):</span>
              <span className="font-black text-white">{formatearMoneda(efectivoBaseCajaInicial) || '$ 0'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3] flex justify-between items-center">
                <span className="text-amber-300 font-bold">💸 Total Gastos (Insumos):</span>
                <span className="font-black text-white">{formatearMoneda(totalGastosHoy) || '$ 0'}</span>
              </div>
              <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3] flex justify-between items-center">
                <span className="text-purple-300 font-bold">💼 Total Nóminas ({nominasDiaBD.length} registradas):</span>
                <span className="font-black text-white">{formatearMoneda(totalNominasHoy) || '$ 0'}</span>
              </div>
              <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3] flex justify-between items-center">
                <span className="text-emerald-300 font-bold">💵 Total Efectivo:</span>
                <span className="font-black text-white">{formatearMoneda(totalEfectivoJornada) || '$ 0'}</span>
              </div>
              <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3] flex justify-between items-center">
                <span className="text-purple-300 font-bold">🟣 Total Nequi:</span>
                <span className="font-black text-white">{formatearMoneda(totalNequiJornada) || '$ 0'}</span>
              </div>
              <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3] flex justify-between items-center">
                <span className="text-rose-300 font-bold">🔴 Total Daviplata:</span>
                <span className="font-black text-white">{formatearMoneda(totalDaviplataJornada) || '$ 0'}</span>
              </div>
              <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3] flex justify-between items-center">
                <span className="text-orange-300 font-bold">🟠 Total Rappi:</span>
                <span className="font-black text-white">{formatearMoneda(totalRappiJornada) || '$ 0'}</span>
              </div>
              <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3] flex justify-between items-center sm:col-span-2">
                <span className="text-sky-300 font-bold">💳 Total Tarjetas / Otros:</span>
                <span className="font-black text-white">{formatearMoneda(totalOtrosJornada) || '$ 0'}</span>
              </div>
            </div>

            <div className="bg-[#0e385e] border-2 border-emerald-500 p-3.5 rounded-xl flex justify-between items-center text-sm mt-2">
              <span className="font-black text-emerald-300 uppercase">📈 Gran Total de Todas las Ventas:</span>
              <span className="font-black text-white">{formatearMoneda(granTotalVentasJornada) || '$ 0'}</span>
            </div>

            {totalNominasHoy > 0 && (
              <div className={`p-3 rounded-xl border font-black text-xs flex justify-between items-center mt-2 ${diferenciaNominaVentas >= 0 ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500' : 'bg-rose-950/80 text-rose-300 border-rose-500'}`}>
                <span>{diferenciaNominaVentas >= 0 ? '✓ Las ventas cubren perfectamente la nómina:' : '⚠️ Faltó dinero para completar la nómina:'}</span>
                <span className="text-sm">
                  {diferenciaNominaVentas >= 0 ? `Sobrante tras nómina: ${formatearMoneda(diferenciaNominaVentas)}` : `Faltó: ${formatearMoneda(Math.abs(diferenciaNominaVentas))}`}
                </span>
              </div>
            )}

            <div className="bg-[#0e385e] border-2 border-rose-500/60 p-4 rounded-xl space-y-3 mt-2">
              <label className="text-white font-black block uppercase">
                💵 ¿Cuánto dinero físico hay en caja (Efectivo contado)? * (Obligatorio - Puedes poner 0 si está vacía)
              </label>
              <input
                type="text"
                placeholder="$ 0"
                value={dineroFisicoCierre === '' ? '' : formatearMoneda(dineroFisicoCierre)}
                onChange={(e) => setDineroFisicoCierre(desformatearMoneda(e.target.value))}
                className="w-full bg-[#051829] border border-[#0066b3] text-emerald-300 font-black text-sm p-3 rounded-xl outline-none"
              />

              {dineroFisicoCierre !== '' && (
                <div className={`p-3 rounded-lg font-black text-xs flex justify-between items-center ${diferenciaCierreVal === 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500' : 'bg-rose-950/80 text-rose-300 border border-rose-500'}`}>
                  <span>{diferenciaCierreVal === 0 ? '✓ Cuadre perfecto de caja (Sin diferencias)' : '⚠️ Hay una diferencia en efectivo:'}</span>
                  <span className="text-sm">{formatearMoneda(Math.abs(diferenciaCierreVal))} {diferenciaCierreVal < 0 ? '(Faltante)' : diferenciaCierreVal > 0 ? '(Sobrante)' : ''}</span>
                </div>
              )}
            </div>

            <textarea
              placeholder="Observaciones de cierre..."
              value={observacionesCierre}
              onChange={(e) => setObservacionesCierre(e.target.value)}
              className="w-full bg-[#0e385e] border border-[#0066b3] text-white text-xs p-3 rounded-xl outline-none resize-none h-16"
            />

            <button
              type="button"
              onClick={handleGuardarCierreFinal}
              disabled={guardandoCierre}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3.5 rounded-xl text-xs uppercase shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {guardandoCierre ? '⏳ Guardando Cierre...' : '🔒 FINALIZAR Y GUARDAR CIERRE DE TURNO'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL RESUMEN DE CAJA */}
      {mostrarModalResumenCaja && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border-2 border-[#0066b3] w-full max-w-md rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                📊 RESUMEN DE CAJA (VENTAS DE HOY)
              </h3>
              <button
                type="button"
                onClick={() => setMostrarModalResumenCaja(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {cargandoResumenVentas ? (
              <p className="text-xs text-sky-300 text-center py-6">Cargando resumen de caja...</p>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center">
                  <span className="text-emerald-300 font-bold">💵 Total Efectivo:</span>
                  <span className="font-black text-white">{formatearMoneda(totalEfectivoVentasPos) || '$ 0'}</span>
                </div>
                <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center">
                  <span className="text-purple-300 font-bold">🟣 Total Nequi:</span>
                  <span className="font-black text-white">{formatearMoneda(totalNequiVentasPos) || '$ 0'}</span>
                </div>
                <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center">
                  <span className="text-rose-300 font-bold">🔴 Total Daviplata:</span>
                  <span className="font-black text-white">{formatearMoneda(totalDaviplataVentasPos) || '$ 0'}</span>
                </div>
                <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center">
                  <span className="text-orange-300 font-bold">🟠 Total Rappi:</span>
                  <span className="font-black text-white">{formatearMoneda(totalRappiVentasPos) || '$ 0'}</span>
                </div>
                <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center">
                  <span className="text-sky-200 font-bold">💳 Total Tarjetas / Otros:</span>
                  <span className="font-black text-white">{formatearMoneda(totalOtrosVentasPos) || '$ 0'}</span>
                </div>

                <div className="bg-[#0e385e] border-2 border-emerald-400 p-3.5 rounded-xl flex justify-between items-center text-sm">
                  <span className="font-black text-emerald-300 uppercase">Gran Total Ventas:</span>
                  <span className="font-black text-white">{formatearMoneda(granTotalVentasBD) || '$ 0'}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMostrarModalResumenCaja(false)}
              className="w-full bg-[#0078d4] hover:bg-[#0086e6] text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer mt-2"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}

      {/* MODAL RESUMEN FACTURAS PAGAS */}
      {mostrarModalFacturasPagas && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border-2 border-[#0066b3] w-full max-w-2xl rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                📋 FACTURAS PAGAS DE HOY ({ventasDiaBD.length})
              </h3>
              <button
                type="button"
                onClick={() => setMostrarModalFacturasPagas(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {cargandoResumenVentas ? (
              <p className="text-xs text-sky-300 text-center py-8">Cargando facturas pagas...</p>
            ) : ventasDiaBD.length === 0 ? (
              <p className="text-xs text-sky-400 italic text-center py-8">No hay facturas pagas registradas hoy en la base de datos.</p>
            ) : (
              <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                {ventasDiaBD.map((venta) => {
                  const horaVenta = new Date(venta.fecha_hora || venta.created_at).toLocaleTimeString('es-CO', {
                    timeZone: 'America/Bogota',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const itemsVenta = Array.isArray(venta.items) ? venta.items : [];

                  return (
                    <div key={venta.id} className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-1.5">
                        <span className="font-black text-white">Factura #{venta.id} ({venta.tipo_venta || 'local'})</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-sky-300">Hora: {horaVenta}</span>
                          <span className="bg-emerald-600 text-white font-black px-2 py-0.5 rounded text-[11px]">
                            {formatearMoneda(venta.monto_total)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-sky-300 font-bold block">Ítems comprados:</span>
                        {itemsVenta.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-[#0e385e] px-2.5 py-1 rounded">
                            <span className="text-white font-bold">{it.nombre} (x{it.cantidad})</span>
                            <span className="text-emerald-300">{formatearMoneda(it.precio * it.cantidad)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMostrarModalFacturasPagas(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer mt-2"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}

      {/* MODAL CAMBIO DE TURNO */}
      {mostrarModalCambioTurno && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border-2 border-[#0066b3] w-full max-w-md rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                🔐 CAMBIO DE TURNO Y ENTREGA DE CAJA
              </h3>
              <button
                type="button"
                onClick={() => setMostrarModalCambioTurno(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-sky-200 font-bold block mb-1">Selecciona el Operario Entrante:</label>
                <select
                  value={usuarioEntranteId}
                  onChange={(e) => setUsuarioEntranteId(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white p-2.5 rounded-xl outline-none font-bold cursor-pointer"
                >
                  {usuariosBD.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sky-200 font-bold block mb-1">Contraseña del Operario Entrante:</label>
                <input
                  type="password"
                  placeholder="Escribe la clave para ingresar..."
                  value={claveUsuarioEntrante}
                  onChange={(e) => setClaveUsuarioEntrante(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white p-2.5 rounded-xl outline-none font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalCambioTurno(false)}
                className="w-1/2 bg-[#051829] border border-[#0066b3] hover:bg-[#08223a] text-sky-200 font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleConfirmarCambioTurno}
                disabled={verificandoCambioTurno}
                className="w-1/2 bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs uppercase shadow cursor-pointer disabled:opacity-50"
              >
                {verificandoCambioTurno ? 'PROCESANDO...' : 'CONFIRMAR CAMBIO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COBRAR / REGISTRAR PAGO (VENTA LOCAL) */}
      {mostrarModalPago && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border-2 border-[#0066b3] w-full max-w-lg rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                💳 COBRAR VENTA ({formatearMoneda(totalACobrar)})
              </h3>
              <button
                type="button"
                onClick={() => setMostrarModalPago(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl flex justify-between items-center">
                <span className="font-bold text-sky-200">Total Venta:</span>
                <span className="font-black text-white text-sm">{formatearMoneda(subtotalMesaActual)}</span>
              </div>

              <div>
                <label className="text-sky-200 font-bold block mb-1">🎟️ Descuento ($):</label>
                <input
                  type="text"
                  placeholder="$ 0"
                  value={formatearMoneda(descuentoVenta)}
                  onChange={(e) => setDescuentoVenta(desformatearMoneda(e.target.value))}
                  className="w-full bg-[#051829] border border-[#0066b3] text-amber-300 font-bold p-2.5 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-2 border-t border-[#0066b3]/50 pt-2">
                <span className="font-black text-sky-200 block">MÉTODOS DE PAGO (HAZ CLIC EN CADA UNO PARA AUTOCOMPLETAR):</span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <button
                      type="button"
                      onClick={() => autocompletarMetodoPago('efectivo')}
                      className="text-emerald-300 text-[11px] font-bold block mb-1 hover:underline cursor-pointer text-left"
                    >
                      💵 Efectivo (clic para llenar)
                    </button>
                    <input
                      type="text"
                      placeholder="$ 0"
                      value={formatearMoneda(pagoEfectivo)}
                      onChange={(e) => setPagoEfectivo(desformatearMoneda(e.target.value))}
                      className="w-full bg-[#051829] border border-[#0066b3] text-emerald-300 font-bold p-2 rounded-lg outline-none"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => autocompletarMetodoPago('nequi')}
                      className="text-purple-300 text-[11px] font-bold block mb-1 hover:underline cursor-pointer text-left"
                    >
                      🟣 Nequi (clic para llenar)
                    </button>
                    <input
                      type="text"
                      placeholder="$ 0"
                      value={formatearMoneda(pagoNequi)}
                      onChange={(e) => setPagoNequi(desformatearMoneda(e.target.value))}
                      className="w-full bg-[#051829] border border-[#0066b3] text-purple-300 font-bold p-2 rounded-lg outline-none"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => autocompletarMetodoPago('daviplata')}
                      className="text-rose-300 text-[11px] font-bold block mb-1 hover:underline cursor-pointer text-left"
                    >
                      🔴 Daviplata (clic para llenar)
                    </button>
                    <input
                      type="text"
                      placeholder="$ 0"
                      value={formatearMoneda(pagoDaviplata)}
                      onChange={(e) => setPagoDaviplata(desformatearMoneda(e.target.value))}
                      className="w-full bg-[#051829] border border-[#0066b3] text-rose-300 font-bold p-2 rounded-lg outline-none"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => autocompletarMetodoPago('otros')}
                      className="text-sky-200 text-[11px] font-bold block mb-1 hover:underline cursor-pointer text-left"
                    >
                      💳 Tarjetas / Otros (clic para llenar)
                    </button>
                    <input
                      type="text"
                      placeholder="$ 0"
                      value={formatearMoneda(pagoOtros)}
                      onChange={(e) => setPagoOtros(desformatearMoneda(e.target.value))}
                      className="w-full bg-[#051829] border border-[#0066b3] text-sky-200 font-bold p-2 rounded-lg outline-none"
                    />
                  </div>
                </div>

                {numOtros > 0 && (
                  <input
                    type="text"
                    placeholder="Detalle del otro método (ej. Tarjeta, Transferencia...)"
                    value={detalleOtro}
                    onChange={(e) => setDetalleOtro(e.target.value)}
                    className="w-full bg-[#051829] border border-sky-400 text-white font-bold p-2 rounded-lg outline-none"
                  />
                )}
              </div>

              <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-sky-300">Total Ingresado:</span>
                  <span className="font-bold text-white">{formatearMoneda(totalIngresado) || '$ 0'}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-black">
                  <span className={saldoPendiente > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {saldoPendiente > 0 ? 'Falta por Cubrir:' : '✓ Cubierto:'}
                  </span>
                  <span className={saldoPendiente > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {formatearMoneda(saldoPendiente) || '$ 0'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalPago(false)}
                className="w-1/2 bg-[#051829] border border-[#0066b3] hover:bg-[#08223a] text-sky-200 font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleFinalizarVentaBD}
                disabled={guardandoVenta || saldoPendiente > 0}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs uppercase shadow cursor-pointer disabled:opacity-50"
              >
                {guardandoVenta ? '⏳ REGISTRANDO...' : 'REGISTRAR VENTA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVO PRODUCTO */}
      {mostrarModalNuevoProd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border-2 border-[#0066b3] w-full max-w-md rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>➕</span> CREAR NUEVO PRODUCTO EN BASE DE DATOS
              </h3>
              <button
                type="button"
                onClick={() => setMostrarModalNuevoProd(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-sky-200 font-bold block mb-1">Nombre del Producto:</label>
                <input
                  type="text"
                  placeholder="Ej. Vasos de cartón 8oz, Cucharas..."
                  value={nuevoProdNombre}
                  onChange={(e) => setNuevoProdNombre(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white p-2.5 rounded-xl outline-none font-bold placeholder-sky-300/40"
                />
              </div>

              <div>
                <label className="text-sky-200 font-bold block mb-1">Categoría / Pestaña:</label>
                <select
                  value={nuevoProdCategoria}
                  onChange={(e) => setNuevoProdCategoria(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white p-2.5 rounded-xl outline-none font-bold cursor-pointer"
                >
                  <option value="Paleta">Paleta</option>
                  <option value="Richi">Richi / Empaque</option>
                  <option value="Producción">Producción</option>
                  <option value="Insumos">Insumo / Topping</option>
                  <option value="Aseo">Aseo</option>
                </select>
              </div>

              <div>
                <label className="text-sky-200 font-bold block mb-1">¿Dónde comprar / Proveedor?:</label>
                <select
                  value={nuevoProdDondeComprar}
                  onChange={(e) => setNuevoProdDondeComprar(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white p-2.5 rounded-xl outline-none font-bold cursor-pointer"
                >
                  {listaLugaresCompraUnica.map((lugar) => (
                    <option key={lugar} value={lugar}>
                      {lugar}
                    </option>
                  ))}
                  <option value="Otro">➕ Agregar nuevo proveedor/lugar...</option>
                </select>

                {nuevoProdDondeComprar === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Escribe el nombre del proveedor o lugar..."
                    value={dondeComprarPersonalizado}
                    onChange={(e) => setDondeComprarPersonalizado(e.target.value)}
                    className="w-full bg-[#051829] border border-emerald-500 text-white p-2.5 rounded-xl outline-none font-bold mt-2"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalNuevoProd(false)}
                className="w-1/2 bg-[#051829] border border-[#0066b3] hover:bg-[#08223a] text-sky-200 font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={crearNuevoProductoBD}
                disabled={guardandoProducto}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs uppercase shadow cursor-pointer disabled:opacity-50"
              >
                {guardandoProducto ? '⏳ CREANDO...' : 'CREAR PRODUCTO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}