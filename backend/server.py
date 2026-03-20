from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
import os
import logging
import socket
import smtplib
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Union
from datetime import datetime
from supabase import create_client, Client

# --- STABLE CONFIGURATION ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
load_dotenv(ROOT_DIR / 'backend.env') 
load_dotenv(Path.cwd() / 'backend.env') # Also check current working directory

# Debug: Print environment status
print(f"--- ENV STATUS ---")
print(f"SMTP_USER: {'Set' if os.getenv('SMTP_USER') else 'NOT SET'}")
print(f"SMTP_PASS: {'Set' if os.getenv('SMTP_PASS') else 'NOT SET'}")
print(f"SUPABASE_URL: {'Set' if os.getenv('SUPABASE_URL') else 'NOT SET'}")
print(f"------------------")

supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_ANON_KEY'])
supabase_admin: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

app = FastAPI(title="LoyWalletV1 API", version="1.0.1")

# --- DYNAMIC LOCAL IP DETECTION ---
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
# THIS LINE MUST APPEAR IN YOUR TERMINAL
print(f"\n--- SECURITY BOOT: WHITELISTING IP {current_ip} ---\n")

origins = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    f"http://{current_ip}:8081",
    f"http://{current_ip}:5500",
    "https://auth.expo.io",
    "https://loywalletv1.expo.app",
    "https://loywallet.io",
    "https://apptest921901-crypto.github.io",
    "null", # Allow requests from local file system (file://)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local development and file:// access
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

# --- EMAIL SECURE RELAY ---
def send_relay_email(ticket: SupportTicket):
    try:
        smtp_user = os.getenv('SMTP_USER')
        smtp_pass = os.getenv('SMTP_PASS')
        if not smtp_user or not smtp_pass:
            print("ERROR: SMTP_USER or SMTP_PASS missing from .env")
            return False

        # Generate a unique ID for this request
        unique_id = str(uuid.uuid4())[:8].upper()
        
        # Determine the prefix based on keywords in the subject
        prefix = "SUPPORT"
        subject_lower = ticket.subject.lower()
        if "waitlist" in subject_lower:
            prefix = "WAITLIST"
        elif "notify" in subject_lower:
            prefix = "NOTIFY"

        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = smtp_user 
        msg['Reply-To'] = ticket.email
        msg['Subject'] = f"[{prefix} #{unique_id}] {ticket.subject}"
        
        body = f"Type: {prefix}\nTicket ID: #{unique_id}\nFrom: {ticket.name}\nEmail: {ticket.email}\n\nMessage:\n{ticket.message}"
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(os.getenv('SMTP_HOST', 'smtp.zoho.eu'), int(os.getenv('SMTP_PORT', 587)), timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"ZOHO RELAY ERROR: {str(e)}")
        return False

# --- ROUTES ---
@api_router.post("/support")
async def handle_support(ticket: SupportTicket):
    print(f"Received support ticket from: {ticket.email}")
    if send_relay_email(ticket):
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Mail relay failed")

@api_router.post("/auth/login")
async def login(data: dict):
    try:
        res = supabase.auth.sign_in_with_password({"email": data["email"], "password": data["password"]})
        user_id = res.user.id
        profile_res = supabase_admin.table("users").select("*").eq("user_id", user_id).execute()
        if not profile_res.data:
            new_profile = {"user_id": res.user.id, "email": data["email"], "full_name": data["email"].split('@')[0], "username": data["email"].split('@')[0]}
            supabase_admin.table("users").insert(new_profile).execute()
            profile_res = supabase_admin.table("users").select("*").eq("user_id", user_id).execute()
        return {"user": profile_res.data[0], "session": {"access_token": res.session.access_token}}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@api_router.get("/merchants", response_model=List[Merchant])
async def get_merchants():
    try:
        res = supabase_admin.table("merchants").select("*").eq("is_active", True).execute()
        return [{"merchant_id": str(m.get("merchant_id") or m.get("id")), "name": m["name"], "logo_url": m.get("logo_url")} for m in res.data]
    except Exception: return []

@api_router.post("/cards")
async def create_card(card: dict, authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    token = authorization.replace("Bearer ", "")
    user = supabase_admin.auth.get_user(token)
    user_id = user.user.id
    db_data = {"user_id": user_id, "merchant_id": card["merchant_id"], "card_name": card["card_name"], "barcode": card["barcode"], "notes": card.get("notes", ""), "image_base64": card.get("image_base64", ""), "is_favorite": card.get("is_favorite", False)}
    res = supabase_admin.table("loyalty_cards").insert(db_data).execute()
    return {"status": "success", "id": res.data[0]["id"]}

@api_router.delete("/account")
async def delete_account(authorization: Optional[str] = Header(None)):
    if not authorization: raise HTTPException(status_code=401)
    token = authorization.replace("Bearer ", "")
    user = supabase_admin.auth.get_user(token)
    user_id = user.user.id
    supabase_admin.auth.admin.delete_user(user.user.id)
    return {"status": "success"}

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
