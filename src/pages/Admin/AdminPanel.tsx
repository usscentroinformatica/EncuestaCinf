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
      }
    } catch (error) {
      console.error('Error cargando:', error);
    }
  };

  // Función para leer el Excel y extraer los datos
  const procesarExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const primeraHoja = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(primeraHoja);
      
      // Mapear los datos a la estructura que necesitamos
      const estudiantes = jsonData.map((row: any) => ({
        correo: row['EMail1'] || row['EMail2'] || row['EMaiCrec'] || '',
        nombre: `${row['Apellido'] || ''} ${row['Nombre'] || ''}`.trim(),
        planEstudio: row['PlanEst'] || '',
        curso: row['Curso'] || '',
        seccion: row['Seccion'] || '',
        docente: row['Docente'] || '',
        turno: row['Turno'] || '',
        dias: row['Días'] || '',
        horaInicio: row['Hora inicio'] || '',
        horaFin: row['Hora fin'] || ''
      }));
      
      // Filtrar estudiantes sin correo válido
      const validos = estudiantes.filter(e => e.correo && e.correo.includes('@'));
      
      setPreviewData(validos);
      setMensaje(`📊 Se encontraron ${validos.length} registros válidos de ${jsonData.length} totales`);
    };
    reader.readAsArrayBuffer(file);
  };

  // Función para subir la base de datos actualizada al script
  const actualizarBaseUnificada = async () => {
    if (!googleScriptUrl) {
      setMensaje('❌ Primero guarda la URL del script');
      return;
    }
    
    if (previewData.length === 0) {
      setMensaje('❌ No hay datos para subir. Primero carga un archivo Excel');
      return;
    }

    setSubiendoBase(true);
    setMensaje('🔄 Actualizando BaseUnificada...');

    try {
      const PROXY_URL = '/api/google-script';
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl: googleScriptUrl,
          action: 'actualizarBase',
          data: previewData
        })
      });

      const result = await response.json();
      console.log('📥 Resultado:', result);

      if (result.success) {
        setMensaje(`✅ BaseUnificada actualizada exitosamente. ${result.actualizados} registros procesados.`);
        setPreviewData([]);
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

  const crearNuevaHojaAutomatico = async () => {
    if (!periodo.trim()) {
      setMensaje('❌ Ingresa el nombre del período primero (ej: AGOSTO 2026)');
      return;
    }

    setCreando(true);
    setMensaje('🔄 Creando nueva hoja...');

    try {
      const PROXY_URL = '/api/google-script';
      const response = await fetch(`${PROXY_URL}?scriptUrl=${encodeURIComponent(googleScriptUrl)}&action=crearHoja&periodo=${encodeURIComponent(periodo)}`);
      const result = await response.json();

      if (result.success) {
        const configRef = ref(db, 'encuesta-config/config');
        await set(configRef, {
          googleScriptUrl: result.scriptUrl,
          spreadsheetUrl: result.spreadsheetUrl,
          periodo: periodo,
          fechaActualizacion: new Date().toISOString()
        });

        setMensaje(`✅ ¡Éxito! Hoja creada:\n📊 ${result.spreadsheetUrl}`);
        
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        throw new Error(result.error || 'Error al crear la hoja');
      }

    } catch (error: any) {
      setMensaje(`❌ Error: ${error.message}`);
    } finally {
      setCreando(false);
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

      setMensaje('✅ Configuración guardada exitosamente');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: any) {
      setMensaje('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#5a2290' }}>⚙️ Panel de Administración</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>Configuración y gestión de encuestas docentes</p>

        {configActual && (
          <div style={{ background: '#e8f5e1', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <p><strong>📊 Configuración actual:</strong></p>
            <p>📅 Período: <strong>{configActual.periodo}</strong></p>
            <p>🕐 Actualizado: {new Date(configActual.fechaActualizacion).toLocaleString()}</p>
            {configActual.spreadsheetUrl && (
              <p>📎 Hoja activa: <a href={configActual.spreadsheetUrl} target="_blank" rel="noopener noreferrer">Ver hoja</a></p>
            )}
          </div>
        )}

        {/* SECCIÓN: SUBIR EXCEL PARA ACTUALIZAR BASEUNIFICADA */}
        <div style={{ 
          background: '#f0f7ff', 
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '25px',
          border: '2px solid #5a2290'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#5a2290' }}>📤 1. Actualizar Base de Datos de Estudiantes</h3>
          <p style={{ fontSize: '14px', marginBottom: '15px', color: '#666' }}>
            Sube un archivo Excel con el padrón de estudiantes para actualizar la BaseUnificada.
            <br/>El sistema extraerá automáticamente: Correo, Nombre, PlanEstudio, Curso, Sección (PEAD) y Docente.
          </p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '15px' }}>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  procesarExcel(file);
                }
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
              disabled={subiendoBase || previewData.length === 0 || !googleScriptUrl}
              style={{
                padding: '12px 24px',
                background: (subiendoBase || previewData.length === 0 || !googleScriptUrl) ? '#ccc' : '#5a2290',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: (subiendoBase || previewData.length === 0 || !googleScriptUrl) ? 'not-allowed' : 'pointer'
              }}
            >
              {subiendoBase ? '📤 Actualizando...' : '📤 Actualizar BaseUnificada'}
            </button>
          </div>

          {previewData.length > 0 && (
            <div style={{ marginTop: '15px', maxHeight: '300px', overflow: 'auto', fontSize: '12px' }}>
              <p><strong>Vista previa de los primeros 10 registros:</strong></p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Correo</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Nombre</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>PlanEstudio</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Curso</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Sección</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Docente</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 10).map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.correo}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nombre}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.planEstudio}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.curso}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.seccion}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.docente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 10 && (
                <p style={{ marginTop: '10px', color: '#666' }}>... y {previewData.length - 10} registros más</p>
              )}
            </div>
          )}
          
          <small style={{ display: 'block', marginTop: '10px', color: '#666' }}>
            ⚡ El Excel debe contener columnas como: Apellido, Nombre, PlanEst, Curso, Seccion, Docente, EMail1
          </small>
        </div>

        {/* SECCIÓN: CREAR NUEVA HOJA */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '25px',
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>🚀 2. Crear nueva hoja para nuevo período</h3>
          <p style={{ fontSize: '14px', marginBottom: '15px', opacity: 0.9 }}>
            Crea una copia limpia de la hoja actual para un nuevo período académico
          </p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="Ej: AGOSTO 2026"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px'
              }}
            />
            <button
              onClick={crearNuevaHojaAutomatico}
              disabled={creando || !periodo.trim() || !googleScriptUrl}
              style={{
                padding: '12px 24px',
                background: creando ? '#ccc' : '#63ed12',
                color: creando ? '#666' : '#1a5e20',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: (creando || !periodo.trim() || !googleScriptUrl) ? 'not-allowed' : 'pointer'
              }}
            >
              {creando ? '🔄 Creando...' : '✨ Crear nueva hoja'}
            </button>
          </div>
        </div>

        {/* SECCIÓN: CONFIGURACIÓN MANUAL */}
        <div style={{ borderTop: '1px solid #e0e0e0', margin: '20px 0', paddingTop: '20px' }}>
          <h3>🔧 3. Configuración manual</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>🔗 URL del Google Apps Script</label>
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
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>📅 Período actual</label>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="Ej: JULIO 2026"
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
            {loading ? '💾 Guardando...' : '💾 Guardar configuración'}
          </button>
        </div>

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