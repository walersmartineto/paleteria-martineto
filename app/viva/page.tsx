'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerTarifasViva,
  registrarMovimientoViva,
  registrarBaseCajaViva,
  crearPedidoInsumosViva,
  obtenerUsuariosOperarios,
  registrarNominaYCambioTurno,
  obtenerSaboresViva,
  TarifasViva,
} from '@/lib/vivaQueries';

const LISTA_PLASTICOS_RICHI = [
  'Bolsa Blanca',
  'Bolsa de Papel',
  'Cucharitas',
  'Vaso agua',
];

const LISTA_INSUMOS_MATERIA = [
  'Capacillos',
  'Chamoy',
  'Chip chocolate',
  'Chocolate cobertura Blanco',
  'Chocolate Cobertura Negro',
  'Flips',
  'Galleta oreo',
  'Gomitas',
  'Grasa',
  'Leche condensada',
  'Mani',
  'Nerds',
  'Nutella',
  'Pepitas colores',
  'Pistacho',
  'Plato Mostac',
  'Quipitos',
  'Sal limón',
  'Semillas de girasol',
  'Servilletas',
  'Tajín',
  'Zumo de Limon',
];

const LISTA_ASEO = [
  'Antibacterial',
  'Bolsas de basura',
  'Clorox',
  'Escoba',
  'Esponjillas',
  'Guantes de Nitrilo',
  'Jabon de Manos',
  'Jabón loza',
  'Jabón en polvo',
  'Limpia Pisos',
  'Liquido Verde',
  'Papel higiénico',
  'Tapabocas',
  'Toallas de papel',
  'Trapero',
  'Trapitos',
];

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

  const [tarifas, setTarifas] = useState<TarifasViva>({
    subsidio: 9600,
    transporte: 8400,
    horaDiaEntreSemana: 7200,
    horaNocheEntreSemana: 10700,
    horaDiaFestivo: 12700,
    horaNocheFestivo: 15200,
  });

  const [baseCaja, setBaseCaja] = useState<number | ''>('');
  const [baseGuardada, setBaseGuardada] = useState(false);
  const [aperturaRealizada, setAperturaRealizada] = useState(false);
  const [cierreRealizado, setCierreRealizado] = useState(false);

  // INVENTARIO POR SABORES Y CAJA MOSTAC
  const [tipoMovimiento, setTipoMovimiento] = useState<string>('apertura');
  const [saboresViva, setSaboresViva] = useState<any[]>([]);
  const [cantidadesSabores, setCantidadesSabores] = useState<{ [saborId: number]: number | '' }>({});
  const [cajasMostrador, setCajasMostrador] = useState<number | ''>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // REQUISICIÓN DE PEDIDOS
  const [mostrarModuloPedidos, setMostrarModuloPedidos] = useState(false);
  const [categoriaPedido, setCategoriaPedido] = useState<'paletas' | 'richi' | 'insumos' | 'aseo'>('paletas');
  const [cantidadesPedidoPaletas, setCantidadesPedidoPaletas] = useState<{ [saborId: number]: number | '' }>({});
  const [cantidadesRichi, setCantidadesRichi] = useState<{ [item: string]: number | '' }>({});
  const [cantidadesInsumos, setCantidadesInsumos] = useState<{ [item: string]: number | '' }>({});
  const [cantidadesAseo, setCantidadesAseo] = useState<{ [item: string]: number | '' }>({});
  const [otroInsumoTexto, setOtroInsumoTexto] = useState('');
  const [obsPedido, setObsPedido] = useState('');

  // NÓMINA Y ARQUEO DE CAJA
  const [tipoDia, setTipoDia] = useState<'entre_semana' | 'domingo_festivo'>('entre_semana');
  const [horasDia, setHorasDia] = useState<number | ''>('');
  const [horasNoche, setHorasNoche] = useState<number | ''>('');
  const [efectivoCaja, setEfectivoCaja] = useState<number | ''>('');
  const [nequi, setNequi] = useState<number | ''>('');
  const [daviplata, setDaviplata] = useState<number | ''>('');
  const [gastos, setGastos] = useState<number | ''>('');
  const [motivoGasto, setMotivoGasto] = useState<string>('');

  // MODAL CAMBIO DE TURNO
  const [mostrarModalCambioTurno, setMostrarModalCambioTurno] = useState(false);
  const [listaOperarios, setListaOperarios] = useState<any[]>([]);
  const [operarioEntranteId, setOperarioEntranteId] = useState<string>('');
  const [claveOperarioEntrante, setClaveOperarioEntrante] = useState<string>('');
  const [turnoRecibido, setTurnoRecibido] = useState<string>('tarde_cierre');
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

  const SEDE_ID_VIVA = 2;

  // FILTRO EXCLUSIVO PARA PALETAS REALES (EXCLUYE INSUMOS, ASEO, EMPAQUES)
  const paletasFiltradas = saboresViva.filter((p) => {
    const cat = (p.categoria || '').toLowerCase();
    const nom = (p.nombre || '').toLowerCase();
    return (
      !cat.includes('aseo') &&
      !cat.includes('insumo') &&
      !cat.includes('materia') &&
      !cat.includes('empaque') &&
      !cat.includes('richi') &&
      !nom.includes('antibacterial') &&
      !nom.includes('servilleta') &&
      !nom.includes('sal limón') &&
      !nom.includes('girasol')
    );
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

    const str = JSON.stringify(ses).toLowerCase();
    if (str.includes('cierre') || str.includes('tarde')) {
      setBaseGuardada(true);
      setAperturaRealizada(true);
      setTipoMovimiento('nuevas');
    }

    cargarInicial();
  }, [router]);

  async function cargarInicial() {
    setCargando(true);
    const [configTarifas, operarios, listaSabores] = await Promise.all([
      obtenerTarifasViva(),
      obtenerUsuariosOperarios(),
      obtenerSaboresViva(),
    ]);

    setTarifas(configTarifas);
    setListaOperarios(operarios);
    setSaboresViva(listaSabores);

    const iniciales: { [saborId: number]: number | '' } = {};
    listaSabores.forEach((s) => (iniciales[s.id] = ''));
    setCantidadesSabores(iniciales);
    setCantidadesPedidoPaletas({ ...iniciales });

    setCargando(false);
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
    const sedeId = sesionActual?.sede_id || SEDE_ID_VIVA;
    const turnoId = sesionActual?.turno_id || sesionActual?.turnoId;

    if (!usuarioId) {
      alert('⚠️ No hay una sesión de usuario activa. Vuelve a iniciar sesión.');
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
    if (!sesion) return;

    if (!baseGuardada) {
      alert('⚠️ Primero debes guardar la Base Inicial de Caja.');
      return;
    }

    const detallePaletasObj: { [saborNombre: string]: number } = {};
    Object.entries(cantidadesSabores).forEach(([saborId, cant]) => {
      const num = Number(cant) || 0;
      if (num > 0) {
        const saborObj = saboresViva.find((s) => s.id === Number(saborId));
        if (saborObj) {
          detallePaletasObj[saborObj.nombre] = num;
        }
      }
    });

    const detalleEmpaquesObj: { [itemNombre: string]: number } = {};
    if (Number(cajasMostrador) > 0) {
      detalleEmpaquesObj['Caja Mostac'] = Number(cajasMostrador);
    }

    const usuarioId = sesion?.usuario_id || sesion?.id;
    const sedeId = sesion?.sede_id || SEDE_ID_VIVA;

    setGuardando(true);
    try {
      const exito = await registrarMovimientoViva(
        sedeId,
        usuarioId,
        tipoMovimiento,
        totalPaletasSuma,
        detallePaletasObj,
        detalleEmpaquesObj,
        observaciones,
        sesion?.turno_id
      );
      setGuardando(false);

      if (exito) {
        alert(`¡Registro de [${tipoMovimiento.toUpperCase()}] guardado con éxito! (Total: ${totalPaletasSuma} paletas)`);
        
        if (tipoMovimiento === 'apertura') {
          setAperturaRealizada(true);
          setTipoMovimiento('nuevas');
        } else if (tipoMovimiento === 'cierre') {
          setCierreRealizado(true);
        }

        const limpias: { [saborId: number]: number | '' } = {};
        saboresViva.forEach((s) => (limpias[s.id] = ''));
        setCantidadesSabores(limpias);
        setCajasMostrador('');
        setObservaciones('');
      } else {
        alert('⚠️ Error al registrar el inventario en la base de datos.');
      }
    } catch (err) {
      setGuardando(false);
      console.error('Error guardando inventario:', err);
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

    if (otroInsumoTexto.trim()) {
      insumosObj[`Otro: ${otroInsumoTexto.trim()}`] = 1;
    }

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

    const usuarioId = sesion?.usuario_id || sesion?.id;
    const sedeId = sesion?.sede_id || SEDE_ID_VIVA;

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
        setCantidadesRichi({});
        setCantidadesInsumos({});
        setCantidadesAseo({});
        const limpiasPaletas: { [saborId: number]: number | '' } = {};
        saboresViva.forEach((s) => (limpiasPaletas[s.id] = ''));
        setCantidadesPedidoPaletas(limpiasPaletas);
        setOtroInsumoTexto('');
        setObsPedido('');
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

    const usuarioId = sesion?.usuario_id || sesion?.id;
    const sedeId = sesion?.sede_id || SEDE_ID_VIVA;

    const datosPayload: any = {
      sedeId,
      usuarioId,
      tipoDia,
      horasDia: hDia,
      horasNoche: hNoche,
      subsidio: tarifas.subsidio,
      transporte: tarifas.transporte,
      totalPagado: totalNomina,
      efectivoCaja: esTurnoCierre ? efCaja : 0,
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
        cerrarSesion();
      } else {
        alert(`¡Nómina del operador saliente registrada con éxito!\nTotal Pagado: $ ${totalNomina.toLocaleString('es-CO')}\n\nA continuación, ingresa el operario que recibe el turno.`);
        setHorasDia('');
        setHorasNoche('');
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
      const nuevaSesion = {
        usuario_id: operarioEncontrado.id,
        nombre: operarioEncontrado.nombre,
        sede_id: sesion?.sede_id || SEDE_ID_VIVA,
        turno: turnoRecibido,
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
    router.push('/login');
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#07090e] flex items-center justify-center text-gray-400 text-xs font-bold font-sans">
        Cargando Sede Viva...
      </main>
    );
  }

  const bloqueadoPorApertura = !baseGuardada || !aperturaRealizada;

  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 p-4 font-sans max-w-6xl mx-auto space-y-4 relative">
      {/* Header Banner */}
      <header className="bg-[#0d111a] border border-gray-800 p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-base md:text-lg font-black text-white tracking-wide">🛍️ WALERS VIVA</h1>
          <p className="text-xs text-gray-400">
            Operador en Turno: <b className="text-purple-400">{sesion?.nombre || 'Operador'}</b>
            <span className="ml-2 text-amber-400 font-bold uppercase">
              ({esTurnoCierre ? 'Día Completo / Cierre' : 'Mañana / Apertura'})
            </span>
          </p>
        </div>
        <button
          onClick={cerrarSesion}
          className="bg-gray-800 hover:bg-rose-950 text-gray-300 border border-gray-700 px-4 py-2 rounded-xl text-xs font-bold transition-all"
        >
          🚪 Salir
        </button>
      </header>

      {/* 1. Base Inicial de Caja */}
      <div className="bg-[#0d111a] border border-emerald-900/50 p-4 rounded-2xl space-y-2 shadow-md">
        <span className="text-xs md:text-sm font-black text-emerald-400 block">
          💵 Paso 1: Base Inicial para Empezar el Día (Efectivo en Caja):
        </span>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Monto en efectivo $"
            value={formatearMoneda(baseCaja)}
            onChange={(e) => setBaseCaja(desformatearMoneda(e.target.value))}
            onFocus={(e) => e.target.select()}
            disabled={baseGuardada}
            className="w-full bg-gray-900 border border-gray-800 text-emerald-300 font-black text-sm md:text-base rounded-xl p-3 outline-none"
          />
          <button
            onClick={handleGuardarBase}
            disabled={baseGuardada}
            className={`font-bold px-6 rounded-xl text-xs md:text-sm whitespace-nowrap transition-all shadow-md ${
              baseGuardada
                ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
            }`}
          >
            {baseGuardada ? '✓ Base Guardada' : 'Guardar Base'}
          </button>
        </div>
      </div>

      {bloqueadoPorApertura && (
        <div className="bg-amber-950/40 border border-amber-600/50 p-3 rounded-xl text-center text-xs text-amber-300 font-bold">
          ⚠️ ATENCIÓN: Debes registrar la Base de Caja y realizar obligatoriamente el <span className="underline">Conteo de Apertura</span> para habilitar el resto de módulos de la sede.
        </div>
      )}

      {/* GRID DOS COLUMNAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        
        {/* COLUMNA IZQUIERDA: INVENTARIO POR SABORES Y CAJA MOSTAC */}
        <div className="bg-[#0d111a] border border-gray-800 p-4 rounded-2xl space-y-4 shadow-md">
          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
            <h2 className="text-xs md:text-sm font-black text-white">🍦 Conteo de Paletas por Sabor</h2>
            <span className="text-[11px] text-purple-400 font-bold uppercase">{tipoMovimiento}</span>
          </div>

          <div>
            <label className="text-[11px] text-gray-400 font-bold block mb-1">Acción a registrar:</label>
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value)}
              disabled={!aperturaRealizada && baseGuardada}
              className="w-full bg-purple-950/60 border border-purple-700 text-white font-black text-xs md:text-sm rounded-xl p-2.5 outline-none cursor-pointer"
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

          {/* LISTADO DE PALETAS FILTRADAS POR CATEGORÍA */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 border border-gray-800 p-2.5 rounded-xl bg-gray-950/40">
            <span className="text-[10px] text-purple-400 font-bold uppercase block mb-1">Ingresar Cantidad por Sabor:</span>
            {paletasFiltradas.map((s, idx) => (
              <div key={s.id} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                <div className="truncate">
                  <p className="font-bold text-xs text-white truncate">{s.nombre}</p>
                  <span className="text-[10px] font-semibold text-purple-400 block -mt-0.5 capitalize">
                    {s.categoria || ''}
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
                  className="w-24 bg-gray-950 border border-purple-800/80 text-purple-300 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-purple-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ))}
          </div>

          {/* TOTAL CALCULADO AUTOMÁTICAMENTE */}
          <div className="bg-gray-900/80 p-3 rounded-2xl border border-purple-900/50 flex justify-between items-center shadow-inner">
            <span className="text-xs font-black text-purple-300 uppercase">
              Total Paletas ({tipoMovimiento.toUpperCase()}):
            </span>
            <span className="text-xl font-black text-purple-400 bg-gray-950 px-4 py-1.5 rounded-xl border border-purple-800 shadow">
              {totalPaletasSuma}
            </span>
          </div>

          {/* CONTEO ÚNICO DE CAJA MOSTAC */}
          <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-800 space-y-2">
            <span className="text-[10px] text-amber-400 font-extrabold uppercase block">Conteo de Empaques:</span>
            <div className="flex justify-between items-center bg-gray-950 p-2.5 rounded-lg border border-gray-800">
              <span className="text-xs text-gray-300 font-bold">📦 Caja Mostac:</span>
              <input 
                ref={(el) => { inputsRef.current['caja_mostac'] = el; }}
                type="number" 
                placeholder="0" 
                value={cajasMostrador} 
                onChange={(e) => setCajasMostrador(e.target.value === '' ? '' : Number(e.target.value))} 
                onFocus={(e) => e.target.select()} 
                className="w-24 bg-gray-900 text-amber-400 font-black text-center text-sm rounded-lg p-2 outline-none focus:border-amber-500 border border-gray-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
            </div>
          </div>

          <textarea
            placeholder="Observaciones de inventario..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none h-16 resize-none"
          />

          <button
            onClick={handleGuardarInventario}
            disabled={!baseGuardada || guardando}
            className={`w-full font-black py-3 rounded-xl text-xs md:text-sm transition-all uppercase shadow-lg ${
              baseGuardada && !guardando
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/60 cursor-pointer opacity-100'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-40'
            }`}
          >
            {guardando ? 'Guardando Inventario...' : `💾 Guardar ${tipoMovimiento}`}
          </button>
        </div>

        {/* COLUMNA DERECHA: PEDIDOS Y CIERRE DE CAJA / NÓMINA */}
        <div className={`space-y-4 transition-opacity ${bloqueadoPorApertura ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'}`}>
          
          {/* MÓDULO PEDIDOS */}
          <div className="bg-[#0d111a] border border-amber-900/50 p-4 rounded-2xl space-y-3 shadow-md">
            <div className="flex justify-between items-center border-b border-amber-900/50 pb-2">
              <h2 className="text-xs md:text-sm font-black text-amber-400 flex items-center gap-1.5">
                🚚 Pedidos de Insumos (Requisición)
              </h2>
              <button
                type="button"
                onClick={() => setMostrarModuloPedidos(!mostrarModuloPedidos)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-xs font-bold transition-colors border border-gray-700"
              >
                {mostrarModuloPedidos ? '👁️ Ocultar Pedidos' : '👁️ Hacer Pedido'}
              </button>
            </div>

            {mostrarModuloPedidos && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                  <button type="button" onClick={() => setCategoriaPedido('paletas')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all ${categoriaPedido === 'paletas' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🍦 Paletas</button>
                  <button type="button" onClick={() => setCategoriaPedido('richi')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all ${categoriaPedido === 'richi' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🛍️ Richi</button>
                  <button type="button" onClick={() => setCategoriaPedido('insumos')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all ${categoriaPedido === 'insumos' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🍫 Insumos</button>
                  <button type="button" onClick={() => setCategoriaPedido('aseo')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all ${categoriaPedido === 'aseo' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🧹 Aseo</button>
                </div>

                {categoriaPedido === 'paletas' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Seleccionar Sabores a Solicitar a Bodega:</span>
                    {paletasFiltradas.map((s, idx) => (
                      <div key={s.id} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                        <div className="truncate">
                          <p className="font-bold text-xs text-white truncate">{s.nombre}</p>
                          <span className="text-[10px] font-semibold text-amber-500 block -mt-0.5 capitalize">
                            {s.categoria || ''}
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
                          className="w-24 bg-gray-950 border border-amber-800/80 text-amber-300 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {categoriaPedido === 'richi' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Plásticos Richi</span>
                    {LISTA_PLASTICOS_RICHI.map((item, idx) => (
                      <div key={item} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item}</span>
                        <input 
                          ref={(el) => { inputsRef.current[`pedido_richi_${item}`] = el; }}
                          type="number" 
                          placeholder="0" 
                          value={cantidadesRichi[item] ?? ''} 
                          onChange={(e) => handleItemGenericoChange(item, e.target.value, setCantidadesRichi)} 
                          onKeyDown={(e) => handleKeyDownPedido(e, idx, LISTA_PLASTICOS_RICHI, 'pedido_richi')}
                          onFocus={(e) => e.target.select()} 
                          className="w-24 bg-gray-950 border border-amber-800/80 text-amber-300 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                      </div>
                    ))}
                  </div>
                )}

                {categoriaPedido === 'insumos' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Insumos y Toppings</span>
                    {LISTA_INSUMOS_MATERIA.map((item, idx) => (
                      <div key={item} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item}</span>
                        <input 
                          ref={(el) => { inputsRef.current[`pedido_ins_${item}`] = el; }}
                          type="number" 
                          placeholder="0" 
                          value={cantidadesInsumos[item] ?? ''} 
                          onChange={(e) => handleItemGenericoChange(item, e.target.value, setCantidadesInsumos)} 
                          onKeyDown={(e) => handleKeyDownPedido(e, idx, LISTA_INSUMOS_MATERIA, 'pedido_ins')}
                          onFocus={(e) => e.target.select()} 
                          className="w-24 bg-gray-950 border border-amber-800/80 text-amber-300 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                      </div>
                    ))}
                  </div>
                )}

                {categoriaPedido === 'aseo' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Implementos de Aseo</span>
                    {LISTA_ASEO.map((item, idx) => (
                      <div key={item} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item}</span>
                        <input 
                          ref={(el) => { inputsRef.current[`pedido_aseo_${item}`] = el; }}
                          type="number" 
                          placeholder="0" 
                          value={cantidadesAseo[item] ?? ''} 
                          onChange={(e) => handleItemGenericoChange(item, e.target.value, setCantidadesAseo)} 
                          onKeyDown={(e) => handleKeyDownPedido(e, idx, LISTA_ASEO, 'pedido_aseo')}
                          onFocus={(e) => e.target.select()} 
                          className="w-24 bg-gray-950 border border-amber-800/80 text-amber-300 font-black text-center rounded-lg p-2 text-sm outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                      </div>
                    ))}
                  </div>
                )}

                <input type="text" placeholder="Otro producto adicional..." value={otroInsumoTexto} onChange={(e) => setOtroInsumoTexto(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white p-2.5 rounded-xl outline-none text-xs" />
                <input type="text" placeholder="Observación general del pedido..." value={obsPedido} onChange={(e) => setObsPedido(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white p-2.5 rounded-xl outline-none text-xs" />

                <button onClick={handleGuardarPedidoInsumos} disabled={guardando} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs uppercase transition-all shadow-md cursor-pointer disabled:opacity-50">
                  {guardando ? 'Guardando pedido...' : '🚀 Enviar Pedido a Bodega'}
                </button>
              </div>
            )}
          </div>

          {/* ARQUEO DE CAJA (SÓLO CIERRE) Y NÓMINA */}
          <div className="bg-[#0d111a] border border-purple-900/50 p-4 rounded-2xl space-y-4 shadow-md">
            <h2 className="text-xs md:text-sm font-black text-purple-300 border-b border-purple-900/50 pb-2 flex justify-between">
              <span>{esTurnoCierre ? '🌙 Cierre de Jornada y Arqueo' : '👥 Cambio de Turno / Nómina'}</span>
              <span className="text-[10px] text-purple-400 font-bold">{esTurnoCierre ? 'Fin de Día' : 'Fin de Turno'}</span>
            </h2>

            {/* SECCIÓN NÓMINA */}
            <div className="space-y-2 bg-gray-950/40 p-3 rounded-xl border border-gray-800/80">
              <span className="text-[10px] font-black text-purple-400 uppercase block">1. Nómina del Operador:</span>
              
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1">Tipo de Día:</label>
                <select value={tipoDia} onChange={(e) => setTipoDia(e.target.value as any)} className="w-full bg-gray-900 border border-gray-800 text-white font-bold text-xs rounded-xl p-2 outline-none cursor-pointer">
                  <option value="entre_semana">Entre semana (lunes a sábado)</option>
                  <option value="domingo_festivo">Domingo / Festivo</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-gray-400 block mb-1 font-bold">Horas Día</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_horas_dia'] = el; }}
                    type="number" 
                    placeholder="0" 
                    value={horasDia} 
                    onChange={(e) => setHorasDia(e.target.value === '' ? '' : Number(e.target.value))} 
                    onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_horas_noche')}
                    onFocus={(e) => e.target.select()} 
                    className="w-full bg-gray-900 border border-gray-800 text-white font-bold text-center rounded-lg p-2 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                </div>
                <div>
                  <span className="text-gray-400 block mb-1 font-bold">Horas Noche</span>
                  <input 
                    ref={(el) => { inputsRef.current['cierre_horas_noche'] = el; }}
                    type="number" 
                    placeholder="0" 
                    value={horasNoche} 
                    onChange={(e) => setHorasNoche(e.target.value === '' ? '' : Number(e.target.value))} 
                    onKeyDown={(e) => handleKeyDownCierre(e, esTurnoCierre ? 'cierre_efectivo' : '')}
                    onFocus={(e) => e.target.select()} 
                    className="w-full bg-gray-900 border border-gray-800 text-white font-bold text-center rounded-lg p-2 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                </div>
              </div>

              <div className="flex justify-between items-center bg-purple-950/40 p-2 rounded-lg border border-purple-800/50 text-xs font-bold text-rose-300">
                <span>Total Nómina:</span>
                <span className="text-sm font-black text-rose-400">$ {totalNomina.toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* SECCIÓN RECAUDO EN CAJA (SOLO SE MUESTRA SI ES TURNO DE CIERRE FINAL) */}
            {esTurnoCierre && (
              <div className="space-y-2 bg-gray-950/40 p-3 rounded-xl border border-gray-800/80">
                <span className="text-[10px] font-black text-emerald-400 uppercase block">2. Arqueo de Caja Final del Día:</span>
                
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-emerald-400 block mb-1 font-bold">💵 Efectivo ($)</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_efectivo'] = el; }}
                      type="text" 
                      placeholder="$ 0" 
                      value={formatearMoneda(efectivoCaja)} 
                      onChange={(e) => setEfectivoCaja(desformatearMoneda(e.target.value))} 
                      onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_nequi')}
                      onFocus={(e) => e.target.select()} 
                      className="w-full bg-gray-900 border border-gray-800 text-emerald-300 font-bold text-center rounded-lg p-2 outline-none" 
                    />
                  </div>
                  <div>
                    <span className="text-purple-400 block mb-1 font-bold">📲 Nequi ($)</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_nequi'] = el; }}
                      type="text" 
                      placeholder="$ 0" 
                      value={formatearMoneda(nequi)} 
                      onChange={(e) => setNequi(desformatearMoneda(e.target.value))} 
                      onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_daviplata')}
                      onFocus={(e) => e.target.select()} 
                      className="w-full bg-gray-900 border border-gray-800 text-purple-300 font-bold text-center rounded-lg p-2 outline-none" 
                    />
                  </div>
                  <div>
                    <span className="text-rose-400 block mb-1 font-bold">📱 Daviplata ($)</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_daviplata'] = el; }}
                      type="text" 
                      placeholder="$ 0" 
                      value={formatearMoneda(daviplata)} 
                      onChange={(e) => setDaviplata(desformatearMoneda(e.target.value))} 
                      onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_gastos')}
                      onFocus={(e) => e.target.select()} 
                      className="w-full bg-gray-900 border border-gray-800 text-rose-300 font-bold text-center rounded-lg p-2 outline-none" 
                    />
                  </div>
                </div>

                {/* GASTOS Y MOTIVO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
                  <div>
                    <span className="text-amber-400 block mb-1 font-bold">🧾 Total Gastos ($)</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_gastos'] = el; }}
                      type="text" 
                      placeholder="$ 0" 
                      value={formatearMoneda(gastos)} 
                      onChange={(e) => setGastos(desformatearMoneda(e.target.value))} 
                      onKeyDown={(e) => handleKeyDownCierre(e, 'cierre_motivo_gasto')}
                      onFocus={(e) => e.target.select()} 
                      className="w-full bg-gray-900 border border-gray-800 text-amber-300 font-bold text-center rounded-lg p-2 outline-none" 
                    />
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-1 font-bold">📝 Motivo del Gasto</span>
                    <input 
                      ref={(el) => { inputsRef.current['cierre_motivo_gasto'] = el; }}
                      type="text" 
                      placeholder="Ej. Compra de hielo, bolsas..." 
                      value={motivoGasto} 
                      onChange={(e) => setMotivoGasto(e.target.value)} 
                      onFocus={(e) => e.target.select()} 
                      className="w-full bg-gray-900 border border-gray-800 text-white text-xs rounded-lg p-2 outline-none" 
                    />
                  </div>
                </div>

                {/* TOTAL ARQUEADO CALCULADO */}
                <div className="flex justify-between items-center bg-gray-900 p-2.5 rounded-xl border border-emerald-800/50 text-xs font-bold mt-2">
                  <span className="text-emerald-400 uppercase font-black">Total Recaudado (Ventas):</span>
                  <span className="text-base font-black text-emerald-300 bg-gray-950 px-3 py-1 rounded-lg border border-emerald-700">
                    $ {totalVentasCalculado.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleGuardarNominaTurno}
              disabled={guardando || (esTurnoCierre && !cierreRealizado)}
              className={`w-full font-black py-3 rounded-xl text-xs md:text-sm transition-all shadow-md cursor-pointer ${
                esTurnoCierre && !cierreRealizado
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/60'
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

      {/* MODAL CAMBIO DE TURNO (SÓLO SI ES TURNO DE MAÑANA) */}
      {mostrarModalCambioTurno && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border border-purple-800/80 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl text-center">
            
            <div className="space-y-1 border-b border-gray-800/80 pb-3">
              <div className="w-12 h-12 bg-purple-950/80 border border-purple-600/50 rounded-2xl flex items-center justify-center mx-auto mb-2 text-xl shadow-lg">
                🔄
              </div>
              <h3 className="text-lg font-black text-white tracking-wide">
                Recepción de Turno
              </h3>
              <p className="text-xs text-gray-400">
                Selecciona al operario entrante e ingresa sus credenciales
              </p>
            </div>

            <div className="space-y-3 text-left">
              <div>
                <label className="text-[11px] font-extrabold text-purple-400 block mb-1 uppercase tracking-wider">
                  ¿Qué turno recibo?
                </label>
                <select
                  value={turnoRecibido}
                  onChange={(e) => setTurnoRecibido(e.target.value)}
                  className="w-full bg-gray-900 border border-purple-800/60 text-white font-bold text-xs rounded-xl p-3 outline-none cursor-pointer focus:border-purple-500"
                >
                  <option value="tarde_cierre">🌙 Tarde / Cierre</option>
                  <option value="manana_apertura">🌅 Mañana / Apertura</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-gray-300 block mb-1 uppercase tracking-wider">
                  Operario que Recibe:
                </label>
                <select
                  value={operarioEntranteId}
                  onChange={(e) => setOperarioEntranteId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-white font-bold text-xs rounded-xl p-3 outline-none cursor-pointer focus:border-purple-500"
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
                <label className="text-[11px] font-extrabold text-gray-300 block mb-1 uppercase tracking-wider">
                  Contraseña / PIN:
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={claveOperarioEntrante}
                  onChange={(e) => setClaveOperarioEntrante(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-gray-950 border border-gray-800 text-purple-300 font-black text-center text-lg rounded-xl p-2.5 outline-none tracking-widest focus:border-purple-500"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMostrarModalCambioTurno(false)}
                className="w-1/3 bg-gray-900 hover:bg-gray-800 text-gray-400 font-bold py-3 rounded-xl text-xs transition-colors border border-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEntrante}
                disabled={validandoEntrante}
                className="w-2/3 bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-xl text-xs transition-all uppercase shadow-lg shadow-purple-900/60 cursor-pointer"
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