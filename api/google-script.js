// api/google-script.js
export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Manejar GET (login, crear hoja)
  if (req.method === 'GET') {
    const { scriptUrl, action, periodo, email } = req.query;
    
    console.log('🔍 Proxy - Parámetros recibidos:', { scriptUrl, action, periodo, email });
    
    if (!scriptUrl) {
      return res.status(400).json({ error: 'Falta scriptUrl' });
    }
    
    // Construir la URL destino
    let targetUrl = scriptUrl;
    const params = [];
    
    if (action) params.push(`action=${encodeURIComponent(action)}`);
    if (periodo) params.push(`periodo=${encodeURIComponent(periodo)}`);
    if (email) params.push(`email=${encodeURIComponent(email)}`);
    
    if (params.length > 0) {
      targetUrl += `?${params.join('&')}`;
    }
    
    console.log('🔍 Proxy - Llamando a:', targetUrl);
    
    try {
      const response = await fetch(targetUrl);
      const data = await response.json();
      console.log('🔍 Proxy - Respuesta:', data);
      return res.status(200).json(data);
    } catch (error) {
      console.error('❌ Proxy - Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Manejar POST (guardar encuesta, actualizar base)
  if (req.method === 'POST') {
    const { scriptUrl, ...bodyData } = req.body;
    
    if (!scriptUrl) {
      return res.status(400).json({ error: 'Falta scriptUrl' });
    }
    
    console.log('🔍 Proxy POST - URL:', scriptUrl);
    console.log('🔍 Proxy POST - Body:', bodyData);
    
    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const data = await response.json();
      console.log('🔍 Proxy POST - Respuesta:', data);
      return res.status(200).json(data);
    } catch (error) {
      console.error('❌ Proxy POST - Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Método no permitido' });
}