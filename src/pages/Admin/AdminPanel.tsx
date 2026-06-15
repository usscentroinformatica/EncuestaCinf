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
        // Extraer el spreadsheetId de la URL
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

  // 🔴 CORREGIDO: Lee específicamente la hoja "data" del Excel
  const procesarExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // 🔴 Buscar específicamente la hoja "data"
      let sheetName = 'data';
      if (!workbook.SheetNames.includes(sheetName)) {
        // Si no existe "data", usar la primera hoja
        sheetName = workbook.SheetNames[0];
        setMensaje(`⚠️ No se encontró hoja "data", usando "${sheetName}"`);
      }
      
      const hojaData = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(hojaData);
      
      console.log(`📊 Leyendo hoja: ${sheetName}, Filas: ${jsonData.length}`);
      
      const estudiantes = jsonData
        .map((row: any) => ({
          correo: row['EMail1'] || row['EMail2'] || row['EMaiCrec'] || '',
          nombre: `${row['Apellido'] || ''} ${row['Nombre'] || ''}`.trim(),
          planEstudio: row['PlanEst'] || '',
          curso: row['Curso'] || '',
          seccion: row['Seccion'] || '',
          docente: row['Docente'] || ''
        }))
        .filter(est => {
          const tieneCorreo = est.correo && est.correo.includes('@');
          const tieneNombre = est.nombre && est.nombre.length > 0;
          const tieneCurso = est.curso && est.curso.length > 0;
          return tieneCorreo && tieneNombre && tieneCurso;
        });
      
      // Eliminar duplicados por correo
      const uniqueEstudiantes = [];
      const emailsVistos = new Set();
      
      for (const est of estudiantes) {
        if (!emailsVistos.has(est.correo)) {
          emailsVistos.add(est.correo);
          uniqueEstudiantes.push(est);
        }
      }
      
      console.log(`📊 Originales: ${jsonData.length}, Válidos: ${estudiantes.length}, Únicos: ${uniqueEstudiantes.length}`);
      
      setPreviewData(uniqueEstudiantes);
      setMensaje(`📊 Hoja "${sheetName}": ${uniqueEstudiantes.length} registros válidos (de ${jsonData.length} totales)`);
    };
    reader.readAsArrayBuffer(file);
  };

  // 🔴 CORREGIDO: Envía el spreadsheetId para que guarde en la hoja correcta
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

    const activeSpreadsheetId = spreadsheetId || configActual?.spreadsheetId;
    const activeSpreadsheetUrl = configActual?.spreadsheetUrl;

    setSubiendoBase(true);
    setMensaje(`🔄 Actualizando ${previewData.length} estudiantes en la hoja activa...`);

    try {
      const PROXY_URL = '/api/google-script';
      
      // 🔴 Enviar el spreadsheetId para que el script sepa exactamente qué hoja usar
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl: googleScriptUrl,
          spreadsheetId: activeSpreadsheetId,
          action: 'actualizarBase',
          data: previewData
        })
      });

      const result = await response.json();

      if (result.success) {
        setMensaje(`✅ ¡BaseUnificada actualizada! ${result.agregados || previewData.length} estudiantes registrados.\n📎 Hoja: ${activeSpreadsheetUrl?.substring(0, 60)}...`);
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

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#5a2290' }}>⚙️ Panel de Administración</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>Sigue los pasos en orden para configurar el sistema</p>

        <div style={{ display: 'flex', marginBottom: '30px', gap: '10px' }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: pasoActual >= 1 ? '#5a2290' : '#e0e0e0', color: pasoActual >= 1 ? 'white' : '#666', borderRadius: '8px' }}>
            📝 Paso 1: Configurar URL
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: pasoActual >= 2 ? '#5a2290' : '#e0e0e0', color: pasoActual >= 2 ? 'white' : '#666', borderRadius: '8px' }}>
            📊 Paso 2: Crear hoja
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: pasoActual >= 3 ? '#5a2290' : '#e0e0e0', color: pasoActual >= 3 ? 'white' : '#666', borderRadius: '8px' }}>
            👥 Paso 3: Subir estudiantes
          </div>
        </div>

        {configActual && configActual.spreadsheetUrl && (
          <div style={{ background: '#e8f5e1', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <p><strong>📊 Estado actual:</strong></p>
            <p>📅 Período: <strong>{configActual.periodo}</strong></p>
            <p>📎 Hoja activa: <a href={configActual.spreadsheetUrl} target="_blank" rel="noopener noreferrer">Ver hoja de cálculo</a></p>
            <p>🆔 ID de la hoja: <code>{spreadsheetId || configActual?.spreadsheetId}</code></p>
          </div>
        )}

        {/* PASO 1 */}
        <div style={{ 
          background: pasoActual === 1 ? '#f0f7ff' : '#f9f9f9', 
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '25px',
          border: pasoActual === 1 ? '2px solid #5a2290' : '1px solid #e0e0e0'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#5a2290' }}>📝 Paso 1: Configurar URL del Apps Script</h3>
          <p style={{ fontSize: '14px', marginBottom: '15px', color: '#666' }}>
            Primero, necesitas la URL de tu Google Apps Script (debes desplegarlo como aplicación web)
          </p>
          
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              value={googleScriptUrl}
              onChange={(e) => setGoogleScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/XXXX/exec"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
            <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
              📌 La URL debe terminar en <strong>/exec</strong>
            </small>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="Ej: AGOSTO 2026"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <button
            onClick={guardarConfiguracion}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: '#5a2290',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '💾 Guardando...' : '💾 Guardar configuración y continuar'}
          </button>
        </div>

        {/* PASO 2 */}
        {pasoActual >= 2 && (
          <div style={{ 
            background: pasoActual === 2 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f9f9f9', 
            padding: '20px', 
            borderRadius: '12px', 
            marginBottom: '25px',
            color: pasoActual === 2 ? 'white' : '#333'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: pasoActual === 2 ? 'white' : '#5a2290' }}>🚀 Paso 2: Crear hoja de cálculo</h3>
            <p style={{ fontSize: '14px', marginBottom: '15px', opacity: pasoActual === 2 ? 0.9 : 0.7 }}>
              Crea una nueva hoja de cálculo limpia para el período <strong>{periodo || 'actual'}</strong>
            </p>
            
            <button
              onClick={crearNuevaHoja}
              disabled={creando || !periodo.trim() || !googleScriptUrl}
              style={{
                width: '100%',
                padding: '14px',
                background: creando ? '#ccc' : (pasoActual === 2 ? '#63ed12' : '#5a2290'),
                color: creando ? '#666' : (pasoActual === 2 ? '#1a5e20' : 'white'),
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '16px',
                cursor: (creando || !periodo.trim() || !googleScriptUrl) ? 'not-allowed' : 'pointer'
              }}
            >
              {creando ? '🔄 Creando hoja...' : '📊 Crear hoja de cálculo'}
            </button>
          </div>
        )}

        {/* PASO 3 */}
        {pasoActual >= 3 && (
          <div style={{ 
            background: '#f0f7ff', 
            padding: '20px', 
            borderRadius: '12px', 
            marginBottom: '25px',
            border: '2px solid #5a2290'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#5a2290' }}>👥 Paso 3: Cargar estudiantes a BaseUnificada</h3>
            <p style={{ fontSize: '14px', marginBottom: '15px', color: '#666' }}>
              Sube un archivo Excel con el padrón de estudiantes.
              <br/>⚠️ El Excel debe tener una hoja llamada <strong>"data"</strong> (el sistema la buscará automáticamente).
              <br/>📎 Los datos se guardarán en: <strong>{configActual?.spreadsheetUrl?.substring(0, 50)}...</strong>
            </p>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) procesarExcel(file);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
              />
              <button
                onClick={actualizarBaseUnificada}
                disabled={subiendoBase || previewData.length === 0}
                style={{
                  padding: '12px 24px',
                  background: (subiendoBase || previewData.length === 0) ? '#ccc' : '#5a2290',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: (subiendoBase || previewData.length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {subiendoBase ? '📤 Subiendo...' : '📤 Actualizar BaseUnificada'}
              </button>
            </div>

            {previewData.length > 0 && (
              <div style={{ marginTop: '15px', maxHeight: '300px', overflow: 'auto', fontSize: '12px' }}>
                <p><strong>Vista previa ({previewData.length} registros):</strong></p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#5a2290', color: 'white' }}>
                      <th style={{ padding: '8px' }}>Correo</th>
                      <th style={{ padding: '8px' }}>Nombre</th>
                      <th style={{ padding: '8px' }}>Curso</th>
                      <th style={{ padding: '8px' }}>Sección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 10).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '8px' }}>{item.correo?.substring(0, 30)}</td>
                        <td style={{ padding: '8px' }}>{item.nombre?.substring(0, 30)}</td>
                        <td style={{ padding: '8px' }}>{item.curso}</td>
                        <td style={{ padding: '8px' }}>{item.seccion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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
  );
};

export default AdminPanel;