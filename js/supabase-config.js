import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Configuración de Supabase
const SUPABASE_URL = 'https://rromxmhmadwtshughttz.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_GAusBaYKd_ED7Vl1_k7VRA_MZI8BEwu'

// Inicializar y exportar el cliente principal
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * ==========================================
 * MÓDULO: PROYECTOS
 * ==========================================
 */

/**
 * Obtiene la lista de proyectos ordenados por fecha de creación (más recientes primero)
 * @returns {Promise<Array>} Lista de proyectos
 */
export async function getProyectos() {
  const { data, error } = await supabase
    .from('proyectos')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    console.error('Error al cargar proyectos:', error.message)
    return []
  }
  return data
}

/**
 * ==========================================
 * MÓDULO: CONTACTO
 * ==========================================
 */

/**
 * Envía un nuevo mensaje de contacto a la base de datos
 * @param {string} nombre - Nombre del usuario
 * @param {string} email - Correo del usuario
 * @param {string} mensaje - Contenido del mensaje
 */
export async function enviarMensajeContacto(nombre, email, mensaje) {
  const { data, error } = await supabase
    .from('contactos')
    .insert([{ nombre, email, mensaje }])
    // .select() nos devolvería la fila insertada si la política lo permitiera, 
    // pero como el usuario anónimo no tiene permisos de lectura de "contactos", 
    // fallaría. Por tanto, sólo insertamos.

  if (error) {
    console.error('Error al enviar mensaje:', error.message)
    throw error
  }
  
  return true
}

/**
 * ==========================================
 * MÓDULO: HERRAMIENTAS (ESTADÍSTICAS)
 * ==========================================
 */

/**
 * Incrementa el contador de uso de una herramienta (calculadora) atómicamente
 * @param {string} nombreHerramienta - Identificador de la herramienta
 */
export async function registrarUsoHerramienta(nombreHerramienta) {
  // Usamos el RPC (Stored Procedure) para evitar concurrencia y simplificar RLS
  const { data, error } = await supabase.rpc('incrementar_uso_herramienta', {
    herramienta_nombre: nombreHerramienta
  })

  if (error) {
    console.error('Error al registrar uso de herramienta:', error.message)
    return false
  }
  return true
}

/**
 * ==========================================
 * MÓDULO: AUTENTICACIÓN (Dashboard)
 * ==========================================
 */

/**
 * Inicia sesión con correo y contraseña
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) {
    console.error('Error al iniciar sesión:', error.message)
    throw error
  }
  
  return data
}

/**
 * Cierra la sesión activa
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error al cerrar sesión:', error.message)
    throw error
  }
}

/**
 * Obtiene la sesión actual si el usuario ya está logueado
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Error al obtener sesión:', error.message)
    return null
  }
  
  return data.session
}

/**
 * Obtiene los mensajes de contacto (Solo funciona si hay un usuario autenticado)
 */
export async function getMensajesContacto() {
  const { data, error } = await supabase
    .from('contactos')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    console.error('Error al obtener mensajes:', error.message)
    throw error
  }
  
  return data
}

/**
 * ==========================================
 * MÓDULO: CONFIGURACIÓN
 * ==========================================
 */

/**
 * Obtiene el valor de un ajuste general de la aplicación  
 * @param {string} settingName - Nombre del ajuste a buscar
 * @returns {Promise<string|null>} Valor del ajuste
 */
export async function getAppSetting(settingName) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_name', settingName)
    .single()

  if (error) {
    console.error(`Error al obtener el ajuste '${settingName}':`, error.message)
    return null
  }
  
  return data?.setting_value || null
}
