import { db } from '../firebase/config';
import { ref, get } from 'firebase/database';

// Verificar si un email es administrador
export const esAdmin = async (email: string): Promise<boolean> => {
  try {
    const adminsRef = ref(db, 'encuesta-config/admins');
    const snapshot = await get(adminsRef);
    
    if (snapshot.exists()) {
      const admins = snapshot.val();
      // Buscar si el email existe como valor en el objeto admins
      for (const key in admins) {
        if (admins[key] === email.toLowerCase()) {
          console.log('✅ Admin encontrado:', email);
          return true;
        }
      }
    }
    console.log('❌ No es admin:', email);
    return false;
  } catch (error) {
    console.error('Error verificando admin:', error);
    return false;
  }
};

// Obtener la URL del Google Apps Script desde Firebase
export const getGoogleScriptUrl = async (): Promise<string> => {
  try {
    const configRef = ref(db, 'encuesta-config/config');
    const snapshot = await get(configRef);
    
    if (snapshot.exists()) {
      const config = snapshot.val();
      return config.googleScriptUrl || "";
    }
    return "";
  } catch (error) {
    console.error('Error cargando config:', error);
    return "";
  }
};

// 🔴 NUEVA FUNCIÓN: Obtener configuración completa (URL + spreadsheetId)
export const getConfigCompleta = async (): Promise<{ scriptUrl: string; spreadsheetId: string }> => {
  try {
    const configRef = ref(db, 'encuesta-config/config');
    const snapshot = await get(configRef);
    
    if (snapshot.exists()) {
      const config = snapshot.val();
      console.log('📦 Config completa cargada:', {
        scriptUrl: config.googleScriptUrl ? '✅' : '❌',
        spreadsheetId: config.spreadsheetId ? '✅' : '❌'
      });
      return {
        scriptUrl: config.googleScriptUrl || "",
        spreadsheetId: config.spreadsheetId || ""
      };
    }
    console.error('❌ No hay configuración en Firebase');
    return { scriptUrl: "", spreadsheetId: "" };
  } catch (error) {
    console.error('Error cargando config completa:', error);
    return { scriptUrl: "", spreadsheetId: "" };
  }
};
