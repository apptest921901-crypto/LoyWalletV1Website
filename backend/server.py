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

# --- VERSION 1.0.3: EXPORT OPTIMIZATION & DEBUGGING ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Validate environment
required_vars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY']
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing env vars: {', '.join(missing_vars)}")

try:
    supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_ANON_KEY'])
    supabase_admin: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
    logger.info("Supabase clients initialized")
except Exception as e:
    logger.error(f"Initialization failed: {str(e)}")
    raise

app = FastAPI(title="LoyWalletV1 API", version="1.0.3")

# --- CORS ---
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception: return "127.0.0.1"

origins = [
    "http://localhost:8081", "http://127.0.0.1:8081",
    "http://localhost:5500", "http://127.0.0.1:5500",
    f"http://{get_local_ip()}:8081",
    "https://auth.expo.io", "https://loywallet.io",
    "https://apptest921901-crypto.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# --- MODELS ---
class SupportTicket(BaseModel):
    name: str; email: EmailStr; subject: str; message: str

class Merchant(BaseModel):
    merchant_id: str; name: str; logo_url: Optional[str] = None

class StatsResponse(BaseModel):
    total_cards: int; favorite_cards: int; total_merchants: int

# --- ROUTES ---
@api_router.get("/health")
async def health(): return {"status": "healthy", "version": "1.0.3"}

@api_router.post("/auth/signup")
async def signup(data: dict):
    try:
        res = supabase.auth.sign_up({"email": data["email"], "password": data["password"], "options": {"data": {"full_name": data.get("full_name", ""), "username": data.get("username", "")}}})
        if res.user:
            supabase_admin.table("users").insert({"user_id": res.user.id, "email": data["email"], "full_name": data.get("full_name", ""), "username": data.get("username", "")}).execute()
        return {"status": "success", "message": "Verification email sent"}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/login")
async def login(data: dict):
    try:
        res = supabase.auth.sign_in_with_password({"email": data["email"], "password": data["password"]})
        profile = supabase_admin.table("users").select("*").eq("user_id", res.user.id).single().execute()
        return {"user": profile.data, "session": {"access_token": res.session.access_token, "refresh_token": res.session.refresh_token}}
    except Exception as e: raise HTTPException(status_code=401, detail="Invalid Credentials")

@api_router.get("/cards")
async def get_cards(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user_res = supabase.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("loyalty_cards").select("*, merchants(name, logo_url)").eq("user_id", user_res.user.id).execute()
    cards = res.data or []
    for card in cards:
        card["card_id"] = str(card.pop("id", ""))
        m = card.get("merchants")
        if m: card["merchant_name"], card["merchant_logo_url"] = m.get("name"), m.get("logo_url")
    return cards

@api_router.get("/profile")
async def get_profile(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user_res = supabase.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("users").select("*").eq("user_id", user_res.user.id).single().execute()
    return res.data

@api_router.put("/profile")
async def update_profile(data: dict, authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user_res = supabase.auth.get_user(authorization.replace("Bearer ", ""))
    update_data = {k: v for k, v in data.items() if k in ["full_name", "username", "avatar_url", "phone_number"]}
    res = supabase_admin.table("users").update(update_data).eq("user_id", user_res.user.id).execute()
    return res.data[0] if res.data else {}

@api_router.get("/stats", response_model=StatsResponse)
async def get_stats(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user_res = supabase.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("loyalty_cards").select("id, is_favorite, merchant_id").eq("user_id", user_res.user.id).execute()
    return {"total_cards": len(res.data), "favorite_cards": len([c for c in res.data if c.get("is_favorite")]), "total_merchants": len(set([c["merchant_id"] for c in res.data]))}

@api_router.get("/profile/export")
async def export_user_data(authorization: Optional[str] = Header(None)):
    """GDPR Export: Optimized to avoid memory/timeout issues"""
    if not authorization: raise HTTPException(status_code=401)
    try:
        token = authorization.replace("Bearer ", "")
        # Use standard client to verify user session
        user_resp = supabase.auth.get_user(token)
        if not user_resp.user: raise HTTPException(status_code=401)
        user_id = user_resp.user.id
        
        # 1. Profile (defensive fetch)
        profile_data = {}
        try:
            p_res = supabase_admin.table("users").select("full_name, username").eq("user_id", user_id).execute()
            if p_res.data: profile_data = p_res.data[0]
        except Exception as pe: logger.warning(f"Profile fetch skipped: {str(pe)}")

        # 2. Optimized Cards Query (Exclude heavy image_base64)
        # We select specific fields + joined merchant data
        cards_res = supabase_admin.table("loyalty_cards")\
            .select("card_name, barcode, notes, is_favorite, created_at, merchants(name, logo_url)")\
            .eq("user_id", user_id)\
            .execute()
        
        cards_data = cards_res.data or []
        exported_cards = []
        for card in cards_data:
            m = card.get("merchants")
            # PostgREST might return list or object for joins; handle both
            merchant_info = m[0] if isinstance(m, list) and len(m) > 0 else m
            
            exported_cards.append({
                "card_name": card.get("card_name"),
                "barcode": card.get("barcode"),
                "notes": card.get("notes"),
                "is_favorite": card.get("is_favorite"),
                "created_at": card.get("created_at"),
                "merchant": {
                    "name": merchant_info.get("name") if merchant_info else None,
                    "logo_url": merchant_info.get("logo_url") if merchant_info else None
                } if merchant_info else None
            })
        
        return {
            "export_date": datetime.now(timezone.utc).isoformat(),
            "user": {
                "full_name": profile_data.get("full_name", "User"),
                "username": profile_data.get("username", "user"),
                "email": user_resp.user.email,
                "account_created": str(user_resp.user.created_at)
            },
            "loyalty_cards": exported_cards,
            "statistics": {
                "total_cards": len(exported_cards),
                "favorite_cards": len([c for c in exported_cards if c.get("is_favorite")])
            }
        }
    except Exception as e:
        logger.error(f"CRITICAL EXPORT ERROR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Data preparation failed. Our team has been notified.")

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
