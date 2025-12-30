from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class Card(BaseModel):
    id: Optional[str] = None
    merchant_name: str
    card_name: str
    barcode: str
    notes: Optional[str] = ""
    image_base64: Optional[str] = ""
    is_favorite: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CardCreate(BaseModel):
    merchant_name: str
    card_name: str
    barcode: str
    notes: Optional[str] = ""
    image_base64: Optional[str] = ""
    is_favorite: bool = False

class CardUpdate(BaseModel):
    merchant_name: Optional[str] = None
    card_name: Optional[str] = None
    barcode: Optional[str] = None
    notes: Optional[str] = None
    image_base64: Optional[str] = None
    is_favorite: Optional[bool] = None

class MerchantGroup(BaseModel):
    merchant_name: str
    card_count: int
    cards: List[Card]

class StatsResponse(BaseModel):
    total_cards: int
    favorite_cards: int
    total_merchants: int

# Helper function to convert MongoDB document to Card
def card_helper(card) -> dict:
    return {
        "id": str(card["_id"]),
        "merchant_name": card["merchant_name"],
        "card_name": card["card_name"],
        "barcode": card["barcode"],
        "notes": card.get("notes", ""),
        "image_base64": card.get("image_base64", ""),
        "is_favorite": card.get("is_favorite", False),
        "created_at": card.get("created_at", datetime.utcnow())
    }

# Routes
@api_router.get("/")
async def root():
    return {"message": "LoyaltyApp API"}

@api_router.post("/cards", response_model=Card)
async def create_card(card: CardCreate):
    """Create a new loyalty card"""
    card_dict = card.dict()
    card_dict["created_at"] = datetime.utcnow()
    
    result = await db.cards.insert_one(card_dict)
    new_card = await db.cards.find_one({"_id": result.inserted_id})
    
    return card_helper(new_card)

@api_router.get("/cards", response_model=List[Card])
async def get_cards(search: Optional[str] = None, favorites_only: bool = False):
    """Get all cards with optional search and favorite filter"""
    query = {}
    
    if favorites_only:
        query["is_favorite"] = True
    
    if search:
        query["$or"] = [
            {"merchant_name": {"$regex": search, "$options": "i"}},
            {"card_name": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}},
            {"notes": {"$regex": search, "$options": "i"}}
        ]
    
    cards = await db.cards.find(query).sort("created_at", -1).to_list(1000)
    return [card_helper(card) for card in cards]

@api_router.get("/cards/{card_id}", response_model=Card)
async def get_card(card_id: str):
    """Get a specific card by ID"""
    try:
        card = await db.cards.find_one({"_id": ObjectId(card_id)})
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        return card_helper(card)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid card ID")

@api_router.put("/cards/{card_id}", response_model=Card)
async def update_card(card_id: str, card_update: CardUpdate):
    """Update a card"""
    try:
        update_data = {k: v for k, v in card_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = await db.cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Card not found")
        
        updated_card = await db.cards.find_one({"_id": ObjectId(card_id)})
        return card_helper(updated_card)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str):
    """Delete a card"""
    try:
        result = await db.cards.delete_one({"_id": ObjectId(card_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Card not found")
        
        return {"message": "Card deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/cards/{card_id}/favorite")
async def toggle_favorite(card_id: str, is_favorite: bool):
    """Toggle favorite status of a card"""
    try:
        result = await db.cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": {"is_favorite": is_favorite}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Card not found")
        
        return {"message": "Favorite status updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/merchants", response_model=List[MerchantGroup])
async def get_merchants(search: Optional[str] = None, favorites_only: bool = False):
    """Get cards grouped by merchant"""
    query = {}
    
    if favorites_only:
        query["is_favorite"] = True
    
    if search:
        query["$or"] = [
            {"merchant_name": {"$regex": search, "$options": "i"}},
            {"card_name": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}},
            {"notes": {"$regex": search, "$options": "i"}}
        ]
    
    cards = await db.cards.find(query).sort("merchant_name", 1).to_list(1000)
    
    # Group cards by merchant
    merchants_dict = {}
    for card in cards:
        merchant = card["merchant_name"]
        if merchant not in merchants_dict:
            merchants_dict[merchant] = []
        merchants_dict[merchant].append(card_helper(card))
    
    # Convert to list of MerchantGroup
    merchant_groups = [
        {
            "merchant_name": merchant,
            "card_count": len(cards),
            "cards": cards
        }
        for merchant, cards in merchants_dict.items()
    ]
    
    return merchant_groups

@api_router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get statistics about cards"""
    total_cards = await db.cards.count_documents({})
    favorite_cards = await db.cards.count_documents({"is_favorite": True})
    
    # Get unique merchants
    merchants = await db.cards.distinct("merchant_name")
    total_merchants = len(merchants)
    
    return {
        "total_cards": total_cards,
        "favorite_cards": favorite_cards,
        "total_merchants": total_merchants
    }

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
