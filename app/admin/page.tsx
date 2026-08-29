'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSede } from '@/context/SedeContext';

const obtenerFechaLocalStr = (fechaRaw: any): string => {
  if (!fechaRaw) return '';
  const d = new Date(fechaRaw);
  if (isNaN(d.getTime())) return String(fechaRaw).split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const obtenerHoraLocalStr = (fechaRaw: any): string => {
  if (!fechaRaw) return '--:--';
  const d = new Date(fechaRaw);
  if (isNaN(d.getTime())) return String(fechaRaw);
  try {
    return d.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'America/Bogota' 
    });
  } catch (e) {
    const horas = d.getHours();
    const minutos = d.getMinutes();
    const h12 = horas % 12 || 12;
    const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
    return `${String(h12).padStart(2, '0')}:${String(minutos).padStart(2, '0')} ${ampm}`;
  }
};

export default function AdminPage() {
  const router = useRouter();
  const { sedeData } = useSede();

  const fechaHoy = new Date().toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState<string>(fechaHoy);
  const [fechaFin, setFechaFin] = useState<string>(fechaHoy);
  const [sedeSeleccionada, setSedeSeleccionada] = useState<string>('todos');

  const [acordeonAperturaAbierto, setAcordeonAperturaAbierto] = useState<boolean>(true);
  const [moduloAbierto, setModuloAbierto] = useState<string | null>('cierres');
  const [subPestanaLogistica, setSubPestanaLogistica] = useState<'compras' | 'despachos'>('compras');
  const [subPestanaCierres, setSubPestanaCierres] = useState<'caja' | 'descuadres'>('caja');
  const [acordeonBISedeAbierto, setAcordeonBISedeAbierto] = useState<{ [nombreSede: string]: boolean }>({});

  const [resumenNominaOperarios, setResumenNominaOperarios] = useState<any[]>([]);
  const [sedesBD, setSedesBD] = useState<any[]>([]);
  const [mapaSedes, setMapaSedes] = useState<{ [id: number]: string }>({});
  const [usuariosBD, setUsuariosBD] = useState<{ [id: number]: string }>({});
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pedidos30Dias, setPedidos30Dias] = useState<any[]>([]);
  const [pedidosPendientesGlobal, setPedidosPendientesGlobal] = useState<any[]>([]);
  const [productosBD, setProductosBD] = useState<any[]>([]);
  const [registrosCaja, setRegistrosCaja] = useState<any[]>([]);
  const [registrosNomina, setRegistrosNomina] = useState<any[]>([]);
  const [inventarioMovimientos, setInventarioMovimientos] = useState<any[]>([]);
  const [inventarioMovsDia, setInventarioMovsDia] = useState<any[]>([]);
  const [inventarioEmpaquesSedesBD, setInventarioEmpaquesSedesBD] = useState<any[]>([]);
  const [historicoVentasBD, setHistoricoVentasBD] = useState<any[]>([]);
  const [historicoVentas30DiasBD, setHistoricoVentas30DiasBD] = useState<any[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [editandoProveedor, setEditandoProveedor] = useState<{ [nombre: string]: string }>({});

  const [itemsChequeados, setItemsChequeados] = useState<{ [key: string]: boolean }>({});

  const [acordeonesCompras, setAcordeonesCompras] = useState<{ [key: string]: boolean }>({});
  const [acordeonesDespachos, setAcordeonesDespachos] = useState<{ [key: string]: boolean }>({});
  const [acordeonesCierres, setAcordeonesCierres] = useState<{ [key: string]: boolean }>({ global: true });
  const [acordeonesDescuadres, setAcordeonesDescuadres] = useState<{ [key: string]: boolean }>({});
  const [acordeonesInventario, setAcordeonesInventario] = useState<{ [key: string]: boolean }>({});
  const [acordeonesResumenSedes, setAcordeonesResumenSedes] = useState<{ [key: string]: boolean }>({ global: true });
  const [acordeonesConsolidadoCompras, setAcordeonesConsolidadoCompras] = useState<{ [key: string]: boolean }>({ global: true });
  const [acordeonesVentasAbanico, setAcordeonesVentasAbanico] = useState<{ [key: string]: boolean }>({});
  const [acordeonesRappi, setAcordeonesRappi] = useState<{ [key: string]: boolean }>({ global: true });
  
  const [acordeonProyeccionMain, setAcordeonProyeccionMain] = useState<boolean>(true);
  const [acordeonesProyeccionSedes, setAcordeonesProyeccionSedes] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    cargarDatosAdmin();
  }, [fechaInicio, fechaFin]);

  async function cargarDatosAdmin() {
    setCargando(true);
    try {
      const { data: sedesData } = await supabase.from('sede').select('id, nombre');
      let sedesReales: any[] = [];
      if (sedesData) {
        sedesReales = sedesData.filter((s) => {
          const n = String(s.nombre || '').toLowerCase();
          return n.includes('viva') || n.includes('centro') || n.includes('martineto') || n.includes('ositos');
        });

        setSedesBD(sedesReales);
        const mapa: { [id: number]: string } = {};
        sedesReales.forEach((s) => { mapa[s.id] = s.nombre; });
        setMapaSedes(mapa);
      }

      const { data: usuariosData } = await supabase.from('usuario').select('id, nombre_completo');
      const mapaU: { [id: number]: string } = {};
      if (usuariosData) {
        usuariosData.forEach((u) => { mapaU[u.id] = u.nombre_completo; });
        setUsuariosBD(mapaU);
      }

      const fechaHoyObj = new Date();
      const hace30DiasObj = new Date();
      hace30DiasObj.setDate(fechaHoyObj.getDate() - 30);
      const fechaHace30DiasStr = hace30DiasObj.toISOString().split('T')[0];

      const { data: pedidosDataRaw } = await supabase.from('pedidos_insumos').select('*');
      
      const pedidosData = (pedidosDataRaw || []).filter(row => {
        if (!row.fecha) return false;
        const fRow = obtenerFechaLocalStr(row.fecha);
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

      const pedidos30DiasFiltrado = (pedidosDataRaw || []).filter(row => {
        if (!row.fecha) return false;
        const fRow = obtenerFechaLocalStr(row.fecha);
        return fRow >= fechaHace30DiasStr;
      });

      const pendientesGlobales = (pedidosDataRaw || []).filter(row => row.estado === 'pendiente' || row.estado === 'comprado');
      setPedidosPendientesGlobal(pendientesGlobales);

      const { data: prodData } = await supabase.from('producto').select('id, nombre, donde_comprar, categoria');

      // 1. Cargar datos de caja de las demás sedes
      const { data: cajaDataRaw } = await supabase.from('caja').select('*');
      const cajaDataFiltrada = (cajaDataRaw || []).filter(row => {
        if (!row.fecha) return false;
        const fRow = obtenerFechaLocalStr(row.fecha);
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

      // 2. Lógica exclusiva para Martineto
      const martinetoSede = sedesReales.find((s: any) => String(s.nombre || '').toLowerCase().includes('martineto'));
      const martinetoId = martinetoSede ? martinetoSede.id : null;

      let registrosCajaFinales = cajaDataFiltrada.filter(r => Number(r.sede_id) !== Number(martinetoId));

      if (martinetoId) {
        // A. Sumatoria SQL de la tabla 'venta' filtrada por el rango de los calendarios
        const { data: ventasMartinetoRaw } = await supabase.from('venta').select('*');
        const ventasMartinetoFiltradas = (ventasMartinetoRaw || []).filter(row => {
          if (!row.fecha_hora) return false;
          const fRow = obtenerFechaLocalStr(row.fecha_hora);
          return fRow >= fechaInicio && fRow <= fechaFin;
        });

        let totalEfectivoMartineto = 0;
        let totalNequiMartineto = 0;
        let totalDaviplataMartineto = 0;

        ventasMartinetoFiltradas.forEach(v => {
          totalEfectivoMartineto += Number(v.pago_efectivo || 0);
          totalNequiMartineto += Number(v.pago_nequi || 0);
          totalDaviplataMartineto += Number(v.pago_daviplata || 0);
        });

        // B. Extraer el efectivo_cierre y base_inicial de la tabla 'caja' para Martineto en ese rango
        const cierresCajaMartineto = (cajaDataRaw || []).filter(row => {
          if (Number(row.sede_id) !== Number(martinetoId)) return false;
          if (!row.fecha) return false;
          const fRow = obtenerFechaLocalStr(row.fecha);
          return fRow >= fechaInicio && fRow <= fechaFin;
        });

        const ultimoCierreMartineto = cierresCajaMartineto.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())[0];
        const efectivoFisicoContadoMartineto = ultimoCierreMartineto && ultimoCierreMartineto.efectivo_cierre !== undefined && ultimoCierreMartineto.efectivo_cierre !== null
          ? Number(ultimoCierreMartineto.efectivo_cierre)
          : totalEfectivoMartineto;

        const baseInicialMartineto = (ultimoCierreMartineto && ultimoCierreMartineto.base_inicial !== undefined && ultimoCierreMartineto.base_inicial !== null)
          ? Number(ultimoCierreMartineto.base_inicial)
          : 0;

        registrosCajaFinales.push({
          sede_id: martinetoId,
          fecha: new Date().toISOString(),
          created_at: new Date().toISOString(),
          efectivo_recibido: totalEfectivoMartineto,
          nequi: totalNequiMartineto,
          daviplata: totalDaviplataMartineto,
          efectivo_fisico: efectivoFisicoContadoMartineto,
          monto_gasto: 0,
          rappi: 0,
          descuento: 0,
          base_inicial: baseInicialMartineto,
          estado: 'cerrada'
        });
      }

      const { data: nominaDataRaw } = await supabase.from('nomina').select('*');
      const nominaData = (nominaDataRaw || []).filter(row => {
        const fRow = row.fecha_pago 
          ? String(row.fecha_pago).split('T')[0] 
          : (row.fecha ? obtenerFechaLocalStr(row.fecha) : '');
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

      const { data: historicoVentasRaw } = await supabase.from('historico_ventas').select('*');
      const historicoVentasFiltrado = (historicoVentasRaw || []).filter(row => {
        if (!row.fecha) return false;
        const fRow = obtenerFechaLocalStr(row.fecha);
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

      const historicoVentas30DiasFiltrado = (historicoVentasRaw || []).filter(row => {
        if (!row.fecha) return false;
        const fRow = obtenerFechaLocalStr(row.fecha);
        return fRow >= fechaHace30DiasStr;
      });

      const acumulado: { [usuarioId: number]: { 
        nombre: string; 
        horasDia: number; 
        horasNoche: number; 
        totalPagado: number;
        turnosCount: number;
      }} = {};

      nominaData.forEach(row => {
        const uId = row.usuario_id;
        const nombre = mapaU[uId] || `Operario #${uId}`;
        const hDia = Number(row.horas_dia || 0);
        const hNoche = Number(row.horas_noche || 0);
        const total = Number(row.monto || row.total_pagado || 0);

        if (!acumulado[uId]) {
          acumulado[uId] = {
            nombre,
            horasDia: 0,
            horasNoche: 0,
            totalPagado: 0,
            turnosCount: 0
          };
        }

        acumulado[uId].horasDia += hDia;
        acumulado[uId].horasNoche += hNoche;
        acumulado[uId].totalPagado += total;
        acumulado[uId].turnosCount += 1;
      });

      setResumenNominaOperarios(Object.values(acumulado));

      const { data: diffDataRaw } = await supabase.from('diferencia_inventario').select('*');
      const diffDataFiltrado = (diffDataRaw || []).filter(row => {
        if (!row.fecha_registro) return false;
        const fRow = obtenerFechaLocalStr(row.fecha_registro);
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

      const { data: invDiarioRaw } = await supabase.from('inventario_diario').select('*');
      setInventarioMovsDia(invDiarioRaw || []);

      const { data: empaquesSedesData } = await supabase.from('inventario_empaques_sedes').select('*');

      setPedidos(pedidosData);
      setPedidos30Dias(pedidos30DiasFiltrado);
      setProductosBD(prodData || []);
      setRegistrosCaja(registrosCajaFinales);
      setRegistrosNomina(nominaData);
      setInventarioMovimientos(diffDataFiltrado);
      setInventarioEmpaquesSedesBD(empaquesSedesData || []);
      setHistoricoVentasBD(historicoVentasFiltrado);
      setHistoricoVentas30DiasBD(historicoVentas30DiasFiltrado);
      setItemsChequeados({});
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setCargando(false);
    }
  }

  const getNombreSede = (id: number) => mapaSedes[id] || `Sede ${id}`;
  const getNombreUsuario = (id: number) => usuariosBD[id] || `Empleado #${id}`;

  const controlAperturaSedes = (() => {
    return sedesBD.map(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);

      const registrosCajaSede = registrosCaja
        .filter(c => Number(c.sede_id) === idSede)
        .sort((a, b) => new Date(b.created_at || b.fecha || 0).getTime() - new Date(a.created_at || a.fecha || 0).getTime());

      const regCajaActual = registrosCajaSede[0];
      const regInvApertura = inventarioMovsDia.find(m => Number(m.sede_id) === idSede && String(m.tipo_movimiento || '').toLowerCase().trim() === 'apertura' && obtenerFechaLocalStr(m.fecha_registro) === fechaInicio);

      const estaAbierta = regCajaActual ? (regCajaActual.estado === 'abierta' || regCajaActual.tipo === 'apertura') : false;
      const estadoCaja = regCajaActual 
        ? (estaAbierta ? '🟢 Abierta' : '🔒 Cerrada') 
        : (regInvApertura ? '🟢 Abierta' : '🔒 Pendiente');

      const timestampRaw = regCajaActual?.created_at || regCajaActual?.fecha || regInvApertura?.fecha_registro;
      const horaApertura = timestampRaw ? obtenerHoraLocalStr(timestampRaw) : '--:--';

      const paletasContadas = regInvApertura?.total_paletas !== undefined && regInvApertura?.total_paletas !== null 
        ? `✅ ${regInvApertura.total_paletas} unids` 
        : '⚠️ Pendiente';

      const tieneEmpaques = regInvApertura?.detalle_empaques && Object.keys(regInvApertura.detalle_empaques).length > 0;
      const insumosContados = tieneEmpaques ? '✅ Registrados' : '⚠️ Pendiente';

      const idUsuarioOp = regCajaActual?.usuario_id || regInvApertura?.usuario_id;
      const operario = idUsuarioOp ? getNombreUsuario(idUsuarioOp) : (regCajaActual?.operario_nombre || '--');

      return {
        idSede,
        nombreSede,
        horaApertura,
        estadoCaja,
        paletasContadas,
        insumosContados,
        operario
      };
    });
  })();

  const pedidosPendientesCompra = pedidos.filter(p => p.estado === 'pendiente');
  const pedidosListosParaEntrega = pedidos.filter(p => p.estado === 'comprado');

  const consolidadoCompras = (() => {
    const mapaProveedores: { [prov: string]: { items: any; idsPedidosSet: Set<number> } } = {};
    pedidosPendientesCompra.forEach(p => {
      if (sedeSeleccionada !== 'todos' && String(p.sede_id) !== sedeSeleccionada) return;
      if (!mapaSedes[p.sede_id]) return;

      const jsonItems = { 
        ...(p.pedidos_paletas || {}), 
        ...(p.pedidos_richi || {}), 
        ...(p.pedidos_produccion || {}), 
        ...(p.pedidos_insumos || {}), 
        ...(p.pedidos_aseo || {}) 
      };

      Object.entries(jsonItems).forEach(([nombreProd, cantidad]) => {
        const cantNum = Number(cantidad) || 0;
        if (cantNum <= 0) return;

        const prodEnBD = productosBD.find(item => String(item.nombre).trim().toLowerCase() === String(nombreProd).trim().toLowerCase());
        const prov = prodEnBD?.donde_comprar && prodEnBD.donde_comprar.trim() !== '' ? prodEnBD.donde_comprar : '⚠️ Faltan datos de dónde comprar';

        if (!mapaProveedores[prov]) mapaProveedores[prov] = { items: {}, idsPedidosSet: new Set() };
        mapaProveedores[prov].idsPedidosSet.add(p.id);

        if (!mapaProveedores[prov].items[nombreProd]) {
          mapaProveedores[prov].items[nombreProd] = { cantidad: 0, idProd: prodEnBD?.id, idsPedidos: [] };
        }
        mapaProveedores[prov].items[nombreProd].cantidad += cantNum;
        if (!mapaProveedores[prov].items[nombreProd].idsPedidos.includes(p.id)) {
          mapaProveedores[prov].items[nombreProd].idsPedidos.push(p.id);
        }
      });
    });
    return mapaProveedores;
  })();

  const resumenComprasPorSede = (() => {
    const mapa: { [nombreSede: string]: { [prod: string]: number } } = {};
    pedidosPendientesCompra.forEach(p => {
      if (!mapaSedes[p.sede_id]) return;
      const nombreSede = getNombreSede(p.sede_id);
      if (sedeSeleccionada !== 'todos' && String(p.sede_id) !== sedeSeleccionada) return;

      if (!mapa[nombreSede]) mapa[nombreSede] = {};
      const jsonItems = { 
        ...(p.pedidos_paletas || {}), 
        ...(p.pedidos_richi || {}), 
        ...(p.pedidos_produccion || {}), 
        ...(p.pedidos_insumos || {}), 
        ...(p.pedidos_aseo || {}) 
      };
      
      Object.entries(jsonItems).forEach(([k, v]) => {
        const cant = Number(v) || 0;
        if (cant > 0) {
          mapa[nombreSede][k] = (mapa[nombreSede][k] || 0) + cant;
        }
      });
    });
    return mapa;
  })();

  const despachosPorSede = (() => {
    const mapaSedesObj: { [sede: string]: { productos: any; idsPedidos: number[] } } = {};
    pedidosListosParaEntrega.forEach(p => {
      if (!mapaSedes[p.sede_id]) return;
      const nombreSede = getNombreSede(p.sede_id);
      if (sedeSeleccionada !== 'todos' && String(p.sede_id) !== sedeSeleccionada) return;
      if (!mapaSedesObj[nombreSede]) mapaSedesObj[nombreSede] = { productos: {}, idsPedidos: [] };
      if (!mapaSedesObj[nombreSede].idsPedidos.includes(p.id)) mapaSedesObj[nombreSede].idsPedidos.push(p.id);

      const jsonItems = { 
        ...(p.pedidos_paletas || {}), 
        ...(p.pedidos_richi || {}), 
        ...(p.pedidos_produccion || {}), 
        ...(p.pedidos_insumos || {}), 
        ...(p.pedidos_aseo || {}) 
      };

      Object.entries(jsonItems).forEach(([k, v]) => {
        const cant = Number(v) || 0;
        if (cant > 0) mapaSedesObj[nombreSede].productos[k] = (mapaSedesObj[nombreSede].productos[k] || 0) + cant;
      });
    });
    return mapaSedesObj;
  })();

  const tieneProductosPorComprar = Object.keys(consolidadoCompras).length > 0;
  const tieneProductosPorEntregar = Object.keys(despachosPorSede).length > 0;

  const CierreGlobal = (() => {
    const totalCaja = registrosCaja.reduce((acc, row) => {
      if (!mapaSedes[row.sede_id]) return acc;
      const efec = Number(row.efectivo_recibido !== undefined && row.efectivo_recibido !== null ? row.efectivo_recibido : (row.efectivo_cierre !== undefined && row.efectivo_cierre !== null ? row.efectivo_cierre : row.efectivo)) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      const gas = Number(row.monto_gasto) || 0;
      return {
        efectivo: acc.efectivo + efec,
        nequi: acc.nequi + neq,
        daviplata: acc.daviplata + dav,
        gastos: acc.gastos + gas,
        totalVenta: acc.totalVenta + (efec + neq + dav)
      };
    }, { efectivo: 0, nequi: 0, daviplata: 0, gastos: 0, totalVenta: 0 });

    const totalNominaBD = registrosNomina.reduce((acc, n) => {
      if (!mapaSedes[n.sede_id]) return acc;
      return acc + (Number(n.monto) || 0);
    }, 0);

    return {
      ...totalCaja,
      nomina: totalNominaBD,
      ventaNeto: totalCaja.totalVenta - totalCaja.gastos - totalNominaBD
    };
  })();

  const comparativoMetodosPago = (() => {
    let efectivoTotal = 0;
    let nequiTotal = 0;
    let daviplataTotal = 0;
    let totalGeneralPagos = 0;

    const porSede: { [nombreSede: string]: { efectivo: number; nequi: number; daviplata: number; total: number } } = {};

    registrosCaja.forEach(row => {
      if (!mapaSedes[row.sede_id]) return;
      const nombreSede = getNombreSede(row.sede_id);
      if (sedeSeleccionada !== 'todos' && String(row.sede_id) !== sedeSeleccionada) return;

      const efec = Number(row.efectivo_recibido !== undefined && row.efectivo_recibido !== null ? row.efectivo_recibido : (row.efectivo_cierre !== undefined && row.efectivo_cierre !== null ? row.efectivo_cierre : row.efectivo)) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      const sumaFila = efec + neq + dav;

      efectivoTotal += efec;
      nequiTotal += neq;
      daviplataTotal += dav;
      totalGeneralPagos += sumaFila;

      if (!porSede[nombreSede]) {
        porSede[nombreSede] = { efectivo: 0, nequi: 0, daviplata: 0, total: 0 };
      }
      porSede[nombreSede].efectivo += efec;
      porSede[nombreSede].nequi += neq;
      porSede[nombreSede].daviplata += dav;
      porSede[nombreSede].total += sumaFila;
    });

    const maxPago = totalGeneralPagos > 0 ? totalGeneralPagos : 1;
    const porcEfectivo = Math.round((efectivoTotal / maxPago) * 100);
    const porcNequi = Math.round((nequiTotal / maxPago) * 100);
    const porcDaviplata = Math.round((daviplataTotal / maxPago) * 100);

    return {
      efectivoTotal,
      nequiTotal,
      daviplataTotal,
      totalGeneralPagos,
      porcEfectivo,
      porcNequi,
      porcDaviplata,
      porSede
    };
  })();

  const cierresPorSede = (() => {
    const mapa: { [sede: string]: any } = {};

    const registrosOrdenados = [...registrosCaja].sort((a, b) => {
      return (a.id || 0) - (b.id || 0);
    });

    registrosOrdenados.forEach(row => {
      if (!mapaSedes[row.sede_id]) return;
      const nombreSede = getNombreSede(row.sede_id);
      if (sedeSeleccionada !== 'todos' && String(row.sede_id) !== sedeSeleccionada) return;

      // CORRECCIÓN: Respetar valor real de base_inicial si existe en BD
      const baseInicial = (row.base_inicial !== undefined && row.base_inicial !== null)
        ? Number(row.base_inicial)
        : 0;
      
      const efecRecibido = Number(row.efectivo_recibido !== undefined && row.efectivo_recibido !== null ? row.efectivo_recibido : (row.efectivo_cierre !== undefined && row.efectivo_cierre !== null ? row.efectivo_cierre : row.efectivo)) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      const gas = Number(row.monto_gasto) || 0;
      const rappiVal = Number(row.rappi) || 0;
      const descuentoVal = Number(row.descuento) || 0;

      if (!mapa[nombreSede]) {
        mapa[nombreSede] = {
          baseInicial: baseInicial,
          efectivoRecibido: 0,
          nequi: 0,
          daviplata: 0,
          gastos: 0,
          nomina: 0,
          rappi: 0,
          descuentos: 0,
          totalVenta: 0,
          efectivoEsperado: 0,
          efectivoFisicoContado: 0,
          descuadreCaja: 0,
          motivoDescuadre: [],
          motivosGastos: [],
          notasNomina: [],
          estadoCaja: 'cerrada'
        };
      } else {
        // En caso de múltiples registros acumulados, actualizamos la base inicial con la más reciente
        if (row.base_inicial !== undefined && row.base_inicial !== null) {
          mapa[nombreSede].baseInicial = Number(row.base_inicial);
        }
      }

      mapa[nombreSede].efectivoRecibido += efecRecibido;
      mapa[nombreSede].nequi += neq;
      mapa[nombreSede].daviplata += dav;
      mapa[nombreSede].gastos += gas;
      mapa[nombreSede].rappi += rappiVal;
      mapa[nombreSede].descuentos += descuentoVal;
      
      if (row.motivo_gasto) mapa[nombreSede].motivosGastos.push(row.motivo_gasto);
      if (row.motivo_descuadre) mapa[nombreSede].motivoDescuadre.push(row.motivo_descuadre);
      
      if (row.efectivo_fisico !== undefined && row.efectivo_fisico !== null) {
        mapa[nombreSede].efectivoFisicoContado = Number(row.efectivo_fisico);
      } else if (row.efectivo_cierre !== undefined && row.efectivo_cierre !== null) {
        mapa[nombreSede].efectivoFisicoContado = Number(row.efectivo_cierre);
      } else {
        mapa[nombreSede].efectivoFisicoContado = efecRecibido;
      }

      if (row.estado) {
        mapa[nombreSede].estadoCaja = row.estado;
      }
    });

    registrosNomina.forEach(n => {
      if (!mapaSedes[n.sede_id]) return;
      const nombreSede = getNombreSede(n.sede_id);
      if (sedeSeleccionada !== 'todos' && String(n.sede_id) !== sedeSeleccionada) return;
      const montoPago = Number(n.monto) || 0;

      if (!mapa[nombreSede]) {
        mapa[nombreSede] = {
          baseInicial: 0,
          efectivoRecibido: 0,
          nequi: 0,
          daviplata: 0,
          gastos: 0,
          nomina: 0,
          rappi: 0,
          descuentos: 0,
          totalVenta: 0,
          efectivoEsperado: 0,
          efectivoFisicoContado: 0,
          descuadreCaja: 0,
          motivoDescuadre: [],
          motivosGastos: [],
          notasNomina: [],
          estadoCaja: 'cerrada'
        };
      }

      mapa[nombreSede].nomina += montoPago;
      const empleadoNombre = n.usuario_id ? getNombreUsuario(n.usuario_id) : (n.concepto || 'Pago turno');
      const horaPago = n.created_at ? obtenerHoraLocalStr(n.created_at) : '';
      mapa[nombreSede].notasNomina.push(`${empleadoNombre} ${horaPago ? `(${horaPago})` : ''}: $${montoPago.toLocaleString()}`);
    });

    Object.keys(mapa).forEach(sKey => {
      const item = mapa[sKey];
      item.efectivoEsperado = (item.baseInicial + item.efectivoRecibido) - item.gastos - item.nomina;
      item.descuadreCaja = item.efectivoFisicoContado - item.efectivoEsperado;
      item.totalVenta = item.efectivoRecibido + item.nequi + item.daviplata;
    });

    return mapa;
  })();

  const rappiYDescuentosData = (() => {
    let totalRappiGlobal = 0;
    let totalDescuentosGlobal = 0;
    const porSede: { 
      [nombreSede: string]: { 
        totalRappi: number; 
        totalDescuentos: number; 
        registros: any[] 
      } 
    } = {};

    registrosCaja.forEach(row => {
      if (!mapaSedes[row.sede_id]) return;
      const nombreSede = getNombreSede(row.sede_id);
      if (sedeSeleccionada !== 'todos' && String(row.sede_id) !== sedeSeleccionada) return;

      const valRappi = Number(row.rappi) || 0;
      const valDescuento = Number(row.descuento) || 0;

      if (valRappi > 0 || valDescuento > 0) {
        totalRappiGlobal += valRappi;
        totalDescuentosGlobal += valDescuento;

        if (!porSede[nombreSede]) {
          porSede[nombreSede] = { totalRappi: 0, totalDescuentos: 0, registros: [] };
        }
        porSede[nombreSede].totalRappi += valRappi;
        porSede[nombreSede].totalDescuentos += valDescuento;
        porSede[nombreSede].registros.push(row);
      }
    });

    return { totalRappiGlobal, totalDescuentosGlobal, porSede };
  })();

  const historicoMermasCriticas = (() => {
    const mapaMermas: { 
      [nombreSede: string]: { 
        totalDiferenciaAcumulada: number; 
        registros: any[];
        frecuenciaItems: { [producto: string]: number };
      } 
    } = {};

    inventarioMovimientos.forEach(row => {
      const idSede = row.sede_id;
      if (!mapaSedes[idSede]) return;
      const nombreSede = getNombreSede(idSede);
      if (sedeSeleccionada !== 'todos' && String(idSede) !== sedeSeleccionada) return;

      const totalDif = Number(row.total_diferencia) || 0;
      const jsonPaletas = row.diferencia_paletas || {};
      const jsonEmpaques = row.diferencia_empaques || {};
      const combinados = { ...jsonPaletas, ...jsonEmpaques };

      if (!mapaMermas[nombreSede]) {
        mapaMermas[nombreSede] = {
          totalDiferenciaAcumulada: 0,
          registros: [],
          frecuenciaItems: {}
        };
      }

      mapaMermas[nombreSede].totalDiferenciaAcumulada += totalDif;
      mapaMermas[nombreSede].registros.push(row);

      Object.entries(combinados).forEach(([prod, cant]) => {
        const cNum = Number(cant) || 0;
        if (cNum !== 0) {
          mapaMermas[nombreSede].frecuenciaItems[prod] = (mapaMermas[nombreSede].frecuenciaItems[prod] || 0) + Math.abs(cNum);
        }
      });
    });

    return mapaMermas;
  })();

  const auditoriaDescuadres = (() => {
    const mapaSedDescuadres: { 
      [sedeName: string]: { 
        sedeId: number; 
        diferencias: { producto: string; cierreAyer: number; aperturaHoy: number; dif: number }[];
        totalDiferencia: number;
      } 
    } = {};

    sedesBD.forEach(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);
      if (sedeSeleccionada !== 'todos' && String(idSede) !== sedeSeleccionada) return;

      const registroDiff = inventarioMovimientos.find(m => Number(m.sede_id) === idSede);

      if (registroDiff) {
        const diferenciasLista: { producto: string; cierreAyer: number; aperturaHoy: number; dif: number }[] = [];
        
        const jsonPaletas = registroDiff.diferencia_paletas || {};
        const jsonEmpaques = registroDiff.diferencia_empaques || {};
        const jsonGeneral = { ...jsonPaletas, ...jsonEmpaques };

        Object.entries(jsonGeneral).forEach(([prodName, val]: [string, any]) => {
          const cantidadDif = Number(val) || 0;
          diferenciasLista.push({
            producto: prodName,
            cierreAyer: 0,
            aperturaHoy: 0,
            dif: cantidadDif
          });
        });

        if (diferenciasLista.length > 0 || Number(registroDiff.total_diferencia) !== 0) {
          mapaSedDescuadres[nombreSede] = {
            sedeId: idSede,
            diferencias: diferenciasLista,
            totalDiferencia: Number(registroDiff.total_diferencia || 0)
          };
        }
      }
    });

    return mapaSedDescuadres;
  })();

  const inventarioStockGeneralPorSede = (() => {
    const mapa: { 
      [sedeName: string]: { 
        totalPaletas: number; 
        detallePaletas: { [k: string]: number }; 
        detalleEmpaques: { [k: string]: number }; 
      } 
    } = {};

    sedesBD.forEach(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);
      if (sedeSeleccionada !== 'todos' && String(idSede) !== sedeSeleccionada) return;

      const movimientosSede = inventarioMovsDia
        .filter(m => Number(m.sede_id) === idSede)
        .sort((a, b) => new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime());

      const ultimoRegistroPaletas = movimientosSede.find(m => m.total_paletas !== undefined && m.total_paletas !== null);
      const totalPaletasBD = ultimoRegistroPaletas ? Number(ultimoRegistroPaletas.total_paletas || 0) : 0;

      const registrosSedeEmpaques = inventarioEmpaquesSedesBD.filter(item => Number(item.sede_id) === idSede);
      const detalleEmpaques: { [k: string]: number } = {};

      if (registrosSedeEmpaques.length > 0) {
        registrosSedeEmpaques.forEach(item => {
          const nombreItem = String(item.nombre || '').trim();
          const stockVal = Number(item.stock || 0);

          if (nombreItem.toLowerCase() !== 'total paletas') {
            detalleEmpaques[nombreItem] = stockVal;
          }
        });
      } else {
        movimientosSede.forEach(reg => {
          const tipo = String(reg.tipo_movimiento || '').toLowerCase().trim();
          let factor = 0;
          if (tipo === 'apertura' || tipo === 'nuevo' || tipo === 'nuevas' || tipo === 'compradas' || tipo === 'compra') factor = 1;
          else if (tipo === 'de_baja' || tipo === 'baja' || tipo === 'debaja') factor = -1;

          if (factor !== 0) {
            const dEmpaques = reg.detalle_empaques || reg.detalle_paletas || {};
            Object.entries(dEmpaques).forEach(([k, v]) => {
              detalleEmpaques[k] = (detalleEmpaques[k] || 0) + (Number(v) || 0) * factor;
            });
          }
        });
      }

      Object.keys(detalleEmpaques).forEach(k => {
        if (detalleEmpaques[k] === 0) delete detalleEmpaques[k];
      });

      mapa[nombreSede] = {
        totalPaletas: totalPaletasBD,
        detallePaletas: {},
        detalleEmpaques
      };
    });

    return mapa;
  })();

  const ventasAbanicoPorSede = (() => {
    const mapa: { [nombreSede: string]: { [producto: string]: number } } = {};

    historicoVentasBD.forEach(row => {
      const idSede = row.sede_id;
      if (!mapaSedes[idSede]) return;
      const nombreSede = getNombreSede(idSede);
      if (sedeSeleccionada !== 'todos' && String(idSede) !== sedeSeleccionada) return;

      const productosJson = row.productos || {};
      if (!mapa[nombreSede]) mapa[nombreSede] = {};

      Object.entries(productosJson).forEach(([prod, cant]) => {
        const cantidadNum = Number(cant) || 0;
        if (cantidadNum > 0) {
          mapa[nombreSede][prod] = (mapa[nombreSede][prod] || 0) + cantidadNum;
        }
      });
    });

    return mapa;
  })();

  const mixSaboresSedeViva = (() => {
    const sedeVivaObj = sedesBD.find(s => String(s.nombre || '').toLowerCase().includes('viva'));
    const vivaId = sedeVivaObj ? sedeVivaObj.id : null;

    const categoriasMap: { [categoria: string]: { [producto: string]: number } } = {};
    let totalUnidadesViva = 0;

    historicoVentasBD.forEach(row => {
      if (vivaId !== null && Number(row.sede_id) !== Number(vivaId)) return;

      const prods = row.productos || {};
      Object.entries(prods).forEach(([prodName, cant]) => {
        const cNum = Number(cant) || 0;
        if (cNum > 0) {
          totalUnidadesViva += cNum;
          const prodEnBD = productosBD.find(p => String(p.nombre).trim().toLowerCase() === String(prodName).trim().toLowerCase());
          const categoria = prodEnBD?.categoria && prodEnBD.categoria.trim() !== '' ? prodEnBD.categoria : 'General / Sin Categoría';

          if (!categoriasMap[categoria]) {
            categoriasMap[categoria] = {};
          }
          categoriasMap[categoria][prodName] = (categoriasMap[categoria][prodName] || 0) + cNum;
        }
      });
    });

    return { categoriasMap, totalUnidadesViva, vivaEncontrado: vivaId !== null };
  })();

  const proyeccionDemandaTodasSedes = (() => {
    const resultadoPorSede: { 
      [nombreSede: string]: { 
        sugeridos: { [prod: string]: { sugerido: number; teorico: number; stock: number; enCamino: number } };
        numDias: number;
        origenDatos: string;
      } 
    } = {};

    sedesBD.forEach(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);
      if (sedeSeleccionada !== 'todos' && String(idSede) !== sedeSeleccionada) return;

      const acumuladoProds: { [prod: string]: number } = {};
      const diasConDatos = new Set<string>();

      historicoVentas30DiasBD.forEach(row => {
        if (Number(row.sede_id) === idSede) {
          const fStr = obtenerFechaLocalStr(row.fecha);
          if (fStr) diasConDatos.add(fStr);
          const prods = row.productos || {};
          Object.entries(prods).forEach(([p, c]) => {
            const cant = Number(c) || 0;
            if (cant > 0) acumuladoProds[p] = (acumuladoProds[p] || 0) + cant;
          });
        }
      });

      pedidos30Dias.forEach(p => {
        if (Number(p.sede_id) === idSede) {
          const fStr = obtenerFechaLocalStr(p.fecha);
          if (fStr) diasConDatos.add(fStr);
          const jsonItems = { 
            ...(p.pedidos_paletas || {}), 
            ...(p.pedidos_richi || {}), 
            ...(p.pedidos_produccion || {}), 
            ...(p.pedidos_insumos || {}), 
            ...(p.pedidos_aseo || {}) 
          };
          Object.entries(jsonItems).forEach(([item, c]) => {
            const cant = Number(c) || 0;
            if (cant > 0) acumuladoProds[item] = (acumuladoProds[item] || 0) + cant;
          });
        }
      });

      const stockActualSede: { [prod: string]: number } = {};
      const movsSede = inventarioMovsDia
        .filter(m => Number(m.sede_id) === idSede)
        .sort((a, b) => new Date(a.fecha_registro).getTime() - new Date(b.fecha_registro).getTime());

      movsSede.forEach(reg => {
        const tipo = String(reg.tipo_movimiento || '').toLowerCase().trim();
        let factor = 0;
        if (tipo === 'apertura' || tipo === 'nuevo' || tipo === 'nuevas' || tipo === 'compradas' || tipo === 'compra') factor = 1;
        else if (tipo === 'de_baja' || tipo === 'baja' || tipo === 'debaja') factor = -1;

        if (factor !== 0) {
          const combinados = { ...(reg.detalle_empaques || {}), ...(reg.detalle_paletas || {}) };
          Object.entries(combinados).forEach(([k, v]) => {
            stockActualSede[k] = (stockActualSede[k] || 0) + (Number(v) || 0) * factor;
          });
        }
      });

      inventarioEmpaquesSedesBD.filter(e => Number(e.sede_id) === idSede).forEach(e => {
        const pNombre = String(e.nombre || '').trim();
        if (pNombre.toLowerCase() !== 'total paletas') {
          stockActualSede[pNombre] = Number(e.stock || 0);
        }
      });

      const pedidosEnCaminoSede: { [prod: string]: number } = {};
      pedidosPendientesGlobal.filter(p => Number(p.sede_id) === idSede).forEach(p => {
        const jsonItems = { 
          ...(p.pedidos_paletas || {}), 
          ...(p.pedidos_richi || {}), 
          ...(p.pedidos_produccion || {}), 
          ...(p.pedidos_insumos || {}), 
          ...(p.pedidos_aseo || {}) 
        };
        Object.entries(jsonItems).forEach(([item, c]) => {
          pedidosEnCaminoSede[item] = (pedidosEnCaminoSede[item] || 0) + (Number(c) || 0);
        });
      });

      const numDias = Math.max(diasConDatos.size, 1);
      const sugeridos: { [prod: string]: { sugerido: number; teorico: number; stock: number; enCamino: number } } = {};

      Object.entries(acumuladoProds).forEach(([prod, totalCant]) => {
        const promedioDiario = totalCant / numDias;
        const demandaTeorica = Math.ceil(promedioDiario * 7 * 1.2);
        const stockActual = Math.max(stockActualSede[prod] || 0, 0);
        const enCamino = pedidosEnCaminoSede[prod] || 0;

        const netoRequerido = Math.max(demandaTeorica - stockActual - enCamino, 0);

        sugeridos[prod] = {
          sugerido: netoRequerido,
          teorico: demandaTeorica,
          stock: stockActual,
          enCamino
        };
      });

      resultadoPorSede[nombreSede] = {
        sugeridos,
        numDias,
        origenDatos: 'Ventas e historial completo de pedidos (30 días)'
      };
    });

    return resultadoPorSede;
  })();

  const datosBI = (() => {
    const totalProductos: { [prod: string]: number } = {};
    const ventasPorFecha: { [fecha: string]: number } = {};

    historicoVentasBD.forEach(row => {
      const fStr = obtenerFechaLocalStr(row.fecha);
      const prods = row.productos || {};
      
      let totalFila = 0;
      Object.entries(prods).forEach(([prod, cant]) => {
        const c = Number(cant) || 0;
        if (c > 0) {
          totalProductos[prod] = (totalProductos[prod] || 0) + c;
          totalFila += c;
        }
      });

      if (fStr) {
        ventasPorFecha[fStr] = (ventasPorFecha[fStr] || 0) + totalFila;
      }
    });

    const productosArray = Object.entries(totalProductos).sort((a, b) => b[1] - a[1]);
    const masVendido = productosArray.length > 0 ? productosArray[0] : ['N/A', 0];
    const menosVendido = productosArray.length > 0 ? productosArray[productosArray.length - 1] : ['N/A', 0];

    const fechasArray = Object.entries(ventasPorFecha).sort((a, b) => b[1] - a[1]);
    const mejorDia = fechasArray.length > 0 ? fechasArray[0] : ['N/A', 0];
    const maxUnidadesProd = (masVendido[1] as number) > 0 ? (masVendido[1] as number) : 1;

    return { masVendido, menosVendido, mejorDia, productosArray, maxUnidadesProd };
  })();

  const biPorSede = (() => {
    const mapaSedesBI: { 
      [nombreSede: string]: { 
        masVendido: [string, number]; 
        menosVendido: [string, number]; 
        mejorDia: [string, number]; 
        productosArray: [string, number][]; 
        maxUnidadesProd: number; 
      } 
    } = {};

    sedesBD.forEach(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);

      const totalProductos: { [prod: string]: number } = {};
      const ventasPorFecha: { [fecha: string]: number } = {};

      historicoVentasBD.forEach(row => {
        if (Number(row.sede_id) !== Number(idSede)) return;

        const fStr = obtenerFechaLocalStr(row.fecha);
        const prods = row.productos || {};
        
        let totalFila = 0;
        Object.entries(prods).forEach(([prod, cant]) => {
          const c = Number(cant) || 0;
          if (c > 0) {
            totalProductos[prod] = (totalProductos[prod] || 0) + c;
            totalFila += c;
          }
        });

        if (fStr) {
          ventasPorFecha[fStr] = (ventasPorFecha[fStr] || 0) + totalFila;
        }
      });

      const productosArray = Object.entries(totalProductos).sort((a, b) => b[1] - a[1]);
      const masVendido = productosArray.length > 0 ? productosArray[0] : ['N/A', 0] as [string, number];
      const menosVendido = productosArray.length > 0 ? productosArray[productosArray.length - 1] : ['N/A', 0] as [string, number];

      const fechasArray = Object.entries(ventasPorFecha).sort((a, b) => b[1] - a[1]);
      const mejorDia = fechasArray.length > 0 ? fechasArray[0] : ['N/A', 0] as [string, number];
      const maxUnidadesProd = (masVendido[1] as number) > 0 ? (masVendido[1] as number) : 1;

      mapaSedesBI[nombreSede] = {
        masVendido,
        menosVendido,
        mejorDia,
        productosArray,
        maxUnidadesProd
      };
    });

    return mapaSedesBI;
  })();

  async function guardarProveedorInteligente(nombreProducto: string, idProd?: number) {
    const nuevoProv = editandoProveedor[nombreProducto];
    if (!nuevoProv || !nuevoProv.trim()) { alert('⚠️ Escribe el lugar de compra.'); return; }
    if (idProd) {
      await supabase.from('producto').update({ donde_comprar: nuevoProv.trim() }).eq('id', idProd);
    } else {
      await supabase.from('producto').insert([{ nombre: nombreProducto, donde_comprar: nuevoProv.trim(), categoria: 'General', activo: true, sede_id: 0 }]);
    }
    alert(`✅ Guardado: ${nuevoProv}`);
    cargarDatosAdmin();
  }

  const toggleChecklistLocal = (proveedor: string, nombreProducto: string) => {
    const key = `${fechaInicio}_${proveedor}_${nombreProducto}`;
    setItemsChequeados(prev => ({ ...prev, [key]: !prev[key] }));
  };

  async function marcarSeleccionadosComoComprados(proveedor: string, itemsProveedor: any) {
    const idsParaMarcarSet = new Set<number>();
    let hayItemsSeleccionados = false;

    Object.entries(itemsProveedor).forEach(([nombreProd, info]: any) => {
      const keyItem = `${fechaInicio}_${proveedor}_${nombreProd}`;
      if (itemsChequeados[keyItem]) {
        hayItemsSeleccionados = true;
        (info.idsPedidos || []).forEach((id: number) => idsParaMarcarSet.add(id));
      }
    });

    if (!hayItemsSeleccionados) {
      alert('⚠️ Por favor marca con el chulito ✓ al menos un producto de la lista.');
      return;
    }

    const idsArray = Array.from(idsParaMarcarSet);
    await supabase.from('pedidos_insumos').update({ estado: 'comprado' }).in('id', idsArray);
    cargarDatosAdmin();
  }

  async function marcarPedidosComoEntregados(idsPedidos: number[]) {
    if (!confirm('¿Deseas marcar el pedido como ENTREGADO?')) return;
    await supabase.from('pedidos_insumos').update({ estado: 'entregado' }).in('id', idsPedidos);
    cargarDatosAdmin();
  }

  const toggleModulo = (id: string) => {
    setModuloAbierto(prev => prev === id ? null : id);
  };

  return (
    <main className="min-h-screen bg-[#004e8c] text-white p-3 font-sans max-w-md mx-auto space-y-4 pb-20">
      
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-sm font-black text-white">🛡️ ADMIN CENTRAL</h1>
          <p className="text-[10px] text-sky-200">Panel de Control General</p>
        </div>
        <button onClick={() => router.back()} className="bg-[#031d35] hover:bg-[#003d6d] px-3 py-1.5 rounded-xl text-xs font-bold border border-[#0066b3] cursor-pointer">Volver</button>
      </header>

      {/* Selector de Sede Global */}
      <div className="bg-[#0b2b48] border border-[#0066b3] p-3 rounded-2xl shadow-md space-y-2">
        <label className="text-[10px] font-extrabold text-sky-300 uppercase block">🏢 Sede a Consultar:</label>
        <select
          value={sedeSeleccionada}
          onChange={(e) => setSedeSeleccionada(e.target.value)}
          className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl text-xs outline-none uppercase font-bold"
        >
          <option value="todos">🌐 Todas las Sedes (Global)</option>
          {sedesBD.map((s) => (
            <option key={s.id} value={String(s.id)}>
              📍 {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-[#0b2b48] border border-amber-500/60 rounded-2xl overflow-hidden shadow-lg">
        <button 
          onClick={() => setAcordeonAperturaAbierto(prev => !prev)}
          className="w-full p-3 flex justify-between items-center text-xs font-black text-amber-300 uppercase bg-[#0b2b48] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span>{acordeonAperturaAbierto ? '👁️‍🗨️' : '👁️'}</span> 🟢 CONTROL DE APERTURAS (HOY)
          </span>
          <span className="text-[9px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-500/40">
            {controlAperturaSedes.filter(s => s.horaApertura !== '--:--').length} / {controlAperturaSedes.length} Abiertas
          </span>
        </button>

        {acordeonAperturaAbierto && (
          <div className="p-3 pt-0 border-t border-amber-500/30 bg-[#031d35]/60">
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="border-b border-[#0066b3]/50 text-sky-300 uppercase">
                    <th className="py-1">Sede</th>
                    <th className="py-1 text-center">Hora</th>
                    <th className="py-1 text-center">Estado</th>
                    <th className="py-1 text-center">Paletas</th>
                    <th className="py-1 text-center">Insumos</th>
                    <th className="py-1 text-right">Operario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0066b3]/20 text-white font-medium">
                  {controlAperturaSedes.map((item) => (
                    <tr key={item.idSede} className="hover:bg-[#031d35]/40">
                      <td className="py-1.5 font-bold uppercase text-amber-300">{item.nombreSede}</td>
                      <td className="py-1.5 text-center font-black text-emerald-300">{item.horaApertura}</td>
                      <td className="py-1.5 text-center">{item.estadoCaja}</td>
                      <td className="py-1.5 text-center text-[9px]">{item.paletasContadas}</td>
                      <td className="py-1.5 text-center text-[9px]">{item.insumosContados}</td>
                      <td className="py-1.5 text-right font-bold text-sky-200 truncate max-w-[70px]">{item.operario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#0b2b48] border border-[#0066b3] p-3 rounded-2xl shadow-md space-y-2">
        <label className="text-[10px] font-extrabold text-sky-300 uppercase block">📅 Rango de Fechas de Consulta:</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[9px] text-sky-300 font-bold block mb-1">Desde (Inicio):</span>
            <input 
              type="date" 
              value={fechaInicio} 
              onChange={(e) => {
                const nuevaFecha = e.target.value;
                setFechaInicio(nuevaFecha);
                setFechaFin(nuevaFecha);
              }} 
              className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl text-xs outline-none" 
            />
          </div>
          <div>
            <span className="text-[9px] text-sky-300 font-bold block mb-1">Hasta (Final):</span>
            <input 
              type="date" 
              value={fechaFin} 
              onChange={(e) => setFechaFin(e.target.value)} 
              className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl text-xs outline-none" 
            />
          </div>
        </div>
      </div>

      {cargando ? <div className="text-center py-10 text-xs font-bold text-sky-200">Cargando datos...</div> : (
        <div className="space-y-3">

          {/* MÓDULO 1: GESTIÓN LOGÍSTICA E INSUMOS */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('logistica')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-amber-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'logistica' ? '▼' : '▶'}</span> 🚚 1. GESTIÓN LOGÍSTICA E INSUMOS
              </span>
              <span className="bg-[#031d35] text-sky-200 text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                {pedidosPendientesCompra.length + pedidosListosParaEntrega.length} activos
              </span>
            </button>

            {moduloAbierto === 'logistica' && (
              <div className="p-3 pt-0 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button 
                    onClick={() => setSubPestanaLogistica('compras')} 
                    className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border flex items-center justify-center gap-2 relative ${subPestanaLogistica === 'compras' ? 'bg-[#0078d4] border-[#00a4ef]' : 'bg-[#0b2b48] border-[#0066b3]'}`}
                  >
                    <span>🛒 Por Comprar</span>
                    {tieneProductosPorComprar && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span>
                      </span>
                    )}
                  </button>

                  <button 
                    onClick={() => setSubPestanaLogistica('despachos')} 
                    className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border flex items-center justify-center gap-2 relative ${subPestanaLogistica === 'despachos' ? 'bg-[#0078d4] border-[#00a4ef]' : 'bg-[#0b2b48] border-[#0066b3]'}`}
                  >
                    <span>🚚 Por Entregar</span>
                    {tieneProductosPorEntregar && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                      </span>
                    )}
                  </button>
                </div>

                {subPestanaLogistica === 'compras' && (
                  <div className="space-y-4 pt-1">
                    <div className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden shadow-sm">
                      <button 
                        onClick={() => setAcordeonesConsolidadoCompras(prev => ({ ...prev, global: !prev.global }))} 
                        className="w-full p-3 flex justify-between items-center text-xs font-black uppercase text-sky-300 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span>{acordeonesConsolidadoCompras.global ? '👁️‍🗨️' : '👁️'}</span> 🛒 CONSOLIDADO POR LUGAR DE COMPRA
                        </span>
                        {tieneProductosPorComprar && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                          </span>
                        )}
                      </button>

                      {acordeonesConsolidadoCompras.global && (
                        <div className="p-3 pt-0 space-y-2 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                          {Object.keys(consolidadoCompras).length === 0 ? (
                            <p className="text-center text-xs text-sky-300 py-4 font-semibold">No hay compras pendientes para el rango seleccionado.</p>
                          ) : (
                            Object.entries(consolidadoCompras).map(([proveedor, dataProv]) => {
                              const abierto = !!acordeonesCompras[proveedor];
                              const esAlerta = proveedor.includes('Faltan datos');
                              const itemsArray = Object.entries(dataProv.items);

                              return (
                                <div key={proveedor} className={`border rounded-xl overflow-hidden shadow-sm ${esAlerta ? 'border-rose-500 bg-rose-950/20' : 'border-[#0066b3] bg-[#0b2b48]'}`}>
                                  <button onClick={() => setAcordeonesCompras(prev => ({ ...prev, [proveedor]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold uppercase text-amber-300 cursor-pointer">
                                    <span className="flex items-center gap-2">
                                      <span>{abierto ? '👁️‍🗨️' : '👁️'}</span> {proveedor}
                                    </span>
                                    <span className="text-[10px] bg-[#031d35] px-2 py-0.5 rounded">{itemsArray.length} ÍTEMS</span>
                                  </button>
                                  {abierto && (
                                    <div className="p-3 pt-0 space-y-2 border-t border-[#0066b3]/30">
                                      <div className="space-y-1.5 pt-2">
                                        {itemsArray.map(([nombreProd, info]: any, i) => {
                                          const keyItem = `${fechaInicio}_${proveedor}_${nombreProd}`;
                                          const estaChequeado = !!itemsChequeados[keyItem];

                                          return (
                                            <div key={i} className={`p-2.5 rounded-lg border flex justify-between items-center text-xs transition-colors ${estaChequeado ? 'bg-emerald-950/40 border-emerald-500/60' : 'bg-[#031d35] border-[#0066b3]/50'}`}>
                                              <div>
                                                <p className={`font-semibold ${estaChequeado ? 'text-emerald-300 line-through' : 'text-white'}`}>{nombreProd}</p>
                                                {esAlerta && (
                                                  <div className="flex gap-1 mt-1.5">
                                                    <input className="bg-[#0b2b48] border border-rose-500 text-white text-[10px] p-1.5 rounded outline-none w-24" placeholder="Ej. D1" onChange={(e) => setEditandoProveedor({ ...editandoProveedor, [nombreProd]: e.target.value })} />
                                                    <button onClick={() => guardarProveedorInteligente(nombreProd, info.idProd)} className="bg-emerald-600 px-2 py-1 rounded text-[10px] font-bold">Guardar</button>
                                                  </div>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-2">
                                                <span className="bg-[#0078d4] text-white px-2.5 py-1 rounded font-black text-xs">x{info.cantidad}</span>
                                                {!esAlerta && (
                                                  <button
                                                    onClick={() => toggleChecklistLocal(proveedor, nombreProd)}
                                                    title="Checklist de compra"
                                                    className={`font-black text-xs px-2.5 py-1 rounded cursor-pointer transition-colors ${estaChequeado ? 'bg-emerald-500 text-white border border-emerald-300' : 'bg-[#0b2b48] hover:bg-[#0066b3] text-emerald-400 border border-emerald-500/50'}`}
                                                  >
                                                    ✓
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {!esAlerta && (
                                        <button 
                                          onClick={() => marcarSeleccionadosComoComprados(proveedor, dataProv.items)} 
                                          className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-lg text-xs uppercase shadow-md flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          ✓ MARCAR COMPRADOS Y PAGADOS
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-[#0b2b48] border border-sky-500/50 rounded-xl overflow-hidden">
                      <button 
                        onClick={() => setAcordeonesResumenSedes(prev => ({ ...prev, global: !prev.global }))} 
                        className="w-full p-3 flex justify-between items-center text-[11px] font-black text-sky-300 uppercase bg-[#0b2b48] cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span>{acordeonesResumenSedes.global ? '👁️‍🗨️' : '👁️'}</span> 🏢 RESUMEN DE COMPRAS POR SEDES
                        </span>
                        <span className="text-[10px] bg-[#031d35] px-2 py-0.5 rounded text-white border border-[#0066b3]">
                          {Object.keys(resumenComprasPorSede).length} Sedes
                        </span>
                      </button>

                      {acordeonesResumenSedes.global && (
                        <div className="p-3 pt-0 space-y-2 border-t border-[#0066b3]/40 bg-[#031d35]/60">
                          {Object.keys(resumenComprasPorSede).length === 0 ? (
                            <p className="text-[10px] text-sky-400 italic py-2">No hay pedidos pendientes por sede para este rango.</p>
                          ) : (
                            Object.entries(resumenComprasPorSede).map(([nombreSede, prods]) => {
                              const abiertoSede = !!acordeonesResumenSedes[nombreSede];
                              return (
                                <div key={nombreSede} className="bg-[#0b2b48] rounded-xl border border-[#0066b3] overflow-hidden">
                                  <button 
                                    onClick={() => setAcordeonesResumenSedes(prev => ({ ...prev, [nombreSede]: !abiertoSede }))} 
                                    className="w-full p-2.5 flex justify-between items-center text-xs font-black text-amber-300 uppercase cursor-pointer"
                                  >
                                    <span className="flex items-center gap-2">
                                      <span>{abiertoSede ? '👁️‍🗨️' : '👁️'}</span> 📍 {nombreSede}
                                    </span>
                                    <span className="text-[10px] bg-[#031d35] px-2 py-0.5 rounded text-sky-200">
                                      {Object.keys(prods).length} ítems
                                    </span>
                                  </button>

                                  {abiertoSede && (
                                    <div className="p-2.5 pt-0 space-y-1 bg-[#031d35] border-t border-[#0066b3]/30">
                                      {Object.entries(prods).map(([prodNombre, cant]) => (
                                        <div key={prodNombre} className="flex justify-between text-[11px] text-white border-b border-[#0066b3]/20 py-1">
                                          <span>{prodNombre}</span>
                                          <span className="font-bold text-emerald-300">x{cant}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-[#0b2b48] border border-teal-500/50 rounded-xl overflow-hidden shadow-sm">
                      <button 
                        onClick={() => setAcordeonProyeccionMain(prev => !prev)}
                        className="w-full p-3 bg-teal-950/40 border-b border-teal-500/30 flex justify-between items-center text-left cursor-pointer"
                      >
                        <div>
                          <span className="text-[11px] font-black text-teal-300 uppercase block">
                            {acordeonProyeccionMain ? '👁️‍🗨️' : '👁️'} 📦 Proyección de Demanda e Insumos
                          </span>
                          <span className="text-[9px] text-teal-200 italic">Sugerido Neto = Demanda (30d) - Stock Actual - Pedidos en Camino</span>
                        </div>
                        <span className="text-[10px] bg-[#031d35] px-2 py-0.5 rounded text-teal-300 border border-teal-500/40 font-bold">
                          {Object.keys(proyeccionDemandaTodasSedes).length} Sedes
                        </span>
                      </button>

                      {acordeonProyeccionMain && (
                        <div className="p-3 space-y-2 bg-[#031d35]/60 text-xs border-t border-teal-500/20">
                          {Object.keys(proyeccionDemandaTodasSedes).length === 0 ? (
                            <p className="text-center text-[11px] text-sky-300 py-2">No hay suficientes datos registrados en los últimos 30 días para proyectar.</p>
                          ) : (
                            Object.entries(proyeccionDemandaTodasSedes).map(([nombreSede, infoSede], idx) => {
                              const abiertoProySede = !!acordeonesProyeccionSedes[nombreSede];
                              const cantProds = Object.keys(infoSede.sugeridos).length;

                              return (
                                <div key={idx} className="bg-[#0b2b48] border border-[#0066b3] rounded-xl overflow-hidden">
                                  <button 
                                    onClick={() => setAcordeonesProyeccionSedes(prev => ({ ...prev, [nombreSede]: !abiertoProySede }))}
                                    className="w-full p-2.5 flex justify-between items-center text-xs font-bold text-white uppercase cursor-pointer"
                                  >
                                    <span className="flex items-center gap-2">
                                      <span>{abiertoProySede ? '👁️‍🗨️' : '👁️'}</span> 📍 {nombreSede}
                                    </span>
                                    <span className="text-[9px] bg-[#031d35] text-teal-300 px-2 py-0.5 rounded border border-teal-500/40">
                                      {cantProds} Analizados ({infoSede.numDias}d base)
                                    </span>
                                  </button>

                                  {abiertoProySede && (
                                    <div className="p-2.5 pt-0 space-y-1.5 bg-[#031d35] border-t border-[#0066b3]/30">
                                      <p className="text-[9px] text-sky-300 italic pt-1 border-b border-[#0066b3]/20 pb-1">
                                        Origen: {infoSede.origenDatos}
                                      </p>
                                      {cantProds === 0 ? (
                                        <p className="text-[10px] text-sky-400 italic py-1">Sin historial suficiente en los últimos 30 días.</p>
                                      ) : (
                                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 pt-1">
                                          {Object.entries(infoSede.sugeridos).map(([prod, detalle], i) => (
                                            <div key={i} className="bg-[#0b2b48] p-2 rounded-lg border border-[#0066b3]/40 space-y-1">
                                              <div className="flex justify-between items-center text-white">
                                                <span className="truncate font-bold text-[11px]">{prod}</span>
                                                <span className={`font-black px-2 py-0.5 rounded text-[10px] border ${detalle.sugerido > 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50' : 'bg-[#031d35] text-sky-400 border-[#0066b3]'}`}>
                                                  Pedir: x{detalle.sugerido}
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-3 gap-1 text-[9px] text-sky-200 bg-[#031d35] p-1.5 rounded">
                                                <div><span className="text-sky-400 font-bold block">Meta (7d):</span> x{detalle.teorico}</div>
                                                <div><span className="text-amber-300 font-bold block">Stock Cava:</span> x{detalle.stock}</div>
                                                <div><span className="text-fuchsia-300 font-bold block">En Camino:</span> x{detalle.enCamino}</div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {subPestanaLogistica === 'despachos' && (
                  <div className="space-y-2 pt-1">
                    {Object.keys(despachosPorSede).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay despachos listos (comprados) para este rango.</p>
                    ) : (
                      Object.entries(despachosPorSede).map(([nombreSede, dataSede]) => {
                        const abierto = !!acordeonesDespachos[nombreSede];
                        return (
                          <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden">
                            <button onClick={() => setAcordeonesDespachos(prev => ({ ...prev, [nombreSede]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase cursor-pointer">
                              <span className="flex items-center gap-2">
                                <span>{abierto ? '👁️‍🗨️' : '👁️'}</span> 📍 {nombreSede}
                              </span>
                              <span className="text-[10px] bg-[#031d35] px-2 py-0.5 rounded">{Object.keys(dataSede.productos).length} productos</span>
                            </button>
                            {abierto && (
                              <div className="p-3 pt-0 bg-[#031d35] text-xs space-y-2 border-t border-[#0066b3]/30">
                                <div className="space-y-1 pt-1">
                                  {Object.entries(dataSede.productos).map(([k, v]: any, i) => (
                                    <div key={i} className="flex justify-between border-b border-[#0066b3]/20 py-1 text-white">
                                      <span>{k}</span>
                                      <span className="font-bold text-sky-200">x{v}</span>
                                    </div>
                                  ))}
                                </div>
                                <button onClick={() => marcarPedidosComoEntregados(dataSede.idsPedidos)} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-lg text-xs uppercase cursor-pointer">
                                  🚚 Marcar Entregado
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MÓDULO 2: CIERRES DE CAJA Y DESCUADRES */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('cierres')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'cierres' ? '▼' : '▶'}</span> 💰 2. CIERRES DE CAJA Y DESCUADRES
              </span>
              <span className="bg-[#031d35] text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                ${CierreGlobal.ventaNeto.toLocaleString()}
              </span>
            </button>

            {moduloAbierto === 'cierres' && (
              <div className="p-3 pt-0 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button onClick={() => setSubPestanaCierres('caja')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaCierres === 'caja' ? 'bg-emerald-700 border-emerald-400 text-white' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}>💵 Cierres de Caja</button>
                  <button onClick={() => setSubPestanaCierres('descuadres')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaCierres === 'descuadres' ? 'bg-emerald-700 border-emerald-400 text-white' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}>🔍 Descuadres</button>
                </div>

                {subPestanaCierres === 'caja' && (
                  <div className="space-y-3">
                    {sedeSeleccionada === 'todos' ? (
                      <>
                        <div className="border border-emerald-500/50 bg-[#0b2b48] rounded-xl overflow-hidden">
                          <button onClick={() => setAcordeonesCierres(prev => ({ ...prev, global: !prev.global }))} className="w-full p-3 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-emerald-950/40 cursor-pointer">
                            <span className="flex items-center gap-1.5">
                              <span>{acordeonesCierres.global ? '👁️‍🗨️' : '👁️'}</span> CONSOLIDADO GLOBAL
                            </span>
                            <span className="text-white">${CierreGlobal.totalVenta.toLocaleString()}</span>
                          </button>
                          {acordeonesCierres.global && (
                            <div className="p-3 space-y-1.5 bg-[#031d35] text-xs border-t border-emerald-500/30">
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💵 Efectivo:</span><span className="font-bold text-emerald-400">${CierreGlobal.efectivo.toLocaleString()}</span></div>
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📲 Nequi:</span><span className="font-bold text-sky-300">${CierreGlobal.nequi.toLocaleString()}</span></div>
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💳 Daviplata:</span><span className="font-bold text-rose-300">${CierreGlobal.daviplata.toLocaleString()}</span></div>
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📉 Gastos:</span><span className="font-bold text-amber-400">-${CierreGlobal.gastos.toLocaleString()}</span></div>
                              <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>👥 Nómina Turnos:</span><span className="font-bold text-fuchsia-300">-${CierreGlobal.nomina.toLocaleString()}</span></div>
                              <div className="flex justify-between py-1.5 text-xs font-black border-t border-emerald-400 mt-1 text-white"><span>💰 VENTA NETO GLOBAL:</span><span className="text-emerald-300">${CierreGlobal.ventaNeto.toLocaleString()}</span></div>
                            </div>
                          )}
                        </div>

                        {Object.keys(cierresPorSede).length === 0 ? (
                          <p className="text-center text-xs text-sky-300 py-6 font-semibold">No se encontraron cierres de caja en este rango.</p>
                        ) : (
                          Object.entries(cierresPorSede).map(([nombreSede, dataSede]) => {
                            const abierto = !!acordeonesCierres[nombreSede];
                            const tieneDescuadre = dataSede.descuadreCaja !== 0;

                            return (
                              <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden shadow-sm">
                                <button onClick={() => setAcordeonesCierres(prev => ({ ...prev, [nombreSede]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase cursor-pointer">
                                  <span className="flex items-center gap-2">
                                    <span>{abierto ? '👁️‍🗨️' : '👁️'}</span> {nombreSede}
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold ${dataSede.estadoCaja === 'abierta' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                                      {dataSede.estadoCaja === 'abierta' ? '🟢 Abierta' : '🔒 Cerrada'}
                                    </span>
                                  </span>
                                  <span className="text-emerald-300 font-bold">${dataSede.totalVenta.toLocaleString()}</span>
                                </button>
                                {abierto && (
                                  <div className="p-3 space-y-2 bg-[#031d35] text-xs border-t border-[#0066b3]/30">
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💵 Base Inicial:</span><span className="font-bold text-sky-200">${dataSede.baseInicial.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📥 Total Efectivo Recibido:</span><span className="font-bold text-emerald-400">${dataSede.efectivoRecibido.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📲 Total Nequi:</span><span className="font-bold text-sky-300">${dataSede.nequi.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💳 Total Daviplata:</span><span className="font-bold text-rose-300">${dataSede.daviplata.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📉 Total Gastos de Insumos:</span><span className="font-bold text-amber-400">-${dataSede.gastos.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>👥 Total Nómina Pagada:</span><span className="font-bold text-fuchsia-300">-${dataSede.nomina.toLocaleString()}</span></div>
                                    
                                    <div className="flex justify-between border-b border-[#0066b3]/40 py-1 font-bold bg-[#0b2b48]/50 px-2 rounded">
                                      <span>🧮 Efectivo Esperado en Caja:</span>
                                      <span className="text-emerald-300">${dataSede.efectivoEsperado.toLocaleString()}</span>
                                    </div>

                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1">
                                      <span>💵 Efectivo Físico Contado:</span>
                                      <span className="font-bold text-white">${dataSede.efectivoFisicoContado.toLocaleString()}</span>
                                    </div>

                                    <div className={`flex justify-between py-1.5 px-2 rounded font-black text-xs ${tieneDescuadre ? 'bg-amber-950/60 text-amber-300 border border-amber-500/50' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40'}`}>
                                      <span>⚠️ DESCUADRE CAJA:</span>
                                      <span>{dataSede.descuadreCaja > 0 ? `+$${dataSede.descuadreCaja.toLocaleString()}` : `$${dataSede.descuadreCaja.toLocaleString()}`}</span>
                                    </div>

                                    {dataSede.motivoDescuadre.length > 0 && (
                                      <div className="bg-[#0b2b48] p-2 rounded text-[10px] border border-amber-500/30">
                                        <span className="text-amber-300 font-bold block">Motivo del Descuadre:</span>
                                        {dataSede.motivoDescuadre.map((m: string, idx: number) => <p key={idx} className="text-sky-200">• {m}</p>)}
                                      </div>
                                    )}

                                    {dataSede.notasNomina.length > 0 && (
                                      <div className="bg-[#0b2b48] p-2 rounded text-[10px] border border-fuchsia-500/30">
                                        <span className="text-fuchsia-300 font-bold block">Nómina Pagada Hoy:</span>
                                        {dataSede.notasNomina.map((n: string, idx: number) => <p key={idx} className="text-sky-200">• {n}</p>)}
                                      </div>
                                    )}

                                    <div className="flex justify-between py-1.5 font-black border-t border-sky-500/40 text-white mt-1">
                                      <span>💰 VENTAS TOTALES DEL DÍA:</span>
                                      <span className="text-emerald-300">${dataSede.totalVenta.toLocaleString()}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </>
                    ) : (
                      (() => {
                        const datosSedeSeleccionada = Object.values(cierresPorSede)[0];

                        if (!datosSedeSeleccionada) {
                          return <p className="text-center text-xs text-sky-300 py-6 font-semibold">No se encontraron cierres de caja para esta sede en este rango.</p>;
                        }

                        const tieneDescuadre = datosSedeSeleccionada.descuadreCaja !== 0;

                        return (
                          <div className="border border-emerald-500/50 bg-[#031d35] p-3 rounded-xl space-y-2 text-xs shadow-md">
                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💵 Base Inicial:</span><span className="font-bold text-sky-200">${datosSedeSeleccionada.baseInicial.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📥 Total Efectivo Recibido:</span><span className="font-bold text-emerald-400">${datosSedeSeleccionada.efectivoRecibido.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📲 Total Nequi:</span><span className="font-bold text-sky-300">${datosSedeSeleccionada.nequi.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💳 Total Daviplata:</span><span className="font-bold text-rose-300">${datosSedeSeleccionada.daviplata.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📉 Total Gastos de Insumos:</span><span className="font-bold text-amber-400">-${datosSedeSeleccionada.gastos.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>👥 Total Nómina Pagada:</span><span className="font-bold text-fuchsia-300">-${datosSedeSeleccionada.nomina.toLocaleString()}</span></div>
                            
                            <div className="flex justify-between border-b border-[#0066b3]/40 py-1 font-bold bg-[#0b2b48]/50 px-2 rounded">
                              <span>🧮 Efectivo Esperado en Caja:</span>
                              <span className="text-emerald-300">${datosSedeSeleccionada.efectivoEsperado.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1">
                              <span>💵 Efectivo Físico Contado:</span>
                              <span className="font-bold text-white">${datosSedeSeleccionada.efectivoFisicoContado.toLocaleString()}</span>
                            </div>

                            <div className={`flex justify-between py-1.5 px-2 rounded font-black text-xs ${tieneDescuadre ? 'bg-amber-950/60 text-amber-300 border border-amber-500/50' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40'}`}>
                              <span>⚠️ DESCUADRE CAJA:</span>
                              <span>{datosSedeSeleccionada.descuadreCaja > 0 ? `+$${datosSedeSeleccionada.descuadreCaja.toLocaleString()}` : `$${datosSedeSeleccionada.descuadreCaja.toLocaleString()}`}</span>
                            </div>

                            {datosSedeSeleccionada.motivoDescuadre.length > 0 && (
                              <div className="bg-[#0b2b48] p-2 rounded text-[10px] border border-amber-500/30">
                                <span className="text-amber-300 font-bold block">Motivo del Descuadre:</span>
                                {datosSedeSeleccionada.motivoDescuadre.map((m: string, idx: number) => <p key={idx} className="text-sky-200">• {m}</p>)}
                              </div>
                            )}

                            {datosSedeSeleccionada.notasNomina.length > 0 && (
                              <div className="bg-[#0b2b48] p-2 rounded text-[10px] border border-fuchsia-500/30">
                                <span className="text-fuchsia-300 font-bold block">Nómina Pagada Hoy:</span>
                                {datosSedeSeleccionada.notasNomina.map((n: string, idx: number) => <p key={idx} className="text-sky-200">• {n}</p>)}
                              </div>
                            )}

                            <div className="flex justify-between py-1.5 font-black border-t border-sky-500/40 text-white mt-1">
                              <span>💰 VENTAS TOTALES DEL DÍA:</span>
                              <span className="text-emerald-300">${datosSedeSeleccionada.totalVenta.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {subPestanaCierres === 'descuadres' && (
                  <div className="space-y-3">
                    <div className="bg-[#0b2b48] border border-amber-500/50 rounded-xl overflow-hidden shadow-sm">
                      <div className="p-3 bg-amber-950/40 border-b border-amber-500/30">
                        <span className="text-[11px] font-black text-amber-300 uppercase block">⚠️ Histórico de Mermas y Diferencias Críticas</span>
                        <span className="text-[10px] text-sky-200 italic">Acumulado de descuadres por sede en el rango</span>
                      </div>
                      <div className="p-3 space-y-3 bg-[#031d35]/60 text-xs">
                        {Object.keys(historicoMermasCriticas).length === 0 ? (
                          <p className="text-center text-[11px] text-sky-300 py-3">No hay mermas o diferencias registradas en este rango.</p>
                        ) : (
                          Object.entries(historicoMermasCriticas).map(([nombreSede, dataMerma], idx) => (
                            <div key={idx} className="bg-[#0b2b48] border border-[#0066b3] p-2.5 rounded-xl space-y-1.5">
                              <div className="flex justify-between items-center border-b border-[#0066b3]/40 pb-1">
                                <span className="font-bold text-white uppercase">📍 {nombreSede}</span>
                                <span className={`font-black px-2 py-0.5 rounded text-[10px] ${dataMerma.totalDiferenciaAcumulada === 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300 border border-rose-500/40'}`}>
                                  Total Dif: {dataMerma.totalDiferenciaAcumulada}
                                </span>
                              </div>
                              {Object.keys(dataMerma.frecuenciaItems).length > 0 && (
                                <div className="space-y-1 pt-1">
                                  <span className="text-[10px] text-amber-300 font-bold block">Ítems con más desviación:</span>
                                  {Object.entries(dataMerma.frecuenciaItems).map(([prod, cant], i) => (
                                    <div key={i} className="flex justify-between text-[11px] text-sky-200 border-b border-[#0066b3]/20 py-0.5">
                                      <span>• {prod}</span>
                                      <span className="font-bold text-rose-300">Desviación: {cant}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {Object.keys(auditoriaDescuadres).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-4 font-semibold">No hay diferencias detalladas para este rango.</p>
                    ) : (
                      Object.entries(auditoriaDescuadres).map(([nombreSede, infoSede]) => {
                        const abierto = !!acordeonesDescuadres[nombreSede];
                        const tieneDescuadre = infoSede.totalDiferencia !== 0 || infoSede.diferencias.some(d => d.dif !== 0);

                        return (
                          <div key={nombreSede} className={`border rounded-xl overflow-hidden ${tieneDescuadre ? 'border-amber-500 bg-[#0b2b48]' : 'border-[#0066b3] bg-[#0b2b48]'}`}>
                            <button onClick={() => setAcordeonesDescuadres(prev => ({ ...prev, [nombreSede]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase cursor-pointer">
                              <span className="flex items-center gap-2">
                                <span>{abierto ? '👁️‍🗨️' : '👁️'}</span> {nombreSede}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-black ${tieneDescuadre ? 'bg-amber-950 text-amber-300 border border-amber-500' : 'bg-emerald-950 text-emerald-300'}`}>
                                {tieneDescuadre ? `⚠️ Dif: ${infoSede.totalDiferencia}` : '✅ Cuadrado'}
                              </span>
                            </button>

                            {abierto && (
                              <div className="p-3 pt-0 bg-[#031d35] text-xs space-y-2 border-t border-[#0066b3]/30">
                                <div className="grid grid-cols-2 font-black text-[10px] text-sky-300 border-b border-[#0066b3]/40 pb-1 mt-2">
                                  <span>PRODUCTO / ÍTEM</span>
                                  <span className="text-right">DIFERENCIA</span>
                                </div>
                                <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                                  {infoSede.diferencias.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-2 items-center text-[11px] border-b border-[#0066b3]/20 py-1 text-white">
                                      <span className="truncate pr-1">{item.producto}</span>
                                      <span className={`text-right font-black ${item.dif === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {item.dif > 0 ? `+${item.dif}` : item.dif}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-between pt-2 border-t border-[#0066b3]/40 font-black text-xs text-white">
                                  <span>Total Diferencia Sede:</span>
                                  <span className={infoSede.totalDiferencia === 0 ? 'text-emerald-400' : 'text-amber-400'}>{infoSede.totalDiferencia}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* MÓDULO 3: INVENTARIOS Y STOCK GENERAL */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('inventarios')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-sky-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'inventarios' ? '▼' : '▶'}</span> 📦 3. INVENTARIOS Y STOCK GENERAL
              </span>
              <span className="bg-[#031d35] text-sky-200 text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                {Object.keys(inventarioStockGeneralPorSede).length} Sedes
              </span>
            </button>

            {moduloAbierto === 'inventarios' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                {Object.keys(inventarioStockGeneralPorSede).length === 0 ? (
                  <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay movimientos de inventario registrados para este rango.</p>
                ) : (
                  Object.entries(inventarioStockGeneralPorSede).map(([nombreSede, infoSede]) => {
                    const abierto = !!acordeonesInventario[nombreSede];

                    return (
                      <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden">
                        <button onClick={() => setAcordeonesInventario(prev => ({ ...prev, [nombreSede]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase cursor-pointer">
                          <span className="flex items-center gap-2">
                            <span>{abierto ? '👁️‍🗨️' : '👁️'}</span> 📍 {nombreSede}
                          </span>
                          <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-500">
                            Total Paletas: {infoSede.totalPaletas}
                          </span>
                        </button>

                        {abierto && (
                          <div className="p-3 pt-0 bg-[#031d35] text-xs space-y-3 border-t border-[#0066b3]/30">
                            <div className="pt-2">
                              <span className="text-[10px] font-black text-amber-300 uppercase block border-b border-[#0066b3]/40 pb-1 mb-1">
                                🧊 Stock Paletas
                              </span>
                              <div className="flex justify-between text-[11px] text-white border-b border-[#0066b3]/20 py-1">
                                <span>Total Paletas</span>
                                <span className="font-bold text-emerald-300">x{infoSede.totalPaletas}</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-black text-amber-300 uppercase block border-b border-[#0066b3]/40 pb-1 mb-1">
                                📦 Stock Empaques
                              </span>
                              {Object.keys(infoSede.detalleEmpaques).length === 0 ? (
                                <p className="text-[10px] text-sky-400 italic py-1">Sin empaques registrados en stock.</p>
                              ) : (
                                Object.entries(infoSede.detalleEmpaques).map(([prod, cant], idx) => (
                                  <div key={idx} className="flex justify-between text-[11px] text-white border-b border-[#0066b3]/20 py-1">
                                    <span>{prod}</span>
                                    <span className={`font-bold ${Number(cant) < 0 ? 'text-rose-400' : 'text-sky-300'}`}>x{cant}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* MÓDULO 4: NÓMINA Y REGISTRO DE TURNOS */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('modulo_nomina')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-fuchsia-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'modulo_nomina' ? '▼' : '▶'}</span> 👥 4. NÓMINA Y REGISTRO DE TURNOS
              </span>
              <span className="bg-[#031d35] text-fuchsia-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                {resumenNominaOperarios.length} Operarios
              </span>
            </button>

            {moduloAbierto === 'modulo_nomina' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                <div className="space-y-2 pt-2">
                  {resumenNominaOperarios.length === 0 ? (
                    <p className="text-center text-xs text-sky-300 py-6 font-semibold">
                      No se encontraron registros de nómina para este rango.
                    </p>
                  ) : (
                    resumenNominaOperarios.map((op, idx) => (
                      <div key={idx} className="bg-[#0b2b48] border border-[#0066b3] p-3 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-[#0066b3]/40 pb-1.5">
                          <span className="font-black text-amber-300 uppercase">👤 {op.nombre}</span>
                          <span className="bg-[#031d35] text-sky-200 text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                            {op.turnosCount} {op.turnosCount === 1 ? 'Turno' : 'Turnos'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-sky-100 bg-[#031d35] p-2 rounded-lg">
                          <div>
                            <span className="block text-[9px] text-sky-400 font-bold uppercase">Horas Día</span>
                            <span className="font-extrabold text-white">{op.horasDia}h</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-sky-400 font-bold uppercase">Horas Noche</span>
                            <span className="font-extrabold text-white">{op.horasNoche}h</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-[#0066b3]/20 font-black text-xs">
                          <span className="text-white">💰 TOTAL PAGO NÓMINA:</span>
                          <span className="text-fuchsia-300 text-sm">${op.totalPagado.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* MÓDULO 5: VENTAS Y MIX DE SABORES */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('ventas_abanico')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-cyan-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'ventas_abanico' ? '▼' : '▶'}</span> 📊 5. VENTAS Y MIX DE SABORES
              </span>
              <span className="bg-[#031d35] text-cyan-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                {Object.keys(ventasAbanicoPorSede).length} Sedes
              </span>
            </button>

            {moduloAbierto === 'ventas_abanico' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                <div className="bg-[#0b2b48] border border-cyan-500/50 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-3 bg-cyan-950/40 border-b border-cyan-500/30 flex justify-between items-center">
                    <span className="text-[11px] font-black text-cyan-300 uppercase">🧊 Mix de Sabores y Categorías (Sede Viva)</span>
                    <span className="text-[10px] bg-[#031d35] text-cyan-200 px-2 py-0.5 rounded border border-cyan-500/40">Total: {mixSaboresSedeViva.totalUnidadesViva} unids</span>
                  </div>
                  <div className="p-3 space-y-2.5 bg-[#031d35]/60 text-xs">
                    {!mixSaboresSedeViva.vivaEncontrado ? (
                      <p className="text-center text-[11px] text-sky-300 py-2">No se encontró la sede Viva configurada.</p>
                    ) : Object.keys(mixSaboresSedeViva.categoriasMap).length === 0 ? (
                      <p className="text-center text-[11px] text-sky-300 py-2">No hay ventas registradas en la sede Viva para este rango.</p>
                    ) : (
                      Object.entries(mixSaboresSedeViva.categoriasMap).map(([catNombre, productosCat], idx) => (
                        <div key={idx} className="bg-[#0b2b48] border border-[#0066b3] p-2.5 rounded-xl space-y-1">
                          <span className="text-[10px] font-black text-amber-300 uppercase block border-b border-[#0066b3]/40 pb-1">
                            📂 {catNombre}
                          </span>
                          <div className="space-y-1 pt-1">
                            {Object.entries(productosCat).map(([prodName, cant]: [string, any], i) => (
                              <div key={i} className="flex justify-between text-[11px] text-white border-b border-[#0066b3]/20 py-0.5">
                                <span className="truncate pr-2">{prodName}</span>
                                <span className="font-bold text-emerald-300">x{cant}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {Object.keys(ventasAbanicoPorSede).length === 0 ? (
                  <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay registros en el histórico de ventas para este rango.</p>
                ) : (
                  Object.entries(ventasAbanicoPorSede).map(([nombreSede, productosObj]) => {
                    const abierto = !!acordeonesVentasAbanico[nombreSede];
                    const totalUnidadesSede = Object.values(productosObj).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);

                    return (
                      <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden shadow-sm">
                        <button 
                          onClick={() => setAcordeonesVentasAbanico(prev => ({ ...prev, [nombreSede]: !abierto }))} 
                          className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span>{abierto ? '👁️‍🗨️' : '👁️'}</span> 📍 {nombreSede}
                          </span>
                          <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/50">
                            Total Unidades: {totalUnidadesSede}
                          </span>
                        </button>

                        {abierto && (
                          <div className="p-3 pt-0 bg-[#031d35] text-xs space-y-1.5 border-t border-[#0066b3]/30">
                            <div className="grid grid-cols-2 font-black text-[10px] text-cyan-300 border-b border-[#0066b3]/40 pb-1 mt-2">
                              <span>PRODUCTO / SABOR</span>
                              <span className="text-right">CANTIDAD VENDIDA</span>
                            </div>
                            <div className="space-y-1 pt-1 max-h-48 overflow-y-auto pr-1">
                              {Object.entries(productosObj).map(([prod, cant]: [string, any], idx) => (
                                <div key={idx} className="grid grid-cols-2 items-center text-[11px] border-b border-[#0066b3]/20 py-1 text-white">
                                  <span className="truncate pr-1">{prod}</span>
                                  <span className="text-right font-bold text-emerald-300">x{cant}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between pt-2 border-t border-[#0066b3]/40 font-black text-xs text-white">
                              <span>Total General Sede:</span>
                              <span className="text-cyan-300">{totalUnidadesSede} unidades</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* MÓDULO 6: INTELIGENCIA DE NEGOCIO (BI) */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('bi')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-amber-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'bi' ? '▼' : '▶'}</span> 🧠 6. INTELIGENCIA DE NEGOCIO (BI)
              </span>
              <span className="bg-[#031d35] text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                Analítica Avanzada
              </span>
            </button>

            {moduloAbierto === 'bi' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                {historicoVentasBD.length === 0 ? (
                  <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay suficientes datos de ventas en este rango para analizar.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-[#031d35] border border-amber-500/40 p-3 rounded-xl space-y-3">
                      <span className="text-[11px] font-black text-amber-300 uppercase block border-b border-amber-500/30 pb-1">
                        🌐 CONSOLIDADO GLOBAL DE TODAS LAS SEDES
                      </span>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#0b2b48] border border-emerald-500/50 p-2.5 rounded-xl space-y-1">
                          <span className="text-[9px] text-emerald-300 font-black uppercase block">🔥 Más Vendido</span>
                          <p className="text-xs font-black text-white truncate">{String(datosBI.masVendido[0])}</p>
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-bold">x{String(datosBI.masVendido[1])} unids</span>
                        </div>

                        <div className="bg-[#0b2b48] border border-rose-500/50 p-2.5 rounded-xl space-y-1">
                          <span className="text-[9px] text-rose-300 font-black uppercase block">❄️ Menos Vendido</span>
                          <p className="text-xs font-black text-white truncate">{String(datosBI.menosVendido[0])}</p>
                          <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded font-bold">x{String(datosBI.menosVendido[1])} unids</span>
                        </div>
                      </div>

                      <div className="bg-[#0b2b48] border border-amber-500/50 p-3 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="text-[9px] text-amber-300 font-black uppercase block">⭐ El Mejor Día de Ventas</span>
                          <p className="text-xs font-black text-white">{String(datosBI.mejorDia[0])}</p>
                        </div>
                        <span className="text-xs bg-amber-950 text-amber-300 px-2.5 py-1 rounded-lg font-black border border-amber-500/40">
                          {String(datosBI.mejorDia[1])} Unidades
                        </span>
                      </div>

                      <div className="bg-[#0b2b48] border border-[#0066b3] p-3 rounded-xl space-y-2">
                        <span className="text-[10px] font-black text-sky-300 uppercase block border-b border-[#0066b3]/40 pb-1">
                          📊 Gráfico de Rendimiento por Producto (Global)
                        </span>
                        
                        <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
                          {datosBI.productosArray.map(([prod, cant], idx) => {
                            const porcentaje = Math.round((Number(cant) / datosBI.maxUnidadesProd) * 100);
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-[11px] text-white">
                                  <span className="truncate pr-2 font-semibold">{prod}</span>
                                  <span className="font-bold text-cyan-300">x{String(cant)}</span>
                                </div>
                                <div className="w-full bg-[#031d35] h-2 rounded-full overflow-hidden border border-[#0066b3]/30">
                                  <div 
                                    className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${porcentaje}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] font-black text-sky-300 uppercase block pt-1">
                      📍 DESGLOSE DE BI POR CADA SEDE:
                    </span>

                    {Object.entries(biPorSede).map(([nombreSede, infoSede]) => {
                      const abierto = !!acordeonBISedeAbierto[nombreSede];
                      const tieneVentas = infoSede.productosArray.length > 0;

                      return (
                        <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden shadow-sm">
                          <button 
                            onClick={() => setAcordeonBISedeAbierto(prev => ({ ...prev, [nombreSede]: !abierto }))} 
                            className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span>{abierto ? '👁️‍🗨️' : '👁️'}</span> 📍 BI - {nombreSede}
                            </span>
                            <span className="text-[10px] bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/50">
                              {infoSede.productosArray.length} Ítems analizados
                            </span>
                          </button>

                          {abierto && (
                            <div className="p-3 pt-0 bg-[#031d35] text-xs space-y-3 border-t border-[#0066b3]/30">
                              {!tieneVentas ? (
                                <p className="text-center text-xs text-sky-300 py-4 font-semibold">No hay ventas registradas para esta sede en este rango.</p>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 gap-2 pt-2">
                                    <div className="bg-[#0b2b48] border border-emerald-500/50 p-2.5 rounded-xl space-y-1">
                                      <span className="text-[9px] text-emerald-300 font-black uppercase block">🔥 Más Vendido</span>
                                      <p className="text-xs font-black text-white truncate">{String(infoSede.masVendido[0])}</p>
                                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-bold">x{String(infoSede.masVendido[1])} unids</span>
                                    </div>

                                    <div className="bg-[#0b2b48] border border-rose-500/50 p-2.5 rounded-xl space-y-1">
                                      <span className="text-[9px] text-rose-300 font-black uppercase block">❄️ Menos Vendido</span>
                                      <p className="text-xs font-black text-white truncate">{String(infoSede.menosVendido[0])}</p>
                                      <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded font-bold">x{String(infoSede.menosVendido[1])} unids</span>
                                    </div>
                                  </div>

                                  <div className="bg-[#0b2b48] border border-amber-500/50 p-2.5 rounded-xl flex justify-between items-center">
                                    <div>
                                      <span className="text-[9px] text-amber-300 font-black uppercase block">⭐ Mejor Día de Ventas</span>
                                      <p className="text-xs font-black text-white">{String(infoSede.mejorDia[0])}</p>
                                    </div>
                                    <span className="text-xs bg-amber-950 text-amber-300 px-2 py-0.5 rounded font-black border border-amber-500/40">
                                      {String(infoSede.mejorDia[1])} Unids
                                    </span>
                                  </div>

                                  <div className="bg-[#0b2b48] border border-[#0066b3] p-2.5 rounded-xl space-y-2">
                                    <span className="text-[10px] font-black text-sky-300 uppercase block border-b border-[#0066b3]/40 pb-1">
                                      📊 Rendimiento - {nombreSede}
                                    </span>
                                    <div className="space-y-2 pt-1 max-h-40 overflow-y-auto pr-1">
                                      {infoSede.productosArray.map(([prod, cant], idx) => {
                                        const porcentaje = Math.round((Number(cant) / infoSede.maxUnidadesProd) * 100);
                                        return (
                                          <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-[11px] text-white">
                                              <span className="truncate pr-2 font-semibold">{prod}</span>
                                              <span className="font-bold text-cyan-300">x{String(cant)}</span>
                                            </div>
                                            <div className="w-full bg-[#031d35] h-2 rounded-full overflow-hidden border border-[#0066b3]/30">
                                              <div 
                                                className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500" 
                                                style={{ width: `${porcentaje}%` }}
                                              ></div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MÓDULO 7: RAPPI Y DESCUENTOS */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('rappi')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-orange-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'rappi' ? '▼' : '▶'}</span> 🛵 7. RAPPI Y DESCUENTOS
              </span>
              <span className="bg-[#031d35] text-orange-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                Rappi: ${rappiYDescuentosData.totalRappiGlobal.toLocaleString()}
              </span>
            </button>

            {moduloAbierto === 'rappi' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0b2b48] border border-orange-500/50 p-2.5 rounded-xl space-y-1">
                    <span className="text-[9px] text-orange-300 font-black uppercase block">🛵 Total Rappi</span>
                    <p className="text-xs font-black text-white">${rappiYDescuentosData.totalRappiGlobal.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0b2b48] border border-sky-500/50 p-2.5 rounded-xl space-y-1">
                    <span className="text-[9px] text-sky-300 font-black uppercase block">🏷️ Total Descuentos</span>
                    <p className="text-xs font-black text-white">${rappiYDescuentosData.totalDescuentosGlobal.toLocaleString()}</p>
                  </div>
                </div>

                {Object.keys(rappiYDescuentosData.porSede).length === 0 ? (
                  <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay registros de Rappi o Descuentos en este rango de fechas.</p>
                ) : (
                  Object.entries(rappiYDescuentosData.porSede).map(([nombreSede, dataSede]) => {
                    const abierto = !!acordeonesRappi[nombreSede];
                    return (
                      <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden shadow-sm">
                        <button 
                          onClick={() => setAcordeonesRappi(prev => ({ ...prev, [nombreSede]: !abierto }))} 
                          className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span>{abierto ? '👁️‍🗨️' : '👁️'}</span> 📍 {nombreSede}
                          </span>
                          <span className="text-orange-300 font-bold">Rappi: ${dataSede.totalRappi.toLocaleString()}</span>
                        </button>

                        {abierto && (
                          <div className="p-3 pt-0 bg-[#031d35] text-xs space-y-2 border-t border-[#0066b3]/30">
                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1 text-white">
                              <span>🛵 Subtotal Rappi Sede:</span>
                              <span className="font-bold text-orange-300">${dataSede.totalRappi.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-b border-[#0066b3]/20 py-1 text-white">
                              <span>🏷️ Subtotal Descuentos Sede:</span>
                              <span className="font-bold text-sky-300">${dataSede.totalDescuentos.toLocaleString()}</span>
                            </div>
                            <div className="space-y-1 pt-2">
                              <span className="text-[10px] font-black text-sky-300 uppercase block">Detalle de registros:</span>
                              {dataSede.registros.map((reg, idx) => (
                                <div key={idx} className="bg-[#0b2b48] p-2 rounded border border-[#0066b3]/40 space-y-1 text-[11px]">
                                  <div className="flex justify-between text-sky-200">
                                    <span>Fecha: {obtenerFechaLocalStr(reg.fecha)}</span>
                                    <span className="font-bold text-orange-300">Rappi: ${Number(reg.rappi || 0).toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between text-sky-200">
                                    <span>Dto: ${Number(reg.descuento || 0).toLocaleString()}</span>
                                  </div>
                                  {reg.motivo_descuento && Array.isArray(reg.motivo_descuento) && reg.motivo_descuento.length > 0 && (
                                    <p className="text-[10px] text-amber-200 italic">
                                      Motivo: {reg.motivo_descuento.join(', ')}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* MÓDULO 8: COMPARATIVO DE MÉTODOS DE PAGO */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('pagos')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'pagos' ? '▼' : '▶'}</span> 💳 8. COMPARATIVO DE MÉTODOS DE PAGO
              </span>
              <span className="bg-[#031d35] text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                Total: ${comparativoMetodosPago.totalGeneralPagos.toLocaleString()}
              </span>
            </button>

            {moduloAbierto === 'pagos' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                <div className="bg-[#0b2b48] border border-emerald-500/50 p-3 rounded-xl space-y-3">
                  <span className="text-[11px] font-black text-emerald-300 uppercase block border-b border-emerald-500/30 pb-1">
                    🌐 Participación Global de Pagos
                  </span>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-[#031d35] p-2 rounded-xl border border-emerald-500/30">
                      <span className="block text-[9px] text-emerald-400 font-bold uppercase">💵 Efectivo</span>
                      <span className="text-xs font-black text-white">${comparativoMetodosPago.efectivoTotal.toLocaleString()}</span>
                      <span className="block text-[10px] text-emerald-300 font-bold">{comparativoMetodosPago.porcEfectivo}%</span>
                    </div>

                    <div className="bg-[#031d35] p-2 rounded-xl border border-sky-500/30">
                      <span className="block text-[9px] text-sky-300 font-bold uppercase">📲 Nequi</span>
                      <span className="text-xs font-black text-white">${comparativoMetodosPago.nequiTotal.toLocaleString()}</span>
                      <span className="block text-[10px] text-sky-200 font-bold">{comparativoMetodosPago.porcNequi}%</span>
                    </div>

                    <div className="bg-[#031d35] p-2 rounded-xl border border-rose-500/30">
                      <span className="block text-[9px] text-rose-300 font-bold uppercase">💳 Daviplata</span>
                      <span className="text-xs font-black text-white">${comparativoMetodosPago.daviplataTotal.toLocaleString()}</span>
                      <span className="block text-[10px] text-rose-200 font-bold">{comparativoMetodosPago.porcDaviplata}%</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-emerald-300 font-bold">Efectivo</span>
                        <span className="text-white">{comparativoMetodosPago.porcEfectivo}%</span>
                      </div>
                      <div className="w-full bg-[#031d35] h-2 rounded-full overflow-hidden border border-[#0066b3]/30">
                        <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${comparativoMetodosPago.porcEfectivo}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-sky-300 font-bold">Nequi</span>
                        <span className="text-white">{comparativoMetodosPago.porcNequi}%</span>
                      </div>
                      <div className="w-full bg-[#031d35] h-2 rounded-full overflow-hidden border border-[#0066b3]/30">
                        <div className="bg-sky-500 h-full rounded-full transition-all" style={{ width: `${comparativoMetodosPago.porcNequi}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-rose-300 font-bold">Daviplata</span>
                        <span className="text-white">{comparativoMetodosPago.porcDaviplata}%</span>
                      </div>
                      <div className="w-full bg-[#031d35] h-2 rounded-full overflow-hidden border border-[#0066b3]/30">
                        <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${comparativoMetodosPago.porcDaviplata}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-black text-sky-300 uppercase block pt-1">
                  📍 Desglosado por Sede:
                </span>

                {Object.keys(comparativoMetodosPago.porSede).length === 0 ? (
                  <p className="text-center text-[11px] text-sky-300 py-3">No hay registros de pagos por sede en este rango.</p>
                ) : (
                  Object.entries(comparativoMetodosPago.porSede).map(([nombreSede, datosSede], idx) => (
                    <div key={idx} className="bg-[#0b2b48] border border-[#0066b3] p-2.5 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center border-b border-[#0066b3]/40 pb-1">
                        <span className="font-bold text-white uppercase">📍 {nombreSede}</span>
                        <span className="font-black text-emerald-300 text-xs">Total: ${datosSede.total.toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-1 text-[11px]">
                        <div className="text-emerald-400">💵 Efec: ${datosSede.efectivo.toLocaleString()}</div>
                        <div className="text-sky-300">📲 Nequi: ${datosSede.nequi.toLocaleString()}</div>
                        <div className="text-rose-300">💳 Davi: ${datosSede.daviplata.toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                )}

              </div>
            )}
          </div>

        </div>
      )}

    </main>
  );
}