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
  const [sedeSeleccionada, setSedeSeleccionada] = useState<string>('todos');

  // Estados de Navegación y Acordeones
  const [acordeonAperturaAbierto, setAcordeonAperturaAbierto] = useState<boolean>(true);
  const [moduloAbierto, setModuloAbierto] = useState<string | null>('gestion_sistema');
  const [subPestanaLogistica, setSubPestanaLogistica] = useState<'compras' | 'despachos'>('compras');

  // Datos BD
  const [resumenNominaOperarios, setResumenNominaOperarios] = useState<any[]>([]);
  const [sedesBD, setSedesBD] = useState<any[]>([]);
  const [mapaSedes, setMapaSedes] = useState<{ [id: number]: string }>({});
  const [usuariosBD, setUsuariosBD] = useState<{ [id: number]: string }>({});
  const [listaUsuariosGestion, setListaUsuariosGestion] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pedidos30Dias, setPedidos30Dias] = useState<any[]>([]);
  const [pedidosPendientesGlobal, setPedidosPendientesGlobal] = useState<any[]>([]);
  const [productosBD, setProductosBD] = useState<any[]>([]);
  const [registrosCaja, setRegistrosCaja] = useState<any[]>([]);
  const [registrosNomina, setRegistrosNomina] = useState<any[]>([]);
  const [inventarioMovimientos, setInventarioMovimientos] = useState<any[]>([]);
  const [inventarioMovsDia, setInventarioMovsDia] = useState<any[]>([]);
  const [inventarioEmpaquesSedesBD, setInventarioEmpaquesSedesBD] = useState<any[]>([]);
  const [empaquesMartinetoBD, setEmpaquesMartinetoBD] = useState<any[]>([]);
  const [empaquesOsitosBD, setEmpaquesOsitosBD] = useState<any[]>([]);
  const [historicoVentasBD, setHistoricoVentasBD] = useState<any[]>([]);
  const [historicoVentas30DiasBD, setHistoricoVentas30DiasBD] = useState<any[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [editandoProveedor, setEditandoProveedor] = useState<{ [nombre: string]: string }>({});

  const [itemsChequeados, setItemsChequeados] = useState<{ [key: string]: boolean }>({});

  // Estados Módulo 10
  const [subPestanaGestion, setSubPestanaGestion] = useState<'usuarios' | 'productos_venta'>('productos_venta');
  const [tablaProductoSeleccionada, setTablaProductoSeleccionada] = useState<'produc_ven_martineto' | 'produc_ven_ositos'>('produc_ven_martineto');
  const [listaProductosVenta, setListaProductosVenta] = useState<any[]>([]);
  
  const [mostrarModalNuevoUsuario, setMostrarModalNuevoUsuario] = useState(false);
  const [nuevoUsuarioNombre, setNuevoUsuarioNombre] = useState('');
  const [nuevoUsuarioCodigo, setNuevoUsuarioCodigo] = useState('');
  const [nuevoUsuarioRol, setNuevoUsuarioRol] = useState('operador');

  const [mostrarModalNuevoProdVenta, setMostrarModalNuevoProdVenta] = useState(false);
  const [nuevoProdVentaNombre, setNuevoProdVentaNombre] = useState('');
  const [nuevoProdVentaPrecio, setNuevoProdVentaPrecio] = useState<number | ''>('');
  const [nuevoProdVentaCategoria, setNuevoProdVentaCategoria] = useState('');
  const [nuevoProdEsInventario, setNuevoProdEsInventario] = useState(false);

  const [preciosEditados, setPreciosEditados] = useState<{ [id: number]: number }>({});

  useEffect(() => {
    cargarDatosAdmin();
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    if (moduloAbierto === 'gestion_sistema') {
      cargarProductosVentaBD(tablaProductoSeleccionada);
    }
  }, [moduloAbierto, tablaProductoSeleccionada]);

  async function cargarProductosVentaBD(tabla: 'produc_ven_martineto' | 'produc_ven_ositos') {
    const { data, error } = await supabase.from(tabla).select('*').order('nombre', { ascending: true });
    if (!error && data) {
      setListaProductosVenta(data);
    }
  }

  async function cargarDatosAdmin() {
    setCargando(true);
    try {
      const { data: sedesData } = await supabase.from('sede').select('id, nombre').order('nombre', { ascending: true });
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

      const { data: usuariosData } = await supabase.from('usuario').select('*').order('nombre_completo', { ascending: true });
      const mapaU: { [id: number]: string } = {};
      if (usuariosData) {
        setListaUsuariosGestion(usuariosData);
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

      const { data: prodData } = await supabase.from('producto').select('id, nombre, donde_comprar, categoria').order('nombre', { ascending: true });

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

      const resumenNominaSorted = Object.values(acumulado).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      setResumenNominaOperarios(resumenNominaSorted);

      const { data: diffDataRaw } = await supabase.from('diferencia_inventario').select('*');
      const diffDataFiltrado = (diffDataRaw || []).filter(row => {
        if (!row.fecha_registro) return false;
        const fRow = obtenerFechaLocalStr(row.fecha_registro);
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

      const { data: invDiarioRaw } = await supabase.from('inventario_diario').select('*');
      setInventarioMovsDia(invDiarioRaw || []);

      const { data: empaquesSedesData } = await supabase.from('inventario_empaques_sedes').select('*');
      const { data: empaquesMartinetoData } = await supabase.from('empaques_martineto').select('*');
      const { data: empaquesOsitosData } = await supabase.from('empaques_ositos').select('*');

      setPedidos(pedidosData);
      setPedidos30Dias(pedidos30DiasFiltrado);
      setProductosBD(prodData || []);
      setRegistrosCaja(registrosCajaFinales);
      setRegistrosNomina(nominaData);
      setInventarioMovimientos(diffDataFiltrado);
      setInventarioEmpaquesSedesBD(empaquesSedesData || []);
      setEmpaquesMartinetoBD(empaquesMartinetoData || []);
      setEmpaquesOsitosBD(empaquesOsitosData || []);
      setHistoricoVentasBD(historicoVentasFiltrado);
      setHistoricoVentas30DiasBD(historicoVentas30DiasFiltrado);
      setItemsChequeados({});
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setCargando(false);
    }
  }

  // ACCIONES MÓDULO 10
  async function crearUsuarioBD() {
    if (!nuevoUsuarioNombre.trim() || !nuevoUsuarioCodigo.trim()) {
      alert('⚠️ Ingresa el nombre completo y el código/PIN de acceso.');
      return;
    }
    const { error } = await supabase.from('usuario').insert([{
      nombre_completo: nuevoUsuarioNombre.trim(),
      codigo_acceso: nuevoUsuarioCodigo.trim(),
      tipo_usuario: nuevoUsuarioRol,
      activo: true
    }]);
    if (error) { alert('❌ Error al crear usuario: ' + error.message); return; }
    alert(`✅ Usuario "${nuevoUsuarioNombre}" creado con éxito.`);
    setNuevoUsuarioNombre(''); setNuevoUsuarioCodigo(''); setNuevoUsuarioRol('operador');
    setMostrarModalNuevoUsuario(false);
    cargarDatosAdmin();
  }

  async function toggleEstadoUsuario(idUsuario: number, estadoActual: boolean) {
    const { error } = await supabase.from('usuario').update({ activo: !estadoActual }).eq('id', idUsuario);
    if (!error) cargarDatosAdmin();
    else alert('Error cambiando estado: ' + error.message);
  }

  async function crearProductoVentaBD() {
    const nombreLimpio = nuevoProdVentaNombre.trim();
    if (!nombreLimpio || !nuevoProdVentaPrecio || Number(nuevoProdVentaPrecio) <= 0) {
      alert('⚠️ Completa el nombre y un precio válido.');
      return;
    }

    // 1. Guardar en la tabla de productos de venta
    const { error: errVenta } = await supabase.from(tablaProductoSeleccionada).insert([{
      nombre: nombreLimpio,
      precio: Number(nuevoProdVentaPrecio),
      categoria: nuevoProdVentaCategoria.trim() || 'general',
      activo: true
    }]);

    if (errVenta) {
      alert('❌ Error al crear producto de venta: ' + errVenta.message);
      return;
    }

    // 2. Si se marcó como producto de inventario, guardarlo en la tabla de empaques correspondiente con stock 0
    if (nuevoProdEsInventario) {
      const tablaEmpaques = tablaProductoSeleccionada === 'produc_ven_martineto' 
        ? 'empaques_martineto' 
        : 'empaques_ositos';

      const { error: errEmpaque } = await supabase.from(tablaEmpaques).insert([{
        nombre: nombreLimpio,
        stock: 0,
        activo: true
      }]);

      if (errEmpaque) {
        alert(`⚠️ El producto se creó en ventas, pero hubo un error agregándolo a ${tablaEmpaques}: ` + errEmpaque.message);
      }
    }

    alert(`✅ Producto "${nombreLimpio}" agregado correctamente.`);
    setNuevoProdVentaNombre(''); 
    setNuevoProdVentaPrecio(''); 
    setNuevoProdVentaCategoria('');
    setNuevoProdEsInventario(false);
    setMostrarModalNuevoProdVenta(false);
    cargarProductosVentaBD(tablaProductoSeleccionada);
    cargarDatosAdmin();
  }

  async function guardarPrecioProducto(idProd: number) {
    const nuevoPrecio = preciosEditados[idProd];
    if (nuevoPrecio === undefined || isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      alert('Ingresa un monto válido.');
      return;
    }
    const { error } = await supabase.from(tablaProductoSeleccionada).update({ precio: nuevoPrecio }).eq('id', idProd);
    if (error) { alert('Error actualizando precio: ' + error.message); return; }
    alert('✅ Precio actualizado correctamente.');
    setPreciosEditados(prev => { const copia = { ...prev }; delete copia[idProd]; return copia; });
    cargarProductosVentaBD(tablaProductoSeleccionada);
  }

  async function toggleEstadoProducto(idProd: number, estadoActual: boolean) {
    const { error } = await supabase.from(tablaProductoSeleccionada).update({ activo: !estadoActual }).eq('id', idProd);
    if (!error) cargarProductosVentaBD(tablaProductoSeleccionada);
    else alert('Error actualizando estado: ' + error.message);
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
    if (!hayItemsSeleccionados) { alert('⚠️ Por favor marca al menos un producto.'); return; }
    await supabase.from('pedidos_insumos').update({ estado: 'comprado' }).in('id', Array.from(idsParaMarcarSet));
    cargarDatosAdmin();
  }

  async function marcarPedidosComoEntregados(idsPedidos: number[]) {
    if (!confirm('¿Deseas marcar el pedido como ENTREGADO?')) return;
    await supabase.from('pedidos_insumos').update({ estado: 'entregado' }).in('id', idsPedidos);
    cargarDatosAdmin();
  }

  const getNombreSede = (id: number) => mapaSedes[id] || `Sede ${id}`;
  const getNombreUsuario = (id: number) => usuariosBD[id] || `Empleado #${id}`;

  const toggleModulo = (id: string) => { setModuloAbierto(prev => prev === id ? null : id); };

  // CÁLCULOS
  const controlAperturaSedes = (() => {
    const lista = sedesBD.map(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);
      const registrosCajaSede = registrosCaja
        .filter(c => Number(c.sede_id) === idSede)
        .sort((a, b) => new Date(b.created_at || b.fecha || 0).getTime() - new Date(a.created_at || a.fecha || 0).getTime());

      const regCajaActual = registrosCajaSede[0];
      const regInvApertura = inventarioMovsDia.find(m => Number(m.sede_id) === idSede && String(m.tipo_movimiento || '').toLowerCase().trim() === 'apertura' && obtenerFechaLocalStr(m.fecha_registro) === fechaInicio);

      const estaAbierta = regCajaActual ? (regCajaActual.estado === 'abierta' || regCajaActual.tipo === 'apertura') : false;
      const estadoCaja = regCajaActual ? (estaAbierta ? '🟢 Abierta' : '🔒 Cerrada') : (regInvApertura ? '🟢 Abierta' : '🔒 Pendiente');
      const timestampRaw = regCajaActual?.created_at || regCajaActual?.fecha || regInvApertura?.fecha_registro;
      const horaApertura = timestampRaw ? obtenerHoraLocalStr(timestampRaw) : '--:--';
      const paletasContadas = regInvApertura?.total_paletas !== undefined && regInvApertura?.total_paletas !== null ? `✅ ${regInvApertura.total_paletas} unids` : '⚠️ Pendiente';
      const insumosContados = (regInvApertura?.detalle_empaques && Object.keys(regInvApertura.detalle_empaques).length > 0) ? '✅ Registrados' : '⚠️ Pendiente';
      const idUsuarioOp = regCajaActual?.usuario_id || regInvApertura?.usuario_id;
      const operario = idUsuarioOp ? getNombreUsuario(idUsuarioOp) : (regCajaActual?.operario_nombre || '--');

      return { idSede, nombreSede, horaApertura, estadoCaja, paletasContadas, insumosContados, operario };
    });
    return lista.sort((a, b) => a.nombreSede.localeCompare(b.nombreSede, 'es', { sensitivity: 'base' }));
  })();

  const pedidosPendientesCompra = pedidos.filter(p => p.estado === 'pendiente');
  const pedidosListosParaEntrega = pedidos.filter(p => p.estado === 'comprado');

  const consolidadoCompras = (() => {
    const mapaProveedores: { [prov: string]: { items: any; idsPedidosSet: Set<number> } } = {};
    pedidosPendientesCompra.forEach(p => {
      if (sedeSeleccionada !== 'todos' && String(p.sede_id) !== sedeSeleccionada) return;
      if (!mapaSedes[p.sede_id]) return;

      const jsonItems = { ...(p.pedidos_paletas || {}), ...(p.pedidos_richi || {}), ...(p.pedidos_produccion || {}), ...(p.pedidos_insumos || {}), ...(p.pedidos_aseo || {}) };
      Object.entries(jsonItems).forEach(([nombreProd, cantidad]) => {
        const cantNum = Number(cantidad) || 0;
        if (cantNum <= 0) return;
        const prodEnBD = productosBD.find(item => String(item.nombre).trim().toLowerCase() === String(nombreProd).trim().toLowerCase());
        const prov = prodEnBD?.donde_comprar && prodEnBD.donde_comprar.trim() !== '' ? prodEnBD.donde_comprar : '⚠️ Faltan datos de dónde comprar';

        if (!mapaProveedores[prov]) mapaProveedores[prov] = { items: {}, idsPedidosSet: new Set() };
        mapaProveedores[prov].idsPedidosSet.add(p.id);

        if (!mapaProveedores[prov].items[nombreProd]) mapaProveedores[prov].items[nombreProd] = { cantidad: 0, idProd: prodEnBD?.id, idsPedidos: [] };
        mapaProveedores[prov].items[nombreProd].cantidad += cantNum;
        if (!mapaProveedores[prov].items[nombreProd].idsPedidos.includes(p.id)) mapaProveedores[prov].items[nombreProd].idsPedidos.push(p.id);
      });
    });
    return mapaProveedores;
  })();

  const despachosPorSede = (() => {
    const mapaSedesObj: { [sede: string]: { productos: any; idsPedidos: number[] } } = {};
    pedidosListosParaEntrega.forEach(p => {
      if (!mapaSedes[p.sede_id]) return;
      const nombreSede = getNombreSede(p.sede_id);
      if (sedeSeleccionada !== 'todos' && String(p.sede_id) !== sedeSeleccionada) return;
      if (!mapaSedesObj[nombreSede]) mapaSedesObj[nombreSede] = { productos: {}, idsPedidos: [] };
      if (!mapaSedesObj[nombreSede].idsPedidos.includes(p.id)) mapaSedesObj[nombreSede].idsPedidos.push(p.id);
      const jsonItems = { ...(p.pedidos_paletas || {}), ...(p.pedidos_richi || {}), ...(p.pedidos_produccion || {}), ...(p.pedidos_insumos || {}), ...(p.pedidos_aseo || {}) };
      Object.entries(jsonItems).forEach(([k, v]) => {
        const cant = Number(v) || 0;
        if (cant > 0) mapaSedesObj[nombreSede].productos[k] = (mapaSedesObj[nombreSede].productos[k] || 0) + cant;
      });
    });
    return mapaSedesObj;
  })();

  const CierreGlobal = (() => {
    const totalCaja = registrosCaja.reduce((acc, row) => {
      if (!mapaSedes[row.sede_id]) return acc;
      const efec = Number(row.efectivo_recibido !== undefined && row.efectivo_recibido !== null ? row.efectivo_recibido : (row.efectivo_cierre !== undefined && row.efectivo_cierre !== null ? row.efectivo_cierre : row.efectivo)) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      const rap = Number(row.rappi) || 0;
      const gas = Number(row.monto_gasto) || 0;
      return { efectivo: acc.efectivo + efec, nequi: acc.nequi + neq, daviplata: acc.daviplata + dav, rappi: acc.rappi + rap, gastos: acc.gastos + gas };
    }, { efectivo: 0, nequi: 0, daviplata: 0, rappi: 0, gastos: 0 });

    const totalNominaBD = registrosNomina.reduce((acc, n) => {
      if (!mapaSedes[n.sede_id]) return acc;
      return acc + (Number(n.monto) || 0);
    }, 0);

    return { ...totalCaja, nomina: totalNominaBD, totalVenta: totalCaja.efectivo + totalCaja.nequi + totalCaja.daviplata + totalCaja.rappi + totalCaja.gastos + totalNominaBD };
  })();

  const proyeccionDemandaTodasSedes = (() => {
    const resultadoPorSede: { [nombreSede: string]: { sugeridos: { [prod: string]: { sugerido: number; teorico: number; stock: number; enCamino: number } }; numDias: number; origenDatos: string } } = {};
    sedesBD.forEach(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);
      if (sedeSeleccionada !== 'todos' && String(idSede) !== sedeSeleccionada) return;

      const acumuladoProds: { [prod: string]: number } = {};
      const diasConDatos = new Set<string>();

      historicoVentas30DiasBD.filter(r => Number(r.sede_id) === idSede).forEach(row => {
        const fStr = obtenerFechaLocalStr(row.fecha);
        if (fStr) diasConDatos.add(fStr);
        Object.entries(row.productos || {}).forEach(([p, c]) => {
          const cant = Number(c) || 0;
          if (cant > 0) acumuladoProds[p] = (acumuladoProds[p] || 0) + cant;
        });
      });

      pedidos30Dias.filter(p => Number(p.sede_id) === idSede).forEach(p => {
        const fStr = obtenerFechaLocalStr(p.fecha);
        if (fStr) diasConDatos.add(fStr);
        const jsonItems = { ...(p.pedidos_paletas || {}), ...(p.pedidos_richi || {}), ...(p.pedidos_produccion || {}), ...(p.pedidos_insumos || {}), ...(p.pedidos_aseo || {}) };
        Object.entries(jsonItems).forEach(([item, c]) => {
          const cant = Number(c) || 0;
          if (cant > 0) acumuladoProds[item] = (acumuladoProds[item] || 0) + cant;
        });
      });

      const stockActualSede: { [prod: string]: number } = {};
      const nombreSedeLower = nombreSede.toLowerCase();
      if (nombreSedeLower.includes('martineto')) {
        empaquesMartinetoBD.forEach(e => {
          const pNombre = String(e.nombre || e.producto || '').trim();
          if (pNombre) stockActualSede[pNombre] = Number(e.stok ?? e.stock ?? 0);
        });
      } else if (nombreSedeLower.includes('ositos')) {
        empaquesOsitosBD.forEach(e => {
          const pNombre = String(e.nombre || e.producto || '').trim();
          if (pNombre) stockActualSede[pNombre] = Number(e.stok ?? e.stock ?? 0);
        });
      } else {
        inventarioEmpaquesSedesBD.filter(e => Number(e.sede_id) === idSede).forEach(e => {
          const pNombre = String(e.nombre || e.producto || '').trim();
          if (pNombre && pNombre.toLowerCase() !== 'total paletas') stockActualSede[pNombre] = Number(e.stok ?? e.stock ?? 0);
        });
      }

      const pedidosEnCaminoSede: { [prod: string]: number } = {};
      pedidosPendientesGlobal.filter(p => Number(p.sede_id) === idSede).forEach(p => {
        const jsonItems = { ...(p.pedidos_paletas || {}), ...(p.pedidos_richi || {}), ...(p.pedidos_produccion || {}), ...(p.pedidos_insumos || {}), ...(p.pedidos_aseo || {}) };
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
        sugeridos[prod] = { sugerido: Math.max(demandaTeorica - stockActual - enCamino, 0), teorico: demandaTeorica, stock: stockActual, enCamino };
      });

      resultadoPorSede[nombreSede] = { sugeridos, numDias, origenDatos: 'Ventas e historial de pedidos (30 días)' };
    });
    return resultadoPorSede;
  })();

  const inventarioStockGeneralPorSede = (() => {
    const mapa: { [sedeName: string]: { totalPaletas: number; detallePaletas: { [k: string]: number }; detalleEmpaques: { [k: string]: number } } } = {};
    sedesBD.forEach(s => {
      const idSede = s.id;
      const nombreSede = getNombreSede(idSede);
      if (sedeSeleccionada !== 'todos' && String(idSede) !== sedeSeleccionada) return;

      const esViva = nombreSede.toLowerCase().includes('viva');
      const movimientosSede = inventarioMovsDia.filter(m => Number(m.sede_id) === idSede).sort((a, b) => new Date(b.fecha_registro || 0).getTime() - new Date(a.fecha_registro || 0).getTime());

      let totalPaletasBD = 0;
      if (esViva) {
        const regP = inventarioEmpaquesSedesBD.find(item => Number(item.sede_id) === idSede && String(item.nombre || item.producto || '').toLowerCase() === 'total paletas');
        totalPaletasBD = regP ? Number(regP.stok ?? regP.stock ?? 0) : (movimientosSede.find(m => m.total_paletas !== undefined)?.total_paletas || 0);
      } else {
        const ultM = movimientosSede.find(m => m.total_paletas !== undefined && m.total_paletas !== null);
        totalPaletasBD = ultM ? Number(ultM.total_paletas || 0) : 0;
      }

      const detalleEmpaques: { [k: string]: number } = {};
      const nombreSedeLower = nombreSede.toLowerCase();
      if (nombreSedeLower.includes('martineto')) {
        empaquesMartinetoBD.forEach(item => {
          const name = String(item.nombre || item.producto || '').trim();
          if (name && name.toLowerCase() !== 'total paletas') detalleEmpaques[name] = Number(item.stok ?? item.stock ?? 0);
        });
      } else if (nombreSedeLower.includes('ositos')) {
        empaquesOsitosBD.forEach(item => {
          const name = String(item.nombre || item.producto || '').trim();
          if (name && name.toLowerCase() !== 'total paletas') detalleEmpaques[name] = Number(item.stok ?? item.stock ?? 0);
        });
      } else {
        inventarioEmpaquesSedesBD.filter(item => Number(item.sede_id) === idSede).forEach(item => {
          const name = String(item.nombre || item.producto || '').trim();
          if (name && name.toLowerCase() !== 'total paletas') detalleEmpaques[name] = Number(item.stok ?? item.stock ?? 0);
        });
      }

      mapa[nombreSede] = { totalPaletas: totalPaletasBD, detallePaletas: {}, detalleEmpaques };
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
      if (!mapa[nombreSede]) mapa[nombreSede] = {};

      Object.entries(row.productos || {}).forEach(([prod, cant]) => {
        const cNum = Number(cant) || 0;
        if (cNum > 0) mapa[nombreSede][prod] = (mapa[nombreSede][prod] || 0) + cNum;
      });
    });
    return mapa;
  })();

  const datosBI = (() => {
    const totalProductos: { [prod: string]: number } = {};
    const ventasPorFecha: { [fecha: string]: number } = {};

    historicoVentasBD.forEach(row => {
      const fStr = obtenerFechaLocalStr(row.fecha);
      let totalFila = 0;
      Object.entries(row.productos || {}).forEach(([prod, cant]) => {
        const c = Number(cant) || 0;
        if (c > 0) { totalProductos[prod] = (totalProductos[prod] || 0) + c; totalFila += c; }
      });
      if (fStr) ventasPorFecha[fStr] = (ventasPorFecha[fStr] || 0) + totalFila;
    });

    const productosArray = Object.entries(totalProductos).sort((a, b) => b[1] - a[1]);
    const masVendido = productosArray.length > 0 ? productosArray[0] : ['N/A', 0];
    const menosVendido = productosArray.length > 0 ? productosArray[productosArray.length - 1] : ['N/A', 0];

    return { masVendido, menosVendido };
  })();

  const rappiYDescuentosData = (() => {
    let totalRappiGlobal = 0;
    let totalDescuentosGlobal = 0;
    registrosCaja.forEach(row => {
      if (!mapaSedes[row.sede_id]) return;
      if (sedeSeleccionada !== 'todos' && String(row.sede_id) !== sedeSeleccionada) return;
      totalRappiGlobal += Number(row.rappi) || 0;
      totalDescuentosGlobal += Number(row.descuento) || 0;
    });
    return { totalRappiGlobal, totalDescuentosGlobal };
  })();

  const comparativoMetodosPago = (() => {
    let efectivoTotal = 0, nequiTotal = 0, daviplataTotal = 0, totalGeneralPagos = 0;
    registrosCaja.forEach(row => {
      if (!mapaSedes[row.sede_id]) return;
      if (sedeSeleccionada !== 'todos' && String(row.sede_id) !== sedeSeleccionada) return;

      const efec = Number(row.efectivo_recibido ?? row.efectivo_cierre ?? row.efectivo) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      efectivoTotal += efec; nequiTotal += neq; daviplataTotal += dav;
      totalGeneralPagos += (efec + neq + dav);
    });
    return { efectivoTotal, nequiTotal, daviplataTotal, totalGeneralPagos };
  })();

  return (
    <main className="min-h-screen bg-[#004e8c] text-white p-3 font-sans max-w-md mx-auto space-y-4 pb-20">
      
      <header className="bg-[#0b2b48] border border-[#0066b3] p-4 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-sm font-black text-white">🛡️ ADMIN CENTRAL</h1>
          <p className="text-[10px] text-sky-200">Panel de Control General</p>
        </div>
        <button onClick={() => router.back()} className="bg-[#031d35] hover:bg-[#003d6d] px-3 py-1.5 rounded-xl text-xs font-bold border border-[#0066b3] cursor-pointer">Volver</button>
      </header>

      {/* Selector de Sede */}
      <div className="bg-[#0b2b48] border border-[#0066b3] p-3 rounded-2xl shadow-md space-y-2">
        <label className="text-[10px] font-extrabold text-sky-300 uppercase block">🏢 Sede a Consultar:</label>
        <select
          value={sedeSeleccionada}
          onChange={(e) => setSedeSeleccionada(e.target.value)}
          className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl text-xs outline-none uppercase font-bold"
        >
          <option value="todos">🌐 Todas las Sedes (Global)</option>
          {[...sedesBD]
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
            .map((s) => (
              <option key={s.id} value={String(s.id)}>📍 {s.nombre}</option>
            ))}
        </select>
      </div>

      {/* Control Aperturas */}
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

      {/* Rango de Fechas */}
      <div className="bg-[#0b2b48] border border-[#0066b3] p-3 rounded-2xl shadow-md space-y-2">
        <label className="text-[10px] font-extrabold text-sky-300 uppercase block">📅 Rango de Fechas de Consulta:</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[9px] text-sky-300 font-bold block mb-1">Desde (Inicio):</span>
            <input type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setFechaFin(e.target.value); }} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl text-xs outline-none" />
          </div>
          <div>
            <span className="text-[9px] text-sky-300 font-bold block mb-1">Hasta (Final):</span>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full bg-[#031d35] border border-[#0066b3] text-white p-2 rounded-xl text-xs outline-none" />
          </div>
        </div>
      </div>

      {cargando ? <div className="text-center py-10 text-xs font-bold text-sky-200">Cargando datos...</div> : (
        <div className="space-y-3">

          {/* MÓDULO 1: LOGÍSTICA Y PEDIDOS */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('logistica')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-amber-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'logistica' ? '▼' : '▶'}</span> 🚚 1. LOGÍSTICA Y PEDIDOS</span>
              <span className="bg-amber-950 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-500/40">{pedidosPendientesCompra.length} Compras | {pedidosListosParaEntrega.length} Despachos</span>
            </button>
            {moduloAbierto === 'logistica' && (
              <div className="p-3 pt-0 space-y-3 border-t border-[#0066b3]/50 bg-[#031d35]/60">
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button onClick={() => setSubPestanaLogistica('compras')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaLogistica === 'compras' ? 'bg-[#0078d4] border-sky-300 text-white' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}>🛒 Consolidado Compras ({Object.keys(consolidadoCompras).length})</button>
                  <button onClick={() => setSubPestanaLogistica('despachos')} className={`py-2 rounded-xl font-extrabold text-[11px] uppercase border ${subPestanaLogistica === 'despachos' ? 'bg-[#0078d4] border-sky-300 text-white' : 'bg-[#0b2b48] border-[#0066b3] text-sky-300'}`}>🚚 Despachos Sede ({Object.keys(despachosPorSede).length})</button>
                </div>
                {subPestanaLogistica === 'compras' && (
                  <div className="space-y-3 pt-2">
                    {Object.entries(consolidadoCompras)
                      .sort(([provA], [provB]) => provA.localeCompare(provB, 'es', { sensitivity: 'base' }))
                      .map(([prov, datosProv]) => (
                        <div key={prov} className="bg-[#0b2b48] p-3 rounded-xl border border-[#0066b3] space-y-2">
                          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-1">
                            <span className="text-xs font-bold text-amber-300 uppercase">🏢 {prov}</span>
                            <button onClick={() => marcarSeleccionadosComoComprados(prov, datosProv.items)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2 py-1 rounded-lg uppercase">✓ Marcar Comprados</button>
                          </div>
                          <ul className="space-y-1 text-xs">
                            {Object.entries(datosProv.items)
                              .sort(([prodA], [prodB]) => prodA.localeCompare(prodB, 'es', { sensitivity: 'base' }))
                              .map(([nombreProd, det]: [string, any]) => {
                                const keyCheck = `${fechaInicio}_${prov}_${nombreProd}`;
                                const isChecked = itemsChequeados[keyCheck];
                                return (
                                  <li key={nombreProd} className="flex justify-between items-center py-0.5 border-b border-[#0066b3]/20">
                                    <span className={`font-medium ${isChecked ? 'line-through text-slate-400' : 'text-white'}`}>{nombreProd}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-amber-300 bg-[#031d35] px-2 py-0.5 rounded border border-[#0066b3]">{det.cantidad}</span>
                                      <input type="checkbox" checked={!!isChecked} onChange={() => toggleChecklistLocal(prov, nombreProd)} className="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      ))}
                  </div>
                )}
                {subPestanaLogistica === 'despachos' && (
                  <div className="space-y-3 pt-2">
                    {Object.entries(despachosPorSede)
                      .sort(([sedeA], [sedeB]) => sedeA.localeCompare(sedeB, 'es', { sensitivity: 'base' }))
                      .map(([nombreSede, datosSede]) => (
                        <div key={nombreSede} className="bg-[#0b2b48] p-3 rounded-xl border border-[#0066b3] space-y-2">
                          <div className="flex justify-between items-center border-b border-[#0066b3]/50 pb-1">
                            <span className="text-xs font-bold text-sky-300 uppercase">📍 {nombreSede}</span>
                            <button onClick={() => marcarPedidosComoEntregados(datosSede.idsPedidos)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2 py-1 rounded-lg uppercase">✓ Marcar Entregado</button>
                          </div>
                          <ul className="space-y-1 text-xs">
                            {Object.entries(datosSede.productos)
                              .sort(([prodA], [prodB]) => prodA.localeCompare(prodB, 'es', { sensitivity: 'base' }))
                              .map(([nombreProd, cant]: [string, any]) => (
                                <li key={nombreProd} className="flex justify-between items-center py-0.5"><span className="text-white font-medium">{nombreProd}</span><span className="font-black text-emerald-300">{cant}</span></li>
                              ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MÓDULO 2: CIERRES Y VENTA TOTAL */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('cierres')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'cierres' ? '▼' : '▶'}</span> 💰 2. CIERRES Y VENTA TOTAL</span>
              <span className="bg-emerald-950 text-emerald-300 font-black text-[11px] px-2 py-0.5 rounded border border-emerald-500/40">${CierreGlobal.totalVenta.toLocaleString('es-CO')}</span>
            </button>
            {moduloAbierto === 'cierres' && (
              <div className="p-3 pt-2 space-y-3 border-t border-[#0066b3]/50 bg-[#031d35]/60">
                <div className="bg-[#0b2b48] p-3 rounded-xl border border-emerald-500/50 space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-white py-0.5"><span>💵 Efectivo en Cajas:</span><span className="text-emerald-300">${CierreGlobal.efectivo.toLocaleString('es-CO')}</span></div>
                  <div className="flex justify-between font-bold text-white py-0.5"><span>📲 Nequi Total:</span><span className="text-emerald-300">${CierreGlobal.nequi.toLocaleString('es-CO')}</span></div>
                  <div className="flex justify-between font-bold text-white py-0.5"><span>📲 Daviplata Total:</span><span className="text-emerald-300">${CierreGlobal.daviplata.toLocaleString('es-CO')}</span></div>
                  <div className="flex justify-between font-bold text-white py-0.5"><span>🛵 Rappi Total:</span><span className="text-emerald-300">${CierreGlobal.rappi.toLocaleString('es-CO')}</span></div>
                  <div className="flex justify-between font-bold text-rose-300 py-0.5 border-t border-[#0066b3]/30 pt-1"><span>🧾 Gastos Registrados:</span><span>${CierreGlobal.gastos.toLocaleString('es-CO')}</span></div>
                  <div className="flex justify-between font-bold text-amber-300 py-0.5"><span>👥 Nómina Pagada:</span><span>${CierreGlobal.nomina.toLocaleString('es-CO')}</span></div>
                  <div className="flex justify-between font-black text-sky-200 text-sm border-t border-emerald-500/50 pt-2 mt-1"><span>🔥 VENTA GLOBAL CONSOLIDADA:</span><span className="text-emerald-400">${CierreGlobal.totalVenta.toLocaleString('es-CO')}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* MÓDULO 3: RESUMEN NÓMINA */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('nomina')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-sky-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'nomina' ? '▼' : '▶'}</span> 👥 3. RESUMEN NÓMINA</span>
              <span className="bg-sky-950 text-sky-300 font-bold text-[10px] px-2 py-0.5 rounded border border-sky-500/40">{resumenNominaOperarios.length} Empleados</span>
            </button>
            {moduloAbierto === 'nomina' && (
              <div className="p-3 pt-2 space-y-2 border-t border-[#0066b3]/50 bg-[#031d35]/60 text-xs">
                {resumenNominaOperarios.map((op, idx) => (
                  <div key={idx} className="bg-[#0b2b48] p-2.5 rounded-xl border border-[#0066b3] flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white block">{op.nombre}</span>
                      <span className="text-[10px] text-sky-300">Turnos: {op.turnosCount} | Horas D: {op.horasDia} | Noche: {op.horasNoche}</span>
                    </div>
                    <span className="font-black text-amber-300 text-sm">${op.totalPagado.toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MÓDULO 4: INVENTARIOS Y STOCK GENERAL */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('inventarios')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-sky-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'inventarios' ? '▼' : '▶'}</span> 📦 4. INVENTARIOS Y STOCK GENERAL</span>
              <span className="bg-sky-950 text-sky-300 font-bold text-[10px] px-2 py-0.5 rounded border border-sky-500/40">{Object.keys(inventarioStockGeneralPorSede).length} Sedes</span>
            </button>
            {moduloAbierto === 'inventarios' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                {Object.entries(inventarioStockGeneralPorSede)
                  .sort(([sedeA], [sedeB]) => sedeA.localeCompare(sedeB, 'es', { sensitivity: 'base' }))
                  .map(([nombreSede, infoSede]) => (
                    <div key={nombreSede} className="bg-[#0b2b48] p-3 rounded-xl border border-[#0066b3] space-y-2">
                      <div className="flex justify-between items-center border-b border-[#0066b3]/40 pb-1">
                        <span className="font-bold text-white uppercase">📍 {nombreSede}</span>
                        <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-500 font-black">Total Paletas: {infoSede.totalPaletas}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-amber-300 uppercase block">📦 Stock Empaques:</span>
                        {Object.entries(infoSede.detalleEmpaques)
                          .sort(([prodA], [prodB]) => prodA.localeCompare(prodB, 'es', { sensitivity: 'base' }))
                          .map(([prod, cant], idx) => (
                            <div key={idx} className="flex justify-between text-[11px] text-white border-b border-[#0066b3]/20 py-0.5">
                              <span>{prod}</span>
                              <span className={`font-bold ${Number(cant) < 0 ? 'text-rose-400' : 'text-sky-300'}`}>x{cant}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* MÓDULO 5: PROYECCIÓN DE DEMANDA */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('proyeccion')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-teal-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'proyeccion' ? '▼' : '▶'}</span> 📈 5. PROYECCIÓN DE DEMANDA E INSUMOS</span>
              <span className="bg-teal-950 text-teal-300 font-bold text-[10px] px-2 py-0.5 rounded border border-teal-500/40">{Object.keys(proyeccionDemandaTodasSedes).length} Sedes</span>
            </button>
            {moduloAbierto === 'proyeccion' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                {Object.entries(proyeccionDemandaTodasSedes)
                  .sort(([sedeA], [sedeB]) => sedeA.localeCompare(sedeB, 'es', { sensitivity: 'base' }))
                  .map(([nombreSede, infoSede], idx) => (
                    <div key={idx} className="bg-[#0b2b48] p-3 rounded-xl border border-[#0066b3] space-y-2">
                      <span className="font-bold text-white uppercase block border-b border-[#0066b3]/40 pb-1">📍 {nombreSede}</span>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {Object.entries(infoSede.sugeridos)
                          .sort(([prodA], [prodB]) => prodA.localeCompare(prodB, 'es', { sensitivity: 'base' }))
                          .map(([prod, detalle], i) => (
                            <div key={i} className="bg-[#031d35] p-2 rounded-lg border border-[#0066b3]/40 flex justify-between items-center">
                              <span className="truncate font-bold text-[11px] text-white">{prod}</span>
                              <span className={`font-black px-2 py-0.5 rounded text-[10px] ${detalle.sugerido > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' : 'bg-[#0b2b48] text-sky-400'}`}>
                                Pedir: x{detalle.sugerido}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* MÓDULO 6: VENTAS Y MIX DE SABORES */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('ventas_abanico')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-cyan-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'ventas_abanico' ? '▼' : '▶'}</span> 📊 6. VENTAS Y MIX DE SABORES</span>
              <span className="bg-cyan-950 text-cyan-300 font-bold text-[10px] px-2 py-0.5 rounded border border-cyan-500/40">{Object.keys(ventasAbanicoPorSede).length} Sedes</span>
            </button>
            {moduloAbierto === 'ventas_abanico' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                {Object.entries(ventasAbanicoPorSede)
                  .sort(([sedeA], [sedeB]) => sedeA.localeCompare(sedeB, 'es', { sensitivity: 'base' }))
                  .map(([nombreSede, productosObj]) => (
                    <div key={nombreSede} className="bg-[#0b2b48] p-3 rounded-xl border border-[#0066b3] space-y-1.5">
                      <span className="font-bold text-white uppercase block border-b border-[#0066b3]/40 pb-1">📍 {nombreSede}</span>
                      {Object.entries(productosObj)
                        .sort(([prodA], [prodB]) => prodA.localeCompare(prodB, 'es', { sensitivity: 'base' }))
                        .map(([prod, cant]: [string, any], idx) => (
                          <div key={idx} className="flex justify-between text-[11px] text-white border-b border-[#0066b3]/20 py-0.5">
                            <span>{prod}</span>
                            <span className="font-bold text-emerald-300">x{cant}</span>
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* MÓDULO 7: INTELIGENCIA DE NEGOCIO (BI) */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('bi')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-amber-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'bi' ? '▼' : '▶'}</span> 🧠 7. INTELIGENCIA DE NEGOCIO (BI)</span>
              <span className="bg-amber-950 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-500/40">Analítica</span>
            </button>
            {moduloAbierto === 'bi' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0b2b48] border border-emerald-500/50 p-2.5 rounded-xl">
                    <span className="text-[9px] text-emerald-300 font-black uppercase block">🔥 Más Vendido</span>
                    <p className="text-xs font-black text-white truncate">{String(datosBI.masVendido[0])}</p>
                    <span className="text-[10px] text-emerald-300 font-bold">x{String(datosBI.masVendido[1])} unids</span>
                  </div>
                  <div className="bg-[#0b2b48] border border-rose-500/50 p-2.5 rounded-xl">
                    <span className="text-[9px] text-rose-300 font-black uppercase block">❄️ Menos Vendido</span>
                    <p className="text-xs font-black text-white truncate">{String(datosBI.menosVendido[0])}</p>
                    <span className="text-[10px] text-rose-300 font-bold">x{String(datosBI.menosVendido[1])} unids</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MÓDULO 8: RAPPI Y DESCUENTOS */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('rappi')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-orange-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'rappi' ? '▼' : '▶'}</span> 🛵 8. RAPPI Y DESCUENTOS</span>
              <span className="bg-orange-950 text-orange-300 font-bold text-[10px] px-2 py-0.5 rounded border border-orange-500/40">${rappiYDescuentosData.totalRappiGlobal.toLocaleString('es-CO')}</span>
            </button>
            {moduloAbierto === 'rappi' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0b2b48] border border-orange-500/50 p-2.5 rounded-xl">
                    <span className="text-[9px] text-orange-300 font-black uppercase block">🛵 Total Rappi</span>
                    <p className="text-xs font-black text-white">${rappiYDescuentosData.totalRappiGlobal.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="bg-[#0b2b48] border border-sky-500/50 p-2.5 rounded-xl">
                    <span className="text-[9px] text-sky-300 font-black uppercase block">🏷️ Total Descuentos</span>
                    <p className="text-xs font-black text-white">${rappiYDescuentosData.totalDescuentosGlobal.toLocaleString('es-CO')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MÓDULO 9: MÉTODOS DE PAGO */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button onClick={() => toggleModulo('pagos')} className="w-full p-3.5 flex justify-between items-center text-xs font-black uppercase text-emerald-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'pagos' ? '▼' : '▶'}</span> 💳 9. MÉTODOS DE PAGO</span>
              <span className="bg-emerald-950 text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded border border-emerald-500/40">${comparativoMetodosPago.totalGeneralPagos.toLocaleString('es-CO')}</span>
            </button>
            {moduloAbierto === 'pagos' && (
              <div className="p-3 space-y-3 border-t border-[#0066b3]/30 bg-[#031d35]/60 text-xs">
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-[#0b2b48] p-2 rounded-xl border border-emerald-500/30">
                    <span className="block text-[9px] text-emerald-400 font-bold uppercase">💵 Efec</span>
                    <span className="text-xs font-black text-white">${comparativoMetodosPago.efectivoTotal.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="bg-[#0b2b48] p-2 rounded-xl border border-sky-500/30">
                    <span className="block text-[9px] text-sky-300 font-bold uppercase">📲 Nequi</span>
                    <span className="text-xs font-black text-white">${comparativoMetodosPago.nequiTotal.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="bg-[#0b2b48] p-2 rounded-xl border border-rose-500/30">
                    <span className="block text-[9px] text-rose-300 font-bold uppercase">💳 Davi</span>
                    <span className="text-xs font-black text-white">${comparativoMetodosPago.daviplataTotal.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MÓDULO 10: GESTIÓN DEL SISTEMA */}
          <div className="border-2 border-fuchsia-500/80 bg-[#0b2b48] rounded-2xl overflow-hidden shadow-xl">
            <button onClick={() => toggleModulo('gestion_sistema')} className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-fuchsia-300 bg-[#0b2b48] cursor-pointer">
              <span className="flex items-center gap-2"><span>{moduloAbierto === 'gestion_sistema' ? '▼' : '▶'}</span> ⚙️ 10. GESTIÓN DEL SISTEMA</span>
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
                    <div className="flex justify-between items-center bg-[#0b2b48] p-2 rounded-xl border border-[#0066b3]">
                      <div className="flex gap-1.5">
                        <button onClick={() => setTablaProductoSeleccionada('produc_ven_martineto')} className={`px-3 py-1 rounded-lg text-xs font-bold ${tablaProductoSeleccionada === 'produc_ven_martineto' ? 'bg-[#0078d4] text-white' : 'bg-[#031d35] text-sky-300'}`}>Martineto</button>
                        <button onClick={() => setTablaProductoSeleccionada('produc_ven_ositos')} className={`px-3 py-1 rounded-lg text-xs font-bold ${tablaProductoSeleccionada === 'produc_ven_ositos' ? 'bg-[#0078d4] text-white' : 'bg-[#031d35] text-sky-300'}`}>Ositos</button>
                      </div>
                      <button onClick={() => setMostrarModalNuevoProdVenta(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase">➕ Crear Producto</button>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {[...listaProductosVenta]
                        .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }))
                        .map((p) => {
                          const estaEditado = preciosEditados[p.id] !== undefined;
                          return (
                            <div key={p.id} className="bg-[#0b2b48] p-2.5 rounded-xl border border-[#0066b3] space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-white block">{p.nombre}</span>
                                  <span className="text-[10px] text-sky-300 uppercase font-semibold">Cat: {p.categoria || 'General'}</span>
                                </div>
                                <button onClick={() => toggleEstadoProducto(p.id, p.activo)} className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${p.activo ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-rose-950 text-rose-300 border-rose-600'}`}>{p.activo ? '✓ Activo' : '✕ Inactivo'}</button>
                              </div>
                              <div className="flex gap-2 items-center bg-[#031d35] p-2 rounded-lg border border-[#0066b3]/50">
                                <span className="text-[11px] text-sky-300 font-bold">Precio ($):</span>
                                <input type="number" value={preciosEditados[p.id] !== undefined ? preciosEditados[p.id] : p.precio} onChange={(e) => setPreciosEditados({ ...preciosEditados, [p.id]: Number(e.target.value) })} className="w-28 bg-[#0b2b48] border border-[#00a4ef] text-emerald-300 font-black text-center rounded p-1 text-xs outline-none" />
                                {estaEditado && <button onClick={() => guardarPrecioProducto(p.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded">💾 Guardar</button>}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {subPestanaGestion === 'usuarios' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between items-center bg-[#0b2b48] p-2 rounded-xl border border-[#0066b3]">
                      <span className="text-xs font-bold text-sky-200 uppercase">Usuarios del Sistema</span>
                      <button onClick={() => setMostrarModalNuevoUsuario(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase">➕ Crear Usuario</button>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {[...listaUsuariosGestion]
                        .sort((a, b) => String(a.nombre_completo || '').localeCompare(String(b.nombre_completo || ''), 'es', { sensitivity: 'base' }))
                        .map((u) => (
                          <div key={u.id} className="bg-[#0b2b48] p-2.5 rounded-xl border border-[#0066b3] flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-white block">{u.nombre_completo}</span>
                              <span className="text-[10px] text-sky-300 font-medium">Rol: <b className="text-amber-300 uppercase">{u.tipo_usuario || 'operador'}</b> | PIN: <b className="text-emerald-300">{u.codigo_acceso}</b></span>
                            </div>
                            <button onClick={() => toggleEstadoUsuario(u.id, u.activo)} className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${u.activo ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-rose-950 text-rose-300 border-rose-600'}`}>{u.activo ? '✓ Activo' : '✕ Inactivo'}</button>
                          </div>
                        ))}
                    </div>
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
              <h3 className="text-xs font-black text-white uppercase">➕ Crear Producto ({tablaProductoSeleccionada === 'produc_ven_martineto' ? 'Martineto' : 'Ositos'})</h3>
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

              {/* OPCIÓN PRODUCTO DE INVENTARIO */}
              <div className="flex items-center gap-2 bg-[#031d35] p-2.5 rounded-xl border border-sky-500/50 mt-1">
                <input 
                  type="checkbox" 
                  id="chkInventario" 
                  checked={nuevoProdEsInventario} 
                  onChange={(e) => setNuevoProdEsInventario(e.target.checked)} 
                  className="w-4 h-4 accent-fuchsia-500 rounded cursor-pointer" 
                />
                <label htmlFor="chkInventario" className="text-[11px] font-bold text-sky-200 cursor-pointer select-none">
                  📦 ¿Es también un producto de inventario/empaque?
                </label>
              </div>
              {nuevoProdEsInventario && (
                <p className="text-[9px] text-amber-300 italic px-1">
                  ℹ️ Se creará en la tabla de empaques ({tablaProductoSeleccionada === 'produc_ven_martineto' ? 'empaques_martineto' : 'empaques_ositos'}) con stock inicial en 0.
                </p>
              )}
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