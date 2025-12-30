from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from supabase import create_client, Client
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase connection
supabase_url = os.environ['SUPABASE_URL']
supabase_anon_key = os.environ['SUPABASE_ANON_KEY']
supabase_service_key = os.environ['SUPABASE_SERVICE_KEY']

# Note: JWT verification is handled by Supabase client library
# No additional JWT secret needed

# Create Supabase clients
supabase: Client = create_client(supabase_url, supabase_anon_key)
supabase_admin: Client = create_client(supabase_url, supabase_service_key)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserSignup(BaseModel):
    email: str
    password: str
    full_name: str
    username: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    created_at: Optional[datetime] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None

class Merchant(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    category: Optional[str] = None
    website: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class LoyaltyCard(BaseModel):
    id: Optional[int] = None
    user_id: Optional[str] = None
    merchant_id: int
    card_name: str
    barcode: str
    notes: Optional[str] = ""
    image_base64: Optional[str] = ""
    is_favorite: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Joined data
    merchant_name: Optional[str] = None
    merchant_logo_url: Optional[str] = None
    merchant_category: Optional[str] = None

class LoyaltyCardCreate(BaseModel):
    merchant_id: int
    card_name: str
    barcode: str
    notes: Optional[str] = ""
    image_base64: Optional[str] = ""
    is_favorite: bool = False

class LoyaltyCardUpdate(BaseModel):
    card_name: Optional[str] = None
    barcode: Optional[str] = None
    notes: Optional[str] = None
    image_base64: Optional[str] = None
    is_favorite: Optional[bool] = None
    merchant_id: Optional[int] = None

class MerchantGroup(BaseModel):
    merchant_name: str
    merchant_id: int
    merchant_logo_url: Optional[str] = None
    card_count: int
    cards: List[LoyaltyCard]

class StatsResponse(BaseModel):
    total_cards: int
    favorite_cards: int
    total_merchants: int

# Helper function to verify JWT and extract user_id
def verify_token(authorization: Optional[str] = Header(None)) -> str:
    """Extract and verify user_id from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        # Extract token from "Bearer <token>"
        token = authorization.replace("Bearer ", "")
        
        # Verify token using Supabase client
        response = supabase_admin.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return response.user.id
    except Exception as e:
        logging.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# Auth Routes
@api_router.post("/auth/signup")
async def signup(user: UserSignup):
    """Register a new user"""
    try:
        # Create auth user in Supabase
        auth_response = supabase_admin.auth.admin_create_user({
            "email": user.email,
            "password": user.password,
            "email_confirm": True  # Auto-confirm for development
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create user")
        
        user_id = auth_response.user.id
        
        # Create user profile
        profile_data = {
            "id": user_id,
            "email": user.email,
            "full_name": user.full_name,
            "username": user.username
        }
        
        profile_response = supabase_admin.table("users").insert(profile_data).execute()
        
        # Sign in the user to get session tokens
        sign_in_response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        
        return {
            "message": "User created successfully",
            "user": profile_response.data[0] if profile_response.data else None,
            "session": {
                "access_token": sign_in_response.session.access_token,
                "refresh_token": sign_in_response.session.refresh_token
            }
        }
    except Exception as e:
        logging.error(f"Signup error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    """Login user"""
    try:
        response = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        
        if not response.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Get user profile
        user_profile = supabase_admin.table("users").select("*").eq("id", response.user.id).single().execute()
        
        return {
            "message": "Login successful",
            "user": user_profile.data,
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token
            }
        }
    except Exception as e:
        logging.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Invalid email or password")

# User Profile Routes
@api_router.get("/profile", response_model=UserProfile)
async def get_profile(user_id: str = Depends(verify_token)):
    """Get current user's profile"""
    try:
        response = supabase_admin.table("users").select("*").eq("id", user_id).single().execute()
        return response.data
    except Exception as e:
        logging.error(f"Error fetching profile: {e}")
        raise HTTPException(status_code=404, detail="Profile not found")

@api_router.put("/profile", response_model=UserProfile)
async def update_profile(profile_update: UserProfileUpdate, user_id: str = Depends(verify_token)):
    """Update current user's profile"""
    try:
        update_data = {k: v for k, v in profile_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        response = supabase_admin.table("users").update(update_data).eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating profile: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# Merchant Routes
@api_router.get("/merchants", response_model=List[Merchant])
async def get_merchants(search: Optional[str] = None):
    """Get all active merchants (public endpoint)"""
    try:
        query = supabase_admin.table("merchants").select("*").eq("is_active", True)
        
        if search:
            query = query.ilike("name", f"%{search}%")
        
        response = query.order("name").execute()
        return response.data
    except Exception as e:
        logging.error(f"Error fetching merchants: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Loyalty Card Routes
@api_router.post("/cards", response_model=LoyaltyCard)
async def create_card(card: LoyaltyCardCreate, user_id: str = Depends(verify_token)):
    """Create a new loyalty card"""
    try:
        # Check if merchant exists
        merchant_response = supabase_admin.table("merchants").select("id").eq("id", card.merchant_id).execute()
        if not merchant_response.data:
            raise HTTPException(status_code=404, detail="Merchant not found")
        
        # Create card
        card_data = {
            "user_id": user_id,
            "merchant_id": card.merchant_id,
            "card_name": card.card_name,
            "barcode": card.barcode,
            "notes": card.notes,
            "image_base64": card.image_base64,
            "is_favorite": card.is_favorite
        }
        
        response = supabase_admin.table("loyalty_cards").insert(card_data).execute()
        
        if response.data:
            # Fetch the created card with merchant details
            card_id = response.data[0]["id"]
            card_response = supabase_admin.table("loyalty_cards").select(
                "*, merchant:merchants(id, name, logo_url, category)"
            ).eq("id", card_id).single().execute()
            
            # Flatten merchant data
            result = card_response.data
            if result.get("merchant"):
                result["merchant_name"] = result["merchant"]["name"]
                result["merchant_logo_url"] = result["merchant"].get("logo_url")
                result["merchant_category"] = result["merchant"].get("category")
            
            return result
        
        raise HTTPException(status_code=500, detail="Failed to create card")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating card: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/cards", response_model=List[LoyaltyCard])
async def get_cards(user_id: str = Depends(verify_token), search: Optional[str] = None, favorites_only: bool = False):
    """Get all cards with optional search and favorite filter"""
    try:
        query = supabase_admin.table("loyalty_cards").select(
            "*, merchant:merchants(id, name, logo_url, category)"
        ).eq("user_id", user_id)
        
        if favorites_only:
            query = query.eq("is_favorite", True)
        
        if search:
            query = query.or_(f"card_name.ilike.%{search}%,barcode.ilike.%{search}%,notes.ilike.%{search}%")
        
        response = query.order("created_at", desc=True).execute()
        
        # Flatten merchant data for each card
        cards = []
        for card in response.data:
            if card.get("merchant"):
                card["merchant_name"] = card["merchant"]["name"]
                card["merchant_logo_url"] = card["merchant"].get("logo_url")
                card["merchant_category"] = card["merchant"].get("category")
            cards.append(card)
        
        return cards
    except Exception as e:
        logging.error(f"Error fetching cards: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/cards/{card_id}", response_model=LoyaltyCard)
async def get_card(card_id: int, user_id: str = Depends(verify_token)):
    """Get a specific card by ID"""
    try:
        response = supabase_admin.table("loyalty_cards").select(
            "*, merchant:merchants(id, name, logo_url, category)"
        ).eq("id", card_id).eq("user_id", user_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Card not found")
        
        # Flatten merchant data
        result = response.data
        if result.get("merchant"):
            result["merchant_name"] = result["merchant"]["name"]
            result["merchant_logo_url"] = result["merchant"].get("logo_url")
            result["merchant_category"] = result["merchant"].get("category")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching card: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/cards/{card_id}", response_model=LoyaltyCard)
async def update_card(card_id: int, card_update: LoyaltyCardUpdate, user_id: str = Depends(verify_token)):
    """Update a card"""
    try:
        update_data = {k: v for k, v in card_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        response = supabase_admin.table("loyalty_cards").update(update_data).eq(
            "id", card_id
        ).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Card not found")
        
        # Fetch updated card with merchant details
        card_response = supabase_admin.table("loyalty_cards").select(
            "*, merchant:merchants(id, name, logo_url, category)"
        ).eq("id", card_id).single().execute()
        
        # Flatten merchant data
        result = card_response.data
        if result.get("merchant"):
            result["merchant_name"] = result["merchant"]["name"]
            result["merchant_logo_url"] = result["merchant"].get("logo_url")
            result["merchant_category"] = result["merchant"].get("category")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating card: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: int, user_id: str = Depends(verify_token)):
    """Delete a card"""
    try:
        response = supabase_admin.table("loyalty_cards").delete().eq(
            "id", card_id
        ).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Card not found")
        
        return {"message": "Card deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting card: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/cards/{card_id}/favorite")
async def toggle_favorite(card_id: int, is_favorite: bool, user_id: str = Depends(verify_token)):
    """Toggle favorite status of a card"""
    try:
        response = supabase_admin.table("loyalty_cards").update(
            {"is_favorite": is_favorite}
        ).eq("id", card_id).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Card not found")
        
        return {"message": "Favorite status updated"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error toggling favorite: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/merchants-grouped", response_model=List[MerchantGroup])
async def get_merchants_grouped(user_id: str = Depends(verify_token), search: Optional[str] = None, favorites_only: bool = False):
    """Get cards grouped by merchant"""
    try:
        query = supabase_admin.table("loyalty_cards").select(
            "*, merchant:merchants(id, name, logo_url, category)"
        ).eq("user_id", user_id)
        
        if favorites_only:
            query = query.eq("is_favorite", True)
        
        if search:
            query = query.or_(f"card_name.ilike.%{search}%,barcode.ilike.%{search}%,notes.ilike.%{search}%")
        
        response = query.order("merchant_id").execute()
        
        # Group cards by merchant
        merchants_dict = {}
        for card in response.data:
            merchant_id = card["merchant_id"]
            merchant_data = card.get("merchant", {})
            
            # Flatten merchant data in card
            card["merchant_name"] = merchant_data.get("name", "Unknown")
            card["merchant_logo_url"] = merchant_data.get("logo_url")
            card["merchant_category"] = merchant_data.get("category")
            
            if merchant_id not in merchants_dict:
                merchants_dict[merchant_id] = {
                    "merchant_id": merchant_id,
                    "merchant_name": merchant_data.get("name", "Unknown"),
                    "merchant_logo_url": merchant_data.get("logo_url"),
                    "card_count": 0,
                    "cards": []
                }
            
            merchants_dict[merchant_id]["cards"].append(card)
            merchants_dict[merchant_id]["card_count"] += 1
        
        # Convert to list
        merchant_groups = list(merchants_dict.values())
        
        return merchant_groups
    except Exception as e:
        logging.error(f"Error fetching merchants grouped: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/stats", response_model=StatsResponse)
async def get_stats(user_id: str = Depends(verify_token)):
    """Get statistics about cards"""
    try:
        # Get all cards
        all_cards_response = supabase_admin.table("loyalty_cards").select(
            "id, merchant_id, is_favorite"
        ).eq("user_id", user_id).execute()
        
        total_cards = len(all_cards_response.data)
        favorite_cards = len([c for c in all_cards_response.data if c.get("is_favorite")])
        
        # Get unique merchants
        unique_merchants = set([c["merchant_id"] for c in all_cards_response.data])
        total_merchants = len(unique_merchants)
        
        return {
            "total_cards": total_cards,
            "favorite_cards": favorite_cards,
            "total_merchants": total_merchants
        }
    except Exception as e:
        logging.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "LoyaltyApp API with Supabase Auth"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
