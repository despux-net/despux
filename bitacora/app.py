import streamlit as st
import os
import re
import time
import hashlib
import io
import fitz           # PyMuPDF
import docx
import pandas as pd
import gspread
import openpyxl
from google.oauth2.service_account import Credentials
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
import openai
from supabase import create_client, Client

# ==============================================================================
# CONFIGURACIÓN DE PÁGINA
# ==============================================================================
st.set_page_config(
    page_title="Bot de Bitácora | DESPUX",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ==============================================================================
# CONFIGURACIÓN SUPABASE (siempre visible, no es secreto de IA)
# ==============================================================================
SUPABASE_URL = "https://rromxmhmadwtshughttz.supabase.co"
SUPABASE_KEY = "sb_publishable_GAusBaYKd_ED7Vl1_k7VRA_MZI8BEwu"

# ==============================================================================
# HELPERS DE SECRETS (Streamlit Cloud → st.secrets, local → os.getenv)
# ==============================================================================
def get_secret(key, default=None):
    try:
        return st.secrets[key]
    except:
        return os.getenv(key, default)

def get_all_api_keys():
    return (
        get_secret("GEMINI_API_KEY"),
        get_secret("GEMINI_API_KEY_BACKUP"),
        get_secret("DEEPSEEK_API_KEY"),
        get_secret("SPREADSHEET_NAME"),
    )

# ==============================================================================
# SESSION STATE
# ==============================================================================
defaults = {
    "logged_in_user": None,
    "api_1_enabled": True,   # Gemini Principal
    "api_2_enabled": True,   # Gemini Backup
    "api_3_enabled": True,   # DeepSeek
    "datos_procesados": [],
    "current_api_index": 0,
    "processing_done": False,
    "log_lines": [],
    "show_login_modal": False,
    "show_cred_modal": False,
    "admin_unlocked": False,
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ==============================================================================
# ESTILOS CSS REFORZADOS (PARA EVITAR BARRA LATERAL INVISIBLE Y BAJO CONTRASTE)
# ==============================================================================
st.markdown("""
<style>
    /* Forzar fondo blanco y texto oscuro global */
    .stApp, [data-theme="light"], [data-theme="dark"] { 
        background-color: #F8F9FA !important; 
        color: #1C1C1E !important; 
    }
    
    /* Mostrar SIEMPRE la barra lateral */
    div[data-testid="stSidebarNav"] { display: block !important; }
    section[data-testid="stSidebar"] { 
        background-color: #FFFFFF !important; 
        border-right: 1px solid #E5E5EA !important;
        visibility: visible !important;
    }
    
    /* Asegurar visibilidad de textos en sidebar */
    section[data-testid="stSidebar"] p, section[data-testid="stSidebar"] span, section[data-testid="stSidebar"] div {
        color: #1C1C1E !important;
    }

    /* Logo DESPUX */
    .despux-logo { 
        font-family: 'Helvetica', sans-serif; font-size: 32px; font-weight: 900; color: #002366 !important; 
        text-align: center; padding: 20px 0; display: block; text-decoration: none !important;
    }

    /* Títulos Sidebar */
    .sb-heading { font-size: 20px; font-weight: bold; color: #1C1C1E !important; margin: 15px 0; }

    /* Botones - Forzar visibilidad del texto y colores vibrantes */
    .stButton > button {
        border-radius: 10px !important;
        font-weight: bold !important;
        height: 45px !important;
        border: none !important;
    }
    
    /* Colores por KEY */
    button[key*="btn_procesar"], button[key*="btn_login"] { background-color: #007AFF !important; color: white !important; }
    button[key*="btn_detener"], button[key*="btn_limpiar"] { background-color: #FF3B30 !important; color: white !important; }
    button[key*="btn_generar"], [data-testid="stDownloadButton"] > button { background-color: #FF9500 !important; color: white !important; }
    
    /* Botones deshabilitados: Texto gris oscuro para que se lea! */
    button:disabled {
        background-color: #E5E5EA !important;
        color: #8E8E93 !important;
    }

    /* Cards (Contenedores) */
    div[data-testid="stVerticalBlock"] > div[style*="border: 1px solid"] {
        background-color: white !important;
        padding: 20px !important;
        border-radius: 12px !important;
    }

    /* Terminal */
    .terminal-card { 
        background-color: #1C1C1E !important; 
        color: #34C759 !important; 
        font-family: 'Consolas', monospace !important;
        padding: 15px; border-radius: 10px; height: 220px; overflow-y: auto;
    }

    /* Ocultar Streamlit overhead */
    #MainMenu, footer, header { visibility: hidden !important; }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# FUNCIONES AUXILIARES
# ==============================================================================
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def log(msg: str, level: str = "normal"):
    st.session_state.log_lines.append((msg, level))

def get_gsheets_client():
    scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    try:
        creds_dict = dict(st.secrets["gcp_service_account"])
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    except:
        json_file = get_secret("GOOGLE_SHEETS_CREDENTIALS_FILE", "bitacora-491012-71d4c0e7a86f.json")
        creds = Credentials.from_service_account_file(json_file, scopes=scopes)
    return gspread.authorize(creds)

def inicializar_modelo_gemini(api_key: str):
    genai.configure(api_key=api_key)
    try:
        disponibles = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        prioridades = ['models/gemini-2.5-flash', 'models/gemini-2.0-flash', 'models/gemini-1.5-flash-latest', 'models/gemini-1.5-flash']
        nombre = next((p.replace('models/', '') for p in prioridades if p in disponibles), 'gemini-1.5-flash')
    except:
        nombre = 'gemini-1.5-flash'
    return genai.GenerativeModel(nombre), nombre

def consultar_ia(modelo, prompt: str, reintentos_maximos=4):
    GEMINI_KEY, GEMINI_BACKUP_KEY, DEEPSEEK_KEY, _ = get_all_api_keys()
    for intento in range(reintentos_maximos):
        api_index = st.session_state.current_api_index
        try:
            if api_index < 2:
                respuesta = modelo.generate_content(prompt)
                return respuesta.text.strip(), modelo
            else:
                client = openai.OpenAI(api_key=DEEPSEEK_KEY, base_url="https://api.deepseek.com")
                resp = client.chat.completions.create(model="deepseek-chat", messages=[{"role": "user", "content": prompt}], temperature=0.2)
                return resp.choices[0].message.content.strip(), modelo
        except Exception as e:
            time.sleep(2)
    return None, modelo

def parsear_respuesta(respuesta: str, coords_requeridas: list) -> dict:
    resultados = {}
    patron = re.compile(r'(?:^\*{0,2})(B\d+)\*{0,2}\s*:\s*(.+?)(?=\n\*{0,2}B\d+|\Z)', re.MULTILINE | re.DOTALL)
    for match in patron.finditer(respuesta):
        coord = match.group(1).strip().upper()
        texto = re.sub(r'\*+', '', match.group(2).strip())
        if coord in coords_requeridas and coord not in resultados: resultados[coord] = texto
    if not resultados:
        for linea in respuesta.split("\n"):
            if ":" in linea:
                try:
                    p = linea.replace("**", "").replace("*", "").strip().split(":", 1)
                    coord = p[0].strip().upper()
                    if coord in coords_requeridas and coord not in resultados: resultados[coord] = p[1].strip()
                except: continue
    return resultados

def extraer_texto_pdf(pdf_bytes: bytes) -> str:
    texto = ""
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc: texto += page.get_text()
    return texto

def extraer_texto_extras(archivos) -> str:
    texto = ""
    for archivo in archivos:
        try:
            if archivo.name.endswith(".txt"): texto += f"\n---\n{archivo.name}\n" + archivo.read().decode("utf-8", errors="ignore")
            elif archivo.name.endswith(".docx"):
                d = docx.Document(io.BytesIO(archivo.read()))
                texto += f"\n---\n{archivo.name}\n" + "\n".join(p.text for p in d.paragraphs)
        except: continue
    return texto

def procesar_todo(pdf_bytes, archivos_extras, datos_usuario, progress_bar, lbl_progreso, tabla_placeholder, log_placeholder):
    st.session_state.current_api_index = 0
    st.session_state.datos_procesados = []
    st.session_state.log_lines = []
    GEMINI_KEY, _, _, SPREADSHEET_NAME = get_all_api_keys()
    log(">> Extrayendo texto y conectando a Sheets...")
    try:
        pdf_texto = extraer_texto_pdf(pdf_bytes)
        cli = get_gsheets_client()
        modelo, _ = inicializar_modelo_gemini(GEMINI_KEY)
        doc = cli.open(SPREADSHEET_NAME)
        # Limpieza previa
        for h in doc.worksheets(): h.batch_clear(["B2:B5000"])
        
        contextos = [f"- {k}: {v}" for k, v in datos_usuario.items() if v]
        bloque_usuario = "\n".join(contextos)

        for hoja in doc.worksheets():
            log(f"\n--- Analizando: {hoja.title} ---")
            matriz = hoja.get_all_values()
            datos_a_procesar = []
            for r_idx, fila in enumerate(matriz):
                if len(fila) > 0 and fila[0].strip() and (len(fila) < 2 or not fila[1].strip()):
                    coord = gspread.utils.rowcol_to_a1(r_idx + 1, 2)
                    datos_a_procesar.append({"etiqueta": fila[0].strip(), "coordenada": coord})
            
            if not datos_a_procesar: continue
            
            for i in range(0, len(datos_a_procesar), 3):
                lote = datos_a_procesar[i:i+3]
                lote_str = "\n".join(f"{it['coordenada']}: {it['etiqueta']}" for it in lote)
                prompt = f"Datos Usuario:\n{bloque_usuario}\nPDF:\n{pdf_texto[:30000]}\nLote:\n{lote_str}\nGenera Respuestas en formato COORDENADA: DATO"
                
                log(f"Consultando IA para {len(lote)} celdas...")
                respuesta, modelo = consultar_ia(modelo, prompt)
                if respuesta:
                    datos = parsear_respuesta(respuesta, [it['coordenada'] for it in lote])
                    for coord, txt in datos.items():
                        hoja.update_acell(coord, txt)
                        st.session_state.datos_procesados.append({"Celda": coord, "H": hoja.title, "V": txt})
                
                progress_bar.progress((i+len(lote))/len(datos_a_procesar))
                tabla_placeholder.dataframe(pd.DataFrame(st.session_state.datos_procesados), use_container_width=True)
                render_log(log_placeholder)

        log("✅ Tarea terminada satisfactoriamente.", "success")
        st.session_state.processing_done = True
    except Exception as e:
        log(f"❌ Error crítico: {e}", "error")

def render_log(placeholder):
    html = "<div class='terminal-card'>"
    for msg, level in st.session_state.log_lines:
        c = "#34C759" if level=="success" else ("#FF3B30" if level=="error" else "white")
        html += f"<span style='color:{c}'>{msg.replace('<','&lt;')}</span><br>"
    html += "</div>"
    placeholder.markdown(html, unsafe_allow_html=True)

def sidebar_auth():
    if st.session_state.logged_in_user:
        u = st.session_state.logged_in_user
        st.sidebar.success(f"👤 {u['nombre']} {u['apellido']}")
        if st.sidebar.button("🚪 Cerrar Sesión", use_container_width=True):
            st.session_state.logged_in_user = None
            st.rerun()
    else:
        if st.sidebar.button("👤 Iniciar Sesión", use_container_width=True, key="btn_login"):
            st.session_state.show_login_modal = True
            st.rerun()

@st.dialog("Acceso")
def modal_login():
    email = st.text_input("Email", key="login_email")
    passwd = st.text_input("Contraseña", type="password", key="login_pass")
    if st.button("Ingresar", type="primary", use_container_width=True):
        try:
            sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
            res = sb.table("usuarios_app").select("*").eq("email", email.lower()).execute()
            if res.data and res.data[0]["password"] == hash_password(passwd):
                st.session_state.logged_in_user = res.data[0]
                st.rerun()
            else: st.error("Credenciales inválidas.")
        except Exception as e: st.error(f"Error: {e}")

@st.dialog("⚙️ APIs")
def modal_credenciales():
    st.write("Configuración de Claves")
    if st.button("Cerrar"): st.rerun()

def main():
    # --- SIDEBAR ---
    with st.sidebar:
        st.markdown('<a href="https://www.despux.net/" target="_blank" class="despux-logo">DESPUX</a>', unsafe_allow_html=True)
        st.markdown("---")
        st.markdown('<div class="sb-heading">📂 Documentos</div>', unsafe_allow_html=True)
        pdf_file = st.file_uploader("📄 Subir PDF", type=["pdf"], key="pdf_up")
        extra_files = st.file_uploader("📝 Extras", accept_multiple_files=True, key="ext_up")
        if st.button("📋 GENERAR BITÁCORA", use_container_width=True, disabled=not st.session_state.processing_done, key="btn_generar"):
            pass
        st.markdown("---")
        sidebar_auth()
        if st.button("⚙️ Configuración", use_container_width=True, key="btn_config"):
            st.session_state.show_cred_modal = True
            st.rerun()

    if st.session_state.get("show_login_modal"): st.session_state.show_login_modal = False; modal_login()
    if st.session_state.get("show_cred_modal"): st.session_state.show_cred_modal = False; modal_credenciales()

    # --- MAIN ---
    st.markdown("## 🚀 Bot de Bitácora")
    st.caption("DESPUX Engineering")
    st.divider()

    c1, c2 = st.columns([1, 1.8], gap="medium")
    with c1:
        with st.container(border=True):
            st.markdown("### 📝 Datos Manuales")
            f = st.text_input("Número de Factura")
            o = st.text_input("Orden de Compra")
            i = st.text_input("Fecha Inicio")
            st.markdown("---")
            dis = st.session_state.logged_in_user is None
            if dis: st.info("🔒 Inicia sesión para procesar.")
            colp, cols = st.columns(2)
            with colp: 
                if st.button("🚀 Procesar", use_container_width=True, disabled=dis, key="btn_procesar"):
                    if pdf_file:
                        procesar_todo(pdf_file.read(), extra_files, {"Factura": f, "Orden": o, "Inicio": i}, st.progress(0), st.empty(), st.empty(), st.empty())
            with cols: st.button("🛑 Detener", use_container_width=True, disabled=True, key="btn_detener")

    with c2:
        with st.container(border=True):
            st.markdown("### 📊 Resultados")
            t_placeholder = st.empty()
            if st.session_state.datos_procesados: t_placeholder.dataframe(pd.DataFrame(st.session_state.datos_procesados), use_container_width=True)
            else: st.info("Esperando datos...")
            
            if st.session_state.datos_procesados:
                if st.button("🗑 Limpiar", use_container_width=True, key="btn_limpiar"):
                    st.session_state.datos_procesados = []; st.session_state.log_lines = []; st.rerun()

        st.markdown(" ")
        with st.container(border=True):
            st.markdown("### 💻 Terminal")
            log_p = st.empty()
            render_log(log_p)

if __name__ == "__main__":
    main()
