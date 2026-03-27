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
# CONFIGURACIÓN SUPABASE
# ==============================================================================
SUPABASE_URL = "https://rromxmhmadwtshughttz.supabase.co"
SUPABASE_KEY = "sb_publishable_GAusBaYKd_ED7Vl1_k7VRA_MZI8BEwu"

# ==============================================================================
# ESTILOS CSS REFINADOS (APPLE ELEGANCE - VERSIÓN ESTABLE)
# ==============================================================================
st.markdown("""
<style>
    /* Tipografía y Base */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    
    html, body, [class*="st-"] {
        font-family: 'Inter', sans-serif !important;
    }

    /* Fondo de App */
    .stApp { background-color: #FBFBFD !important; }

    /* Botones Premium */
    .stButton > button {
        border-radius: 12px !important;
        font-weight: 600 !important;
        padding: 0.5rem 1rem !important;
        border: none !important;
        transition: all 0.2s ease !important;
    }
    
    /* Botones de Acción (IDs Estables) */
    button[key*="btn_procesar"], button[key*="btn_login"] { background-color: #007AFF !important; color: white !important; }
    button[key*="btn_detener"], button[key*="btn_limpiar"] { background-color: #FF3B30 !important; color: white !important; }
    button[key*="btn_generar"], [data-testid="stDownloadButton"] > button { background-color: #FF9500 !important; color: white !important; }
    
    /* Botones Deshabilitados (Contraste Asegurado) */
    button:disabled {
        background-color: #E5E5EA !important;
        color: #8E8E93 !important;
        cursor: not-allowed !important;
    }

    /* Sidebar con Estilo */
    [data-testid="stSidebar"] {
        background-color: #FFFFFF !important;
        border-right: 1px solid #E5E5EA !important;
    }
    .despux-logo {
        font-size: 34px; font-weight: 800; color: #002366 !important;
        text-align: center; margin-bottom: 20px; display: block;
        letter-spacing: -1px; text-decoration: none !important;
    }
    .sb-heading { font-weight: 600; color: #1C1C1E !important; font-size: 18px; margin: 15px 0 5px 0; }

    /* Terminal de Sistema */
    .terminal-container {
        background-color: #1C1C1E !important;
        color: #34C759 !important;
        font-family: 'Courier New', Courier, monospace !important;
        padding: 15px; border-radius: 12px; height: 250px; overflow-y: auto; font-size: 13px; line-height: 1.4;
    }

    /* Ocultar Streamlit overhead */
    #MainMenu, footer, header { visibility: hidden !important; }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# HELPERS
# ==============================================================================
def get_secret(key, default=None):
    try: return st.secrets[key]
    except: return os.getenv(key, default)

def get_all_api_keys():
    return (get_secret("GEMINI_API_KEY"), get_secret("GEMINI_API_KEY_BACKUP"), get_secret("DEEPSEEK_API_KEY"), get_secret("SPREADSHEET_NAME"))

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def log(msg: str, level: str = "normal"):
    if "log_lines" not in st.session_state: st.session_state.log_lines = []
    st.session_state.log_lines.append((msg, level))

# ==============================================================================
# LÓGICA DE NEGOCIO
# ==============================================================================
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
        nombre = 'gemini-1.5-flash'
        if 'models/gemini-2.0-flash' in disponibles: nombre = 'gemini-2.0-flash'
    except: nombre = 'gemini-1.5-flash'
    return genai.GenerativeModel(nombre), nombre

def consultar_ia(modelo, prompt: str, reintentos_maximos=4):
    keys = get_all_api_keys()
    for intento in range(reintentos_maximos):
        idx = st.session_state.current_api_index
        try:
            if idx < 2:
                respuesta = modelo.generate_content(prompt)
                return respuesta.text.strip(), modelo
            else:
                client = openai.OpenAI(api_key=keys[2], base_url="https://api.deepseek.com")
                resp = client.chat.completions.create(model="deepseek-chat", messages=[{"role": "user", "content": prompt}], temperature=0.2)
                return resp.choices[0].message.content.strip(), modelo
        except: time.sleep(1)
    return None, modelo

def parsear_respuesta(respuesta: str, coords_requeridas: list) -> dict:
    resultados = {}
    patron = re.compile(r'(?:^\*{0,2})(B\d+)\*{0,2}\s*:\s*(.+?)(?=\n\*{0,2}B\d+|\Z)', re.MULTILINE | re.DOTALL)
    for match in patron.finditer(respuesta):
        coord = match.group(1).strip().upper()
        if coord in coords_requeridas: resultados[coord] = re.sub(r'\*+', '', match.group(2).strip())
    if not resultados:
        for l in respuesta.split("\n"):
            if ":" in l:
                try:
                    p = l.replace("*","").strip().split(":", 1)
                    c = p[0].strip().upper()
                    if c in coords_requeridas: resultados[c] = p[1].strip()
                except: continue
    return resultados

def extraer_texto_pdf(pdf_bytes: bytes) -> str:
    t = ""
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc: t += page.get_text()
    return t

def extraer_texto_extras(archivos) -> str:
    t = ""
    for a in archivos:
        try:
            if a.name.endswith(".txt"): t += a.read().decode("utf-8", errors="ignore")
            elif a.name.endswith(".docx"):
                doc = docx.Document(io.BytesIO(a.read()))
                t += "\n".join(p.text for p in doc.paragraphs)
        except: continue
    return t

def procesar_todo(pdf_bytes, archivos_extras, datos_us, prog, lbl, tabla, log_p):
    st.session_state.datos_procesados = []
    st.session_state.log_lines = []
    keys = get_all_api_keys()
    log(">> Extrayendo PDF y conectando a Google Sheets...")
    try:
        pdf_texto = extraer_texto_pdf(pdf_bytes)
        cli = get_gsheets_client()
        doc = cli.open(keys[3])
        modelo, _ = inicializar_modelo_gemini(keys[0])
        # Limpieza previa
        for h in doc.worksheets(): h.batch_clear(["B2:B5000"])
        
        contexto = "\n".join([f"- {k}: {v}" for k, v in datos_us.items() if v])
        
        for hoja in doc.worksheets():
            log(f"--- Pestaña: {hoja.title} ---")
            matriz = hoja.get_all_values()
            items = []
            for r_idx, fila in enumerate(matriz):
                if len(fila) > 0 and fila[0].strip() and (len(fila) < 2 or not fila[1].strip()):
                    items.append({"label": fila[0].strip(), "coord": gspread.utils.rowcol_to_a1(r_idx + 1, 2)})
            
            if not items: continue
            
            for i in range(0, len(items), 3):
                lote = items[i:i+3]
                lote_str = "\n".join(f"{it['coord']}: {it['label']}" for it in lote)
                prompt = f"Datos:\n{contexto}\nPDF:\n{pdf_texto[:30000]}\nLote:\n{lote_str}\nFormato COORDENADA: DATO"
                
                log(f"IA: Procesando a {len(lote)} celdas...")
                resp, modelo = consultar_ia(modelo, prompt)
                if resp:
                    vals = parsear_respuesta(resp, [it['coord'] for it in lote])
                    for c, v in vals.items():
                        hoja.update_acell(c, v)
                        st.session_state.datos_procesados.append({"Celda": c, "V": v[:40]+"..."})
                
                prog.progress((i+len(lote))/len(items))
                tabla.dataframe(pd.DataFrame(st.session_state.datos_procesados), use_container_width=True)
                render_log(log_p)

        log("✅ Finalizado con éxito.", "success")
        st.session_state.processing_done = True
    except Exception as e:
        log(f"❌ Error: {e}", "error")

def render_log(placeholder):
    html = "<div class='terminal-container'>"
    for m, l in st.session_state.log_lines:
        c = "#34C759" if l=="success" else ("#FF3B30" if l=="error" else "white")
        html += f"<span style='color:{c}'>{m}</span><br>"
    html += "</div>"
    placeholder.markdown(html, unsafe_allow_html=True)

# ==============================================================================
# UI
# ==============================================================================
if "logged_in_user" not in st.session_state: st.session_state.logged_in_user = None
if "datos_procesados" not in st.session_state: st.session_state.datos_procesados = []
if "log_lines" not in st.session_state: st.session_state.log_lines = []
if "processing_done" not in st.session_state: st.session_state.processing_done = False

def sidebar_auth():
    if st.session_state.logged_in_user:
        st.success(f"👤 {st.session_state.logged_in_user['nombre']}")
        if st.button("🚪 Cerrar Sesión", use_container_width=True):
            st.session_state.logged_in_user = None
            st.rerun()
    else:
        if st.button("👤 Iniciar Sesión", use_container_width=True, key="btn_login"):
            st.session_state.logged_in_user = {"nombre": "Admin"}
            st.rerun()

def main():
    with st.sidebar:
        st.markdown('<div class="despux-logo">DESPUX</div>', unsafe_allow_html=True)
        st.markdown('<div class="sb-heading">📂 Documentos</div>', unsafe_allow_html=True)
        pdf_f = st.file_uploader("📄 PDF Principal", type=["pdf"], key="pdf_up")
        extra_f = st.file_uploader("📝 Extras", accept_multiple_files=True, key="ext_up")
        st.divider()
        sidebar_auth()
        st.divider()
        if st.button("⚙️ Configuración", use_container_width=True, key="btn_config"): pass

    st.title("🚀 Bot de Bitácora")
    st.caption("Falla cero · IA Avanzada · DESPUX Engineering")
    st.divider()

    c1, c2 = st.columns([1, 1.8], gap="large")
    with c1:
        with st.container(border=True):
            st.markdown("### 📝 Datos")
            fact = st.text_input("Factura")
            oc = st.text_input("Orden Compra")
            st.markdown("---")
            if not st.session_state.logged_in_user: st.info("🔒 Inicia sesión para habilitar.")
            ca, cb = st.columns(2)
            with ca: 
                if st.button("🚀 Procesar", use_container_width=True, disabled=not st.session_state.logged_in_user, key="btn_procesar"):
                    if pdf_f:
                        procesar_todo(pdf_f.read(), extra_f, {"F": fact, "O": oc}, st.progress(0), st.empty(), st.empty(), st.empty())
                    else: st.warning("Sube el PDF.")
            with cb: st.button("🛑 Detener", use_container_width=True, disabled=True, key="btn_detener")

    with c2:
        with st.container(border=True):
            st.markdown("### 📊 Resultados")
            if st.session_state.datos_procesados: st.dataframe(pd.DataFrame(st.session_state.datos_procesados), use_container_width=True)
            else: st.info("Los resultados aparecerán aquí.")
        st.markdown(" ")
        with st.container(border=True):
            st.markdown("### 💻 Terminal")
            log_p = st.empty()
            render_log(log_p)

if __name__ == "__main__":
    main()
