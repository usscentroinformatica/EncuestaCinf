// src/pages/Admin/AdminPanel.tsx
import { useState, useEffect, useRef } from 'react';
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
  const [nombreHoja, setNombreHoja] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cerrarSesion = () => {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('eval_data');
    window.location.href = '/';
  };

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
        setNombreHoja(data.nombreHoja || '');
        
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

  // ============================================
  // CREAR HOJA (DIRECTO A GAS - SIN PROXY)
  // ============================================
  
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
      const payload = {
        accion: 'crearHojaCalculo',
        nombre: periodo,
        titulo: 'ENCUESTA DE SATISFACCIÓN DOCENTE',
        subtitulo: periodo,
        hojaBase: 'BaseUnificada',
        hojaRespuestas: 'Respuestas',
        preguntas: [
          'P1: Puntualidad',
          'P2: Claridad en la exposición',
          'P3: Relación teoría-práctica',
          'P4: Participación en clase',
          'P5: Respuesta a correos',
          'P6: Nivel de estrellas'
        ]
      };

      console.log('📤 Enviando a GAS:', googleScriptUrl);
      console.log('📦 Payload:', payload);

      const response = await fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      console.log('📥 Respuesta cruda:', text.substring(0, 500));
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error('❌ No es JSON:', text);
        throw new Error('El servidor no devolvió JSON válido');
      }

      if (result && result.exito === true) {
        const newSpreadsheetId = result.spreadsheetId;
        const spreadsheetUrl = result.spreadsheetUrl;
        
        const configRef = ref(db, 'encuesta-config/config');
        await set(configRef, {
          googleScriptUrl: googleScriptUrl,
          spreadsheetUrl: spreadsheetUrl,
          spreadsheetId: newSpreadsheetId,
          nombreHoja: periodo,
          periodo: periodo,
          fechaActualizacion: new Date().toISOString()
        });

        setSpreadsheetId(newSpreadsheetId);
        setNombreHoja(periodo);
        setMensaje(`✅ ¡Hoja creada!\n📊 ${spreadsheetUrl}`);
        setPasoActual(3);
        
        setTimeout(() => {
          cargarConfiguracion();
        }, 2000);
      } else {
        throw new Error(result?.mensaje || result?.error || 'Error al crear la hoja');
      }

    } catch (error: any) {
      console.error('❌ Error:', error);
      setMensaje(`❌ Error: ${error.message}`);
    } finally {
      setCreando(false);
    }
  };

  // ============================================
  // PROCESAR EXCEL
  // ============================================

  const procesarExcel = (file: File) => {
    setPreviewData([]);
    setMensaje('');
    
    if (!file || file.size === 0) {
      setMensaje('❌ El archivo está vacío');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
      setMensaje('❌ Formato no válido. Usa .xlsx, .xls o .csv');
      return;
    }

    setMensaje(`🔄 Procesando "${file.name}"...`);

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const hojaData = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(hojaData);
        
        console.log('📄 Total de filas:', jsonData.length);
        
        if (jsonData.length > 0 && jsonData[0]) {
          const columnas = Object.keys(jsonData[0] as Record<string, any>);
          console.log('📋 Columnas encontradas:', columnas);
        }
        
        const estudiantes = jsonData
          .map((row: any) => ({
            correo: row['EMaiCrec']?.trim() || row['Correo']?.trim() || row['Email']?.trim() || '',
            nombre: `${row['Apellido'] || ''} ${row['Nombre'] || ''}`.trim() || row['Nombre'] || '',
            planEstudio: row['PlanEst'] || row['PlanEstudio'] || '',
            curso: row['Curso'] || '',
            seccion: row['Seccion'] || row['PEAD'] || '',
            docente: row['Docente'] || ''
          }))
          .filter(est => {
            const tieneCorreo = est.correo && est.correo.includes('@') && est.correo.length > 5;
            const tieneNombre = est.nombre && est.nombre.length > 0;
            return tieneCorreo && tieneNombre;
          });
        
        // Eliminar duplicados
        const uniqueEstudiantes = [];
        const emailsVistos = new Set();
        
        for (const est of estudiantes) {
          const emailLower = est.correo.toLowerCase();
          if (!emailsVistos.has(emailLower)) {
            emailsVistos.add(emailLower);
            uniqueEstudiantes.push(est);
          }
        }
        
        setPreviewData(uniqueEstudiantes);
        setMensaje(`📊 ${uniqueEstudiantes.length} registros válidos (de ${jsonData.length} filas totales)`);
        
      } catch (error: any) {
        console.error('❌ Error:', error);
        setMensaje(`❌ Error al procesar: ${error.message}`);
        setPreviewData([]);
      }
    };
    
    reader.onerror = () => {
      setMensaje('❌ Error al leer el archivo');
      setPreviewData([]);
    };
    
    reader.readAsArrayBuffer(file);
  };

  // ============================================
  // ACTUALIZAR BASE (DIRECTO A GAS - SIN PROXY)
  // ============================================

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
      const spreadsheetIdActual = spreadsheetId || configActual?.spreadsheetId;
      
      const payload = {
        accion: 'actualizarBase',
        spreadsheetId: spreadsheetIdActual,
        data: previewData
      };

      console.log('📤 Enviando a GAS:', googleScriptUrl);
      console.log('📦 Payload:', payload);

      const response = await fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      console.log('📥 Respuesta cruda:', text.substring(0, 500));
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error('❌ No es JSON:', text);
        throw new Error('El servidor no devolvió JSON válido');
      }

      if (result.exito) {
        setMensaje(`✅ ¡BaseUnificada actualizada! ${result.agregados || previewData.length} estudiantes registrados. Duplicados: ${result.duplicados || 0}`);
        setPreviewData([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setTimeout(() => cargarConfiguracion(), 1500);
      } else {
        throw new Error(result.mensaje || 'Error al actualizar');
      }

    } catch (error: any) {
      console.error('❌ Error:', error);
      setMensaje(`❌ Error: ${error.message}`);
    } finally {
      setSubiendoBase(false);
    }
  };

  // ============================================
  // PASO INDICATOR
  // ============================================

  const PasoIndicator = ({ numero, titulo, activo, completado, onClick }: any) => (
    <div 
      onClick={onClick}
      style={{ 
        flex: 1, 
        textAlign: 'center', 
        position: 'relative',
        cursor: completado ? 'pointer' : (activo ? 'default' : 'not-allowed'),
        opacity: completado ? 1 : (activo ? 1 : 0.5)
      }}
    >
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
        fontSize: '18px'
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
    </div>
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '30px',
          background: 'rgba(255,255,255,0.1)',
          padding: '15px 25px',
          borderRadius: '12px'
        }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '24px', margin: 0 }}>⚙️ Panel de Administración</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '5px 0 0' }}>
              {configActual?.periodo ? `Período activo: ${configActual.periodo}` : 'Configura el sistema'}
            </p>
          </div>
          
          <button
            onClick={cerrarSesion}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            🚪 Cerrar sesión
          </button>
        </div>

        {/* PASOS */}
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
            <PasoIndicator 
              numero={1} 
              titulo="Configurar URL" 
              activo={pasoActual === 1} 
              completado={configActual?.googleScriptUrl ? true : false}
              onClick={() => setPasoActual(1)}
            />
            <PasoIndicator 
              numero={2} 
              titulo="Crear hoja" 
              activo={pasoActual === 2} 
              completado={configActual?.spreadsheetUrl ? true : false}
              onClick={() => setPasoActual(2)}
            />
            <PasoIndicator 
              numero={3} 
              titulo="Cargar estudiantes" 
              activo={pasoActual === 3} 
              completado={false}
              onClick={() => setPasoActual(3)}
            />
          </div>
        </div>

        {/* CONTENIDO */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
          
          {/* PASO 1 */}
          {pasoActual === 1 && (
            <div>
              <h2 style={{ color: '#5a2290' }}>📝 Configurar URL del Apps Script</h2>
              <p style={{ color: '#666' }}>Necesitas desplegar tu Google Apps Script como aplicación web</p>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>URL del Apps Script</label>
                <input
                  type="text"
                  value={googleScriptUrl}
                  onChange={(e) => setGoogleScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/XXXX/exec"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Período</label>
                <input
                  type="text"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  placeholder="Ej: AGOSTO 2026"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <button
                onClick={guardarConfiguracion}
                disabled={loading || !googleScriptUrl.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: (loading || !googleScriptUrl.trim()) ? '#ccc' : '#5a2290',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: (loading || !googleScriptUrl.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '💾 Guardando...' : '💾 Guardar configuración'}
              </button>
            </div>
          )}

          {/* PASO 2 */}
          {pasoActual === 2 && (
            <div>
              <h2 style={{ color: '#5a2290' }}>🚀 Crear hoja de cálculo</h2>
              <p style={{ color: '#666' }}>
                Se creará una nueva hoja para el período <strong>{periodo || configActual?.periodo}</strong>
              </p>

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
                  marginTop: '20px'
                }}
              >
                {creando ? '🔄 Creando hoja...' : '📊 Crear hoja de cálculo'}
              </button>
            </div>
          )}

          {/* PASO 3 */}
          {pasoActual === 3 && (
            <div>
              <h2 style={{ color: '#5a2290' }}>👥 Cargar estudiantes</h2>
              <p style={{ color: '#666' }}>Sube un archivo Excel con el padrón de estudiantes</p>

              {configActual?.spreadsheetUrl && (
                <div style={{ 
                  background: '#e8f5e1', 
                  padding: '15px', 
                  borderRadius: '8px', 
                  marginBottom: '20px'
                }}>
                  <strong>✅ Hoja activa:</strong><br />
                  <a href={configActual.spreadsheetUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#5a2290' }}>
                    📊 Ver hoja de cálculo
                  </a><br />
                  <strong>Período:</strong> {configActual.periodo}<br />
                  <strong>ID:</strong> <code>{spreadsheetId || configActual?.spreadsheetId}</code>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) procesarExcel(file);
                  }}
                  style={{ display: 'block', width: '100%', padding: '10px' }}
                />
                <small style={{ color: '#666' }}>
                  ⚠️ El Excel debe tener columnas: <strong>EMaiCrec</strong>, Apellido, Nombre, Curso, Seccion, Docente
                </small>
              </div>

              {previewData.length > 0 && (
                <div>
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
                      <thead>
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

          {/* MENSAJE */}
          {mensaje && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              borderRadius: '8px',
              backgroundColor: mensaje.includes('✅') ? '#e8f5e1' : mensaje.includes('❌') ? '#fce8e6' : '#fff3e0',
              color: mensaje.includes('✅') ? '#1a5e20' : mensaje.includes('❌') ? '#c5221f' : '#856404',
              textAlign: 'center',
              whiteSpace: 'pre-line'
            }}>
              {mensaje}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
