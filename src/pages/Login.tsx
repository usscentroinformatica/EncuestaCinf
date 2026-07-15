import { useState, useEffect } from 'react'
import logoUss from '../assets/uss.png'
import { esAdmin, getConfigCompleta, getPeriodoActual } from '../services/authService'

// ✅ Eliminamos la interfaz Curso que no se usa

export default function Login() {
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // ✅ Eliminamos 'dominioEncontrado' porque no se usa
  const [periodoActual, setPeriodoActual] = useState('Cargando...')

  useEffect(() => {
    const cargarPeriodo = async () => {
      try {
        const periodo = await getPeriodoActual();
        setPeriodoActual(periodo);
        console.log('📅 Período cargado:', periodo);
      } catch (error) {
        console.error('Error cargando período:', error);
        setPeriodoActual('PERIODO NO CONFIGURADO');
      }
    };
    cargarPeriodo();
  }, []);

  const ingresar = async () => {
    if (!nombreUsuario.trim()) {
      setError('Ingresa tu usuario')
      return
    }

    setLoading(true)
    setError('')

    try {
      const nombreUsuarioLimpio = nombreUsuario.toLowerCase().trim()
      
      const config = await getConfigCompleta()
      
      if (!config.scriptUrl) {
        setError('Error de configuración. Contacta al administrador.')
        setLoading(false)
        return
      }
      
      // PRIMERO: Verificar si es ADMINISTRADOR
      const emailAdmin = `${nombreUsuarioLimpio}@uss.edu.pe`
      const esAdministrador = await esAdmin(emailAdmin)
      
      if (esAdministrador) {
        console.log('👑 Usuario administrador detectado:', emailAdmin)
        localStorage.setItem('isAdmin', 'true')
        localStorage.setItem('adminEmail', emailAdmin)
        window.location.href = '/admin'
        setLoading(false)
        return
      }
      
      // SEGUNDO: Verificar que existe spreadsheetId para estudiantes
      if (!config.spreadsheetId) {
        setError('⚠️ La hoja de cálculo no está configurada. Contacta al administrador.')
        setLoading(false)
        return
      }
      
      // TERCERO: Buscar como ESTUDIANTE usando el PROXY
      console.log('🔍 Buscando estudiante:', nombreUsuarioLimpio)
      
      const response = await fetch('/api/google-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scriptUrl: config.scriptUrl,
          spreadsheetId: config.spreadsheetId,
          action: 'verificarEstudiante',
          usuario: nombreUsuarioLimpio
        })
      })

      const data = await response.json()
      console.log('📥 Respuesta del proxy:', data)

      if (data.exito === true && data.estudiante) {
        const estudiante = data.estudiante
        
        // Verificar si ya completó la encuesta
        if (estudiante.estado === 'Respondido') {
          setError('🎉 Ya has completado esta encuesta. ¡Gracias!')
          setLoading(false)
          return
        }
        
        // Guardar datos del estudiante
        const cursos = [{
          nombre: estudiante.nombre || 'Estudiante',
          curso: estudiante.curso || '',
          pead: estudiante.pead || '',
          docente: estudiante.docente || '',
          completado: estudiante.estado === 'Respondido',
          planEstudio: estudiante.planEstudio || ''
        }]
        
        const datosAGuardar = {
          email: estudiante.correo,
          cursos: cursos,
          spreadsheetId: config.spreadsheetId,
          dominioUsado: '@uss.edu.pe'
        }
        
        localStorage.setItem('eval_data', JSON.stringify(datosAGuardar))
        console.log('💾 Datos guardados:', datosAGuardar)
        
        window.location.href = '/formulario'
        
      } else {
        const mensaje = data.mensaje || 'Usuario no encontrado. Verifica que estés registrado.'
        setError(`❌ ${mensaje}`)
        setLoading(false)
        return
      }
      
    } catch (error: unknown) {
      console.error('❌ Error:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          setError('🔌 No se pudo conectar con el servidor. Verifica tu conexión a internet.')
        } else if (error.message.includes('Unexpected token')) {
          setError('❌ Error de conexión con el servidor. Intenta más tarde.')
        } else {
          setError(`⚠️ Error: ${error.message}`)
        }
      } else {
        setError('❌ Error desconocido. Intenta más tarde.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Roboto, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '6px solid #63ed12',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '680px',
          margin: '0 auto',
          padding: '30px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}>
          <img
            src={logoUss}
            alt="Universidad Señor de Sipán"
            style={{
              width: '200px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>
      </header>

      <main style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 20px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 6px rgba(32,33,36,0.28)',
          overflow: 'hidden'
        }}>
          <div style={{
            backgroundColor: '#5a2290',
            color: 'white',
            padding: '32px 48px',
            textAlign: 'center'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '400'
            }}>
              ENCUESTA DE SATISFACCIÓN DOCENTE
            </h2>
            <div style={{
              marginTop: '12px',
              fontSize: '16px',
              fontWeight: '500',
              color: periodoActual === 'PERIODO NO CONFIGURADO' ? '#ff6b6b' : 'white'
            }}>
              {periodoActual}
            </div>
            {periodoActual === 'PERIODO NO CONFIGURADO' && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#ffd93d',
                fontWeight: '400'
              }}>
                ⚠️ Contacta al administrador para configurar el período
              </div>
            )}
            <div style={{
              marginTop: '8px',
              fontSize: '14px',
              opacity: 0.9
            }}>
              Tu participación es anónima y confidencial.
            </div>
          </div>

          <div style={{ padding: '32px 48px' }}>
            <div style={{
              border: '1px solid #dadce0',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '32px',
              backgroundColor: '#fafafa'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#202124',
                marginBottom: '12px',
                fontWeight: '500'
              }}>
                Correo institucional <span style={{ color: '#d93025' }}>*</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '2px solid #dadce0',
                borderRadius: '4px',
                padding: '0 14px',
                backgroundColor: '#fff',
                height: '56px',
                transition: 'border-color 0.2s ease'
              }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#63ed12'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#dadce0'}
              >
                <input
                  type="text"
                  value={nombreUsuario}
                  onChange={(e) => setNombreUsuario(e.target.value.toLowerCase().trim())}
                  onKeyDown={(e) => e.key === 'Enter' && ingresar()}
                  placeholder="tuusuario"
                  disabled={loading}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '16px',
                    backgroundColor: 'transparent'
                  }}
                />
                <span style={{
                  padding: '14px',
                  backgroundColor: 'white',
                  border: '1px solid #dadce0',
                  borderLeft: 'none',
                  color: '#5f6368',
                  fontWeight: '500'
                }}>
                  @uss.edu.pe
                </span>
              </div>
              <div style={{
                fontSize: '12px',
                color: '#5f6368',
                marginTop: '8px'
              }}>
                Ingresa solo tu nombre de usuario (sin @).
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div></div>
              <button
                onClick={ingresar}
                disabled={loading || !nombreUsuario}
                style={{
                  backgroundColor: loading || !nombreUsuario ? '#f1f3f4' : '#5a2290',
                  color: loading || !nombreUsuario ? '#9aa0a6' : 'white',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading || !nombreUsuario ? 'not-allowed' : 'pointer',
                  boxShadow: loading || !nombreUsuario ? 'none' : '0 2px 6px rgba(90, 34, 144, 0.4)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (!loading && nombreUsuario) {
                    e.currentTarget.style.backgroundColor = '#63ed12'
                    e.currentTarget.style.color = '#000'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(99, 237, 18, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && nombreUsuario) {
                    e.currentTarget.style.backgroundColor = '#5a2290'
                    e.currentTarget.style.color = 'white'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(90, 34, 144, 0.4)'
                  }
                }}
              >
                {loading ? 'Verificando...' : 'Siguiente'}
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#fce8e6',
                color: '#c5221f',
                borderRadius: '8px',
                border: '1px solid #f28b82',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                whiteSpace: 'pre-line'
              }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
              </div>
            )}
          </div>

          <footer style={{
            backgroundColor: '#f8f9fa',
            padding: '24px 48px',
            fontSize: '12px',
            color: '#5f6368',
            borderTop: '1px solid #dadce0',
            textAlign: 'center',
            lineHeight: '1.6'
          }}>
            Nunca envíes contraseñas a través de Formularios de Google.<br />
            Este formulario se creó en el Centro de Informática de la Universidad Señor de Sipán.
          </footer>
        </div>
      </main>

      <div style={{
        textAlign: 'center',
        padding: '20px',
        color: '#5f6368',
        fontSize: '14px'
      }}>
        Google Formularios
      </div>
    </div>
  )
}
