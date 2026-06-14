// api/google-script.js
export default async function handler(req, res) {
  // Habilitar CORS
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
      
      // Construir la URL con los parámetros
      let url = scriptUrl;
      const params = [];
      
      if (req.query.email) {
        params.push(`email=${encodeURIComponent(req.query.email)}`);
      }
      if (req.query.action) {
        params.push(`action=${encodeURIComponent(req.query.action)}`);
      }
      if (req.query.periodo) {
        params.push(`periodo=${encodeURIComponent(req.query.periodo)}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      console.log('📤 GET a:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      console.log('📥 Respuesta:', data);
      
      return res.status(200).json(data);
    }

    // POST para enviar formulario o actualizar Base
    if (req.method === 'POST') {
      const { scriptUrl, ...bodyData } = req.body;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'No se proporcionó URL del script' });
      }
      
      console.log('📤 POST a:', scriptUrl);
      console.log('📦 Datos:', bodyData);
      
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const result = await response.json();
      console.log('📥 Respuesta:', result);
      
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('❌ Error en proxy:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}