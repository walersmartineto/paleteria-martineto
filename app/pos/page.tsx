'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  registrarBaseCajaMartineto,
  registrarMovimientoMartineto,
} from '@/lib/martinetoQueries';
import { supabase } from '@/lib/supabase';

const LISTA_EMPAQUES_MARTINETO = [
  'Total Paletas',
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

  // MODAL DE COBRO / PAGO MIXTO Y ABONOS
  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState<number | ''>('');
  const [pagoNequi, setPagoNequi] = useState<number | ''>('');
  const [pagoDaviplata, setPagoDaviplata] = useState<number | ''>('');
  const [procesandoPago, setProcesandoPago] = useState(false);

  // REQUISICIONES / PEDIDOS A BODEGA
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

  // GASTOS DIRECTOS
  const [listaGastos, setListaGastos] = useState<{ id: string; concepto: string; monto: number; hora: string }[]>([]);
  const [conceptoGasto, setConceptoGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState<number | ''>('');

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
          totalAbonado: 0,
          estado: 'Libre',
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
      } else {
        setErrorLecturaBD('La tabla produc_ven_martineto no devolvió registros.');
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
    const conceptoNomen = `Pago Nómina a ${operarioNombre} (${horasDia || 0}h Día / ${horasNoche || 0}h Noche)`;
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

  // FILTRO POR CATEGORÍA Y BUSCADOR
  const productosFiltradosVenta = productosVenta.filter((p) => {
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number, keysList: string[], prefix: string = '') {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextKey = keysList[currentIndex + 1];
      const targetRefKey = prefix ? `${prefix}_${nextKey}` : nextKey;
      if (nextKey && inputRefs.current?.[targetRefKey]) {
        inputRefs.current[targetRefKey]?.focus();
        inputRefs.current[targetRefKey]?.select();
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

    if (totalPaletasInventario !== '') {
      detalleEmpaquesLimpio['Total Paletas'] = Number(totalPaletasInventario);
    }

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
      setMovimientosDiaBD((prev) => [
        ...prev,
        {
          tipo: tipoMovimiento,
          totalPaletas: Number(totalPaletasInventario) || 0,
          detalle: detalleEmpaquesLimpio,
        },
      ]);

      alert(`¡${tipoMovimiento.toUpperCase()} registrada y guardada con éxito en BD!`);

      setTotalPaletasInventario('');
      setCantidadesInventario({});
      setObservacionesInventario('');

      if (tipoMovimiento === 'apertura') {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
      }
    } else {
      alert('Error al registrar inventario.');
    }
  }

  async function registrarNuevoGasto() {
    const textoConcepto = conceptoGasto.trim();
    const valorGasto = Number(montoGasto);

    if (!textoConcepto) {
      alert('⚠️ Ingresa el concepto del gasto (ej: fresas, plátanos, bolsas...).');
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

    setConceptoGasto('');
    setMontoGasto('');
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
          return { ...m, items: [], total: 0, totalAbonado: 0, estado: 'Libre' };
        }
        if (m.id === destinoId) {
          return {
            ...m,
            items: mesaActiva.items,
            total: mesaActiva.total,
            totalAbonado: mesaActiva.totalAbonado || 0,
            estado: 'Ocupada',
          };
        }
        return m;
      })
    );

    setMesaActivaId(destinoId);
    alert(`🚚 Pedido trasladado con éxito de ${mesaActiva.nombre} a ${mesaDestino.nombre}.`);
  }

  const calcularDisponibilidadActual = (nombreEmpaque: string) => {
    let apertura = 0;
    
    const movimientoApertura = movimientosDiaBD.find((m) => m.tipo === 'apertura');
    if (movimientoApertura) {
      if (nombreEmpaque === 'Total Paletas') {
        apertura = Number(movimientoApertura.totalPaletas) || 0;
      } else {
        apertura = Number(movimientoApertura.detalle?.[nombreEmpaque]) || 0;
      }
    } else {
      if (nombreEmpaque === 'Total Paletas') {
        apertura = Number(totalPaletasInventario) || 0;
      } else {
        apertura = Number(cantidadesInventario[nombreEmpaque]) || 0;
      }
    }

    const entradas = movimientosDiaBD
      .filter((m) => m.tipo === 'nuevas' || m.tipo === 'compras')
      .reduce((acc, m) => {
        if (nombreEmpaque === 'Total Paletas') return acc + Number(m.totalPaletas || 0);
        return acc + Number(m.detalle?.[nombreEmpaque] || 0);
      }, 0);

    let mermas = movimientosDiaBD
      .filter((m) => m.tipo === 'debaja')
      .reduce((acc, m) => {
        if (nombreEmpaque === 'Total Paletas') return acc + Number(m.totalPaletas || 0);
        return acc + Number(m.detalle?.[nombreEmpaque] || 0);
      }, 0);

    if (nombreEmpaque === 'Corralito') {
      const tapasMermadasVentas = ventasDiaBD.reduce((accV, v) => {
        return (
          accV +
          (v.items || []).reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if ((n.includes('corralito') || n.includes('waffle')) && n.includes('llevar')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);

      mermas += tapasMermadasVentas;
    }

    let vendidasCerradas = 0;
    if (nombreEmpaque === 'Vaso 12 onzas') {
      vendidasCerradas = ventasDiaBD.reduce((accV, v) => {
        return (
          accV +
          (v.items || []).reduce((accI: number, i: any) => {
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
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);
    } else if (nombreEmpaque === 'Caja Mostac') {
      vendidasCerradas = ventasDiaBD.reduce((accV, v) => {
        return (
          accV +
          (v.items || []).reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('mostac') || n.includes('paleta enchilada')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);
    } else if (nombreEmpaque === 'Doritos') {
      vendidasCerradas = ventasDiaBD.reduce((accV, v) => {
        return (
          accV +
          (v.items || []).reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('doritos') || n.includes('dorinetos')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);
    } else if (nombreEmpaque === 'Corralito') {
      vendidasCerradas = ventasDiaBD.reduce((accV, v) => {
        return (
          accV +
          (v.items || []).reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('corralito') || n.includes('waffle')) {
              return accI + Number(i.cantidad || 1);
            }
            return accI;
          }, 0)
        );
      }, 0);
    } else if (nombreEmpaque === 'Total Paletas') {
      vendidasCerradas = ventasDiaBD.reduce((accV, v) => {
        return (
          accV +
          (v.items || []).reduce((accI: number, i: any) => {
            const n = (i.nombre || '').toLowerCase();
            if (n.includes('paleta')) return accI + Number(i.cantidad || 1);
            return accI;
          }, 0)
        );
      }, 0);
    } else {
      vendidasCerradas = ventasDiaBD.reduce((accV, v) => {
        const coincidencias = (v.items || []).filter((i: any) =>
          (i.nombre || '').toLowerCase().includes(nombreEmpaque.toLowerCase())
        );
        return accV + coincidencias.reduce((accI: number, item: any) => accI + Number(item.cantidad || 0), 0);
      }, 0);
    }

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

    const disponible = apertura + entradas - mermas - vendidasCerradas - ocupadasEnMesas;
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

    if (nombreNorm.includes('paleta enchilada') || nombreNorm.includes('mostac')) {
      const dispPaletas = calcularDisponibilidadActual('Total Paletas');
      const dispMostac = calcularDisponibilidadActual('Caja Mostac');

      if (dispPaletas <= 0) {
        alert('⚠️ No hay stock disponible de "Total Paletas" para la Paleta Enchilada.');
        return;
      }

      if (dispMostac <= 0) {
        alert('⚠️ No hay empaques de "Caja Mostac" disponibles en inventario para servir la Paleta Enchilada.');
        return;
      }
    } else if (nombreNorm.includes('paleta')) {
      const dispPaletas = calcularDisponibilidadActual('Total Paletas');
      if (dispPaletas <= 0) {
        alert('⚠️ No hay stock disponible de Paletas para registrar ventas (Disponibles: 0).');
        return;
      }
    }

    if (nombreNorm.includes('doritos') || nombreNorm.includes('dorinetos')) {
      const dispDoritos = calcularDisponibilidadActual('Doritos');
      if (dispDoritos <= 0) {
        alert('⚠️ No hay stock disponible de Doritos / Dorinetos en apertura (Disponibles: 0).');
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
          alert('⚠️ No hay empaques suficientes de Corralito para llevar (se requieren 2 empaques: 1 base + 1 tapa).');
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
        alert('⚠️ No hay Vasos de 12 onzas disponibles en inventario para preparar esta bebida (Disponibles: 0).');
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

          const estadoRevisado = 'Ocupada';

          return {
            ...m,
            items: nuevosItems,
            total: nuevoTotal,
            estado: estadoRevisado,
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
          nuevoEstadoMesa = algunPendiente ? 'Ocupada' : 'Pagada';
        } else if (algunPendiente) {
          nuevoEstadoMesa = 'Ocupada';
        } else {
          nuevoEstadoMesa = 'Entregado';
        }

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

            let nuevoEstado = itemsActuales.length === 0 ? 'Libre' : m.estado;
            if (itemsActuales.length > 0) {
              const algunPendiente = itemsActuales.some((i: any) => (i.estadoItem || 'pedido') === 'pedido');
              const estaTotalmentePagado = (m.totalAbonado || 0) >= nuevoTotal && nuevoTotal > 0;
              if (estaTotalmentePagado) nuevoEstado = algunPendiente ? 'Ocupada' : 'Pagada';
              else if (algunPendiente) nuevoEstado = 'Ocupada';
              else nuevoEstado = 'Entregado';
            }

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

    const { data, error } = await supabase.from('venta').insert([payloadVenta]).select();

    if (error) {
      alert('Error guardando pedido Rappi en la tabla "venta": ' + error.message);
      return;
    }

    if (data && data.length > 0) {
      setVentasDiaBD((prev) => [...prev, data[0]]);
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
          return {
            ...m,
            items: itemsActuales,
            estado: estaTotalmentePagado ? 'Pagada' : 'Entregado',
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
    setMostrarModalCobro(true);
  }

  async function procesarCobroMesa() {
    if (!mesaActiva) return;

    const efec = Number(pagoEfectivo) || 0;
    const neq = Number(pagoNequi) || 0;
    const dav = Number(pagoDaviplata) || 0;
    const sumaAbonoActual = efec + neq + dav;

    const pendienteActual = Math.max(0, mesaActiva.total - (mesaActiva.totalAbonado || 0));

    if (sumaAbonoActual <= 0) {
      alert('⚠️ Ingresa un monto válido para el abono o pago.');
      return;
    }

    setProcesandoPago(true);
    const usuarioId = sesion?.usuario_id || sesion?.id;

    const payloadVenta = {
      sede_id: SEDE_ID_MARTINETO,
      usuario_id: usuarioId ? String(usuarioId) : null,
      monto_total: sumaAbonoActual,
      pago_efectivo: efec,
      pago_nequi: neq,
      pago_daviplata: dav,
      cambio: Math.max(0, sumaAbonoActual - pendienteActual),
      estado: sumaAbonoActual >= pendienteActual ? 'pagado' : 'abono',
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
    }

    const nuevoTotalAbonado = (mesaActiva.totalAbonado || 0) + sumaAbonoActual;
    const estaCompletamentePagado = nuevoTotalAbonado >= mesaActiva.total;

    setMesas((prev) =>
      prev.map((m) => {
        if (m.id === mesaActivaId) {
          const algunPendienteEntrega = m.items.some((i: any) => (i.estadoItem || 'pedido') === 'pedido');

          let nuevoEstadoMesa = m.estado;
          if (estaCompletamentePagado) {
            nuevoEstadoMesa = algunPendienteEntrega ? 'Ocupada' : 'Pagada';
          } else {
            nuevoEstadoMesa = 'Ocupada';
          }

          return {
            ...m,
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
      alert('✅ ¡Cuenta pagada con éxito! (Recuerda despachar los productos pendientes si los hay).');
    } else {
      alert(
        `✅ ¡Abono registrado con éxito! Saldo pendiente: $ ${(
          mesaActiva.total - nuevoTotalAbonado
        ).toLocaleString('es-CO')}`
      );
    }
  }

  function liberarMesa() {
    if (!mesaActivaId) return;

    if (hayProductosPorEntregar) {
      alert('⚠️ No puedes liberar la mesa porque aún hay productos pendientes POR ENTREGAR. Marca los productos como entregados o usa el botón "🚀 Todo Entregado".');
      return;
    }

    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaActivaId
          ? { ...m, items: [], total: 0, totalAbonado: 0, estado: 'Libre' }
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

  // CÁLCULOS AUDITORÍA Y MÉTODOS DE PAGO
  const sumaGastosTotal = listaGastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);
  
  const totalEfectivoIngresado = ventasDiaBD.reduce((acc, v) => acc + Number(v.pago_efectivo || 0), 0);
  const totalNequiIngresado = ventasDiaBD.reduce((acc, v) => acc + Number(v.pago_nequi || 0), 0);
  const totalDaviplataIngresado = ventasDiaBD.reduce((acc, v) => acc + Number(v.pago_daviplata || 0), 0);
  
  const totalRappiRealizados = ventasDiaBD
    .filter((v) => v.estado === 'rappi')
    .reduce((acc, v) => acc + Number(v.monto_total || 0), 0);

  const totalVentasElectronicas = totalRappiRealizados + totalNequiIngresado + totalDaviplataIngresado;
  const totalVentasGlobal = totalEfectivoIngresado + totalVentasElectronicas;

  const cajaDisponibleCalculada = (Number(baseCaja) || 0) + totalEfectivoIngresado - sumaGastosTotal;

  // AUDITORÍA DE INVENTARIO CON CAJA MOSTAC
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
      if (nombreProd === 'Total Paletas') {
        cantApertura = Number(totalPaletasInventario) || 0;
      } else {
        cantApertura = Number(cantidadesInventario[nombreProd]) || 0;
      }
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
      alert('⚠️ ATENCIÓN: No puedes realizar el Cierre del Día sin haber procesado primero el PAGO DE NÓMINA en la sección inferior.');
      return;
    }

    const mesasOcupadas = mesas.filter((m) => m.estado !== 'Libre');
    const hayRappiPendientes = pedidosRappi.length > 0;

    if (mesasOcupadas.length > 0 || hayRappiPendientes) {
      let mensajeError = '⚠️ NO PUEDES REALIZAR EL CIERRE TOTAL DEL DÍA:\n\n';
      if (mesasOcupadas.length > 0) {
        mensajeError += `• Hay ${mesasOcupadas.length} mesa(s) sin liberar: ${mesasOcupadas.map((m) => m.nombre).join(', ')}.\n`;
      }
      if (hayRappiPendientes) {
        mensajeError += `• Hay ${pedidosRappi.length} pedido(s) Rappi activos sin entregar.\n`;
      }
      mensajeError += '\nTodas las mesas deben ser cobradas/liberadas antes de enviar la información del día a la base de datos.';
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

    try {
      const payloadCaja = {
        sede_id: SEDE_ID_MARTINETO,
        usuario_id: usuarioId ? Number(usuarioId) : null,
        monto_apertura: Number(baseCaja) || 0,
        efectivo_cierre: efecContado,
        nequi: totalNequiIngresado,
        daviplata: totalDaviplataIngresado,
        monto_gasto: sumaGastosTotal,
        diferencia: difCaja,
      };

      const { error: errCaja } = await supabase.from('caja').insert([payloadCaja]);
      if (errCaja) throw new Error(`Error guardando en caja: ${errCaja.message}`);

      const listaDetalleInventario = listaAuditoriaInventario.map((item) => {
        const cantContadaReal = Number(conteoFisicoProductos[item.nombre]) || 0;
        return {
          nombre_producto: item.nombre,
          apertura: item.apertura,
          entradas: item.entradas,
          mermas: item.mermas,
          vendidas: item.vendidos,
          calculadas: item.calculado,
          contadas_cierre: cantContadaReal,
          diferencia: cantContadaReal - item.calculado,
        };
      });

      const payloadInventarioDia = {
        sede_id: SEDE_ID_MARTINETO,
        usuario_id: usuarioId ? String(usuarioId) : null,
        fecha: new Date().toISOString().split('T')[0],
        movimientos: listaDetalleInventario,
      };

      const { error: errInv } = await supabase.from('inventario_dia').insert([payloadInventarioDia]);
      if (errInv) throw new Error(`Error guardando en inventario_dia: ${errInv.message}`);

      alert('✅ ¡CIERRE TOTAL DEL DÍA GUARDADO CON ÉXITO EN LA BASE DE DATOS!');
      setMostrarModalResumen(false);
    } catch (err: any) {
      alert('⚠️ ' + err.message);
    } finally {
      setGuardandoCierre(false);
    }
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#004e8c] flex items-center justify-center text-xs font-bold font-sans">
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

      {/* INVENTARIO, PEDIDOS Y GASTOS */}
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
              onChange={(e) => {
                const nuevoTipo = e.target.value;
                setTipoMovimiento(nuevoTipo);
                setTotalPaletasInventario('');
                setCantidadesInventario({});
                setObservacionesInventario('');
              }}
              disabled={!aperturaRealizada && baseGuardada}
              className="w-full bg-[#051829] border border-[#0066b3] text-white font-black text-xs rounded-xl p-2.5 outline-none cursor-pointer"
            >
              {!aperturaRealizada && <option value="apertura">👤 1. Conteo de Apertura (Obligatorio)</option>}
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
                placeholder="0"
                value={totalPaletasInventario}
                onChange={(e) => setTotalPaletasInventario(e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                onKeyDown={(e) => handleKeyDown(e, -1, LISTA_EMPAQUES_MARTINETO)}
                className="w-28 bg-[#0e385e] text-sky-200 font-black text-center text-sm rounded-lg p-2 outline-none border border-[#0066b3]"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            <span className="text-xs text-sky-300 font-bold block uppercase">CONTEO DE EMPAQUES Y VASOS (Presiona ENTER para avanzar):</span>
            {LISTA_EMPAQUES_MARTINETO.filter(i => i !== 'Total Paletas').map((item, idx) => (
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
                  onKeyDown={(e) => handleKeyDown(e, idx, LISTA_EMPAQUES_MARTINETO.filter(i => i !== 'Total Paletas'))}
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

        {/* PEDIDOS Y GASTOS */}
        <div className="space-y-4">
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
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
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

          <div className={`bg-[#0b2b48] border border-amber-500/60 p-4 rounded-2xl space-y-3 shadow-md ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center border-b border-amber-500/40 pb-2">
              <h2 className="text-xs md:text-sm font-black text-amber-300 flex items-center gap-1.5">
                💸 Registro de Gastos Directos (Descuenta de Caja)
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
                className="sm:col-span-7 bg-[#051829] border border-[#0066b3] text-white text-xs rounded-xl p-2.5 outline-none font-bold"
              />
              <input
                type="text"
                placeholder="Monto $"
                value={formatearMoneda(montoGasto)}
                onChange={(e) => setMontoGasto(desformatearMoneda(e.target.value))}
                className="sm:col-span-3 bg-[#051829] border border-[#0066b3] text-amber-300 text-xs rounded-xl p-2.5 outline-none font-black text-center"
              />
              <button
                onClick={registrarNuevoGasto}
                className="sm:col-span-2 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs uppercase cursor-pointer py-2"
              >
                + Gasto
              </button>
            </div>

            {listaGastos.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border-t border-[#0066b3]/30 pt-2">
                {listaGastos.map((g) => (
                  <div key={g.id} className="flex justify-between items-center bg-[#051829] p-2 rounded-lg border border-amber-500/30 text-xs">
                    <span className="text-white font-bold">🛒 {g.concepto} <small className="text-sky-300 font-normal">({g.hora})</small></span>
                    <span className="text-amber-300 font-black">- $ {g.monto.toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COLUMNAS POS */}
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

          <div className="pt-2 border-t border-[#0066b3]">
            <button
              onClick={() => setMostrarModalResumen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2"
            >
              📊 Auditoría y Balance del Día
            </button>
          </div>
        </div>

        {/* COLUMNA 2: CATEGORÍAS, PRODUCTOS Y BUSCADOR */}
        {mesaActivaId && (
          <div className={`${itemActivoActual && itemActivoActual.items.length > 0 ? 'lg:col-span-5' : 'lg:col-span-8'} bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md transition-all duration-300`}>
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-xs md:text-sm font-black text-white">📂 Categorías y Productos</h2>
              <span className="text-xs text-sky-200 font-bold">Activo: <b className="text-emerald-300">{itemActivoActual ? itemActivoActual.nombre : 'Ninguno'}</b></span>
            </div>

            {/* BARRA DE BÚSQUEDA RÁPIDA */}
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Buscar producto por nombre (ej. paleta enchilada, dorineto, malteada...)"
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

            {/* BOTONES DE CATEGORÍAS */}
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

        {/* COLUMNA 3: FACTURA Y CONTROL DE ESTADOS */}
        {itemActivoActual && itemActivoActual.items.length > 0 && (
          <div className="lg:col-span-4 bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md transition-all duration-300">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-xs md:text-sm font-black text-white">🧾 Factura / Pedido por Ítem</h2>
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
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[9px] px-2 py-1 rounded cursor-pointer"
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
                        title="Marca todos los pendientes como entregados"
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

      {/* MODAL AUDITORÍA */}
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

            {/* SECCIÓN 1: RESUMEN DE VENTAS Y CAJA */}
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
                    <span>• BANCOLOMBIA: $ 0</span>
                  </div>
                </div>

                <div className="flex justify-between text-emerald-300 font-black pt-1">
                  <span>💵 Ventas en Efectivo:</span>
                  <span>$ {totalEfectivoIngresado.toLocaleString('es-CO')}</span>
                </div>

                <div className="flex justify-between text-amber-400">
                  <span>💸 Gastos Directos (Efectivo):</span>
                  <span>- $ {sumaGastosTotal.toLocaleString('es-CO')}</span>
                </div>

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

            {/* SECCIÓN 2: TABLA DE INVENTARIO */}
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
                          placeholder="0"
                          value={conteoFisicoProductos[item.nombre] ?? ''}
                          onChange={(e) =>
                            setConteoFisicoProductos({
                              ...conteoFisicoProductos,
                              [item.nombre]: e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')),
                            })
                          }
                          onKeyDown={(e) => handleKeyDown(e, idx, LISTA_EMPAQUES_MARTINETO, 'cierre')}
                          className="w-full bg-[#051829] text-sky-200 font-black text-center text-xs rounded p-1 outline-none border border-[#0066b3]"
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: RESUMEN DE VENTAS */}
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

      {/* MODAL COBRO */}
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
            </div>

            {(() => {
              const abonadoAhora = (Number(pagoEfectivo) || 0) + (Number(pagoNequi) || 0) + (Number(pagoDaviplata) || 0);
              const pendienteActual = Math.max(0, mesaActiva.total - (mesaActiva.totalAbonado || 0));
              const diferencia = abonadoAhora - pendienteActual;

              return (
                <div className="bg-[#051829] p-3 rounded-xl border border-[#0066b3] space-y-1">
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
                {procesandoPago ? 'Procesando...' : '✓ Confirmar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN NÓMINA */}
      <div className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md">
        <h2 className="text-xs md:text-sm font-black text-white border-b border-[#0066b3]/50 pb-2 flex justify-between items-center">
          <span>⚙️ Cambio de Turno / Pago de Nómina</span>
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
            <span className="text-[10px] text-sky-300 font-bold block uppercase">Total Pago:</span>
            <span className="text-base font-black text-rose-400">$ {calcularTotalNomina().toLocaleString('es-CO')}</span>
          </div>
        </div>

        <button
          onClick={pagarYDescontarNominaDeCaja}
          className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
        >
          💸 Pagar Nómina (Descontar de Caja)
        </button>
      </div>
    </main>
  );
}