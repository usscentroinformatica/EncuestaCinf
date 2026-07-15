// api/google-script.js
export default async function handler(req, res) {
  // Configurar CORS para el frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir POST para acciones que modifican datos
  if (req.method === 'GET') {
    try {
      const { scriptUrl, action, email, spreadsheetId } = req.query;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Falta scriptUrl' });
      }
      
      let targetUrl = scriptUrl;
      const params = [];
      if (action) params.push(`accion=${encodeURIComponent(action)}`);
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { scriptUrl, action, ...datos } = req.body;
    
    console.log('📤 Proxy POST recibido:', { scriptUrl, action });
    
    if (!scriptUrl) {
      return res.status(400).json({ error: 'Falta scriptUrl' });
    }

    // Construir el payload para Google Apps Script
    let payload = {};
    
    if (action === 'crearHojaCalculo') {
      payload = {
        accion: 'crearHojaCalculo',
        nombre: datos.nombre || 'Encuesta ' + new Date().toLocaleDateString('es-ES'),
        titulo: datos.titulo || 'ENCUESTA DE SATISFACCIÓN DOCENTE',
        subtitulo: datos.subtitulo || '',
        hojaBase: datos.hojaBase || 'BaseUnificada',
        hojaRespuestas: datos.hojaRespuestas || 'Respuestas',
        preguntas: datos.preguntas || []
      };
    } else if (action === 'actualizarBase') {
      payload = {
        accion: 'actualizarBase',
        spreadsheetId: datos.spreadsheetId,
        data: datos.data || []
      };
    } else if (action === 'guardarEncuesta') {
      payload = {
        accion: 'guardarEncuesta',
        ...datos
      };
    } else if (action === 'verificarEstudiante') {
      payload = {
        accion: 'verificarEstudiante',
        usuario: datos.usuario || datos.email
      };
    } else {
      // Otras acciones
      payload = { accion: action, ...datos };
    }

    console.log('📤 Enviando a GAS:', scriptUrl);
    console.log('📦 Payload:', JSON.stringify(payload).substring(0, 500));

    // Hacer la petición a Google Apps Script
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log('📥 Respuesta cruda de GAS:', text.substring(0, 500));

    // Intentar parsear JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('❌ GAS no devolvió JSON válido:', text);
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
        exito: data.exito || true,
        agregados: data.agregados || datos.data?.length || 0,
        duplicados: data.duplicados || 0,
        mensaje: data.mensaje || 'Base actualizada',
        ...data
      });
    }

    if (action === 'crearHojaCalculo') {
      return res.status(200).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ Error en proxy:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
}
