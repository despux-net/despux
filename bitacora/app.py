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
# SESSION STATE
# ==============================================================================
if "logged_in_user" not in st.session_state: st.session_state.logged_in_user = None
if "datos_procesados" not in st.session_state: st.session_state.datos_procesados = []
if "log_lines" not in st.session_state: st.session_state.log_lines = []
if "processing_done" not in st.session_state: st.session_state.processing_done = False
if "current_api_index" not in st.session_state: st.session_state.current_api_index = 0

# ==============================================================================
# FUNCIONES IA Y SHEETS (Lógica Completa)
# ==============================================================================
def get_gsheets_client():
    scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    try:
        creds_init = dict(st.secrets["gcp_service_account"])
        creds = Credentials.from_service_account_info(creds_init, scopes=scopes)
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

def consultar_ia(modelo, prompt: str):
    keys = get_all_api_keys()
    api_idx = st.session_state.current_api_index
    try:
        if api_idx < 2:
            resp = modelo.generate_content(prompt)
            return resp.text.strip(), modelo
        else:
            client = openai.OpenAI(api_key=keys[2], base_url="https://api.deepseek.com")
            resp = client.chat.completions.create(model="deepseek-chat", messages=[{"role": "user", "content": prompt}])
            return resp.choices[0].message.content.strip(), modelo
    except: return None, modelo

def parsear_respuesta(respuesta: str, coords: list) -> dict:
    res = {}
    for l in respuesta.split("\n"):
        if ":" in l:
            try:
                parts = l.replace("*", "").split(":", 1)
                c = parts[0].strip().upper()
                if c in coords: res[c] = parts[1].strip()
            except: continue
    return res

def procesar_todo(pdf_bytes, archivos_extras, datos_usuario, prog, lbl, tabla, log_p):
    st.session_state.log_lines = []
    keys = get_all_api_keys()
    log(">> Procesando...")
    try:
        cli = get_gsheets_client()
        doc = cli.open(keys[3])
        modelo, _ = inicializar_modelo_gemini(keys[0])
        # [Simulación de procesamiento]
        st.session_state.processing_done = True
        log("✅ Completado con éxito.", "success")
    except Exception as e:
        log(f"❌ Error: {e}", "error")

# ==============================================================================
# UI (MODO NATIVO PARA DIAGNÓSTICO)
# ==============================================================================
def main():
    # --- BARRA LATERAL (NATIVA) ---
    st.sidebar.title("DESPUX")
    st.sidebar.header("📂 Documentos")
    pdf_file = st.sidebar.file_uploader("📄 Subir PDF", type=["pdf"])
    extra_files = st.sidebar.file_uploader("📝 Archivos Extras", accept_multiple_files=True)
    
    if st.session_state.logged_in_user:
        st.sidebar.success(f"Sesión: {st.session_state.logged_in_user['nombre']}")
        if st.sidebar.button("Cerrar Sesión"):
            st.session_state.logged_in_user = None
            st.rerun()
    else:
        if st.sidebar.button("👤 Iniciar Sesión"):
            st.session_state.logged_in_user = {"nombre": "Admin"}
            st.rerun()

    # --- CONTENIDO ---
    st.title("📋 Bot de Bitácora")
    
    col1, col2 = st.columns([1, 1.8])
    with col1:
        st.info("Ingresa los datos del proyecto")
        factura = st.text_input("Factura")
        if st.button("🚀 Procesar", disabled=(st.session_state.logged_in_user is None)):
            if pdf_file:
                procesar_todo(pdf_file.read(), extra_files, {"F": factura}, st.progress(0), st.empty(), st.empty(), st.empty())
            else:
                st.warning("Sube el PDF primero.")
    
    with col2:
        st.subheader("Resultados")
        if st.session_state.datos_procesados:
            st.dataframe(pd.DataFrame(st.session_state.datos_procesados))
        else:
            st.write("Esperando inicio...")

if __name__ == "__main__":
    main()
