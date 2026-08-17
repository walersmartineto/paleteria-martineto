'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerSaboresViva,
  obtenerTarifasViva,
  registrarMovimientoViva,
  registrarBaseCajaViva,
  registrarNominaYCambioTurno,
  crearPedidoInsumosViva,
  obtenerPedidosInsumosViva,
  obtenerUsuariosOperarios,
  SaborPaletaViva,
  TipoMovimientoViva,
  TarifasViva,
} from '@/lib/vivaQueries';

const LISTA_PLASTICOS_RICHI = ['Bolsa Blanca', 'Bolsa de Papel', 'Cucharitas', 'Vaso agua'];
const LISTA_INSUMOS_MATERIA = ['Capacillos', 'Chamoy', 'Chip chocolate', 'Chocolate cobertura Blanco', 'Chocolate Cobertura Negro', 'Flips', 'Galleta oreo', 'Gomitas', 'Grasa', 'Leche condensada', 'Maní', 'Nerds', 'Nutella', 'Pepitas colores', 'Pistacho', 'Plato Mostac', 'Quipitos', 'Sal limón', 'Semillas de girasol', 'Servilletas', 'Tajín', 'Zumo de Limón'];
const LISTA_ASEO = ['Antibacterial', 'Bolsas de basura', 'Clorox', 'Escoba', 'Esponjillas', 'Guantes para aseo', 'Guantes de Nitrilo', 'Jabón de Manos', 'Jabón loza', 'Jabón en polvo', 'Limpia Pisos', 'Líquido Verde', 'Papel higiénico', 'Tapabocas', 'Toallas de papel', 'Trapero', 'Trapitos'];

export default function VivaPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);
  const [sabores, setSabores] = useState<SaborPaletaViva[]>([]);
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
  const [cierreRealizado, setCierreRealizado] = useState(false); // CONTROL DE CONTEO DE CIERRE

  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoViva>('apertura');
  const [cantidades, setCantidades] = useState<{ [saborId: number]: number | '' }>({});
  const [cajasMostrador, setCajasMostrador] = useState<number | ''>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [mostrarSabores, setMostrarSabores] = useState(true);

  const [mostrarModuloPedidos, setMostrarModuloPedidos] = useState(false);
  const [categoriaPedido, setCategoriaPedido] = useState<'paletas' | 'richi' | 'insumos' | 'aseo'>('paletas');
  const [cantidadesPedidoPaletas, setCantidadesPedidoPaletas] = useState<{ [saborId: number]: number | '' }>({});
  const [cantidadesRichi, setCantidadesRichi] = useState<{ [item: string]: number | '' }>({});
  const [cantidadesInsumos, setCantidadesInsumos] = useState<{ [item: string]: number | '' }>({});
  const [cantidadesAseo, setCantidadesAseo] = useState<{ [item: string]: number | '' }>({});
  const [otroInsumoTexto, setOtroInsumoTexto] = useState('');
  const [obsPedido, setObsPedido] = useState('');
  const [listaPedidos, setListaPedidos] = useState<any[]>([]);

  const [tipoDia, setTipoDia] = useState<'entre_semana' | 'domingo_festivo'>('entre_semana');
  const [horasDia, setHorasDia] = useState<number | ''>('');
  const [horasNoche, setHorasNoche] = useState<number | ''>('');
  const [efectivoDejado, setEfectivoDejado] = useState<number | ''>('');

  // ESTADOS MODAL CAMBIO DE TURNO
  const [mostrarModalCambioTurno, setMostrarModalCambioTurno] = useState(false);
  const [listaOperarios, setListaOperarios] = useState<any[]>([]);
  const [operarioEntranteId, setOperarioEntranteId] = useState<string>('');
  const [claveOperarioEntrante, setClaveOperarioEntrante] = useState<string>('');
  const [turnoRecibido, setTurnoRecibido] = useState<string>('tarde_cierre');
  const [validandoEntrante, setValidandoEntrante] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const hDia = Number(horasDia) || 0;
  const hNoche = Number(horasNoche) || 0;
  const valorHoraDia = tipoDia === 'domingo_festivo' ? tarifas.horaDiaFestivo : tarifas.horaDiaEntreSemana;
  const valorHoraNoche = tipoDia === 'domingo_festivo' ? tarifas.horaNocheFestivo : tarifas.horaNocheEntreSemana;
  const totalNomina = tarifas.subsidio + tarifas.transporte + hDia * valorHoraDia + hNoche * valorHoraNoche;

  const esTurnoCierre = sesion?.turno === 'tarde_cierre';

  useEffect(() => {
    const sesionLocal = localStorage.getItem('martineto_session');
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }
    const ses = JSON.parse(sesionLocal);
    setSesion(ses);

    // Si entra directamente en turno tarde/cierre, asumimos caja ya abierta
    if (ses.turno === 'tarde_cierre') {
      setBaseGuardada(true);
      setAperturaRealizada(true);
      setTipoMovimiento('nuevas');
    }

    cargarInicial(ses.sede_id || 2);
  }, [router]);

  async function cargarInicial(sedeId: number) {
    setCargando(true);
    const [listaSabores, configTarifas, peds, operarios] = await Promise.all([
      obtenerSaboresViva(),
      obtenerTarifasViva(),
      obtenerPedidosInsumosViva(sedeId),
      obtenerUsuariosOperarios(),
    ]);

    setSabores(listaSabores);
    setTarifas(configTarifas);
    setListaPedidos(peds);
    setListaOperarios(operarios);

    const inicial: { [saborId: number]: number | '' } = {};
    listaSabores.forEach((s) => (inicial[s.id] = ''));
    setCantidades(inicial);
    setCantidadesPedidoPaletas({ ...inicial });

    setCargando(false);
  }

  function handleCantidadChange(saborId: number, rawVal: string) {
    const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
    setCantidades((prev) => ({ ...prev, [saborId]: val }));
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

    setGuardando(true);
    try {
      await registrarBaseCajaViva(sesion?.sede_id || 2, sesion?.usuario_id, monto);
    } catch (e) {
      console.error('Error al guardar la base:', e);
    } finally {
      setGuardando(false);
      setBaseGuardada(true);
    }
  }

  async function handleGuardarInventario() {
    if (!sesion) return;

    if (!baseGuardada) {
      alert('⚠️ Primero debes guardar la Base Inicial de Caja.');
      return;
    }

    setGuardando(true);
    const numCantidades: { [saborId: number]: number } = {};
    Object.entries(cantidades).forEach(([id, val]) => {
      numCantidades[Number(id)] = Number(val) || 0;
    });

    const exito = await registrarMovimientoViva(
      sesion.sede_id || 2,
      sesion.usuario_id,
      tipoMovimiento,
      numCantidades,
      Number(cajasMostrador) || 0,
      observaciones
    );
    setGuardando(false);

    if (exito) {
      alert(`¡Registro de [${tipoMovimiento.toUpperCase()}] guardado!`);
      
      if (tipoMovimiento === 'apertura') {
        setAperturaRealizada(true);
        setTipoMovimiento('nuevas');
      } else if (tipoMovimiento === 'cierre') {
        setCierreRealizado(true); // MARCA QUE YA REALIZÓ EL CONTEO DE CIERRE
      }

      const limpias: { [saborId: number]: number | '' } = {};
      sabores.forEach((s) => (limpias[s.id] = ''));
      setCantidades(limpias);
      setCajasMostrador('');
      setObservaciones('');
    }
  }

  async function handleGuardarPedidoInsumos() {
    setGuardando(true);
    let detalleItems: { [key: string]: number } = {};

    if (categoriaPedido === 'paletas') {
      Object.entries(cantidadesPedidoPaletas).forEach(([saborId, cant]) => {
        const num = Number(cant) || 0;
        if (num > 0) {
          const saborObj = sabores.find((s) => s.id === Number(saborId));
          if (saborObj) detalleItems[saborObj.nombre] = num;
        }
      });
    } else if (categoriaPedido === 'richi') {
      Object.entries(cantidadesRichi).forEach(([item, cant]) => {
        if (Number(cant) > 0) detalleItems[item] = Number(cant);
      });
    } else if (categoriaPedido === 'insumos') {
      Object.entries(cantidadesInsumos).forEach(([item, cant]) => {
        if (Number(cant) > 0) detalleItems[item] = Number(cant);
      });
    } else if (categoriaPedido === 'aseo') {
      Object.entries(cantidadesAseo).forEach(([item, cant]) => {
        if (Number(cant) > 0) detalleItems[item] = Number(cant);
      });
    }

    if (otroInsumoTexto.trim()) {
      detalleItems[`Otro: ${otroInsumoTexto.trim()}`] = 1;
    }

    if (Object.keys(detalleItems).length === 0) {
      alert('Ingresa al menos una cantidad para realizar el pedido.');
      setGuardando(false);
      return;
    }

    try {
      const ok = await crearPedidoInsumosViva(
        sesion?.sede_id || 2,
        sesion?.usuario_id,
        categoriaPedido,
        detalleItems,
        obsPedido
      );

      if (ok) {
        alert('¡Pedido de insumos registrado correctamente!');
        setCantidadesRichi({});
        setCantidadesInsumos({});
        setCantidadesAseo({});
        const limpiasPaletas: { [saborId: number]: number | '' } = {};
        sabores.forEach((s) => (limpiasPaletas[s.id] = ''));
        setCantidadesPedidoPaletas(limpiasPaletas);
        setOtroInsumoTexto('');
        setObsPedido('');
        setListaPedidos(await obtenerPedidosInsumosViva(sesion?.sede_id || 2));
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

    // SI ES TURNO TARDE/CIERRE, EXIGIMOS CONTEO DE CIERRE PREVIO
    if (esTurnoCierre && !cierreRealizado) {
      alert('⚠️ ATENCIÓN: Debes seleccionar "Conteo de Cierre" en la sección de inventario y guardar el conteo antes de cerrar la jornada.');
      return;
    }

    setGuardando(true);
    const efDejado = Number(efectivoDejado) || 0;

    const ok = await registrarNominaYCambioTurno({
      sedeId: sesion?.sede_id || 2,
      usuarioId: sesion?.usuario_id,
      tipoDia,
      horasDia: hDia,
      horasNoche: hNoche,
      subsidio: tarifas.subsidio,
      transporte: tarifas.transporte,
      totalPagado: totalNomina,
      efectivoDejadoCaja: efDejado,
    });
    setGuardando(false);

    if (ok) {
      if (esTurnoCierre) {
        alert(`¡Cierre de jornada completado con éxito!\nNómina registrada: $${totalNomina.toLocaleString()}\nEfectivo en caja: $${efDejado.toLocaleString()}\n\n¡Hasta mañana!`);
        cerrarSesion();
      } else {
        alert(`¡Nómina del operador saliente registrada!\nTotal Pagado: $${totalNomina.toLocaleString()}\nEfectivo dejado en Caja: $${efDejado.toLocaleString()}\n\nA continuación, ingresa el operario que recibe el turno.`);
        setHorasDia('');
        setHorasNoche('');
        setEfectivoDejado('');
        setMostrarModalCambioTurno(true);
      }
    } else {
      alert('Error al registrar nómina.');
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
        sede_id: sesion?.sede_id || 2,
        turno: turnoRecibido,
      };

      localStorage.setItem('martineto_session', JSON.stringify(nuevaSesion));
      setSesion(nuevaSesion);

      setMostrarModalCambioTurno(false);
      setClaveOperarioEntrante('');
      setOperarioEntranteId('');

      setBaseGuardada(true);
      setAperturaRealizada(true);
      setCierreRealizado(false); // Reinicia para el nuevo operario
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
            {esTurnoCierre && <span className="ml-2 text-amber-400 font-bold">(Turno Tarde / Cierre)</span>}
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
            type="number"
            placeholder="Monto en efectivo $"
            value={baseCaja}
            onChange={(e) => setBaseCaja(e.target.value === '' ? '' : Number(e.target.value))}
            onFocus={(e) => e.target.select()}
            disabled={baseGuardada}
            className="w-full bg-gray-900 border border-gray-800 text-emerald-300 font-black text-sm md:text-base rounded-xl p-3 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
        
        {/* COLUMNA IZQUIERDA: INVENTARIO */}
        <div className="bg-[#0d111a] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
            <h2 className="text-xs md:text-sm font-black text-white">🍦 Conteo por Sabores</h2>
            <span className="text-[11px] text-purple-400 font-bold uppercase">{tipoMovimiento}</span>
          </div>

          <div>
            <label className="text-[11px] text-gray-400 font-bold block mb-1">Acción a registrar:</label>
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value as TipoMovimientoViva)}
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

          <div className="flex items-center justify-between bg-gray-900/60 p-3 rounded-xl border border-gray-800">
            <span className="text-xs md:text-sm font-bold text-amber-400">📦 Cajas Mostac:</span>
            <input
              type="number"
              placeholder="0"
              value={cajasMostrador}
              onChange={(e) => setCajasMostrador(e.target.value === '' ? '' : Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              className="w-24 bg-gray-950 border border-gray-800 text-white font-black text-center rounded-lg p-1.5 text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-bold text-gray-300">Sabores de Paletas:</span>
              <button
                type="button"
                onClick={() => setMostrarSabores(!mostrarSabores)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-xs font-bold transition-colors border border-gray-700"
              >
                {mostrarSabores ? '👁️ Ocultar Lista' : '👁️ Ver Lista'}
              </button>
            </div>

            {mostrarSabores && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                {sabores.map((s) => (
                  <div key={s.id} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                    <div className="truncate">
                      <p className="font-bold text-xs text-white truncate">{s.nombre}</p>
                      <p className="text-[9px] text-gray-500 uppercase">{s.categoria}</p>
                    </div>
                    <input
                      type="number"
                      placeholder="0"
                      value={cantidades[s.id] ?? ''}
                      onChange={(e) => handleCantidadChange(s.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-14 bg-gray-950 border border-gray-800 text-purple-400 font-bold text-center rounded-lg p-1 text-xs outline-none focus:border-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <textarea
            placeholder="Observaciones de inventario..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-xs text-white outline-none h-16 resize-none"
          />

          <button
            onClick={handleGuardarInventario}
            disabled={!baseGuardada}
            className={`w-full font-black py-3 rounded-xl text-xs md:text-sm transition-all uppercase shadow-lg ${
              baseGuardada
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/60 cursor-pointer opacity-100'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-40'
            }`}
          >
            💾 Guardar {tipoMovimiento}
          </button>
        </div>

        {/* COLUMNA DERECHA: PEDIDOS Y NÓMINA */}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                  <button type="button" onClick={() => setCategoriaPedido('paletas')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all ${categoriaPedido === 'paletas' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🍦 Paletas</button>
                  <button type="button" onClick={() => setCategoriaPedido('richi')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all ${categoriaPedido === 'richi' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🛍️ Richi</button>
                  <button type="button" onClick={() => setCategoriaPedido('insumos')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all ${categoriaPedido === 'insumos' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🍫 Insumos</button>
                  <button type="button" onClick={() => setCategoriaPedido('aseo')} className={`py-2 px-1 rounded-xl font-bold border text-center transition-all ${categoriaPedido === 'aseo' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🧹 Aseo</button>
                </div>

                {categoriaPedido === 'paletas' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Seleccionar Sabores de Paletas:</span>
                    {sabores.map((s) => (
                      <div key={s.id} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                        <p className="font-bold text-xs text-white truncate">{s.nombre}</p>
                        <input type="number" placeholder="0" value={cantidadesPedidoPaletas[s.id] ?? ''} onChange={(e) => handleCantidadPedidoChange(s.id, e.target.value)} onFocus={(e) => e.target.select()} className="w-14 bg-gray-950 border border-gray-800 text-amber-400 font-bold text-center rounded-lg p-1 text-xs outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                    ))}
                  </div>
                )}

                {categoriaPedido === 'richi' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Plásticos Richi</span>
                    {LISTA_PLASTICOS_RICHI.map((item) => (
                      <div key={item} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-white">{item}</span>
                        <input type="number" placeholder="0" value={cantidadesRichi[item] ?? ''} onChange={(e) => handleItemGenericoChange(item, e.target.value, setCantidadesRichi)} onFocus={(e) => e.target.select()} className="w-16 bg-gray-950 border border-gray-800 text-amber-400 font-bold text-center rounded-lg p-1 text-xs outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                    ))}
                  </div>
                )}

                {categoriaPedido === 'insumos' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Insumos y Toppings</span>
                    {LISTA_INSUMOS_MATERIA.map((item) => (
                      <div key={item} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item}</span>
                        <input type="number" placeholder="0" value={cantidadesInsumos[item] ?? ''} onChange={(e) => handleItemGenericoChange(item, e.target.value, setCantidadesInsumos)} onFocus={(e) => e.target.select()} className="w-14 bg-gray-950 border border-gray-800 text-amber-400 font-bold text-center rounded-lg p-1 text-xs outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                    ))}
                  </div>
                )}

                {categoriaPedido === 'aseo' && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 border border-gray-800/60 p-2.5 rounded-xl bg-gray-950/40">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Implementos de Aseo</span>
                    {LISTA_ASEO.map((item) => (
                      <div key={item} className="bg-gray-900/60 border border-gray-800 p-2 rounded-xl flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item}</span>
                        <input type="number" placeholder="0" value={cantidadesAseo[item] ?? ''} onChange={(e) => handleItemGenericoChange(item, e.target.value, setCantidadesAseo)} onFocus={(e) => e.target.select()} className="w-14 bg-gray-950 border border-gray-800 text-amber-400 font-bold text-center rounded-lg p-1 text-xs outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                    ))}
                  </div>
                )}

                <input type="text" placeholder="Otro producto adicional..." value={otroInsumoTexto} onChange={(e) => setOtroInsumoTexto(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white p-2.5 rounded-xl outline-none text-xs" />
                <input type="text" placeholder="Observación general del pedido..." value={obsPedido} onChange={(e) => setObsPedido(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white p-2.5 rounded-xl outline-none text-xs" />

                <button onClick={handleGuardarPedidoInsumos} disabled={guardando} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs uppercase transition-all shadow-md cursor-pointer disabled:opacity-50">
                  {guardando ? 'Guardando pedido...' : '🚀 Enviar Pedido a Producción / Bodega'}
                </button>

                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 pt-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Últimos Pedidos Solicitados:</span>
                  {listaPedidos.length === 0 ? (
                    <p className="text-[11px] text-gray-500 text-center py-1">No hay solicitudes recientes.</p>
                  ) : (
                    listaPedidos.map((p) => (
                      <div key={p.id} className="bg-gray-900/80 border border-gray-800 p-2.5 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-white text-[11px] uppercase">📦 Pedido {p.categoria}</span>
                          <span className="text-amber-400 text-[10px] font-black uppercase">[{p.estado}]</span>
                        </div>
                        <pre className="text-[10px] text-gray-300 font-sans whitespace-pre-wrap">{JSON.stringify(p.detalle_items, null, 2)}</pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CAMBIO DE TURNO O CIERRE FINAL DE JORNADA */}
          <div className="bg-[#0d111a] border border-purple-900/50 p-4 rounded-2xl space-y-3 shadow-md">
            <h2 className="text-xs md:text-sm font-black text-purple-300 border-b border-purple-900/50 pb-2 flex justify-between">
              <span>{esTurnoCierre ? '🌙 Cierre de Jornada y Nómina' : '👥 Cambio de Turno y Pago Nómina'}</span>
              <span className="text-[10px] text-purple-400 font-bold">{esTurnoCierre ? 'Fin de Día' : 'Fin de Turno'}</span>
            </h2>

            <div>
              <label className="text-[11px] text-gray-400 font-bold block mb-1">Tipo de Día:</label>
              <select value={tipoDia} onChange={(e) => setTipoDia(e.target.value as any)} className="w-full bg-gray-900 border border-gray-800 text-white font-bold text-xs rounded-xl p-2.5 outline-none cursor-pointer">
                <option value="entre_semana">Entre semana (lunes a sábado)</option>
                <option value="domingo_festivo">Domingo / Festivo</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-gray-400 block mb-1 font-bold">Subsidio ($)</span>
                <input type="text" readOnly value={`$${tarifas.subsidio.toLocaleString()}`} className="w-full bg-gray-900/80 border border-gray-800 text-amber-400 font-bold text-center rounded-lg p-2 outline-none cursor-not-allowed opacity-80" />
              </div>
              <div>
                <span className="text-gray-400 block mb-1 font-bold">Transporte ($)</span>
                <input type="text" readOnly value={`$${tarifas.transporte.toLocaleString()}`} className="w-full bg-gray-900/80 border border-gray-800 text-amber-400 font-bold text-center rounded-lg p-2 outline-none cursor-not-allowed opacity-80" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-gray-400 block mb-1 font-bold">Horas Día</span>
                <input type="number" placeholder="0" value={horasDia} onChange={(e) => setHorasDia(e.target.value === '' ? '' : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-full bg-gray-950 border border-gray-800 text-white font-bold text-center rounded-lg p-2 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div>
                <span className="text-gray-400 block mb-1 font-bold">Horas Noche</span>
                <input type="number" placeholder="0" value={horasNoche} onChange={(e) => setHorasNoche(e.target.value === '' ? '' : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-full bg-gray-950 border border-gray-800 text-white font-bold text-center rounded-lg p-2 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>

            <div className="bg-gray-900/80 p-3 rounded-xl space-y-2 border border-gray-800 text-xs">
              <div className="flex justify-between items-center text-rose-400 font-bold">
                <span>Total Pago Operario:</span>
                <span className="text-sm md:text-base font-black">${totalNomina.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-800">
                <span className="text-gray-300 font-bold text-[11px]">Efectivo dejado en Caja:</span>
                <input type="number" placeholder="$ Dejado" value={efectivoDejado} onChange={(e) => setEfectivoDejado(e.target.value === '' ? '' : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-28 bg-gray-950 border border-gray-800 text-emerald-400 font-black text-center rounded-lg p-1.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>

            {/* BOTÓN DINÁMICO SEGÚN TURNO */}
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
                  ? '🌙 Registrar Cierre Final y Nómina'
                  : '⚠️ Haz el Conteo de Cierre Primero'
                : '💾 Registrar Cambio de Turno / Nómina'}
            </button>
          </div>

        </div>
      </div>

      {/* MODAL IDÉNTICO AL LOGIN: ¿QUÉ TURNO RECIBO? */}
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