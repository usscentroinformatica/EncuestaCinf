// api/google-script.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Manejar GET
  if (req.method === 'GET') {
    try {
      const { scriptUrl, action, periodo, email } = req.query;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Falta scriptUrl' });
      }
      
      let targetUrl = scriptUrl;
      const params = [];
      if (action) params.push(`accion=${encodeURIComponent(action)}`);
      if (periodo) params.push(`periodo=${encodeURIComponent(periodo)}`);
      if (email) params.push(`usuario=${encodeURIComponent(email)}`);
      
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
      
      // 🔥 NUEVO: Manejar acción 'actualizarBase'
      if (action === 'actualizarBase') {
        console.log('📤 Actualizando base con', data?.length || 0, 'registros');
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'actualizarBase',
            data: data || []
          })
        });
        
        const result = await response.json();
        console.log('📥 Respuesta actualizarBase:', result);
        
        return res.status(200).json({
          success: true,
          agregados: data?.length || 0,
          mensaje: 'Base actualizada correctamente',
          ...result
        });
      }
      
      // 🔥 NUEVO: Manejar acción 'crearHojaCalculo'
      if (action === 'crearHojaCalculo') {
        console.log('📤 Creando hoja de cálculo');
        console.log('📦 Datos recibidos:', bodyData);
        
        // Construir el payload para Google Apps Script
        const payload = {
          accion: 'crearHojaCalculo',
          nombre: bodyData.nombre || 'Encuesta ' + new Date().toLocaleDateString('es-ES'),
          titulo: bodyData.titulo || 'ENCUESTA DE SATISFACCIÓN DOCENTE',
          subtitulo: bodyData.subtitulo || '',
          hojaBase: bodyData.hojaBase || 'BaseUnificada',
          hojaRespuestas: bodyData.hojaRespuestas || 'Respuestas',
          preguntas: bodyData.preguntas || []
        };
        
        console.log('📦 Payload para GAS:', payload);
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        console.log('📥 Respuesta crearHoja:', result);
        
        return res.status(200).json(result);
      }
      
      // 🔥 Manejar otras acciones (guardarEncuesta, etc.)
      console.log('📤 POST llamando a:', targetUrl);
      console.log('📦 Datos:', bodyData);
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const data = await response.json();
      console.log('📥 Respuesta POST:', data);
      
      return res.status(200).json(data);
      
    } catch (error) {
      console.error('❌ Error POST:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Método no permitido' });
}
