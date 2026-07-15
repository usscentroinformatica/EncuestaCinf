// api/google-script.js
export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Manejar GET
  if (req.method === 'GET') {
    try {
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
      
    } catch (error) {
      console.error('❌ Error GET:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Manejar POST
  if (req.method === 'POST') {
    try {
      const { scriptUrl, spreadsheetId, action, data, ...bodyData } = req.body;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Falta scriptUrl' });
      }
      
      console.log('📤 POST recibido:', { scriptUrl, spreadsheetId, action });
      
      let targetUrl = scriptUrl;
      
      // Si hay spreadsheetId, pasarlo como parámetro
      if (spreadsheetId) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl += `${separator}spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      }
      
      // 🔥 CONSTRUIR PAYLOAD SEGÚN LA ACCIÓN
      let payload = {};
      
      switch (action) {
        case 'verificarEstudiante':
          payload = {
            accion: 'verificarEstudiante',
            usuario: bodyData.usuario || bodyData.email || ''
          };
          break;
          
        case 'guardarEncuesta':
          payload = {
            accion: 'guardarEncuesta',
            ...bodyData
          };
          break;
          
        case 'crearHojaCalculo':
          payload = {
            accion: 'crearHojaCalculo',
            nombre: bodyData.nombre || 'Encuesta ' + new Date().toLocaleDateString('es-ES'),
            titulo: bodyData.titulo || 'ENCUESTA DE SATISFACCIÓN DOCENTE',
            subtitulo: bodyData.subtitulo || '',
            hojaBase: bodyData.hojaBase || 'BaseUnificada',
            hojaRespuestas: bodyData.hojaRespuestas || 'Respuestas',
            preguntas: bodyData.preguntas || []
          };
          break;
          
        case 'actualizarBase':
          payload = {
            accion: 'actualizarBase',
            spreadsheetId: spreadsheetId,
            data: data || []
          };
          break;
          
        case 'testConexion':
          payload = {
            accion: 'testConexion'
          };
          break;
          
        default:
          // Si no se reconoce la acción, pasar todo como está
          payload = { accion: action, ...bodyData };
      }
      
      console.log('📤 Enviando a GAS:', targetUrl);
      console.log('📦 Payload:', JSON.stringify(payload).substring(0, 500));
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const text = await response.text();
      console.log('📥 Respuesta cruda de GAS:', text.substring(0, 500));
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error('❌ GAS no devolvió JSON:', text);
        return res.status(500).json({
          success: false,
          error: 'El servidor no devolvió JSON válido',
          raw: text.substring(0, 200)
        });
      }
      
      // 🔥 FORMATEAR RESPUESTA SEGÚN ACCIÓN
      if (action === 'actualizarBase') {
        return res.status(200).json({
          success: true,
          exito: result.exito || true,
          agregados: result.agregados || data?.length || 0,
          duplicados: result.duplicados || 0,
          mensaje: result.mensaje || 'Base actualizada',
          ...result
        });
      }
      
      if (action === 'verificarEstudiante') {
        return res.status(200).json({
          exito: result.exito || false,
          mensaje: result.mensaje || 'Usuario no encontrado',
          estudiante: result.estudiante || null,
          completado: result.completado || false
        });
      }
      
      return res.status(200).json(result);
      
    } catch (error) {
      console.error('❌ Error POST:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  }
  
  return res.status(405).json({ error: 'Método no permitido' });
}
