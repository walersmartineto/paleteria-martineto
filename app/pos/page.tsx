'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  registrarMovimientoMartineto,
} from '@/lib/martinetoQueries';
import { supabase } from '@/lib/supabase';
import { useAutoSave } from '@/hooks/useAutoSave';

const LISTA_EMPAQUES_MARTINETO = [
  'Caja Mostac',
  'Corralito',
  'Doritos',
  'Frascos Chamoy',
  'Helado de Oblea',
  'Muñeco Lego',
  'Total Paletas',
  'Vaso 12 onzas',
  'Vaso Gomita Enchilada',
  'Vaso Soft',
].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

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

const obtenerInicioDiaColombia = () => {
  const fechaHoraLocal = new Date().toLocaleString("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const [month, day, year] = fechaHoraLocal.split('/');
  return `${year}-${month}-${day}T00:00:00`;
};

const formatearMoneda = (val: number | string): string => {
  if (val === '' || val === null || val === undefined) return '';
  const num = typeof val === 'string' ? Number(val.replace(/\D/g, '')) : val;
  if (isNaN(num) || num === 0) return '';
  return `$ ${num.toLocaleString('es-CO')}`;
};

const desformatearMoneda = (val: string): number | '' => {
  const soloNumeros = String(val).replace(/\D/g, '');
  return soloNumeros === '' ? '' : Number(soloNumeros);
};

type CategoriaTab = 'paletas' | 'richi' | 'produccion' | 'insumos' | 'aseo';
type ModuloPrincipal = 'movimientos' | 'pedidos' | 'gastos' | 'ventas' | 'cierre';

interface RegistroNominaDia {
  id: number;
  nombreOperario: string;
  monto: number;
  hora: string;
}

export default function MartinetoPOSPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);

  const [moduloActivo, setModuloActivo] = useState<ModuloPrincipal>('movimientos');

  const [baseCaja, setBaseCaja, limpiarBaseCaja] = useAutoSave<number | ''>('martineto_baseCaja', '');
  const [baseGuardada, setBaseGuardada] = useState(false);
  const [guardandoBase, setGuardandoBase] = useState(false);
  const [cajaIdActual, setCajaIdActual] = useState<number | null>(null);
  const [aperturaRealizada, setAperturaRealizada] = useState(false);

  const [efectivoTurnoManana, setEfectivoTurnoManana] = useState<number | null>(null);

  const [empaquesBD, setEmpaquesBD] = useState<any[]>([]);

  const [tipoMovimiento, setTipoMovimiento] = useState<string>('apertura');
  const [totalPaletasInventario, setTotalPaletasInventario, limpiarTotalPaletasInv] = useAutoSave<number | ''>('martineto_totalPaletasInv', '');
  const [cantidadesInventario, setCantidadesInventario, limpiarCantidadesInv] = useAutoSave<{ [item: string]: number | '' }>('martineto_cantidadesInv', {});
  const [observacionesInventario, setObservacionesInventario, limpiarObsInv] = useAutoSave<string>('martineto_obsInv', '');
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);

  const [movimientosDiaBD, setMovimientosDiaBD] = useState<any[]>([]);

  const [mesas, setMesas] = useState<any[]>([]);
  const [mesaActivaId, setMesaActivaId] = useState<any | null>(null);
  const [productosVenta, setProductosVenta] = useState<any[]>([]);
  const [listaCategoriasVenta, setListaCategoriasVenta] = useState<string[]>([]);
  const [categoriaVentaSel, setCategoriaVentaSel] = useState<string>('TODAS');
  const [busquedaProducto, setBusquedaProducto] = useState<string>('');
  const [errorLecturaBD, setErrorLecturaBD] = useState<string | null>(null);

  const [ventasDiaBD, setVentasDiaBD] = useState<any[]>([]);
  const [pedidosRappi, setPedidosRappi] = useState<any[]>([]);

  const [mostrarModalConsultaCaja, setMostrarModalConsultaCaja] = useState(false);

  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState<number | ''>('');
  const [pagoNequi, setPagoNequi] = useState<number | ''>('');
  const [pagoDaviplata, setPagoDaviplata] = useState<number | ''>('');
  const [descuentoVenta, setDescuentoVenta] = useState<number | ''>('');
  const [motivoDescuentoVenta, setMotivoDescuentoVenta] = useState<string>('');
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [procesandoRappi, setProcesandoRappi] = useState(false);

  const [nombreAdicionManual, setNombreAdicionManual] = useState('');
  const [valorAdicionManual, setValorAdicionManual] = useState<number | ''>('');

  const [productosInsumosBD, setProductosInsumosBD] = useState<any[]>([]);
  const [busquedaInsumoPedido, setBusquedaInsumoPedido] = useState<string>('');
  const [historialPedidosBD, setHistorialPedidosBD] = useState<any[]>([]);
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<number[]>([]);
  const [mostrarGestorEnvios, setMostrarGestorEnvios] = useState(false);
  const [tabPedido, setTabPedido] = useState<CategoriaTab>('paletas');
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [eliminandoPedido, setEliminandoPedido] = useState(false);

  const [pedidosCategorias, setPedidosCategorias, limpiarPedidosCat] = useAutoSave<{
    paletas: { [key: string]: number };
    richi: { [key: string]: number };
    produccion: { [key: string]: number };
    insumos: { [key: string]: number };
    aseo: { [key: string]: number };
  }>('martineto_pedidosCategorias', {
    paletas: {},
    richi: {},
    produccion: {},
    insumos: {},
    aseo: {},
  });

  const [observacionPedido, setObservacionPedido, limpiarObsPedido] = useAutoSave<string>('martineto_obsPedido', '');

  const [listaGastos, setListaGastos] = useState<{ id: string; concepto: string; monto: number; hora: string }[]>([]);
  const [conceptoGasto, setConceptoGasto, limpiarConceptoGasto] = useAutoSave<string>('martineto_conceptoGasto', '');
  const [montoGasto, setMontoGasto, limpiarMontoGasto] = useAutoSave<number | ''>('martineto_montoGasto', '');
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  const [mostrarModalResumen, setMostrarModalResumen] = useState(false);
  const [efectivoContadoCierre, setEfectivoContadoCierre] = useState<number | ''>('');
  const [motivoDescuadre, setMotivoDescuadre] = useState<string>('');
  const [conteoFisicoProductos, setConteoFisicoProductos] = useState<{ [nombreProd: string]: number | '' }>({});
  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [procesandoNomina, setProcesandoNomina] = useState(false);

  const [mostrarModalCambioTurno, setMostrarModalCambioTurno] = useState(false);
  const [listaOperarios, setListaOperarios] = useState<any[]>([]);
  const [operarioEntranteId, setOperarioEntranteId] = useState<string>('');
  const [claveOperarioEntrante, setClaveOperarioEntrante] = useState<string>('');
  const [validandoEntrante, setValidandoEntrante] = useState(false);

  const [mostrarModalNuevoProd, setMostrarModalNuevoProd] = useState(false);
  const [nuevoProdNombre, setNuevoProdNombre] = useState('');
  const [nuevoProdCategoria, setNuevoProdCategoria] = useState('Paleta');
  const [nuevoProdDondeComprar, setNuevoProdDondeComprar] = useState('');
  const [dondeComprarPersonalizado, setDondeComprarPersonalizado] = useState('');
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  const [listaSedesBD, setListaSedesBD] = useState<any[]>([]);
  const [sedesSeleccionadasProd, setSedesSeleccionadasProd] = useState<(number | string)[]>([]);

  const [tipoDia, setTipoDia] = useState<string>('entre_semana');
  const [horasDia, setHorasDia] = useState<number | ''>('');
  const [horasNoche, setHorasNoche] = useState<number | ''>('');
  const [nominaPagadaEnTurno, setNominaPagadaEnTurno] = useState(false);
  const [listaNominasDia, setListaNominasDia] = useState<RegistroNominaDia[]>([]);

  const [tarifasNominaBD, setTarifasNominaBD] = useState<{
    subsidio: number;
    transporte: number;
    valDiaOrd: number;
    valNocheOrd: number;
    valDiaFest: number;
    valNocheFest: number;
  }>({
    subsidio: 0,
    transporte: 0,
    valDiaOrd: 0,
    valNocheOrd: 0,
    valDiaFest: 0,
    valNocheFest: 0,
  });

  const [cargando, setCargando] = useState(true);
  const SEDE_ID_MARTINETO = 4;

  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const bloqueadoPorApertura = !baseGuardada || !aperturaRealizada;

  const esTurnoManana = (() => {
    const nombreTurno = String(sesion?.turno_nombre || '').toLowerCase();
    const idTurno = String(sesion?.turno_id || '');
    return (
      nombreTurno.includes('mañana') ||
      nombreTurno.includes('manana') ||
      nombreTurno.includes('apertura') ||
      idTurno === '1'
    );
  })();

  const listaEmpaquesFiltrados = LISTA_EMPAQUES_MARTINETO.filter((i) => i !== 'Total Paletas');

  const insumosFiltrados = productosInsumosBD
    .filter((prod) => {
      const cat = String(prod?.categoriaLimpia || '');

      let coincideCat = true;
      if (tabPedido === 'paletas') coincideCat = cat.includes('paleta');
      else if (tabPedido === 'richi') coincideCat = cat.includes('richi') || cat.includes('empaque') || cat.includes('plástico');
      else if (tabPedido === 'produccion') coincideCat = cat.includes('produccion') || cat.includes('prod');
      else if (tabPedido === 'insumos') coincideCat = cat.includes('insumo') || cat.includes('topping');
      else if (tabPedido === 'aseo') coincideCat = cat.includes('aseo') || cat.includes('limpieza');

      const coincideTexto =
        !busquedaInsumoPedido.trim() ||
        (prod.nombre || '').toLowerCase().includes(busquedaInsumoPedido.toLowerCase().trim());

      return coincideCat && coincideTexto;
    })
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

  const listaLugaresCompraUnica = Array.from(
    new Set(
      productosInsumosBD
        .map((p) => p.donde_comprar)
        .filter((lugar): lugar is string => Boolean(lugar && lugar.trim() !== ''))
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  async function actualizarEstadoMesaBD(idMesa: number, nuevoEstado: string) {
    try {
      await supabase
        .from('mesa')
        .update({ estado: nuevoEstado.toLowerCase() })
        .eq('id', idMesa);
    } catch (e) {
      console.error('Error actualizando el estado de la mesa en Supabase:', e);
    }
  }

  useEffect(() => {
    const sesionLocal = localStorage.getItem('martineto_session');
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }
    const ses = JSON.parse(sesionLocal);
    setSesion(ses);

    const efectivoMananaGuardado = localStorage.getItem('martineto_efectivo_manana_principal');
    if (efectivoMananaGuardado) {
      setEfectivoTurnoManana(Number(efectivoMananaGuardado));
    }

    const valorActualCaja = localStorage.getItem('martineto_baseCaja');
    if (valorActualCaja === '1' || valorActualCaja === 'ús') {
      localStorage.removeItem('martineto_baseCaja');
      setBaseCaja('');
    }

    cargarInicial(ses);
  }, [router]);

  useEffect(() => {
    const channelMesas = supabase
      .channel('schema-db-changes-mesas')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mesa',
          filter: `sede_id=eq.${SEDE_ID_MARTINETO}`,
        },
        (payload) => {
          const mesaActualizada = payload.new as any;
          if (mesaActualizada && mesaActualizada.id) {
            setMesas((prevMesas) =>
              prevMesas.map((m) =>
                m.id === mesaActualizada.id
                  ? {
                      ...m,
                      estado: (mesaActualizada.estado || 'libre').toLowerCase(),
                    }
                  : m
              )
            );
          }
        }
      )
      .subscribe();

    const channelEmpaques = supabase
      .channel('schema-db-changes-empaques')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'empaques_martineto',
        },
        (payload) => {
          const empActualizado = payload.new as any;
          if (empActualizado && empActualizado.id) {
            setEmpaquesBD((prev) =>
              prev.map((e) => (e.id === empActualizado.id ? empActualizado : e))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelMesas);
      supabase.removeChannel(channelEmpaques);
    };
  }, []);

  async function cargarHistorialPedidos() {
    const inicioDia = obtenerInicioDiaColombia();

    const { data, error } = await supabase
      .from('pedidos_insumos')
      .select('*')
      .eq('sede_id', SEDE_ID_MARTINETO)
      .gte('fecha', inicioDia)
      .order('id', { ascending: false });

    if (!error && data) {
      setHistorialPedidosBD(data);
    }
  }

  async function descontarStockEmpaquesPorVentaBD(itemsVendidos: any[]) {
    try {
      for (const item of itemsVendidos) {
        const nombreLimpio = String(item.nombre || '').replace(' (LLEVAR)', '').trim();
        const cantidadVendida = Number(item.cantidad || 1);

        let empaquesAfectados: { nombre: string; cantidad: number }[] = [];
        const norm = nombreLimpio.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (norm.includes('paleta')) {
          empaquesAfectados.push({ nombre: 'Total Paletas', cantidad: cantidadVendida });
          if (norm.includes('mostac') || norm.includes('enchilada')) {
            empaquesAfectados.push({ nombre: 'Caja Mostac', cantidad: cantidadVendida });
          }
        } else if (norm.includes('oblea')) {
          empaquesAfectados.push({ nombre: 'Helado de Oblea', cantidad: cantidadVendida });
        } else if (norm.includes('corralito') || norm.includes('waffle')) {
          const esLlev = String(item.nombre || '').includes('(LLEVAR)');
          empaquesAfectados.push({ nombre: 'Corralito', cantidad: cantidadVendida });
          if (esLlev) {
            empaquesAfectados.push({ nombre: 'Corralito', cantidad: cantidadVendida });
          }
        } else if (norm.includes('doritos') || norm.includes('dorinetos')) {
          empaquesAfectados.push({ nombre: 'Doritos', cantidad: cantidadVendida });
        } else if (
          norm.includes('malteada') ||
          norm.includes('yogurneto') ||
          norm.includes('soda') ||
          norm.includes('jugo') ||
          norm.includes('limonada') ||
          norm.includes('martifrappe') ||
          norm.includes('maracumango') ||
          norm.includes('achocolatada') ||
          norm.includes('coffe') ||
          norm.includes('coffee') ||
          norm.includes('vaso 12')
        ) {
          empaquesAfectados.push({ nombre: 'Vaso 12 onzas', cantidad: cantidadVendida });
        }

        for (const emp of empaquesAfectados) {
          const empEncontrado = empaquesBD.find(
            (e) => e.nombre.toLowerCase().trim() === emp.nombre.toLowerCase().trim()
          );

          if (empEncontrado) {
            const nuevoStock = Math.max(0, Number(empEncontrado.stock || 0) - emp.cantidad);

            await supabase
              .from('empaques_martineto')
              .update({ stock: nuevoStock })
              .eq('id', empEncontrado.id);

            setEmpaquesBD((prev) =>
              prev.map((e) => (e.id === empEncontrado.id ? { ...e, stock: nuevoStock } : e))
            );
          }
        }
      }
    } catch (e) {
      console.error('Error descontando stock en empaques_martineto:', e);
    }
  }

  async function procesarDiferenciaAperturaAutomaticaMartineto(
    usuarioId: number,
    totalPaletasHoy: number,
    detalleEmpaquesHoy: { [nombre: string]: number }
  ) {
    try {
      const { data: ultimoCierre } = await supabase
        .from('inventario_diario')
        .select('total_paletas, detalle_empaques')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .ilike('tipo_movimiento', 'cierre')
        .order('fecha_registro', { ascending: false })
        .limit(1)
        .maybeSingle();

      const totalPaletasAyer = Number(ultimoCierre?.total_paletas || 0);
      const jsonCierreEmpaques: { [key: string]: number } = ultimoCierre?.detalle_empaques || {};

      const difPaletasGlobal = totalPaletasHoy - totalPaletasAyer;
      const difEmpaquesObj: { [nombre: string]: number } = {};
      let totalDiferenciaGlobal = difPaletasGlobal;

      Object.entries(detalleEmpaquesHoy).forEach(([nombreItem, cantHoy]) => {
        const cantAyer = Number(jsonCierreEmpaques[nombreItem] || 0);
        const dif = Number(cantHoy) - cantAyer;
        difEmpaquesObj[nombreItem] = dif;
        totalDiferenciaGlobal += dif;
      });

      await supabase.from('diferencia_inventario').insert([
        {
          sede_id: SEDE_ID_MARTINETO,
          usuario_id: usuarioId,
          diferencia_paletas: { "Total Paletas": difPaletasGlobal },
          diferencia_empaques: difEmpaquesObj,
          total_diferencia: totalDiferenciaGlobal,
        },
      ]);
    } catch (e) {
      console.error('Error calculando la diferencia consolidada (Martineto):', e);
    }
  }

  async function borrarProductoEspecificoDePedido(pedidoId: number, columnaCategoria: string, nombreProducto: string) {
    if (eliminandoPedido) return;
    if (!confirm(`¿Deseas quitar "${nombreProducto}" de este pedido?`)) return;

    setEliminandoPedido(true);
    try {
      const pedidoOriginal = historialPedidosBD.find((p) => p.id === pedidoId);
      if (!pedidoOriginal) return;

      const mapaCategoriaActual = { ...(pedidoOriginal[columnaCategoria] || {}) };
      delete mapaCategoriaActual[nombreProducto];

      const { error } = await supabase
        .from('pedidos_insumos')
        .update({ [columnaCategoria]: mapaCategoriaActual })
        .eq('id', pedidoId);

      if (error) {
        alert('Error al quitar el producto: ' + error.message);
      } else {
        await cargarHistorialPedidos();
      }
    } finally {
      setEliminandoPedido(false);
    }
  }

  const toggleSeleccionPedido = (id: number) => {
    setPedidosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  async function borrarPedidosBD(idsABorrar: number[]) {
    if (idsABorrar.length === 0 || eliminandoPedido) return;
    const desc = idsABorrar.length === 1 ? 'este pedido' : `los ${idsABorrar.length} pedidos seleccionados`;
    if (!confirm(`¿Estás segura de eliminar permanentemente ${desc} de la Base de Datos?`)) return;

    setEliminandoPedido(true);
    try {
      const { error } = await supabase
        .from('pedidos_insumos')
        .delete()
        .in('id', idsABorrar);

      if (error) {
        alert('Error al eliminar en la base de datos: ' + error.message);
      } else {
        alert('✅ Pedido(s) eliminado(s) correctamente.');
        setPedidosSeleccionados((prev) => prev.filter((id) => !idsABorrar.includes(id)));
        await cargarHistorialPedidos();
      }
    } finally {
      setEliminandoPedido(false);
    }
  }

  async function cargarInicial(sesionActual: any) {
    setCargando(true);
    setErrorLecturaBD(null);

    try {
      let turnoIdActual = sesionActual?.turno_id;
      if (!turnoIdActual) {
        const { data: turnoData } = await supabase
          .from('turno_trabajo')
          .select('id, nombre')
          .or(`sede_id.eq.${SEDE_ID_MARTINETO},sede_id.is.null`)
          .order('id', { ascending: false })
          .limit(1);

        if (turnoData && turnoData.length > 0) {
          turnoIdActual = turnoData[0].id;
          sesionActual.turno_id = turnoIdActual;
          sesionActual.turno_nombre = turnoData[0].nombre;
          setSesion({ ...sesionActual });
        }
      }

      const { data: listaOpBD } = await supabase
        .from('usuario')
        .select('id, nombre, nombre_completo, activo')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (listaOpBD) {
        setListaOperarios(listaOpBD);
        if (listaOpBD.length > 0) setOperarioEntranteId(String(listaOpBD[0].id));
      }

      const { data: sedesBD } = await supabase
        .from('sede')
        .select('*')
        .order('id', { ascending: true });

      if (sedesBD && sedesBD.length > 0) {
        setListaSedesBD(sedesBD.sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })));
        setSedesSeleccionadasProd([SEDE_ID_MARTINETO]);
      } else {
        setListaSedesBD([
          { id: SEDE_ID_MARTINETO, nombre: 'Martineto' },
          { id: 1, nombre: 'Viva' },
          { id: 2, nombre: 'Centro' }
        ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })));
        setSedesSeleccionadasProd([SEDE_ID_MARTINETO]);
      }

      const { data: empaquesData } = await supabase
        .from('empaques_martineto')
        .select('*')
        .order('nombre', { ascending: true });

      if (empaquesData) {
        setEmpaquesBD(empaquesData.sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })));
      }

      const inicioDia = obtenerInicioDiaColombia();

      const { data: nominasBD } = await supabase
        .from('nomina')
        .select('id, monto, fecha, usuario_id, usuario(nombre_completo, nombre)')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .gte('fecha', inicioDia)
        .order('id', { ascending: true });

      if (nominasBD && nominasBD.length > 0) {
        const nominasMapeadas: RegistroNominaDia[] = nominasBD.map((n: any) => {
          const nomUser = n.usuario?.nombre_completo || n.usuario?.nombre || 'Operario';
          const horaFmt = new Date(n.fecha).toLocaleTimeString('es-CO', {
            timeZone: 'America/Bogota',
            hour: '2-digit',
            minute: '2-digit',
          });
          return {
            id: n.id,
            nombreOperario: nomUser,
            monto: Number(n.monto || 0),
            hora: horaFmt,
          };
        });
        setListaNominasDia(nominasMapeadas);

        const userId = sesionActual?.usuario_id || sesionActual?.id;
        const miNomina = nominasBD.find((n: any) => String(n.usuario_id) === String(userId));
        if (miNomina) {
          setNominaPagadaEnTurno(true);
        }
      }

      const { data: cajaHoyBD } = await supabase
        .from('caja')
        .select('*')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .gte('fecha', inicioDia)
        .eq('estado', 'abierta')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cajaHoyBD) {
        setBaseCaja(Number(cajaHoyBD.monto_apertura) || 0);
        setBaseGuardada(true);
        setCajaIdActual(cajaHoyBD.id);
      }

      const { data: invHoyBD } = await supabase
        .from('inventario_diario')
        .select('*')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .gte('fecha_registro', inicioDia)
        .ilike('tipo_movimiento', 'apertura')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invHoyBD) {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
      }

      const { data: configTarifas } = await supabase
        .from('configuracion_tarifa')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (configTarifas) {
        setTarifasNominaBD({
          subsidio: Number(configTarifas.subsidio || 0),
          transporte: Number(configTarifas.transporte || 0),
          valDiaOrd: Number(configTarifas.hora_dia_entre_semana || 0),
          valNocheOrd: Number(configTarifas.hora_noche_entre_semana || 0),
          valDiaFest: Number(configTarifas.hora_dia_festivo || 0),
          valNocheFest: Number(configTarifas.hora_noche_festivo || 0),
        });
      }

      const mesasRes = await supabase
        .from('mesa')
        .select('*')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .order('id', { ascending: true });

      let listaMesas = mesasRes.data || [];
      if (listaMesas.length === 0) {
        listaMesas = [
          { id: 101, nombre: 'Mesa 1', estado: 'libre', sede_id: SEDE_ID_MARTINETO },
          { id: 102, nombre: 'Mesa 2', estado: 'libre', sede_id: SEDE_ID_MARTINETO },
          { id: 103, nombre: 'Mesa 3', estado: 'libre', sede_id: SEDE_ID_MARTINETO },
          { id: 104, nombre: 'Mesa 4', estado: 'libre', sede_id: SEDE_ID_MARTINETO },
          { id: 105, nombre: 'Mesa 5', estado: 'libre', sede_id: SEDE_ID_MARTINETO },
          { id: 106, nombre: 'Corredor 1', estado: 'libre', sede_id: SEDE_ID_MARTINETO },
          { id: 107, nombre: 'Corredor 2', estado: 'libre', sede_id: SEDE_ID_MARTINETO },
        ];
      }

      setMesas(
        listaMesas.map((m: any) => ({
          ...m,
          items: [],
          total: 0,
          totalAbonado: 0,
          descuentoAcumulado: 0,
          estado: (m.estado || 'libre').toLowerCase(),
        })).sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }))
      );

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
        }).sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

        setProductosVenta(prodsVentaLimpios);

        const catsSet = new Set<string>();
        prodsVentaLimpios.forEach((p) => {
          if (p.categoriaMostrar) catsSet.add(p.categoriaMostrar);
        });

        setListaCategoriasVenta(Array.from(catsSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));
        setCategoriaVentaSel('TODAS');
      }

      const { data: prodsInsumosBD } = await supabase
        .from('producto')
        .select('*')
        .or(`sede_id.eq.${SEDE_ID_MARTINETO},sede_id.eq.0,sede_id.is.null`);

      if (prodsInsumosBD) {
        const productosMapeados = prodsInsumosBD.map((p: any) => ({
          ...p,
          nombre: p.nombre || p.Nombre || '',
          categoriaLimpia: String(p.categoria || p.Categoria || 'general').trim().toLowerCase(),
          donde_comprar: p.donde_comprar || '',
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

      const { data: ventasHoyBD } = await supabase
        .from('venta')
        .select('*')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .gte('fecha', inicioDia);

      if (ventasHoyBD) {
        setVentasDiaBD(ventasHoyBD);
      }

      const { data: gastosHoyBD } = await supabase
        .from('gastos')
        .select('*')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .gte('fecha', inicioDia);

      if (gastosHoyBD) {
        setListaGastos(
          gastosHoyBD.map((g: any) => ({
            id: String(g.id),
            concepto: g.concepto || '',
            monto: Number(g.monto || 0),
            hora: new Date(g.fecha).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }),
          }))
        );
      }

      const { data: movsHoyBD } = await supabase
        .from('inventario_diario')
        .select('*')
        .eq('sede_id', SEDE_ID_MARTINETO)
        .gte('fecha_registro', inicioDia);

      if (movsHoyBD) {
        setMovimientosDiaBD(
          movsHoyBD.map((m: any) => ({
            tipo: m.tipo_movimiento,
            totalPaletas: Number(m.total_paletas || 0),
            detalle: m.detalle_empaques || {},
          }))
        );
      }

      await cargarHistorialPedidos();
    } catch (e: any) {
      setErrorLecturaBD(`Excepción: ${e.message || 'Error de conexión'}`);
    } finally {
      setCargando(false);
    }
  }

  const calcularTotalNomina = () => {
    const hDia = Number(horasDia) || 0;
    const hNoche = Number(horasNoche) || 0;

    const vDia = tipoDia === 'entre_semana' ? tarifasNominaBD.valDiaOrd : tarifasNominaBD.valDiaFest;
    const vNoche = tipoDia === 'entre_semana' ? tarifasNominaBD.valNocheOrd : tarifasNominaBD.valNocheFest;

    const aplicanSubsidios = hDia > 0 || hNoche > 0;
    const sub = aplicanSubsidios ? tarifasNominaBD.subsidio : 0;
    const trans = aplicanSubsidios ? tarifasNominaBD.transporte : 0;

    return sub + trans + hDia * vDia + hNoche * vNoche;
  };

  async function pagarNominaSolo() {
    if (procesandoNomina) return;
    if (nominaPagadaEnTurno) {
      alert('⚠️ La nómina de este turno ya fue registrada.');
      return;
    }

    const totalPago = calcularTotalNomina();

    if (totalPago <= 0) {
      alert('⚠️ El valor a pagar de nómina debe ser mayor a 0 (ingresa las horas trabajadas).');
      return;
    }

    setProcesandoNomina(true);
    try {
      const usuarioId = sesion?.usuario_id || sesion?.id || null;
      const fechaColombia = obtenerFechaHoraColombia();

      const payloadNomina = {
        sede_id: SEDE_ID_MARTINETO,
        usuario_id: usuarioId ? Number(usuarioId) : null,
        monto: totalPago,
        horas_dia: Number(horasDia) || 0,
        horas_noche: Number(horasNoche) || 0,
        tipo_dia: tipoDia,
        fecha: fechaColombia
      };

      const { data: dataNomina, error } = await supabase.from('nomina').insert([payloadNomina]).select();

      if (error) {
        alert('❌ Error al guardar en la tabla nomina: ' + error.message);
        return;
      }

      setNominaPagadaEnTurno(true);
      if (usuarioId) {
        localStorage.setItem(`martineto_nomina_pagada_${usuarioId}`, 'true');
      }

      const nuevoRegistroNomina: RegistroNominaDia = {
        id: dataNomina?.[0]?.id || Date.now(),
        nombreOperario: sesion?.nombre || 'Operario',
        monto: totalPago,
        hora: new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }),
      };

      setListaNominasDia((prev) => [...prev, nuevoRegistroNomina]);

      alert(`💸 Pago de Nómina de $ ${totalPago.toLocaleString('es-CO')} registrado con éxito.`);

      setHorasDia('');
      setHorasNoche('');
    } finally {
      setProcesandoNomina(false);
    }
  }

  async function handleConfirmarEntranteYCambiarTurno() {
    if (validandoEntrante) return;

    if (!operarioEntranteId) {
      alert('⚠️ Selecciona el operario que recibe el turno.');
      return;
    }

    if (!claveOperarioEntrante.trim()) {
      alert('⚠️ Ingresa la clave o PIN del operario entrante.');
      return;
    }

    if (!nominaPagadaEnTurno) {
      const totalNominaCalculado = calcularTotalNomina();
      if (totalNominaCalculado <= 0) {
        alert('⚠️ Debes ingresar las horas trabajadas y registrar el pago de tu nómina antes de entregar el turno.');
        return;
      }
    }

    setValidandoEntrante(true);

    try {
      const { data: operarioBD, error } = await supabase
        .from('usuario')
        .select('*')
        .eq('id', Number(operarioEntranteId))
        .single();

      if (error || !operarioBD) {
        alert('❌ Operario no encontrado.');
        return;
      }

      const pinCorrecto = String(operarioBD.clave || operarioBD.pin || operarioBD.password || '');
      if (pinCorrecto && pinCorrecto.trim() !== claveOperarioEntrante.trim()) {
        alert('❌ Clave / PIN incorrecto para el operario entrante.');
        return;
      }

      let nuevoTurnoId = 2;
      let nuevoTurnoNombre = 'Tarde / Cierre';

      const { data: turnosBD } = await supabase
        .from('turno_trabajo')
        .select('*')
        .or(`sede_id.eq.${SEDE_ID_MARTINETO},sede_id.is.null`);

      if (turnosBD) {
        const turnoTardeObj = turnosBD.find((t: any) =>
          String(t.nombre || '').toLowerCase().includes('tarde') || String(t.nombre || '').toLowerCase().includes('cierre')
        );
        if (turnoTardeObj) {
          nuevoTurnoId = turnoTardeObj.id;
          nuevoTurnoNombre = turnoTardeObj.nombre;
        }
      }

      const nuevaSesion = {
        ...sesion,
        usuario_id: operarioBD.id,
        id: operarioBD.id,
        nombre: operarioBD.nombre || operarioBD.nombre_completo,
        turno_id: nuevoTurnoId,
        turno_nombre: nuevoTurnoNombre,
      };

      localStorage.setItem('martineto_session', JSON.stringify(nuevaSesion));
      setSesion(nuevaSesion);
      setNominaPagadaEnTurno(false);

      alert(`✅ ¡Turno entregado con éxito a ${nuevaSesion.nombre}! El sistema ahora se encuentra en turno "${nuevoTurnoNombre}".`);
      setMostrarModalCambioTurno(false);
      setClaveOperarioEntrante('');
    } finally {
      setValidandoEntrante(false);
    }
  }

  const handleToggleSedeProd = (sedeId: number | string) => {
    setSedesSeleccionadasProd((prev) =>
      prev.includes(sedeId)
        ? prev.filter((id) => id !== sedeId)
        : [...prev, sedeId]
    );
  };

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

    if (sedesSeleccionadasProd.length === 0) {
      alert('⚠️ Debes seleccionar al menos una sede.');
      return;
    }

    setGuardandoProducto(true);

    try {
      const categoriaAInsertar = nuevoProdCategoria;
      const grupoAInsertar = nuevoProdCategoria;

      const arregloNuevosProductos = sedesSeleccionadasProd.map((sId) => ({
        nombre: nombreLimpio,
        categoria: categoriaAInsertar,
        grupo: grupoAInsertar,
        donde_comprar: dondeComprarFinal,
        sede_id: Number(sId),
        activo: true,
        stock: 0,
      }));

      const { data, error } = await supabase.from('producto').insert(arregloNuevosProductos).select();

      if (error) {
        alert('Error guardando en la base de datos: ' + error.message);
        return;
      }

      alert(`✅ ¡Producto "${nombreLimpio}" creado con éxito para ${sedesSeleccionadasProd.length} sede(s)!`);

      if (data && data.length > 0) {
        const nuevosFormateados = data.map((d: any) => ({
          ...d,
          nombre: d.nombre,
          categoriaLimpia: String(d.categoria || '').trim().toLowerCase(),
          donde_comprar: d.donde_comprar || '',
        }));

        setProductosInsumosBD((prev) => [...prev, ...nuevosFormateados].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })));
      }

      setNuevoProdNombre('');
      if (listaLugaresCompraUnica.length > 0) {
        setNuevoProdDondeComprar(listaLugaresCompraUnica[0]);
      }
      setDondeComprarPersonalizado('');
      setSedesSeleccionadasProd([SEDE_ID_MARTINETO]);
      setMostrarModalNuevoProd(false);
    } finally {
      setGuardandoProducto(false);
    }
  }

  const esRappiActivo = typeof mesaActivaId === 'string' && mesaActivaId.startsWith('rappi_');
  const mesaActiva = !esRappiActivo ? mesas.find((m) => m.id === mesaActivaId) || null : null;
  const rappiActivo = esRappiActivo ? pedidosRappi.find((r) => r.id === mesaActivaId) || null : null;
  const itemActivoActual = esRappiActivo ? rappiActivo : mesaActiva;

  const productosFiltradosVenta = productosVenta
    .filter((p) => {
      const catSel = categoriaVentaSel.toLowerCase();
      const nombreNorm = p.nombre.toLowerCase();

      const coincideCategoria =
        !categoriaVentaSel || categoriaVentaSel === 'TODAS'
          ? true
          : p.categoriaLimpia === catSel || (catSel === 'enchilados' && (nombreNorm.includes('enchilada') || nombreNorm.includes('mostac')));

      const coincideTexto =
        busquedaProducto.trim() === ''
          ? true
          : nombreNorm.includes(busquedaProducto.toLowerCase().trim());

      return coincideCategoria && coincideTexto;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

  const obtenerStockActualBD = (nombreEmpaque: string): number => {
    const encontrado = empaquesBD.find(
      (e) => e.nombre.toLowerCase().trim() === nombreEmpaque.toLowerCase().trim()
    );
    return encontrado ? Number(encontrado.stock || 0) : 0;
  };

  function handleKeyDownTotalPaletas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const primerEmpaque = listaEmpaquesFiltrados[0];
      if (primerEmpaque && inputRefs.current?.[primerEmpaque]) {
        inputRefs.current[primerEmpaque]?.focus();
        inputRefs.current[primerEmpaque]?.select();
      }
    }
  }

  function handleKeyDownEmpaques(e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number, prefix: string = '') {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextKey = listaEmpaquesFiltrados[currentIndex + 1];
      const targetRefKey = prefix ? `${prefix}_${nextKey}` : nextKey;
      if (nextKey && inputRefs.current?.[targetRefKey]) {
        inputRefs.current[targetRefKey]?.focus();
        inputRefs.current[targetRefKey]?.select();
      }
    }
  }

  function handleKeyDownPedido(e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const siguienteProd = insumosFiltrados[currentIndex + 1];
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

  async function handleGuardarBase() {
    if (guardandoBase || baseGuardada) return;
    const monto = baseCaja === '' ? 0 : Number(baseCaja);
    const usuarioId = sesion?.usuario_id || sesion?.id || null;
    const turnoId = sesion?.turno_id ? Number(sesion.turno_id) : null;

    if (monto <= 0) {
      alert('⚠️ Ingresa un monto de base válido mayor al 0.');
      return;
    }

    setGuardandoBase(true);
    try {
      const { data, error } = await supabase.from('caja').insert([
        {
          sede_id: SEDE_ID_MARTINETO,
          usuario_id: usuarioId ? Number(usuarioId) : null,
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

    const usuarioId = sesion?.usuario_id || sesion?.id;
    const fechaRealSQL = obtenerFechaHoraColombia();

    const totalPaletasNum =
      totalPaletasInventario !== ''
        ? Number(totalPaletasInventario)
        : tipoMovimiento === 'apertura'
        ? obtenerStockActualBD('Total Paletas')
        : 0;

    const detalleEmpaquesLimpio: { [key: string]: number } = {};
    Object.keys(cantidadesInventario).forEach((key) => {
      if (key !== 'Total Paletas') {
        const val = cantidadesInventario[key];
        if (val !== '' && val !== null && val !== undefined) {
          detalleEmpaquesLimpio[key] = Number(val);
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

    if (tipoMovimiento !== 'apertura') {
      const sumaCantidades = Object.values(detalleEmpaquesLimpio).reduce((acc, curr) => acc + curr, 0) + totalPaletasNum;
      if (sumaCantidades === 0) {
        alert('⚠️ Ingresa al menos una cantidad mayor a 0 para registrar este movimiento.');
        return;
      }
    }

    setGuardandoMovimiento(true);

    try {
      const { error: errorInsert } = await supabase.from('inventario_diario').insert([
        {
          sede_id: SEDE_ID_MARTINETO,
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
          (e) => e.nombre.toLowerCase().trim() === nombreProd.toLowerCase().trim()
        );

        if (empReg) {
          await supabase
            .from('empaques_martineto')
            .update({ stock: nuevoStockCalculado })
            .eq('id', empReg.id);

          setEmpaquesBD((prev) =>
            prev.map((e) => (e.id === empReg.id ? { ...e, stock: nuevoStockCalculado } : e))
          );
        }
      }

      const paletaReg = empaquesBD.find(
        (e) => e.nombre.toLowerCase().trim() === 'total paletas'
      );
      if (paletaReg) {
        let nuevoStockPaletas = paletaReg.stock;
        if (tipoMovimiento === 'apertura') {
          nuevoStockPaletas = totalPaletasNum;
        } else if (tipoMovimiento === 'nuevas' || tipoMovimiento === 'compras') {
          nuevoStockPaletas = Number(paletaReg.stock || 0) + totalPaletasNum;
        } else if (tipoMovimiento === 'debaja') {
          nuevoStockPaletas = Math.max(0, Number(paletaReg.stock || 0) - totalPaletasNum);
        }

        await supabase
          .from('empaques_martineto')
          .update({ stock: nuevoStockPaletas })
          .eq('id', paletaReg.id);
      }

      if (tipoMovimiento === 'apertura') {
        await procesarDiferenciaAperturaAutomaticaMartineto(
          Number(usuarioId),
          totalPaletasNum,
          detalleEmpaquesLimpio
        );
      }

      setMovimientosDiaBD((prev) => [
        ...prev,
        {
          tipo: tipoMovimiento,
          totalPaletas: totalPaletasNum,
          detalle: detalleEmpaquesLimpio,
        },
      ]);

      alert(`✅ ¡${tipoMovimiento.toUpperCase()} registrada con éxito! El inventario fue actualizado.`);

      limpiarTotalPaletasInv();
      limpiarCantidadesInv();
      limpiarObsInv();

      if (tipoMovimiento === 'apertura') {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
        setModuloActivo('ventas');
      }
    } catch (err: any) {
      console.error(err);
      alert('❌ ' + (err.message || 'Error al procesar el movimiento'));
    } finally {
      setGuardandoMovimiento(false);
    }
  }

  async function registrarNuevoGasto() {
    if (guardandoGasto) return;
    const textoConcepto = conceptoGasto.trim();
    const valorGasto = Number(montoGasto);

    if (!textoConcepto) {
      alert('⚠️ Ingresa el concepto del gasto.');
      return;
    }

    if (!valorGasto || valorGasto <= 0) {
      alert('⚠️ Ingresa un valor válido para el gasto.');
      return;
    }

    setGuardandoGasto(true);
    try {
      const fechaHoraHora = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });

      const nuevoGastoObj = {
        id: Date.now().toString(),
        concepto: textoConcepto,
        monto: valorGasto,
        hora: fechaHoraHora,
      };

      setListaGastos((prev) => [nuevoGastoObj, ...prev]);

      await supabase.from('gastos').insert([
        {
          sede_id: SEDE_ID_MARTINETO,
          concepto: textoConcepto,
          monto: valorGasto,
        },
      ]);

      limpiarConceptoGasto();
      limpiarMontoGasto();
      alert(`💸 Gasto de $ ${valorGasto.toLocaleString('es-CO')} registrado.`);
    } finally {
      setGuardandoGasto(false);
    }
  }

  async function enviarPedidoBodega() {
    if (enviandoPedido) return;
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

    setEnviandoPedido(true);
    try {
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
        fecha: obtenerFechaHoraColombia()
      };

      const { error } = await supabase.from('pedidos_insumos').insert([payload]);

      if (!error) {
        alert('¡Pedido enviado a bodega con éxito!');
        limpiarPedidosCat();
        limpiarObsPedido();
        await cargarHistorialPedidos();
      } else {
        alert('Error al guardar en la base de datos: ' + error.message);
      }
    } finally {
      setEnviandoPedido(false);
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

  const calcularDisponibilidadActual = (nombreEmpaque: string) => {
    const stockEnBD = obtenerStockActualBD(nombreEmpaque);

    let ocupadasEnMesas = 0;
    const todasLasMesasYPedidos = [
      ...mesas.flatMap((m) => m.items || []),
      ...pedidosRappi.flatMap((r) => r.items || []),
    ];

    if (nombreEmpaque === 'Vaso 12 onzas') {
      ocupadasEnMesas = todasLasMesasYPedidos.reduce((acc, i) => {
        const n = (i.nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (
          n.includes('malteada') ||
          n.includes('yogurneto') ||
          n.includes('soda') ||
          n.includes('jugo') ||
          n.includes('limonada') ||
          n.includes('martifrappe') ||
          n.includes('maracumango') ||
          n.includes('achocolatada') ||
          n.includes('coffe') ||
          n.includes('coffee') ||
          n.includes('vaso 12')
        ) {
          return acc + Number(i.cantidad || 1);
        }
        return acc;
      }, 0);
    } else if (nombreEmpaque === 'Helado de Oblea') {
      ocupadasEnMesas = todasLasMesasYPedidos.reduce((acc, i) => {
        const n = (i.nombre || '').toLowerCase();
        if (n.includes('oblea') || n.includes('helado de oblea')) {
          return acc + Number(i.cantidad || 1);
        }
        return acc;
      }, 0);
    } else if (nombreEmpaque === 'Caja Mostac') {
      ocupadasEnMesas = todasLasMesasYPedidos.reduce((acc, i) => {
        const n = (i.nombre || '').toLowerCase();
        if (n.includes('mostac') || n.includes('paleta enchilada')) {
          return acc + Number(i.cantidad || 1);
        }
        return acc;
      }, 0);
    } else if (nombreEmpaque === 'Doritos') {
      ocupadasEnMesas = todasLasMesasYPedidos.reduce((acc, i) => {
        const n = (i.nombre || '').toLowerCase();
        if (n.includes('doritos') || n.includes('dorinetos')) {
          return acc + Number(i.cantidad || 1);
        }
        return acc;
      }, 0);
    } else if (nombreEmpaque === 'Corralito') {
      ocupadasEnMesas = todasLasMesasYPedidos.reduce((acc, i) => {
        const n = (i.nombre || '').toLowerCase();
        if (n.includes('corralito') || n.includes('waffle')) {
          return acc + Number(i.cantidad || 1);
        }
        return acc;
      }, 0);
    } else if (nombreEmpaque === 'Total Paletas') {
      ocupadasEnMesas = todasLasMesasYPedidos.reduce((acc, i) => {
        const n = (i.nombre || '').toLowerCase();
        if (n.includes('paleta')) return acc + Number(i.cantidad || 1);
        return acc;
      }, 0);
    } else {
      ocupadasEnMesas = todasLasMesasYPedidos.reduce((acc, i) => {
        if ((i.nombre || '').toLowerCase().includes(nombreEmpaque.toLowerCase())) {
          return acc + Number(i.cantidad || 1);
        }
        return acc;
      }, 0);
    }

    const disponible = stockEnBD - ocupadasEnMesas;
    return Math.max(0, disponible);
  };

  async function agregarProductoAMesa(producto: any, esParaLlevar: boolean = false) {
    if (!mesaActivaId) {
      alert('⚠️ Selecciona una mesa o un pedido Rappi primero en la columna izquierda.');
      return;
    }

    if (esRappiActivo && rappiActivo?.estado === 'Preparado') {
      alert('⚠️ Este pedido Rappi ya fue marcado como PREPARADO y no se le pueden agregar más productos.');
      return;
    }

    const nombreNorm = (producto.nombre || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (nombreNorm.includes('oblea') || nombreNorm.includes('helado de oblea')) {
      const dispOblea = calcularDisponibilidadActual('Helado de Oblea');
      if (dispOblea <= 0) {
        alert('⚠️ No hay stock disponible de Helado de Oblea (Disponibles: 0).');
        return;
      }
    } else if (nombreNorm.includes('paleta enchilada') || nombreNorm.includes('mostac')) {
      const dispPaletas = calcularDisponibilidadActual('Total Paletas');
      const dispMostac = calcularDisponibilidadActual('Caja Mostac');

      if (dispPaletas <= 0) {
        alert('⚠️ No hay stock disponible de "Total Paletas" para la Paleta Enchilada.');
        return;
      }

      if (dispMostac <= 0) {
        alert('⚠️ No hay empaques de "Caja Mostac" disponibles en inventario.');
        return;
      }
    } else if (nombreNorm.includes('paleta')) {
      const dispPaletas = calcularDisponibilidadActual('Total Paletas');
      if (dispPaletas <= 0) {
        alert('⚠️ No hay stock disponible de Paletas (Disponibles: 0).');
        return;
      }
    }

    if (nombreNorm.includes('doritos') || nombreNorm.includes('dorinetos')) {
      const dispDoritos = calcularDisponibilidadActual('Doritos');
      if (dispDoritos <= 0) {
        alert('⚠️ No hay stock disponible de Doritos / Dorinetos (Disponibles: 0).');
        return;
      }
    }

    if (nombreNorm.includes('corralito') || nombreNorm.includes('waffle')) {
      const dispCorralito = calcularDisponibilidadActual('Corralito');
      if (dispCorralito <= 0) {
        alert('⚠️ No hay stock disponible de Corralitos (Disponibles: 0).');
        return;
      }

      if (esParaLlevar) {
        if (dispCorralito < 2) {
          alert('⚠️ No hay empaques suficientes de Corralito para llevar (requiere 2 empaques).');
          return;
        }
      }
    }

    if (
      nombreNorm.includes('malteada') ||
      nombreNorm.includes('yogurneto') ||
      nombreNorm.includes('soda') ||
      nombreNorm.includes('jugo') ||
      nombreNorm.includes('limonada') ||
      nombreNorm.includes('martifrappe') ||
      nombreNorm.includes('maracumango') ||
      nombreNorm.includes('achocolatada') ||
      nombreNorm.includes('coffe') ||
      nombreNorm.includes('coffee') ||
      nombreNorm.includes('vaso 12')
    ) {
      const dispVasos = calcularDisponibilidadActual('Vaso 12 onzas');
      if (dispVasos <= 0) {
        alert('⚠️ No hay Vasos de 12 onzas disponibles en inventario (Disponibles: 0).');
        return;
      }
    }

    const precioNumerico = Number(producto.precio || producto.Precio || 0);
    const etiquetaLlevar = esRappiActivo || esParaLlevar ? ' (LLEVAR)' : '';
    const nombreFinalItem = `${producto.nombre}${etiquetaLlevar}`;

    if (esRappiActivo) {
      setPedidosRappi((prev) =>
        prev.map((r) => {
          if (r.id !== mesaActivaId) return r;

          const existeIndex = r.items.findIndex((i: any) => i.nombre === nombreFinalItem);

          let nuevosItems = [...r.items];
          if (existeIndex >= 0) {
            nuevosItems[existeIndex] = {
              ...nuevosItems[existeIndex],
              cantidad: nuevosItems[existeIndex].cantidad + 1,
            };
          } else {
            nuevosItems = [
              { ...producto, nombre: nombreFinalItem, precio: precioNumerico, cantidad: 1, estadoItem: 'pedido' },
              ...nuevosItems,
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
      actualizarEstadoMesaBD(Number(mesaActivaId), 'ocupada');

      setMesas((prevMesas) =>
        prevMesas.map((m) => {
          if (m.id !== mesaActivaId) return m;

          const existeIndex = m.items.findIndex(
            (i: any) => i.nombre === nombreFinalItem && (i.estadoItem || 'pedido') === 'pedido'
          );

          let nuevosItems = [...m.items];

          if (existeIndex >= 0) {
            nuevosItems[existeIndex] = {
              ...nuevosItems[existeIndex],
              cantidad: nuevosItems[existeIndex].cantidad + 1,
            };
          } else {
            nuevosItems = [
              {
                ...producto,
                idUnico: Date.now() + Math.random(),
                nombre: nombreFinalItem,
                precio: precioNumerico,
                cantidad: 1,
                estadoItem: 'pedido',
              },
              ...nuevosItems,
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
            estado: 'ocupada',
          };
        })
      );
    }
  }

  function agregarAdicionManualAMesa() {
    if (!mesaActivaId) {
      alert('⚠️ Selecciona una mesa o pedido primero.');
      return;
    }

    if (esRappiActivo && rappiActivo?.estado === 'Preparado') {
      alert('⚠️ Este pedido Rappi ya está PREPARADO y no se le pueden agregar adiciones.');
      return;
    }

    const nombreLimpio = nombreAdicionManual.trim() || 'Adición / Extra';
    const valorNum = Number(valorAdicionManual);

    if (!valorNum || valorNum <= 0) {
      alert('⚠️ Ingresa un valor válido para la adición.');
      return;
    }

    const itemAdicion = {
      idUnico: Date.now() + Math.random(),
      nombre: `Adición: ${nombreLimpio}`,
      precio: valorNum,
      cantidad: 1,
      estadoItem: 'pedido',
    };

    if (esRappiActivo) {
      setPedidosRappi((prev) =>
        prev.map((r) => {
          if (r.id !== mesaActivaId) return r;
          const nuevosItems = [itemAdicion, ...r.items];
          const nuevoTotal = nuevosItems.reduce(
            (acc: number, i: any) => acc + Number(i.precio || 0) * Number(i.cantidad || 0),
            0
          );
          return { ...r, items: nuevosItems, total: nuevoTotal };
        })
      );
    } else {
      actualizarEstadoMesaBD(Number(mesaActivaId), 'ocupada');

      setMesas((prev) =>
        prev.map((m) => {
          if (m.id !== mesaActivaId) return m;
          const nuevosItems = [itemAdicion, ...m.items];
          const nuevoTotal = nuevosItems.reduce(
            (acc: number, i: any) => acc + Number(i.precio || 0) * Number(i.cantidad || 0),
            0
          );
          return {
            ...m,
            items: nuevosItems,
            total: nuevoTotal,
            estado: 'ocupada',
          };
        })
      );
    }

    setNombreAdicionManual('');
    setValorAdicionManual('');
  }

  function marcarItemEntregado(nombreTarget: string, estadoTarget: string) {
    if (!mesaActivaId || esRappiActivo) return;

    setMesas((prev) =>
      prev.map((m) => {
        if (m.id !== mesaActivaId) return m;

        const itemsActuales = m.items.map((item: any) => {
          if (item.nombre === nombreTarget && (item.estadoItem || 'pedido') === estadoTarget) {
            return { ...item, estadoItem: 'entregado' };
          }
          return item;
        });

        const algunPendiente = itemsActuales.some((i: any) => (i.estadoItem || 'pedido') === 'pedido');
        const estaTotalmentePagado = ((m.totalAbonado || 0) + (m.descuentoAcumulado || 0)) >= m.total && m.total > 0;

        let nuevoEstadoMesa = m.estado;
        if (estaTotalmentePagado) {
          nuevoEstadoMesa = algunPendiente ? 'ocupada' : 'pagada';
        } else if (algunPendiente) {
          nuevoEstadoMesa = 'ocupada';
        } else {
          nuevoEstadoMesa = 'entregado';
        }

        actualizarEstadoMesaBD(m.id, nuevoEstadoMesa);

        return {
          ...m,
          items: itemsActuales,
          estado: nuevoEstadoMesa,
        };
      })
    );
  }

  async function restarProductoDeMesa(nombreTarget: string, estadoTarget: string) {
    if (!mesaActivaId) return;

    if (esRappiActivo) {
      if (rappiActivo?.estado === 'Preparado') {
        alert('⚠️ No se puede quitar o modificar productos de un pedido Rappi que ya está PREPARADO.');
        return;
      }

      setPedidosRappi((prev) =>
        prev.map((r) => {
          if (r.id !== mesaActivaId) return r;
          const itemsActuales = [...r.items];
          const idx = itemsActuales.findIndex((i: any) => i.nombre === nombreTarget);
          if (idx >= 0) {
            if (itemsActuales[idx].cantidad > 1) {
              itemsActuales[idx].cantidad -= 1;
            } else {
              itemsActuales.splice(idx, 1);
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
            if (estadoTarget !== 'pedido') {
              alert('⚠️ Un producto entregado no se puede descontar.');
              return m;
            }

            const itemsActuales = [...m.items];
            const idx = itemsActuales.findIndex(
              (i: any) => i.nombre === nombreTarget && (i.estadoItem || 'pedido') === 'pedido'
            );

            if (idx >= 0) {
              if (itemsActuales[idx].cantidad > 1) {
                itemsActuales[idx].cantidad -= 1;
              } else {
                itemsActuales.splice(idx, 1);
              }
            }

            const nuevoTotal = itemsActuales.reduce(
              (acc: number, i: any) => acc + Number(i.precio || 0) * Number(i.cantidad || 0),
              0
            );

            let nuevoEstado = itemsActuales.length === 0 ? 'libre' : m.estado;
            if (itemsActuales.length > 0) {
              const algunPendiente = itemsActuales.some((i: any) => (i.estadoItem || 'pedido') === 'pedido');
              const estaTotalmentePagado = ((m.totalAbonado || 0) + (m.descuentoAcumulado || 0)) >= nuevoTotal && nuevoTotal > 0;
              if (estaTotalmentePagado) nuevoEstado = algunPendiente ? 'ocupada' : 'pagada';
              else if (algunPendiente) nuevoEstado = 'ocupada';
              else nuevoEstado = 'entregado';
            }

            actualizarEstadoMesaBD(m.id, nuevoEstado);

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
    alert('🍳 Pedido marcado como PREPARADO. Ya no se pueden quitar productos.');
  }

  async function procesarEntregarRappiDirecto() {
    if (procesandoRappi || !rappiActivo) return;

    if (rappiActivo.items.length === 0) {
      alert('⚠️ No hay productos en este pedido Rappi.');
      return;
    }

    setProcesandoRappi(true);
    try {
      const usuarioId = sesion?.usuario_id || sesion?.id;
      const montoTotalRappi = rappiActivo.total;

      const payloadVenta = {
        sede_id: SEDE_ID_MARTINETO,
        mesa_id: null,
        usuario_id: usuarioId ? String(usuarioId) : null,
        monto_total: montoTotalRappi,
        pago_efectivo: 0,
        pago_nequi: 0,
        pago_daviplata: 0,
        rappi: montoTotalRappi,
        descuento: 0,
        motivo_descuento: null,
        cambio: 0,
        estado: 'rappi',
        items: rappiActivo.items
      };

      const { data, error } = await supabase.from('venta').insert([payloadVenta]).select();

      if (error) {
        alert('Error guardando pedido Rappi en la tabla "venta": ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        setVentasDiaBD((prev) => [...prev, data[0]]);
        await descontarStockEmpaquesPorVentaBD(rappiActivo.items);
      }

      setPedidosRappi((prev) => prev.filter((r) => r.id !== mesaActivaId));
      setMesaActivaId(null);
      alert('🚀 ¡Pedido Rappi entregado, guardado en Rappi y cerrado con éxito!');
    } finally {
      setProcesandoRappi(false);
    }
  }

  function marcarTodosEntregados() {
    if (!mesaActiva || mesaActiva.items.length === 0) {
      alert('⚠️ No hay productos en la orden.');
      return;
    }
    setMesas((prev) =>
      prev.map((m) => {
        if (m.id === mesaActivaId) {
          const itemsActuales = m.items.map((i: any) => ({
            ...i,
            estadoItem: i.estadoItem === 'pedido' ? 'entregado' : i.estadoItem,
          }));
          const estaTotalmentePagado = ((m.totalAbonado || 0) + (m.descuentoAcumulado || 0)) >= m.total && m.total > 0;
          const nuevoEstado = estaTotalmentePagado ? 'pagada' : 'entregado';

          actualizarEstadoMesaBD(m.id, nuevoEstado);

          return {
            ...m,
            items: itemsActuales,
            estado: nuevoEstado,
          };
        }
        return m;
      })
    );
    alert('✅ Todos los productos pendientes pasaron a estado ENTREGADO.');
  }

  function abrirModalCobro() {
    if (!mesaActiva || mesaActiva.items.length === 0) {
      alert('⚠️ No hay productos en la orden para cobrar.');
      return;
    }
    const pendiente = Math.max(0, mesaActiva.total - (mesaActiva.totalAbonado || 0) - (mesaActiva.descuentoAcumulado || 0));
    setPagoEfectivo(pendiente);
    setPagoNequi('');
    setPagoDaviplata('');
    setDescuentoVenta('');
    setMotivoDescuentoVenta('');
    setMostrarModalCobro(true);
  }

  async function procesarCobroMesa() {
    if (!mesaActiva || procesandoPago) return;

    const efec = Number(pagoEfectivo) || 0;
    const neq = Number(pagoNequi) || 0;
    const dav = Number(pagoDaviplata) || 0;
    const desc = Number(descuentoVenta) || 0;
    const motivoDesc = motivoDescuentoVenta.trim();

    if (desc > 0 && !motivoDesc) {
      alert('⚠️ Si aplicas un descuento, debes ingresar obligatoriamente el motivo.');
      return;
    }

    const pendienteActualSinDesc = Math.max(0, mesaActiva.total - (mesaActiva.totalAbonado || 0) - (mesaActiva.descuentoAcumulado || 0));

    if (desc > pendienteActualSinDesc) {
      alert('⚠️ El descuento no puede ser mayor que el valor pendiente por pagar.');
      return;
    }

    const pendienteAjustado = pendienteActualSinDesc - desc;
    const sumaAbonoActual = efec + neq + dav;

    if (sumaAbonoActual <= 0 && pendienteAjustado > 0) {
      alert('⚠️ Ingresa un monto válido para el abono o pago.');
      return;
    }

    setProcesandoPago(true);
    try {
      const usuarioId = sesion?.usuario_id || sesion?.id;

      const montoTotalVentaAjustado = Math.max(0, mesaActiva.total - desc);

      const payloadVenta = {
        sede_id: SEDE_ID_MARTINETO,
        mesa_id: typeof mesaActivaId === 'number' ? mesaActivaId : null,
        usuario_id: usuarioId ? String(usuarioId) : null,
        monto_total: montoTotalVentaAjustado,
        pago_efectivo: efec,
        pago_nequi: neq,
        pago_daviplata: dav,
        rappi: 0,
        descuento: desc,
        motivo_descuento: desc > 0 ? motivoDesc : null,
        cambio: Math.max(0, sumaAbonoActual - pendienteAjustado),
        estado: sumaAbonoActual >= pendienteAjustado ? 'pagado' : 'abono',
        items: mesaActiva.items
      };

      const { data, error } = await supabase.from('venta').insert([payloadVenta]).select();

      if (error) {
        alert('Error registrando el pago/abono: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        setVentasDiaBD((prev) => [...prev, data[0]]);
        await descontarStockEmpaquesPorVentaBD(mesaActiva.items);
      }

      const nuevoTotalAbonado = (mesaActiva.totalAbonado || 0) + sumaAbonoActual;
      const nuevoDescuentoAcumulado = (mesaActiva.descuentoAcumulado || 0) + desc;
      const estaCompletamentePagado = (nuevoTotalAbonado + nuevoDescuentoAcumulado) >= mesaActiva.total;

      setMesas((prev) =>
        prev.map((m) => {
          if (m.id === mesaActivaId) {
            const algunPendienteEntrega = m.items.some((i: any) => (i.estadoItem || 'pedido') === 'pedido');

            let nuevoEstadoMesa = m.estado;
            if (estaCompletamentePagado) {
              nuevoEstadoMesa = algunPendienteEntrega ? 'ocupada' : 'pagada';
            } else {
              nuevoEstadoMesa = 'ocupada';
            }

            actualizarEstadoMesaBD(m.id, nuevoEstadoMesa);

            return {
              ...m,
              totalAbonado: nuevoTotalAbonado,
              descuentoAcumulado: nuevoDescuentoAcumulado,
              estado: nuevoEstadoMesa,
            };
          }
          return m;
        })
      );

      setMostrarModalCobro(false);

      if (estaCompletamentePagado) {
        alert('✅ ¡Cuenta pagada con éxito!');
      } else {
        alert(
          `✅ ¡Abono registrado con éxito! Saldo pendiente: $ ${(
            mesaActiva.total - nuevoTotalAbonado - nuevoDescuentoAcumulado
          ).toLocaleString('es-CO')}`
        );
      }
    } finally {
      setProcesandoPago(false);
    }
  }

  function liberarMesa() {
    if (!mesaActivaId) return;

    if (hayProductosPorEntregar) {
      alert('⚠️ No puedes liberar la mesa porque aún hay productos pendientes POR ENTREGAR.');
      return;
    }

    actualizarEstadoMesaBD(Number(mesaActivaId), 'libre');

    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaActivaId
          ? { ...m, items: [], total: 0, totalAbonado: 0, descuentoAcumulado: 0, estado: 'libre' }
          : m
      )
    );
    alert('🧹 Mesa liberada con éxito.');
  }

  const obtenerItemsAgrupados = (items: any[]) => {
    if (!items || items.length === 0) return [];

    const mapa = new Map<string, any>();

    items.forEach((item) => {
      const estado = item.estadoItem || 'pedido';
      const claveUnica = `${item.nombre}___${estado}`;

      if (mapa.has(claveUnica)) {
        const existente = mapa.get(claveUnica);
        existente.cantidad += item.cantidad || 1;
      } else {
        mapa.set(claveUnica, {
          ...item,
          cantidad: item.cantidad || 1,
          estadoItem: estado,
        });
      }
    });

    return Array.from(mapa.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
  };

  const itemsVisualesAgrupados = itemActivoActual ? obtenerItemsAgrupados(itemActivoActual.items) : [];
  const hayProductosPorEntregar = itemActivoActual?.items?.some((i: any) => (i.estadoItem || 'pedido') === 'pedido') || false;
  const saldoPendienteActual = itemActivoActual ? Math.max(0, itemActivoActual.total - (itemActivoActual.totalAbonado || 0) - (itemActivoActual.descuentoAcumulado || 0)) : 0;

  const mesaTotalmentePagada =
    !esRappiActivo &&
    mesaActiva &&
    saldoPendienteActual === 0 &&
    mesaActiva.total > 0 &&
    !hayProductosPorEntregar;

  const sumaGastosTotal = listaGastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);
  const cadenaMotivosGastos = listaGastos.map((g) => g.concepto).join(', ');

  const totalEfectivoIngresado = ventasDiaBD.reduce((acc, v) => acc + Number(v.pago_efectivo || 0), 0);
  const totalNequiIngresado = ventasDiaBD.reduce((acc, v) => acc + Number(v.pago_nequi || 0), 0);
  const totalDaviplataIngresado = ventasDiaBD.reduce((acc, v) => acc + Number(v.pago_daviplata || 0), 0);

  const totalDescuentosDia = ventasDiaBD.reduce((acc, v) => acc + Number(v.descuento || 0), 0);
  const listaMotivosUnicosDescuento = Array.from(
    new Set(
      ventasDiaBD
        .map((v) => v.motivo_descuento)
        .filter((m): m is string => Boolean(m && m.trim() !== ''))
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  const totalRappiRealizados = ventasDiaBD
    .filter((v) => v.estado === 'rappi' || Number(v.rappi || 0) > 0)
    .reduce((acc, v) => acc + Number(v.rappi || v.monto_total || 0), 0);

  const totalVentasElectronicas = totalRappiRealizados + totalNequiIngresado + totalDaviplataIngresado;
  const totalVentasGlobal = totalEfectivoIngresado + totalVentasElectronicas;

  const totalNominaDia = listaNominasDia.reduce((acc, n) => acc + Number(n.monto || 0), 0);

  // Mapeos directos sin operaciones adicionales (tal como se solicitó)
  const totalEfectivoRecibido = totalEfectivoIngresado;
  const efectivoEsperadoEnCaja = (Number(baseCaja) || 0) + totalEfectivoRecibido;
  const efectivoTotalNetoCierre = efectivoEsperadoEnCaja;
  const cajaDisponibleCalculada = efectivoTotalNetoCierre;

  const listaAuditoriaInventario = LISTA_EMPAQUES_MARTINETO.map((nombreProd) => {
    let cantApertura = 0;

    const movimientoApertura = movimientosDiaBD.find((m) => m.tipo === 'apertura');
    if (movimientoApertura) {
      if (nombreProd === 'Total Paletas') {
        cantApertura = Number(movimientoApertura.totalPaletas) || 0;
      } else {
        cantApertura = Number(movimientoApertura.detalle?.[nombreProd]) || 0;
      }
    } else {
      cantApertura = obtenerStockActualBD(nombreProd);
    }

    const entradasAdicionales = movimientosDiaBD
      .filter((m) => m.tipo === 'nuevas' || m.tipo === 'compras')
      .reduce((acc, m) => {
        if (nombreProd === 'Total Paletas') return acc + Number(m.totalPaletas || 0);
        return acc + Number(m.detalle?.[nombreProd] || 0);
      }, 0);

    let mermasDeBaja = movimientosDiaBD
      .filter((m) => m.tipo === 'debaja')
      .reduce((acc, m) => {
        if (nombreProd === 'Total Paletas') return acc + Number(m.totalPaletas || 0);
        return acc + Number(m.detalle?.[nombreProd] || 0);
      }, 0);

    if (nombreProd === 'Corralito') {
      const tapasUsadasMermas = ventasDiaBD.reduce((accV, v) => {
        const items = v.items || [];
        return (
          accV +
          items.reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if ((n.includes('corralito') || n.includes('waffle')) && n.includes('llevar')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);

      mermasDeBaja += tapasUsadasMermas;
    }

    let cantVendidas = 0;

    if (nombreProd === 'Vaso 12 onzas') {
      cantVendidas = ventasDiaBD.reduce((accV, v) => {
        const items = v.items || [];
        const vasosEnVenta = items.reduce((accI: number, i: any) => {
          const n = (i.nombre || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          if (
            n.includes('malteada') ||
            n.includes('yogurneto') ||
            n.includes('soda') ||
            n.includes('jugo') ||
            n.includes('limonada') ||
            n.includes('martifrappe') ||
            n.includes('maracumango') ||
            n.includes('achocolatada') ||
            n.includes('coffe') ||
            n.includes('coffee') ||
            n.includes('vaso 12')
          ) {
            return accI + Number(i.cantidad || 1);
          }
          return accI;
        }, 0);
        return accV + vasosEnVenta;
      }, 0);
    } else if (nombreProd === 'Helado de Oblea') {
      cantVendidas = ventasDiaBD.reduce((accV, v) => {
        const items = v.items || [];
        return (
          accV +
          items.reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('oblea') || n.includes('helado de oblea')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);
    } else if (nombreProd === 'Caja Mostac') {
      cantVendidas = ventasDiaBD.reduce((accV, v) => {
        const items = v.items || [];
        return (
          accV +
          items.reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('mostac') || n.includes('paleta enchilada')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);
    } else if (nombreProd === 'Doritos') {
      cantVendidas = ventasDiaBD.reduce((accV, v) => {
        const items = v.items || [];
        return (
          accV +
          items.reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('doritos') || n.includes('dorinetos')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);
    } else if (nombreProd === 'Corralito') {
      cantVendidas = ventasDiaBD.reduce((accV, v) => {
        const items = v.items || [];
        return (
          accV +
          items.reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('corralito') || n.includes('waffle')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);
    } else if (nombreProd === 'Total Paletas') {
      cantVendidas = ventasDiaBD.reduce((accV, v) => {
        const items = v.items || [];
        return (
          accV +
          items.reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('paleta')) return accI + Number(i.cantidad || 1);
            return accI;
          }, 0)
        );
      }, 0);
    } else {
      cantVendidas = ventasDiaBD.reduce((accV, v) => {
        const items = v.items || [];
        const coincidencias = items.filter((i: any) => i.nombre.toLowerCase().includes(nombreProd.toLowerCase()));
        return accV + coincidencias.reduce((accI: number, item: any) => accI + Number(item.cantidad || 0), 0);
      }, 0);
    }

    const cantCalculadaQuedan = Math.max(0, cantApertura + entradasAdicionales - mermasDeBaja - cantVendidas);

    return {
      nombre: nombreProd,
      apertura: cantApertura,
      entradas: entradasAdicionales,
      mermas: mermasDeBaja,
      vendidos: cantVendidas,
      calculado: cantCalculadaQuedan,
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

  const productosVendidosConsolidados = (() => {
    const mapaVentas = new Map<string, number>();
    ventasDiaBD.forEach((v) => {
      const items = v.items || [];
      items.forEach((i: any) => {
        const nom = i.nombre || 'Sin Nombre';
        const cant = Number(i.cantidad || 1);
        mapaVentas.set(nom, (mapaVentas.get(nom) || 0) + cant);
      });
    });
    return Array.from(mapaVentas.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  })();

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

  async function guardarCierreDefinitivoBD() {
    if (guardandoCierre) return;

    if (!nominaPagadaEnTurno) {
      const totalNominaCalculado = calcularTotalNomina();
      if (totalNominaCalculado <= 0) {
        alert('⚠️ NO PUEDES REALIZAR EL CIERRE:\n\nDebes liquidar y pagar obligatoriamente la nómina antes del cierre. Por favor ingresa las horas trabajadas.');
        return;
      }
    }

    const mesasOcupadas = mesas.filter((m) => m.estado !== 'libre');
    const hayRappiPendientes = pedidosRappi.length > 0;
    const pedidosPendientesDeEnviar = resumenPedidoActual.length > 0;

    if (pedidosPendientesDeEnviar) {
      alert(`⚠️ NO PUEDES REALIZAR EL CIERRE:\n\nTienes ${resumenPedidoActual.length} producto(s) en la lista de Pedidos a Bodega que aún no se han enviado ni limpiado. Por favor dirígete al módulo de Pedidos y envíalo o retíralo.`);
      setModuloActivo('pedidos');
      setMostrarModalResumen(false);
      return;
    }

    if (mesasOcupadas.length > 0 || hayRappiPendientes) {
      let mensajeError = '⚠️ NO PUEDES REALIZAR EL CIERRE TOTAL DEL DÍA:\n\n';
      if (mesasOcupadas.length > 0) {
        mensajeError += `• Hay ${mesasOcupadas.length} mesa(s) sin liberar: ${mesasOcupadas.map((m) => m.nombre).join(', ')}.\n`;
      }
      if (hayRappiPendientes) {
        mensajeError += `• Hay ${pedidosRappi.length} pedido(s) Rappi activos sin entregar.\n`;
      }
      alert(mensajeError);
      return;
    }

    if (efectivoContadoCierre === '') {
      alert('⚠️ Ingresa la cantidad exacta de efectivo que estás dejando en caja.');
      return;
    }

    const efectFisico = Number(efectivoContadoCierre);
    const efectEsperado = efectivoEsperadoEnCaja;
    const difCaja = efectFisico - efectEsperado;

    if (difCaja !== 0 && !motivoDescuadre.trim()) {
      alert('⚠️ Existe un DESCUADRE DE CAJA. Debes ingresar obligatoriamente el motivo / explicación del descuadre.');
      return;
    }

    setGuardandoCierre(true);
    const usuarioId = sesion?.usuario_id || sesion?.id;
    const turnoId = sesion?.turno_id ? Number(sesion.turno_id) : null;

    try {
      const inicioDia = obtenerInicioDiaColombia();

      let motivosAjustados = [...listaMotivosUnicosDescuento];
      if (difCaja !== 0 && motivoDescuadre.trim()) {
        motivosAjustados.push(`[DESCUADRE CAJA: $${difCaja.toLocaleString('es-CO')}]: ${motivoDescuadre.trim()}`);
      }

      let queryCaja = supabase
        .from('caja')
        .update({
          estado: 'cerrada',
          efectivo_cierre: efectivoTotalNetoCierre,
          efectivo_fisico: efectFisico,
          rappi: totalRappiRealizados,
          nequi: totalNequiIngresado,
          daviplata: totalDaviplataIngresado,
          monto_gasto: sumaGastosTotal,
          motivo_gasto: cadenaMotivosGastos || null,
          descuento: totalDescuentosDia,
          motivo_descuento: motivosAjustados,
          diferencia: difCaja,
        });

      if (cajaIdActual) {
        queryCaja = queryCaja.eq('id', cajaIdActual);
      } else {
        queryCaja = queryCaja
          .eq('sede_id', SEDE_ID_MARTINETO)
          .gte('fecha', inicioDia)
          .eq('estado', 'abierta');
      }

      const { error: errorCaja } = await queryCaja;

      if (errorCaja) {
        throw new Error('Error actualizando la tabla caja: ' + errorCaja.message);
      }

      const jsonVentasDelDia: { [nombreProd: string]: number } = {};
      productosVendidosConsolidados.forEach((pv) => {
        jsonVentasDelDia[pv.nombre] = pv.cantidad;
      });

      const { error: errorHistoricoVentas } = await supabase.from('historico_ventas').insert([
        {
          sede_id: SEDE_ID_MARTINETO,
          fecha: obtenerFechaHoraColombia(),
          productos: jsonVentasDelDia,
        }
      ]);

      if (errorHistoricoVentas) {
        throw new Error('Error guardando en historico_ventas: ' + errorHistoricoVentas.message);
      }

      const detallePaletasCierre: { [key: string]: number } = {};
      const detalleEmpaquesCierre: { [key: string]: number } = {};
      let totalPaletasCierreNum = 0;

      listaAuditoriaInventario.forEach((item) => {
        const cantFinal =
          conteoFisicoProductos[item.nombre] !== '' && conteoFisicoProductos[item.nombre] !== undefined
            ? Number(conteoFisicoProductos[item.nombre])
            : item.calculado;

        if (item.nombre === 'Total Paletas') {
          totalPaletasCierreNum = cantFinal;
        } else if (LISTA_EMPAQUES_MARTINETO.includes(item.nombre)) {
          detalleEmpaquesCierre[item.nombre] = cantFinal;
        } else {
          detallePaletasCierre[item.nombre] = cantFinal;
        }
      });

      const exitoInv = await registrarMovimientoMartineto(
        SEDE_ID_MARTINETO,
        usuarioId,
        'cierre',
        totalPaletasCierreNum,
        detallePaletasCierre,
        detalleEmpaquesCierre,
        'Cierre de turno y cuadre de inventario físico',
        turnoId || undefined
      );

      if (!exitoInv) throw new Error('Error guardando el movimiento de cierre en inventario_diario.');

      for (const [nombreProd, cantFinal] of Object.entries(detalleEmpaquesCierre)) {
        const empReg = empaquesBD.find(
          (e) => e.nombre.toLowerCase().trim() === nombreProd.toLowerCase().trim()
        );
        if (empReg) {
          await supabase
            .from('empaques_martineto')
            .update({ stock: cantFinal })
            .eq('id', empReg.id);
        }
      }

      alert('✅ ¡CIERRE TOTAL DEL DÍA GUARDADO CON ÉXITO EN LA BASE DE DATOS!');
      setMostrarModalResumen(false);

      limpiarBaseCaja();
      limpiarTotalPaletasInv();
      limpiarCantidadesInv();
      limpiarObsInv();
      limpiarPedidosCat();
      limpiarObsPedido();
      limpiarConceptoGasto();
      limpiarMontoGasto();

      localStorage.removeItem('martineto_session');
      router.push('/login');
    } catch (err: any) {
      alert('⚠️ ' + err.message);
    } finally {
      setGuardandoCierre(false);
    }
  }

  const totalPagoDigitado = (Number(pagoEfectivo) || 0) + (Number(pagoNequi) || 0) + (Number(pagoDaviplata) || 0);
  const totalDescuentoDigitado = Number(descuentoVenta) || 0;
  const saldoCobroRequerido = Math.max(0, saldoPendienteActual - totalDescuentoDigitado);
  const diferenciaCobro = totalPagoDigitado - saldoCobroRequerido;

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#004e8c] flex items-center justify-center text-xs font-bold font-sans text-white">
        Cargando Martineto POS...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#004e8c] text-[#f1f5f9] p-4 font-sans max-w-[1600px] mx-auto space-y-4 relative">
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-base md:text-lg font-black text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00a4ef] inline-block"></span>
            🍦 MARTINETO POS (Sede Principal)
          </h1>
          <p className="text-xs text-sky-200 mt-1">
            Operador en Turno: <b className="text-white">{sesion?.nombre || 'Iris'}</b> ({sesion?.turno_nombre || 'DÍA COMPLETO'})
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
          1. 📦 Apertura y Movimientos
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
          2. 🚚 Pedidos
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
          3. 💸 Gastos
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
          4. 🛒 Ventas
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
            moduloActivo === 'cierre' ? 'bg-purple-600 text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3] hover:text-white'
          }`}
        >
          5. 🌙 Cierre
        </button>
      </nav>

      {bloqueadoPorApertura && (
        <div className="bg-amber-950/80 border border-amber-400/60 p-3 rounded-xl text-center text-xs text-amber-200 font-bold">
          ⚠️ ATENCIÓN: Debes registrar la Base de Caja y el <b>Conteo Físico de Apertura (Módulo 1)</b> para habilitar las ventas.
        </div>
      )}

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
                ref={(el) => { inputRefs.current['totalPaletas'] = el; }}
                type="text"
                inputMode="numeric"
                placeholder={tipoMovimiento === 'apertura' ? String(obtenerStockActualBD('Total Paletas')) : '0'}
                value={totalPaletasInventario}
                onChange={(e) => setTotalPaletasInventario(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                onKeyDown={handleKeyDownTotalPaletas}
                disabled={guardandoMovimiento}
                className="w-28 bg-[#0e385e] text-sky-200 placeholder-sky-300/40 font-black text-center text-sm rounded-lg p-2 outline-none border border-[#0066b3]"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            <span className="text-xs text-sky-300 font-bold block uppercase">
              {tipoMovimiento === 'apertura' ? 'CONTEO DE EMPAQUES (ORDEN ALFABÉTICO):' : `CANTIDADES DE EMPAQUES A REGISTRAR (${tipoMovimiento.toUpperCase()}):`}
            </span>
            {listaEmpaquesFiltrados.map((item, idx) => {
              const stockItem = obtenerStockActualBD(item);

              return (
                <div key={item} className="flex justify-between items-center bg-[#051829] p-2.5 rounded-lg border border-[#0066b3]">
                  <span className="text-xs text-white font-bold flex items-center gap-1.5">📦 {item}:</span>
                  <input
                    ref={(el) => { inputRefs.current[item] = el; }}
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
                    onKeyDown={(e) => handleKeyDownEmpaques(e, idx)}
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

      {moduloActivo === 'pedidos' && (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-start ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="lg:col-span-7 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">2. 🚚 Seleccionar Pedido a Bodega</h2>
              <button
                onClick={() => setMostrarModalNuevoProd(true)}
                disabled={enviandoPedido || guardandoProducto}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer shadow disabled:opacity-50"
              >
                ➕ Crear Nuevo Producto
              </button>
            </div>

            <div className="sticky top-16 z-30 bg-[#0b2b48] pt-2 pb-2 space-y-2 border-b border-[#0066b3]/40">
              <div className="grid grid-cols-5 gap-1.5">
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
                insumosFiltrados.map((prod, idx) => (
                  <div key={prod.id || prod.nombre} className="flex justify-between items-center bg-[#051829] p-3 rounded-xl border border-[#0066b3]">
                    <div>
                      <p className="text-xs text-white font-bold">{prod.nombre}</p>
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
                🛒 Listado del Pedido en Curso ({resumenPedidoActual.length} ítems)
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
                      <span className="text-[10px] text-sky-300 uppercase">Cat: {item.categoria}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-600 text-white font-black text-[11px] px-2 py-0.5 rounded-md">
                        {item.cantidad} un.
                      </span>
                      <button
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
              onClick={enviarPedidoBodega}
              disabled={enviandoPedido}
              className={`w-full font-black py-3 rounded-xl text-xs uppercase shadow-md transition-all ${
                enviandoPedido
                  ? 'bg-emerald-800 text-white cursor-not-allowed opacity-75'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              }`}
            >
              {enviandoPedido ? '⏳ Enviando Pedido...' : `🚀 Enviar Pedido a Bodega (${resumenPedidoActual.length} productos)`}
            </button>
          </div>

          <div className="lg:col-span-12 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-3 shadow-md mt-2">
            <h3 className="text-xs font-black text-sky-200 uppercase flex items-center justify-between">
              <span>📋 HISTORIAL DE PEDIDOS SOLICITADOS HOY (CONSOLIDADOS)</span>
            </h3>

            <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
              {historialPedidosBD.length === 0 ? (
                <p className="text-xs text-sky-400 italic text-center py-6">
                  No hay productos solicitados hoy en la base de datos.
                </p>
              ) : (
                [
                  { clave: 'pedidos_paletas', titulo: 'PALETAS' },
                  { clave: 'pedidos_richi', titulo: 'RICHI / EMPAQUES' },
                  { clave: 'pedidos_produccion', titulo: 'PRODUCCIÓN' },
                  { clave: 'pedidos_insumos', titulo: 'INSUMOS / TOPPINGS' },
                  { clave: 'pedidos_aseo', titulo: 'ASEO' },
                ].map((cat) => {
                  const productosDeCat: { pedidoId: number; nombre: string; cant: number }[] = [];

                  historialPedidosBD.forEach((ped) => {
                    const mapa = ped[cat.clave];
                    if (mapa) {
                      Object.entries(mapa).forEach(([nom, cant]) => {
                        const val = Number(cant) || 0;
                        if (val > 0) {
                          productosDeCat.push({ pedidoId: ped.id, nombre: nom, cant: val });
                        }
                      });
                    }
                  });

                  if (productosDeCat.length === 0) return null;

                  productosDeCat.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

                  return (
                    <div key={cat.clave} className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-2.5">
                      <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-1.5">
                        <span className="font-black text-sky-300 text-xs flex items-center gap-1.5 uppercase">
                          🏷️ {cat.titulo}
                        </span>
                        <span className="text-[10px] text-sky-400 font-bold">
                          {productosDeCat.length} tipo(s)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {productosDeCat.map((item, idx) => (
                          <div
                            key={`${item.pedidoId}_${item.nombre}_${idx}`}
                            className="bg-[#0e385e] border border-[#0066b3] p-2.5 rounded-lg flex justify-between items-center text-xs"
                          >
                            <span className="font-bold text-white truncate max-w-[140px]">
                              {item.nombre}
                            </span>

                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-600 text-white font-black text-[11px] px-2 py-0.5 rounded-md">
                                {item.cant} un.
                              </span>
                              <button
                                onClick={() => borrarProductoEspecificoDePedido(item.pedidoId, cat.clave, item.nombre)}
                                disabled={eliminandoPedido}
                                title="Quitar este producto del pedido"
                                className="text-sky-300 hover:text-rose-400 font-black text-sm px-1 rounded transition-colors cursor-pointer disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {historialPedidosBD.length > 0 && (
              <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-2 mt-4">
                <div className="flex items-center justify-between border-b border-[#0066b3]/50 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMostrarGestorEnvios(!mostrarGestorEnvios)}
                      title={mostrarGestorEnvios ? 'Ocultar envíos' : 'Mostrar envíos'}
                      className="text-sky-300 hover:text-white font-bold text-sm px-1.5 py-0.5 rounded bg-[#0e385e] border border-[#0066b3] cursor-pointer transition-colors"
                    >
                      {mostrarGestorEnvios ? '👁️‍🗨️' : '👁️'}
                    </button>
                    <span className="text-[11px] font-black text-amber-300 uppercase">
                      ⚙️ GESTOR DE ENVÍOS DE HOY (ELIMINAR SI SE CARGÓ MAL)
                    </span>
                  </div>
                </div>

                {mostrarGestorEnvios && (
                  <div className="space-y-1.5 pt-1">
                    {historialPedidosBD.map((ped) => (
                      <div key={ped.id} className="bg-[#0e385e] border border-[#0066b3] rounded-lg p-2 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={pedidosSeleccionados.includes(ped.id)}
                            onChange={() => toggleSeleccionPedido(ped.id)}
                            disabled={eliminandoPedido}
                            className="w-4 h-4 accent-amber-500 cursor-pointer"
                          />
                          <span className="text-white font-bold">
                            Hora: {new Date(ped.fecha).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })} (Pedido #{ped.id})
                          </span>
                        </div>

                        <button
                          onClick={() => borrarPedidosBD([ped.id])}
                          disabled={eliminandoPedido}
                          className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer disabled:opacity-50"
                        >
                          🗑️ Borrar
                        </button>
                      </div>
                    ))}

                    {pedidosSeleccionados.length > 0 && (
                      <button
                        onClick={() => borrarPedidosBD(pedidosSeleccionados)}
                        disabled={eliminandoPedido}
                        className="w-full bg-rose-700 hover:bg-rose-600 text-white font-black py-2 rounded-xl text-xs uppercase cursor-pointer mt-2 border border-rose-500 disabled:opacity-50"
                      >
                        🗑️ Borrar Seleccionados ({pedidosSeleccionados.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {moduloActivo === 'gastos' && (
        <div className={`bg-[#0b2b48] border border-amber-500/60 p-5 rounded-2xl space-y-4 shadow-md max-w-2xl mx-auto ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center border-b border-amber-500/40 pb-2">
            <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
              3. 💸 Registro de Gastos Directos de Insumos (Descuenta de Caja)
            </h2>
            <span className="text-xs font-black text-amber-400">
              Total Gastos Insumos: $ {sumaGastosTotal.toLocaleString('es-CO')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Concepto (ej. 1 kg fresa, plátanos, bolsas...)"
              value={conceptoGasto}
              onChange={(e) => setConceptoGasto(e.target.value)}
              disabled={guardandoGasto}
              className="sm:col-span-7 bg-[#051829] border border-[#0066b3] text-white text-xs rounded-xl p-3 outline-none font-bold"
            />
            <input
              type="text"
              placeholder="Monto $"
              value={formatearMoneda(montoGasto)}
              onChange={(e) => setMontoGasto(desformatearMoneda(e.target.value))}
              disabled={guardandoGasto}
              className="sm:col-span-3 bg-[#051829] border border-[#0066b3] text-amber-300 text-xs rounded-xl p-3 outline-none font-black text-center"
            />
            <button
              onClick={registrarNuevoGasto}
              disabled={guardandoGasto}
              className={`sm:col-span-2 font-black rounded-xl text-xs uppercase cursor-pointer py-3 transition-all ${
                guardandoGasto
                  ? 'bg-amber-800 text-white cursor-not-allowed opacity-75'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {guardandoGasto ? '...' : '+ Gasto'}
            </button>
          </div>

          <div className="space-y-2 border-t border-[#0066b3]/30 pt-3">
            <span className="text-xs text-sky-300 font-bold block uppercase">Historial de Salidas de Caja Hoy:</span>
            {listaGastos.length === 0 ? (
              <p className="text-xs text-sky-400 italic py-4 text-center">No hay gastos de insumos registrados hoy.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {listaGastos.map((g) => (
                  <div key={g.id} className="flex justify-between items-center bg-[#051829] p-3 rounded-xl border border-amber-500/30 text-xs">
                    <span className="text-white font-bold">🛒 {g.concepto} <small className="text-sky-300 font-normal">({g.hora})</small></span>
                    <span className="text-amber-300 font-black">- $ {g.monto.toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {moduloActivo === 'ventas' && (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch h-[calc(100vh-140px)] overflow-hidden ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          
          <div className={`${!mesaActivaId ? 'lg:col-span-12' : itemActivoActual && itemActivoActual.items.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#0b2b48] border border-[#0066b3] p-3 rounded-2xl flex flex-col shadow-md transition-all duration-300 h-full overflow-hidden`}>
            <div className="flex flex-col gap-2 border-b border-[#0066b3]/50 pb-2 shrink-0">
              <h2 className="text-xs font-black text-white text-center">🪑 Mesas</h2>
              <div className="flex gap-1 justify-center">
                <button
                  onClick={() => setMostrarModalConsultaCaja(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] px-2 py-1 rounded-lg uppercase cursor-pointer shadow border border-emerald-400"
                >
                  💵 Caja
                </button>
                <button
                  onClick={agregarNuevoRappi}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-[9px] px-2 py-1 rounded-lg uppercase cursor-pointer shadow"
                >
                  +Rappi
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 overflow-y-auto pr-1 pt-2 flex-1">
              {pedidosRappi.map((rappi) => {
                const activa = mesaActivaId === rappi.id;
                const estaPreparado = rappi.estado === 'Preparando';

                return (
                  <div
                    key={rappi.id}
                    onClick={() => setMesaActivaId(rappi.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between shadow-md shrink-0 ${
                      activa
                        ? 'border-white ring-2 ring-white bg-rose-700'
                        : estaPreparado
                        ? 'bg-amber-700/90 border-amber-400'
                        : 'bg-rose-950/80 border-rose-500 hover:bg-rose-900'
                    }`}
                  >
                    <p className="font-black text-[11px] text-white uppercase truncate">📦 {rappi.nombre}</p>
                    <p className="text-[9px] font-bold text-rose-200 mt-0.5">{rappi.estado}</p>
                  </div>
                );
              })}

              {mesas.map((mesa) => {
                const estadoLimpio = String(mesa.estado || 'libre').toLowerCase();
                const ocupada = estadoLimpio === 'ocupada';
                const entregado = estadoLimpio === 'entregado';
                const pagada = estadoLimpio === 'pagada';
                const activa = mesaActivaId === mesa.id;

                let estiloColor = 'bg-[#051829] border-[#0066b3] hover:border-[#00a4ef]';
                let textoEstadoColor = 'text-sky-300';

                if (activa) {
                  estiloColor = 'border-white ring-2 ring-white bg-[#005c99]';
                  textoEstadoColor = 'text-white';
                } else if (pagada) {
                  estiloColor = 'bg-purple-900/90 border-purple-500';
                  textoEstadoColor = 'text-purple-200';
                } else if (entregado) {
                  estiloColor = 'bg-amber-800/90 border-amber-400';
                  textoEstadoColor = 'text-amber-200';
                } else if (ocupada) {
                  estiloColor = 'bg-emerald-800/90 border-emerald-500';
                  textoEstadoColor = 'text-emerald-200';
                }

                return (
                  <div
                    key={mesa.id}
                    onClick={() => setMesaActivaId(mesa.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between shadow-md shrink-0 ${estiloColor}`}
                  >
                    <p className="font-black text-[11px] text-white uppercase truncate">{mesa.nombre}</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className={`text-[9px] font-bold capitalize ${textoEstadoColor}`}>{mesa.estado}</p>
                      <p className="text-[10px] text-emerald-300 font-black">${mesa.total.toLocaleString('es-CO')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {mesaActivaId && (
            <div className={`${itemActivoActual && itemActivoActual.items.length > 0 ? 'lg:col-span-6' : 'lg:col-span-9'} bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex flex-col shadow-md transition-all duration-300 h-full overflow-hidden`}>
              <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2 shrink-0">
                <h2 className="text-xs md:text-sm font-black text-white">📂 Categorías y Productos</h2>
                <span className="text-xs text-sky-200 font-bold truncate max-w-[150px]">
                  Activo: <b className="text-emerald-300">{itemActivoActual ? itemActivoActual.nombre : 'Ninguno'}</b>
                </span>
              </div>

              <div className="pt-2 shrink-0 space-y-2">
                <input
                  type="text"
                  placeholder="🔍 Buscar producto por nombre..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  className="w-full bg-[#051829] border-2 border-[#00a4ef] text-white text-xs font-bold rounded-xl p-2.5 outline-none shadow-inner"
                />

                <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    onClick={() => setCategoriaVentaSel('TODAS')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase cursor-pointer transition-all shrink-0 ${
                      categoriaVentaSel === 'TODAS'
                        ? 'bg-[#00a4ef] text-white border border-white shadow'
                        : 'bg-[#0e385e] text-sky-200 border border-[#0066b3]'
                    }`}
                  >
                    🌟 TODAS
                  </button>
                  {listaCategoriasVenta.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoriaVentaSel(cat)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase cursor-pointer transition-all shrink-0 ${
                        categoriaVentaSel.toLowerCase() === cat.toLowerCase()
                          ? 'bg-[#00a4ef] text-white border border-white shadow'
                          : 'bg-[#0e385e] text-sky-200 border border-[#0066b3]'
                      }`}
                    >
                      🏷️ {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 pr-1 pt-2 flex-1">
                {productosFiltradosVenta.length === 0 ? (
                  <p className="text-xs text-sky-400 italic col-span-full py-6 text-center">
                    No hay productos que coincidan con la búsqueda.
                  </p>
                ) : (
                  productosFiltradosVenta.map((prod) => {
                    const esCorralito =
                      (prod.nombre || '').toLowerCase().includes('corralito') ||
                      (prod.nombre || '').toLowerCase().includes('waffle');

                    return (
                      <div
                        key={prod.id || prod.nombre}
                        className="bg-[#0e385e] border border-[#0066b3] p-3 rounded-xl flex flex-col justify-between shadow-sm h-fit"
                      >
                        <div>
                          <p className="font-black text-white text-xs leading-snug">{prod.nombre}</p>
                          <p className="text-[10px] text-sky-300 uppercase mt-0.5">{prod.categoriaMostrar}</p>
                          <p className="text-xs text-emerald-300 font-black mt-1">
                            $ {Number(prod.precio || 0).toLocaleString('es-CO')}
                          </p>
                        </div>

                        {esCorralito ? (
                          <div className="grid grid-cols-2 gap-1.5 mt-3 pt-1 border-t border-[#0066b3]">
                            <button
                              onClick={() => agregarProductoAMesa(prod, false)}
                              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] py-1.5 rounded-lg text-center cursor-pointer shadow"
                            >
                              🍽️ Mesa
                            </button>
                            <button
                              onClick={() => agregarProductoAMesa(prod, true)}
                              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] py-1.5 rounded-lg text-center cursor-pointer shadow"
                            >
                              🛵 Llevar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => agregarProductoAMesa(prod, false)}
                            className="w-full bg-[#0066b3] hover:bg-[#0078d4] text-white font-black text-[11px] py-2 rounded-xl mt-3 cursor-pointer shadow"
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

          {itemActivoActual && itemActivoActual.items.length > 0 && (
            <div className="lg:col-span-4 bg-[#0b2b48] border border-[#0066b3] p-3.5 rounded-2xl flex flex-col shadow-md transition-all duration-300 h-full overflow-hidden">
              <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2 shrink-0">
                <h2 className="text-xs font-black text-white">🧾 Productos Pedidos</h2>
                <span className="bg-[#051829] text-sky-300 text-[9px] px-2 py-0.5 rounded border border-[#0066b3] uppercase font-bold">
                  {esRappiActivo ? rappiActivo?.estado : mesaActiva ? mesaActiva.estado : ''}
                </span>
              </div>

              <div className="overflow-y-auto space-y-2 pr-1 pt-2 flex-1">
                {itemsVisualesAgrupados.map((i: any, idx: number) => {
                  const estado = i.estadoItem || 'pedido';

                  let badgeBg = 'bg-emerald-800 text-emerald-200 border-emerald-500';
                  if (estado === 'entregado') badgeBg = 'bg-amber-700 text-amber-200 border-amber-400';

                  const esRappiPreparado = esRappiActivo && rappiActivo?.estado === 'Preparado';

                  return (
                    <div key={`${i.nombre}_${estado}_${idx}`} className="bg-[#051829] border border-[#0066b3] p-2.5 rounded-xl space-y-2 shadow-sm">
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-black text-xs text-white leading-tight">
                          {i.cantidad > 1 ? `${i.cantidad}x ` : ''}{i.nombre}
                        </span>
                        {!esRappiActivo && (
                          <span className="text-[11px] font-black text-emerald-300 whitespace-nowrap">
                            $ {(Number(i.precio || 0) * i.cantidad).toLocaleString('es-CO')}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-1.5 border-t border-[#0066b3]/40">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-black border uppercase ${badgeBg}`}>
                          {estado}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {!esRappiActivo && estado === 'pedido' && (
                            <button
                              onClick={() => marcarItemEntregado(i.nombre, estado)}
                              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-lg cursor-pointer shadow"
                              title="Marcar entregado"
                            >
                              ✓ Entregar
                            </button>
                          )}
                          {!esRappiPreparado && (
                            <div className="flex items-center bg-[#0e385e] border border-[#0066b3] rounded-lg overflow-hidden shadow">
                              <button
                                onClick={() => restarProductoDeMesa(i.nombre, estado)}
                                className="bg-rose-800 hover:bg-rose-700 text-white font-bold text-xs px-2 py-0.5 cursor-pointer"
                                title="Restar"
                              >
                                −
                              </button>
                              <button
                                onClick={() => {
                                  const productoOriginal = productosVenta.find((p) => p.nombre.replace(' (LLEVAR)', '') === i.nombre.replace(' (LLEVAR)', ''));
                                  if (productoOriginal) {
                                    agregarProductoAMesa(productoOriginal, i.nombre.includes('(LLEVAR)'));
                                  } else {
                                    agregarProductoAMesa({ nombre: i.nombre.replace(' (LLEVAR)', ''), precio: i.precio }, i.nombre.includes('(LLEVAR)'));
                                  }
                                }}
                                className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-2 py-0.5 cursor-pointer border-l border-[#0066b3]"
                                title="Sumar"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="shrink-0 pt-2 space-y-2 border-t border-[#0066b3]/50 mt-2">
                {!esRappiActivo && (
                  <div className="bg-[#051829] border border-[#0066b3] p-2 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between text-sky-200">
                      <span>Subtotal:</span>
                      <b>$ {itemActivoActual.total.toLocaleString('es-CO')}</b>
                    </div>
                    {itemActivoActual.totalAbonado > 0 && (
                      <div className="flex justify-between text-amber-300">
                        <span>Abonado:</span>
                        <b>$ {itemActivoActual.totalAbonado.toLocaleString('es-CO')}</b>
                      </div>
                    )}
                    {(itemActivoActual.descuentoAcumulado || 0) > 0 && (
                      <div className="flex justify-between text-rose-300">
                        <span>Descuento:</span>
                        <b>- $ {itemActivoActual.descuentoAcumulado.toLocaleString('es-CO')}</b>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-white pt-1 border-t border-[#0066b3]/50">
                      <span>Saldo Pendiente:</span>
                      <span className="text-emerald-400">$ {saldoPendienteActual.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                )}

                {(!esRappiActivo || rappiActivo?.estado !== 'Preparado') && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Concepto extra"
                        value={nombreAdicionManual}
                        onChange={(e) => setNombreAdicionManual(e.target.value)}
                        className="w-full bg-[#051829] border border-[#0066b3] text-white text-[11px] p-1.5 rounded-lg outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Valor $"
                        value={formatearMoneda(valorAdicionManual)}
                        onChange={(e) => setValorAdicionManual(desformatearMoneda(e.target.value))}
                        className="w-20 bg-[#051829] border border-[#0066b3] text-amber-300 font-black text-[11px] p-1.5 rounded-lg outline-none text-center"
                      />
                      <button
                        onClick={agregarAdicionManualAMesa}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-2.5 rounded-lg cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {esRappiActivo ? (
                  <div className="space-y-1.5">
                    {rappiActivo?.estado === 'Preparando' ? (
                      <button
                        onClick={marcarRappiPreparado}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-2 rounded-xl text-xs uppercase cursor-pointer shadow"
                      >
                        🍳 Marcar Preparado
                      </button>
                    ) : (
                      <button
                        onClick={procesarEntregarRappiDirecto}
                        disabled={procesandoRappi}
                        className={`w-full font-black py-2 rounded-xl text-xs uppercase shadow-md transition-all ${
                          procesandoRappi
                            ? 'bg-emerald-800 text-white cursor-not-allowed opacity-75'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                        }`}
                      >
                        {procesandoRappi ? '⏳ Procesando...' : '🛵 Entregar Rappi'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {hayProductosPorEntregar && (
                      <button
                        onClick={marcarTodosEntregados}
                        className="col-span-full bg-amber-600 hover:bg-amber-500 text-white font-black py-2 rounded-xl text-xs uppercase cursor-pointer shadow"
                      >
                        ✓ Entregar Todo
                      </button>
                    )}

                    <button
                      onClick={abrirModalCobro}
                      disabled={procesandoPago}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-md disabled:opacity-50"
                    >
                      💳 Cobrar
                    </button>

                    {mesaTotalmentePagada ? (
                      <button
                        onClick={liberarMesa}
                        className="bg-purple-700 hover:bg-purple-600 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-md"
                      >
                        🧹 Liberar
                      </button>
                    ) : (
                      <div className="bg-[#051829] border border-[#0066b3] text-sky-300 font-bold text-[9px] p-1.5 rounded-xl flex items-center justify-center text-center">
                        {saldoPendienteActual > 0 ? 'Falta Pagar' : 'Entregar Todo'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {moduloActivo === 'cierre' && (
        <div className={`bg-[#0b2b48] border border-purple-500/60 p-5 rounded-2xl space-y-4 shadow-md max-w-3xl mx-auto ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center border-b border-purple-500/40 pb-2">
            <h2 className="text-sm font-black text-purple-300 flex items-center gap-1.5">
              5. 🌙 Módulo de Cierre de Turno y Cuadre de Caja
            </h2>
          </div>

          <div className="bg-[#051829] border border-purple-500/40 p-4 rounded-xl space-y-3">
            <span className="text-xs font-black text-purple-200 uppercase block border-b border-purple-500/30 pb-1">
              💸 Liquidación de Nómina del Turno ({sesion?.nombre || 'Operario'})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-sky-300 block mb-1 font-bold">Tipo de Día:</label>
                <select
                  value={tipoDia}
                  onChange={(e) => setTipoDia(e.target.value)}
                  disabled={nominaPagadaEnTurno || procesandoNomina}
                  className="w-full bg-[#0e385e] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none font-bold disabled:opacity-50"
                >
                  <option value="entre_semana">Entre Semana (Ordinario)</option>
                  <option value="festivo">Festivo / Dominical</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-sky-300 block mb-1 font-bold">Horas Día Trabajadas:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={horasDia}
                  onChange={(e) => setHorasDia(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                  disabled={nominaPagadaEnTurno || procesandoNomina}
                  className="w-full bg-[#0e385e] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none font-black text-center disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[10px] text-sky-300 block mb-1 font-bold">Horas Noche Trabajadas:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={horasNoche}
                  onChange={(e) => setHorasNoche(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                  disabled={nominaPagadaEnTurno || procesandoNomina}
                  className="w-full bg-[#0e385e] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none font-black text-center disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex justify-between items-center bg-[#0e385e] p-3 rounded-xl border border-[#0066b3]">
              <span className="text-xs text-white font-bold">Total Nómina a Pagar:</span>
              <span className="text-xs text-emerald-300 font-black">$ {calcularTotalNomina().toLocaleString('es-CO')}</span>
            </div>

            <div className="pt-2">
              <button
                onClick={pagarNominaSolo}
                disabled={nominaPagadaEnTurno || procesandoNomina}
                className={`w-full font-black py-3 rounded-xl text-xs uppercase shadow-md transition-all ${
                  nominaPagadaEnTurno
                    ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed border border-emerald-500'
                    : procesandoNomina
                    ? 'bg-emerald-800 text-white cursor-not-allowed opacity-75'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                }`}
              >
                {nominaPagadaEnTurno ? '✓ Nómina Pagada' : procesandoNomina ? '⏳ Procesando...' : '💸 Pagar Nómina del Turno'}
              </button>
            </div>
          </div>

          {esTurnoManana && (
            <div className="bg-[#051829] border border-amber-500/50 p-4 rounded-xl space-y-3">
              <span className="text-xs font-black text-amber-300 uppercase block border-b border-amber-500/30 pb-1">
                🔄 Entregar Turno (Mañana ➡️ Tarde)
              </span>
              <p className="text-xs text-sky-200">
                Usa esta opción para entregar el turno al operario de la tarde. Se liquidará tu nómina y el sistema cambiará al turno Tarde / Cierre.
              </p>
              <button
                onClick={() => setMostrarModalCambioTurno(true)}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-md"
              >
                🔄 Entregar Turno a Operario Entrante
              </button>
            </div>
          )}

          <div className="bg-[#051829] border border-purple-500/40 p-4 rounded-xl space-y-3">
            <span className="text-xs font-black text-purple-200 uppercase block border-b border-purple-500/30 pb-1">
              🌙 Cierre Total del Día y Arqueo General
            </span>
            <p className="text-xs text-sky-200">
              Cuando terminen todas las operaciones del día y se hayan liberado todas las mesas y pedidos Rappi, puedes proceder al arqueo final de caja e inventario.
            </p>

            <button
              onClick={() => {
                if (!nominaPagadaEnTurno) {
                  const totalNominaCalculado = calcularTotalNomina();
                  if (totalNominaCalculado <= 0) {
                    alert('⚠️ NO PUEDES CONTINUAR AL CIERRE:\n\nDebes liquidar y pagar obligatoriamente la nómina antes del cierre. Por favor ingresa las horas trabajadas.');
                    return;
                  }
                }

                const mesasOcupadas = mesas.filter((m) => m.estado !== 'libre');
                const hayRappiPendientes = pedidosRappi.length > 0;
                const pedidosPendientesDeEnviar = resumenPedidoActual.length > 0;

                if (pedidosPendientesDeEnviar) {
                  alert(`⚠️ No puedes abrir el resumen de cierre:\n\nTienes ${resumenPedidoActual.length} producto(s) en la lista de Pedidos a Bodega que aún no se han enviado.`);
                  setModuloActivo('pedidos');
                  return;
                }

                if (mesasOcupadas.length > 0 || hayRappiPendientes) {
                  alert('⚠️ No puedes abrir el resumen de cierre porque hay mesas o pedidos Rappi activos.');
                  return;
                }
                setMostrarModalResumen(true);
              }}
              disabled={guardandoCierre}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white font-black py-3.5 rounded-xl text-xs uppercase cursor-pointer shadow-md disabled:opacity-50"
            >
              📋 Abrir Resumen de Cierre y Conteo Físico Final
            </button>
          </div>
        </div>
      )}

      {mostrarModalCambioTurno && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border border-amber-500/60 p-5 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-amber-500/40 pb-2">
              <h3 className="text-sm font-black text-amber-300 uppercase">🔄 Entregar Turno de Mañana</h3>
              <button
                onClick={() => setMostrarModalCambioTurno(false)}
                disabled={validandoEntrante}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {!nominaPagadaEnTurno && (
                <div className="bg-amber-950/80 border border-amber-400 p-2.5 rounded-xl text-amber-200 font-bold">
                  ⚠️ Asegúrate de haber pagado tu nómina antes de entregar el turno.
                </div>
              )}

              <div>
                <label className="text-sky-300 font-bold block mb-1">Operario Entrante (Turno Tarde):</label>
                <select
                  value={operarioEntranteId}
                  onChange={(e) => setOperarioEntranteId(e.target.value)}
                  disabled={validandoEntrante}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold p-2.5 rounded-xl outline-none cursor-pointer"
                >
                  {listaOperarios.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nombre_completo || op.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sky-300 font-bold block mb-1">Clave / PIN del Operario Entrante:</label>
                <input
                  type="password"
                  placeholder="PIN o clave..."
                  value={claveOperarioEntrante}
                  onChange={(e) => setClaveOperarioEntrante(e.target.value)}
                  disabled={validandoEntrante}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold p-2.5 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMostrarModalCambioTurno(false)}
                disabled={validandoEntrante}
                className="w-1/2 bg-[#051829] hover:bg-[#0e385e] border border-[#0066b3] text-white font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEntranteYCambiarTurno}
                disabled={validandoEntrante}
                className={`w-1/2 font-black py-2.5 rounded-xl text-xs uppercase shadow-md transition-all ${
                  validandoEntrante
                    ? 'bg-amber-800 text-white cursor-not-allowed opacity-75'
                    : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                }`}
              >
                {validandoEntrante ? '⏳ Confirmando...' : 'Confirmar y Entregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalConsultaCaja && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-sm font-black text-white uppercase">💵 Consulta Rápida de Caja</h3>
              <button
                onClick={() => setMostrarModalConsultaCaja(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs bg-[#051829] p-3 rounded-xl border border-[#0066b3]">
              <div className="flex justify-between">
                <span className="text-sky-300">Base Inicial:</span>
                <b className="text-white">$ {(Number(baseCaja) || 0).toLocaleString('es-CO')}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-sky-300">Total Efectivo Ingresado (Ventas):</span>
                <b className="text-emerald-300">$ {totalEfectivoIngresado.toLocaleString('es-CO')}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-sky-300">Total Nequi / Daviplata:</span>
                <b className="text-sky-300">$ {(totalNequiIngresado + totalDaviplataIngresado).toLocaleString('es-CO')}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-sky-300">Total Rappi (Electrónico):</span>
                <b className="text-rose-300">$ {totalRappiRealizados.toLocaleString('es-CO')}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-300">Gastos Directos de Insumos:</span>
                <b className="text-amber-300">- $ {sumaGastosTotal.toLocaleString('es-CO')}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300">Total Nómina Pagada:</span>
                <b className="text-purple-300">- $ {totalNominaDia.toLocaleString('es-CO')}</b>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#0066b3]/50 text-sm font-black">
                <span className="text-white">Efectivo Disponible en Caja:</span>
                <span className="text-emerald-400">$ {cajaDisponibleCalculada.toLocaleString('es-CO')}</span>
              </div>
            </div>

            <button
              onClick={() => setMostrarModalConsultaCaja(false)}
              className="w-full bg-[#0066b3] hover:bg-[#0078d4] text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {mostrarModalCobro && mesaActiva && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-sm font-black text-white uppercase">💳 Cobrar / Abonar a {mesaActiva.nombre}</h3>
              <button
                onClick={() => setMostrarModalCobro(false)}
                disabled={procesandoPago}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-sky-200">
                <span>Total de la Cuenta:</span>
                <b>$ {mesaActiva.total.toLocaleString('es-CO')}</b>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Total ya Abonado:</span>
                <b>$ {(mesaActiva.totalAbonado || 0).toLocaleString('es-CO')}</b>
              </div>
              {(mesaActiva.descuentoAcumulado || 0) > 0 && (
                <div className="flex justify-between text-rose-300">
                  <span>Descuentos Previos:</span>
                  <b>- $ {mesaActiva.descuentoAcumulado.toLocaleString('es-CO')}</b>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-[#0066b3]/50">
                <span>Saldo Pendiente Actual:</span>
                <span className="text-emerald-400">$ {saldoPendienteActual.toLocaleString('es-CO')}</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-sky-300 font-bold block mb-1">Efectivo recibido ($):</label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatearMoneda(pagoEfectivo)}
                  onChange={(e) => setPagoEfectivo(desformatearMoneda(e.target.value))}
                  disabled={procesandoPago}
                  className="w-full bg-[#051829] border border-[#0066b3] text-emerald-300 font-black text-sm p-2.5 rounded-xl outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sky-300 font-bold block mb-1">Nequi ($):</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={formatearMoneda(pagoNequi)}
                    onChange={(e) => setPagoNequi(desformatearMoneda(e.target.value))}
                    disabled={procesandoPago}
                    className="w-full bg-[#051829] border border-[#0066b3] text-sky-300 font-black text-xs p-2 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="text-sky-300 font-bold block mb-1">Daviplata ($):</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={formatearMoneda(pagoDaviplata)}
                    onChange={(e) => setPagoDaviplata(desformatearMoneda(e.target.value))}
                    disabled={procesandoPago}
                    className="w-full bg-[#051829] border border-[#0066b3] text-sky-300 font-black text-xs p-2 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#0066b3]/40">
                <div>
                  <label className="text-amber-300 font-bold block mb-1">Descuento ($):</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={formatearMoneda(descuentoVenta)}
                    onChange={(e) => setDescuentoVenta(desformatearMoneda(e.target.value))}
                    disabled={procesandoPago}
                    className="w-full bg-[#051829] border border-[#0066b3] text-amber-300 font-black text-xs p-2 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="text-amber-300 font-bold block mb-1">Motivo Descuento:</label>
                  <input
                    type="text"
                    placeholder="Ej. Cortesía, error..."
                    value={motivoDescuentoVenta}
                    onChange={(e) => setMotivoDescuentoVenta(e.target.value)}
                    disabled={procesandoPago}
                    className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold text-xs p-2 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="bg-[#051829] border border-emerald-500/60 p-3 rounded-xl space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-sky-200">
                  <span>Total Ingresado (Efectivo + Nequi + Daviplata):</span>
                  <b className="text-emerald-300">$ {totalPagoDigitado.toLocaleString('es-CO')}</b>
                </div>
                {totalDescuentoDigitado > 0 && (
                  <div className="flex justify-between text-xs text-amber-300">
                    <span>Descuento Aplicado:</span>
                    <b>- $ {totalDescuentoDigitado.toLocaleString('es-CO')}</b>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black pt-1 border-t border-[#0066b3]/50">
                  <span>{diferenciaCobro >= 0 ? 'Cambio / Devuelta:' : 'Falta por Pagar:'}</span>
                  <span className={diferenciaCobro >= 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                    $ {Math.abs(diferenciaCobro).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMostrarModalCobro(false)}
                disabled={procesandoPago}
                className="w-1/2 bg-[#051829] hover:bg-[#0e385e] border border-[#0066b3] text-white font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={procesarCobroMesa}
                disabled={procesandoPago}
                className={`w-1/2 font-black py-2.5 rounded-xl text-xs uppercase shadow-md transition-all ${
                  procesandoPago
                    ? 'bg-emerald-800 text-white cursor-not-allowed opacity-75'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                }`}
              >
                {procesandoPago ? '⏳ Registrando...' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalNuevoProd && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h3 className="text-sm font-black text-white uppercase">➕ Crear Nuevo Producto en Base de Datos</h3>
              <button
                onClick={() => setMostrarModalNuevoProd(false)}
                disabled={guardandoProducto}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[400px] overflow-y-auto pr-1">
              <div>
                <label className="text-sky-300 font-bold block mb-1">Nombre del Producto:</label>
                <input
                  type="text"
                  placeholder="Ej. Vasos de cartón 8oz, Cucharas..."
                  value={nuevoProdNombre}
                  onChange={(e) => setNuevoProdNombre(e.target.value)}
                  disabled={guardandoProducto}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold p-2.5 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="text-sky-300 font-bold block mb-1">Categoría / Pestaña:</label>
                <select
                  value={nuevoProdCategoria}
                  onChange={(e) => setNuevoProdCategoria(e.target.value)}
                  disabled={guardandoProducto}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold p-2.5 rounded-xl outline-none cursor-pointer"
                >
                  <option value="Paleta">Paleta</option>
                  <option value="Richi / Empaque">Richi / Empaque</option>
                  <option value="Producción">Producción</option>
                  <option value="Insumo">Insumo</option>
                  <option value="Aseo">Aseo</option>
                </select>
              </div>

              <div>
                <label className="text-sky-300 font-bold block mb-1">¿Dónde comprar / Proveedor?:</label>
                <select
                  value={nuevoProdDondeComprar}
                  onChange={(e) => setNuevoProdDondeComprar(e.target.value)}
                  disabled={guardandoProducto}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold p-2.5 rounded-xl outline-none cursor-pointer"
                >
                  {listaLugaresCompraUnica.map((lugar) => (
                    <option key={lugar} value={lugar}>
                      {lugar}
                    </option>
                  ))}
                  <option value="Otro">Otro (Personalizado)...</option>
                </select>
              </div>

              {nuevoProdDondeComprar === 'Otro' && (
                <div>
                  <label className="text-sky-300 font-bold block mb-1">Nombre del Proveedor / Lugar:</label>
                  <input
                    type="text"
                    placeholder="Escribe el lugar de compra..."
                    value={dondeComprarPersonalizado}
                    onChange={(e) => setDondeComprarPersonalizado(e.target.value)}
                    disabled={guardandoProducto}
                    className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold p-2.5 rounded-xl outline-none"
                  />
                </div>
              )}

              <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sky-300 font-bold block">Asignar a Sedes:</label>
                  <button
                    type="button"
                    onClick={() => {
                      const sedesFiltradasIds = listaSedesBD
                        .filter((s) => {
                          const nombreSede = (s.nombre || '').toLowerCase();
                          return (
                            !nombreSede.includes('global') &&
                            !nombreSede.includes('administración') &&
                            !nombreSede.includes('administracion') &&
                            !nombreSede.includes('producción') &&
                            !nombreSede.includes('produccion')
                          );
                        })
                        .map((s) => s.id);

                      if (sedesSeleccionadasProd.length === sedesFiltradasIds.length) {
                        setSedesSeleccionadasProd([]);
                      } else {
                        setSedesSeleccionadasProd(sedesFiltradasIds);
                      }
                    }}
                    disabled={guardandoProducto}
                    className="text-[10px] text-emerald-400 font-bold hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Seleccionar todas
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {listaSedesBD
                    .filter((s) => {
                      const nombreSede = (s.nombre || '').toLowerCase();
                      return (
                        !nombreSede.includes('global') &&
                        !nombreSede.includes('administración') &&
                        !nombreSede.includes('administracion') &&
                        !nombreSede.includes('producción') &&
                        !nombreSede.includes('produccion')
                      );
                    })
                    .map((s) => {
                      const estaSeleccionada = sedesSeleccionadasProd.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                            estaSeleccionada
                              ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                              : 'bg-[#0e385e] border-[#0066b3] text-sky-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={estaSeleccionada}
                            onChange={() => handleToggleSedeProd(s.id)}
                            disabled={guardandoProducto}
                            className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                          />
                          {s.nombre || `Sede ${s.id}`}
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMostrarModalNuevoProd(false)}
                disabled={guardandoProducto}
                className="w-1/2 bg-[#051829] hover:bg-[#0e385e] border border-[#0066b3] text-white font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={crearNuevoProductoBD}
                disabled={guardandoProducto}
                className={`w-1/2 font-black py-2.5 rounded-xl text-xs uppercase shadow-md transition-all ${
                  guardandoProducto
                    ? 'bg-emerald-800 text-white cursor-not-allowed opacity-75'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                }`}
              >
                {guardandoProducto ? '⏳ Guardando...' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalResumen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border border-purple-500/60 p-5 rounded-2xl w-full max-w-4xl space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-purple-500/40 pb-2">
              <h3 className="text-sm font-black text-purple-300 uppercase">📋 Resumen Consolidado de Cierre y Auditoría</h3>
              <button
                onClick={() => setMostrarModalResumen(false)}
                disabled={guardandoCierre}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#051829] border border-[#0066b3] p-4 rounded-xl space-y-2">
                <span className="font-black text-[#00a4ef] block uppercase border-b border-[#0066b3]/50 pb-1">
                  💵 Cuadre de Caja
                </span>
                <div className="flex justify-between">
                  <span>Base Inicial:</span>
                  <b>$ {(Number(baseCaja) || 0).toLocaleString('es-CO')}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total Efectivo Recibido (Ventas):</span>
                  <b className="text-emerald-300">$ {totalEfectivoRecibido.toLocaleString('es-CO')}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total Gastos de Insumos:</span>
                  <b className="text-amber-300">- $ {sumaGastosTotal.toLocaleString('es-CO')}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total Nómina Pagada:</span>
                  <b className="text-purple-300">- $ {totalNominaDia.toLocaleString('es-CO')}</b>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#0066b3]/50 font-black">
                  <span>Efectivo Esperado en Caja:</span>
                  <span className="text-emerald-400">$ {efectivoEsperadoEnCaja.toLocaleString('es-CO')}</span>
                </div>

                {listaNominasDia.length > 0 && (
                  <div className="pt-2 border-t border-[#0066b3]/30 space-y-1">
                    <span className="text-[10px] text-purple-300 font-bold block uppercase">
                      👤 Nóminas Pagadas Hoy ({listaNominasDia.length}):
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {listaNominasDia.map((nom) => (
                        <div key={nom.id} className="flex justify-between text-[11px] bg-[#0e385e] p-1.5 rounded border border-[#0066b3]">
                          <span className="text-white font-bold">{nom.nombreOperario} <small className="text-sky-300 font-normal">({nom.hora})</small></span>
                          <span className="text-purple-300 font-black">$ {nom.monto.toLocaleString('es-CO')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <label className="text-purple-300 font-bold block">Efectivo Físico Contado en Caja ($):</label>
                  <input
                    type="text"
                    placeholder="Efectivo contado"
                    value={formatearMoneda(efectivoContadoCierre)}
                    onChange={(e) => setEfectivoContadoCierre(desformatearMoneda(e.target.value))}
                    disabled={guardandoCierre}
                    className="w-full bg-[#0e385e] border border-purple-500/50 text-emerald-300 font-black text-sm p-2.5 rounded-xl outline-none"
                  />

                  {efectivoContadoCierre !== '' && (() => {
                    const efectFisico = Number(efectivoContadoCierre);
                    const efectEsperado = efectivoEsperadoEnCaja;
                    const dif = efectFisico - efectEsperado;
                    const hayDescuadre = dif !== 0;

                    let mensajeDiferencia = '';
                    if (dif > 0) {
                      mensajeDiferencia = `⚠️ SOBRANTE DE CAJA: El efectivo físico en caja ($ ${efectFisico.toLocaleString('es-CO')}) es MAYOR al esperado ($ ${efectEsperado.toLocaleString('es-CO')}) por $ ${Math.abs(dif).toLocaleString('es-CO')}`;
                    } else if (dif < 0) {
                      mensajeDiferencia = `⚠️ FALTANTE DE CAJA: El efectivo esperado ($ ${efectEsperado.toLocaleString('es-CO')}) es MAYOR al físico en caja ($ ${efectFisico.toLocaleString('es-CO')}) por $ ${Math.abs(dif).toLocaleString('es-CO')}`;
                    }

                    return (
                      <div className="space-y-2 pt-1">
                        <p className={`text-xs font-black uppercase ${hayDescuadre ? 'text-rose-500' : 'text-emerald-300'}`}>
                          {hayDescuadre ? mensajeDiferencia : `✓ CAJA CUADRADA EXCELENTE ($ 0)`}
                        </p>

                        {hayDescuadre && (
                          <div className="bg-rose-950/60 border border-rose-500 p-2.5 rounded-xl space-y-1">
                            <label className="text-rose-300 font-black text-[11px] block uppercase">
                              Motivo / Explicación del Descuadre (Obligatorio):
                            </label>
                            <input
                              type="text"
                              placeholder="Ej. Billete falso, devuelta mal entregada, falta comprobante..."
                              value={motivoDescuadre}
                              onChange={(e) => setMotivoDescuadre(e.target.value)}
                              disabled={guardandoCierre}
                              className="w-full bg-[#051829] border border-rose-400 text-white font-bold text-xs p-2 rounded-lg outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="bg-[#051829] border border-[#0066b3] p-4 rounded-xl space-y-2">
                <span className="font-black text-[#00a4ef] block uppercase border-b border-[#0066b3]/50 pb-1">
                  💳 Ingresos Electrónicos y Ventas Globales
                </span>
                <div className="flex justify-between">
                  <span>Total Nequi / Daviplata:</span>
                  <b>$ {(totalNequiIngresado + totalDaviplataIngresado).toLocaleString('es-CO')}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total Rappi:</span>
                  <b>$ {totalRappiRealizados.toLocaleString('es-CO')}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total Descuentos Aplicados:</span>
                  <b className="text-amber-300">$ {totalDescuentosDia.toLocaleString('es-CO')}</b>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#0066b3]/50 font-black text-sm">
                  <span>Ventas Totales del Día:</span>
                  <span className="text-emerald-400">$ {totalVentasGlobal.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#051829] border border-[#0066b3] p-4 rounded-xl space-y-3">
              <span className="font-black text-[#00a4ef] block uppercase border-b border-[#0066b3]/50 pb-1">
                📦 Auditoría de Inventario Final (Conteo Físico)
              </span>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {listaAuditoriaInventario.map((item) => (
                  <div key={item.nombre} className="bg-[#0e385e] border border-[#0066b3] p-2 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white block">{item.nombre}</span>
                      <span className="text-[10px] text-sky-300">
                        Apertura: {item.apertura} | Entradas: {item.entradas} | Mermas: {item.mermas} | Vendidos: {item.vendidos} | Calc: <b>{item.calculado}</b>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-sky-200">Físico:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={String(item.calculado)}
                        value={conteoFisicoProductos[item.nombre] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, ''));
                          setConteoFisicoProductos((prev) => ({
                            ...prev,
                            [item.nombre]: val,
                          }));
                        }}
                        disabled={guardandoCierre}
                        className="w-20 bg-[#051829] border border-[#0066b3] text-emerald-300 font-black text-center text-xs p-1.5 rounded outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMostrarModalResumen(false)}
                disabled={guardandoCierre}
                className="w-1/2 bg-[#051829] hover:bg-[#0e385e] border border-[#0066b3] text-white font-bold py-3 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={guardarCierreDefinitivoBD}
                disabled={guardandoCierre}
                className={`w-1/2 font-black py-3 rounded-xl text-xs uppercase shadow-md transition-all ${
                  guardandoCierre
                    ? 'bg-purple-900 text-white cursor-not-allowed opacity-75'
                    : 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                }`}
              >
                {guardandoCierre ? '⏳ Guardando Cierre Definitivo...' : '🔒 Confirmar y Guardar Cierre Definitivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}