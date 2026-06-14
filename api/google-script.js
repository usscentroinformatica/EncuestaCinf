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
      if (action) params.push(`action=${encodeURIComponent(action)}`);
      if (periodo) params.push(`periodo=${encodeURIComponent(periodo)}`);
      if (email) params.push(`email=${encodeURIComponent(email)}`);
      
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
      const { scriptUrl, spreadsheetUrl, ...bodyData } = req.body;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Falta scriptUrl' });
      }
      
      // 🔴 Si se proporciona una spreadsheetUrl, añadirla a la petición
      let targetUrl = scriptUrl;
      
      console.log('📤 POST llamando a:', targetUrl);
      console.log('📦 Spreadsheet objetivo:', spreadsheetUrl);
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bodyData, spreadsheetUrl })
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