'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  obtenerComprasConsolidadasAdmin,
  marcarComoComprado,
  obtenerEntregasPorSedeAdmin,
  marcarComoEntregado,
  obtenerDiferenciasInventarioAdmin,
  obtenerTurnosEmpleadosAdmin,
  obtenerUsuariosAdmin,
  crearUsuarioAdmin,
  ResumenConsolidadoCompras,
  PedidoSedeEntrega,
  NovedadInventario,
  EmpleadoTurnoActivo,
  UsuarioInfo,
} from '@/lib/adminQueries';

export default function PanelAdministrador() {
  const router = useRouter();
  const [tab, setTab] = useState<'compras' | 'reparto' | 'turnos' | 'empleados' | 'novedades'>('compras');

  const [compras, setCompras] = useState<ResumenConsolidadoCompras[]>([]);
  const [entregas, setEntregas] = useState<PedidoSedeEntrega[]>([]);
  const [novedades, setNovedades] = useState<NovedadInventario[]>([]);
  const [turnos, setTurnos] = useState<EmpleadoTurnoActivo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioInfo[]>([]);

  // Formulario Nuevo Empleado
  const [nombreEmp, setNombreEmp] = useState('');
  const [codigoEmp, setCodigoEmp] = useState('');
  const [tipoEmp, setTipoEmp] = useState('operador');

  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarDatosTab();
  }, [tab]);

  async function cargarDatosTab() {
    setCargando(true);
    if (tab === 'compras') setCompras(await obtenerComprasConsolidadasAdmin());
    if (tab === 'reparto') setEntregas(await obtenerEntregasPorSedeAdmin());
    if (tab === 'turnos') setTurnos(await obtenerTurnosEmpleadosAdmin());
    if (tab === 'empleados') setUsuarios(await obtenerUsuariosAdmin());
    if (tab === 'novedades') setNovedades(await obtenerDiferenciasInventarioAdmin());
    setCargando(false);
  }

  async function handleComprarGrupo(ids: number[]) {
    if (await marcarComoComprado(ids)) cargarDatosTab();
  }

  async function handleEntregarPedido(id: number) {
    if (await marcarComoEntregado(id)) cargarDatosTab();
  }

  async function handleCrearEmpleado(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreEmp.trim() || !codigoEmp.trim()) return;

    const res = await crearUsuarioAdmin(nombreEmp, codigoEmp, tipoEmp);
    if (res.success) {
      setNombreEmp('');
      setCodigoEmp('');
      cargarDatosTab();
    } else {
      alert('Error al crear usuario o código ya existente');
    }
  }

  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 p-4 font-sans space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-[#0d111a] border border-gray-800 p-4 rounded-2xl flex justify-between items-center">
        <div>
          <h1 className="text-base font-black text-white">PANEL ADMINISTRACIÓN</h1>
          <p className="text-xs text-purple-400">Walers Global System</p>
        </div>
        <button
          onClick={() => router.push('/puntos')}
          className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold"
        >
          ⬅️ Puntos
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-5 gap-1 bg-[#0d111a] p-1 rounded-xl border border-gray-800 text-[10px] font-bold text-center">
        <button
          onClick={() => setTab('compras')}
          className={`py-2 rounded-lg transition-all ${tab === 'compras' ? 'bg-purple-600 text-white font-black' : 'text-gray-400'}`}
        >
          🛒 Compras
        </button>
        <button
          onClick={() => setTab('reparto')}
          className={`py-2 rounded-lg transition-all ${tab === 'reparto' ? 'bg-purple-600 text-white font-black' : 'text-gray-400'}`}
        >
          🚚 Reparto
        </button>
        <button
          onClick={() => setTab('turnos')}
          className={`py-2 rounded-lg transition-all ${tab === 'turnos' ? 'bg-purple-600 text-white font-black' : 'text-gray-400'}`}
        >
          ⏰ Turnos
        </button>
        <button
          onClick={() => setTab('empleados')}
          className={`py-2 rounded-lg transition-all ${tab === 'empleados' ? 'bg-purple-600 text-white font-black' : 'text-gray-400'}`}
        >
          👥 Personal
        </button>
        <button
          onClick={() => setTab('novedades')}
          className={`py-2 rounded-lg transition-all relative ${tab === 'novedades' ? 'bg-rose-600 text-white font-black' : 'text-gray-400'}`}
        >
          ⚠️ Alertas
        </button>
      </div>

      {cargando ? (
        <p className="text-center text-gray-500 text-xs py-8">Cargando datos...</p>
      ) : (
        <>
          {/* TAB COMPRAS */}
          {tab === 'compras' && (
            <div className="space-y-3">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider">Compras Pendientes</h2>
              {compras.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No hay solicitudes pendientes.</p>
              ) : (
                compras.map((item, idx) => (
                  <div key={idx} className="bg-[#0d111a] border border-gray-800 p-3.5 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md">
                        📍 {item.lugar_compra}
                      </span>
                      <p className="text-sm font-black text-white mt-1">
                        {item.nombre_producto} <b className="text-purple-400">x{item.total_cantidad}</b>
                      </p>
                      <p className="text-[10px] text-gray-400">Sedes: {item.sedes_solicitantes.join(', ')}</p>
                    </div>
                    <button onClick={() => handleComprarGrupo(item.ids_pedidos)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3 py-2 rounded-xl">
                      ✓ Comprado
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB REPARTO */}
          {tab === 'reparto' && (
            <div className="space-y-3">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider">Entregas Pendientes a Sedes</h2>
              {entregas.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No hay entregas pendientes.</p>
              ) : (
                entregas.map((item) => (
                  <div key={item.id} className="bg-[#0d111a] border border-gray-800 p-3.5 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-md">
                        🏢 {item.sede_nombre}
                      </span>
                      <p className="text-sm font-black text-white mt-1">
                        {item.producto_nombre} <b className="text-purple-400">x{item.cantidad}</b>
                      </p>
                    </div>
                    <button onClick={() => handleEntregarPedido(item.id)} className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-black px-3 py-2 rounded-xl">
                      📦 Entregar
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB TURNOS TRABAJANDO */}
          {tab === 'turnos' && (
            <div className="space-y-3">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider">Monitoreo de Turnos y Horarios</h2>
              {turnos.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No hay turnos registrados hoy.</p>
              ) : (
                turnos.map((t) => (
                  <div key={t.id} className="bg-[#0d111a] border border-gray-800 p-3 rounded-2xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-xs text-white">{t.usuario_nombre}</span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                        {t.sede_nombre}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Entrada: <b>{t.hora_entrada}</b> | Salida: <b>{t.hora_salida}</b>
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB GESTIÓN DE PERSONAL */}
          {tab === 'empleados' && (
            <div className="space-y-4">
              <form onSubmit={handleCrearEmpleado} className="bg-[#0d111a] border border-gray-800 p-3.5 rounded-2xl space-y-2">
                <h3 className="text-xs font-black text-white">Registrar Nuevo Empleado</h3>
                <input
                  type="text"
                  placeholder="Nombre Completo"
                  value={nombreEmp}
                  onChange={(e) => setNombreEmp(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2 text-xs text-white outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Código Acceso"
                    value={codigoEmp}
                    onChange={(e) => setCodigoEmp(e.target.value)}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-2 text-xs text-white outline-none"
                  />
                  <select
                    value={tipoEmp}
                    onChange={(e) => setTipoEmp(e.target.value)}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-2 text-xs text-white outline-none"
                  >
                    <option value="operador">Operador</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-2 rounded-xl text-xs">
                  + Agregar Empleado
                </button>
              </form>

              <div className="space-y-2">
                <h3 className="text-xs font-black text-gray-400 uppercase">Lista de Empleados</h3>
                {usuarios.map((u) => (
                  <div key={u.id} className="bg-[#0d111a] border border-gray-800 p-2.5 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white">{u.nombre_completo}</p>
                      <p className="text-[10px] text-gray-400">Código: <b>{u.codigo_acceso}</b> | Rol: <b>{u.tipo_usuario}</b></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB ALERTAS INVENTARIO */}
          {tab === 'novedades' && (
            <div className="space-y-3">
              <h2 className="text-xs font-black text-rose-400 uppercase tracking-wider">Alertas Cierre vs. Apertura</h2>
              {novedades.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No hay diferencias encontradas.</p>
              ) : (
                novedades.map((nov) => (
                  <div key={nov.id} className="bg-[#160d13] border border-rose-900/60 p-3.5 rounded-2xl space-y-1.5">
                    <p className="text-xs font-black text-white">{nov.sede_nombre} - {nov.producto_nombre}</p>
                    <p className="text-[10px] text-rose-400">Diferencia: <b>{nov.diferencia}</b> | Operador: {nov.usuario_nombre}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}