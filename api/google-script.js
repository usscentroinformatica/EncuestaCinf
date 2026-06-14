// api/google-script.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { scriptUrl, action, periodo, email } = req.query;
      
      console.log('📥 Parámetros GET recibidos:', { scriptUrl, action, periodo, email });
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'No se proporcionó URL del script' });
      }
      
      let targetUrl = scriptUrl;
      const params = [];
      
      if (email) params.push(`email=${encodeURIComponent(email)}`);
      if (action) params.push(`action=${encodeURIComponent(action)}`);
      if (periodo) params.push(`periodo=${encodeURIComponent(periodo)}`);
      
      if (params.length > 0) {
        targetUrl += `?${params.join('&')}`;
      }
      
      console.log('📤 Redirigiendo a:', targetUrl);
      
      const response = await fetch(targetUrl);
      const data = await response.json();
      console.log('📥 Respuesta:', data);
      
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { scriptUrl, ...bodyData } = req.body;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'No se proporcionó URL del script' });
      }
      
      console.log('📤 POST a:', scriptUrl);
      
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