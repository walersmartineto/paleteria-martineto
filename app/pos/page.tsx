'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  registrarMovimientoMartineto,
} from '@/lib/martinetoQueries';
import { supabase } from '@/lib/supabase';
import { useAutoSave } from '@/hooks/useAutoSave';

const LISTA_EMPAQUES_MARTINETO = [
  'Total Paletas',
  'Caja Mostac',
  'Corralito',
  'Doritos',
  'Frascos Chamoy',
  'Helado de Oblea',
  'Muñeco Lego',
  'Vaso 12 onzas',
  'Vaso Gomita Enchilada',
  'Vaso Soft',
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
  const soloNumeros = String(val).replace(/\D/g, '');
  return soloNumeros === '' ? '' : Number(soloNumeros);
};

type CategoriaTab = 'paletas' | 'richi' | 'produccion' | 'insumos' | 'aseo';
type ModuloPrincipal = 'movimientos' | 'pedidos' | 'gastos' | 'ventas' | 'cierre';

export default function MartinetoPOSPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);

  // MÓDULO ACTIVO NAVEGACIÓN
  const [moduloActivo, setModuloActivo] = useState<ModuloPrincipal>('movimientos');

  // AUTO-SAVE: Base de Caja (Limpiamos residuos de '1' al iniciar)
  const [baseCaja, setBaseCaja, limpiarBaseCaja] = useAutoSave<number | ''>('martineto_baseCaja', '');
  const [baseGuardada, setBaseGuardada] = useState(false);
  const [aperturaRealizada, setAperturaRealizada] = useState(false);

  // NUEVA TABLA: EMPAQUES Y PALETAS DESDE BD
  const [empaquesBD, setEmpaquesBD] = useState<any[]>([]);

  // AUTO-SAVE: Inventario y Movimientos
  const [tipoMovimiento, setTipoMovimiento] = useState<string>('apertura');
  const [totalPaletasInventario, setTotalPaletasInventario, limpiarTotalPaletasInv] = useAutoSave<number | ''>('martineto_totalPaletasInv', '');
  const [cantidadesInventario, setCantidadesInventario, limpiarCantidadesInv] = useAutoSave<{ [item: string]: number | '' }>('martineto_cantidadesInv', {});
  const [observacionesInventario, setObservacionesInventario, limpiarObsInv] = useAutoSave<string>('martineto_obsInv', '');

  const [movimientosDiaBD, setMovimientosDiaBD] = useState<any[]>([]);

  // MESAS Y VENTAS
  const [mesas, setMesas] = useState<any[]>([]);
  const [mesaActivaId, setMesaActivaId] = useState<any | null>(null);
  const [productosVenta, setProductosVenta] = useState<any[]>([]);
  const [listaCategoriasVenta, setListaCategoriasVenta] = useState<string[]>([]);
  const [categoriaVentaSel, setCategoriaVentaSel] = useState<string>('TODAS');
  const [busquedaProducto, setBusquedaProducto] = useState<string>('');
  const [errorLecturaBD, setErrorLecturaBD] = useState<string | null>(null);

  // HISTORIAL DE VENTAS REALIZADAS EN EL DÍA
  const [ventasDiaBD, setVentasDiaBD] = useState<any[]>([]);

  // RAPPI ACTIVOS
  const [pedidosRappi, setPedidosRappi] = useState<any[]>([]);

  // MODAL DE CONSULTA FLOTANTE DE CAJA Y VENTAS
  const [mostrarModalConsultaCaja, setMostrarModalConsultaCaja] = useState(false);

  // MODAL DE COBRO / PAGO MIXTO, ABONOS Y DESCUENTO CON MOTIVO
  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState<number | ''>('');
  const [pagoNequi, setPagoNequi] = useState<number | ''>('');
  const [pagoDaviplata, setPagoDaviplata] = useState<number | ''>('');
  const [descuentoVenta, setDescuentoVenta] = useState<number | ''>('');
  const [motivoDescuentoVenta, setMotivoDescuentoVenta] = useState<string>('');
  const [procesandoPago, setProcesandoPago] = useState(false);

  // AUTO-SAVE: Requisiciones / Pedidos a Bodega
  const [productosInsumosBD, setProductosInsumosBD] = useState<any[]>([]);
  const [historialPedidosBD, setHistorialPedidosBD] = useState<any[]>([]);
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<number[]>([]);
  const [mostrarGestorEnvios, setMostrarGestorEnvios] = useState(false);
  const [tabPedido, setTabPedido] = useState<CategoriaTab>('paletas');

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

  // AUTO-SAVE: Gastos Directos
  const [listaGastos, setListaGastos] = useState<{ id: string; concepto: string; monto: number; hora: string }[]>([]);
  const [conceptoGasto, setConceptoGasto, limpiarConceptoGasto] = useAutoSave<string>('martineto_conceptoGasto', '');
  const [montoGasto, setMontoGasto, limpiarMontoGasto] = useAutoSave<number | ''>('martineto_montoGasto', '');

  // CIERRE DE DÍA, CUADRE NUMÉRICO DE INVENTARIO Y EFECTIVO CONTADO
  const [mostrarModalResumen, setMostrarModalResumen] = useState(false);
  const [efectivoContadoCierre, setEfectivoContadoCierre] = useState<number | ''>('');
  const [conteoFisicoProductos, setConteoFisicoProductos] = useState<{ [nombreProd: string]: number | '' }>({});
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  // MODAL CREAR NUEVO PRODUCTO EN BD
  const [mostrarModalNuevoProd, setMostrarModalNuevoProd] = useState(false);
  const [nuevoProdNombre, setNuevoProdNombre] = useState('');
  const [nuevoProdCategoria, setNuevoProdCategoria] = useState('Paleta');
  const [nuevoProdGrupo, setNuevoProdGrupo] = useState('');
  const [nuevoProdDondeComprar, setNuevoProdDondeComprar] = useState('Plaza de Mercado');
  const [dondeComprarPersonalizado, setDondeComprarPersonalizado] = useState('');
  const [esProductoGlobal, setEsProductoGlobal] = useState(true);
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  // NÓMINA CON LECTURA DESDE configuracion_tarifa Y ESTADO DE PAGO
  const [tipoDia, setTipoDia] = useState<string>('entre_semana');
  const [horasDia, setHorasDia] = useState<number | ''>('');
  const [horasNoche, setHorasNoche] = useState<number | ''>('');
  const [nominaPagadaEnTurno, setNominaPagadaEnTurno] = useState(false);

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

  const listaEmpaquesFiltrados = LISTA_EMPAQUES_MARTINETO.filter((i) => i !== 'Total Paletas');

  const insumosFiltrados = productosInsumosBD.filter((prod) => {
    const cat = String(prod?.categoriaLimpia || '');

    if (tabPedido === 'paletas') return cat.includes('paleta');
    if (tabPedido === 'richi') return cat.includes('richi') || cat.includes('empaque') || cat.includes('plástico');
    if (tabPedido === 'produccion') return cat.includes('produccion') || cat.includes('prod');
    if (tabPedido === 'insumos') return cat.includes('insumo') || cat.includes('topping');
    if (tabPedido === 'aseo') return cat.includes('aseo') || cat.includes('limpieza');

    return true;
  });

  const listaLugaresCompraUnica = Array.from(
    new Set([
      ...LUGARES_COMPRA_INICIALES,
      ...productosInsumosBD
        .map((p) => p.donde_comprar)
        .filter((lugar): lugar is string => Boolean(lugar && lugar.trim() !== '')),
    ])
  ).sort();

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

    // Limpieza preventiva de residuos '1' en la base de caja al ingresar por primera vez (si no se ha guardado base)
    const valorActualCaja = localStorage.getItem('martineto_baseCaja');
    if (valorActualCaja === '1' || valorActualCaja === 'ús') {
      localStorage.removeItem('martineto_baseCaja');
      setBaseCaja('');
    }

    cargarInicial(ses);
  }, [router]);

  // TIEMPO REAL: ESCUCHAR CAMBIOS EN LAS MESAS Y EN LA TABLA DE EMPAQUES
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
    const hoyLocal = new Date();
    hoyLocal.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('pedidos_insumos')
      .select('*')
      .eq('sede_id', SEDE_ID_MARTINETO)
      .gte('fecha', hoyLocal.toISOString())
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
      const jsonCierreEmpaques = ultimoCierre?.detalle_empaques || {};

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
    if (!confirm(`¿Deseas quitar "${nombreProducto}" de este pedido?`)) return;

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
  }

  const toggleSeleccionPedido = (id: number) => {
    setPedidosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  async function borrarPedidosBD(idsABorrar: number[]) {
    if (idsABorrar.length === 0) return;
    const desc = idsABorrar.length === 1 ? 'este pedido' : `los ${idsABorrar.length} pedidos seleccionados`;
    if (!confirm(`¿Estás segura de eliminar permanentemente ${desc} de la Base de Datos?`)) return;

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

      const { data: configTarifas } = await supabase
        .from('configuracion_tarifa')
        .select('*')
        .single();

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

      const { data: empaquesData } = await supabase
        .from('empaques_martineto')
        .select('*')
        .order('id', { ascending: true });

      if (empaquesData) {
        setEmpaquesBD(empaquesData);
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
          estado: (m.estado || 'libre').toLowerCase(),
        }))
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
        });

        setProductosVenta(prodsVentaLimpios);

        const catsSet = new Set<string>();
        prodsVentaLimpios.forEach((p) => {
          if (p.categoriaMostrar) catsSet.add(p.categoriaMostrar);
        });

        setListaCategoriasVenta(Array.from(catsSet));
        setCategoriaVentaSel('TODAS');
      }

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

  async function pagarYDescontarNominaDeCaja() {
    const totalPago = calcularTotalNomina();

    if (totalPago <= 0) {
      alert('⚠️ El valor a pagar de nómina debe ser mayor a 0 (ingresa horas trabajadas).');
      return;
    }

    const operarioNombre = sesion?.nombre || 'Operador';
    const conceptoNomen = `Pago Nómina Operador - ${operarioNombre} (${horasDia || 0}h Día / ${horasNoche || 0}h Noche)`;
    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    const gastoNominaObj = {
      id: Date.now().toString(),
      concepto: conceptoNomen,
      monto: totalPago,
      hora: horaActual,
    };

    setListaGastos((prev) => [gastoNominaObj, ...prev]);

    await supabase.from('gastos').insert([
      {
        sede_id: SEDE_ID_MARTINETO,
        concepto: conceptoNomen,
        monto: totalPago,
      },
    ]);

    setNominaPagadaEnTurno(true);
    alert(`💸 Pago de Nómina de $ ${totalPago.toLocaleString('es-CO')} registrado y descontado de la Caja.`);
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
      stock: 0,
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
    const monto = baseCaja === '' ? 0 : Number(baseCaja);
    const usuarioId = sesion?.usuario_id || sesion?.id || null;
    const turnoId = sesion?.turno_id ? Number(sesion.turno_id) : null;

    if (monto <= 0) {
      alert('⚠️ Ingresa un monto de base válido mayor al 0.');
      return;
    }

    const { error } = await supabase.from('caja').insert([
      {
        sede_id: SEDE_ID_MARTINETO,
        usuario_id: usuarioId ? Number(usuarioId) : null,
        turno_id: turnoId,
        monto_apertura: monto,
        diferencia: 0,
        estado: 'abierta'
      }
    ]);

    if (error) {
      alert('❌ Error al guardar la base en la caja: ' + error.message);
      return;
    }

    setBaseGuardada(true);
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
      } else if (tipoMovimiento === 'apertura') {
        detalleEmpaquesLimpio[key] = obtenerStockActualBD(key);
      } else {
        detalleEmpaquesLimpio[key] = 0;
      }
    });

    const totalPaletasNum =
      totalPaletasInventario !== ''
        ? Number(totalPaletasInventario)
        : tipoMovimiento === 'apertura'
        ? obtenerStockActualBD('Total Paletas')
        : 0;

    detalleEmpaquesLimpio['Total Paletas'] = totalPaletasNum;

    const exito = await registrarMovimientoMartineto(
      SEDE_ID_MARTINETO,
      usuarioId,
      tipoMovimiento,
      totalPaletasNum,
      {},
      detalleEmpaquesLimpio,
      observacionesInventario,
      sesion?.turno_id ? Number(sesion.turno_id) : undefined
    );

    if (exito) {
      try {
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
      } catch (err) {
        console.error('Error al actualizar stock en empaques_martineto:', err);
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

      alert(`¡${tipoMovimiento.toUpperCase()} registrada y stock actualizado con éxito en la BD!`);

      limpiarTotalPaletasInv();
      limpiarCantidadesInv();
      limpiarObsInv();

      if (tipoMovimiento === 'apertura') {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
        setModuloActivo('ventas');
      }
    } else {
      alert('Error al registrar inventario.');
    }
  }

  async function registrarNuevoGasto() {
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

    const fechaHoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

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
    alert(`💸 Gasto de $ ${valorGasto.toLocaleString('es-CO')} registrado y descontado de la Caja.`);
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
      limpiarPedidosCat();
      limpiarObsPedido();
      await cargarHistorialPedidos();
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

    if (mesaDestino.estado !== 'libre') {
      alert(`⚠️ La mesa ${mesaDestino.nombre} ya está ocupada o pagada.`);
      return;
    }

    actualizarEstadoMesaBD(Number(mesaActivaId), 'libre');
    actualizarEstadoMesaBD(destinoId, 'ocupada');

    setMesas((prev) =>
      prev.map((m) => {
        if (m.id === mesaActivaId) {
          return { ...m, items: [], total: 0, totalAbonado: 0, estado: 'libre' };
        }
        if (m.id === destinoId) {
          return {
            ...m,
            items: mesaActiva.items,
            total: mesaActiva.total,
            totalAbonado: mesaActiva.totalAbonado || 0,
            estado: 'ocupada',
          };
        }
        return m;
      })
    );

    setMesaActivaId(destinoId);
    alert(`🚚 Pedido trasladado con éxito de ${mesaActiva.nombre} a ${mesaDestino.nombre}.`);
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
        const estaTotalmentePagado = (m.totalAbonado || 0) >= m.total && m.total > 0;

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

    if (estadoTarget !== 'pedido') {
      alert('⚠️ Un producto entregado no se puede descontar.');
      return;
    }

    if (esRappiActivo) {
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
              const estaTotalmentePagado = (m.totalAbonado || 0) >= nuevoTotal && nuevoTotal > 0;
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
      mesa_id: null,
      usuario_id: usuarioId ? String(usuarioId) : null,
      monto_total: rappiActivo.total,
      pago_efectivo: 0,
      pago_nequi: 0,
      pago_daviplata: 0,
      descuento: 0,
      motivo_descuento: null,
      cambio: 0,
      estado: 'rappi',
      items: rappiActivo.items,
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
    alert('🚀 ¡Pedido Rappi entregado y liberado!');
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
          const estaTotalmentePagado = (m.totalAbonado || 0) >= m.total && m.total > 0;
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
    const pendiente = Math.max(0, mesaActiva.total - (mesaActiva.totalAbonado || 0));
    setPagoEfectivo(pendiente);
    setPagoNequi('');
    setPagoDaviplata('');
    setDescuentoVenta('');
    setMotivoDescuentoVenta('');
    setMostrarModalCobro(true);
  }

  async function procesarCobroMesa() {
    if (!mesaActiva) return;

    const efec = Number(pagoEfectivo) || 0;
    const neq = Number(pagoNequi) || 0;
    const dav = Number(pagoDaviplata) || 0;
    const desc = Number(descuentoVenta) || 0;
    const motivoDesc = motivoDescuentoVenta.trim();

    if (desc > 0 && !motivoDesc) {
      alert('⚠️ Si aplicas un descuento, debes ingresar obligatoriamente el motivo.');
      return;
    }

    const pendienteActualSinDesc = Math.max(0, mesaActiva.total - (mesaActiva.totalAbonado || 0));

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
      descuento: desc,
      motivo_descuento: desc > 0 ? motivoDesc : null,
      cambio: Math.max(0, sumaAbonoActual - pendienteAjustado),
      estado: sumaAbonoActual >= pendienteAjustado ? 'pagado' : 'abono',
      items: mesaActiva.items,
    };

    const { data, error } = await supabase.from('venta').insert([payloadVenta]).select();

    if (error) {
      alert('Error registrando el pago/abono: ' + error.message);
      setProcesandoPago(false);
      return;
    }

    if (data && data.length > 0) {
      setVentasDiaBD((prev) => [...prev, data[0]]);
      await descontarStockEmpaquesPorVentaBD(mesaActiva.items);
    }

    const nuevoTotalAbonado = (mesaActiva.totalAbonado || 0) + sumaAbonoActual;
    const estaCompletamentePagado = (nuevoTotalAbonado + desc) >= mesaActiva.total;

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
            total: montoTotalVentaAjustado,
            totalAbonado: nuevoTotalAbonado,
            estado: nuevoEstadoMesa,
          };
        }
        return m;
      })
    );

    setProcesandoPago(false);
    setMostrarModalCobro(false);

    if (estaCompletamentePagado) {
      alert('✅ ¡Cuenta pagada con éxito!');
    } else {
      alert(
        `✅ ¡Abono registrado con éxito! Saldo pendiente: $ ${(
          montoTotalVentaAjustado - nuevoTotalAbonado
        ).toLocaleString('es-CO')}`
      );
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
          ? { ...m, items: [], total: 0, totalAbonado: 0, estado: 'libre' }
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

    return Array.from(mapa.values());
  };

  const itemsVisualesAgrupados = itemActivoActual ? obtenerItemsAgrupados(itemActivoActual.items) : [];
  const hayProductosPorEntregar = itemActivoActual?.items?.some((i: any) => (i.estadoItem || 'pedido') === 'pedido') || false;
  const saldoPendienteActual = itemActivoActual ? Math.max(0, itemActivoActual.total - (itemActivoActual.totalAbonado || 0)) : 0;

  const mesaTotalmentePagada =
    !esRappiActivo &&
    mesaActiva &&
    saldoPendienteActual === 0 &&
    mesaActiva.total > 0 &&
    !hayProductosPorEntregar;

  const sumaGastosTotal = listaGastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);

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
  );

  const totalRappiRealizados = ventasDiaBD
    .filter((v) => v.estado === 'rappi')
    .reduce((acc, v) => acc + Number(v.monto_total || 0), 0);

  const totalVentasElectronicas = totalRappiRealizados + totalNequiIngresado + totalDaviplataIngresado;
  const totalVentasGlobal = totalEfectivoIngresado + totalVentasElectronicas;

  const cajaDisponibleCalculada = (Number(baseCaja) || 0) + totalEfectivoIngresado - sumaGastosTotal;

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
  });

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
    return Array.from(mapaVentas.entries()).map(([nombre, cantidad]) => ({ nombre, cantidad }));
  })();

  async function guardarCierreDefinitivoBD() {
    if (!nominaPagadaEnTurno) {
      alert('⚠️ ATENCIÓN: No puedes realizar el Cierre del Día sin haber procesado primero el PAGO DE NÓMINA.');
      return;
    }

    const mesasOcupadas = mesas.filter((m) => m.estado !== 'libre');
    const hayRappiPendientes = pedidosRappi.length > 0;

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

    const efecContado = Number(efectivoContadoCierre);
    const difCaja = efecContado - cajaDisponibleCalculada;

    setGuardandoCierre(true);
    const usuarioId = sesion?.usuario_id || sesion?.id;
    const turnoId = sesion?.turno_id ? Number(sesion.turno_id) : null;

    try {
      const payloadCaja = {
        sede_id: SEDE_ID_MARTINETO,
        usuario_id: usuarioId ? Number(usuarioId) : null,
        turno_id: turnoId,
        monto_apertura: Number(baseCaja) || 0,
        efectivo_cierre: efecContado,
        nequi: totalNequiIngresado,
        daviplata: totalDaviplataIngresado,
        monto_gasto: sumaGastosTotal,
        descuento: totalDescuentosDia,
        motivo_descuento: listaMotivosUnicosDescuento,
        diferencia: difCaja,
      };

      const { error: errCaja } = await supabase.from('caja').insert([payloadCaja]);
      if (errCaja) throw new Error(`Error guardando en caja: ${errCaja.message}`);

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
    return listaResumen;
  };

  const resumenPedidoActual = obtenerResumenPedidoActual();

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#004e8c] flex items-center justify-center text-xs font-bold font-sans text-white">
        Cargando Martineto POS...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#004e8c] text-[#f1f5f9] p-4 font-sans max-w-[1600px] mx-auto space-y-4">
      {/* HEADER LIMPIO */}
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

      {/* BARRA DE NAVEGACIÓN INDEPENDIENTE CON BLOQUEO */}
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

      {/* MÓDULO 1: APERTURA Y MOVIMIENTOS E INVENTARIO */}
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
                disabled={baseGuardada}
                className="w-full bg-[#0e385e] border border-[#0066b3] text-emerald-300 font-black text-sm rounded-xl p-2.5 outline-none"
              />
              <button
                onClick={handleGuardarBase}
                disabled={baseGuardada}
                className={`font-bold px-6 rounded-xl text-xs ${baseGuardada ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'}`}
              >
                {baseGuardada ? '✓ Base Guardada' : 'Guardar Base'}
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
              }}
              disabled={!aperturaRealizada && baseGuardada}
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
                placeholder={String(obtenerStockActualBD('Total Paletas'))}
                value={totalPaletasInventario}
                onChange={(e) => setTotalPaletasInventario(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                onKeyDown={handleKeyDownTotalPaletas}
                className="w-28 bg-[#0e385e] text-sky-200 placeholder-sky-300/40 font-black text-center text-sm rounded-lg p-2 outline-none border border-[#0066b3]"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            <span className="text-xs text-sky-300 font-bold block uppercase">CONTEO DE EMPAQUES (ORDEN ALFABÉTICO):</span>
            {listaEmpaquesFiltrados.map((item, idx) => {
              const stockItem = obtenerStockActualBD(item);

              return (
                <div key={item} className="flex justify-between items-center bg-[#051829] p-2.5 rounded-lg border border-[#0066b3]">
                  <span className="text-xs text-white font-bold flex items-center gap-1.5">📦 {item}:</span>
                  <input
                    ref={(el) => { inputRefs.current[item] = el; }}
                    type="text"
                    inputMode="numeric"
                    placeholder={String(stockItem)}
                    value={cantidadesInventario[item] ?? ''}
                    onChange={(e) =>
                      setCantidadesInventario({
                        ...cantidadesInventario,
                        [item]: e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')),
                      })
                    }
                    onKeyDown={(e) => handleKeyDownEmpaques(e, idx)}
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
            className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none resize-none h-16"
          />

          <button
            onClick={handleGuardarInventario}
            disabled={!baseGuardada}
            className="w-full bg-[#0078d4] hover:bg-[#0086e6] text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50 shadow-md"
          >
            💾 Guardar Movimiento ({tipoMovimiento})
          </button>
        </div>
      )}

      {/* MÓDULO 2: PEDIDOS A BODEGA */}
      {moduloActivo === 'pedidos' && (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-start ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="lg:col-span-7 bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">2. 🚚 Seleccionar Pedido a Bodega</h2>
              <button
                onClick={() => setMostrarModalNuevoProd(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer shadow"
              >
                ➕ Crear Nuevo Producto
              </button>
            </div>

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
                  className={`py-2 rounded-xl text-xs font-black uppercase cursor-pointer transition-all ${tabPedido === tab.id ? 'bg-[#00a4ef] text-white shadow-md' : 'bg-[#051829] text-sky-300 border border-[#0066b3]'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
              {insumosFiltrados.length === 0 ? (
                <p className="text-xs text-sky-400 italic text-center py-8">No hay productos disponibles en esta categoría.</p>
              ) : (
                insumosFiltrados.map((prod, idx) => (
                  <div key={prod.id || prod.nombre} className="flex justify-between items-center bg-[#051829] p-3 rounded-xl border border-[#0066b3]">
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
                        title="Quitar ítem"
                        className="text-sky-300 hover:text-rose-400 font-black text-sm px-1 rounded transition-colors cursor-pointer"
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
              className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none resize-none h-16"
            />

            <button
              onClick={enviarPedidoBodega}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-md"
            >
              🚀 Enviar Pedido a Bodega ({resumenPedidoActual.length} productos)
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
                                title="Quitar este producto del pedido"
                                className="text-sky-300 hover:text-rose-400 font-black text-sm px-1 rounded transition-colors cursor-pointer"
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
                            className="w-4 h-4 accent-amber-500 cursor-pointer"
                          />
                          <span className="text-white font-bold">
                            Hora: {new Date(ped.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} (Pedido #{ped.id})
                          </span>
                        </div>

                        <button
                          onClick={() => borrarPedidosBD([ped.id])}
                          className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer"
                        >
                          🗑️ Borrar
                        </button>
                      </div>
                    ))}

                    {pedidosSeleccionados.length > 0 && (
                      <button
                        onClick={() => borrarPedidosBD(pedidosSeleccionados)}
                        className="w-full bg-rose-700 hover:bg-rose-600 text-white font-black py-2 rounded-xl text-xs uppercase cursor-pointer mt-2 border border-rose-500"
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

      {/* MÓDULO 3: GASTOS DIRECTOS */}
      {moduloActivo === 'gastos' && (
        <div className={`bg-[#0b2b48] border border-amber-500/60 p-5 rounded-2xl space-y-4 shadow-md max-w-2xl mx-auto ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center border-b border-amber-500/40 pb-2">
            <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
              3. 💸 Registro de Gastos Directos (Descuenta de Caja)
            </h2>
            <span className="text-xs font-black text-amber-400">
              Total Gastos: $ {sumaGastosTotal.toLocaleString('es-CO')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Concepto (ej. 1 kg fresa, plátanos, bolsas...)"
              value={conceptoGasto}
              onChange={(e) => setConceptoGasto(e.target.value)}
              className="sm:col-span-7 bg-[#051829] border border-[#0066b3] text-white text-xs rounded-xl p-3 outline-none font-bold"
            />
            <input
              type="text"
              placeholder="Monto $"
              value={formatearMoneda(montoGasto)}
              onChange={(e) => setMontoGasto(desformatearMoneda(e.target.value))}
              className="sm:col-span-3 bg-[#051829] border border-[#0066b3] text-amber-300 text-xs rounded-xl p-3 outline-none font-black text-center"
            />
            <button
              onClick={registrarNuevoGasto}
              className="sm:col-span-2 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs uppercase cursor-pointer py-3"
            >
              + Gasto
            </button>
          </div>

          <div className="space-y-2 border-t border-[#0066b3]/30 pt-3">
            <span className="text-xs text-sky-300 font-bold block uppercase">Historial de Salidas de Caja Hoy:</span>
            {listaGastos.length === 0 ? (
              <p className="text-xs text-sky-400 italic py-4 text-center">No hay gastos ni salidas registradas hoy.</p>
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

      {/* MÓDULO 4: VENTAS */}
      {moduloActivo === 'ventas' && (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-start ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className={`${!mesaActivaId ? 'lg:col-span-12' : itemActivoActual && itemActivoActual.items.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'} bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md transition-all duration-300`}>
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-xs md:text-sm font-black text-white">🪑 Mesas y Rappi</h2>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMostrarModalConsultaCaja(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] px-2.5 py-1 rounded-lg uppercase cursor-pointer shadow border border-emerald-400"
                  title="Consultar efectivo en caja, nequi, daviplata y ventas"
                >
                  💵 Ver Caja
                </button>
                <button
                  onClick={agregarNuevoRappi}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase cursor-pointer shadow"
                >
                  + Rappi
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
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

          {mesaActivaId && (
            <div className={`${itemActivoActual && itemActivoActual.items.length > 0 ? 'lg:col-span-5' : 'lg:col-span-8'} bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md transition-all duration-300`}>
              <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
                <h2 className="text-xs md:text-sm font-black text-white">📂 Categorías y Productos</h2>
                <span className="text-xs text-sky-200 font-bold">Activo: <b className="text-emerald-300">{itemActivoActual ? itemActivoActual.nombre : 'Ninguno'}</b></span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Buscar producto por nombre..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  className="w-full bg-[#051829] border-2 border-[#00a4ef] text-white text-xs font-bold rounded-xl p-2.5 pr-8 outline-none shadow-inner"
                />
                {busquedaProducto && (
                  <button
                    onClick={() => setBusquedaProducto('')}
                    className="absolute right-3 top-2.5 text-sky-300 hover:text-white font-black text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
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

              <div className="max-h-[380px] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
                {productosFiltradosVenta.length === 0 ? (
                  <p className="text-xs text-sky-400 italic col-span-full py-6 text-center">No hay productos que coincidan con la búsqueda.</p>
                ) : (
                  productosFiltradosVenta.map((prod) => {
                    const esCorralito = (prod.nombre || '').toLowerCase().includes('corralito') || (prod.nombre || '').toLowerCase().includes('waffle');

                    return (
                      <div key={prod.id || prod.nombre} className="bg-[#0e385e] border border-[#0066b3] p-2.5 rounded-xl flex flex-col justify-between shadow-sm">
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <p className="font-bold text-white text-xs truncate">{prod.nombre}</p>
                          </div>
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
                              title="Usa tapa extra: descuenta 1 como Venta y 1 como Merma"
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

          {itemActivoActual && itemActivoActual.items.length > 0 && (
            <div className="lg:col-span-4 bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md transition-all duration-300">
              <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
                <h2 className="text-xs md:text-sm font-black text-white">🧾 Factura / Pedido</h2>
                <span className="bg-[#051829] text-sky-300 text-[10px] px-2.5 py-1 rounded-lg border border-[#0066b3] uppercase font-bold">
                  {esRappiActivo ? rappiActivo?.estado : mesaActiva ? mesaActiva.estado : 'Sin Selección'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                  {itemsVisualesAgrupados.map((i: any, idx: number) => {
                    const estado = i.estadoItem || 'pedido';

                    let badgeBg = 'bg-emerald-800 text-emerald-200 border-emerald-500';
                    if (estado === 'entregado') badgeBg = 'bg-amber-700 text-amber-200 border-amber-400';

                    return (
                      <div key={`${i.nombre}_${estado}_${idx}`} className="bg-[#051829] border border-[#0066b3] p-2.5 rounded-xl space-y-2 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-white">
                            {i.cantidad > 1 ? `${i.cantidad}x ` : ''}{i.nombre}
                          </span>
                          <span className="text-xs font-black text-emerald-300">
                            $ {(Number(i.precio || 0) * i.cantidad).toLocaleString('es-CO')}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-[#0066b3]/40">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-black border ${badgeBg}`}>
                            {estado === 'pedido' ? '🟢 Por Entregar' : '🟡 Entregado'}
                          </span>

                          <div className="flex gap-1 items-center">
                            {!esRappiActivo && estado === 'pedido' && (
                              <>
                                <button
                                  onClick={() => marcarItemEntregado(i.nombre, estado)}
                                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[9px] py-1 rounded cursor-pointer"
                                >
                                  🚀 Marcar Entregado
                                </button>
                                <button
                                  onClick={() => restarProductoDeMesa(i.nombre, estado)}
                                  className="bg-rose-800 hover:bg-rose-700 text-white font-black text-[12px] px-2 py-0.5 rounded cursor-pointer"
                                  title="Restar 1 unidad"
                                >
                                  −
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!esRappiActivo && mesaActiva && (
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
                        .filter((m) => m.id !== mesaActivaId && String(m.estado || '').toLowerCase() === 'libre')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            🪑 Mover a {m.nombre}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="bg-[#051829] p-3 rounded-xl border border-[#0066b3] space-y-1">
                  <div className="flex justify-between items-center text-xs text-white">
                    <span>Total Cuenta:</span>
                    <span className="font-bold">$ {itemActivoActual.total.toLocaleString('es-CO')}</span>
                  </div>
                  {!esRappiActivo && mesaActiva && (mesaActiva.totalAbonado || 0) > 0 && (
                    <div className="flex justify-between items-center text-xs text-amber-300">
                      <span>Abonado / Pagado:</span>
                      <span className="font-bold">- $ {mesaActiva.totalAbonado.toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm font-black text-white pt-1 border-t border-[#0066b3]">
                    <span>Saldo Pendiente:</span>
                    <span className="text-emerald-400 text-base">
                      $ {saldoPendienteActual.toLocaleString('es-CO')}
                    </span>
                  </div>
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
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      {hayProductosPorEntregar && (
                        <button
                          onClick={marcarTodosEntregados}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-xl text-[11px] uppercase cursor-pointer shadow-md"
                        >
                          🚀 Todo Entregado
                        </button>
                      )}
                      <button
                        onClick={abrirModalCobro}
                        className={`${hayProductosPorEntregar ? 'col-span-1' : 'col-span-2'} bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-[11px] uppercase cursor-pointer shadow-md`}
                      >
                        💳 Pagar / Abonar
                      </button>
                    </div>

                    {mesaTotalmentePagada && (
                      <button
                        onClick={liberarMesa}
                        className="w-full bg-purple-700 hover:bg-purple-600 text-white font-black py-2.5 rounded-xl text-[11px] uppercase cursor-pointer shadow-md"
                      >
                        🧹 Liberar Mesa
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MÓDULO 5: CIERRE Y PAGO DE NÓMINA */}
      {moduloActivo === 'cierre' && (
        <div className={`bg-[#0b2b48] border border-[#0066b3] p-5 rounded-2xl space-y-4 shadow-md max-w-2xl mx-auto ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-sm font-black text-white border-b border-[#0066b3]/50 pb-2 flex justify-between items-center">
            <span>5. 🌙 Pago de Nómina y Cierre Final del Día</span>
            <span className="text-xs text-sky-300 font-bold">
              Operario: {sesion?.nombre || 'Iris'}{' '}
              {nominaPagadaEnTurno && <b className="text-emerald-400 ml-1">(✓ PAGADO)</b>}
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div>
              <label className="text-[10px] text-sky-300 font-bold block mb-1">Tipo de Día:</label>
              <select
                value={tipoDia}
                onChange={(e) => setTipoDia(e.target.value)}
                className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none cursor-pointer font-bold"
              >
                <option value="entre_semana">De Lunes a Sábado</option>
                <option value="festivo">Domingo / Festivo</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-sky-300 font-bold block mb-1">Horas Trab. Día:</label>
              <input
                type="text"
                placeholder="0"
                value={horasDia}
                onChange={(e) => setHorasDia(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2 rounded-xl text-center font-bold outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-sky-300 font-bold block mb-1">Horas Trab. Noche:</label>
              <input
                type="text"
                placeholder="0"
                value={horasNoche}
                onChange={(e) => setHorasNoche(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2 rounded-xl text-center font-bold outline-none"
              />
            </div>
          </div>

          <div className="bg-[#051829] p-3 rounded-xl border border-[#00a4ef] flex justify-between items-center text-xs">
            <div className="text-sky-200">
              <span className="block font-bold">Valores leídos desde BD:</span>
              <span className="text-[10px] opacity-80">
                Subsidio: ${tarifasNominaBD.subsidio.toLocaleString('es-CO')} | Aux. Transporte: ${tarifasNominaBD.transporte.toLocaleString('es-CO')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-sky-300 font-bold block uppercase">Total Pago Nómina:</span>
              <span className="text-base font-black text-rose-400">$ {calcularTotalNomina().toLocaleString('es-CO')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={pagarYDescontarNominaDeCaja}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
            >
              💸 Pagar Nómina (Descontar de Caja)
            </button>

            <button
              onClick={() => setMostrarModalResumen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2"
            >
              🌙 Realizar Cierre del Día
            </button>
          </div>
        </div>
      )}

      {/* MODAL CONSULTA FLOTANTE DE CAJA Y VENTAS */}
      {mostrarModalConsultaCaja && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-[#0b2b48] border-2 border-emerald-400 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-white">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2">
              <h3 className="text-sm font-black flex items-center gap-2 uppercase text-emerald-300">
                💵 Estado de Caja y Ventas en Vivo
              </h3>
              <button
                onClick={() => setMostrarModalConsultaCaja(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-bold">
              <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-2">
                <div className="flex justify-between text-sky-200">
                  <span>💵 Base Apertura Inicial:</span>
                  <span className="text-emerald-300 font-black">$ {(Number(baseCaja) || 0).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-emerald-300 font-black">
                  <span>💵 Ventas Ingresadas en Efectivo:</span>
                  <span>+ $ {totalEfectivoIngresado.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-black">
                  <span>💸 Gastos y Nómina Descontados:</span>
                  <span>- $ {sumaGastosTotal.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#0066b3] text-sm font-black text-emerald-400 bg-[#0e385e] p-2 rounded-lg">
                  <span>💵 EFECTIVO DISPONIBLE EN CAJA:</span>
                  <span>$ {cajaDisponibleCalculada.toLocaleString('es-CO')}</span>
                </div>
              </div>

              <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl space-y-2">
                <span className="text-sky-300 block uppercase font-black border-b border-[#0066b3]/40 pb-1">
                  💳 Ventas Electrónicas y Otros Medios:
                </span>
                <div className="flex justify-between text-purple-300">
                  <span>💜 Nequi:</span>
                  <span>$ {totalNequiIngresado.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-rose-300">
                  <span>🔴 Daviplata:</span>
                  <span>$ {totalDaviplataIngresado.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-amber-300">
                  <span>🛵 Rappi:</span>
                  <span>$ {totalRappiRealizados.toLocaleString('es-CO')}</span>
                </div>
                {totalDescuentosDia > 0 && (
                  <div className="flex justify-between text-amber-400 font-black pt-1 border-t border-[#0066b3]/30">
                    <span>🏷️ Descuentos Totales Concedidos:</span>
                    <span>$ {totalDescuentosDia.toLocaleString('es-CO')}</span>
                  </div>
                )}
              </div>

              <div className="bg-emerald-950/80 border border-emerald-500 p-3 rounded-xl flex justify-between items-center text-sm font-black text-emerald-300">
                <span>🛍️ TOTAL VENTAS DEL DÍA:</span>
                <span className="text-base">$ {totalVentasGlobal.toLocaleString('es-CO')}</span>
              </div>
            </div>

            <button
              onClick={() => setMostrarModalConsultaCaja(false)}
              className="w-full bg-[#0078d4] hover:bg-[#0086e6] text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-md"
            >
              Cerrar Consulta
            </button>
          </div>
        </div>
      )}

      {/* MODAL AUDITORÍA / CIERRE FINAL COMPLETO */}
      {mostrarModalResumen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-[#0b2b48] border-2 border-emerald-400 rounded-2xl p-6 max-w-3xl w-full space-y-4 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-3">
              <h3 className="text-sm font-black flex items-center gap-2 uppercase text-emerald-300">
                📊 AUDITORÍA Y BALANCE DE DÍA (RESUMEN FINANCIERO Y CONTEO)
              </h3>
              <button
                onClick={() => setMostrarModalResumen(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!nominaPagadaEnTurno && (
              <div className="bg-rose-950/90 border border-rose-500 p-3 rounded-xl text-xs text-rose-200 font-bold flex items-center gap-2">
                <span>⚠️ REQUISITO OBLIGATORIO:</span> Debes pagar la nómina del operario en turno antes de confirmar el cierre final.
              </div>
            )}

            <div className="space-y-3 text-xs font-bold">
              <span className="text-sky-300 block uppercase font-black border-b border-[#0066b3]/40 pb-1">
                1. RESUMEN DE VENTAS Y CAJA:
              </span>

              <div className="bg-[#051829] border border-[#0066b3] p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between text-sky-200">
                  <span>💵 Base Apertura:</span>
                  <span className="text-emerald-300 font-black">$ {(Number(baseCaja) || 0).toLocaleString('es-CO')}</span>
                </div>

                <div className="flex justify-between text-amber-300 font-black pt-1 border-t border-[#0066b3]/30">
                  <span>🛍️ TOTAL VENTAS:</span>
                  <span>$ {totalVentasGlobal.toLocaleString('es-CO')}</span>
                </div>

                <div className="bg-[#0e385e]/60 p-2.5 rounded-lg border border-[#0066b3]/60 space-y-1.5 ml-2">
                  <div className="flex justify-between text-sky-300 font-bold">
                    <span>💳 Ventas Electrónicas (Total):</span>
                    <span>$ {totalVentasElectronicas.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-[11px] text-sky-200 pl-3">
                    <span>• RAPPI: $ {totalRappiRealizados.toLocaleString('es-CO')}</span>
                    <span>• NEQUI: $ {totalNequiIngresado.toLocaleString('es-CO')}</span>
                    <span>• DAVIPLATA: $ {totalDaviplataIngresado.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                <div className="flex justify-between text-emerald-300 font-black pt-1">
                  <span>💵 Ventas en Efectivo:</span>
                  <span>$ {totalEfectivoIngresado.toLocaleString('es-CO')}</span>
                </div>

                <div className="flex justify-between text-amber-400">
                  <span>💸 Gastos Directos y Nómina (Efectivo):</span>
                  <span>- $ {sumaGastosTotal.toLocaleString('es-CO')}</span>
                </div>

                {totalDescuentosDia > 0 && (
                  <div className="bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-lg space-y-1 text-amber-300">
                    <div className="flex justify-between font-black">
                      <span>🏷️ Descuentos Totales del Día:</span>
                      <span>$ {totalDescuentosDia.toLocaleString('es-CO')}</span>
                    </div>
                    {listaMotivosUnicosDescuento.length > 0 && (
                      <p className="text-[10px] text-amber-200/90 font-normal">
                        <b>Motivos:</b> {listaMotivosUnicosDescuento.join(', ')}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t-2 border-[#0066b3] text-sm font-black text-emerald-400">
                  <span>💵 PRODUCIDO / EN CAJA (Calculado):</span>
                  <span>$ {cajaDisponibleCalculada.toLocaleString('es-CO')}</span>
                </div>
              </div>

              <div className="bg-[#051829] border border-emerald-400 p-3 rounded-xl space-y-1">
                <label className="text-xs text-emerald-300 font-black block uppercase">
                  💵 EFECTIVO REAL CONTADO EN CAJA *:
                </label>
                <input
                  type="text"
                  placeholder="Digita el dinero real en mano $"
                  value={formatearMoneda(efectivoContadoCierre)}
                  onChange={(e) => setEfectivoContadoCierre(desformatearMoneda(e.target.value))}
                  className="w-full bg-[#0e385e] border border-emerald-400 text-emerald-300 font-black text-base p-2.5 rounded-xl outline-none"
                />
                {efectivoContadoCierre !== '' && (
                  <p className={`text-xs font-bold mt-1 ${Number(efectivoContadoCierre) - cajaDisponibleCalculada >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {Number(efectivoContadoCierre) - cajaDisponibleCalculada >= 0
                      ? `✓ Cuadre OK (Diferencia: $ ${(Number(efectivoContadoCierre) - cajaDisponibleCalculada).toLocaleString('es-CO')})`
                      : `⚠️ Descuadre en Caja (Diferencia: $ ${(Number(efectivoContadoCierre) - cajaDisponibleCalculada).toLocaleString('es-CO')})`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 text-xs font-bold pt-2 border-t border-[#0066b3]">
              <span className="text-sky-300 block uppercase font-black">
                2. CONTEO FÍSICO REAL DE INVENTARIO (APERTURA + ENTRADAS - MERMAS - VENTAS):
              </span>

              <div className="bg-[#051829] border border-[#0066b3] rounded-xl overflow-hidden shadow-inner">
                <div className="grid grid-cols-12 gap-1 text-[10px] text-sky-300 uppercase font-black bg-[#051829] p-3 border-b border-[#0066b3] sticky top-0 z-10 shadow-sm">
                  <span className="col-span-3">Producto / Empaque</span>
                  <span className="col-span-1 text-center">Apert.</span>
                  <span className="col-span-2 text-center text-emerald-300">+Entrad.</span>
                  <span className="col-span-1 text-center text-rose-300">-Merm.</span>
                  <span className="col-span-1 text-center text-amber-300">-Vend.</span>
                  <span className="col-span-2 text-center text-sky-300">Calculado</span>
                  <span className="col-span-2 text-center">Conteo Real</span>
                </div>

                <div className="max-h-60 overflow-y-auto p-2 space-y-1.5">
                  {listaAuditoriaInventario.map((item, idx) => (
                    <div
                      key={item.nombre}
                      className="grid grid-cols-12 gap-1 items-center p-2 rounded-lg border border-[#0066b3] bg-[#0e385e] text-white text-[11px]"
                    >
                      <span className="col-span-3 font-bold truncate">{item.nombre}</span>
                      <span className="col-span-1 text-center text-sky-200">{item.apertura}</span>
                      <span className="col-span-2 text-center text-emerald-300 font-bold">+{item.entradas}</span>
                      <span className="col-span-1 text-center text-rose-300 font-bold">-{item.mermas}</span>
                      <span className="col-span-1 text-center text-amber-300 font-bold">-{item.vendidos}</span>
                      <span className="col-span-2 text-center font-black text-emerald-300">{item.calculado}</span>
                      <span className="col-span-2 text-center">
                        <input
                          ref={(el) => { inputRefs.current[`cierre_${item.nombre}`] = el; }}
                          type="text"
                          inputMode="numeric"
                          placeholder={String(item.calculado)}
                          value={conteoFisicoProductos[item.nombre] ?? ''}
                          onChange={(e) =>
                            setConteoFisicoProductos({
                              ...conteoFisicoProductos,
                              [item.nombre]: e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')),
                            })
                          }
                          onKeyDown={(e) => handleKeyDownEmpaques(e, idx, 'cierre')}
                          className="w-full bg-[#051829] text-sky-200 placeholder-sky-400/50 font-black text-center text-xs rounded p-1 outline-none border border-[#0066b3]"
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs font-bold pt-2 border-t border-[#0066b3]">
              <span className="text-sky-300 block uppercase font-black">
                3. RESUMEN DE PRODUCTOS VENDIDOS EN EL DÍA (QUÉ SE VENDIÓ):
              </span>

              <div className="bg-[#051829] border border-[#0066b3] p-3 rounded-xl max-h-40 overflow-y-auto space-y-1">
                {productosVendidosConsolidados.length === 0 ? (
                  <p className="text-sky-400 italic text-center py-2">No se han registrado ventas todavía hoy.</p>
                ) : (
                  productosVendidosConsolidados.map((prodVendido) => (
                    <div key={prodVendido.nombre} className="flex justify-between items-center bg-[#0e385e] p-2 rounded-lg border border-[#0066b3]">
                      <span className="text-white font-bold">{prodVendido.nombre}</span>
                      <span className="bg-[#0078d4] text-white px-2 py-0.5 rounded-full font-black text-[11px]">
                        {prodVendido.cantidad} un.
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMostrarModalResumen(false)}
                className="w-1/2 bg-[#051829] hover:bg-[#003d6d] text-sky-200 border border-[#0066b3] font-bold py-3 rounded-xl text-xs uppercase cursor-pointer"
              >
                Cerrar Auditoría
              </button>
              <button
                onClick={guardarCierreDefinitivoBD}
                disabled={guardandoCierre || !nominaPagadaEnTurno}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guardandoCierre ? 'Guardando en BD...' : '💾 Confirmar y Guardar Cierre en BD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVO PRODUCTO */}
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
                    <option value="Insumos">Insumos / Toppings</option>
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

      {/* MODAL COBRO CON DESCUENTO Y MOTIVO */}
      {mostrarModalCobro && mesaActiva && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b2b48] border-2 border-[#00a4ef] rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2">
              <h3 className="text-sm font-black text-white uppercase">💳 COBRAR / ABONAR {mesaActiva.nombre}</h3>
              <button onClick={() => setMostrarModalCobro(false)} className="text-sky-300 hover:text-white font-black text-sm">✕</button>
            </div>

            <div className="bg-[#051829] p-3 rounded-xl border border-[#0066b3] text-center space-y-1">
              <span className="text-xs text-sky-200 font-bold block">SALDO PENDIENTE A COBRAR:</span>
              <span className="text-2xl font-black text-emerald-400">
                $ {Math.max(0, mesaActiva.total - (mesaActiva.totalAbonado || 0)).toLocaleString('es-CO')}
              </span>
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

              <div className="pt-1 border-t border-[#0066b3]/50">
                <label className="text-[10px] text-amber-300 font-bold block mb-1">🏷️ Descuento ($):</label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatearMoneda(descuentoVenta)}
                  onChange={(e) => setDescuentoVenta(desformatearMoneda(e.target.value))}
                  className="w-full bg-[#051829] border border-amber-500 text-amber-300 font-black text-sm p-2 rounded-xl outline-none"
                />
              </div>

              {Number(descuentoVenta) > 0 && (
                <div>
                  <label className="text-[10px] text-amber-300 font-bold block mb-1">✏️ Motivo del Descuento *:</label>
                  <input
                    type="text"
                    placeholder="Ej. Promoción 2x1, Cortesía, Empleado..."
                    value={motivoDescuentoVenta}
                    onChange={(e) => setMotivoDescuentoVenta(e.target.value)}
                    className="w-full bg-[#051829] border border-amber-400 text-white font-bold text-xs p-2 rounded-xl outline-none"
                  />
                </div>
              )}
            </div>

            {(() => {
              const efec = Number(pagoEfectivo) || 0;
              const neq = Number(pagoNequi) || 0;
              const dav = Number(pagoDaviplata) || 0;
              const desc = Number(descuentoVenta) || 0;

              const abonadoAhora = efec + neq + dav;
              const pendienteSinDesc = Math.max(0, mesaActiva.total - (mesaActiva.totalAbonado || 0));
              const pendienteFinal = Math.max(0, pendienteSinDesc - desc);

              const diferencia = abonadoAhora - pendienteFinal;

              return (
                <div className="bg-[#051829] p-3 rounded-xl border border-[#0066b3] space-y-1">
                  <div className="flex justify-between text-xs font-bold text-sky-200">
                    <span>Monto con Descuento:</span>
                    <span>$ {pendienteFinal.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-white">
                    <span>Abono Ingresado:</span>
                    <span>$ {abonadoAhora.toLocaleString('es-CO')}</span>
                  </div>
                  {diferencia >= 0 ? (
                    <div className="flex justify-between text-xs font-black text-emerald-400">
                      <span>Cambio / Devueltas:</span>
                      <span>$ {diferencia.toLocaleString('es-CO')}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-xs font-black text-amber-400">
                      <span>Quedará un Saldo Pendiente de:</span>
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
    </main>
  );
}