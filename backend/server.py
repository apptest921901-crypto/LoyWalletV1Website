from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
import os
import logging
import socket
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Union
from datetime import datetime, timezone
from supabase import create_client, Client

# --- VERSION 1.0.4: BULLETPROOF EXPORT & ERROR PASSTHROUGH ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

try:
    supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_ANON_KEY'])
    supabase_admin: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
    logger.info("Supabase clients initialized")
except Exception as e:
    logger.error(f"Supabase Init Error: {e}")
    raise

app = FastAPI(title="LoyWalletV1 API", version="1.0.4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

@api_router.get("/health")
async def health(): return {"status": "healthy", "version": "1.0.4"}

@api_router.get("/profile/export")
async def export_user_data(authorization: Optional[str] = Header(None)):
    """GDPR Export: Final defensive version with explicit logging"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header provided")
    
    try:
        token = authorization.replace("Bearer ", "")
        
        # USE ADMIN CLIENT to verify the user token - most reliable in backend environments
        user_resp = supabase_admin.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="User session invalid or expired")
            
        user_id = user_resp.user.id
        logger.info(f"Exporting data for user: {user_id}")
        
        # 1. Fetch Profile (Defensive)
        profile_out = {"full_name": "User", "username": "user"}
        try:
            p_res = supabase_admin.table("users").select("full_name, username").eq("user_id", user_id).execute()
            if p_res.data:
                profile_out = {
                    "full_name": str(p_res.data[0].get("full_name", "User")),
                    "username": str(p_res.data[0].get("username", "user"))
                }
        except Exception as pe:
            logger.warning(f"Profile fetch skipped: {pe}")

        # 2. Optimized Cards Query
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
                "notes": str(card.get("notes", "")),
                "is_favorite": bool(card.get("is_favorite")),
                "created_at": str(card.get("created_at")),
                "merchant": {
                    "name": str(m_info.get("name")) if m_info else None,
                    "logo_url": str(m_info.get("logo_url")) if m_info else None
                } if m_info else None
            })
        
        return {
            "status": "success",
            "export_date": datetime.now(timezone.utc).isoformat(),
            "user": {
                **profile_out,
                "email": str(user_resp.user.email),
                "account_created": str(user_resp.user.created_at)
            },
            "loyalty_cards": exported_cards,
            "statistics": {
                "total_cards": len(exported_cards),
                "favorite_cards": len([c for c in exported_cards if c.get("is_favorite")])
            }
        }
    except Exception as e:
        logger.error(f"EXPORT FATAL ERROR: {str(e)}", exc_info=True)
        # CRITICAL: Return the actual error message so we can fix the root cause
        raise HTTPException(status_code=500, detail=f"Export Engine Error: {str(e)}")

# --- WRAPPERS FOR CORE API (Minimal for brevity) ---
@api_router.get("/profile")
async def get_profile(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user_res = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("users").select("*").eq("user_id", user_res.user.id).single().execute()
    return res.data

@api_router.get("/stats")
async def get_stats(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user_res = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("loyalty_cards").select("id, is_favorite, merchant_id").eq("user_id", user_res.user.id).execute()
    return {"total_cards": len(res.data), "favorite_cards": len([c for c in res.data if c.get("is_favorite")]), "total_merchants": len(set([c["merchant_id"] for c in res.data]))}

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
