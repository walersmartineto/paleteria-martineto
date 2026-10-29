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

  const fechaHoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota'
  }).format(new Date());

  const [fechaInicio, setFechaInicio] = useState<string>(fechaHoy);
  const [fechaFin, setFechaFin] = useState<string>(fechaHoy);

  // ACORDEONES PRINCIPALES Y SUB-ACORDEONES
  const [acordeonAperturaAbierto, setAcordeonAperturaAbierto] = useState<boolean>(false);
  const [moduloAbierto, setModuloAbierto] = useState<string | null>(null);
  
  // SUBPESTAÑAS
  const [subPestanaLogistica, setSubPestanaLogistica] = useState<'por_sede' | 'por_proveedor'>('por_sede');
  const [subPestanaCierres, setSubPestanaCierres] = useState<'caja' | 'descuadres'>('caja');

  // SUB-ACORDEONES INTERNOS
  const [subAcordeonesSedesLogistica, setSubAcordeonesSedesLogistica] = useState<{ [key: string]: boolean }>({});
  const [subAcordeonesProvLogistica, setSubAcordeonesProvLogistica] = useState<{ [key: string]: boolean }>({});
  const [subAcordeonesDescuadres, setSubAcordeonesDescuadres] = useState<{ [key: string]: boolean }>({});
  const [acordeonesCierres, setAcordeonesCierres] = useState<{ [key: string]: boolean }>({});
  const [subAcordeonesStock, setSubAcordeonesStock] = useState<{ [key: string]: boolean }>({});
  const [acordeonesVentasAbanico, setAcordeonesVentasAbanico] = useState<{ [key: string]: boolean }>({});
  const [subAcordeonesBISedes, setSubAcordeonesBISedes] = useState<{ [key: string]: boolean }>({});

  const [resumenNominaOperarios, setResumenNominaOperarios] = useState<any[]>([]);
  const [sedesBD, setSedesBD] = useState<any[]>([]);
  const [mapaSedes, setMapaSedes] = useState<{ [id: number]: string }>({});
  const [usuariosBD, setUsuariosBD] = useState<{ [id: number]: string }>({});
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productosBD, setProductosBD] = useState<any[]>([]);
  const [registrosCaja, setRegistrosCaja] = useState<any[]>([]);
  const [registrosNomina, setRegistrosNomina] = useState<any[]>([]);
  const [inventarioMovimientos, setInventarioMovimientos] = useState<any[]>([]);
  const [inventarioMovsDia, setInventarioMovsDia] = useState<any[]>([]);
  const [inventarioEmpaquesSedesBD, setInventarioEmpaquesSedesBD] = useState<any[]>([]);
  const [historicoVentasBD, setHistoricoVentasBD] = useState<any[]>([]);
  const [historicoVentas30DiasBD, setHistoricoVentas30DiasBD] = useState<any[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // ESTADOS MÓDULO 10: GESTIÓN DEL SISTEMA
  const [subPestanaGestion, setSubPestanaGestion] = useState<'productos_venta' | 'usuarios'>('productos_venta');
  const [sedeSeleccionadaId, setSedeSeleccionadaId] = useState<number | null>(null);
  const [listaProductosVenta, setListaProductosVenta] = useState<any[]>([]);
  const [listaUsuariosGestion, setListaUsuariosGestion] = useState<any[]>([]);
  const [cargandoModulo10, setCargandoModulo10] = useState<boolean>(false);
  const [preciosEditados, setPreciosEditados] = useState<{ [id: number]: number }>({});
  const [pinesEditados, setPinesEditados] = useState<{ [id: number]: string }>({});
  const [mostrarModalNuevoUsuario, setMostrarModalNuevoUsuario] = useState<boolean>(false);
  const [nuevoUsuarioNombre, setNuevoUsuarioNombre] = useState<string>('');
  const [nuevoUsuarioCodigo, setNuevoUsuarioCodigo] = useState<string>('');
  const [nuevoUsuarioRol, setNuevoUsuarioRol] = useState<string>('operador');
  const [mostrarModalNuevoProdVenta, setMostrarModalNuevoProdVenta] = useState<boolean>(false);
  const [nuevoProdVentaNombre, setNuevoProdVentaNombre] = useState<string>('');
  const [nuevoProdVentaPrecio, setNuevoProdVentaPrecio] = useState<number | ''>('');
  const [nuevoProdVentaCategoria, setNuevoProdVentaCategoria] = useState<string>('');

  useEffect(() => {
    cargarDatosAdmin();
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    if (moduloAbierto === 'gestion_sistema') {
      cargarGestionSistema();
    }
  }, [moduloAbierto, subPestanaGestion, sedeSeleccionadaId]);

  async function cargarGestionSistema() {
    setCargandoModulo10(true);
    try {
      if (subPestanaGestion === 'productos_venta') {
        let query = supabase.from('productos_para_venta').select('*');
        if (sedeSeleccionadaId !== null) {
          query = query.eq('sede_id', sedeSeleccionadaId);
        }
        const { data, error } = await query;
        if (error) {
          console.error('Error consultando productos_para_venta:', error.message);
          setListaProductosVenta([]);
        } else {
          setListaProductosVenta(data || []);
        }
      } else {
        const { data, error } = await supabase.from('usuario').select('*');
        if (error) {
          console.error('Error consultando usuario:', error.message);
          setListaUsuariosGestion([]);
        } else {
          setListaUsuariosGestion(data || []);
        }
      }
    } catch (err) {
      console.error('Error procesando gestión del sistema:', err);
      setListaProductosVenta([]);
    } finally {
      setCargandoModulo10(false);
    }
  }

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

        if (sedesReales.length > 0 && sedeSeleccionadaId === null) {
          setSedeSeleccionadaId(sedesReales[0].id);
        }
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

      const { data: prodData } = await supabase.from('producto').select('id, nombre, donde_comprar, categoria');

      const { data: cajaDataRaw } = await supabase.from('caja').select('*');
      const registrosCajaFinales = (cajaDataRaw || [])
        .filter(row => {
          if (!row.fecha) return false;
          const fRow = obtenerFechaLocalStr(row.fecha);
          return fRow >= fechaInicio && fRow <= fechaFin;
        })
        .map(row => ({
          ...row,
          apertura: row.monto_apertura ?? row.base_inicial ?? 0
        }));

      const { data: nominaDataRaw } = await supabase.from('nomina').select('*');
      const nominaData = (nominaDataRaw || []).filter(row => {
        if (!row.fecha_pago) return false;
        const fRow = String(row.fecha_pago).split('T')[0];
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
        const total = Number(row.monto || 0);

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
      setProductosBD(prodData || []);
      setRegistrosCaja(registrosCajaFinales);
      setRegistrosNomina(nominaData);
      setInventarioMovimientos(diffDataFiltrado);
      setInventarioEmpaquesSedesBD(empaquesSedesData || []);
      setHistoricoVentasBD(historicoVentasFiltrado);
      setHistoricoVentas30DiasBD(historicoVentas30DiasFiltrado);
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
      const regInvApertura = inventarioMovsDia
        .filter(m => Number(m.sede_id) === idSede)
        .sort((a, b) => new Date(b.created_at || b.fecha_registro || 0).getTime() - new Date(a.created_at || a.fecha_registro || 0).getTime())[0];

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

  // RESUMEN DE COMPRAS POR SEDE
  const resumenComprasPorSede = (() => {
    const mapa: { [nombreSede: string]: { [prod: string]: number } } = {};
    pedidosPendientesCompra.forEach(p => {
      if (!mapaSedes[p.sede_id]) return;
      const nombreSede = getNombreSede(p.sede_id);

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

  // RESUMEN DE COMPRAS POR PROVEEDOR -> SEDE
  const resumenComprasPorProveedor = (() => {
    const mapa: { [lugar: string]: { [nombreSede: string]: { [prod: string]: number } } } = {};

    Object.entries(resumenComprasPorSede).forEach(([nombreSede, prodsSede]) => {
      Object.entries(prodsSede).forEach(([nombreProd, cant]) => {
        const prodEnBD = productosBD.find(item => String(item.nombre).trim().toLowerCase() === String(nombreProd).trim().toLowerCase());
        const lugar = prodEnBD?.donde_comprar && prodEnBD.donde_comprar.trim() !== '' ? prodEnBD.donde_comprar : '⚠️ Dónde Comprar No Asignado';

        if (!mapa[lugar]) mapa[lugar] = {};
        if (!mapa[lugar][nombreSede]) mapa[lugar][nombreSede] = {};

        mapa[lugar][nombreSede][nombreProd] = (mapa[lugar][nombreSede][nombreProd] || 0) + cant;
      });
    });

    return mapa;
  })();

  const CierreGlobal = (() => {
    const totalCaja = registrosCaja.reduce((acc, row) => {
      if (!mapaSedes[row.sede_id]) return acc;
      const efec = Number(row.efectivo_recibido !== undefined && row.efectivo_recibido !== null ? row.efectivo_recibido : (row.efectivo_cierre !== undefined && row.efectivo_cierre !== null ? row.efectivo_cierre : row.efectivo)) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      const rap = Number(row.rappi) || 0;
      const gas = Number(row.monto_gasto) || 0;
      return {
        efectivo: acc.efectivo + efec,
        nequi: acc.nequi + neq,
        daviplata: acc.daviplata + dav,
        rappi: acc.rappi + rap,
        gastos: acc.gastos + gas
      };
    }, { efectivo: 0, nequi: 0, daviplata: 0, rappi: 0, gastos: 0 });

    const totalNominaBD = registrosNomina.reduce((acc, n) => {
      if (!mapaSedes[n.sede_id]) return acc;
      return acc + (Number(n.monto) || 0);
    }, 0);

    const totalVentaTotal = totalCaja.efectivo + totalCaja.nequi + totalCaja.daviplata + totalCaja.rappi + totalCaja.gastos + totalNominaBD;

    return {
      ...totalCaja,
      nomina: totalNominaBD,
      totalVenta: totalVentaTotal
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

    return {
      efectivoTotal,
      nequiTotal,
      daviplataTotal,
      totalGeneralPagos,
      porSede
    };
  })();

  const cierresPorSede = (() => {
    const mapa: { [sede: string]: any } = {};

    const registrosOrdenados = [...registrosCaja].sort((a, b) => (a.id || 0) - (b.id || 0));

    registrosOrdenados.forEach(row => {
      if (!mapaSedes[row.sede_id]) return;
      const nombreSede = getNombreSede(row.sede_id);

      const aperturaVal = Number(row.apertura || 0);
      const efecRecibido = Number(row.efectivo_recibido !== undefined && row.efectivo_recibido !== null ? row.efectivo_recibido : (row.efectivo_cierre !== undefined && row.efectivo_cierre !== null ? row.efectivo_cierre : row.efectivo)) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      const gas = Number(row.monto_gasto) || 0;
      const rappiVal = Number(row.rappi) || 0;
      const descuentoVal = Number(row.descuento) || 0;
      const difCaja = Number(row.diferencia || 0);

      if (!mapa[nombreSede]) {
        mapa[nombreSede] = {
          apertura: aperturaVal,
          efectivoRecibido: 0,
          efectivoTotal: 0,
          nequi: 0,
          daviplata: 0,
          gastos: 0,
          nomina: 0,
          rappi: 0,
          descuentos: 0,
          totalVenta: 0,
          efectivoFisicoContado: 0,
          descuadreCaja: 0,
          diferenciaTablaCaja: 0,
          motivoDescuadre: [],
          motivosGastos: [],
          notasNomina: [],
          estadoCaja: 'cerrada'
        };
      } else {
        if (row.apertura !== undefined && row.apertura !== null) {
          mapa[nombreSede].apertura = aperturaVal;
        }
      }

      mapa[nombreSede].efectivoRecibido += efecRecibido;
      mapa[nombreSede].nequi += neq;
      mapa[nombreSede].daviplata += dav;
      mapa[nombreSede].gastos += gas;
      mapa[nombreSede].rappi += rappiVal;
      mapa[nombreSede].descuentos += descuentoVal;
      mapa[nombreSede].diferenciaTablaCaja += difCaja;
      
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
      const idSede = Number(n.sede_id);
      if (!mapaSedes[idSede]) return;
      const nombreSede = mapaSedes[idSede] || getNombreSede(idSede);

      const montoPago = Number(n.monto || 0);

      if (!mapa[nombreSede]) {
        mapa[nombreSede] = {
          apertura: 0,
          efectivoRecibido: 0,
          efectivoTotal: 0,
          nequi: 0,
          daviplata: 0,
          gastos: 0,
          nomina: 0,
          rappi: 0,
          descuentos: 0,
          totalVenta: 0,
          efectivoFisicoContado: 0,
          descuadreCaja: 0,
          diferenciaTablaCaja: 0,
          motivoDescuadre: [],
          motivosGastos: [],
          notasNomina: [],
          estadoCaja: 'cerrada'
        };
      }

      mapa[nombreSede].nomina += montoPago;
      const empleadoNombre = usuariosBD[n.usuario_id] || getNombreUsuario(n.usuario_id) || `Operario #${n.usuario_id}`;
      mapa[nombreSede].notasNomina.push(`${empleadoNombre} : $${montoPago.toLocaleString()}`);
    });

    Object.keys(mapa).forEach(sKey => {
      const item = mapa[sKey];
      item.efectivoTotal = item.efectivoRecibido;
      item.descuadreCaja = Number(item.diferenciaTablaCaja || 0);
      item.totalVenta = item.efectivoRecibido + item.nequi + item.daviplata + item.rappi + item.gastos + item.nomina;
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

  // AUDITORÍA DE DESCUADRES DESDE INVENTARIO_EMPAQUES_SEDES
  const auditoriaDescuadres = (() => {
    const mapaSedDescuadres: { 
      [sedeName: string]: { 
        sedeId: number; 
        diferencias: { producto: string; dif: number }[];
        totalDiferencia: number;
      } 
    } = {};

    sedesBD.forEach(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);

      const registrosEmpaquesSede = inventarioEmpaquesSedesBD.filter(item => Number(item.sede_id) === idSede);

      const diferenciasLista: { producto: string; dif: number }[] = [];
      let sumaTotalDif = 0;

      registrosEmpaquesSede.forEach(item => {
        const difVal = Number(item.diferencia ?? 0);
        const prodNombre = String(item.nombre || item.producto || `Item #${item.id}`).trim();

        if (difVal !== 0) {
          diferenciasLista.push({
            producto: prodNombre,
            dif: difVal
          });
          sumaTotalDif += difVal;
        }
      });

      if (diferenciasLista.length > 0) {
        mapaSedDescuadres[nombreSede] = {
          sedeId: idSede,
          diferencias: diferenciasLista,
          totalDiferencia: sumaTotalDif
        };
      }
    });

    return mapaSedDescuadres;
  })();

  const inventarioStockGeneralPorSede = (() => {
    const mapa: { 
      [sedeName: string]: { 
        detalleEmpaques: { [k: string]: number }; 
      } 
    } = {};

    sedesBD.forEach(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);

      const detalleEmpaques: { [k: string]: number } = {};
      const registrosSedeEmpaques = inventarioEmpaquesSedesBD.filter(item => Number(item.sede_id) === idSede);
      
      registrosSedeEmpaques.forEach(item => {
        const nombreItem = String(item.nombre || item.producto || '').trim();
        const stockVal = Number(item.stok ?? item.stock ?? 0);

        if (nombreItem) {
          detalleEmpaques[nombreItem] = stockVal;
        }
      });

      mapa[nombreSede] = { detalleEmpaques };
    });

    return mapa;
  })();

  const ventasAbanicoPorSede = (() => {
    const mapa: { [nombreSede: string]: { [producto: string]: number } } = {};

    historicoVentasBD.forEach(row => {
      const idSede = row.sede_id;
      if (!mapaSedes[idSede]) return;
      const nombreSede = getNombreSede(idSede);

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

  // INTELIGENCIA DE NEGOCIO AMPLIADA Y COMPARATIVO DE SEDES
  const datosBIAmpliados = (() => {
    const totalProductos: { [prod: string]: number } = {};
    const totalCategorias: { [cat: string]: number } = {};
    const ventasPorFechaGlobal: { [fecha: string]: number } = {};
    
    // ANALÍTICA COMPARATIVA POR SEDE
    const analiticaPorSede: { 
      [nombreSede: string]: {
        totalUnidades: number;
        productos: { [p: string]: number };
        categorias: { [c: string]: number };
      } 
    } = {};

    let totalUnidades30Dias = 0;

    historicoVentas30DiasBD.forEach(row => {
      const idSede = row.sede_id;
      if (!mapaSedes[idSede]) return;
      const nombreSede = getNombreSede(idSede);

      const fStr = obtenerFechaLocalStr(row.fecha);
      const prods = row.productos || {};

      if (!analiticaPorSede[nombreSede]) {
        analiticaPorSede[nombreSede] = { totalUnidades: 0, productos: {}, categorias: {} };
      }
      
      let totalFila = 0;
      Object.entries(prods).forEach(([prodName, cant]) => {
        const c = Number(cant) || 0;
        if (c > 0) {
          totalProductos[prodName] = (totalProductos[prodName] || 0) + c;
          totalFila += c;
          totalUnidades30Dias += c;

          const prodEnBD = productosBD.find(p => String(p.nombre).trim().toLowerCase() === String(prodName).trim().toLowerCase());
          const cat = prodEnBD?.categoria && prodEnBD.categoria.trim() !== '' ? prodEnBD.categoria : 'General';
          
          totalCategorias[cat] = (totalCategorias[cat] || 0) + c;

          analiticaPorSede[nombreSede].totalUnidades += c;
          analiticaPorSede[nombreSede].productos[prodName] = (analiticaPorSede[nombreSede].productos[prodName] || 0) + c;
          analiticaPorSede[nombreSede].categorias[cat] = (analiticaPorSede[nombreSede].categorias[cat] || 0) + c;
        }
      });

      if (fStr) {
        ventasPorFechaGlobal[fStr] = (ventasPorFechaGlobal[fStr] || 0) + totalFila;
      }
    });

    const productosArray = Object.entries(totalProductos).sort((a, b) => b[1] - a[1]);
    const top5MasVendidos = productosArray.slice(0, 5);
    const top5MenosVendidos = [...productosArray].reverse().slice(0, 5);

    const categoriasArray = Object.entries(totalCategorias).sort((a, b) => b[1] - a[1]);
    const categoriaMasPopular = categoriasArray.length > 0 ? categoriasArray[0] : ['N/A', 0];

    const fechasArray = Object.entries(ventasPorFechaGlobal).sort((a, b) => b[1] - a[1]);
    const mejorDia = fechasArray.length > 0 ? fechasArray[0] : ['N/A', 0];
    const diasConVentasCount = Object.keys(ventasPorFechaGlobal).length || 1;
    const promedioDiarioUnidades = Math.round(totalUnidades30Dias / diasConVentasCount);

    // PROCESAR COMPARATIVO DE SEDES
    const comparativoSedes = Object.entries(analiticaPorSede).map(([sNombre, sData]) => {
      const prodsOrdenados = Object.entries(sData.productos).sort((a, b) => b[1] - a[1]);
      const masVendido = prodsOrdenados.length > 0 ? prodsOrdenados[0] : ['N/A', 0];
      const menosVendido = prodsOrdenados.length > 0 ? prodsOrdenados[prodsOrdenados.length - 1] : ['N/A', 0];

      const catsOrdenadas = Object.entries(sData.categorias).sort((a, b) => b[1] - a[1]);
      const catLider = catsOrdenadas.length > 0 ? catsOrdenadas[0] : ['N/A', 0];

      const porcentajeParticipacion = totalUnidades30Dias > 0 
        ? Math.round((sData.totalUnidades / totalUnidades30Dias) * 100) 
        : 0;

      return {
        nombreSede: sNombre,
        totalUnidades: sData.totalUnidades,
        porcentajeParticipacion,
        masVendido,
        menosVendido,
        catLider
      };
    }).sort((a, b) => b.totalUnidades - a.totalUnidades);

    return {
      top5MasVendidos,
      top5MenosVendidos,
      categoriaMasPopular,
      mejorDia,
      promedioDiarioUnidades,
      totalUnidades30Dias,
      diasConVentasCount,
      comparativoSedes
    };
  })();

  // HANDLERS MÓDULO 10: GESTIÓN DEL SISTEMA (PRODUCTOS Y USUARIOS)
  async function toggleEstadoProducto(id: number, activoActual: boolean) {
    const nuevoEstado = !activoActual;
    try {
      const { error } = await supabase
        .from('productos_para_venta')
        .update({ activo: nuevoEstado })
        .eq('id', id);

      if (error) {
        alert('⚠️ No se pudo cambiar el estado del producto');
        return;
      }

      await cargarGestionSistema();
    } catch (e) {
      console.error(e);
    }
  }

  async function guardarPrecioProducto(id: number) {
    const nuevoPrecio = preciosEditados[id];
    if (nuevoPrecio === undefined || isNaN(nuevoPrecio)) return;
    try {
      const { error } = await supabase
        .from('productos_para_venta')
        .update({ precio: nuevoPrecio })
        .eq('id', id);

      if (error) {
        alert('⚠️ Error actualizando el precio');
        return;
      }

      setPreciosEditados(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      alert('✅ Precio actualizado correctamente');
      await cargarGestionSistema();
    } catch (e) {
      console.error(e);
    }
  }

  async function guardarPinUsuario(id: number) {
    const nuevoPin = pinesEditados[id];
    if (!nuevoPin || !nuevoPin.trim()) return;
    try {
      const { error } = await supabase
        .from('usuario')
        .update({ codigo_acceso: nuevoPin.trim() })
        .eq('id', id);

      if (error) {
        alert('⚠️ Error actualizando clave');
        return;
      }

      setPinesEditados(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      alert('✅ PIN / Clave actualizada correctamente');
      await cargarGestionSistema();
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleEstadoUsuario(id: number, activoActual: boolean) {
    const nuevoEstado = !activoActual;
    try {
      const { error } = await supabase
        .from('usuario')
        .update({ activo: nuevoEstado })
        .eq('id', id);

      if (error) {
        alert('⚠️ No se pudo cambiar el estado del usuario');
        return;
      }

      await cargarGestionSistema();
    } catch (e) {
      console.error(e);
    }
  }

  async function crearUsuarioBD() {
    if (!nuevoUsuarioNombre.trim() || !nuevoUsuarioCodigo.trim()) {
      alert('⚠️ Diligencie el nombre y código PIN.');
      return;
    }
    try {
      const { error } = await supabase.from('usuario').insert([{
        nombre_completo: nuevoUsuarioNombre.trim(),
        codigo_acceso: nuevoUsuarioCodigo.trim(),
        tipo_usuario: nuevoUsuarioRol,
        activo: true
      }]);

      if (error) {
        alert('⚠️ No se pudo crear el usuario');
        return;
      }

      alert('✅ Usuario creado exitosamente');
      setMostrarModalNuevoUsuario(false);
      setNuevoUsuarioNombre('');
      setNuevoUsuarioCodigo('');
      await cargarGestionSistema();
    } catch (e) {
      console.error(e);
    }
  }

  async function crearProductoVentaBD() {
    if (!nuevoProdVentaNombre.trim() || nuevoProdVentaPrecio === '') {
      alert('⚠️ Ingrese el nombre y precio del producto.');
      return;
    }
    try {
      const { error } = await supabase.from('productos_para_venta').insert([{
        nombre: nuevoProdVentaNombre.trim(),
        precio: Number(nuevoProdVentaPrecio),
        categoria: nuevoProdVentaCategoria.trim() || 'General',
        sede_id: sedeSeleccionadaId,
        activo: true
      }]);

      if (error) {
        alert('⚠️ No se pudo registrar el producto');
        return;
      }

      alert('✅ Producto registrado correctamente');
      setMostrarModalNuevoProdVenta(false);
      setNuevoProdVentaNombre('');
      setNuevoProdVentaPrecio('');
      setNuevoProdVentaCategoria('');
      await cargarGestionSistema();
    } catch (e) {
      console.error(e);
    }
  }

  const toggleModulo = (id: string) => {
    setModuloAbierto(prev => prev === id ? null : id);
  };

  return (
    <main className="min-h-screen bg-[#004e8c] text-white p-3 font-sans max-w-md mx-auto space-y-4 pb-20">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-sm font-black text-white">🛡️ ADMIN CENTRAL</h1>
          <p className="text-[10px] text-sky-200">Panel de Control General</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { cargarDatosAdmin(); router.refresh(); }} 
            className="bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-emerald-400 cursor-pointer flex items-center gap-1"
          >
            🔄 Actualizar
          </button>
          <button 
            onClick={() => { router.back(); setTimeout(() => router.refresh(), 100); }} 
            className="bg-[#031d35] hover:bg-[#003d6d] px-3 py-1.5 rounded-xl text-xs font-bold border border-[#0066b3] cursor-pointer"
          >
            Volver
          </button>
        </div>
      </header>

      {/* 1. RANGO DE FECHAS */}
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

      {/* 2. CONTROL DE APERTURAS Y OPERARIOS */}
      <div className="bg-[#0b2b48] border border-amber-500/60 rounded-2xl overflow-hidden shadow-lg">
        <button 
          onClick={() => setAcordeonAperturaAbierto(prev => !prev)}
          className="w-full p-3 flex justify-between items-center text-xs font-black text-amber-300 uppercase bg-[#0b2b48] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span>{acordeonAperturaAbierto ? '👁️‍🗨️' : '👁️'}</span> 🟢 CONTROL DE APERTURAS Y OPERARIOS (HOY)
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
                      <td className="py-1.5 text-right font-bold text-sky-200 truncate max-w-[80px]">{item.operario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {cargando ? <div className="text-center py-10 text-xs font-bold text-sky-200">Cargando datos...</div> : (
        <div className="space-y-3">

          {/* MÓDULO 1: GESTIÓN LOGÍSTICA EN COMPRAS */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('logistica')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-amber-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'logistica' ? '👁️‍🗨️' : '👁️'}</span> 🚚 1. GESTIÓN LOGÍSTICA EN COMPRAS
              </span>
              <span className="bg-[#031d35] text-sky-200 text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                {pedidosPendientesCompra.length} pedidos
              </span>
            </button>

            {moduloAbierto === 'logistica' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setSubPestanaLogistica('por_sede')} 
                    className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border transition-all ${subPestanaLogistica === 'por_sede' ? 'bg-amber-600 border-amber-400 text-white shadow-md' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}
                  >
                    📍 Por Sede
                  </button>
                  <button 
                    onClick={() => setSubPestanaLogistica('por_proveedor')} 
                    className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border transition-all ${subPestanaLogistica === 'por_proveedor' ? 'bg-amber-600 border-amber-400 text-white shadow-md' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}
                  >
                    🏪 Por Proveedor
                  </button>
                </div>

                {subPestanaLogistica === 'por_sede' && (
                  <div className="space-y-3 pt-1">
                    {Object.keys(resumenComprasPorSede).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-4 font-semibold">No hay compras pendientes para el rango seleccionado.</p>
                    ) : (
                      Object.entries(resumenComprasPorSede).map(([nombreSede, productosSede]) => {
                        const estaAbierto = !!subAcordeonesSedesLogistica[nombreSede];

                        return (
                          <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden shadow-sm">
                            <button 
                              onClick={() => setSubAcordeonesSedesLogistica(prev => ({ ...prev, [nombreSede]: !estaAbierto }))}
                              className="w-full p-3 flex justify-between items-center text-xs font-black text-amber-300 uppercase bg-[#0b2b48] cursor-pointer border-b border-[#0066b3]/30"
                            >
                              <span className="flex items-center gap-2">
                                <span>{estaAbierto ? '👁️‍🗨️' : '👁️'}</span> 📍 SEDE: {nombreSede}
                              </span>
                              <span className="text-[10px] text-sky-300 font-bold">
                                {Object.keys(productosSede).length} Ítems
                              </span>
                            </button>

                            {estaAbierto && (
                              <div className="p-3 space-y-2 bg-[#031d35]/80">
                                {(() => {
                                  const comprasPorLugar: { [lugar: string]: { [prod: string]: number } } = {};
                                  
                                  Object.entries(productosSede).forEach(([nombreProd, cant]) => {
                                    const prodEnBD = productosBD.find(item => String(item.nombre).trim().toLowerCase() === String(nombreProd).trim().toLowerCase());
                                    const lugar = prodEnBD?.donde_comprar && prodEnBD.donde_comprar.trim() !== '' ? prodEnBD.donde_comprar : '⚠️ Dónde Comprar No Asignado';
                                    
                                    if (!comprasPorLugar[lugar]) comprasPorLugar[lugar] = {};
                                    comprasPorLugar[lugar][nombreProd] = cant;
                                  });

                                  return Object.entries(comprasPorLugar).map(([lugar, items]) => (
                                    <div key={lugar} className="bg-[#0b2b48] p-2.5 rounded-lg border border-[#0066b3]/50 space-y-1">
                                      <span className="text-[11px] font-bold text-sky-300 uppercase block border-b border-[#0066b3]/30 pb-1">🏪 {lugar}</span>
                                      <div className="divide-y divide-[#0066b3]/20">
                                        {Object.entries(items).map(([pNombre, pCant]) => (
                                          <div key={pNombre} className="flex justify-between items-center py-1 text-xs text-white">
                                            <span>• {pNombre}</span>
                                            <span className="font-black text-emerald-400">x{pCant}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {subPestanaLogistica === 'por_proveedor' && (
                  <div className="space-y-3 pt-1">
                    {Object.keys(resumenComprasPorProveedor).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-4 font-semibold">No hay compras pendientes para el rango seleccionado.</p>
                    ) : (
                      Object.entries(resumenComprasPorProveedor).map(([proveedor, sedesMap]) => {
                        const estaAbierto = !!subAcordeonesProvLogistica[proveedor];

                        return (
                          <div key={proveedor} className="border border-amber-500/60 bg-[#0b2b48] rounded-xl overflow-hidden shadow-sm">
                            <button 
                              onClick={() => setSubAcordeonesProvLogistica(prev => ({ ...prev, [proveedor]: !estaAbierto }))}
                              className="w-full p-3 flex justify-between items-center text-xs font-black text-amber-300 uppercase bg-[#0b2b48] cursor-pointer border-b border-amber-500/30"
                            >
                              <span className="flex items-center gap-2 truncate">
                                <span>{estaAbierto ? '👁️‍🗨️' : '👁️'}</span> 🏪 {proveedor}
                              </span>
                              <span className="text-[10px] text-sky-300 font-bold">
                                {Object.keys(sedesMap).length} Sedes
                              </span>
                            </button>

                            {estaAbierto && (
                              <div className="p-3 space-y-2 bg-[#031d35]/80">
                                {Object.entries(sedesMap).map(([nombreSede, items]) => (
                                  <div key={nombreSede} className="bg-[#0b2b48] p-2.5 rounded-lg border border-[#0066b3]/50 space-y-1">
                                    <span className="text-[11px] font-bold text-sky-300 uppercase block border-b border-[#0066b3]/30 pb-1">📍 SEDE: {nombreSede}</span>
                                    <div className="divide-y divide-[#0066b3]/20">
                                      {Object.entries(items).map(([pNombre, pCant]) => (
                                        <div key={pNombre} className="flex justify-between items-center py-1 text-xs text-white">
                                          <span>• {pNombre}</span>
                                          <span className="font-black text-emerald-400">x{pCant}</span>
                                        </div>
                                      ))}
                                    </div>
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
            )}
          </div>

          {/* MÓDULO 2: DESCUADRES DE PRODUCTOS POR SEDE */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('descuadres_productos')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-rose-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'descuadres_productos' ? '👁️‍🗨️' : '👁️'}</span> 🔍 2. DESCUADRES DE PRODUCTOS (hoy)
              </span>
              <span className="bg-[#031d35] text-rose-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                {Object.keys(auditoriaDescuadres).length} Sedes
              </span>
            </button>

            {moduloAbierto === 'descuadres_productos' && (
              <div className="p-3 space-y-3 bg-[#031d35]/60 text-xs border-t border-[#0066b3]/30">
                {Object.keys(auditoriaDescuadres).length === 0 ? (
                  <p className="text-center text-xs text-sky-300 py-4 font-semibold">No se encontraron diferencias registradas en inventario_empaques_sedes.</p>
                ) : (
                  Object.entries(auditoriaDescuadres).map(([nombreSede, infoSede]) => {
                    const estaAbierto = !!subAcordeonesDescuadres[nombreSede];

                    return (
                      <div key={nombreSede} className="bg-[#0b2b48] border border-[#0066b3] rounded-xl overflow-hidden space-y-1">
                        <button 
                          onClick={() => setSubAcordeonesDescuadres(prev => ({ ...prev, [nombreSede]: !estaAbierto }))}
                          className="w-full p-3 flex justify-between items-center text-xs font-black text-amber-300 uppercase bg-[#0b2b48] cursor-pointer border-b border-[#0066b3]/30"
                        >
                          <span className="flex items-center gap-2">
                            <span>{estaAbierto ? '👁️‍🗨️' : '👁️'}</span> 📍 {nombreSede}
                          </span>
                          <span className="text-[10px] bg-rose-950 text-rose-300 font-bold px-2 py-0.5 rounded border border-rose-500/40">
                            Dif Total: {infoSede.totalDiferencia}
                          </span>
                        </button>

                        {estaAbierto && (
                          <div className="p-3 space-y-1 divide-y divide-[#0066b3]/20 bg-[#031d35]">
                            {infoSede.diferencias.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 text-white text-[11px]">
                                <span>{item.producto}</span>
                                <span className={`font-bold ${item.dif < 0 ? 'text-rose-400' : 'text-amber-300'}`}>
                                  {item.dif > 0 ? `+${item.dif}` : item.dif}
                                </span>
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

          {/* MÓDULO 3: CIERRE DE CAJA */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('cierres')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'cierres' ? '👁️‍🗨️' : '👁️'}</span> 💰 3. CIERRE DE CAJA
              </span>
              <span className="bg-[#031d35] text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                ${CierreGlobal.totalVenta.toLocaleString()}
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
                    <div className="border border-emerald-500/50 bg-[#0b2b48] rounded-xl overflow-hidden">
                      <button onClick={() => setAcordeonesCierres(prev => ({ ...prev, global: !prev.global }))} className="w-full p-3 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-emerald-950/40 cursor-pointer">
                        <span className="flex items-center gap-1.5">
                          <span>{acordeonesCierres.global ? '👁️‍🗨️' : '👁️'}</span> CONSOLIDADO GLOBAL
                        </span>
                        <span className="text-emerald-300 font-bold">${CierreGlobal.totalVenta.toLocaleString()}</span>
                      </button>
                      {acordeonesCierres.global && (
                        <div className="p-3 space-y-1.5 bg-[#031d35] text-xs border-t border-emerald-500/30">
                          <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💵 Efectivo:</span><span className="font-bold text-emerald-400">${CierreGlobal.efectivo.toLocaleString()}</span></div>
                          <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📲 Nequi:</span><span className="font-bold text-sky-300">${CierreGlobal.nequi.toLocaleString()}</span></div>
                          <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💳 Daviplata:</span><span className="font-bold text-rose-300">${CierreGlobal.daviplata.toLocaleString()}</span></div>
                          <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>🛵 Rappi:</span><span className="font-bold text-orange-300">${CierreGlobal.rappi.toLocaleString()}</span></div>
                          <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📉 Gastos Registrados:</span><span className="font-bold text-amber-400">${CierreGlobal.gastos.toLocaleString()}</span></div>
                          <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>👥 Nómina Turnos:</span><span className="font-bold text-fuchsia-300">${CierreGlobal.nomina.toLocaleString()}</span></div>
                          <div className="flex justify-between py-1.5 text-xs font-black border-t border-emerald-400 mt-1 text-white"><span>💰 TOTAL RECAUDADO (ENTRADAS):</span><span className="text-emerald-300">${CierreGlobal.totalVenta.toLocaleString()}</span></div>
                        </div>
                      )}
                    </div>

                    {Object.keys(cierresPorSede).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-6 font-semibold">No se encontraron cierres de caja en este rango.</p>
                    ) : (
                      Object.entries(cierresPorSede).map(([nombreSede, dataSede]) => {
                        const abierto = !!acordeonesCierres[nombreSede];

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
                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💵 Apertura:</span><span className="font-bold text-sky-200">${dataSede.apertura.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📥 Total Efectivo Recibido:</span><span className="font-bold text-emerald-400">${dataSede.efectivoRecibido.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📲 Total Nequi:</span><span className="font-bold text-sky-300">${dataSede.nequi.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💳 Total Daviplata:</span><span className="font-bold text-rose-300">${dataSede.daviplata.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>🛵 Total Rappi:</span><span className="font-bold text-orange-300">${dataSede.rappi.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📉 Gastos de Insumos:</span><span className="font-bold text-amber-400">${dataSede.gastos.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>👥 Nómina Pagada:</span><span className="font-bold text-fuchsia-300">${dataSede.nomina.toLocaleString()}</span></div>

                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1">
                                  <span>💵 Efectivo Físico Contado:</span>
                                  <span className="font-bold text-white">${dataSede.efectivoFisicoContado.toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between border-b border-[#0066b3]/20 py-1 text-amber-300 font-bold">
                                  <span>⚠️ Diferencia Tabla Caja:</span>
                                  <span>${dataSede.diferenciaTablaCaja.toLocaleString()}</span>
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
                                  <span>💰 TOTAL VENDIDO (ENTRADAS):</span>
                                  <span className="text-emerald-300">${dataSede.totalVenta.toLocaleString()}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {subPestanaCierres === 'descuadres' && (
                  <div className="space-y-3">
                    {Object.keys(auditoriaDescuadres).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-4 font-semibold">No hay diferencias detalladas para este rango.</p>
                    ) : (
                      Object.entries(auditoriaDescuadres).map(([nombreSede, infoSede]) => (
                        <div key={nombreSede} className="border border-[#0066b3] bg-[#0b2b48] rounded-xl overflow-hidden p-3 space-y-2">
                          <div className="flex justify-between items-center border-b border-[#0066b3]/40 pb-1">
                            <span className="font-bold text-white uppercase">📍 {nombreSede}</span>
                            <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded font-black">
                              Total Dif: {infoSede.totalDiferencia}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {infoSede.diferencias.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] text-white border-b border-[#0066b3]/20 py-1">
                                <span>{item.producto}</span>
                                <span className="font-black text-amber-400">{item.dif}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* MÓDULO 4: INVENTARIO DIARIO Y STOCK POR SEDE */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('inventarios')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-sky-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'inventarios' ? '👁️‍🗨️' : '👁️'}</span> 📦 4. INVENTARIO DIARIO Y STOCK
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
                    const estaAbierto = !!subAcordeonesStock[nombreSede];

                    return (
                      <div key={nombreSede} className="bg-[#0b2b48] rounded-xl border border-[#0066b3] overflow-hidden space-y-1">
                        <button 
                          onClick={() => setSubAcordeonesStock(prev => ({ ...prev, [nombreSede]: !estaAbierto }))}
                          className="w-full p-3 flex justify-between items-center text-xs font-bold text-sky-200 uppercase bg-[#0b2b48] cursor-pointer border-b border-[#0066b3]/30"
                        >
                          <span className="flex items-center gap-2">
                            <span>{estaAbierto ? '👁️‍🗨️' : '👁️'}</span> 📍 {nombreSede}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            {Object.keys(infoSede.detalleEmpaques).length} Ítems
                          </span>
                        </button>

                        {estaAbierto && (
                          <div className="p-3 divide-y divide-[#0066b3]/20 bg-[#031d35]">
                            {Object.entries(infoSede.detalleEmpaques).map(([prod, cant]) => (
                              <div key={prod} className="flex justify-between py-1 text-xs text-white">
                                <span>{prod}</span>
                                <span className="font-bold text-emerald-300">{cant}</span>
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

          {/* MÓDULO 5: NÓMINA POR OPERARIO Y VALOR */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('modulo_nomina')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-fuchsia-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'modulo_nomina' ? '👁️‍🗨️' : '👁️'}</span> 👥 5. NÓMINA POR OPERARIO Y VALOR
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
                            {op.turnosCount} Turnos
                          </span>
                        </div>

                        <div className="flex justify-between items-center pt-1 font-black text-xs">
                          <span className="text-white">💰 VALOR PAGO NÓMINA:</span>
                          <span className="text-fuchsia-300 text-sm">${op.totalPagado.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* MÓDULO 6: VENTAS E HISTÓRICO */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('ventas_abanico')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-cyan-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'ventas_abanico' ? '👁️‍🗨️' : '👁️'}</span> 📊 6. VENTAS (HISTÓRICO VENTAS)
              </span>
              <span className="bg-[#031d35] text-cyan-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                {Object.keys(ventasAbanicoPorSede).length} Sedes
              </span>
            </button>

            {moduloAbierto === 'ventas_abanico' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
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
                              <span>PRODUCTO</span>
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
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* MÓDULO 7: INTELIGENCIA DE NEGOCIO AMPLIADA (30 DÍAS) Y COMPARATIVO POR SEDE */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('bi')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-amber-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'bi' ? '👁️‍🗨️' : '👁️'}</span> 🧠 7. INTELIGENCIA DE NEGOCIO (30 DÍAS)
              </span>
              <span className="bg-[#031d35] text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                Analítica
              </span>
            </button>

            {moduloAbierto === 'bi' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                
                {/* METRICAS DE RESUMEN GENERAL */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0b2b48] border border-[#0066b3] p-2.5 rounded-xl space-y-1">
                    <span className="text-[9px] text-sky-300 font-extrabold uppercase block">📦 Unidades Vendidas</span>
                    <p className="text-sm font-black text-emerald-400">{datosBIAmpliados.totalUnidades30Dias} unids</p>
                    <span className="text-[9px] text-sky-200 block">En {datosBIAmpliados.diasConVentasCount} días con ventas</span>
                  </div>

                  <div className="bg-[#0b2b48] border border-[#0066b3] p-2.5 rounded-xl space-y-1">
                    <span className="text-[9px] text-sky-300 font-extrabold uppercase block">📈 Promedio Diario</span>
                    <p className="text-sm font-black text-amber-300">~{datosBIAmpliados.promedioDiarioUnidades} unids/día</p>
                    <span className="text-[9px] text-sky-200 block">Rendimiento constante</span>
                  </div>
                </div>

                {/* DÍA TOP Y CATEGORÍA POPULAR */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0b2b48] border border-emerald-500/40 p-2.5 rounded-xl space-y-1">
                    <span className="text-[9px] text-emerald-300 font-extrabold uppercase block">📅 Mejor Día de Ventas</span>
                    <p className="text-xs font-black text-white">{datosBIAmpliados.mejorDia[0]}</p>
                    <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                      {datosBIAmpliados.mejorDia[1]} unids
                    </span>
                  </div>

                  <div className="bg-[#0b2b48] border border-fuchsia-500/40 p-2.5 rounded-xl space-y-1">
                    <span className="text-[9px] text-fuchsia-300 font-extrabold uppercase block">🏷️ Categoría Más Vendida</span>
                    <p className="text-xs font-black text-white">{datosBIAmpliados.categoriaMasPopular[0]}</p>
                    <span className="text-[9px] bg-fuchsia-950 text-fuchsia-300 px-1.5 py-0.5 rounded font-bold">
                      {datosBIAmpliados.categoriaMasPopular[1]} unids
                    </span>
                  </div>
                </div>

                {/* COMPARATIVO ANALÍTICO POR SEDE */}
                <div className="bg-[#0b2b48] border border-amber-500/50 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-black text-amber-300 uppercase block border-b border-amber-500/30 pb-1">
                    🏢 COMPARATIVO DE RENDIMIENTO POR SEDE
                  </span>

                  <div className="space-y-2 pt-1">
                    {datosBIAmpliados.comparativoSedes.length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-2">Sin datos suficientes para comparar sedes.</p>
                    ) : (
                      datosBIAmpliados.comparativoSedes.map((item) => {
                        const estaAbierto = !!subAcordeonesBISedes[item.nombreSede];

                        return (
                          <div key={item.nombreSede} className="border border-[#0066b3] bg-[#031d35] rounded-xl overflow-hidden">
                            <button
                              onClick={() => setSubAcordeonesBISedes(prev => ({ ...prev, [item.nombreSede]: !estaAbierto }))}
                              className="w-full p-2.5 flex justify-between items-center text-xs font-black uppercase text-white bg-[#031d35] cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <span>{estaAbierto ? '👁️‍🗨️' : '👁️'}</span> 📍 {item.nombreSede}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-emerald-400 font-bold">{item.totalUnidades} unids</span>
                                <span className="text-[9px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                                  {item.porcentajeParticipacion}%
                                </span>
                              </div>
                            </button>

                            {estaAbierto && (
                              <div className="p-2.5 bg-[#0b2b48] border-t border-[#0066b3]/30 space-y-1.5 text-[11px]">
                                <div className="flex justify-between items-center">
                                  <span className="text-sky-300 font-bold">🔥 Más Vendido:</span>
                                  <span className="text-white font-bold">{String(item.masVendido[0])} <b className="text-emerald-400">(x{String(item.masVendido[1])})</b></span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sky-300 font-bold">❄️ Menos Vendido:</span>
                                  <span className="text-white font-bold">{String(item.menosVendido[0])} <b className="text-rose-300">(x{String(item.menosVendido[1])})</b></span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sky-300 font-bold">🏷️ Categoría Fuerte:</span>
                                  <span className="text-fuchsia-300 font-bold">{String(item.catLider[0])}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* TOP 5 MÁS VENDIDOS GLOBAL */}
                <div className="bg-[#0b2b48] border border-emerald-500/50 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-black text-emerald-300 uppercase block border-b border-emerald-500/30 pb-1">
                    🔥 TOP 5 PRODUCTOS MÁS VENDIDOS (GLOBAL)
                  </span>
                  <div className="space-y-1 divide-y divide-[#0066b3]/20">
                    {datosBIAmpliados.top5MasVendidos.map(([pNombre, pCant], idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 text-[11px] text-white">
                        <span>{idx + 1}. {pNombre}</span>
                        <span className="font-black text-emerald-400">x{pCant}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TOP 5 MENOS VENDIDOS GLOBAL */}
                <div className="bg-[#0b2b48] border border-rose-500/50 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-black text-rose-300 uppercase block border-b border-rose-500/30 pb-1">
                    ❄️ TOP 5 PRODUCTOS MENOS VENDIDOS (GLOBAL)
                  </span>
                  <div className="space-y-1 divide-y divide-[#0066b3]/20">
                    {datosBIAmpliados.top5MenosVendidos.map(([pNombre, pCant], idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 text-[11px] text-white">
                        <span>• {pNombre}</span>
                        <span className="font-black text-rose-300">x{pCant}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* MÓDULO 8: RAPPI (TABLA CAJA) */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('rappi')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-orange-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'rappi' ? '👁️‍🗨️' : '👁️'}</span> 🛵 8. RAPPI (COLUMNA RAPPI - TABLA CAJA)
              </span>
              <span className="bg-[#031d35] text-orange-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                Total: ${rappiYDescuentosData.totalRappiGlobal.toLocaleString()}
              </span>
            </button>

            {moduloAbierto === 'rappi' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60">
                <div className="bg-[#0b2b48] border border-orange-500/50 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] text-orange-300 font-black uppercase block">🛵 Total Rappi Recaudado</span>
                  <p className="text-sm font-black text-white">${rappiYDescuentosData.totalRappiGlobal.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* MÓDULO 9: COMPARATIVO MÉTODOS DE PAGO */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('pagos')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'pagos' ? '👁️‍🗨️' : '👁️'}</span> 💳 9. COMPARATIVO DE MÉTODOS DE PAGO
              </span>
              <span className="bg-[#031d35] text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded border border-[#0066b3]">
                Total: ${comparativoMetodosPago.totalGeneralPagos.toLocaleString()}
              </span>
            </button>

            {moduloAbierto === 'pagos' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                <div className="bg-[#0b2b48] border border-emerald-500/50 p-3 rounded-xl space-y-3">
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-[#031d35] p-2 rounded-xl border border-emerald-500/30">
                      <span className="block text-[9px] text-emerald-400 font-bold uppercase">💵 Efectivo</span>
                      <span className="text-xs font-black text-white">${comparativoMetodosPago.efectivoTotal.toLocaleString()}</span>
                    </div>

                    <div className="bg-[#031d35] p-2 rounded-xl border border-sky-500/30">
                      <span className="block text-[9px] text-sky-300 font-bold uppercase">📲 Nequi</span>
                      <span className="text-xs font-black text-white">${comparativoMetodosPago.nequiTotal.toLocaleString()}</span>
                    </div>

                    <div className="bg-[#031d35] p-2 rounded-xl border border-rose-500/30">
                      <span className="block text-[9px] text-rose-300 font-bold uppercase">💳 Daviplata</span>
                      <span className="text-xs font-black text-white">${comparativoMetodosPago.daviplataTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MÓDULO 10: GESTIÓN DEL SISTEMA */}
          <div className="border-2 border-fuchsia-500/80 bg-[#0b2b48] rounded-2xl overflow-hidden shadow-xl">
            <button onClick={() => toggleModulo('gestion_sistema')} className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-fuchsia-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'gestion_sistema' ? '👁️‍🗨️' : '👁️'}</span> ⚙️ 10. GESTIÓN DEL SISTEMA (4 PUNTOS)
              </span>
              <span className="bg-fuchsia-950/80 text-fuchsia-300 font-bold text-[10px] px-2 py-0.5 rounded border border-fuchsia-500/50">Usuarios y Precios</span>
            </button>

            {moduloAbierto === 'gestion_sistema' && (
              <div className="p-3 pt-0 space-y-3 border-t border-fuchsia-500/30 bg-[#031d35]/70">
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button onClick={() => setSubPestanaGestion('productos_venta')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaGestion === 'productos_venta' ? 'bg-fuchsia-700 border-fuchsia-400 text-white' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}>🏷️ Productos / Precios</button>
                  <button onClick={() => setSubPestanaGestion('usuarios')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaGestion === 'usuarios' ? 'bg-fuchsia-700 border-fuchsia-400 text-white' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}>👤 Usuarios / Roles</button>
                </div>

                {subPestanaGestion === 'productos_venta' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap gap-1 bg-[#0b2b48] p-2 rounded-xl border border-[#0066b3] justify-between items-center">
                      <div className="flex gap-1 overflow-x-auto">
                        {sedesBD.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSedeSeleccionadaId(s.id)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              sedeSeleccionadaId === s.id ? 'bg-[#0078d4] text-white shadow' : 'bg-[#031d35] text-sky-300'
                            }`}
                          >
                            {s.nombre}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setMostrarModalNuevoProdVenta(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] px-2 py-1 rounded uppercase cursor-pointer">➕ Crear</button>
                    </div>

                    {cargandoModulo10 ? (
                      <div className="text-center py-6 text-xs text-sky-200 font-bold">Cargando productos de la sede...</div>
                    ) : listaProductosVenta.length === 0 ? (
                      <div className="text-center py-6 text-xs text-amber-300 font-semibold bg-[#0b2b48] rounded-xl border border-[#0066b3]">
                        No se encontraron productos registrados en la tabla 'productos_para_venta' para esta sede.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {[...listaProductosVenta]
                          .sort((a, b) => String(a.nombre || a.producto || '').localeCompare(String(b.nombre || b.producto || ''), 'es', { sensitivity: 'base' }))
                          .map((p) => {
                            const idProd = p.id;
                            const nombreProd = p.nombre || p.producto || `Producto #${idProd}`;
                            const precioActual = p.precio !== undefined && p.precio !== null ? p.precio : (p.precio_venta ?? 0);
                            const estadoActivo = p.activo !== false;
                            const estaEditado = preciosEditados[idProd] !== undefined;

                            return (
                              <div key={idProd} className="bg-[#0b2b48] p-2.5 rounded-xl border border-[#0066b3] space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-bold text-white block">{nombreProd}</span>
                                    <span className="text-[10px] text-sky-300 uppercase font-semibold">Cat: {p.categoria || 'General'}</span>
                                  </div>
                                  <button 
                                    onClick={() => toggleEstadoProducto(idProd, estadoActivo)} 
                                    className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase border cursor-pointer transition-colors ${
                                      estadoActivo 
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900' 
                                        : 'bg-rose-950 text-rose-300 border-rose-500/60 hover:bg-rose-900'
                                    }`}
                                  >
                                    {estadoActivo ? '✓ Activo' : '✕ Inactivo (False)'}
                                  </button>
                                </div>
                                <div className="flex gap-2 items-center bg-[#031d35] p-2 rounded-lg border border-[#0066b3]/50">
                                  <span className="text-[11px] text-sky-300 font-bold">Precio ($):</span>
                                  <input 
                                    type="number" 
                                    value={preciosEditados[idProd] !== undefined ? preciosEditados[idProd] : precioActual} 
                                    onChange={(e) => setPreciosEditados({ ...preciosEditados, [idProd]: Number(e.target.value) })} 
                                    className="w-28 bg-[#0b2b48] border border-[#00a4ef] text-emerald-300 font-black text-center rounded p-1 text-xs outline-none" 
                                  />
                                  {estaEditado && (
                                    <button onClick={() => guardarPrecioProducto(idProd)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded cursor-pointer">
                                      💾 Guardar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {subPestanaGestion === 'usuarios' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between items-center bg-[#0b2b48] p-2 rounded-xl border border-[#0066b3]">
                      <span className="text-xs font-bold text-sky-200 uppercase">Usuarios del Sistema</span>
                      <button onClick={() => setMostrarModalNuevoUsuario(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase cursor-pointer">➕ Crear Usuario</button>
                    </div>

                    {cargandoModulo10 ? (
                      <div className="text-center py-6 text-xs text-sky-200 font-bold">Cargando usuarios...</div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {[...listaUsuariosGestion]
                          .sort((a, b) => String(a.nombre_completo || '').localeCompare(String(b.nombre_completo || ''), 'es', { sensitivity: 'base' }))
                          .map((u) => {
                            const pinEditado = pinesEditados[u.id] !== undefined;
                            const estadoUsuarioActivo = u.activo !== false;

                            return (
                              <div key={u.id} className="bg-[#0b2b48] p-2.5 rounded-xl border border-[#0066b3] space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-bold text-white block">{u.nombre_completo}</span>
                                    <span className="text-[10px] text-sky-300">Rol: <b className="text-amber-300 uppercase">{u.tipo_usuario || 'operador'}</b></span>
                                  </div>
                                  <button 
                                    onClick={() => toggleEstadoUsuario(u.id, estadoUsuarioActivo)} 
                                    className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase border cursor-pointer transition-colors ${
                                      estadoUsuarioActivo 
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900' 
                                        : 'bg-rose-950 text-rose-300 border-rose-500/60 hover:bg-rose-900'
                                    }`}
                                  >
                                    {estadoUsuarioActivo ? '✓ Activo' : '✕ Inactivo (False)'}
                                  </button>
                                </div>

                                <div className="flex gap-2 items-center bg-[#031d35] p-2 rounded-lg border border-[#0066b3]/50">
                                  <span className="text-[11px] text-sky-300 font-bold">PIN / Clave:</span>
                                  <input 
                                    type="text" 
                                    value={pinesEditados[u.id] !== undefined ? pinesEditados[u.id] : u.codigo_acceso} 
                                    onChange={(e) => setPinesEditados({ ...pinesEditados, [u.id]: e.target.value })}
                                    className="w-24 bg-[#0b2b48] border border-[#00a4ef] text-emerald-300 font-black text-center rounded p-1 text-xs outline-none" 
                                  />
                                  {pinEditado && (
                                    <button onClick={() => guardarPinUsuario(u.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded cursor-pointer">
                                      🔑 Asignar Clave
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL CREAR USUARIO */}
      {mostrarModalNuevoUsuario && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-[#0b2b48] border-2 border-fuchsia-400 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2"><h3 className="text-xs font-black text-white uppercase">👤 Nuevo Usuario</h3><button onClick={() => setMostrarModalNuevoUsuario(false)} className="text-sky-300 font-bold">✕</button></div>
            <div className="space-y-3 text-xs">
              <div><label className="text-[11px] text-sky-200 font-bold block mb-1">Nombre Completo *:</label><input type="text" placeholder="Ej. Carlos Pérez" value={nuevoUsuarioNombre} onChange={(e) => setNuevoUsuarioNombre(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl outline-none" /></div>
              <div><label className="text-[11px] text-sky-200 font-bold block mb-1">Código / PIN *:</label><input type="text" placeholder="Ej. 1234" value={nuevoUsuarioCodigo} onChange={(e) => setNuevoUsuarioCodigo(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl outline-none" /></div>
              <div><label className="text-[11px] text-sky-200 font-bold block mb-1">Rol *:</label><select value={nuevoUsuarioRol} onChange={(e) => setNuevoUsuarioRol(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl outline-none uppercase font-bold"><option value="operador">Operador</option><option value="productor">Productor</option><option value="ingeniera">Ingeniera</option><option value="administrador">Administrador</option></select></div>
            </div>
            <div className="flex gap-2 pt-2"><button onClick={() => setMostrarModalNuevoUsuario(false)} className="w-1/2 bg-[#031d35] text-sky-200 font-bold py-2 rounded-xl text-xs uppercase border border-[#0066b3]">Cancelar</button><button onClick={crearUsuarioBD} className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs uppercase shadow">Guardar</button></div>
          </div>
        </div>
      )}

      {/* MODAL CREAR PRODUCTO */}
      {mostrarModalNuevoProdVenta && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-[#0b2b48] border-2 border-fuchsia-400 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#0066b3] pb-2">
              <h3 className="text-xs font-black text-white uppercase">➕ Crear Producto</h3>
              <button onClick={() => setMostrarModalNuevoProdVenta(false)} className="text-sky-300 font-bold">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-sky-200 font-bold block mb-1">Nombre *:</label>
                <input type="text" placeholder="Ej. Malteada de Fresa" value={nuevoProdVentaNombre} onChange={(e) => setNuevoProdVentaNombre(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-sky-200 font-bold block mb-1">Precio ($) *:</label>
                <input type="number" placeholder="12000" value={nuevoProdVentaPrecio} onChange={(e) => setNuevoProdVentaPrecio(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl outline-none font-bold text-emerald-300" />
              </div>
              <div>
                <label className="text-[11px] text-sky-200 font-bold block mb-1">Categoría:</label>
                <input type="text" placeholder="Ej. paletas..." value={nuevoProdVentaCategoria} onChange={(e) => setNuevoProdVentaCategoria(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl outline-none" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setMostrarModalNuevoProdVenta(false)} className="w-1/2 bg-[#031d35] text-sky-200 font-bold py-2 rounded-xl text-xs uppercase border border-[#0066b3]">Cancelar</button>
              <button onClick={crearProductoVentaBD} className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs uppercase shadow">Guardar</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}