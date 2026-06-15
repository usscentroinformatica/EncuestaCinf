// src/pages/Admin/AdminPanel.tsx
import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { ref, set, get } from 'firebase/database';
import * as XLSX from 'xlsx';

const AdminPanel = () => {
  const [googleScriptUrl, setGoogleScriptUrl] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [configActual, setConfigActual] = useState<any>(null);
  const [creando, setCreando] = useState(false);
  const [subiendoBase, setSubiendoBase] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [pasoActual, setPasoActual] = useState(1);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [editandoPeriodo, setEditandoPeriodo] = useState(false);

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    try {
      const configRef = ref(db, 'encuesta-config/config');
      const snapshot = await get(configRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        setConfigActual(data);
        setGoogleScriptUrl(data.googleScriptUrl || '');
        setPeriodo(data.periodo || '');
        setSpreadsheetId(data.spreadsheetId || '');
        
        if (data.spreadsheetUrl) {
          setPasoActual(3);
        } else if (data.googleScriptUrl) {
          setPasoActual(2);
        } else {
          setPasoActual(1);
        }
      }
    } catch (error) {
      console.error('Error cargando:', error);
    }
  };

  const guardarConfiguracion = async () => {
    if (!googleScriptUrl.trim()) {
      setMensaje('❌ Ingresa la URL del Google Apps Script');
      return;
    }

    setLoading(true);
    setMensaje('');

    try {
      const configRef = ref(db, 'encuesta-config/config');
      await set(configRef, {
        googleScriptUrl: googleScriptUrl.trim(),
        periodo: periodo || 'NUEVO PERIODO',
        fechaActualizacion: new Date().toISOString()
      });

      setMensaje('✅ Configuración guardada. Ahora puedes crear la hoja.');
      setPasoActual(2);
      setEditandoUrl(false);
      setEditandoPeriodo(false);
      
      setTimeout(() => {
        cargarConfiguracion();
      }, 1000);
    } catch (error: any) {
      setMensaje('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const crearNuevaHoja = async () => {
    if (!periodo.trim()) {
      setMensaje('❌ Ingresa el nombre del período primero');
      return;
    }

    if (!googleScriptUrl) {
      setMensaje('❌ Primero guarda la URL del script en el Paso 1');
      return;
    }

    setCreando(true);
    setMensaje('🔄 Creando nueva hoja de cálculo...');

    try {
      const PROXY_URL = '/api/google-script';
      const params = new URLSearchParams();
      params.append('scriptUrl', googleScriptUrl);
      params.append('action', 'crearHoja');
      params.append('periodo', periodo);
      
      const url = `${PROXY_URL}?${params.toString()}`;
      
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        const newSpreadsheetId = result.spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
        
        const configRef = ref(db, 'encuesta-config/config');
        await set(configRef, {
          googleScriptUrl: googleScriptUrl,
          spreadsheetUrl: result.spreadsheetUrl,
          spreadsheetId: newSpreadsheetId,
          periodo: periodo,
          fechaActualizacion: new Date().toISOString()
        });

        setSpreadsheetId(newSpreadsheetId);
        setMensaje(`✅ ¡Hoja creada!\n📊 ${result.spreadsheetUrl}`);
        setPasoActual(3);
        
        setTimeout(() => {
          cargarConfiguracion();
        }, 2000);
      } else {
        throw new Error(result.error || 'Error al crear la hoja');
      }

    } catch (error: any) {
      console.error('❌ Error:', error);
      setMensaje(`❌ Error: ${error.message}`);
    } finally {
      setCreando(false);
    }
  };

  const procesarExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      let sheetName = 'data';
      if (!workbook.SheetNames.includes(sheetName)) {
        sheetName = workbook.SheetNames[0];
        setMensaje(`⚠️ No se encontró hoja "data", usando "${sheetName}"`);
      }
      
      const hojaData = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(hojaData);
      
      const estudiantes = jsonData
        .map((row: any) => ({
          correo: row['EMail1'] || row['EMail2'] || row['EMaiCrec'] || row['Correo'] || '',
          nombre: `${row['Apellido'] || ''} ${row['Nombre'] || ''}`.trim() || row['Nombre'] || '',
          planEstudio: row['PlanEst'] || row['PlanEstudio'] || '',
          curso: row['Curso'] || '',
          seccion: row['Seccion'] || row['PEAD'] || '',
          docente: row['Docente'] || ''
        }))
        .filter(est => {
          const tieneCorreo = est.correo && est.correo.includes('@');
          const tieneNombre = est.nombre && est.nombre.length > 0;
          const tieneCurso = est.curso && est.curso.length > 0;
          return tieneCorreo && tieneNombre && tieneCurso;
        });
      
      const uniqueEstudiantes = [];
      const emailsVistos = new Set();
      
      for (const est of estudiantes) {
        if (!emailsVistos.has(est.correo)) {
          emailsVistos.add(est.correo);
          uniqueEstudiantes.push(est);
        }
      }
      
      setPreviewData(uniqueEstudiantes);
      setMensaje(`📊 Hoja "${sheetName}": ${uniqueEstudiantes.length} registros válidos (de ${jsonData.length} totales)`);
    };
    reader.readAsArrayBuffer(file);
  };

  const actualizarBaseUnificada = async () => {
    if (!googleScriptUrl) {
      setMensaje('❌ No hay URL del script configurada');
      return;
    }
    
    if (!spreadsheetId && !configActual?.spreadsheetId) {
      setMensaje('❌ No hay una hoja activa. Primero crea una hoja en el Paso 2');
      return;
    }
    
    if (previewData.length === 0) {
      setMensaje('❌ No hay datos para subir. Primero carga un archivo Excel');
      return;
    }

    setSubiendoBase(true);
    setMensaje(`🔄 Actualizando ${previewData.length} estudiantes...`);

    try {
      const PROXY_URL = '/api/google-script';
      
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl: googleScriptUrl,
          spreadsheetId: spreadsheetId,
          action: 'actualizarBase',
          data: previewData
        })
      });

      const result = await response.json();

      if (result.success) {
        setMensaje(`✅ ¡BaseUnificada actualizada! ${result.agregados || previewData.length} estudiantes registrados.`);
        setPreviewData([]);
        setTimeout(() => cargarConfiguracion(), 1500);
      } else {
        throw new Error(result.error || 'Error al actualizar');
      }

    } catch (error: any) {
      console.error('❌ Error:', error);
      setMensaje(`❌ Error: ${error.message}`);
    } finally {
      setSubiendoBase(false);
    }
  };

  // Componente de paso
  const PasoIndicator = ({ numero, titulo, activo, completado }: { numero: number; titulo: string; activo: boolean; completado: boolean }) => (
    <div style={{ 
      flex: 1, 
      textAlign: 'center', 
      position: 'relative',
      cursor: completado ? 'pointer' : 'default'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        margin: '0 auto 10px',
        borderRadius: '50%',
        background: completado ? '#63ed12' : (activo ? '#5a2290' : '#e0e0e0'),
        color: completado || activo ? 'white' : '#999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '18px',
        transition: 'all 0.3s ease',
        boxShadow: activo ? '0 0 0 4px rgba(90,34,144,0.2)' : 'none'
      }}>
        {completado ? '✓' : numero}
      </div>
      <div style={{ 
        fontWeight: activo ? '600' : '400',
        color: completado ? '#1a5e20' : (activo ? '#5a2290' : '#999'),
        fontSize: '14px'
      }}>
        {titulo}
      </div>
      {numero < 3 && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '-50%',
          width: '100%',
          height: '2px',
          background: completado ? '#63ed12' : '#e0e0e0',
          zIndex: 0
        }} />
      )}
    </div>
  );

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ color: 'white', fontSize: '32px', marginBottom: '10px' }}>⚙️ Panel de Administración</h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '16px' }}>Configura el sistema de encuestas en 3 simples pasos</p>
        </div>

        {/* Pasos indicadores */}
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '20px' }}>
            <PasoIndicator numero={1} titulo="Configurar URL" activo={pasoActual === 1} completado={pasoActual > 1} />
            <PasoIndicator numero={2} titulo="Crear hoja" activo={pasoActual === 2} completado={pasoActual > 2} />
            <PasoIndicator numero={3} titulo="Cargar estudiantes" activo={pasoActual === 3} completado={pasoActual > 3} />
          </div>
        </div>

        {/* Contenido dinámico por paso */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
          
          {/* PASO 1 */}
          {pasoActual === 1 && (
            <div>
              <h2 style={{ color: '#5a2290', marginBottom: '10px' }}>📝 Configurar URL del Apps Script</h2>
              <p style={{ color: '#666', marginBottom: '25px' }}>Necesitas desplegar tu Google Apps Script como aplicación web</p>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#333' }}>URL del Apps Script</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={googleScriptUrl}
                    onChange={(e) => setGoogleScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/XXXX/exec"
                    disabled={!editandoUrl && pasoActual === 1 ? false : !editandoUrl && pasoActual > 1}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: `2px solid ${editandoUrl ? '#63ed12' : '#e0e0e0'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: (!editandoUrl && pasoActual > 1) ? '#f5f5f5' : 'white',
                      color: (!editandoUrl && pasoActual > 1) ? '#999' : '#333',
                      cursor: (!editandoUrl && pasoActual > 1) ? 'not-allowed' : 'text',
                      transition: 'all 0.3s ease'
                    }}
                  />
                  {pasoActual > 1 && (
                    <button
                      onClick={() => setEditandoUrl(!editandoUrl)}
                      style={{
                        padding: '10px 20px',
                        background: editandoUrl ? '#63ed12' : '#5a2290',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      {editandoUrl ? '💾 Listo' : '✏️ Editar'}
                    </button>
                  )}
                </div>
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>📌 La URL debe terminar en <strong>/exec</strong></small>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#333' }}>Período</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    placeholder="Ej: AGOSTO 2026"
                    disabled={!editandoPeriodo && pasoActual === 1 ? false : !editandoPeriodo && pasoActual > 1}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: `2px solid ${editandoPeriodo ? '#63ed12' : '#e0e0e0'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: (!editandoPeriodo && pasoActual > 1) ? '#f5f5f5' : 'white',
                      color: (!editandoPeriodo && pasoActual > 1) ? '#999' : '#333',
                      cursor: (!editandoPeriodo && pasoActual > 1) ? 'not-allowed' : 'text'
                    }}
                  />
                  {pasoActual > 1 && (
                    <button
                      onClick={() => setEditandoPeriodo(!editandoPeriodo)}
                      style={{
                        padding: '10px 20px',
                        background: editandoPeriodo ? '#63ed12' : '#5a2290',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      {editandoPeriodo ? '💾 Listo' : '✏️ Editar'}
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={guardarConfiguracion}
                disabled={loading || !googleScriptUrl.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading || !googleScriptUrl.trim() ? '#ccc' : '#5a2290',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: loading || !googleScriptUrl.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (!loading && googleScriptUrl.trim()) {
                    e.currentTarget.style.background = '#63ed12';
                    e.currentTarget.style.color = '#000';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && googleScriptUrl.trim()) {
                    e.currentTarget.style.background = '#5a2290';
                    e.currentTarget.style.color = 'white';
                  }
                }}
              >
                {loading ? '💾 Guardando...' : '💾 Guardar y continuar'}
              </button>
            </div>
          )}

          {/* PASO 2 */}
          {pasoActual === 2 && (
            <div>
              <h2 style={{ color: '#5a2290', marginBottom: '10px' }}>🚀 Crear hoja de cálculo</h2>
              <p style={{ color: '#666', marginBottom: '25px' }}>
                Se creará una nueva hoja para el período <strong>{periodo}</strong>
              </p>

              {configActual?.googleScriptUrl && (
                <div style={{ 
                  background: '#f0f7ff', 
                  padding: '15px', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  fontSize: '13px'
                }}>
                  <strong>📋 Configuración actual:</strong><br />
                  URL del Script: <code style={{ fontSize: '11px' }}>{configActual.googleScriptUrl?.substring(0, 60)}...</code><br />
                  Período: <strong>{periodo}</strong>
                </div>
              )}

              <button
                onClick={crearNuevaHoja}
                disabled={creando || !periodo.trim() || !googleScriptUrl}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: creando ? '#ccc' : '#5a2290',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: (creando || !periodo.trim() || !googleScriptUrl) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (!creando && periodo.trim() && googleScriptUrl) {
                    e.currentTarget.style.background = '#63ed12';
                    e.currentTarget.style.color = '#000';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creando && periodo.trim() && googleScriptUrl) {
                    e.currentTarget.style.background = '#5a2290';
                    e.currentTarget.style.color = 'white';
                  }
                }}
              >
                {creando ? '🔄 Creando hoja...' : '📊 Crear hoja de cálculo'}
              </button>
            </div>
          )}

          {/* PASO 3 */}
          {pasoActual === 3 && (
            <div>
              <h2 style={{ color: '#5a2290', marginBottom: '10px' }}>👥 Cargar estudiantes</h2>
              <p style={{ color: '#666', marginBottom: '25px' }}>
                Sube un archivo Excel con el padrón de estudiantes
              </p>

              {configActual?.spreadsheetUrl && (
                <div style={{ 
                  background: '#e8f5e1', 
                  padding: '15px', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  fontSize: '13px'
                }}>
                  <strong>✅ Hoja activa:</strong><br />
                  <a href={configActual.spreadsheetUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#5a2290' }}>
                    📊 Ver hoja de cálculo
                  </a><br />
                  <strong>Período:</strong> {configActual.periodo}<br />
                  <strong>ID:</strong> <code style={{ fontSize: '11px' }}>{spreadsheetId || configActual?.spreadsheetId}</code>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#333' }}>📂 Archivo Excel</label>
                <div style={{ 
                  border: '2px dashed #ccc', 
                  borderRadius: '8px', 
                  padding: '30px',
                  textAlign: 'center',
                  background: '#fafafa',
                  transition: 'all 0.3s ease'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#63ed12';
                  e.currentTarget.style.background = '#f0f7ff';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = '#ccc';
                  e.currentTarget.style.background = '#fafafa';
                }}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) procesarExcel(file);
                    }}
                    style={{ display: 'none' }}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
                    <div style={{ fontWeight: '500', marginBottom: '5px' }}>Haz clic o arrastra un archivo</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>.xlsx, .xls o .csv</div>
                  </label>
                </div>
                <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
                  ⚠️ El Excel debe tener una hoja llamada <strong>"data"</strong> con columnas: EMail1, Apellido, Nombre, Curso, etc.
                </small>
              </div>

              {previewData.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <button
                    onClick={actualizarBaseUnificada}
                    disabled={subiendoBase}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: subiendoBase ? '#ccc' : '#5a2290',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: subiendoBase ? 'not-allowed' : 'pointer',
                      marginBottom: '15px'
                    }}
                  >
                    {subiendoBase ? '📤 Subiendo...' : `📤 Actualizar BaseUnificada (${previewData.length} registros)`}
                  </button>

                  <div style={{ 
                    maxHeight: '300px', 
                    overflow: 'auto', 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0 }}>
                        <tr style={{ background: '#5a2290', color: 'white' }}>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Correo</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Nombre</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Curso</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Sección</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 10).map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <td style={{ padding: '8px' }}>{item.correo?.substring(0, 30)}</td>
                            <td style={{ padding: '8px' }}>{item.nombre?.substring(0, 30)}</td>
                            <td style={{ padding: '8px' }}>{item.curso}</td>
                            <td style={{ padding: '8px' }}>{item.seccion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.length > 10 && (
                      <div style={{ padding: '10px', textAlign: 'center', background: '#f5f5f5', color: '#666' }}>
                        ... y {previewData.length - 10} registros más
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mensajes */}
          {mensaje && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              borderRadius: '8px',
              backgroundColor: mensaje.includes('✅') ? '#e8f5e1' : mensaje.includes('❌') ? '#fce8e6' : '#fff3e0',
              color: mensaje.includes('✅') ? '#1a5e20' : mensaje.includes('❌') ? '#c5221f' : '#856404',
              textAlign: 'center',
              whiteSpace: 'pre-line',
              animation: 'fadeIn 0.3s ease'
            }}>
              {mensaje}
            </div>
          )}

          {/* Botón para resetear (solo visible si está en modo edición) */}
          {(editandoUrl || editandoPeriodo) && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={() => {
                  setEditandoUrl(false);
                  setEditandoPeriodo(false);
                  cargarConfiguracion();
                }}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#999',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Cancelar edición
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default AdminPanel;
