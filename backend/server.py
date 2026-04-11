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

# Initialize clients lazily or handle failure
try:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("Supabase configuration incomplete")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("✅ Supabase clients initialized successfully")
except Exception as e:
    logger.error(f"❌ Supabase Initialization Failed: {e}")
    # We don't raise here so the app can still start and serve a 500 error instead of crashing the process
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
    """Redirect root to health check for easy verification"""
    return RedirectResponse(url="/api/health")

api_router = APIRouter(prefix="/api")

@api_router.get("/health")
async def health():
    status = "healthy" if supabase else "degraded"
    return {
        "status": status,
        "version": "1.0.4",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "supabase_connected": supabase is not None
    }

@api_router.get("/profile/export")
async def export_user_data(authorization: Optional[str] = Header(None)):
    if not supabase_admin:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header provided")
    
    try:
        token = authorization.replace("Bearer ", "")
        user_resp = supabase_admin.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="User session invalid or expired")
            
        user_id = user_resp.user.id
        
        # 1. Fetch Profile
        profile_out = {"full_name": "User", "username": "user"}
        p_res = supabase_admin.table("users").select("full_name, username").eq("user_id", user_id).execute()
        if p_res.data:
            profile_out = {
                "full_name": str(p_res.data[0].get("full_name", "User")),
                "username": str(p_res.data[0].get("username", "user"))
            }

        # 2. Cards Query
        cards_res = supabase_admin.table("loyalty_cards")\
            .select("card_name, barcode, notes, is_favorite, created_at, merchants(name, logo_url)")\
            .eq("user_id", user_id)\
            .execute()
        
        cards_data = cards_res.data or []
        exported_cards = []
        for card in cards_data:
            m = card.get("merchants")
            m_info = m[0] if isinstance(m, list) and len(m) > 0 else m
            
            exported_cards.append({
                "card_name": str(card.get("card_name", "Unnamed")),
                "barcode": str(card.get("barcode", "")),
                "merchant": {"name": m_info.get("name")} if m_info else None
            })
        
        return {
            "status": "success",
            "user": {**profile_out, "email": user_resp.user.email},
            "loyalty_cards": exported_cards
        }
    except Exception as e:
        logger.error(f"Export Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    # Use environment PORT or default to 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
