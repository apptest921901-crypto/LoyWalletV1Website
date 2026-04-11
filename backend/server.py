from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from dotenv import load_dotenv
import os
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
from supabase import create_client, Client

# --- SETUP LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- ENVIRONMENT VALIDATION ---
def get_env(key: str, default: str = None) -> str:
    val = os.environ.get(key, default)
    if not val:
        logger.error(f"CRITICAL: Environment variable {key} is missing!")
    return val

SUPABASE_URL = get_env('SUPABASE_URL')
SUPABASE_ANON_KEY = get_env('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_KEY = get_env('SUPABASE_SERVICE_KEY')

try:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("Supabase configuration incomplete")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("✅ Supabase clients initialized successfully")
except Exception as e:
    logger.error(f"❌ Supabase Initialization Failed: {e}")
    supabase = None
    supabase_admin = None

app = FastAPI(title="LoyWalletV1 API", version="1.0.4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Direct JSON response for easier browser debugging"""
    return {
        "status": "online",
        "message": "LoyWallet Backend API is running",
        "environment": "staging",
        "health_endpoint": "/api/health",
        "docs_endpoint": "/docs",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

api_router = APIRouter(prefix="/api")

@api_router.get("/health")
async def health():
    status = "healthy" if supabase else "degraded"
    return {
        "status": status,
        "version": "1.0.4",
        "supabase_connected": supabase is not None
    }

# (Rest of the endpoints remain same...)
@api_router.get("/profile")
async def get_profile(authorization: Optional[str] = Header(None)):
    if not supabase_admin: raise HTTPException(status_code=503)
    if not authorization: raise HTTPException(status_code=401)
    user_res = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("users").select("*").eq("user_id", user_res.user.id).single().execute()
    return res.data

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
