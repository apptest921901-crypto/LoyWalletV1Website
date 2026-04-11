from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from supabase import create_client, Client

# --- SETUP ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- MODELS ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    username: str

class CardCreate(BaseModel):
    merchant_id: str
    card_name: str
    barcode: str
    notes: Optional[str] = None
    is_favorite: bool = False
    image_base64: Optional[str] = None

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None

# --- DATABASE CONNECTION ---
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

try:
    if not all([SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY]):
        raise ValueError("Missing Supabase environment variables")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("✅ Full-Stack Database Engine Initialized")
except Exception as e:
    logger.error(f"❌ Database Initialization Failed: {e}")
    supabase = supabase_admin = None

# --- AUTH DEPENDENCY ---
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.replace("Bearer ", "")
    try:
        user_res = supabase_admin.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid session")
        return user_res.user
    except Exception:
        raise HTTPException(status_code=401, detail="Session expired")

# --- APP SETUP ---
app = FastAPI(title="LoyWallet Pro API", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
async def root():
    return {"status": "online", "engine": "FastAPI 0.110.1", "db": supabase is not None}

api_router = APIRouter(prefix="/api")

# --- AUTHENTICATION ---
@api_router.post("/auth/signup")
async def signup(data: SignupRequest):
    try:
        # 1. Create Auth User
        res = supabase.auth.sign_up({
            "email": data.email, 
            "password": data.password,
            "options": {"data": {"full_name": data.full_name, "username": data.username}}
        })
        if res.user:
            # 2. Sync to Public Table (Admin bypass RLS)
            supabase_admin.table("users").upsert({
                "user_id": res.user.id,
                "email": data.email,
                "full_name": data.full_name,
                "username": data.username
            }).execute()
        return res
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/login")
async def login(data: LoginRequest):
    try:
        res = supabase.auth.sign_in_with_password({"email": data.email, "password": data.password})
        return res
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")

# --- USER PROFILE ---
@api_router.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    res = supabase_admin.table("users").select("*").eq("user_id", user.id).single().execute()
    return res.data

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, user=Depends(get_current_user)):
    res = supabase_admin.table("users").update(data.dict(exclude_unset=True)).eq("user_id", user.id).execute()
    return res.data[0]

# --- MERCHANTS ---
@api_router.get("/merchants")
async def get_merchants():
    res = supabase.table("merchants").select("*").eq("is_active", True).order("name").execute()
    return res.data

@api_router.get("/merchants-grouped")
async def get_merchants_grouped(search: Optional[str] = None, favorites_only: bool = False, user=Depends(get_current_user)):
    # Complex query joining cards and merchants for the "My Wallet" view
    query = supabase_admin.table("loyalty_cards_with_merchants").select("*").eq("user_id", user.id)
    if search:
        query = query.ilike("card_name", f"%{search}%")
    if favorites_only:
        query = query.eq("is_favorite", True)
    
    cards = query.execute().data
    
    # Group by merchant as expected by the frontend
    grouped: Dict[str, Any] = {}
    for c in cards:
        m_id = c["merchant_id"]
        if m_id not in grouped:
            grouped[m_id] = {
                "merchant_id": m_id,
                "merchant_name": c["merchant_name"],
                "merchant_logo_url": c["merchant_logo_url"],
                "card_count": 0,
                "cards": []
            }
        grouped[m_id]["cards"].append(c)
        grouped[m_id]["card_count"] += 1
    
    return list(grouped.values())

# --- LOYALTY CARDS ---
@api_router.get("/cards")
async def get_cards(user=Depends(get_current_user)):
    res = supabase_admin.table("loyalty_cards_with_merchants").select("*").eq("user_id", user.id).execute()
    return res.data

@api_router.post("/cards")
async def create_card(card: CardCreate, user=Depends(get_current_user)):
    card_data = card.dict()
    card_data["user_id"] = user.id
    res = supabase_admin.table("loyalty_cards").insert(card_data).execute()
    return res.data[0]

@api_router.put("/cards/{card_id}")
async def update_card(card_id: str, updates: Dict[str, Any], user=Depends(get_current_user)):
    res = supabase_admin.table("loyalty_cards").update(updates).eq("id", card_id).eq("user_id", user.id).execute()
    return {"status": "success", "data": res.data[0]}

@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str, user=Depends(get_current_user)):
    supabase_admin.table("loyalty_cards").delete().eq("id", card_id).eq("user_id", user.id).execute()
    return {"status": "success"}

@api_router.put("/cards/{card_id}/favorite")
async def toggle_favorite(card_id: str, is_favorite: bool, user=Depends(get_current_user)):
    supabase_admin.table("loyalty_cards").update({"is_favorite": is_favorite}).eq("id", card_id).eq("user_id", user.id).execute()
    return {"status": "success"}

# --- STATISTICS ---
@api_router.get("/stats")
async def get_stats(user=Depends(get_current_user)):
    cards = supabase_admin.table("loyalty_cards").select("id, is_favorite, merchant_id").eq("user_id", user.id).execute().data
    return {
        "total_cards": len(cards),
        "favorite_cards": len([c for c in cards if c["is_favorite"]]),
        "total_merchants": len(set([c["merchant_id"] for c in cards]))
    }

@api_router.get("/profile/export")
async def export_data(user=Depends(get_current_user)):
    profile = supabase_admin.table("users").select("*").eq("user_id", user.id).single().execute().data
    cards = supabase_admin.table("loyalty_cards_with_merchants").select("*").eq("user_id", user.id).execute().data
    return {
        "status": "success",
        "export_date": datetime.now(timezone.utc).isoformat(),
        "user": profile,
        "loyalty_cards": cards
    }

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
