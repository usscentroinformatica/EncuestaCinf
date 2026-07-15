// api/google-script.js
export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Manejar GET
    if (req.method === 'GET') {
      const { scriptUrl, action, periodo, email, spreadsheetId } = req.query;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Falta scriptUrl' });
      }
      
      let targetUrl = scriptUrl;
      const params = [];
      if (action) params.push(`accion=${encodeURIComponent(action)}`);
      if (periodo) params.push(`periodo=${encodeURIComponent(periodo)}`);
      if (email) params.push(`usuario=${encodeURIComponent(email)}`);
      if (spreadsheetId) params.push(`spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
      
      if (params.length > 0) {
        targetUrl += `?${params.join('&')}`;
      }
      
      console.log('📤 GET llamando a:', targetUrl);
      
      const response = await fetch(targetUrl);
      const data = await response.json();
      
      return res.status(200).json(data);
    }
    
    // Manejar POST
    if (req.method === 'POST') {
      const { scriptUrl, spreadsheetId, action, data, ...bodyData } = req.body;
      
      console.log('📤 POST recibido:', { scriptUrl, spreadsheetId, action });
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Falta scriptUrl' });
      }
      
      // Si es una acción que maneja el proxy directamente
      if (action === 'testConexion') {
        return res.status(200).json({ 
          success: true, 
          mensaje: 'Proxy funcionando correctamente',
          timestamp: new Date().toISOString()
        });
      }
      
      // Construir payload para Google Apps Script
      let payload = {};
      
      if (action === 'actualizarBase') {
        payload = {
          accion: 'actualizarBase',
          spreadsheetId: spreadsheetId,
          data: data || []
        };
      } else if (action === 'crearHojaCalculo') {
        payload = {
          accion: 'crearHojaCalculo',
          nombre: bodyData.nombre || 'Encuesta ' + new Date().toLocaleDateString('es-ES'),
          titulo: bodyData.titulo || 'ENCUESTA DE SATISFACCIÓN DOCENTE',
          subtitulo: bodyData.subtitulo || '',
          hojaBase: bodyData.hojaBase || 'BaseUnificada',
          hojaRespuestas: bodyData.hojaRespuestas || 'Respuestas',
          preguntas: bodyData.preguntas || []
        };
      } else {
        // Otras acciones (guardarEncuesta, verificarEstudiante, etc.)
        payload = bodyData;
        // Asegurar que tenga accion
        if (!payload.accion && action) {
          payload.accion = action;
        }
      }
      
      // Construir URL final
      let targetUrl = scriptUrl;
      if (spreadsheetId && !action?.includes('actualizarBase')) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl += `${separator}spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      }
      
      console.log('📤 Enviando a GAS:', targetUrl);
      console.log('📦 Payload:', JSON.stringify(payload).substring(0, 300));
      
      // Hacer la petición a Google Apps Script
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const text = await response.text();
      console.log('📥 Respuesta cruda de GAS:', text.substring(0, 500));
      
      // Intentar parsear JSON
      let dataResult;
      try {
        dataResult = JSON.parse(text);
      } catch (e) {
        console.error('❌ GAS no devolvió JSON:', text);
        return res.status(500).json({ 
          success: false, 
          error: 'El servidor no devolvió JSON válido',
          raw: text.substring(0, 200)
        });
      }
      
      // Formatear respuesta según acción
      if (action === 'actualizarBase') {
        return res.status(200).json({
          success: true,
          agregados: dataResult.agregados || data?.length || 0,
          duplicados: dataResult.duplicados || 0,
          mensaje: dataResult.mensaje || 'Base actualizada',
          ...dataResult
        });
      }
      
      if (action === 'crearHojaCalculo') {
        return res.status(200).json(dataResult);
      }
      
      return res.status(200).json(dataResult);
    }
    
    return res.status(405).json({ error: 'Método no permitido' });
    
  } catch (error) {
    console.error('❌ Error en handler:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor'
    });
  }
}
