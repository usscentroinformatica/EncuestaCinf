// api/google-script.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET para login o crear hoja
    if (req.method === 'GET') {
      const scriptUrl = req.query.scriptUrl;
      if (!scriptUrl) {
        return res.status(400).json({ error: 'No se proporcionó URL del script' });
      }
      
      let url = scriptUrl;
      if (req.query.email) {
        url += `?email=${encodeURIComponent(req.query.email)}`;
      }
      if (req.query.action) {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}action=${encodeURIComponent(req.query.action)}&periodo=${encodeURIComponent(req.query.periodo || '')}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // POST para enviar formulario o actualizar BaseUnificada
    if (req.method === 'POST') {
      const { scriptUrl, action, data, ...bodyData } = req.body;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'No se proporcionó URL del script' });
      }
      
      // Si es acción de actualizar BaseUnificada
      if (action === 'actualizarBase') {
        const response = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'actualizarBase', data: data })
        });
        const result = await response.json();
        return res.status(200).json(result);
      }
      
      // Si es envío normal de encuesta
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const result = await response.json();
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('❌ Error en proxy:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}