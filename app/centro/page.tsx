'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAutoSave } from '@/hooks/useAutoSave';
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

export default function CentroPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);

  // IDENTIFICADOR DE LA SEDE CENTRO
  const SEDE_ID_CENTRO = 2;

  // ESTADO DE TARIFAS
  const [tarifas, setTarifas] = useState({
    subsidio: 0,
    transporte: 0,
    horaDiaEntreSemana: 0,
    horaNocheEntreSemana: 0,
    horaDiaFestivo: 0,
    horaNocheFestivo: 0,
  });

  // AUTO-SAVE: Base de Caja
  const [baseCaja, setBaseCaja, limpiarBaseCaja] = useAutoSave<number | ''>('centro_baseCaja', '');
  const [baseGuardada, setBaseGuardada] = useState(false);
  const [cajaIdActual, setCajaIdActual] = useState<number | null>(null);
  const [aperturaRealizada, setAperturaRealizada] = useState(false);
  const [cierreRealizado, setCierreRealizado] = useState(false);
  
  // EFECTIVO ENTREGADO EN CAMBIO DE TURNO (VISUAL)
  const [efectivoTurnoManana, setEfectivoTurnoManana] = useState<number | null>(null);

  // AUTO-SAVE: Inventario por items dinámicos desde inventario_empaques_sedes (sede_id = 2)
  const [tipoMovimiento, setTipoMovimiento] = useState<string>('apertura');
  const [inventarioSedeItems, setInventarioSedeItems] = useState<any[]>([]);
  const [cantidadesInventarioSede, setCantidadesInventarioSede, limpiarCantidadesInvSede] = useAutoSave<{ [nombreItem: string]: number | '' }>('centro_cantidadesInventarioSede', {});
  const [observaciones, setObservaciones, limpiarObsInv] = useAutoSave<string>('centro_observacionesInv', '');

  // AUDITORÍA / HISTORIAL DE MOVIMIENTOS Y VENTAS
  const [, setMovimientosDiaBD] = useState<any[]>([]);
  const [ventasDiaBD, setVentasDiaBD] = useState<any[]>([]);
  const [registrosNominaDia, setRegistrosNominaDia] = useState<any[]>([]);

  // AUTO-SAVE: Requisición de Pedidos (Insumos desde la tabla 'producto')
  const [mostrarModuloPedidos, setMostrarModuloPedidos] = useState(false);
  const [categoriaPedido, setCategoriaPedido] = useState<string>('');
  const [cantidadesPedido, setCantidadesPedido, limpiarCantidadesPedido] = useAutoSave<{ [item: string]: number | '' }>('centro_pedidos_cantidades', {});
  const [otroInsumoTexto, setOtroInsumoTexto, limpiarOtroInsumo] = useAutoSave<string>('centro_otroInsumo', '');
  const [obsPedido, setObsPedido, limpiarObsPedido] = useAutoSave<string>('centro_obsPedido', '');

  // ESTADOS MODAL CREAR NUEVO PRODUCTO / INSUMO EN BD
  const [productosInsumosBD, setProductosInsumosBD] = useState<any[]>([]);
  const [mostrarModalNuevoProd, setMostrarModalNuevoProd] = useState(false);
  const [nuevoProdNombre, setNuevoProdNombre] = useState('');
  const [nuevoProdCategoria, setNuevoProdCategoria] = useState('Paleta');
  const [nuevoProdGrupo, setNuevoProdGrupo] = useState('');
  const [nuevoProdDondeComprar, setNuevoProdDondeComprar] = useState('');
  const [dondeComprarPersonalizado, setDondeComprarPersonalizado] = useState('');
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  // NUEVOS ESTADOS PARA SEDES DESDE LA TABLA 'sede'
  const [, setListaSedesBD] = useState<any[]>([]);
  const [sedesSeleccionadasProd, setSedesSeleccionadasProd] = useState<(number | string)[]>([]);

  // NÓMINA Y ARQUEO DE CAJA EN CENTRO
  const [tipoDia, setTipoDia] = useState<'entre_semana' | 'domingo_festivo'>('entre_semana');
  const [horasDia, setHorasDia, limpiarHorasDia] = useAutoSave<number | ''>('centro_horasDia', '');
  const [horasNoche, setHorasNoche, limpiarHorasNoche] = useAutoSave<number | ''>('centro_horasNoche', '');
  
  // CAMPOS DE EFECTIVO
  const [efectivoSistema, setEfectivoSistema, limpiarEfSistema] = useAutoSave<number | ''>('centro_efectivoSistema', '');
  const [efectivoFisico, setEfectivoFisico, limpiarEfFisico] = useAutoSave<number | ''>('centro_efectivoFisico', '');
  
  const [nequi, setNequi, limpiarNequi] = useAutoSave<number | ''>('centro_nequi', '');
  const [daviplata, setDaviplata, limpiarDaviplata] = useAutoSave<number | ''>('centro_daviplata', '');
  const [gastos, setGastos, limpiarGastos] = useAutoSave<number | ''>('centro_gastos', '');
  const [motivoGasto, setMotivoGasto, limpiarMotivoGasto] = useAutoSave<string>('centro_motivoGasto', '');

  // MODAL RESUMEN Y AUDITORÍA DE CIERRE TOTAL
  const [mostrarModalResumen, setMostrarModalResumen] = useState(false);
  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [guardandoNomina, setGuardandoNomina] = useState(false);

  // MODAL CAMBIO DE TURNO
  const [mostrarModalCambioTurno, setMostrarModalCambioTurno] = useState(false);
  const [listaOperarios, setListaOperarios] = useState<any[]>([]);
  const [operarioEntranteId, setOperarioEntranteId] = useState<string>('');
  const [claveOperarioEntrante, setClaveOperarioEntrante] = useState<string>('');
  const [turnoRecibido, setTurnoRecibido] = useState<string>('tarde/cierre');
  const [validandoEntrante, setValidandoEntrante] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const inputsRef = useRef<{ [key: string]: HTMLInputElement | HTMLTextAreaElement | null }>({});

  const hDia = Number(horasDia) || 0;
  const hNoche = Number(horasNoche) || 0;
  const valorHoraDia = tipoDia === 'domingo_festivo' ? tarifas.horaDiaFestivo : tarifas.horaDiaEntreSemana;
  const valorHoraNoche = tipoDia === 'domingo_festivo' ? tarifas.horaNocheFestivo : tarifas.horaNocheEntreSemana;
  const totalNomina = (hDia > 0 || hNoche > 0 ? tarifas.subsidio + tarifas.transporte : 0) + hDia * valorHoraDia + hNoche * valorHoraNoche;

  const usuarioIdActual = sesion?.usuario_id || sesion?.id || null;
  const nominaYaPagadaHoy = registrosNominaDia.some(
    (n) => String(n.usuario_id) === String(usuarioIdActual)
  );

  const tienePedidoSinEnviar = (() => {
    const cantidadesCount = Object.values(cantidadesPedido).reduce((acc: number, c) => acc + (Number(c) || 0), 0);
    const tieneOtro = Boolean(otroInsumoTexto.trim());
    return cantidadesCount > 0 || tieneOtro;
  })();

  const categoriasDinamicas = Array.from(
    new Set(
      productosInsumosBD
        .filter((p) => Number(p.sede_id) === SEDE_ID_CENTRO || p.sede_id === 0 || !p.sede_id)
        .map((p) => String(p.categoria || p.Categoria || 'General').trim())
        .filter((cat) => cat !== '')
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  useEffect(() => {
    if (categoriasDinamicas.length > 0 && (!categoriaPedido || !categoriasDinamicas.includes(categoriaPedido))) {
      setCategoriaPedido(categoriasDinamicas[0]);
    }
  }, [categoriasDinamicas, categoriaPedido]);

  const productosCategoriaFiltrados = productosInsumosBD
    .filter((p) => {
      const cat = String(p.categoria || p.Categoria || 'General').trim();
      const perteneceSede = Number(p.sede_id) === SEDE_ID_CENTRO || p.sede_id === 0 || !p.sede_id;
      return perteneceSede && cat.toLowerCase() === categoriaPedido.toLowerCase();
    })
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

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

    try {
      const hoyInicio = new Date();
      hoyInicio.setHours(0, 0, 0, 0);

      const { data: cajaHoyBD } = await supabase
        .from('caja')
        .select('*')
        .eq('sede_id', SEDE_ID_CENTRO)
        .gte('fecha', hoyInicio.toISOString())
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
        .eq('sede_id', SEDE_ID_CENTRO)
        .gte('fecha_registro', hoyInicio.toISOString())
        .ilike('tipo_movimiento', 'apertura')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invHoyBD) {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
      } else {
        setAperturaRealizada(false);
        setTipoMovimiento('apertura');
      }

      const { data: movsBD } = await supabase
        .from('inventario_diario')
        .select('*')
        .eq('sede_id', SEDE_ID_CENTRO)
        .gte('fecha_registro', hoyInicio.toISOString());

      if (movsBD) {
        setMovimientosDiaBD(
          movsBD.map((m: any) => ({
            tipo: m.tipo_movimiento,
            totalPaletas: m.total_paletas,
            detallePaletas: m.detalle_paletas || {},
            detalleEmpaques: m.detalle_empaques || {},
          }))
        );
      }

      const { data: vtsBD } = await supabase
        .from('venta')
        .select('*')
        .eq('sede_id', SEDE_ID_CENTRO)
        .gte('fecha', hoyInicio.toISOString());

      if (vtsBD) {
        setVentasDiaBD(vtsBD);
      }

      const { data: nomBD } = await supabase
        .from('nomina')
        .select('*')
        .eq('sede_id', SEDE_ID_CENTRO)
        .gte('fecha', hoyInicio.toISOString());

      if (nomBD) {
        setRegistrosNominaDia(nomBD);
      }

      const { data: sedesBD } = await supabase
        .from('sede')
        .select('*')
        .order('nombre', { ascending: true });

      if (sedesBD && sedesBD.length > 0) {
        setListaSedesBD(sedesBD);
        setSedesSeleccionadasProd([SEDE_ID_CENTRO]);
      } else {
        setListaSedesBD([
          { id: 1, nombre: 'Viva' },
          { id: SEDE_ID_CENTRO, nombre: 'Centro' },
          { id: 4, nombre: 'Martineto' }
        ]);
        setSedesSeleccionadasProd([SEDE_ID_CENTRO]);
      }

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
      }

      const { data: operariosBD } = await supabase
        .from('usuario')
        .select('*');

      if (operariosBD) {
        const operariosOrdenados = [...operariosBD].sort((a: any, b: any) =>
          (a.nombre_completo || a.nombre || '').localeCompare(b.nombre_completo || b.nombre || '', 'es', { sensitivity: 'base' })
        );
        setListaOperarios(operariosOrdenados);
      }

      const { data: invEmpaquesSedesBD } = await supabase
        .from('inventario_empaques_sedes')
        .select('*')
        .eq('sede_id', SEDE_ID_CENTRO)
        .order('nombre', { ascending: true });

      if (invEmpaquesSedesBD) {
        setInventarioSedeItems(invEmpaquesSedesBD);
      }

      const { data: prodsInsumosBD } = await supabase
        .from('producto')
        .select('*')
        .or(`sede_id.eq.${SEDE_ID_CENTRO},sede_id.eq.0,sede_id.is.null`);

      if (prodsInsumosBD) {
        const mapeados = prodsInsumosBD.map((p: any) => ({
          ...p,
          nombre: p.nombre || p.Nombre || '',
          categoria: p.categoria || p.Categoria || 'General',
          grupoLimpio: String(p.grupo || p.Grupo || '').trim().toLowerCase(),
          donde_comprar: p.donde_comprar || '',
        })).sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

        setProductosInsumosBD(mapeados);
      }
    } catch (error) {
      console.error('Error cargando datos iniciales en Centro:', error);
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

    if (!nombreLimpio || !dondeComprarFinal) {
      alert('⚠️ Nombre y lugar de compra son obligatorios.');
      return;
    }

    if (sedesSeleccionadasProd.length === 0) {
      alert('⚠️ Debes seleccionar al menos una sede.');
      return;
    }

    setGuardandoProducto(true);

    const grupoAInsertar =
      nuevoProdCategoria === 'Paleta'
        ? nuevoProdGrupo.trim() || 'Paleta'
        : nuevoProdCategoria;

    const arregloNuevosProductos = sedesSeleccionadasProd.map((sId) => ({
      nombre: nombreLimpio,
      categoria: nuevoProdCategoria,
      grupo: grupoAInsertar,
      donde_comprar: dondeComprarFinal,
      sede_id: Number(sId),
      activo: true,
    }));

    const { data, error } = await supabase.from('producto').insert(arregloNuevosProductos).select();

    if (error) {
      alert('Error guardando en la base de datos: ' + error.message);
      setGuardandoProducto(false);
      return;
    }

    alert(`✅ ¡Insumo "${nombreLimpio}" creado con éxito para ${sedesSeleccionadasProd.length} sede(s)!`);
    if (data && data.length > 0) {
      const nuevosFormateados = data.map((d: any) => ({
        ...d,
        nombre: d.nombre,
        categoria: d.categoria || 'General',
        grupoLimpio: String(d.grupo || '').trim().toLowerCase(),
        donde_comprar: d.donde_comprar || '',
      }));

      setProductosInsumosBD((prev) => [...prev, ...nuevosFormateados].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })));
    }

    setNuevoProdNombre('');
    setNuevoProdGrupo('');
    setDondeComprarPersonalizado('');
    setSedesSeleccionadasProd([SEDE_ID_CENTRO]);
    setMostrarModalNuevoProd(false);
    setGuardandoProducto(false);
  }

  function handleInventarioItemChange(nombreItem: string, rawVal: string) {
    const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
    setCantidadesInventarioSede((prev) => ({ ...prev, [nombreItem]: val }));
  }

  function handleKeyDownInventarioItem(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < inventarioSedeItems.length - 1) {
        const siguienteItem = inventarioSedeItems[index + 1];
        inputsRef.current[`inv_item_${siguienteItem.nombre}`]?.focus();
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

  function handleItemPedidoChange(nombreItem: string, rawVal: string) {
    const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
    setCantidadesPedido((prev) => ({ ...prev, [nombreItem]: val }));
  }

  async function handleGuardarBase() {
    const monto = baseCaja === '' ? 0 : Number(baseCaja);
    if (monto <= 0) {
      alert('Ingresa un valor válido para la base inicial.');
      return;
    }

    const sesionActual = sesion || JSON.parse(localStorage.getItem('martineto_session') || '{}');
    const usuarioId = sesionActual?.usuario_id || sesionActual?.id;
    const sedeId = SEDE_ID_CENTRO;
    const turnoId = sesionActual?.turno_id || sesionActual?.turnoId || null;

    if (!usuarioId) {
      alert('⚠️ No hay sesión de usuario válida.');
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase.from('caja').insert([
        {
          sede_id: sedeId,
          usuario_id: usuarioId ? Number(usuarioId) : null,
          turno_id: turnoId,
          monto_apertura: monto,
          diferencia: 0,
          estado: 'abierta',
          fecha: new Date().toISOString(),
        },
      ]).select();

      if (!error && data && data.length > 0) {
        setBaseGuardada(true);
        setCajaIdActual(data[0].id);
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

    const usuarioId = sesion?.usuario_id || sesion?.id || 1;
    const sedeId = SEDE_ID_CENTRO;

    setGuardando(true);
    try {
      let diferenciaPaletasJson: { [key: string]: number } = {};
      let diferenciaEmpaquesJson: { [key: string]: number } = {};
      let sumaTotalDiferencia = 0;
      let totalPaletasSumaCalculado = 0;

      const itemsEntrada = Object.entries(cantidadesInventarioSede);
      for (const [nombreItem, cantidadFisicaRaw] of itemsEntrada) {
        const cantidadIngresada = Number(cantidadFisicaRaw) || 0;
        if (cantidadIngresada <= 0 && tipoMovimiento !== 'apertura' && tipoMovimiento !== 'cierre') continue;

        const regItemBD = inventarioSedeItems.find((i) => i.nombre === nombreItem);
        const stockViejo = regItemBD ? Number(regItemBD.stock) : 0;
        let nuevoStock = stockViejo;

        if (nombreItem.toLowerCase().includes('paleta') || regItemBD?.tipo === 'paleta') {
          totalPaletasSumaCalculado += cantidadIngresada;
        }

        if (tipoMovimiento === 'apertura') {
          nuevoStock = cantidadIngresada;
          const difCalculada = cantidadIngresada - stockViejo;
          if (nombreItem.toLowerCase().includes('paleta') || regItemBD?.tipo === 'paleta') {
            diferenciaPaletasJson[nombreItem] = difCalculada;
          } else {
            diferenciaEmpaquesJson[nombreItem] = difCalculada;
          }
          sumaTotalDiferencia += Math.abs(difCalculada);

          await supabase
            .from('inventario_empaques_sedes')
            .update({ stock: nuevoStock, diferencia: difCalculada, fecha_actualizacion: new Date().toISOString() })
            .eq('sede_id', sedeId)
            .eq('nombre', nombreItem);

        } else if (tipoMovimiento === 'nuevas' || tipoMovimiento === 'compras') {
          nuevoStock = stockViejo + cantidadIngresada;
          await supabase
            .from('inventario_empaques_sedes')
            .update({ stock: nuevoStock, fecha_actualizacion: new Date().toISOString() })
            .eq('sede_id', sedeId)
            .eq('nombre', nombreItem);

        } else if (tipoMovimiento === 'debaja') {
          nuevoStock = Math.max(0, stockViejo - cantidadIngresada);
          await supabase
            .from('inventario_empaques_sedes')
            .update({ stock: nuevoStock, fecha_actualizacion: new Date().toISOString() })
            .eq('sede_id', sedeId)
            .eq('nombre', nombreItem);

        } else if (tipoMovimiento === 'cierre') {
          nuevoStock = cantidadIngresada;
          const vendidasCalculadas = Math.max(0, stockViejo - cantidadIngresada);
          await supabase
            .from('inventario_empaques_sedes')
            .update({ stock: nuevoStock, vendidas: vendidasCalculadas, fecha_actualizacion: new Date().toISOString() })
            .eq('sede_id', sedeId)
            .eq('nombre', nombreItem);
        }
      }

      if (tipoMovimiento === 'apertura') {
        await supabase.from('diferencia_inventario').insert([
          {
            sede_id: sedeId,
            usuario_id: usuarioId,
            diferencia_paletas: diferenciaPaletasJson,
            diferencia_empaques: diferenciaEmpaquesJson,
            total_diferencia: sumaTotalDiferencia,
            fecha_registro: new Date().toISOString(),
          },
        ]);
      }

      const detallePaletasObj: { [nombre: string]: number } = {};
      const detalleEmpaquesObj: { [nombre: string]: number } = {};

      itemsEntrada.forEach(([nombreItem, cant]) => {
        const num = Number(cant) || 0;
        if (num > 0) {
          const regItemBD = inventarioSedeItems.find((i) => i.nombre === nombreItem);
          if (nombreItem.toLowerCase().includes('paleta') || regItemBD?.tipo === 'paleta') {
            detallePaletasObj[nombreItem] = num;
          } else {
            detalleEmpaquesObj[nombreItem] = num;
          }
        }
      });

      const payloadInventario: any = {
        sede_id: sedeId,
        usuario_id: usuarioId,
        tipo_movimiento: tipoMovimiento,
        total_paletas: totalPaletasSumaCalculado,
        detalle_paletas: detallePaletasObj,
        detalle_empaques: detalleEmpaquesObj,
        observacion: observaciones || null,
      };

      if (sesion?.turno_id && !isNaN(Number(sesion.turno_id))) {
        payloadInventario.turno_id = Number(sesion.turno_id);
      }

      if (tipoMovimiento === 'cierre') {
        const hoyInicioInv = new Date();
        hoyInicioInv.setHours(0, 0, 0, 0);

        const { data: regExistenteCierre } = await supabase
          .from('inventario_diario')
          .select('id')
          .eq('sede_id', sedeId)
          .gte('fecha_registro', hoyInicioInv.toISOString())
          .ilike('tipo_movimiento', 'cierre')
          .maybeSingle();

        if (regExistenteCierre) {
          await supabase
            .from('inventario_diario')
            .update({
              total_paletas: totalPaletasSumaCalculado,
              detalle_paletas: detallePaletasObj,
              detalle_empaques: detalleEmpaquesObj,
              observacion: observaciones || null,
            })
            .eq('id', regExistenteCierre.id);
        } else {
          await supabase.from('inventario_diario').insert([payloadInventario]);
        }
        setCierreRealizado(true);
      } else {
        await supabase.from('inventario_diario').insert([payloadInventario]);
        if (tipoMovimiento === 'apertura') {
          setAperturaRealizada(true);
          setTipoMovimiento('nuevas');
        }
      }

      setGuardando(false);
      alert(`✅ ¡Inventario (${tipoMovimiento.toUpperCase()}) guardado con éxito!`);

      limpiarCantidadesInvSede();
      limpiarObsInv();

      const { data: invEmpaquesSedesBD } = await supabase
        .from('inventario_empaques_sedes')
        .select('*')
        .eq('sede_id', SEDE_ID_CENTRO)
        .order('nombre', { ascending: true });

      if (invEmpaquesSedesBD) {
        setInventarioSedeItems(invEmpaquesSedesBD);
      }

    } catch (err: any) {
      setGuardando(false);
      alert(`❌ Error inesperado: ${err?.message || 'Error de conexión'}`);
    }
  }

  async function handleGuardarPedidoInsumos() {
    setGuardando(true);

    const pedidosDesglosadosObj: { [key: string]: number } = {};
    Object.entries(cantidadesPedido).forEach(([item, cant]) => {
      if (Number(cant) > 0) pedidosDesglosadosObj[item] = Number(cant);
    });

    if (otroInsumoTexto.trim()) pedidosDesglosadosObj[`Otro: ${otroInsumoTexto.trim()}`] = 1;

    if (Object.keys(pedidosDesglosadosObj).length === 0) {
      alert('Ingresa al menos una cantidad para realizar el pedido.');
      setGuardando(false);
      return;
    }

    const usuarioId = sesion?.usuario_id || sesion?.id || 1;
    const sedeId = SEDE_ID_CENTRO;

    try {
      const { error } = await supabase.from('pedidos_insumos').insert([
        {
          sede_id: sedeId,
          usuario_id: usuarioId,
          estado: 'pendiente',
          pedidos_insumos: pedidosDesglosadosObj,
          observaciones: obsPedido || null,
          fecha: new Date().toISOString(),
        },
      ]);

      if (!error) {
        alert('¡Pedido de Centro registrado correctamente!');
        limpiarCantidadesPedido();
        limpiarOtroInsumo();
        limpiarObsPedido();
      } else {
        alert('Error al registrar en la base de datos: ' + error.message);
      }
    } catch (err: any) {
      alert(`Error al registrar la solicitud: ${err?.message || 'Error de conexión'}`);
    } finally {
      setGuardando(false);
    }
  }

  const totalDescuentosDia = ventasDiaBD.reduce((acc, v) => acc + Number(v.descuento || 0), 0);
  
  const listaMotivosUnicosDescuento = Array.from(
    new Set(ventasDiaBD.map((v) => v.motivo_descuento).filter((m): m is string => Boolean(m && m.trim() !== '')))
  );

  const efecSistemaInput = Number(efectivoSistema) || 0;
  const efecFisicoInput = Number(efectivoFisico) || 0;
  const nequiInput = Number(nequi) || 0;
  const daviplataInput = Number(daviplata) || 0;

  const totalVentasElectronicas = nequiInput + daviplataInput;
  const totalVentasGlobal = efecSistemaInput + totalVentasElectronicas;

  const gast = Number(gastos) || 0;
  const sumaNominaTotalDia = registrosNominaDia.reduce((acc, n) => acc + Number(n.monto || 0), 0);

  async function pagarNominaBD() {
    if (nominaYaPagadaHoy) {
      alert('⚠️ Ya se ha registrado el pago de nómina para este usuario en el día de hoy.');
      return;
    }

    if (totalNomina <= 0) {
      alert('⚠️ El valor a pagar de nómina debe ser mayor a 0 (ingresa las horas trabajadas).');
      return;
    }

    setGuardandoNomina(true);
    const usuarioId = sesion?.usuario_id || sesion?.id || null;

    const payloadNomina = {
      sede_id: SEDE_ID_CENTRO,
      usuario_id: usuarioId ? Number(usuarioId) : null,
      monto: totalNomina,
      horas_dia: Number(horasDia) || 0,
      horas_noche: Number(horasNoche) || 0,
      tipo_dia: tipoDia,
      fecha: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('nomina').insert([payloadNomina]).select();

    setGuardandoNomina(false);

    if (error) {
      alert('❌ Error al guardar en la tabla nomina: ' + error.message);
      return;
    }

    if (data && data.length > 0) {
      setRegistrosNominaDia(prev => [...prev, data[0]]);
    }

    alert(`💸 Pago de Nómina de $ ${totalNomina.toLocaleString('es-CO')} registrado con éxito.`);
  }

  // AL CAMBIAR DE TURNO: SOLO GUARDA VISUALMENTE Y ABRE MODAL DE ENTRANTE
  async function handleEjecutarCambioTurno() {
    if (efecFisicoInput <= 0) {
      alert('⚠️ Ingresa el efectivo físico contado que queda en caja para el turno siguiente.');
      return;
    }

    if (totalNomina > 0 && !nominaYaPagadaHoy) {
      await pagarNominaBD();
    }

    setEfectivoTurnoManana(efecFisicoInput);
    localStorage.setItem('martineto_efectivo_manana', efecFisicoInput.toString());

    alert(`✅ ¡Efectivo de cambio de turno registrado!\n\nEfectivo en caja: $ ${efecFisicoInput.toLocaleString('es-CO')}\n\nA continuación, ingresa el operario que recibe el turno.`);
    setMostrarModalCambioTurno(true);
  }

  async function guardarCierreDefinitivoBD() {
    const difCaja = efecFisicoInput - efecSistemaInput;

    setGuardandoCierre(true);
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    try {
      const turnoIdActual = sesion?.turno_id || sesion?.turnoId;
      if (turnoIdActual) {
        await supabase
          .from('turno_trabajo')
          .update({ hora_salida: new Date().toISOString() })
          .eq('id', turnoIdActual);
      } else if (usuarioIdActual) {
        await supabase
          .from('turno_trabajo')
          .update({ hora_salida: new Date().toISOString() })
          .eq('sede_id', SEDE_ID_CENTRO)
          .eq('usuario_id', usuarioIdActual)
          .is('hora_salida', null);
      }

      const { data: empaquesSedeBD, error: errEmpaques } = await supabase
        .from('inventario_empaques_sedes')
        .select('*')
        .eq('sede_id', SEDE_ID_CENTRO);

      if (errEmpaques) {
        console.error('Error al consultar inventario_empaques_sedes:', errEmpaques.message);
      }

      const jsonVentasCierre: { [nombreProd: string]: number } = {};
      if (empaquesSedeBD) {
        empaquesSedeBD.forEach((item: any) => {
          const vendidas = Number(item.vendidas || item.stock || 0);
          if (vendidas > 0) {
            jsonVentasCierre[item.nombre] = vendidas;
          }
        });
      }

      const { error: errorHistorico } = await supabase.from('historico_ventas').insert([
        {
          sede_id: SEDE_ID_CENTRO,
          fecha: new Date().toISOString(),
          productos: jsonVentasCierre,
        },
      ]);

      if (errorHistorico) {
        console.error('Error al guardar en historico_ventas:', errorHistorico.message);
      }

      const { data: invAperturaHoy, error: errBuscaInv } = await supabase
        .from('inventario_diario')
        .select('id')
        .eq('sede_id', SEDE_ID_CENTRO)
        .gte('fecha_registro', hoyInicio.toISOString())
        .ilike('tipo_movimiento', 'apertura')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!errBuscaInv && invAperturaHoy) {
        await supabase
          .from('inventario_diario')
          .update({ tipo_movimiento: 'cierre' })
          .eq('id', invAperturaHoy.id);
      } else {
        const { data: invUltimoHoy } = await supabase
          .from('inventario_diario')
          .select('id')
          .eq('sede_id', SEDE_ID_CENTRO)
          .gte('fecha_registro', hoyInicio.toISOString())
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (invUltimoHoy) {
          await supabase
            .from('inventario_diario')
            .update({ tipo_movimiento: 'cierre' })
            .eq('id', invUltimoHoy.id);
        }
      }

      // CIERRE DEFINITIVO DEL DÍA EN BD
      let queryCaja = supabase
        .from('caja')
        .update({
          estado: 'cerrada',
          efectivo_cierre: efecSistemaInput,
          efectivo_fisico: efecFisicoInput,
          nequi: nequiInput,
          daviplata: daviplataInput,
          monto_gasto: gast,
          motivo_gasto: motivoGasto || null,
          descuento: totalDescuentosDia,
          motivo_descuento: listaMotivosUnicosDescuento,
          diferencia: difCaja,
        });

      if (cajaIdActual) {
        queryCaja = queryCaja.eq('id', cajaIdActual);
      } else {
        queryCaja = queryCaja
          .eq('sede_id', SEDE_ID_CENTRO)
          .gte('fecha', hoyInicio.toISOString())
          .eq('estado', 'abierta');
      }

      const { error: errorCaja } = await queryCaja;
      if (errorCaja) {
        throw new Error('Error actualizando la tabla caja: ' + errorCaja.message);
      }

      alert('✅ ¡CIERRE TOTAL DEL DÍA Y HISTÓRICO DE VENTAS GUARDADOS CON ÉXITO PARA LA SEDE CENTRO!');
      setMostrarModalResumen(false);

      limpiarBaseCaja();
      limpiarCantidadesInvSede();
      limpiarObsInv();
      limpiarCantidadesPedido();
      limpiarOtroInsumo();
      limpiarObsPedido();
      limpiarHorasDia();
      limpiarHorasNoche();
      limpiarEfSistema();
      limpiarEfFisico();
      limpiarNequi();
      limpiarDaviplata();
      limpiarGastos();
      limpiarMotivoGasto();

      cerrarSesion();
    } catch (err: any) {
      alert('⚠️ ' + err.message);
    } finally {
      setGuardandoCierre(false);
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
      (op) => String(op.id) === String(operarioEntranteId)
    );

    const pinOperario = operarioEncontrado?.codigo_acceso || operarioEncontrado?.pin || '';

    if (
      operarioEncontrado &&
      String(pinOperario).trim() === String(claveOperarioEntrante).trim()
    ) {
      try {
        const turnoIdActual = sesion?.turno_id || sesion?.turnoId;
        if (turnoIdActual) {
          await supabase
            .from('turno_trabajo')
            .update({ hora_salida: new Date().toISOString() })
            .eq('id', turnoIdActual);
        } else if (usuarioIdActual) {
          await supabase
            .from('turno_trabajo')
            .update({ hora_salida: new Date().toISOString() })
            .eq('sede_id', SEDE_ID_CENTRO)
            .eq('usuario_id', usuarioIdActual)
            .is('hora_salida', null);
        }

        const turnoNormalizado = turnoRecibido.includes('tarde') ? 'tarde_cierre' : 'manana_apertura';
        const { data: nuevoTurnoDB } = await supabase
          .from('turno_trabajo')
          .insert([
            {
              sede_id: SEDE_ID_CENTRO,
              usuario_id: Number(operarioEncontrado.id),
              tipo_turno: turnoNormalizado,
              hora_entrada: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        const nombreOperarioEntrante = operarioEncontrado.nombre_completo || operarioEncontrado.nombre || 'Operario';

        const nuevaSesion = {
          usuario_id: operarioEncontrado.id,
          nombre: nombreOperarioEntrante,
          rol: (operarioEncontrado.tipo_usuario || 'operador').toLowerCase(),
          sede_id: SEDE_ID_CENTRO,
          sede_nombre: 'Walers Centro',
          sede_codigo: 'centro',
          turno_id: nuevoTurnoDB ? nuevoTurnoDB.id : null,
          turno: turnoNormalizado,
        };

        localStorage.setItem('martineto_session', JSON.stringify(nuevaSesion));
        setSesion(nuevaSesion);

        setMostrarModalCambioTurno(false);
        setClaveOperarioEntrante('');
        setOperarioEntranteId('');

        limpiarHorasDia();
        limpiarHorasNoche();
        limpiarEfSistema();
        limpiarEfFisico();
        limpiarGastos();
        limpiarMotivoGasto();

        setValidandoEntrante(false);
        alert(`✅ ¡Turno entregado con éxito!\nBienvenido(a) ${nuevaSesion.nombre}.`);
      } catch (err: any) {
        setValidandoEntrante(false);
        alert('❌ Error al procesar el cambio de turno: ' + (err?.message || 'Error desconocido'));
      }
    } else {
      setValidandoEntrante(false);
      alert('❌ Código de acceso / PIN incorrecto para este operario.');
    }
  }

  function cerrarSesion() {
    const turnoIdActual = sesion?.turno_id || sesion?.turnoId;
    if (turnoIdActual) {
      supabase
        .from('turno_trabajo')
        .update({ hora_salida: new Date().toISOString() })
        .eq('id', turnoIdActual)
        .then(() => {});
    }

    localStorage.removeItem('martineto_session');
    localStorage.removeItem('martineto_efectivo_manana');
    router.push('/login');
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#004e8c] flex items-center justify-center text-white text-xs font-bold font-sans">
        Cargando Sede Centro...
      </main>
    );
  }

  const bloqueadoPorApertura = !baseGuardada || !aperturaRealizada;

  return (
    <main className="min-h-screen bg-[#004e8c] text-[#f1f5f9] p-4 font-sans max-w-6xl mx-auto space-y-4 relative">
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003d6d] border border-[#0066b3] p-1 flex items-center justify-center overflow-hidden shrink-0 shadow">
            <img
              src="/walers.png.jpeg"
              alt="Walers Centro"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black text-white tracking-wide flex items-center gap-2">
              WALERS CENTRO
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

        <div className="bg-[#0b2b48] border border-amber-400/50 p-4 rounded-2xl space-y-1 shadow-md flex flex-col justify-center">
          <span className="text-xs font-black text-amber-300 block uppercase">
            ☀️ Efectivo Recibido del Turno Anterior:
          </span>
          <div className="bg-[#051829] border border-amber-500/40 p-2.5 rounded-xl flex justify-between items-center">
            <span className="text-xs text-sky-200 font-bold">Efectivo disponible en caja:</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <div className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex flex-col justify-between shadow-md">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-2">
              <h2 className="text-xs md:text-sm font-black text-white">📦 Conteo de Inventario (Sede Centro)</h2>
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
                    <option value="nuevas">📦 Ingreso de Nuevos / Stock</option>
                    <option value="compras">🛒 Compras Directas</option>
                    <option value="debaja">⚠️ De Baja / Mermas</option>
                    <option value="cierre">🌙 Conteo de Cierre</option>
                  </>
                )}
              </select>
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 border border-[#0066b3]/50 p-2.5 rounded-xl bg-[#051829]">
              <span className="text-[10px] text-sky-300 font-bold uppercase block mb-1">Items de Sede Centro (Inventario Empaques):</span>
              {inventarioSedeItems.length === 0 ? (
                <p className="text-xs text-amber-200 text-center py-4 font-semibold">
                  ⚠️ No se encontraron items en inventario_empaques_sedes para la sede 2.
                </p>
              ) : (
                inventarioSedeItems.map((item, idx) => (
                  <div key={item.id || idx} className="bg-[#0e385e] border border-[#0066b3]/60 p-2 rounded-xl flex justify-between items-center gap-2 shadow-sm">
                    <div className="truncate">
                      <p className="font-bold text-xs text-white truncate">{item.nombre}</p>
                      <span className="text-[10px] font-semibold text-sky-300 block -mt-0.5">
                        Stock Actual: {item.stock ?? 0}
                      </span>
                    </div>
                    <input
                      ref={(el) => { inputsRef.current[`inv_item_${item.nombre}`] = el; }}
                      type="number"
                      placeholder="0"
                      value={cantidadesInventarioSede[item.nombre] ?? ''}
                      onChange={(e) => handleInventarioItemChange(item.nombre, e.target.value)}
                      onKeyDown={(e) => handleKeyDownInventarioItem(e, idx)}
                      onFocus={(e) => e.target.select()}
                      className="w-24 bg-[#051829] border border-[#00a4ef]/60 text-sky-200 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))
              )}
            </div>

            <textarea
              placeholder="Observaciones de inventario..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full bg-[#051829] border border-[#0066b3] rounded-xl p-2.5 text-xs text-white outline-none h-20 resize-none focus:border-[#00a4ef]"
            />
          </div>

          <button
            onClick={handleGuardarInventario}
            disabled={!baseGuardada || guardando}
            className={`w-full font-black py-3 rounded-xl text-xs md:text-sm transition-all uppercase shadow-md mt-4 ${
              baseGuardada && !guardando
                ? 'bg-[#0078d4] hover:bg-[#0086e6] text-white shadow-[#003d6d] cursor-pointer opacity-100'
                : 'bg-[#051829] text-sky-400/40 cursor-not-allowed opacity-50 border border-[#003d6d]'
            }`}
          >
            {guardando ? 'Guardando Inventario...' : `💾 Guardar ${tipoMovimiento}`}
          </button>
        </div>

        <div className={`flex flex-col justify-between space-y-4 transition-opacity ${bloqueadoPorApertura ? 'opacity-50 pointer-events-none select-none' : 'opacity-100'}`}>
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
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {categoriasDinamicas.length === 0 ? (
                    <span className="text-amber-200 italic">Cargando categorías...</span>
                  ) : (
                    categoriasDinamicas.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoriaPedido(cat)}
                        className={`py-2 px-3 rounded-xl font-bold border text-center transition-all cursor-pointer capitalize ${
                          categoriaPedido.toLowerCase() === cat.toLowerCase()
                            ? 'bg-[#0078d4] text-white border-[#00a4ef] shadow'
                            : 'bg-[#051829] text-sky-200 border-[#0066b3]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))
                  )}
                </div>

                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-[#0066b3]/50 p-2.5 rounded-xl bg-[#051829]">
                  <span className="text-[10px] text-sky-300 font-bold uppercase block">
                    Productos en {categoriaPedido.toUpperCase()} (Sede 2):
                  </span>
                  {productosCategoriaFiltrados.length === 0 ? (
                    <p className="text-xs text-amber-200 text-center py-4 font-semibold">
                      No hay productos guardados para esta categoría en la Sede 2.
                    </p>
                  ) : (
                    productosCategoriaFiltrados.map((item, idx) => (
                      <div key={item.id} className="bg-[#0e385e] border border-[#0066b3]/60 p-2 rounded-xl flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item.nombre}</span>
                        <input 
                          ref={(el) => { inputsRef.current[`pedido_prod_${item.id}`] = el; }}
                          type="number" 
                          placeholder="0" 
                          value={cantidadesPedido[item.nombre] ?? ''} 
                          onChange={(e) => handleItemPedidoChange(item.nombre, e.target.value)} 
                          onKeyDown={(e) => handleKeyDownPedido(e, idx, productosCategoriaFiltrados, 'pedido_prod')}
                          onFocus={(e) => e.target.select()} 
                          className="w-24 bg-[#051829] border border-[#00a4ef]/60 text-sky-200 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-[#051829] border border-amber-400/40 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-black text-amber-300 uppercase block border-b border-[#0066b3]/40 pb-1">
                    📋 Listado de Pedido Actual
                  </span>

                  {(() => {
                    const seleccionados = Object.entries(cantidadesPedido).filter(([_, cant]) => Number(cant) > 0);
                    const tieneOtro = Boolean(otroInsumoTexto.trim());

                    if (seleccionados.length === 0 && !tieneOtro) {
                      return <p className="text-[11px] text-sky-400 italic text-center py-2">No hay productos agregados al pedido todavía.</p>;
                    }

                    return (
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1 text-xs">
                        {seleccionados.map(([nombre, cant]) => (
                          <div key={nombre} className="flex justify-between items-center bg-[#0e385e] px-2.5 py-1 rounded-lg border border-[#0066b3]/40">
                            <span className="text-white truncate">{nombre} <b className="text-emerald-300">x{cant}</b></span>
                            <button
                              type="button"
                              onClick={() => setCantidadesPedido((prev) => ({ ...prev, [nombre]: '' }))}
                              className="text-rose-400 hover:text-rose-200 font-black px-1.5 py-0.5 rounded text-[11px] cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {tieneOtro && (
                          <div className="flex justify-between items-center bg-[#0e385e] px-2.5 py-1 rounded-lg border border-[#0066b3]/40">
                            <span className="text-white truncate">Otro: {otroInsumoTexto}</span>
                            <button
                              type="button"
                              onClick={() => setOtroInsumoTexto('')}
                              className="text-rose-400 hover:text-rose-200 font-black px-1.5 py-0.5 rounded text-[11px] cursor-pointer"
                            >
                              ✕
                            </button>
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

          <div className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl space-y-4 shadow-md flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-xs md:text-sm font-black text-white border-b border-[#0066b3]/50 pb-2 flex justify-between">
                <span>{esTurnoCierre ? '🌙 Cierre de Jornada y Arqueo' : '👥 Cambio de Turno / Arqueo y Nómina'}</span>
                <span className="text-[10px] text-sky-200 font-bold bg-[#003d6d] px-2 py-0.5 rounded-md border border-[#0066b3]">{esTurnoCierre ? 'Fin de Día' : 'Fin de Turno'}</span>
              </h2>

              <div className="space-y-2 bg-[#051829] p-3 rounded-xl border border-[#0066b3] mt-3">
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
                      onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_efectivo_fisico')}
                      onFocus={(e) => e.target.select()} 
                      className="w-full bg-[#0e385e] border border-[#0066b3] text-white font-bold text-center rounded-lg p-2 outline-none focus:border-[#00a4ef] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-rose-950/60 p-2 rounded-lg border border-rose-500/50 text-xs font-bold text-rose-200">
                  <span>Total Nómina Turno:</span>
                  <span className="text-sm font-black text-rose-300">$ {totalNomina.toLocaleString('es-CO')}</span>
                </div>
              </div>

              <div className="space-y-2 bg-[#051829] p-3 rounded-xl border border-[#0066b3] mt-3">
                <span className="text-[10px] font-black text-emerald-300 uppercase block">
                  2. DINERO EN CAJA / ARQUEO ({esTurnoCierre ? 'CIERRE DE DÍA' : 'ENTREGA DE TURNO'}):
                </span>
                
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className={`block mb-1 font-bold ${esTurnoCierre ? 'text-sky-300' : 'text-slate-500'}`}>💻 Efvo. según Sistema ($)</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_efectivo_sistema'] = el; }}
                      type="text" 
                      placeholder={esTurnoCierre ? "$ 0" : "N/A (Cambio Turno)"} 
                      value={esTurnoCierre ? formatearMoneda(efectivoSistema) : ''} 
                      onChange={(e) => setEfectivoSistema(desformatearMoneda(e.target.value))} 
                      disabled={!esTurnoCierre}
                      onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_efectivo_fisico')}
                      onFocus={(e) => e.target.select()} 
                      className={`w-full border font-bold text-center rounded-lg p-2 outline-none ${
                        esTurnoCierre 
                          ? 'bg-[#0e385e] border-[#0066b3] text-sky-200 focus:border-sky-400' 
                          : 'bg-[#051829] border-[#003d6d] text-slate-500 cursor-not-allowed'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-emerald-300 block mb-1 font-bold">💵 Efvo. Físico en Caja ($)</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_efectivo_fisico'] = el; }}
                      type="text" 
                      placeholder="$ 0" 
                      value={formatearMoneda(efectivoFisico)} 
                      onChange={(e) => setEfectivoFisico(desformatearMoneda(e.target.value))} 
                      onKeyDown={(e) => handleKeyDownCierre(e, esTurnoCierre ? 'cierre_nequi' : '')}
                      onFocus={(e) => e.target.select()} 
                      className="w-full bg-[#0e385e] border border-[#0066b3] text-emerald-300 font-bold text-center rounded-lg p-2 outline-none focus:border-emerald-400" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                  <div>
                    <span className={`block mb-1 font-bold ${esTurnoCierre ? 'text-sky-200' : 'text-slate-500'}`}>📲 Nequi ($)</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_nequi'] = el; }}
                      type="text" 
                      placeholder={esTurnoCierre ? "$ 0" : "N/A (Cambio Turno)"} 
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
                      placeholder={esTurnoCierre ? "$ 0" : "N/A (Cambio Turno)"} 
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
                    <span className={`block mb-1 font-bold ${esTurnoCierre ? 'text-amber-300' : 'text-slate-500'}`}>🧾 Total Gastos ($)</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_gastos'] = el; }}
                      type="text" 
                      placeholder={esTurnoCierre ? "$ 0" : "N/A (Cambio Turno)"} 
                      value={esTurnoCierre ? formatearMoneda(gastos) : ''} 
                      onChange={(e) => setGastos(desformatearMoneda(e.target.value))} 
                      disabled={!esTurnoCierre}
                      onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_motivo_gasto')}
                      onFocus={(e) => e.target.select()} 
                      className={`w-full border font-bold text-center rounded-lg p-2 outline-none ${
                        esTurnoCierre
                          ? 'bg-[#0e385e] border-[#0066b3] text-amber-300 focus:border-amber-400'
                          : 'bg-[#051829] border-[#003d6d] text-slate-500 cursor-not-allowed'
                      }`}
                    />
                  </div>
                  <div>
                    <span className={`block mb-1 font-bold ${esTurnoCierre ? 'text-sky-200' : 'text-slate-500'}`}>📝 Motivo del Gasto</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_motivo_gasto'] = el; }}
                      type="text" 
                      placeholder={esTurnoCierre ? "Ej. Compra de hielo, bolsas..." : "N/A (Cambio Turno)"} 
                      value={esTurnoCierre ? motivoGasto : ''} 
                      onChange={(e) => setMotivoGasto(e.target.value)} 
                      disabled={!esTurnoCierre}
                      onFocus={(e) => e.target.select()} 
                      className={`w-full border text-xs rounded-lg p-2 outline-none ${
                        esTurnoCierre
                          ? 'bg-[#0e385e] border-[#0066b3] text-white focus:border-[#00a4ef]'
                          : 'bg-[#051829] border-[#003d6d] text-slate-500 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-[#0e385e] p-2.5 rounded-xl border border-emerald-400/50 text-xs font-bold mt-2">
                  <span className="text-emerald-300 uppercase font-black">
                    {esTurnoCierre ? 'Total Recaudado (Ventas):' : 'Efectivo Físico a Dejar:'}
                  </span>
                  <span className="text-base font-black text-emerald-300 bg-[#051829] px-3 py-1 rounded-lg border border-emerald-500/50">
                    $ {(esTurnoCierre ? totalVentasGlobal : Number(efectivoFisico) || 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4">
              <button
                type="button"
                onClick={pagarNominaBD}
                disabled={guardandoNomina || nominaYaPagadaHoy}
                className={`w-full font-black py-3 rounded-xl text-xs uppercase shadow-md transition-all ${
                  guardandoNomina || nominaYaPagadaHoy
                    ? 'bg-emerald-950 text-emerald-300/60 cursor-not-allowed border border-emerald-700'
                    : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                }`}
              >
                {guardandoNomina 
                  ? 'Registrando Nómina...' 
                  : nominaYaPagadaHoy 
                  ? '✓ Nómina Pagada Hoy' 
                  : "💸 Pagar Nómina (Tabla 'nomina')"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (esTurnoCierre && !cierreRealizado) {
                    alert('⚠️ ATENCIÓN: Debes seleccionar "Conteo de Cierre" en la sección de inventario y guardar el conteo antes de cerrar la jornada.');
                    return;
                  }
                  if (tienePedidoSinEnviar) {
                    alert('⚠️ ATENCIÓN: Tienes productos agregados en la lista de Pedido de Insumos sin enviar. Debes presionar "🚀 Enviar Pedido a Bodega" o vaciar las cantidades antes de cerrar.');
                    return;
                  }
                  if (esTurnoCierre) {
                    setMostrarModalResumen(true);
                  } else {
                    handleEjecutarCambioTurno();
                  }
                }}
                disabled={guardando || (esTurnoCierre && !cierreRealizado)}
                className={`w-full font-black py-3 rounded-xl text-xs uppercase transition-all shadow-md cursor-pointer ${
                  esTurnoCierre && !cierreRealizado
                    ? 'bg-[#051829] text-sky-400/40 cursor-not-allowed border border-[#003d6d]'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {esTurnoCierre ? '🌙 Auditoría y Cierre de Día' : '🔄 Cambio de Turno'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {mostrarModalResumen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-[#0b2b48] border-2 border-emerald-400 rounded-2xl p-6 max-w-3xl w-full space-y-4 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-3">
              <h3 className="text-sm font-black flex items-center gap-2 uppercase text-emerald-300">
                📊 AUDITORÍA Y BALANCE DE DÍA — WALERS CENTRO
              </h3>
              <button
                onClick={() => setMostrarModalResumen(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

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
                  <span>🛍️ TOTAL VENTAS (Sistema):</span>
                  <span>$ {totalVentasGlobal.toLocaleString('es-CO')}</span>
                </div>

                <div className="bg-[#0e385e]/60 p-2.5 rounded-lg border border-[#0066b3]/60 space-y-1.5 ml-2">
                  <div className="flex justify-between text-sky-300 font-bold">
                    <span>💳 Ventas Electrónicas (Total):</span>
                    <span>$ {totalVentasElectronicas.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-[11px] text-sky-200 pl-3">
                    <span>• NEQUI: $ {nequiInput.toLocaleString('es-CO')}</span>
                    <span>• DAVIPLATA: $ {daviplataInput.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                <div className="flex justify-between text-emerald-300 font-black pt-1">
                  <span>💻 Efectivo según Sistema:</span>
                  <span>$ {efecSistemaInput.toLocaleString('es-CO')}</span>
                </div>

                <div className="flex justify-between text-amber-300 font-black pt-1">
                  <span>💵 Efectivo Físico Contado en Caja:</span>
                  <span>$ {efecFisicoInput.toLocaleString('es-CO')}</span>
                </div>

                <div className="flex justify-between text-amber-400">
                  <span>💸 Gastos Directos Insumos (Efectivo):</span>
                  <span>- $ {gast.toLocaleString('es-CO')}</span>
                </div>

                <div className="flex justify-between text-fuchsia-300 font-black pt-1 border-t border-[#0066b3]/30">
                  <span>👥 Total Nómina Pagada en el Día ({registrosNominaDia.length} registros):</span>
                  <span>- $ {sumaNominaTotalDia.toLocaleString('es-CO')}</span>
                </div>

                {totalDescuentosDia > 0 && (
                  <div className="bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-lg space-y-1 text-amber-300">
                    <div className="flex justify-between font-black">
                      <span>🏷️ Descuentos Totales del Día:</span>
                      <span>$ {totalDescuentosDia.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#051829] border border-fuchsia-500/40 p-3 rounded-xl space-y-1.5">
                <span className="text-xs text-fuchsia-300 font-black uppercase block">
                  👥 Detalle de Nóminas del Día:
                </span>
                {registrosNominaDia.length === 0 ? (
                  <p className="text-[11px] text-sky-400 italic">No hay pagos de nómina registrados hoy.</p>
                ) : (
                  registrosNominaDia.map((n, i) => {
                    const opEncontrado = listaOperarios.find((op) => String(op.id) === String(n.usuario_id));
                    const nombreOperario = opEncontrado ? (opEncontrado.nombre_completo || opEncontrado.nombre) : `Operario #${n.usuario_id || 'N/A'}`;
                    return (
                      <div key={i} className="flex justify-between text-[11px] text-white border-b border-[#0066b3]/30 py-1">
                        <span>{nombreOperario}</span>
                        <span className="font-bold text-fuchsia-300">$ {Number(n.monto || 0).toLocaleString('es-CO')}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMostrarModalResumen(false)}
                className="w-1/2 bg-[#051829] hover:bg-[#003d6d] text-sky-200 border border-[#0066b3] font-bold py-2 rounded-xl text-xs uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={guardarCierreDefinitivoBD}
                disabled={guardandoCierre}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs uppercase cursor-pointer shadow-lg disabled:opacity-50"
              >
                {guardandoCierre ? 'Guardando en BD...' : '💾 Confirmar y Guardar Cierre en BD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalNuevoProd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b2b48] border-2 border-emerald-400 rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2">
              <h3 className="text-sm font-black text-white uppercase">➕ Crear Nuevo Insumo / Producto</h3>
              <button
                onClick={() => setMostrarModalNuevoProd(false)}
                className="text-sky-300 hover:text-white font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[400px] overflow-y-auto pr-1">
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
                  <option value="Otro">✏️ Escribir nuevo lugar...</option>
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

      {mostrarModalCambioTurno && (
        <div className="fixed inset-0 bg-[#051829]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b2b48] border border-[#0066b3] p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl text-center">
            
            <div className="space-y-1 border-b border-[#0066b3]/50 pb-3">
              <div className="w-12 h-12 bg-[#003d6d] border border-[#0066b3] rounded-2xl flex items-center justify-center mx-auto mb-2 text-xl shadow-lg">
                🔄
              </div>
              <h3 className="text-lg font-black text-white tracking-wide">
                Recepción de Turno — Walers Centro
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
                  <option value="tarde/cierre">🌙 Tarde/Cierre</option>
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
                      👤 {op.nombre_completo || op.nombre}
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