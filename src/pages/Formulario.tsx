// src/pages/Formulario/Formulario.tsx
import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { ref, get } from 'firebase/database'
import logoUss from '../assets/uss.png'
import estrellaImg from '../assets/estrella.png'

// PREGUNTAS
const preguntas = [
  "¿El docente inicia sus clases puntualmente y cumple con el horario establecido?",
  "¿Explica los temas de manera clara y comprensible?",
  "¿Relaciona la teoría con ejemplos o aplicaciones prácticas que facilitan el aprendizaje?",
  "¿Promueve la participación y el intercambio de ideas durante la clase?",
  "¿Con qué frecuencia tu docente responde los correos electrónicos que le envías?",
  "Si tuvieras que calificar el curso en general, ¿Cuántas estrellas le darías?"
]

const opcionesFrecuencia = ["Nunca", "Rara vez", "A veces", "Frecuentemente", "Siempre"]
const opcionesCorreos = ["Nunca", "Rara vez", "A veces", "Frecuentemente", "Siempre"]

const TOTAL_PREGUNTAS = preguntas.length

const limpiarNombreCurso = (cursoCompleto: string) => {
  return cursoCompleto.replace(/\s*-\s*PEAD-[a-z]$/i, '').trim();
}

const getOpcionesParaPregunta = (index: number) => {
  return index < 4 ? opcionesFrecuencia : index === 4 ? opcionesCorreos : opcionesFrecuencia;
}

// Componente de estrellas
const EstrellasRating = ({ seleccionada, onChange, disabled }: { seleccionada: number; onChange: (valor: number) => void; disabled: boolean }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '12px', width: '100%', maxWidth: '500px' }}>
        {[1, 2, 3, 4, 5].map(num => (
          <div key={num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', padding: '10px', borderRadius: '10px', transition: 'all 0.3s ease', transform: seleccionada >= num ? 'scale(1.1)' : 'scale(1)', backgroundColor: seleccionada >= num ? 'rgba(255, 215, 0, 0.1)' : 'transparent', border: seleccionada >= num ? '2px solid #FFD700' : '2px solid transparent' }} onClick={() => !disabled && onChange(num)}>
            <img src={estrellaImg} alt={`${num} estrella`} style={{ width: '40px', height: '40px', filter: seleccionada >= num ? 'drop-shadow(0 0 6px gold) brightness(1.1)' : 'grayscale(0.4) opacity(0.7)' }} />
            <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', marginTop: '6px', color: seleccionada >= num ? '#5a2290' : '#888', backgroundColor: seleccionada >= num ? '#FFD700' : '#f0f0f0', padding: '4px 8px', borderRadius: '12px' }}>{num}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '10px', width: '100%', maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', fontSize: '14px', color: '#5a2290', fontWeight: '600', backgroundColor: '#f0f7ff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #d0e0ff' }}>
          {seleccionada === 0 ? 'Selecciona una calificación' : seleccionada === 1 ? '😞 Muy insatisfecho' : seleccionada === 2 ? '😐 Insatisfecho' : seleccionada === 3 ? '😐 Regular' : seleccionada === 4 ? '🙂 Satisfecho' : '😊 Muy satisfecho'}
        </div>
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>{seleccionada > 0 ? `Calificación: ${seleccionada}/5` : ''}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '500px', marginTop: '5px', fontSize: '11px', color: '#777' }}>
        <span>1 = Muy insatisfecho</span><span>2 = Insatisfecho</span><span>3 = Regular</span><span>4 = Satisfecho</span><span>5 = Muy satisfecho</span>
      </div>
    </div>
  );
};

// Iconos
const BookIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a2290" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /></svg>);
const UserIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#63ed12" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
const TeacherIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#63ed12" strokeWidth="2.5"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14v7" /><path d="M3 7v11l9 5 9-5V7" /></svg>);
const PlanIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a2290" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
const ChevronDown = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>);
const LoadingIcon = () => (<svg width="64" height="64" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="40" stroke="#5a2290" strokeWidth="8" opacity="0.3" /><circle cx="50" cy="50" r="40" stroke="#63ed12" strokeWidth="8" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset="80"><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1.5s" repeatCount="indefinite" /></circle></svg>);
const SuccessIcon = () => (<svg width="100" height="100" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="45" fill="#63ed12" /><path d="M30 50 L43 63 L70 37" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"><animate attributeName="stroke-dasharray" from="0,100" to="100,0" dur="0.6s" fill="freeze" /></path></svg>);
const SendIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2 L2 12.5 L22 23 L16 12.5 Z" /><path d="M22 2 L12 12.5 L22 23" /></svg>);

export default function Formulario() {
  const [datos, setDatos] = useState<any>(null)
  const [cursoSel, setCursoSel] = useState('')
  const [respuestas, setRespuestas] = useState<string[]>(Array(TOTAL_PREGUNTAS).fill(''))
  const [estrellasSeleccionadas, setEstrellasSeleccionadas] = useState<number>(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exitoModal, setExitoModal] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)
  const [apiUrl, setApiUrl] = useState('')

  // Cargar configuración desde Firebase
  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        const configRef = ref(db, 'encuesta-config/config');
        const snapshot = await get(configRef);
        if (snapshot.exists()) {
          const config = snapshot.val();
          console.log('📊 Configuración cargada:', config);
          
          if (config.googleScriptUrl) {
            setApiUrl(config.googleScriptUrl);
            console.log('✅ API URL cargada:', config.googleScriptUrl);
          }
        } else {
          console.error('❌ No hay configuración en Firebase');
        }
      } catch (error) {
        console.error('Error cargando config:', error);
      } finally {
        setConfigLoading(false);
      }
    };
    cargarConfiguracion();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('eval_data')
    if (!saved) {
      window.location.href = '/';
      return
    }
    const parsed = JSON.parse(saved)
    const cursosPendientes = parsed.cursos.filter((c: any) => !c.completado)
    if (cursosPendientes.length === 0) {
      alert('Ya has completado todas las encuestas disponibles')
      window.location.href = '/';
      return
    }
    setDatos({...parsed, cursos: cursosPendientes})
    setCursoSel(cursosPendientes[0].curso)
  }, [])

  if (configLoading || !datos || !cursoSel) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <LoadingIcon />
          <div style={{ marginTop: '24px', fontSize: '20px', color: '#5a2290', fontWeight: '600' }}>Cargando...</div>
        </div>
      </div>
    )
  }

  const info = datos.cursos.find((c: any) => c.curso === cursoSel) || datos.cursos[0]
  const progreso = respuestas.filter(r => r !== '').length + (estrellasSeleccionadas > 0 ? 1 : 0)
  const porcentaje = Math.round((progreso / TOTAL_PREGUNTAS) * 100)

  const enviar = async () => {
    const respuestasCompletas = respuestas.every((r, i) => i === 5 || r !== '');
    if (!respuestasCompletas || estrellasSeleccionadas === 0) {
      setError("Por favor responde todas las preguntas");
      return;
    }

    if (!apiUrl) {
      setError('Error de configuración: No se encontró la URL del servidor');
      return;
    }

    setEnviando(true);
    setError('');

    try {
      const cursoLimpio = limpiarNombreCurso(info.curso);
      const respuestasFinales = [...respuestas];
      respuestasFinales[5] = `${estrellasSeleccionadas} estrella${estrellasSeleccionadas !== 1 ? 's' : ''}`;

      const PROXY_URL = '/api/google-script';
      
      console.log('🌐 Proxy URL:', PROXY_URL);
      console.log('📦 Enviando a script:', apiUrl);
      
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl: apiUrl,
          email: datos.email,
          nombre: info.nombre,
          planestudio: info.planEstudio || '',
          curso: cursoLimpio,
          pead: info.pead,
          docente: info.docente,
          respuestas: respuestasFinales.join('|||')
        }),
      });

      const result = await response.json();
      console.log('📥 Respuesta:', result);

      if (result.success) {
        const datosActualizados = {...datos};
        const cursoIndex = datosActualizados.cursos.findIndex((c: any) => c.curso === cursoSel);
        if (cursoIndex !== -1) datosActualizados.cursos[cursoIndex].completado = true;
        
        const cursosPendientes = datosActualizados.cursos.filter((c: any) => !c.completado);
        
        if (cursosPendientes.length > 0) {
          localStorage.setItem('eval_data', JSON.stringify(datosActualizados));
          setExitoModal(true);
          setTimeout(() => window.location.href = '/formulario', 3000);
        } else {
          setExitoModal(true);
          localStorage.removeItem('eval_data');
          setTimeout(() => window.location.href = '/', 5000);
        }
      } else {
        throw new Error(result.error || 'Error al enviar la encuesta');
      }

    } catch (error: any) {
      console.error('❌ Error:', error);
      setError(error.message || 'Error al enviar. Intenta nuevamente.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setEnviando(false);
    }
  };

  if (exitoModal) {
    const cursosPendientes = datos?.cursos.filter((c: any) => !c.completado) || [];
    const hayMasCursos = cursosPendientes.length > 1;
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ backgroundColor: 'white', padding: '60px 50px', borderRadius: '20px', textAlign: 'center', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <SuccessIcon />
          <h1 style={{ color: '#5a2290', fontSize: '36px', margin: '30px 0 16px', fontWeight: '700' }}>{hayMasCursos ? '¡Curso Completado!' : 'Encuesta Enviada'}</h1>
          <p style={{ fontSize: '20px', color: '#555', marginBottom: '30px' }}>{hayMasCursos ? `Has completado la encuesta para ${limpiarNombreCurso(info.curso)}` : 'Gracias por tu valiosa participación'}</p>
          <div style={{ backgroundColor: '#e8f5e1', padding: '20px', borderRadius: '12px', color: '#1a5e20', fontWeight: '600' }}>{hayMasCursos ? 'Continúa con el siguiente curso' : 'Tu encuesta ha sido registrada exitosamente'}</div>
          {hayMasCursos && <p style={{ marginTop: '20px', color: '#5a2290', fontSize: '16px' }}>Quedan {cursosPendientes.length} curso(s) por responder</p>}
          <p style={{ marginTop: '30px', color: '#888', fontSize: '15px' }}>{hayMasCursos ? 'Cargando siguiente curso...' : 'Redirigiendo al inicio en 5 segundos...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', fontFamily: 'Roboto, Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: '#ffffff', borderBottom: '6px solid #63ed12', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px', display: 'flex', justifyContent: 'center' }}>
          <img src={logoUss} alt="Universidad Señor de Sipán" style={{ height: '80px' }} />
        </div>
      </header>

      <main style={{ padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '680px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 6px rgba(32,33,36,0.28)', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#5a2290', color: 'white', padding: '32px 48px', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '400' }}>ENCUESTA DE SATISFACCIÓN DOCENTE</h1>
            <div style={{ marginTop: '12px', fontSize: '16px' }}>2026 JUNIO</div>
            <div style={{ marginTop: '8px', fontSize: '14px', opacity: 0.9 }}>Tu participación es anónima y confidencial.</div>
          </div>

          <div style={{ padding: '32px 48px' }}>
            {error && <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fce8e6', color: '#c5221f', borderRadius: '8px', border: '1px solid #f28b82' }}>{error}</div>}

            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#5f6368' }}>
                <span>Progreso de la encuesta</span>
                <span><strong>{progreso}/{TOTAL_PREGUNTAS}</strong> respondidas</span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: '#63ed12', width: `${porcentaje}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Información del Estudiante */}
            <div style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)', border: '1px solid #e0e0e0', borderRadius: '16px', padding: '28px', marginBottom: '32px' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '18px', color: '#5a2290', fontWeight: '600' }}>📋 Información del Estudiante</h3>

              {datos.cursos.length > 1 && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', color: '#202124', marginBottom: '8px', fontWeight: '500' }}>Selecciona el curso a encuestar</label>
                  <div style={{ position: 'relative' }}>
                    <select value={cursoSel} onChange={e => { setCursoSel(e.target.value); setRespuestas(Array(TOTAL_PREGUNTAS).fill('')); setEstrellasSeleccionadas(0); setError(''); }} style={{ width: '100%', padding: '14px 16px', paddingRight: '40px', borderRadius: '12px', border: '2px solid #5a2290', backgroundColor: 'white', fontSize: '16px', appearance: 'none', cursor: 'pointer' }}>
                      {datos.cursos.map((c: any) => <option key={c.curso} value={c.curso}>{c.completado ? '✅ ' : '📝 '}{c.curso}</option>)}
                    </select>
                    <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><ChevronDown /></div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gap: '16px', fontSize: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', backgroundColor: '#e8f5e1', borderRadius: '10px' }}>
                  <UserIcon /><div><strong style={{ color: '#63ed12' }}>Estudiante:</strong><span style={{ marginLeft: '8px' }}>{info.nombre}</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', backgroundColor: '#f0f7ff', borderRadius: '10px' }}>
                  <PlanIcon /><div><strong style={{ color: '#5a2290' }}>Plan de Estudio:</strong><span style={{ marginLeft: '8px' }}>{info.planEstudio || 'No especificado'}</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', backgroundColor: '#f0f7ff', borderRadius: '10px' }}>
                  <BookIcon /><div><strong style={{ color: '#5a2290' }}>Curso:</strong><span style={{ marginLeft: '8px' }}>{limpiarNombreCurso(info.curso)}</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', backgroundColor: '#e8f5e1', borderRadius: '10px' }}>
                  <TeacherIcon /><div><strong style={{ color: '#63ed12' }}>PEAD:</strong><span style={{ marginLeft: '8px' }}>{info.pead}</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', backgroundColor: '#f0f7ff', borderRadius: '10px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a2290" strokeWidth="2.5"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14v7" /><path d="M3 7v11l9 5 9-5V7" /></svg>
                  <div><strong style={{ color: '#5a2290' }}>Docente:</strong><span style={{ marginLeft: '8px' }}>{info.docente}</span></div>
                </div>
              </div>
            </div>

            {/* Preguntas 1-4 */}
            {preguntas.slice(0, 4).map((p, i) => (
              <div key={i} style={{ marginBottom: '32px', padding: '24px', border: respuestas[i] ? '3px solid #63ed12' : '1px solid #dadce0', borderRadius: '12px', backgroundColor: respuestas[i] ? '#e8f5e1' : 'white' }}>
                <div style={{ fontSize: '14.5px', marginBottom: '18px', fontWeight: '500' }}>
                  <span style={{ backgroundColor: respuestas[i] ? '#63ed12' : '#5a2290', color: 'white', padding: '6px 12px', borderRadius: '8px', marginRight: '12px' }}>{String.fromCharCode(97 + i).toUpperCase()}</span>
                  {p} <span style={{ color: '#d93025' }}>*</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getOpcionesParaPregunta(i).map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '16px 18px', borderRadius: '10px', backgroundColor: respuestas[i] === opt ? '#63ed12' : 'transparent', color: respuestas[i] === opt ? 'white' : '#202124', fontWeight: respuestas[i] === opt ? '600' : '400' }}>
                      <input type="radio" name={`q${i}`} checked={respuestas[i] === opt} onChange={() => { const nuevo = [...respuestas]; nuevo[i] = opt; setRespuestas(nuevo); setError(''); }} disabled={enviando} style={{ marginRight: '16px', transform: 'scale(1.5)', accentColor: '#63ed12' }} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Pregunta 5 - Correos */}
            <div style={{ marginBottom: '32px', padding: '24px', border: respuestas[4] ? '3px solid #63ed12' : '1px solid #dadce0', borderRadius: '12px', backgroundColor: respuestas[4] ? '#e8f5e1' : 'white' }}>
              <div style={{ fontSize: '14.5px', marginBottom: '18px', fontWeight: '500' }}>
                <span style={{ backgroundColor: respuestas[4] ? '#63ed12' : '#5a2290', color: 'white', padding: '6px 12px', borderRadius: '8px', marginRight: '12px' }}>E</span>
                {preguntas[4]} <span style={{ color: '#d93025' }}>*</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {getOpcionesParaPregunta(4).map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '16px 18px', borderRadius: '10px', backgroundColor: respuestas[4] === opt ? '#63ed12' : 'transparent', color: respuestas[4] === opt ? 'white' : '#202124' }}>
                    <input type="radio" name="q4" checked={respuestas[4] === opt} onChange={() => { const nuevo = [...respuestas]; nuevo[4] = opt; setRespuestas(nuevo); setError(''); }} disabled={enviando} style={{ marginRight: '16px', transform: 'scale(1.5)', accentColor: '#63ed12' }} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pregunta 6 - Estrellas */}
            <div style={{ marginBottom: '32px', padding: '24px', border: estrellasSeleccionadas > 0 ? '3px solid #FFD700' : '1px solid #dadce0', borderRadius: '12px', backgroundColor: estrellasSeleccionadas > 0 ? '#fff9e6' : 'white' }}>
              <div style={{ fontSize: '14.5px', marginBottom: '18px', fontWeight: '500' }}>
                <span style={{ backgroundColor: estrellasSeleccionadas > 0 ? '#FFD700' : '#5a2290', color: estrellasSeleccionadas > 0 ? '#333' : 'white', padding: '6px 12px', borderRadius: '8px', marginRight: '12px' }}>F</span>
                {preguntas[5]} <span style={{ color: '#d93025' }}>*</span>
              </div>
              <EstrellasRating seleccionada={estrellasSeleccionadas} onChange={(valor) => { setEstrellasSeleccionadas(valor); setError(''); }} disabled={enviando} />
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', flexWrap: 'wrap', gap: '16px' }}>
              <button onClick={() => { if (window.confirm('¿Limpiar todas las respuestas?')) { setRespuestas(Array(TOTAL_PREGUNTAS).fill('')); setEstrellasSeleccionadas(0); } }} disabled={enviando} style={{ backgroundColor: 'transparent', color: enviando ? '#ccc' : '#5a2290', border: `1px solid ${enviando ? '#ccc' : '#5a2290'}`, padding: '12px 28px', borderRadius: '8px', fontWeight: '500', cursor: enviando ? 'not-allowed' : 'pointer' }}>Limpiar formulario</button>
              <button onClick={enviar} disabled={enviando || progreso < TOTAL_PREGUNTAS} style={{ backgroundColor: (enviando || progreso < TOTAL_PREGUNTAS) ? '#f1f3f4' : '#5a2290', color: (enviando || progreso < TOTAL_PREGUNTAS) ? '#9aa0a6' : 'white', border: 'none', padding: '14px 36px', borderRadius: '8px', fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: (enviando || progreso < TOTAL_PREGUNTAS) ? 'not-allowed' : 'pointer' }} onMouseEnter={e => { if (!enviando && progreso >= TOTAL_PREGUNTAS) { e.currentTarget.style.backgroundColor = '#63ed12'; e.currentTarget.style.color = 'black' } }} onMouseLeave={e => { if (!enviando && progreso >= TOTAL_PREGUNTAS) { e.currentTarget.style.backgroundColor = '#5a2290'; e.currentTarget.style.color = 'white' } }}>{enviando ? <>Enviando... <SendIcon /></> : 'Enviar encuesta'}</button>
            </div>

            {progreso < TOTAL_PREGUNTAS && !error && <div style={{ marginTop: '24px', padding: '14px', backgroundColor: '#fff8e1', color: '#ff6d00', borderRadius: '8px', textAlign: 'center' }}>Completa todas las preguntas para poder enviar la encuesta</div>}
          </div>

          <footer style={{ backgroundColor: '#f8f9fa', padding: '24px 48px', fontSize: '12px', color: '#5f6368', borderTop: '1px solid #dadce0', textAlign: 'center' }}>Nunca envíes contraseñas a través de Formularios de Google.<br />Este formulario se creó en el Centro de Informática de la Universidad Señor de Sipán.</footer>
        </div>
      </main>

      <div style={{ textAlign: 'center', padding: '20px', color: '#5f6368', fontSize: '14px' }}>Google Formularios</div>
    </div>
  )
}