from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase connection
supabase_url = os.environ['SUPABASE_URL']
supabase_anon_key = os.environ['SUPABASE_ANON_KEY']
supabase_service_key = os.environ['SUPABASE_SERVICE_KEY']

# Create Supabase clients
supabase: Client = create_client(supabase_url, supabase_anon_key)
supabase_admin: Client = create_client(supabase_url, supabase_service_key)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
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

# Helper function to get user_id from Supabase (for future auth implementation)
# For now, we'll use a default user_id
DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000"

def get_user_id_from_header(authorization: Optional[str] = Header(None)) -> str:
    """Extract user_id from Authorization header (future implementation)"""
    # TODO: Implement proper JWT verification with Supabase Auth
    # For MVP, return default user_id
    return DEFAULT_USER_ID

# Routes
@api_router.get("/")
async def root():
    return {"message": "LoyaltyApp API with Supabase"}

@api_router.get("/merchants", response_model=List[Merchant])
async def get_merchants(search: Optional[str] = None):
    """Get all active merchants"""
    try:
        query = supabase_admin.table("merchants").select("*").eq("is_active", True)
        
        if search:
            query = query.ilike("name", f"%{search}%")
        
        response = query.order("name").execute()
        return response.data
    except Exception as e:
        logging.error(f"Error fetching merchants: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/cards", response_model=LoyaltyCard)
async def create_card(card: LoyaltyCardCreate):
    """Create a new loyalty card"""
    try:
        user_id = DEFAULT_USER_ID
        
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
async def get_cards(search: Optional[str] = None, favorites_only: bool = False):
    """Get all cards with optional search and favorite filter"""
    try:
        user_id = DEFAULT_USER_ID
        
        query = supabase_admin.table("loyalty_cards").select(
            "*, merchant:merchants(id, name, logo_url, category)"
        ).eq("user_id", user_id)
        
        if favorites_only:
            query = query.eq("is_favorite", True)
        
        if search:
            # Search across card_name, barcode, and notes
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
async def get_card(card_id: int):
    """Get a specific card by ID"""
    try:
        user_id = DEFAULT_USER_ID
        
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
async def update_card(card_id: int, card_update: LoyaltyCardUpdate):
    """Update a card"""
    try:
        user_id = DEFAULT_USER_ID
        
        # Build update data
        update_data = {k: v for k, v in card_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update card
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
async def delete_card(card_id: int):
    """Delete a card"""
    try:
        user_id = DEFAULT_USER_ID
        
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
async def toggle_favorite(card_id: int, is_favorite: bool):
    """Toggle favorite status of a card"""
    try:
        user_id = DEFAULT_USER_ID
        
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
async def get_merchants_grouped(search: Optional[str] = None, favorites_only: bool = False):
    """Get cards grouped by merchant"""
    try:
        user_id = DEFAULT_USER_ID
        
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
async def get_stats():
    """Get statistics about cards"""
    try:
        user_id = DEFAULT_USER_ID
        
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
