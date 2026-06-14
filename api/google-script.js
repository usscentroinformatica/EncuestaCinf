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
      const { scriptUrl, action, periodo, email } = req.query;
      
      console.log('📥 Proxy Vercel - Parámetros:', { scriptUrl, action, periodo, email });
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Falta el parámetro scriptUrl' });
      }
      
      // Construir URL para Apps Script
      let targetUrl = scriptUrl;
      const params = [];
      
      if (action) params.push(`action=${encodeURIComponent(action)}`);
      if (periodo) params.push(`periodo=${encodeURIComponent(periodo)}`);
      if (email) params.push(`email=${encodeURIComponent(email)}`);
      
      if (params.length > 0) {
        targetUrl += `?${params.join('&')}`;
      }
      
      console.log('📤 Proxy Vercel - Llamando a:', targetUrl);
      
      const response = await fetch(targetUrl);
      const data = await response.json();
      
      console.log('📥 Proxy Vercel - Respuesta:', data);
      
      return res.status(200).json(data);
      
    } catch (error) {
      console.error('❌ Proxy Vercel - Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Manejar POST
  if (req.method === 'POST') {
    try {
      const { scriptUrl, ...bodyData } = req.body;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Falta el parámetro scriptUrl' });
      }
      
      console.log('📤 Proxy Vercel POST - URL:', scriptUrl);
      
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const data = await response.json();
      return res.status(200).json(data);
      
    } catch (error) {
      console.error('❌ Proxy Vercel POST - Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Método no permitido' });
}