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

export default function AdminPage() {
  const router = useRouter();
  const { sedeData } = useSede();

  const fechaHoy = new Date().toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState<string>(fechaHoy);
  const [fechaFin, setFechaFin] = useState<string>(fechaHoy);
  const [sedeSeleccionada, setSedeSeleccionada] = useState<string>('todos');

  const [moduloAbierto, setModuloAbierto] = useState<string | null>(null);
  const [subPestanaLogistica, setSubPestanaLogistica] = useState<'compras' | 'despachos'>('compras');
  const [subPestanaCierres, setSubPestanaCierres] = useState<'caja' | 'descuadres'>('caja');

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

  useEffect(() => {
    cargarDatosAdmin();
  }, [fechaInicio, fechaFin]);

  async function cargarDatosAdmin() {
    setCargando(true);
    try {
      const { data: sedesData } = await supabase.from('sede').select('id, nombre');
      if (sedesData) {
        const sedesReales = sedesData.filter((s) => {
          const n = String(s.nombre || '').toLowerCase();
          return n.includes('viva') || n.includes('centro') || n.includes('martineto') || n.includes('ositos');
        });

        setSedesBD(sedesReales);
        const mapa: { [id: number]: string } = {};
        sedesReales.forEach((s) => {
          mapa[s.id] = s.nombre;
        });
        setMapaSedes(mapa);
      }

      const { data: usuariosData } = await supabase.from('usuario').select('id, nombre_completo');
      const mapaU: { [id: number]: string } = {};
      if (usuariosData) {
        usuariosData.forEach((u) => {
          mapaU[u.id] = u.nombre_completo;
        });
        setUsuariosBD(mapaU);
      }

      const { data: pedidosDataRaw } = await supabase.from('pedidos_insumos').select('*');
      const pedidosData = (pedidosDataRaw || []).filter(row => {
        if (!row.fecha) return false;
        const fRow = obtenerFechaLocalStr(row.fecha);
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

      const { data: prodData } = await supabase.from('producto').select('id, nombre, donde_comprar');

      const { data: cajaDataRaw } = await supabase.from('caja').select('*');
      const cajaData = (cajaDataRaw || []).filter(row => {
        if (!row.fecha) return false;
        const fRow = obtenerFechaLocalStr(row.fecha);
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

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
      const invMovsFiltrado = (invDiarioRaw || []).filter(row => {
        if (!row.fecha_registro) return false;
        const fRow = obtenerFechaLocalStr(row.fecha_registro);
        return fRow >= fechaInicio && fRow <= fechaFin;
      });

      const { data: empaquesSedesData } = await supabase.from('inventario_empaques_sedes').select('*');

      setPedidos(pedidosData);
      setProductosBD(prodData || []);
      setRegistrosCaja(cajaData);
      setRegistrosNomina(nominaData);
      setInventarioMovimientos(diffDataFiltrado);
      setInventarioMovsDia(invMovsFiltrado);
      setInventarioEmpaquesSedesBD(empaquesSedesData || []);
      setHistoricoVentasBD(historicoVentasFiltrado);
      setItemsChequeados({});
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setCargando(false);
    }
  }

  const getNombreSede = (id: number) => mapaSedes[id] || `Sede ${id}`;
  const getNombreUsuario = (id: number) => usuariosBD[id] || `Empleado #${id}`;

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
      const efec = Number(row.efectivo_cierre) || 0;
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

  const cierresPorSede = (() => {
    const mapa: { [sede: string]: any } = {};
    
    const registrosOrdenados = [...registrosCaja].sort((a, b) => {
      return (a.id || 0) - (b.id || 0);
    });

    registrosOrdenados.forEach(row => {
      if (!mapaSedes[row.sede_id]) return;
      const nombreSede = getNombreSede(row.sede_id);
      if (sedeSeleccionada !== 'todos' && String(row.sede_id) !== sedeSeleccionada) return;

      const efec = Number(row.efectivo_cierre) || 0;
      const neq = Number(row.nequi) || 0;
      const dav = Number(row.daviplata) || 0;
      const gas = Number(row.monto_gasto) || 0;

      if (!mapa[nombreSede]) {
        mapa[nombreSede] = {
          efectivo: 0,
          nequi: 0,
          daviplata: 0,
          gastos: 0,
          nomina: 0,
          totalVenta: 0,
          motivosGastos: [],
          notasNomina: [],
          estadoCaja: 'cerrada'
        };
      }

      mapa[nombreSede].efectivo += efec;
      mapa[nombreSede].nequi += neq;
      mapa[nombreSede].daviplata += dav;
      mapa[nombreSede].gastos += gas;
      mapa[nombreSede].totalVenta += (efec + neq + dav);
      if (row.motivo_gasto) mapa[nombreSede].motivosGastos.push(row.motivo_gasto);
      
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
          efectivo: 0,
          nequi: 0,
          daviplata: 0,
          gastos: 0,
          nomina: 0,
          totalVenta: 0,
          motivosGastos: [],
          notasNomina: [],
          estadoCaja: 'cerrada'
        };
      }

      mapa[nombreSede].nomina += montoPago;
      const empleadoNombre = n.usuario_id ? getNombreUsuario(n.usuario_id) : (n.concepto || 'Pago turno');
      mapa[nombreSede].notasNomina.push(`${empleadoNombre}: $${montoPago.toLocaleString()}`);
    });

    return mapa;
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
          if (tipo === 'apertura' || tipo === 'nuevas' || tipo === 'compradas' || tipo === 'compra') factor = 1;
          else if (tipo === 'de_baja' || tipo === 'baja') factor = -1;

          if (factor !== 0) {
            const dEmpaques = reg.detalle_empaques || {};
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

  // CÁLCULOS LIMPIOS PARA INTELIGENCIA DE NEGOCIO (BI) FUERA DEL JSX
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

          {/* MÓDULO 1 */}
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
                            <button onClick={() => setAcordeonesDespachos(prev => ({ ...prev, [nombreSede]: !abierto }))} className="w-full p-3 flex justify-between items-center text-xs font-bold text-white uppercase">
                              <span>{abierto ? '▼' : '▶'} {nombreSede}</span>
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
                                <button onClick={() => marcarPedidosComoEntregados(dataSede.idsPedidos)} className="w-full mt-2 bg-emerald-600 text-white font-black py-2 rounded-lg text-xs uppercase cursor-pointer">
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

          {/* MÓDULO 2 */}
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
                            const ventaNetoSede = dataSede.totalVenta - dataSede.gastos - dataSede.nomina;

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
                                  <div className="p-3 space-y-1 bg-[#031d35] text-xs border-t border-[#0066b3]/30">
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💵 Efectivo:</span><span className="font-bold text-emerald-400">${dataSede.efectivo.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📲 Nequi:</span><span className="font-bold text-sky-300">${dataSede.nequi.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>💳 Daviplata:</span><span className="font-bold text-rose-300">${dataSede.daviplata.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>📉 Gastos:</span><span className="font-bold text-amber-400">-${dataSede.gastos.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-b border-[#0066b3]/20 py-1"><span>👥 Nómina Turnos:</span><span className="font-bold text-fuchsia-300">-${dataSede.nomina.toLocaleString()}</span></div>
                                    
                                    {(dataSede.motivosGastos.length > 0 || dataSede.notasNomina.length > 0) && (
                                      <div className="bg-[#0b2b48] p-2 rounded text-[10px] my-1 border border-amber-500/30 space-y-1">
                                        {dataSede.motivosGastos.length > 0 && (
                                          <div>
                                            <span className="text-amber-300 font-bold block">Notas de Gastos:</span>
                                            {dataSede.motivosGastos.map((m: string, idx: number) => <p key={idx} className="text-sky-200">• {m}</p>)}
                                          </div>
                                        )}
                                        {dataSede.notasNomina.length > 0 && (
                                          <div>
                                            <span className="text-fuchsia-300 font-bold block">Pagos de Turnos:</span>
                                            {dataSede.notasNomina.map((n: string, idx: number) => <p key={idx} className="text-sky-200">• {n}</p>)}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div className="flex justify-between py-1 font-black border-t border-sky-500/40 text-white"><span>💰 VENTA NETO:</span><span className="text-emerald-300">${ventaNetoSede.toLocaleString()}</span></div>
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

                        const ventaNetoUnica = datosSedeSeleccionada.totalVenta - datosSedeSeleccionada.gastos - datosSedeSeleccionada.nomina;

                        return (
                          <div className="border border-emerald-500/50 bg-[#031d35] p-3 rounded-xl space-y-1.5 text-xs shadow-md">
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💵 Efectivo:</span><span className="font-bold text-emerald-400">${datosSedeSeleccionada.efectivo.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📲 Nequi:</span><span className="font-bold text-sky-300">${datosSedeSeleccionada.nequi.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>💳 Daviplata:</span><span className="font-bold text-rose-300">${datosSedeSeleccionada.daviplata.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>📉 Gastos:</span><span className="font-bold text-amber-400">-${datosSedeSeleccionada.gastos.toLocaleString()}</span></div>
                            <div className="flex justify-between border-b border-[#0066b3]/30 py-1"><span>👥 Nómina Turnos:</span><span className="font-bold text-fuchsia-300">-${datosSedeSeleccionada.nomina.toLocaleString()}</span></div>
                            
                            {(datosSedeSeleccionada.motivosGastos.length > 0 || datosSedeSeleccionada.notasNomina.length > 0) && (
                              <div className="bg-[#0b2b48] p-2 rounded text-[10px] my-1 border border-amber-500/30 space-y-1">
                                {datosSedeSeleccionada.motivosGastos.length > 0 && (
                                  <div>
                                    <span className="text-amber-300 font-bold block">Notas de Gastos:</span>
                                    {datosSedeSeleccionada.motivosGastos.map((m: string, idx: number) => <p key={idx} className="text-sky-200">• {m}</p>)}
                                  </div>
                                )}
                                {datosSedeSeleccionada.notasNomina.length > 0 && (
                                  <div>
                                    <span className="text-fuchsia-300 font-bold block">Pagos de Turnos:</span>
                                    {datosSedeSeleccionada.notasNomina.map((n: string, idx: number) => <p key={idx} className="text-sky-200">• {n}</p>)}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex justify-between py-1.5 text-xs font-black border-t border-emerald-400 mt-1 text-white"><span>💰 VENTA NETO:</span><span className="text-emerald-300">${ventaNetoUnica.toLocaleString()}</span></div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {subPestanaCierres === 'descuadres' && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-sky-200 italic px-1">
                      Registro de diferencias de inventario para el rango seleccionado.
                    </p>

                    {Object.keys(auditoriaDescuadres).length === 0 ? (
                      <p className="text-center text-xs text-sky-300 py-6 font-semibold">No hay diferencias registradas para este rango.</p>
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

          {/* MÓDULO 3 */}
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

          {/* MÓDULO 4 */}
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

          {/* MÓDULO 5: VENTAS */}
          <div className="border border-[#0066b3] bg-[#0b2b48] rounded-2xl overflow-hidden shadow-lg">
            <button 
              onClick={() => toggleModulo('ventas_abanico')}
              className="w-full p-4 flex justify-between items-center text-xs font-black uppercase text-cyan-300 bg-[#0b2b48] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{moduloAbierto === 'ventas_abanico' ? '▼' : '▶'}</span> 📊 5. VENTAS
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
                  <div className="space-y-3">
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
                        📊 Gráfico de Rendimiento por Producto
                      </span>
                      
                      <div className="space-y-2 pt-1 max-h-52 overflow-y-auto pr-1">
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
                )}
              </div>
            )}
          </div>

        </div>
      )}

    </main>
  );
}