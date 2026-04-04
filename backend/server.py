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
from datetime import datetime
from supabase import create_client, Client

# --- VERSION 1.0.1: STABLE BASELINE ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_ANON_KEY'])
supabase_admin: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

app = FastAPI(title="LoyWalletV1 API", version="1.0.1")

# --- ROOT ROUTE: Health check for base URL ---
@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "LoyWalletV1 API",
        "version": "1.0.1",
        "docs": "/docs",
        "health": "/api/health"
    }

# --- CYBER SECURITY: LOCAL & PROD CORS ---
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

current_ip = get_local_ip()
origins = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    f"http://{current_ip}:8081",
    f"http://{current_ip}:5500",
    "https://auth.expo.io",
    "https://loywalletv1.expo.app",
    "https://loywallet.io",
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
    name: str
    email: EmailStr
    subject: str
    message: str

class Merchant(BaseModel):
    merchant_id: str
    name: str
    logo_url: Optional[str] = None

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

class StatsResponse(BaseModel):
    total_cards: int
    favorite_cards: int
    total_merchants: int

# --- EMAIL SECURE RELAY ---
def send_relay_email(ticket: SupportTicket):
    try:
        smtp_user = os.getenv('SMTP_USER')
        smtp_pass = os.getenv('SMTP_PASS')
        if not smtp_user or not smtp_pass:
            logger.error("SMTP Credentials missing from .env")
            return False

        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = smtp_user 
        msg['Reply-To'] = ticket.email
        msg['Subject'] = f"WEBSITE SUPPORT: {ticket.subject}"
        msg.attach(MIMEText(f"From: {ticket.name}\nEmail: {ticket.email}\n\n{ticket.message}", 'plain'))

        server = smtplib.SMTP(os.getenv('SMTP_HOST', 'smtp.zoho.com'), int(os.getenv('SMTP_PORT', 587)), timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        logger.error(f"ZOHO RELAY ERROR: {str(e)}")
        return False

# --- ROUTES ---
@api_router.post("/support")
async def handle_support(ticket: SupportTicket):
    if send_relay_email(ticket):
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Mail relay failed")

@api_router.get("/health")
async def health_check():
    """Health check endpoint with email configuration status"""
    site_url = os.getenv('SITE_URL', 'https://apptest921901-crypto.github.io/LoyWalletV1Website')
    return {
        "status": "healthy",
        "version": "1.0.1",
        "email_config": {
            "site_url": site_url,
            "callback_url": f"{site_url.rstrip('/')}/auth/callback",
            "smtp_configured": bool(os.getenv('SMTP_USER') and os.getenv('SMTP_PASS'))
        }
    }

@api_router.get("/merchants", response_model=List[Merchant])
async def get_merchants():
    try:
        res = supabase_admin.table("merchants").select("*").eq("is_active", True).execute()
        return [{"merchant_id": m["merchant_id"], "name": m["name"], "logo_url": m.get("logo_url")} for m in res.data]
    except Exception: return []

@api_router.post("/auth/signup")
async def signup(data: dict):
    try:
        logger.info(f"Signup attempt for email: {data.get('email')}")
        # Get the backend URL for email confirmation redirect
        # Get SITE_URL from env - must be configured for email links to work
        # Uses web fallback (GitHub Pages) which redirects to mobile app
        site_url = os.getenv('SITE_URL', 'https://apptest921901-crypto.github.io/LoyWalletV1Website')
        
        # Validate site_url - must be HTTPS in production
        if not site_url.startswith(('http://', 'https://', 'exp://')):
            logger.error(f"Invalid SITE_URL configuration: {site_url}")
            raise HTTPException(status_code=500, detail="Server configuration error")
        
        email_redirect_url = f"{site_url.rstrip('/')}/auth-callback.html"
        logger.info(f"Email redirect URL: {email_redirect_url}")
        
        # Use direct HTTP request to Supabase Auth API to ensure email_redirect_to works
        import httpx
        
        signup_payload = {
            "email": data["email"],
            "password": data["password"],
            "options": {
                "data": {
                    "full_name": data.get("full_name", ""),
                    "username": data.get("username", "")
                },
                "email_redirect_to": email_redirect_url
            }
        }
        
        logger.info(f"Calling Supabase Auth API directly with redirect: {email_redirect_url}")
        
        try:
            async with httpx.AsyncClient() as client:
                auth_response = await client.post(
                    f"{os.environ['SUPABASE_URL']}/auth/v1/signup",
                    headers={
                        "apikey": os.environ['SUPABASE_ANON_KEY'],
                        "Content-Type": "application/json"
                    },
                    json=signup_payload,
                    timeout=30.0
                )
                
                logger.info(f"Supabase auth response status: {auth_response.status_code}")
                logger.info(f"Supabase auth response body: {auth_response.text}")
                
                if auth_response.status_code != 200:
                    logger.error(f"Supabase auth error: {auth_response.text}")
                    raise HTTPException(status_code=400, detail=f"Failed to create user account: {auth_response.text}")
                
                auth_data = auth_response.json()
                logger.info(f"Auth data received: {auth_data}")
        except Exception as http_error:
            logger.error(f"HTTP request to Supabase auth failed: {str(http_error)}")
            raise HTTPException(status_code=500, detail=f"Auth service error: {str(http_error)}")
            
        # Create a mock user object for compatibility with existing code
        class MockUser:
            def __init__(self, data):
                self.id = data.get('id')
                self.email = data.get('email')
                self.email_confirmed_at = data.get('email_confirmed_at')
                self.created_at = data.get('created_at')
                
        res = type('obj', (object,), {
            'user': MockUser(auth_data)
        })()
        
        if not res.user:
            logger.error("Supabase signup returned no user")
            raise HTTPException(status_code=400, detail="Failed to create user account")
        
        # DEBUG: Log full Supabase response for email confirmation diagnosis
        logger.info(f"=== SIGNUP DEBUG ===")
        logger.info(f"User ID: {res.user.id}")
        logger.info(f"Email: {res.user.email}")
        logger.info(f"Email Confirmed At: {res.user.email_confirmed_at}")
        logger.info(f"Created At: {res.user.created_at}")
        logger.info(f"Confirmation Sent: {res.user.email_confirmed_at is None}")
        logger.info(f"Redirect URL Used: {email_redirect_url}")
        logger.info(f"=== END DEBUG ===")
            
        logger.info(f"Supabase auth signup success, user_id: {res.user.id}")
        
        # Check if email confirmation was triggered
        # In Supabase, if email confirmation is enabled, user.email_confirmed_at will be None
        email_confirmation_sent = res.user.email_confirmed_at is None
        logger.info(f"Email confirmation required: {email_confirmation_sent}")
        
        user_data = {
            "user_id": res.user.id,
            "email": data["email"],
            "full_name": data.get("full_name", ""),
            "username": data.get("username", "")
        }
        supabase_admin.table("users").insert(user_data).execute()
        logger.info(f"User profile inserted into database")
        
        return {
            "status": "success", 
            "message": "Verification email sent" if email_confirmation_sent else "Account created successfully",
            "email_confirmation_required": email_confirmation_sent
        }
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/resend-verification")
async def resend_verification(data: dict):
    """Resend email verification to user"""
    try:
        email = data.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        # Use same site_url logic as signup
        site_url = os.getenv('SITE_URL', 'https://apptest921901-crypto.github.io/LoyWalletV1Website')
        email_redirect_url = f"{site_url.rstrip('/')}/auth-callback.html"
        
        logger.info(f"Resending verification email to: {email}")
        
        supabase.auth.resend({
            "type": "signup",
            "email": email,
            "options": {
                "email_redirect_to": email_redirect_url
            }
        })
        return {"status": "success", "message": "Verification email resent"}
    except Exception as e:
        logger.error(f"Resend verification error: {str(e)}")
        raise HTTPException(status_code=400, detail="Could not resend verification email")

@api_router.post("/auth/login")
async def login(data: dict):
    try:
        logger.info(f"Login attempt for email: {data.get('email')}")
        res = supabase.auth.sign_in_with_password({"email": data["email"], "password": data["password"]})
        logger.info(f"Supabase auth success, user_id: {res.user.id}")
        profile = supabase_admin.table("users").select("*").eq("user_id", res.user.id).single().execute()
        logger.info(f"User profile fetched: {profile.data}")
        return {
            "user": profile.data,
            "session": {
                "access_token": res.session.access_token,
                "refresh_token": res.session.refresh_token
            }
        }
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Credentials")

@api_router.get("/cards")
async def get_cards(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("loyalty_cards").select("*").eq("user_id", user.user.id).execute()
    cards = res.data
    # Enrich with merchant data and map id to card_id
    for card in cards:
        card["card_id"] = str(card.pop("id", ""))
        if card.get("merchant_id"):
            merchant = supabase_admin.table("merchants").select("name,logo_url").eq("merchant_id", card["merchant_id"]).single().execute()
            if merchant.data:
                card["merchant_name"] = merchant.data.get("name")
                card["merchant_logo_url"] = merchant.data.get("logo_url")
    return cards

@api_router.get("/cards/quick")
async def get_quick_cards(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("loyalty_cards").select("*").eq("user_id", user.user.id).limit(5).execute()
    cards = res.data
    # Enrich with merchant data and map id to card_id
    for card in cards:
        card["card_id"] = str(card.pop("id", ""))
        if card.get("merchant_id"):
            merchant = supabase_admin.table("merchants").select("name,logo_url").eq("merchant_id", card["merchant_id"]).single().execute()
            if merchant.data:
                card["merchant_name"] = merchant.data.get("name")
                card["merchant_logo_url"] = merchant.data.get("logo_url")
    return cards

@api_router.get("/cards/{card_id}")
async def get_card(card_id: str, authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("loyalty_cards").select("*").eq("id", card_id).eq("user_id", user.user.id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Card not found")
    card = res.data
    # Map id to card_id and enrich with merchant data
    card["card_id"] = str(card.pop("id", ""))
    if card.get("merchant_id"):
        merchant = supabase_admin.table("merchants").select("name,logo_url").eq("merchant_id", card["merchant_id"]).single().execute()
        if merchant.data:
            card["merchant_name"] = merchant.data.get("name")
            card["merchant_logo_url"] = merchant.data.get("logo_url")
    return card

@api_router.put("/cards/{card_id}")
async def update_card(card_id: str, data: dict, authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    # Verify card belongs to user
    existing = supabase_admin.table("loyalty_cards").select("id").eq("id", card_id).eq("user_id", user.user.id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Card not found")
    # Update allowed fields
    update_fields = ["card_name", "barcode", "notes", "image_base64", "is_favorite"]
    update_data = {k: v for k, v in data.items() if k in update_fields}
    res = supabase_admin.table("loyalty_cards").update(update_data).eq("id", card_id).execute()
    return {"status": "success"}

@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str, authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    # Verify card belongs to user
    existing = supabase_admin.table("loyalty_cards").select("id").eq("id", card_id).eq("user_id", user.user.id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Card not found")
    supabase_admin.table("loyalty_cards").delete().eq("id", card_id).execute()
    return {"status": "success"}

@api_router.put("/cards/{card_id}/favorite")
async def toggle_favorite(card_id: str, is_favorite: bool = True, authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    # Verify card belongs to user
    existing = supabase_admin.table("loyalty_cards").select("id").eq("id", card_id).eq("user_id", user.user.id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Card not found")
    supabase_admin.table("loyalty_cards").update({"is_favorite": is_favorite}).eq("id", card_id).execute()
    return {"status": "success"}

@api_router.post("/cards")
async def create_card(card: dict, authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    token = authorization.replace("Bearer ", "")
    user = supabase_admin.auth.get_user(token)
    db_data = {"user_id": user.user.id, "merchant_id": card["merchant_id"], "card_name": card["card_name"], "barcode": card["barcode"], "notes": card.get("notes", ""), "image_base64": card.get("image_base64", ""), "is_favorite": card.get("is_favorite", False)}
    res = supabase_admin.table("loyalty_cards").insert(db_data).execute()
    return {"status": "success", "id": res.data[0]["id"]}

@api_router.get("/merchants-grouped")
async def get_merchants_grouped(authorization: Optional[str] = Header(None), search: Optional[str] = None, favorites_only: Optional[bool] = False):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    query = supabase_admin.table("loyalty_cards").select("*").eq("user_id", user.user.id)
    if favorites_only:
        query = query.eq("is_favorite", True)
    res = query.execute()
    cards = res.data
    
    # Fetch all merchants for lookup
    merchants_res = supabase_admin.table("merchants").select("merchant_id,name,logo_url").execute()
    merchant_lookup = {m["merchant_id"]: m for m in merchants_res.data}
    
    merchant_map = {}
    for card in cards:
        # Get merchant info from lookup
        merchant_id = card.get("merchant_id")
        merchant = merchant_lookup.get(merchant_id, {}) if merchant_id else {}
        merchant_name = merchant.get("name") or card.get("card_name", "Unknown")
        merchant_logo = merchant.get("logo_url")
        
        if search and search.lower() not in merchant_name.lower() and search.lower() not in card.get("card_name", "").lower():
            continue
        if merchant_name not in merchant_map:
            merchant_map[merchant_name] = {
                "merchant_name": merchant_name,
                "merchant_id": str(merchant_id) if merchant_id else "",
                "merchant_logo_url": merchant_logo,
                "card_count": 0,
                "cards": []
            }
        # Enrich card with merchant data and map id to card_id
        card["card_id"] = str(card.pop("id", ""))
        card["merchant_name"] = merchant_name
        card["merchant_logo_url"] = merchant_logo
        merchant_map[merchant_name]["cards"].append(card)
        merchant_map[merchant_name]["card_count"] += 1
    return list(merchant_map.values())

@api_router.get("/profile")
async def get_profile(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("users").select("*").eq("user_id", user.user.id).single().execute()
    return res.data

@api_router.put("/profile")
async def update_profile(data: dict, authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    update_data = {k: v for k, v in data.items() if k in ["full_name", "username", "avatar_url", "phone_number"]}
    res = supabase_admin.table("users").update(update_data).eq("user_id", user.user.id).execute()
    return res.data[0] if res.data else {}

@api_router.get("/stats", response_model=StatsResponse)
async def get_stats(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    res = supabase_admin.table("loyalty_cards").select("id, is_favorite, merchant_id").eq("user_id", user.user.id).execute()
    return {"total_cards": len(res.data), "favorite_cards": len([c for c in res.data if c.get("is_favorite")]), "total_merchants": len(set([c["merchant_id"] for c in res.data]))}

@api_router.delete("/profile")
async def delete_account(authorization: Optional[str] = Header(None)):
    """GDPR: Right to Erasure - Delete user account and all associated data"""
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    user_id = user.user.id
    
    try:
        # Delete all user's loyalty cards first (cascade delete)
        supabase_admin.table("loyalty_cards").delete().eq("user_id", user_id).execute()
        
        # Delete user record from users table
        supabase_admin.table("users").delete().eq("user_id", user_id).execute()
        
        # Delete user from Supabase Auth
        supabase_admin.auth.admin.delete_user(user_id)
        
        return {"status": "success", "message": "Account deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

@api_router.get("/profile/export")
async def export_user_data(authorization: Optional[str] = Header(None)):
    """GDPR: Right to Data Portability - Export all user data"""
    if not authorization: raise HTTPException(status_code=401)
    user = supabase_admin.auth.get_user(authorization.replace("Bearer ", ""))
    user_id = user.user.id
    
    try:
        # Get user profile
        user_res = supabase_admin.table("users").select("*").eq("user_id", user_id).single().execute()
        
        # Get all user's cards with merchant details
        cards_res = supabase_admin.table("loyalty_cards").select("*").eq("user_id", user_id).execute()
        
        # Enrich cards with merchant data
        cards = []
        for card in cards_res.data:
            merchant = supabase_admin.table("merchants").select("name, logo_url").eq("merchant_id", card.get("merchant_id")).single().execute()
            card_data = {
                "card_name": card.get("card_name"),
                "barcode": card.get("barcode"),
                "notes": card.get("notes"),
                "is_favorite": card.get("is_favorite"),
                "created_at": card.get("created_at"),
                "merchant": merchant.data if merchant.data else None
            }
            cards.append(card_data)
        
        export_data = {
            "export_date": str(datetime.now()),
            "user": {
                "full_name": user_res.data.get("full_name") if user_res.data else None,
                "username": user_res.data.get("username") if user_res.data else None,
                "email": user.user.email,
                "created_at": str(user.user.created_at) if user.user.created_at else None
            },
            "loyalty_cards": cards,
            "statistics": {
                "total_cards": len(cards),
                "favorite_cards": len([c for c in cards if c.get("is_favorite")])
            }
        }
        
        return export_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
