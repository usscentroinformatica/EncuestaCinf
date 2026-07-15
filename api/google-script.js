// api/google-script.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
      
      const response = await fetch(targetUrl);
      const data = await response.json();
      
      return res.status(200).json(data);
      
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { scriptUrl, action, ...datos } = req.body;
    
    if (!scriptUrl) {
      return res.status(400).json({ error: 'Falta scriptUrl' });
    }

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
    } else {
      payload = { accion: action, ...datos };
    }

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: 'El servidor no devolvió JSON válido',
        raw: text.substring(0, 200)
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
}
