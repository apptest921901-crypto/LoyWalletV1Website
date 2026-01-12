from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
import os
import logging
import traceback
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Union
from datetime import datetime
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Robust Environment Loading
ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'
load_dotenv(env_path)

def get_env_var(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"CRITICAL ERROR: Variable '{name}' missing")
    return value

try:
    supabase_url = get_env_var('SUPABASE_URL')
    supabase_anon_key = get_env_var('SUPABASE_ANON_KEY')
    supabase_service_key = get_env_var('SUPABASE_SERVICE_KEY')
except RuntimeError as e:
    print(f"ERROR: {str(e)}")
    import sys
    sys.exit(1)

# Create Supabase clients
supabase: Client = create_client(supabase_url, supabase_anon_key)
supabase_admin: Client = create_client(supabase_url, supabase_service_key)

app = FastAPI(title="LoyWalletV1 Production API")

@app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/api/")

api_router = APIRouter(prefix="/api")

# --- MODELS ---
class UserProfile(BaseModel):
    user_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class Merchant(BaseModel):
    merchant_id: str
    name: str
    logo_url: Optional[str] = None
    category: Optional[str] = None

class LoyaltyCard(BaseModel):
    card_id: Optional[str] = None
    user_id: Optional[str] = None
    merchant_id: Optional[str] = None
    card_name: Optional[str] = None
    barcode: Optional[str] = None
    is_favorite: Optional[bool] = False
    merchant_name: Optional[str] = None
    merchant_logo_url: Optional[str] = None
    image_base64: Optional[str] = None
    notes: Optional[str] = ""

class MerchantGroup(BaseModel):
    merchant_name: str
    merchant_id: str
    merchant_logo_url: Optional[str] = None
    card_count: int
    cards: List[LoyaltyCard]

class StatsResponse(BaseModel):
    total_cards: int
    favorite_cards: int
    total_merchants: int

# --- UTILS ---
def verify_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Token")
    try:
        token = authorization.replace("Bearer ", "")
        user_res = supabase_admin.auth.get_user(token)
        if not user_res or not user_res.user:
            raise Exception("User not found")
        return user_res.user.id
    except Exception as e:
        print(f"AUTH ERROR: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Session")

# --- ROUTES ---
@api_router.get("/")
async def api_root():
    return {"message": "LoyWalletV1 API Running", "status": "ok"}

@api_router.get("/merchants", response_model=List[Merchant])
async def get_merchants():
    try:
        res = supabase_admin.table("merchants").select("*").eq("is_active", True).execute()
        return [{"merchant_id": m["merchant_id"], "name": m["name"], "logo_url": m.get("logo_url")} for m in res.data]
    except Exception: return []

@api_router.get("/merchants-grouped", response_model=List[MerchantGroup])
async def get_merchants_grouped(user_id: str = Depends(verify_token), search: Optional[str] = None, favorites_only: bool = False):
    try:
        res = supabase_admin.table("loyalty_cards").select("*, merchants!loyalty_cards_merchant_id_fkey(name, logo_url)").eq("user_id", user_id).execute()
        if not res.data: return []
        groups = {}
        for card in res.data:
            m_info = card.get("merchants") or {}
            m_id = str(card.get("merchant_id", "unknown"))
            m_name = m_info.get("name") or card.get("card_name", "Unknown Store")
            m_logo = m_info.get("logo_url")
            if favorites_only and not card.get("is_favorite"): continue
            if search and search.lower() not in m_name.lower() and search.lower() not in card.get("card_name", "").lower(): continue
            if m_id not in groups:
                groups[m_id] = {"merchant_name": m_name, "merchant_id": m_id, "merchant_logo_url": m_logo, "card_count": 0, "cards": []}
            groups[m_id]["cards"].append({"card_id": str(card["id"]), "user_id": str(card["user_id"]), "merchant_id": m_id, "card_name": card["card_name"], "barcode": card["barcode"], "is_favorite": card.get("is_favorite", False), "merchant_name": m_name, "merchant_logo_url": m_info.get("logo_url"), "image_base64": card.get("image_base64")})
            groups[m_id]["card_count"] += 1
        return [g for g in groups.values() if g["card_count"] > 0]
    except Exception as e:
        print(f"GROUPING ERROR: {str(e)}")
        return []

@api_router.get("/cards/quick", response_model=List[LoyaltyCard])
async def get_quick_cards(user_id: str = Depends(verify_token)):
    try:
        res = supabase_admin.table("loyalty_cards").select("*, merchants!loyalty_cards_merchant_id_fkey(name, logo_url)").eq("user_id", user_id).eq("is_favorite", True).limit(5).execute()
        cards = []
        for card in res.data:
            m_info = card.get("merchants") or {}
            cards.append({"card_id": str(card.get("id")), "user_id": str(card.get("user_id")), "merchant_id": str(card.get("merchant_id")), "card_name": card.get("card_name"), "barcode": card.get("barcode"), "is_favorite": True, "merchant_name": m_info.get("name") or "Unknown", "merchant_logo_url": m_info.get("logo_url"), "image_base64": card.get("image_base64")})
        return cards
    except Exception as e: return []

@api_router.get("/cards/{card_id}", response_model=LoyaltyCard)
async def get_card(card_id: str, user_id: str = Depends(verify_token)):
    try:
        res = supabase_admin.table("loyalty_cards").select("*, merchants!loyalty_cards_merchant_id_fkey(name, logo_url)").eq("id", card_id).eq("user_id", user_id).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Not found")
        card = res.data[0]
        m_info = card.get("merchants") or {}
        return {"card_id": str(card.get("id")), "user_id": str(card.get("user_id")), "merchant_id": str(card.get("merchant_id")), "card_name": card.get("card_name"), "barcode": card.get("barcode"), "is_favorite": card.get("is_favorite", False), "merchant_name": m_info.get("name"), "merchant_logo_url": m_info.get("logo_url"), "image_base64": card.get("image_base64"), "notes": card.get("notes", "")}
    except Exception: raise HTTPException(status_code=404, detail="Card not found")

@api_router.put("/cards/{card_id}")
async def update_card(card_id: str, card_update: dict, user_id: str = Depends(verify_token)):
    """General endpoint to update card details (name, barcode, notes, image, etc.)"""
    try:
        # EXPERT FIX: Filter allowed fields to prevent database mismatch
        allowed_fields = ["card_name", "barcode", "notes", "is_favorite", "image_base64", "merchant_id"]
        update_data = {k: v for k, v in card_update.items() if k in allowed_fields}
        
        if not update_data:
            raise Exception("No valid fields to update")

        res = supabase_admin.table("loyalty_cards").update(update_data).eq("id", card_id).eq("user_id", user_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Card not found or unauthorized")
            
        return {"status": "success", "message": "Card updated successfully"}
    except Exception as e:
        print(f"UPDATE ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to update card")

@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str, user_id: str = Depends(verify_token)):
    try:
        res = supabase_admin.table("loyalty_cards").delete().eq("id", card_id).eq("user_id", user_id).execute()
        return {"status": "deleted"}
    except Exception: raise HTTPException(status_code=400, detail="Delete failed")

@api_router.post("/auth/signup")
async def signup(data: dict):
    try:
        auth_res = supabase_admin.auth.admin.create_user({"email": data["email"], "password": data["password"], "email_confirm": False})
        user_id = auth_res.user.id
        profile = {"user_id": user_id, "email": data["email"], "full_name": data.get("full_name"), "username": data.get("username")}
        supabase_admin.table("users").insert(profile).execute()
        return {"message": "Verification email sent. Please check your inbox."}
    except Exception as e:
        print(f"SIGNUP ERROR: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/login")
async def login(data: dict):
    try:
        res = supabase.auth.sign_in_with_password({"email": data["email"], "password": data["password"]})
        profile = supabase_admin.table("users").select("*").eq("user_id", res.user.id).single().execute()
        return {"user": profile.data, "session": {"access_token": res.session.access_token}}
    except Exception as e:
        error_msg = str(e)
        if "Email not confirmed" in error_msg:
            raise HTTPException(status_code=401, detail="Please verify your email before logging in.")
        raise HTTPException(status_code=401, detail="Invalid Credentials")

@api_router.put("/profile")
async def update_profile(profile_data: dict, user_id: str = Depends(verify_token)):
    try:
        allowed = ["full_name", "username", "avatar_url"]
        update_map = {k: v for k, v in profile_data.items() if k in allowed}
        res = supabase_admin.table("users").update(update_map).eq("user_id", user_id).execute()
        return res.data[0]
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/forgot-password")
async def forgot_password(data: dict):
    try:
        email = data.get("email")
        if not email: raise HTTPException(status_code=400, detail="Email is required")
        supabase.auth.reset_password_for_email(email, {"redirect_to": "loywalletv1://reset-password"})
        return {"message": "Reset email sent"}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/stats", response_model=StatsResponse)
async def get_stats(user_id: str = Depends(verify_token)):
    try:
        res = supabase_admin.table("loyalty_cards").select("id, is_favorite, merchant_id").eq("user_id", user_id).execute()
        if not res.data: return {"total_cards": 0, "favorite_cards": 0, "total_merchants": 0}
        total = len(res.data)
        favs = len([c for c in res.data if c.get("is_favorite")])
        merchs = len(set([c["merchant_id"] for c in res.data]))
        return {"total_cards": total, "favorite_cards": favs, "total_merchants": merchs}
    except Exception: return {"total_cards": 0, "favorite_cards": 0, "total_merchants": 0}

@api_router.post("/cards")
async def create_card(card: dict, user_id: str = Depends(verify_token)):
    try:
        db_data = {"user_id": user_id, "merchant_id": card["merchant_id"], "card_name": card["card_name"], "barcode": card["barcode"], "notes": card.get("notes", ""), "is_favorite": card.get("is_favorite", False), "image_base64": card.get("image_base64", "")}
        res = supabase_admin.table("loyalty_cards").insert(db_data).execute()
        return {"status": "success", "id": res.data[0]["id"]}
    except Exception as e: raise HTTPException(status_code=400, detail="Save failed")

@api_router.put("/cards/{card_id}/favorite")
async def toggle_favorite(card_id: str, is_favorite: bool, user_id: str = Depends(verify_token)):
    try:
        res = supabase_admin.table("loyalty_cards").update({"is_favorite": is_favorite}).eq("id", card_id).eq("user_id", user_id).execute()
        return {"message": "Updated"}
    except Exception as e:
        print(f"FAVORITE ERROR: {e}")
        raise HTTPException(status_code=400, detail=str(e))

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
