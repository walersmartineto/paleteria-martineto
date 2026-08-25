'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  obtenerTarifasViva,
  registrarBaseCajaViva,
  crearPedidoInsumosViva,
  obtenerUsuariosOperarios,
  registrarNominaYCambioTurno,
  obtenerSaboresViva,
  TarifasViva,
} from '@/lib/vivaQueries';
import { supabase } from '@/lib/supabase';

// FUNCIONES DE FORMATO DE MONEDA
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

export default function VivaPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);

  // ESTADO DE TARIFAS (SE CARGA DINÁMICAMENTE DESDE configuracion_tarifa)
  const [tarifas, setTarifas] = useState<TarifasViva>({
    subsidio: 0,
    transporte: 0,
    horaDiaEntreSemana: 0,
    horaNocheEntreSemana: 0,
    horaDiaFestivo: 0,
    horaNocheFestivo: 0,
  });

  // AUTO-SAVE: Base de Caja
  const [baseCaja, setBaseCaja, limpiarBaseCaja] = useAutoSave<number | ''>('viva_baseCaja', '');
  const [baseGuardada, setBaseGuardada] = useState(false);
  const [aperturaRealizada, setAperturaRealizada] = useState(false);
  const [cierreRealizado, setCierreRealizado] = useState(false);
  
  // EFECTIVO ENTREGADO EN CAMBIO DE TURNO (VISUAL)
  const [efectivoTurnoManana, setEfectivoTurnoManana] = useState<number | null>(null);

  // AUTO-SAVE: Inventario por Sabores y Caja Mostac
  const [tipoMovimiento, setTipoMovimiento] = useState<string>('apertura');
  const [saboresViva, setSaboresViva] = useState<any[]>([]);
  const [cantidadesSabores, setCantidadesSabores, limpiarCantidadesSabores] = useAutoSave<{ [saborId: number]: number | '' }>('viva_cantidadesSabores', {});
  const [cajasMostrador, setCajasMostrador, limpiarCajasMostrador] = useAutoSave<number | ''>('viva_cajasMostrador', '');
  const [observaciones, setObservaciones, limpiarObsInv] = useAutoSave<string>('viva_observacionesInv', '');

  // AUTO-SAVE: Requisición de Pedidos
  const [mostrarModuloPedidos, setMostrarModuloPedidos] = useState(false);
  const [categoriaPedido, setCategoriaPedido] = useState<'paletas' | 'richi' | 'insumos' | 'aseo'>('paletas');
  const [cantidadesPedidoPaletas, setCantidadesPedidoPaletas, limpiarPedPaletas] = useAutoSave<{ [saborId: number]: number | '' }>('viva_pedPaletas', {});
  const [cantidadesRichi, setCantidadesRichi, limpiarPedRichi] = useAutoSave<{ [item: string]: number | '' }>('viva_pedRichi', {});
  const [cantidadesInsumos, setCantidadesInsumos, limpiarPedInsumos] = useAutoSave<{ [item: string]: number | '' }>('viva_pedInsumos', {});
  const [cantidadesAseo, setCantidadesAseo, limpiarPedAseo] = useAutoSave<{ [item: string]: number | '' }>('viva_pedAseo', {});
  const [otroInsumoTexto, setOtroInsumoTexto, limpiarOtroInsumo] = useAutoSave<string>('viva_otroInsumo', '');
  const [obsPedido, setObsPedido, limpiarObsPedido] = useAutoSave<string>('viva_obsPedido', '');

  // ESTADOS MODAL CREAR NUEVO PRODUCTO / INSUMO EN BD
  const [productosInsumosBD, setProductosInsumosBD] = useState<any[]>([]);
  const [mostrarModalNuevoProd, setMostrarModalNuevoProd] = useState(false);
  const [nuevoProdNombre, setNuevoProdNombre] = useState('');
  const [nuevoProdCategoria, setNuevoProdCategoria] = useState('Paleta');
  const [nuevoProdGrupo, setNuevoProdGrupo] = useState('');
  const [nuevoProdDondeComprar, setNuevoProdDondeComprar] = useState('');
  const [dondeComprarPersonalizado, setDondeComprarPersonalizado] = useState('');
  const [esProductoGlobal, setEsProductoGlobal] = useState(true);
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  // AUTO-SAVE: Nómina y Arqueo de Caja
  const [tipoDia, setTipoDia] = useState<'entre_semana' | 'domingo_festivo'>('entre_semana');
  const [horasDia, setHorasDia, limpiarHorasDia] = useAutoSave<number | ''>('viva_horasDia', '');
  const [horasNoche, setHorasNoche, limpiarHorasNoche] = useAutoSave<number | ''>('viva_horasNoche', '');
  const [efectivoCaja, setEfectivoCaja, limpiarEfCaja] = useAutoSave<number | ''>('viva_efectivoCaja', '');
  const [nequi, setNequi, limpiarNequi] = useAutoSave<number | ''>('viva_nequi', '');
  const [daviplata, setDaviplata, limpiarDaviplata] = useAutoSave<number | ''>('viva_daviplata', '');
  const [gastos, setGastos, limpiarGastos] = useAutoSave<number | ''>('viva_gastos', '');
  const [motivoGasto, setMotivoGasto, limpiarMotivoGasto] = useAutoSave<string>('viva_motivoGasto', '');

  // MODAL CAMBIO DE TURNO
  const [mostrarModalCambioTurno, setMostrarModalCambioTurno] = useState(false);
  const [listaOperarios, setListaOperarios] = useState<any[]>([]);
  const [operarioEntranteId, setOperarioEntranteId] = useState<string>('');
  const [claveOperarioEntrante, setClaveOperarioEntrante] = useState<string>('');
  const [turnoRecibido, setTurnoRecibido] = useState<string>('tarde');
  const [validandoEntrante, setValidandoEntrante] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const inputsRef = useRef<{ [key: string]: HTMLInputElement | HTMLTextAreaElement | null }>({});

  const hDia = Number(horasDia) || 0;
  const hNoche = Number(horasNoche) || 0;
  const valorHoraDia = tipoDia === 'domingo_festivo' ? tarifas.horaDiaFestivo : tarifas.horaDiaEntreSemana;
  const valorHoraNoche = tipoDia === 'domingo_festivo' ? tarifas.horaNocheFestivo : tarifas.horaNocheEntreSemana;
  const totalNomina = tarifas.subsidio + tarifas.transporte + hDia * valorHoraDia + hNoche * valorHoraNoche;

  const totalVentasCalculado = (Number(efectivoCaja) || 0) + (Number(nequi) || 0) + (Number(daviplata) || 0);

  const SEDE_ID_VIVA = 1;

  // OBTENER LUGARES DE COMPRA EXCLUSIVAMENTE DESDE LA BASE DE DATOS
  const listaLugaresCompraUnica = Array.from(
    new Set(
      productosInsumosBD
        .map((p) => p.donde_comprar)
        .filter((lugar): lugar is string => Boolean(lugar && lugar.trim() !== ''))
        .map((lugar) => {
          const l = lugar.trim();
          return l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
        })
    )
  )
    .filter((lugar) => !lugar.toLowerCase().includes('hermanita'))
    .sort();

  // FILTROS DINÁMICOS DESDE LA BD
  const paletasFiltradas = saboresViva.filter((p) => {
    const cat = String(p.categoria || '').trim().toLowerCase();
    return cat === 'paleta' || cat === '';
  });

  const richiFiltrados = productosInsumosBD.filter((p) => {
    const cat = String(p.categoriaLimpia || '');
    return cat.includes('richi') || cat.includes('empaque');
  });

  const insumosFiltrados = productosInsumosBD.filter((p) => {
    const cat = String(p.categoriaLimpia || '');
    return cat.includes('insumo') || cat.includes('topping') || cat.includes('materia');
  });

  const aseoFiltrados = productosInsumosBD.filter((p) => {
    const cat = String(p.categoriaLimpia || '');
    return cat.includes('aseo');
  });

  const totalPaletasSuma = Object.values(cantidadesSabores).reduce(
    (acc: number, val) => acc + (Number(val) || 0),
    0
  );

  const esTurnoCierre = (() => {
    if (!sesion) return false;
    const str = JSON.stringify(sesion).toLowerCase();
    return str.includes('completo') || str.includes('cierre') || str.includes('tarde');
  })();

  useEffect(() => {
    const sesionLocal = localStorage.getItem('martineto_session');
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }
    const ses = JSON.parse(sesionLocal);
    setSesion(ses);

    const efectivoMananaGuardado = localStorage.getItem('martineto_efectivo_manana');
    if (efectivoMananaGuardado) {
      setEfectivoTurnoManana(Number(efectivoMananaGuardado));
    }

    cargarInicial();
  }, [router]);

  async function cargarInicial() {
    setCargando(true);

    const { data: configBD } = await supabase
      .from('configuracion_tarifa')
      .select('*')
      .single();

    if (configBD) {
      setTarifas({
        subsidio: Number(configBD.subsidio) || 0,
        transporte: Number(configBD.transporte) || 0,
        horaDiaEntreSemana: Number(configBD.hora_dia_entre_semana) || 0,
        horaNocheEntreSemana: Number(configBD.hora_noche_entre_semana) || 0,
        horaDiaFestivo: Number(configBD.hora_dia_festivo) || 0,
        horaNocheFestivo: Number(configBD.hora_noche_festivo) || 0,
      });
    } else {
      const configTarifasAux = await obtenerTarifasViva();
      if (configTarifasAux) setTarifas(configTarifasAux);
    }

    const [operarios, listaSabores] = await Promise.all([
      obtenerUsuariosOperarios(),
      obtenerSaboresViva(),
    ]);

    setListaOperarios(operarios);
    setSaboresViva(listaSabores || []);

    const { data: prodsInsumosBD } = await supabase
      .from('producto')
      .select('*')
      .or(`sede_id.eq.${SEDE_ID_VIVA},sede_id.eq.0,sede_id.is.null`);

    if (prodsInsumosBD) {
      const mapeados = prodsInsumosBD.map((p: any) => ({
        ...p,
        nombre: p.nombre || p.Nombre || '',
        categoriaLimpia: String(p.categoria || p.Categoria || 'general').trim().toLowerCase(),
        grupoLimpio: String(p.grupo || p.Grupo || '').trim().toLowerCase(),
        donde_comprar: p.donde_comprar || '',
      }));
      setProductosInsumosBD(mapeados);

      const lugaresUnicos = Array.from(
        new Set(
          mapeados
            .map((p: any) => p.donde_comprar)
            .filter((l: string) => Boolean(l && l.trim() !== ''))
            .map((l: string) => l.trim().charAt(0).toUpperCase() + l.trim().slice(1).toLowerCase())
        )
      ).filter((l: string) => !l.toLowerCase().includes('hermanita'));

      if (lugaresUnicos.length > 0) {
        setNuevoProdDondeComprar(lugaresUnicos[0]);
      } else {
        setNuevoProdDondeComprar('Otro');
      }
    }

    setCargando(false);
  }

  // --- FUNCIÓN AUTOMÁTICA DE AUDITORÍA ---
  async function procesarDiferenciaAperturaAutomatica(
    usuarioId: number,
    detallePaletasHoy: { [nombre: string]: number },
    detalleEmpaquesHoy: { [nombre: string]: number }
  ) {
    try {
      const { data: ultimoCierre } = await supabase
        .from('inventario_diario')
        .select('detalle_paletas, detalle_empaques')
        .eq('sede_id', SEDE_ID_VIVA)
        .ilike('tipo_movimiento', 'cierre')
        .order('fecha_registro', { ascending: false })
        .limit(1)
        .maybeSingle();

      const jsonCierrePaletas = ultimoCierre?.detalle_paletas || {};
      const jsonCierreEmpaques = ultimoCierre?.detalle_empaques || {};

      const difPaletasObj: { [nombre: string]: number } = {};
      const difEmpaquesObj: { [nombre: string]: number } = {};
      let totalDiferenciaGlobal = 0;

      Object.entries(detallePaletasHoy).forEach(([nombreProd, cantHoy]) => {
        const cantAyer = Number(jsonCierrePaletas[nombreProd] || 0);
        const dif = Number(cantHoy) - cantAyer;
        difPaletasObj[nombreProd] = dif;
        totalDiferenciaGlobal += dif;
      });

      Object.entries(detalleEmpaquesHoy).forEach(([nombreItem, cantHoy]) => {
        const cantAyer = Number(jsonCierreEmpaques[nombreItem] || 0);
        const dif = Number(cantHoy) - cantAyer;
        difEmpaquesObj[nombreItem] = dif;
        totalDiferenciaGlobal += dif;
      });

      await supabase.from('diferencia_inventario').insert([
        {
          sede_id: SEDE_ID_VIVA,
          usuario_id: usuarioId,
          diferencia_paletas: difPaletasObj,
          diferencia_empaques: difEmpaquesObj,
          total_diferencia: totalDiferenciaGlobal,
        },
      ]);
    } catch (e) {
      console.error('Error calculando la diferencia consolidada:', e);
    }
  }

  async function crearNuevoProductoBD() {
    const nombreLimpio = nuevoProdNombre.trim();
    const dondeComprarFinal =
      nuevoProdDondeComprar === 'Otro'
        ? dondeComprarPersonalizado.trim()
        : nuevoProdDondeComprar.trim();

    if (!nombreLimpio || !dondeComprarFinal) {
      alert('⚠️ Nombre y lugar de compra son obligatorios.');
      return;
    }

    setGuardandoProducto(true);
    const payload = {
      nombre: nombreLimpio,
      categoria: nuevoProdCategoria,
      grupo: nuevoProdCategoria === 'Paleta' ? nuevoProdGrupo.trim() || 'Paleta' : nuevoProdCategoria,
      donde_comprar: dondeComprarFinal,
      sede_id: esProductoGlobal ? 0 : SEDE_ID_VIVA,
      activo: true,
    };

    const { data, error } = await supabase.from('producto').insert([payload]).select();

    if (error) {
      alert('Error guardando en la base de datos: ' + error.message);
      setGuardandoProducto(false);
      return;
    }

    alert(`✅ ¡Insumo "${nombreLimpio}" creado con éxito!`);
    if (data && data.length > 0) {
      const nuevoObj = {
        ...data[0],
        nombre: data[0].nombre,
        categoriaLimpia: String(data[0].categoria || '').trim().toLowerCase(),
        grupoLimpio: String(data[0].grupo || '').trim().toLowerCase(),
        donde_comprar: data[0].donde_comprar || '',
      };
      setProductosInsumosBD((prev) => [...prev, nuevoObj]);
      if (nuevoProdCategoria === 'Paleta') {
        setSaboresViva((prev) => [...prev, nuevoObj]);
      }
    }

    setNuevoProdNombre('');
    setNuevoProdGrupo('');
    setDondeComprarPersonalizado('');
    setMostrarModalNuevoProd(false);
    setGuardandoProducto(false);
  }

  function handleSaborCantidadChange(saborId: number, rawVal: string) {
    const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
    setCantidadesSabores((prev) => ({ ...prev, [saborId]: val }));
  }

  function handleKeyDownSabor(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < paletasFiltradas.length - 1) {
        const siguienteSabor = paletasFiltradas[index + 1];
        inputsRef.current[`sabor_${siguienteSabor.id}`]?.focus();
      } else {
        inputsRef.current['caja_mostac']?.focus();
      }
    }
  }

  function handleKeyDownPedido(e: React.KeyboardEvent<HTMLInputElement>, index: number, lista: any[], prefijo: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < lista.length - 1) {
        const siguienteItem = lista[index + 1];
        const key = typeof siguienteItem === 'object' ? siguienteItem.id : siguienteItem;
        inputsRef.current[`${prefijo}_${key}`]?.focus();
      }
    }
  }

  function handleKeyDownCierre(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, siguienteInputKey: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputsRef.current[siguienteInputKey]?.focus();
    }
  }

  function handleCantidadPedidoChange(saborId: number, rawVal: string) {
    const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
    setCantidadesPedidoPaletas((prev) => ({ ...prev, [saborId]: val }));
  }

  function handleItemGenericoChange(item: string, rawVal: string, setter: React.Dispatch<React.SetStateAction<{ [key: string]: number | '' }>>) {
    const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
    setter((prev) => ({ ...prev, [item]: val }));
  }

  async function handleGuardarBase() {
    const monto = baseCaja === '' ? 0 : Number(baseCaja);
    if (monto < 0) {
      alert('Ingresa un valor válido para la base inicial.');
      return;
    }

    const sesionActual = sesion || JSON.parse(localStorage.getItem('martineto_session') || '{}');
    const usuarioId = sesionActual?.usuario_id || sesionActual?.id;
    const sedeId = SEDE_ID_VIVA;
    const turnoId = sesionActual?.turno_id || sesionActual?.turnoId || null;

    if (!usuarioId) {
      alert('⚠️ No hay sesión de usuario válida.');
      return;
    }

    setGuardando(true);
    try {
      const exito = await registrarBaseCajaViva(sedeId, usuarioId, monto, turnoId);
      if (exito) {
        setBaseGuardada(true);
        alert('¡Base inicial guardada con éxito en la tabla CAJA!');
      } else {
        alert('⚠️ Hubo un error al guardar la base en la base de datos.');
      }
    } catch (e) {
      console.error('Error al guardar la base:', e);
      alert('⚠️ Error de conexión al guardar la base.');
    } finally {
      setGuardando(false);
    }
  }

  async function handleGuardarInventario() {
    if (!sesion) {
      alert('⚠️ No hay sesión activa.');
      return;
    }

    if (!baseGuardada) {
      alert('⚠️ Primero debes guardar la Base Inicial de Caja.');
      return;
    }

    const detallePaletasObj: { [saborNombre: string]: number } = {};
    Object.entries(cantidadesSabores).forEach(([saborId, cant]) => {
      const num = Number(cant) || 0;
      if (num > 0) {
        const saborObj = saboresViva.find((s) => s.id === Number(saborId));
        if (saborObj) detallePaletasObj[saborObj.nombre] = num;
      }
    });

    const detalleEmpaquesObj: { [itemNombre: string]: number } = {};
    if (Number(cajasMostrador) > 0) {
      detalleEmpaquesObj['Caja Mostac'] = Number(cajasMostrador);
    }

    const usuarioId = sesion?.usuario_id || sesion?.id || 1;
    const sedeId = SEDE_ID_VIVA;

    setGuardando(true);
    try {
      const payloadInventario: any = {
        sede_id: sedeId,
        usuario_id: usuarioId,
        tipo_movimiento: tipoMovimiento,
        total_paletas: totalPaletasSuma,
        detalle_paletas: detallePaletasObj,
        detalle_empaques: detalleEmpaquesObj,
        observacion: observaciones || null,
      };

      if (sesion?.turno_id && !isNaN(Number(sesion.turno_id))) {
        payloadInventario.turno_id = Number(sesion.turno_id);
      }

      const { error } = await supabase
        .from('inventario_diario')
        .insert([payloadInventario])
        .select();

      if (error) {
        setGuardando(false);
        console.error('Error insertando en inventario_diario:', error);
        alert(`❌ Error de Supabase: ${error.message}`);
        return;
      }

      if (tipoMovimiento === 'apertura') {
        await procesarDiferenciaAperturaAutomatica(usuarioId, detallePaletasObj, detalleEmpaquesObj);
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
      } else if (tipoMovimiento === 'cierre') {
        setCierreRealizado(true);
      }

      setGuardando(false);
      alert(`✅ ¡Inventario guardado con éxito!`);

      limpiarCantidadesSabores();
      limpiarCajasMostrador();
      limpiarObsInv();

    } catch (err: any) {
      setGuardando(false);
      console.error('Error guardando inventario:', err);
      alert(`❌ Error inesperado: ${err?.message || 'Error de conexión'}`);
    }
  }

  async function handleGuardarPedidoInsumos() {
    setGuardando(true);

    const paletasObj: { [key: string]: number } = {};
    Object.entries(cantidadesPedidoPaletas).forEach(([saborId, cant]) => {
      const num = Number(cant) || 0;
      if (num > 0) {
        const saborObj = saboresViva.find((s) => s.id === Number(saborId));
        if (saborObj) paletasObj[saborObj.nombre] = num;
      }
    });

    const richiObj: { [key: string]: number } = {};
    Object.entries(cantidadesRichi).forEach(([item, cant]) => {
      if (Number(cant) > 0) richiObj[item] = Number(cant);
    });

    const insumosObj: { [key: string]: number } = {};
    Object.entries(cantidadesInsumos).forEach(([item, cant]) => {
      if (Number(cant) > 0) insumosObj[item] = Number(cant);
    });

    const aseoObj: { [key: string]: number } = {};
    Object.entries(cantidadesAseo).forEach(([item, cant]) => {
      if (Number(cant) > 0) aseoObj[item] = Number(cant);
    });

    if (otroInsumoTexto.trim()) insumosObj[`Otro: ${otroInsumoTexto.trim()}`] = 1;

    const totalItemsCount = 
      Object.keys(paletasObj).length + 
      Object.keys(richiObj).length + 
      Object.keys(insumosObj).length + 
      Object.keys(aseoObj).length;

    if (totalItemsCount === 0) {
      alert('Ingresa al menos una cantidad para realizar el pedido.');
      setGuardando(false);
      return;
    }

    const usuarioId = sesion?.usuario_id || sesion?.id || 1;
    const sedeId = SEDE_ID_VIVA;

    try {
      const ok = await crearPedidoInsumosViva({
        sedeId,
        usuarioId,
        paletas: paletasObj,
        richi: richiObj,
        insumos: insumosObj,
        aseo: aseoObj,
        observaciones: obsPedido,
      });

      if (ok) {
        alert('¡Pedido de Viva registrado correctamente!');
        limpiarPedPaletas();
        limpiarPedRichi();
        limpiarPedInsumos();
        limpiarPedAseo();
        limpiarOtroInsumo();
        limpiarObsPedido();
      } else {
        alert('Error al registrar en la base de datos.');
      }
    } catch (err: any) {
      console.error('Error enviando pedido:', err);
      alert(`Error al registrar la solicitud: ${err?.message || 'Error de conexión'}`);
    } finally {
      setGuardando(false);
    }
  }

  async function handleGuardarNominaTurno() {
    if (totalNomina <= 0) {
      alert('Ingresa las horas trabajadas.');
      return;
    }

    if (esTurnoCierre && !cierreRealizado) {
      alert('⚠️ ATENCIÓN: Debes seleccionar "Conteo de Cierre" en la sección de inventario y guardar el conteo antes de cerrar la jornada.');
      return;
    }

    setGuardando(true);
    const efCaja = Number(efectivoCaja) || 0;
    const neq = Number(nequi) || 0;
    const dav = Number(daviplata) || 0;
    const gst = Number(gastos) || 0;

    const usuarioId = sesion?.usuario_id || sesion?.id || 1;
    const sedeId = SEDE_ID_VIVA;

    const datosPayload: any = {
      sedeId,
      usuarioId,
      tipoDia,
      horasDia: hDia,
      horasNoche: hNoche,
      subsidio: tarifas.subsidio,
      transporte: tarifas.transporte,
      totalPagado: totalNomina,
      efectivoCaja: efCaja,
      nequi: esTurnoCierre ? neq : 0,
      daviplata: esTurnoCierre ? dav : 0,
      gastos: esTurnoCierre ? gst : 0,
      motivoGasto: esTurnoCierre ? motivoGasto : '',
    };

    const ok = await registrarNominaYCambioTurno(datosPayload);
    setGuardando(false);

    if (ok) {
      if (esTurnoCierre) {
        alert(`¡Cierre de jornada completado con éxito!\n\nNómina: $ ${totalNomina.toLocaleString('es-CO')}\nTotal Recaudado: $ ${totalVentasCalculado.toLocaleString('es-CO')}\nGastos: $ ${gst.toLocaleString('es-CO')}\n\n¡Hasta mañana!`);
        localStorage.removeItem('martineto_efectivo_manana');
        
        limpiarBaseCaja();
        limpiarHorasDia();
        limpiarHorasNoche();
        limpiarEfCaja();
        limpiarNequi();
        limpiarDaviplata();
        limpiarGastos();
        limpiarMotivoGasto();

        cerrarSesion();
      } else {
        setEfectivoTurnoManana(efCaja);
        localStorage.setItem('martineto_efectivo_manana', efCaja.toString());

        alert(`¡Nómina registrada con éxito!\n\nEfectivo dejado en caja para la tarde: $ ${efCaja.toLocaleString('es-CO')}\n\nA continuación, ingresa el operario que recibe el turno.`);
        
        limpiarHorasDia();
        limpiarHorasNoche();
        limpiarEfCaja();
        limpiarNequi();
        limpiarDaviplata();

        setMostrarModalCambioTurno(true);
      }
    } else {
      alert('Error al registrar.');
    }
  }

  async function handleConfirmarEntrante() {
    if (!operarioEntranteId) {
      alert('Selecciona al operario que recibe el turno.');
      return;
    }
    if (!claveOperarioEntrante) {
      alert('Ingresa la contraseña/PIN del operario.');
      return;
    }

    setValidandoEntrante(true);

    const operarioEncontrado = listaOperarios.find(
      (u) => String(u.id) === String(operarioEntranteId)
    );

    if (
      operarioEncontrado &&
      String(operarioEncontrado.pin).trim() === String(claveOperarioEntrante).trim()
    ) {
      const turnoNormalizado = turnoRecibido.includes('tarde') ? 'tarde' : 'manana';

      const nuevaSesion = {
        usuario_id: operarioEncontrado.id,
        nombre: operarioEncontrado.nombre,
        sede_id: SEDE_ID_VIVA,
        turno: turnoNormalizado,
      };

      localStorage.setItem('martineto_session', JSON.stringify(nuevaSesion));
      setSesion(nuevaSesion);

      setMostrarModalCambioTurno(false);
      setClaveOperarioEntrante('');
      setOperarioEntranteId('');

      setBaseGuardada(true);
      setAperturaRealizada(true);
      setCierreRealizado(false);
      setTipoMovimiento('nuevas');

      setValidandoEntrante(false);
      alert(`✅ ¡Turno entregado con éxito!\nBienvenido(a) ${nuevaSesion.nombre}. Puedes continuar con la atención y operación normal de la sede.`);
    } else {
      setValidandoEntrante(false);
      alert('❌ Código de acceso / PIN incorrecto para este operario.');
    }
  }

  function cerrarSesion() {
    localStorage.removeItem('martineto_session');
    localStorage.removeItem('martineto_efectivo_manana');
    router.push('/login');
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#004e8c] flex items-center justify-center text-white text-xs font-bold font-sans">
        Cargando Sede Viva...
      </main>
    );
  }

  const bloqueadoPorApertura = !baseGuardada || !aperturaRealizada;

  return (
    <main className="min-h-screen bg-[#004e8c] text-[#f1f5f9] p-4 font-sans max-w-6xl mx-auto space-y-4 relative">
      {/* Header Banner con Logo Walers */}
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003d6d] border border-[#0066b3] p-1 flex items-center justify-center overflow-hidden shrink-0 shadow">
            <img
              src="/walers.png.jpeg"
              alt="Walers Viva"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black text-white tracking-wide flex items-center gap-2">
              WALERS VIVA
            </h1>
            <p className="text-xs text-sky-200 font-medium">
              Operador en Turno: <b className="text-white font-bold">{sesion?.nombre || 'Operador'}</b>
              <span className="ml-2 text-sky-100 font-bold uppercase bg-[#003d6d] px-2 py-0.5 rounded-md border border-[#0066b3]">
                ({esTurnoCierre ? 'Día Completo / Cierre' : 'Mañana / Apertura'})
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={cerrarSesion}
          className="bg-[#003d6d] hover:bg-rose-900/80 text-white hover:text-rose-200 border border-[#0066b3] hover:border-rose-500 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          🚪 Salir
        </button>
      </header>

      {/* Base Inicial de Caja y Efectivo de Cambio de Turno */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#0b2b48] border border-emerald-400/50 p-4 rounded-2xl space-y-2 shadow-md">
          <span className="text-xs md:text-sm font-black text-emerald-300 block">
            💵 Paso 1: Base Inicial del Día (Efectivo en Caja):
          </span>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Monto en efectivo $"
              value={formatearMoneda(baseCaja)}
              onChange={(e) => setBaseCaja(desformatearMoneda(e.target.value))}
              onFocus={(e) => e.target.select()}
              disabled={baseGuardada}
              className="w-full bg-[#051829] border border-[#0066b3] text-emerald-300 font-black text-sm md:text-base rounded-xl p-3 outline-none focus:border-emerald-400"
            />
            <button
              onClick={handleGuardarBase}
              disabled={baseGuardada}
              className={`font-bold px-6 rounded-xl text-xs md:text-sm whitespace-nowrap transition-all shadow-sm ${
                baseGuardada
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              }`}
            >
              {baseGuardada ? '✓ Base Guardada' : 'Guardar Base'}
            </button>
          </div>
        </div>

        {/* CUADRO DEL EFECTIVO RECIBIDO POR CAMBIO DE TURNO DE LA MAÑANA */}
        <div className="bg-[#0b2b48] border border-amber-400/50 p-4 rounded-2xl space-y-1 shadow-md flex flex-col justify-center">
          <span className="text-xs font-black text-amber-300 block uppercase">
            ☀️ Efectivo Recibido del Turno Mañana:
          </span>
          <div className="bg-[#051829] border border-amber-500/40 p-2.5 rounded-xl flex justify-between items-center">
            <span className="text-xs text-sky-200 font-bold">Efectivo disponible en caja para la tarde:</span>
            <span className="text-sm font-black text-amber-300 bg-[#0e385e] px-3 py-1 rounded-lg border border-amber-500/40">
              {efectivoTurnoManana !== null ? `$ ${efectivoTurnoManana.toLocaleString('es-CO')}` : 'Sin cambio de turno previo'}
            </span>
          </div>
        </div>
      </div>

      {bloqueadoPorApertura && (
        <div className="bg-amber-950/80 border border-amber-400/60 p-3 rounded-xl text-center text-xs text-amber-200 font-bold shadow-sm">
          ⚠️ ATENCIÓN: Debes registrar la Base de Caja y realizar obligatoriamente el <span className="underline">Conteo de Apertura</span> para habilitar el resto de módulos de la sede.
        </div>
      )}

      {/* GRID DOS COLUMNAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        
        {/* COLUMNA IZQUIERDA: INVENTARIO POR SABORES */}
        <div className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-4 shadow-md">
          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
            <h2 className="text-xs md:text-sm font-black text-white">🍦 Conteo de Paletas por Sabor</h2>
            <span className="text-[11px] text-sky-200 font-bold uppercase bg-[#003d6d] px-2 py-0.5 rounded-md border border-[#0066b3]">{tipoMovimiento}</span>
          </div>

          <div>
            <label className="text-[11px] text-sky-200 font-bold block mb-1">Acción a registrar:</label>
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value)}
              disabled={!aperturaRealizada && baseGuardada}
              className="w-full bg-[#051829] border border-[#0066b3] text-white font-black text-xs md:text-sm rounded-xl p-2.5 outline-none cursor-pointer focus:border-[#00a4ef]"
            >
              {!aperturaRealizada && <option value="apertura">🌅 1. Conteo de Apertura (Obligatorio)</option>}
              {aperturaRealizada && (
                <>
                  <option value="nuevas">📦 Paletas Nuevas (Ingreso)</option>
                  <option value="compras">🛒 Compras Directas</option>
                  <option value="debaja">⚠️ De Baja / Mermas</option>
                  <option value="cierre">🌙 Conteo de Cierre</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 border border-[#0066b3]/50 p-2.5 rounded-xl bg-[#051829]">
            <span className="text-[10px] text-sky-300 font-bold uppercase block mb-1">Ingresar Cantidad por Sabor:</span>
            {paletasFiltradas.length === 0 ? (
              <p className="text-xs text-amber-200 text-center py-4 font-semibold">
                ⚠️ No se encontraron paletas registradas.
              </p>
            ) : (
              paletasFiltradas.map((s, idx) => (
                <div key={s.id} className="bg-[#0e385e] border border-[#0066b3]/60 p-2 rounded-xl flex justify-between items-center gap-2 shadow-sm">
                  <div className="truncate">
                    <p className="font-bold text-xs text-white truncate">{s.nombre}</p>
                    <span className="text-[10px] font-semibold text-sky-300 block -mt-0.5 capitalize">
                      {s.grupo || s.categoria || 'Paleta'}
                    </span>
                  </div>
                  <input
                    ref={(el) => { inputsRef.current[`sabor_${s.id}`] = el; }}
                    type="number"
                    placeholder="0"
                    value={cantidadesSabores[s.id] ?? ''}
                    onChange={(e) => handleSaborCantidadChange(s.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDownSabor(e, idx)}
                    onFocus={(e) => e.target.select()}
                    className="w-24 bg-[#051829] border border-[#00a4ef]/60 text-sky-200 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              ))
            )}
          </div>

          <div className="bg-[#0e385e] p-3 rounded-2xl border border-[#0066b3] flex justify-between items-center shadow-inner">
            <span className="text-xs font-black text-sky-200 uppercase">
              Total Paletas ({tipoMovimiento.toUpperCase()}):
            </span>
            <span className="text-xl font-black text-white bg-[#051829] px-4 py-1.5 rounded-xl border border-[#0066b3] shadow">
              {totalPaletasSuma}
            </span>
          </div>

          <div className="bg-[#0e385e] p-3 rounded-xl border border-[#0066b3]/60 space-y-2">
            <span className="text-[10px] text-sky-300 font-extrabold uppercase block">Conteo de Empaques:</span>
            <div className="flex justify-between items-center bg-[#051829] p-2.5 rounded-lg border border-[#0066b3]">
              <span className="text-xs text-white font-bold">📦 Caja Mostac:</span>
              <input 
                ref={(el) => { inputsRef.current['caja_mostac'] = el; }}
                type="number" 
                placeholder="0" 
                value={cajasMostrador} 
                onChange={(e) => setCajasMostrador(e.target.value === '' ? '' : Number(e.target.value))} 
                onFocus={(e) => e.target.select()} 
                className="w-24 bg-[#0e385e] text-sky-200 font-black text-center text-sm rounded-lg p-2 outline-none focus:border-[#00a4ef] border border-[#0066b3] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
            </div>
          </div>

          <textarea
            placeholder="Observaciones de inventario..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-2.5 text-xs text-white outline-none h-16 resize-none focus:border-[#00a4ef]"
          />

          <button
            onClick={handleGuardarInventario}
            disabled={!baseGuardada || guardando}
            className={`w-full font-black py-3 rounded-xl text-xs md:text-sm transition-all uppercase shadow-md ${
              baseGuardada && !guardando
                ? 'bg-[#0078d4] hover:bg-[#0086e6] text-white shadow-[#003d6d] cursor-pointer opacity-100'
                : 'bg-[#051829] text-sky-400/40 cursor-not-allowed opacity-50 border border-[#003d6d]'
            }`}
          >
            {guardando ? 'Guardando Inventario...' : `💾 Guardar ${tipoMovimiento}`}
          </button>
        </div>

        {/* COLUMNA DERECHA: PEDIDOS Y CIERRE DE CAJA / NÓMINA */}
        <div className={`space-y-4 transition-opacity ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none select-none' : 'opacity-100'}`}>
          
          <div className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-3 shadow-md">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-xs md:text-sm font-black text-white flex items-center gap-1.5">
                🚚 Pedidos de Insumos (Requisición)
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevoProd(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase cursor-pointer shadow"
                >
                  ➕ Crear Producto
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarModuloPedidos(!mostrarModuloPedidos)}
                  className="bg-[#0e385e] hover:bg-[#003d6d] text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors border border-[#0066b3] cursor-pointer"
                >
                  {mostrarModuloPedidos ? '👁️ Ocultar Pedidos' : '👁️ Hacer Pedido'}
                </button>
              </div>
            </div>

            {mostrarModuloPedidos && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                  <button type="button" onClick={() => setCategoriaPedido('paletas')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all cursor-pointer ${categoriaPedido === 'paletas' ? 'bg-[#0078d4] text-white border-[#00a4ef] shadow' : 'bg-[#051829] text-sky-200 border-[#0066b3]'}`}>🍦 Paletas</button>
                  <button type="button" onClick={() => setCategoriaPedido('richi')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all cursor-pointer ${categoriaPedido === 'richi' ? 'bg-[#0078d4] text-white border-[#00a4ef] shadow' : 'bg-[#051829] text-sky-200 border-[#0066b3]'}`}>🛍️ Richi</button>
                  <button type="button" onClick={() => setCategoriaPedido('insumos')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all cursor-pointer ${categoriaPedido === 'insumos' ? 'bg-[#0078d4] text-white border-[#00a4ef] shadow' : 'bg-[#051829] text-sky-200 border-[#0066b3]'}`}>🍫 Insumos</button>
                  <button type="button" onClick={() => setCategoriaPedido('aseo')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all cursor-pointer ${categoriaPedido === 'aseo' ? 'bg-[#0078d4] text-white border-[#00a4ef] shadow' : 'bg-[#051829] text-sky-200 border-[#0066b3]'}`}>🧹 Aseo</button>
                </div>

                {categoriaPedido === 'paletas' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-[#0066b3]/50 p-2.5 rounded-xl bg-[#051829]">
                    <span className="text-[10px] text-sky-300 font-bold uppercase block">Seleccionar Sabores a Solicitar:</span>
                    {paletasFiltradas.map((s, idx) => (
                      <div key={s.id} className="bg-[#0e385e] border border-[#0066b3]/60 p-2 rounded-xl flex justify-between items-center gap-2">
                        <div className="truncate">
                          <p className="font-bold text-xs text-white truncate">{s.nombre}</p>
                          <span className="text-[10px] font-semibold text-sky-300 block -mt-0.5 capitalize">
                            {s.grupo || s.categoria || 'Paleta'}
                          </span>
                        </div>
                        <input
                          ref={(el) => { inputsRef.current[`pedido_paleta_${s.id}`] = el; }}
                          type="number"
                          placeholder="0"
                          value={cantidadesPedidoPaletas[s.id] ?? ''}
                          onChange={(e) => handleCantidadPedidoChange(s.id, e.target.value)}
                          onKeyDown={(e) => handleKeyDownPedido(e, idx, paletasFiltradas, 'pedido_paleta')}
                          onFocus={(e) => e.target.select()}
                          className="w-24 bg-[#051829] border border-[#00a4ef]/60 text-sky-200 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {categoriaPedido === 'richi' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-[#0066b3]/50 p-2.5 rounded-xl bg-[#051829]">
                    <span className="text-[10px] text-sky-300 font-bold uppercase block">Empaques / Richi:</span>
                    {richiFiltrados.length === 0 ? (
                      <p className="text-xs text-amber-200 text-center py-4 font-semibold">No hay empaques guardados en la BD.</p>
                    ) : (
                      richiFiltrados.map((item, idx) => (
                        <div key={item.id} className="bg-[#0e385e] border border-[#0066b3]/60 p-2 rounded-xl flex justify-between items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{item.nombre}</span>
                          <input 
                            ref={(el) => { inputsRef.current[`pedido_richi_${item.id}`] = el; }}
                            type="number" 
                            placeholder="0" 
                            value={cantidadesRichi[item.nombre] ?? ''} 
                            onChange={(e) => handleItemGenericoChange(item.nombre, e.target.value, setCantidadesRichi)} 
                            onKeyDown={(e) => handleKeyDownPedido(e, idx, richiFiltrados, 'pedido_richi')}
                            onFocus={(e) => e.target.select()} 
                            className="w-24 bg-[#051829] border border-[#00a4ef]/60 text-sky-200 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {categoriaPedido === 'insumos' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-[#0066b3]/50 p-2.5 rounded-xl bg-[#051829]">
                    <span className="text-[10px] text-sky-300 font-bold uppercase block">Insumos y Toppings:</span>
                    {insumosFiltrados.length === 0 ? (
                      <p className="text-xs text-amber-200 text-center py-4 font-semibold">No hay insumos guardados en la BD.</p>
                    ) : (
                      insumosFiltrados.map((item, idx) => (
                        <div key={item.id} className="bg-[#0e385e] border border-[#0066b3]/60 p-2 rounded-xl flex justify-between items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{item.nombre}</span>
                          <input 
                            ref={(el) => { inputsRef.current[`pedido_ins_${item.id}`] = el; }}
                            type="number" 
                            placeholder="0" 
                            value={cantidadesInsumos[item.nombre] ?? ''} 
                            onChange={(e) => handleItemGenericoChange(item.nombre, e.target.value, setCantidadesInsumos)} 
                            onKeyDown={(e) => handleKeyDownPedido(e, idx, insumosFiltrados, 'pedido_ins')}
                            onFocus={(e) => e.target.select()} 
                            className="w-24 bg-[#051829] border border-[#00a4ef]/60 text-sky-200 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {categoriaPedido === 'aseo' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-[#0066b3]/50 p-2.5 rounded-xl bg-[#051829]">
                    <span className="text-[10px] text-sky-300 font-bold uppercase block">Implementos de Aseo:</span>
                    {aseoFiltrados.length === 0 ? (
                      <p className="text-xs text-amber-200 text-center py-4 font-semibold">No hay artículos de aseo guardados en la BD.</p>
                    ) : (
                      aseoFiltrados.map((item, idx) => (
                        <div key={item.id} className="bg-[#0e385e] border border-[#0066b3]/60 p-2 rounded-xl flex justify-between items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{item.nombre}</span>
                          <input 
                            ref={(el) => { inputsRef.current[`pedido_aseo_${item.id}`] = el; }}
                            type="number" 
                            placeholder="0" 
                            value={cantidadesAseo[item.nombre] ?? ''} 
                            onChange={(e) => handleItemGenericoChange(item.nombre, e.target.value, setCantidadesAseo)} 
                            onKeyDown={(e) => handleKeyDownPedido(e, idx, aseoFiltrados, 'pedido_aseo')}
                            onFocus={(e) => e.target.select()} 
                            className="w-24 bg-[#051829] border border-[#00a4ef]/60 text-sky-200 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* LISTADO DE PEDIDO DE HOY POR CATEGORÍAS CON BOTÓN X */}
                <div className="bg-[#051829] border border-amber-400/40 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-black text-amber-300 uppercase block border-b border-[#0066b3]/40 pb-1">
                    📋 Listado de Pedido Actual (Por Categorías)
                  </span>

                  {(() => {
                    const paletasSeleccionadas = Object.entries(cantidadesPedidoPaletas).filter(([_, cant]) => Number(cant) > 0);
                    const richiSeleccionados = Object.entries(cantidadesRichi).filter(([_, cant]) => Number(cant) > 0);
                    const insumosSeleccionados = Object.entries(cantidadesInsumos).filter(([_, cant]) => Number(cant) > 0);
                    const aseoSeleccionados = Object.entries(cantidadesAseo).filter(([_, cant]) => Number(cant) > 0);
                    const tieneOtro = Boolean(otroInsumoTexto.trim());

                    const totalSeleccionados = paletasSeleccionadas.length + richiSeleccionados.length + insumosSeleccionados.length + aseoSeleccionados.length + (tieneOtro ? 1 : 0);

                    if (totalSeleccionados === 0) {
                      return <p className="text-[11px] text-sky-400 italic text-center py-2">No hay productos agregados al pedido todavía.</p>;
                    }

                    return (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 text-xs">
                        {paletasSeleccionadas.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-sky-300 block">🍦 Paletas:</span>
                            {paletasSeleccionadas.map(([saborId, cant]) => {
                              const sObj = saboresViva.find((s) => s.id === Number(saborId));
                              return (
                                <div key={saborId} className="flex justify-between items-center bg-[#0e385e] px-2.5 py-1 rounded-lg border border-[#0066b3]/40">
                                  <span className="text-white truncate">{sObj?.nombre || 'Sabor'} <b className="text-emerald-300">x{cant}</b></span>
                                  <button
                                    type="button"
                                    onClick={() => setCantidadesPedidoPaletas((prev) => ({ ...prev, [saborId]: '' }))}
                                    className="text-rose-400 hover:text-rose-200 font-black px-1.5 py-0.5 rounded text-[11px] cursor-pointer"
                                    title="Borrar producto"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {richiSeleccionados.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-sky-300 block">🛍️ Richi / Empaques:</span>
                            {richiSeleccionados.map(([nombre, cant]) => (
                              <div key={nombre} className="flex justify-between items-center bg-[#0e385e] px-2.5 py-1 rounded-lg border border-[#0066b3]/40">
                                <span className="text-white truncate">{nombre} <b className="text-emerald-300">x{cant}</b></span>
                                <button
                                  type="button"
                                  onClick={() => setCantidadesRichi((prev) => ({ ...prev, [nombre]: '' }))}
                                  className="text-rose-400 hover:text-rose-200 font-black px-1.5 py-0.5 rounded text-[11px] cursor-pointer"
                                  title="Borrar producto"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {insumosSeleccionados.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-sky-300 block">🍫 Insumos:</span>
                            {insumosSeleccionados.map(([nombre, cant]) => (
                              <div key={nombre} className="flex justify-between items-center bg-[#0e385e] px-2.5 py-1 rounded-lg border border-[#0066b3]/40">
                                <span className="text-white truncate">{nombre} <b className="text-emerald-300">x{cant}</b></span>
                                <button
                                  type="button"
                                  onClick={() => setCantidadesInsumos((prev) => ({ ...prev, [nombre]: '' }))}
                                  className="text-rose-400 hover:text-rose-200 font-black px-1.5 py-0.5 rounded text-[11px] cursor-pointer"
                                  title="Borrar producto"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {aseoSeleccionados.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-sky-300 block">🧹 Aseo:</span>
                            {aseoSeleccionados.map(([nombre, cant]) => (
                              <div key={nombre} className="flex justify-between items-center bg-[#0e385e] px-2.5 py-1 rounded-lg border border-[#0066b3]/40">
                                <span className="text-white truncate">{nombre} <b className="text-emerald-300">x{cant}</b></span>
                                <button
                                  type="button"
                                  onClick={() => setCantidadesAseo((prev) => ({ ...prev, [nombre]: '' }))}
                                  className="text-rose-400 hover:text-rose-200 font-black px-1.5 py-0.5 rounded text-[11px] cursor-pointer"
                                  title="Borrar producto"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {tieneOtro && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-sky-300 block">✏️ Otro Adicional:</span>
                            <div className="flex justify-between items-center bg-[#0e385e] px-2.5 py-1 rounded-lg border border-[#0066b3]/40">
                              <span className="text-white truncate">{otroInsumoTexto}</span>
                              <button
                                type="button"
                                onClick={() => setOtroInsumoTexto('')}
                                className="text-rose-400 hover:text-rose-200 font-black px-1.5 py-0.5 rounded text-[11px] cursor-pointer"
                                title="Borrar producto"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <input type="text" placeholder="Otro producto adicional..." value={otroInsumoTexto} onChange={(e) => setOtroInsumoTexto(e.target.value)} className="w-full bg-[#051829] border border-[#0066b3] text-white p-2.5 rounded-xl outline-none text-xs focus:border-[#00a4ef]" />
                <input type="text" placeholder="Observación general del pedido..." value={obsPedido} onChange={(e) => setObsPedido(e.target.value)} className="w-full bg-[#051829] border border-[#0066b3] text-white p-2.5 rounded-xl outline-none text-xs focus:border-[#00a4ef]" />

                <button onClick={handleGuardarPedidoInsumos} disabled={guardando} className="w-full bg-[#0078d4] hover:bg-[#0086e6] text-white font-black py-2.5 rounded-xl text-xs uppercase transition-all shadow-md cursor-pointer disabled:opacity-50">
                  {guardando ? 'Guardando pedido...' : '🚀 Enviar Pedido a Bodega'}
                </button>
              </div>
            )}
          </div>

          {/* ARQUEO DE CAJA Y NÓMINA */}
          <div className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-4 shadow-md">
            <h2 className="text-xs md:text-sm font-black text-white border-b border-[#0066b3]/50 pb-2 flex justify-between">
              <span>{esTurnoCierre ? '🌙 Cierre de Jornada y Arqueo' : '👥 Cambio de Turno / Arqueo y Nómina'}</span>
              <span className="text-[10px] text-sky-200 font-bold bg-[#003d6d] px-2 py-0.5 rounded-md border border-[#0066b3]">{esTurnoCierre ? 'Fin de Día' : 'Fin de Turno'}</span>
            </h2>

            <div className="space-y-2 bg-[#051829] p-3 rounded-xl border border-[#0066b3]">
              <span className="text-[10px] font-black text-sky-300 uppercase block">1. Nómina del Operador:</span>
              
              <div>
                <label className="text-[10px] text-sky-200 font-bold block mb-1">Tipo de Día:</label>
                <select value={tipoDia} onChange={(e) => setTipoDia(e.target.value as any)} className="w-full bg-[#0e385e] border border-[#0066b3] text-white font-bold text-xs rounded-xl p-2 outline-none cursor-pointer focus:border-[#00a4ef]">
                  <option value="entre_semana">Entre semana (lunes a sábado)</option>
                  <option value="domingo_festivo">Domingo / Festivo</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-sky-200 block mb-1 font-bold">Horas Día</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_horas_dia'] = el; }}
                    type="number" 
                    placeholder="0" 
                    value={horasDia} 
                    onChange={(e) => setHorasDia(e.target.value === '' ? '' : Number(e.target.value))} 
                    onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_horas_noche')}
                    onFocus={(e) => e.target.select()} 
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-white font-bold text-center rounded-lg p-2 outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                </div>
                <div>
                  <span className="text-sky-200 block mb-1 font-bold">Horas Noche</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_horas_noche'] = el; }}
                    type="number" 
                    placeholder="0" 
                    value={horasNoche} 
                    onChange={(e) => setHorasNoche(e.target.value === '' ? '' : Number(e.target.value))} 
                    onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_efectivo')}
                    onFocus={(e) => e.target.select()} 
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-white font-bold text-center rounded-lg p-2 outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                </div>
              </div>

              <div className="flex justify-between items-center bg-rose-950/60 p-2 rounded-lg border border-rose-500/50 text-xs font-bold text-rose-200">
                <span>Total Nómina:</span>
                <span className="text-sm font-black text-rose-300">$ {totalNomina.toLocaleString('es-CO')}</span>
              </div>
            </div>

            <div className="space-y-2 bg-[#051829] p-3 rounded-xl border border-[#0066b3]">
              <span className="text-[10px] font-black text-emerald-300 uppercase block">
                2. DINERO EN CAJA / ARQUEO ({esTurnoCierre ? 'CIERRE DE DÍA' : 'ENTREGA DE TURNO'}):
              </span>
              
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <span className="text-emerald-300 block mb-1 font-bold">💵 Efectivo ($)</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_efectivo'] = el; }}
                    type="text" 
                    placeholder="$ 0" 
                    value={formatearMoneda(efectivoCaja)} 
                    onChange={(e) => setEfectivoCaja(desformatearMoneda(e.target.value))} 
                    onKeyDown={(e) => handleKeyDownCierre(e, esTurnoCierre ? 'cierre_nequi' : 'cierre_gastos')}
                    onFocus={(e) => e.target.select()} 
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-emerald-300 font-bold text-center rounded-lg p-2 outline-none focus:border-emerald-400" 
                  />
                </div>
                <div>
                  <span className={`block mb-1 font-bold ${esTurnoCierre ? 'text-sky-200' : 'text-slate-500'}`}>📲 Nequi ($)</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_nequi'] = el; }}
                    type="text" 
                    placeholder={esTurnoCierre ? "$ 0" : "N/A (Sólo Cierre)"} 
                    value={esTurnoCierre ? formatearMoneda(nequi) : ''} 
                    onChange={(e) => setNequi(desformatearMoneda(e.target.value))} 
                    disabled={!esTurnoCierre}
                    onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_daviplata')}
                    onFocus={(e) => e.target.select()} 
                    className={`w-full border font-bold text-center rounded-lg p-2 outline-none ${
                      esTurnoCierre 
                        ? 'bg-[#0e385e] border-[#0066b3] text-sky-200 focus:border-[#00a4ef]' 
                        : 'bg-[#051829] border-[#003d6d] text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
                <div>
                  <span className={`block mb-1 font-bold ${esTurnoCierre ? 'text-fuchsia-300' : 'text-slate-500'}`}>📱 Daviplata ($)</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_daviplata'] = el; }}
                    type="text" 
                    placeholder={esTurnoCierre ? "$ 0" : "N/A (Sólo Cierre)"} 
                    value={esTurnoCierre ? formatearMoneda(daviplata) : ''} 
                    onChange={(e) => setDaviplata(desformatearMoneda(e.target.value))} 
                    disabled={!esTurnoCierre}
                    onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_gastos')}
                    onFocus={(e) => e.target.select()} 
                    className={`w-full border font-bold text-center rounded-lg p-2 outline-none ${
                      esTurnoCierre 
                        ? 'bg-[#0e385e] border-[#0066b3] text-fuchsia-200 focus:border-fuchsia-400' 
                        : 'bg-[#051829] border-[#003d6d] text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
                <div>
                  <span className="text-amber-300 block mb-1 font-bold">🧾 Total Gastos ($)</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_gastos'] = el; }}
                    type="text" 
                    placeholder="$ 0" 
                    value={formatearMoneda(gastos)} 
                    onChange={(e) => setGastos(desformatearMoneda(e.target.value))} 
                    onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_motivo_gasto')}
                    onFocus={(e) => e.target.select()} 
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-amber-300 font-bold text-center rounded-lg p-2 outline-none focus:border-amber-400" 
                  />
                </div>
                <div>
                  <span className="text-sky-200 block mb-1 font-bold">📝 Motivo del Gasto</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_motivo_gasto'] = el; }}
                    type="text" 
                    placeholder="Ej. Compra de hielo, bolsas..." 
                    value={motivoGasto} 
                    onChange={(e) => setMotivoGasto(e.target.value)} 
                    onFocus={(e) => e.target.select()} 
                    className="w-full bg-[#0e385e] border border-[#0066b3] text-white text-xs rounded-lg p-2 outline-none focus:border-[#00a4ef]" 
                  />
                </div>
              </div>

              <div className="flex justify-between items-center bg-[#0e385e] p-2.5 rounded-xl border border-emerald-400/50 text-xs font-bold mt-2">
                <span className="text-emerald-300 uppercase font-black">
                  {esTurnoCierre ? 'Total Recaudado (Ventas):' : 'Efectivo en Caja:'}
                </span>
                <span className="text-base font-black text-emerald-300 bg-[#051829] px-3 py-1 rounded-lg border border-emerald-500/50">
                  $ {(esTurnoCierre ? totalVentasCalculado : Number(efectivoCaja) || 0).toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            <button
              onClick={handleGuardarNominaTurno}
              disabled={guardando || (esTurnoCierre && !cierreRealizado)}
              className={`w-full font-black py-3 rounded-xl text-xs md:text-sm transition-all shadow-md cursor-pointer ${
                esTurnoCierre && !cierreRealizado
                  ? 'bg-[#051829] text-sky-400/40 cursor-not-allowed border border-[#003d6d]'
                  : 'bg-[#0078d4] hover:bg-[#0086e6] text-white shadow-[#003d6d]'
              }`}
            >
              {guardando
                ? 'Guardando...'
                : esTurnoCierre
                ? cierreRealizado
                  ? '🌙 Registrar Cierre Final, Caja y Nómina'
                  : '⚠️ Haz el Conteo de Cierre Primero'
                : '💾 Registrar Nómina y Cambio de Turno'}
            </button>
          </div>

        </div>
      </div>

      {/* MODAL CREAR NUEVO PRODUCTO / INSUMO */}
      {mostrarModalNuevoProd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b2b48] border-2 border-emerald-400 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2">
              <h3 className="text-sm font-black text-white uppercase">➕ Crear Nuevo Insumo / Producto</h3>
              <button
                onClick={() => setMostrarModalNuevoProd(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-sky-200 font-bold block mb-1">Nombre del Insumo *:</label>
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
                    className="w-full bg-[#051829] border border-[#0066b3] text-white text-xs p-2.5 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="Paleta">🍦 Paleta</option>
                    <option value="Richi">📦 Richi / Empaque</option>
                    <option value="Produccion">⚙️ Producción</option>
                    <option value="Insumos">🍫 Insumos / Toppings</option>
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
                  <option value="local">🏢 Exclusivo de Sede Viva</option>
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

      {/* MODAL CAMBIO DE TURNO */}
      {mostrarModalCambioTurno && (
        <div className="fixed inset-0 bg-[#051829]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border border-[#0066b3] p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl text-center">
            
            <div className="space-y-1 border-b border-[#0066b3]/50 pb-3">
              <div className="w-12 h-12 bg-[#003d6d] border border-[#0066b3] rounded-2xl flex items-center justify-center mx-auto mb-2 text-xl shadow-lg">
                🔄
              </div>
              <h3 className="text-lg font-black text-white tracking-wide">
                Recepción de Turno — Walers Viva
              </h3>
              <p className="text-xs text-sky-200 font-medium">
                Selecciona al operario entrante e ingresa sus credenciales
              </p>
            </div>

            <div className="space-y-3 text-left">
              <div>
                <label className="text-[11px] font-extrabold text-sky-200 block mb-1 uppercase tracking-wider">
                  ¿Qué turno recibo?
                </label>
                <select
                  value={turnoRecibido}
                  onChange={(e) => setTurnoRecibido(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold text-xs rounded-xl p-3 outline-none cursor-pointer focus:border-[#00a4ef]"
                >
                  <option value="tarde">🌙 Tarde / Cierre</option>
                  <option value="manana">🌅 Mañana / Apertura</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-sky-200 block mb-1 uppercase tracking-wider">
                  Operario que Recibe:
                </label>
                <select
                  value={operarioEntranteId}
                  onChange={(e) => setOperarioEntranteId(e.target.value)}
                  className="w-full bg-[#051829] border border-[#0066b3] text-white font-bold text-xs rounded-xl p-3 outline-none cursor-pointer focus:border-[#00a4ef]"
                >
                  <option value="">-- Seleccionar Operario --</option>
                  {listaOperarios.map((op) => (
                    <option key={op.id} value={op.id}>
                      👤 {op.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-sky-200 block mb-1 uppercase tracking-wider">
                  Contraseña / PIN:
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={claveOperarioEntrante}
                  onChange={(e) => setClaveOperarioEntrante(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-[#051829] border border-[#0066b3] text-sky-200 font-black text-center text-lg rounded-xl p-2.5 outline-none tracking-widest focus:border-[#00a4ef]"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMostrarModalCambioTurno(false)}
                className="w-1/3 bg-[#051829] hover:bg-[#0e385e] text-sky-200 font-bold py-3 rounded-xl text-xs transition-colors border border-[#0066b3] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEntrante}
                disabled={validandoEntrante}
                className="w-2/3 bg-[#0078d4] hover:bg-[#0086e6] text-white font-black py-3 rounded-xl text-xs transition-all uppercase shadow-lg shadow-[#003d6d] cursor-pointer"
              >
                {validandoEntrante ? 'Validando...' : '🔑 Iniciar Nuevo Turno'}
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}