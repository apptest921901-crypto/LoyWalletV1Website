#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for LoyaltyApp
Tests all CRUD operations and API endpoints
"""

import requests
import json
import sys
from datetime import datetime
import base64

# Backend URL from environment
BACKEND_URL = "https://lovaltyorganizer.preview.emergentagent.com/api"

# Test data
TEST_CARDS = [
    {
        "merchant_name": "Starbucks",
        "card_name": "Gold Member Card",
        "barcode": "123456789012",
        "notes": "My favorite coffee shop",
        "image_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "is_favorite": True
    },
    {
        "merchant_name": "Target",
        "card_name": "Circle Rewards",
        "barcode": "987654321098",
        "notes": "Great deals and discounts",
        "image_base64": "",
        "is_favorite": False
    },
    {
        "merchant_name": "Starbucks",
        "card_name": "Rewards Card",
        "barcode": "555666777888",
        "notes": "Secondary Starbucks card",
        "image_base64": "",
        "is_favorite": False
    }
]

# Known test card IDs from the review request
KNOWN_CARD_IDS = [
    "6953d824b7a743b1e7d03bd6",  # Starbucks Gold Member Card, favorite
    "6953d82bb7a743b1e7d03bd7",  # Target Circle Rewards
    "6953d82bb7a743b1e7d03bd8"   # Starbucks Rewards Card
]

class APITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        self.created_card_ids = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def test_api_health(self):
        """Test if API is accessible"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                self.log_test("API Health Check", True, f"API is accessible at {self.base_url}")
                return True
            else:
                self.log_test("API Health Check", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("API Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_create_card(self):
        """Test POST /api/cards - Create card"""
        print("=== Testing POST /api/cards (Create Card) ===")
        
        for i, card_data in enumerate(TEST_CARDS):
            try:
                response = self.session.post(
                    f"{self.base_url}/cards",
                    json=card_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    card_id = data.get("id")
                    if card_id:
                        self.created_card_ids.append(card_id)
                    self.log_test(f"Create Card {i+1} ({card_data['merchant_name']})", True, 
                                f"Card created with ID: {card_id}")
                else:
                    self.log_test(f"Create Card {i+1}", False, 
                                f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_test(f"Create Card {i+1}", False, f"Exception: {str(e)}")
    
    def test_get_cards(self):
        """Test GET /api/cards - List all cards"""
        print("=== Testing GET /api/cards (List Cards) ===")
        
        # Test without filters
        try:
            response = self.session.get(f"{self.base_url}/cards")
            if response.status_code == 200:
                cards = response.json()
                self.log_test("Get All Cards", True, f"Retrieved {len(cards)} cards")
            else:
                self.log_test("Get All Cards", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get All Cards", False, f"Exception: {str(e)}")
        
        # Test with search parameter
        try:
            response = self.session.get(f"{self.base_url}/cards?search=Starbucks")
            if response.status_code == 200:
                cards = response.json()
                self.log_test("Get Cards with Search", True, f"Found {len(cards)} Starbucks cards")
            else:
                self.log_test("Get Cards with Search", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Cards with Search", False, f"Exception: {str(e)}")
        
        # Test with favorites_only=true
        try:
            response = self.session.get(f"{self.base_url}/cards?favorites_only=true")
            if response.status_code == 200:
                cards = response.json()
                self.log_test("Get Favorite Cards Only", True, f"Found {len(cards)} favorite cards")
            else:
                self.log_test("Get Favorite Cards Only", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Favorite Cards Only", False, f"Exception: {str(e)}")
        
        # Test with both search and favorites
        try:
            response = self.session.get(f"{self.base_url}/cards?search=Starbucks&favorites_only=true")
            if response.status_code == 200:
                cards = response.json()
                self.log_test("Get Cards with Search + Favorites", True, f"Found {len(cards)} favorite Starbucks cards")
            else:
                self.log_test("Get Cards with Search + Favorites", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Cards with Search + Favorites", False, f"Exception: {str(e)}")
    
    def test_get_single_card(self):
        """Test GET /api/cards/{id} - Get single card"""
        print("=== Testing GET /api/cards/{id} (Get Single Card) ===")
        
        # Test with valid card IDs (both known and created)
        test_ids = KNOWN_CARD_IDS + self.created_card_ids
        
        for card_id in test_ids[:3]:  # Test first 3 IDs
            try:
                response = self.session.get(f"{self.base_url}/cards/{card_id}")
                if response.status_code == 200:
                    card = response.json()
                    self.log_test(f"Get Card {card_id[:8]}...", True, 
                                f"Retrieved card: {card.get('merchant_name')} - {card.get('card_name')}")
                elif response.status_code == 404:
                    self.log_test(f"Get Card {card_id[:8]}...", False, "Card not found (404)")
                else:
                    self.log_test(f"Get Card {card_id[:8]}...", False, 
                                f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_test(f"Get Card {card_id[:8]}...", False, f"Exception: {str(e)}")
        
        # Test with invalid card ID
        try:
            response = self.session.get(f"{self.base_url}/cards/invalid_id")
            if response.status_code == 400:
                self.log_test("Get Card with Invalid ID", True, "Correctly returned 400 for invalid ID")
            else:
                self.log_test("Get Card with Invalid ID", False, 
                            f"Expected 400, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Card with Invalid ID", False, f"Exception: {str(e)}")
        
        # Test with non-existent card ID (valid format but doesn't exist)
        try:
            fake_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format
            response = self.session.get(f"{self.base_url}/cards/{fake_id}")
            if response.status_code == 404:
                self.log_test("Get Non-existent Card", True, "Correctly returned 404 for non-existent card")
            else:
                self.log_test("Get Non-existent Card", False, 
                            f"Expected 404, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Non-existent Card", False, f"Exception: {str(e)}")
    
    def test_update_card(self):
        """Test PUT /api/cards/{id} - Update card"""
        print("=== Testing PUT /api/cards/{id} (Update Card) ===")
        
        # Use first available card ID
        test_ids = KNOWN_CARD_IDS + self.created_card_ids
        if not test_ids:
            self.log_test("Update Card Tests", False, "No card IDs available for testing")
            return
        
        card_id = test_ids[0]
        
        # Test updating single field
        try:
            update_data = {"notes": f"Updated notes at {datetime.now().isoformat()}"}
            response = self.session.put(
                f"{self.base_url}/cards/{card_id}",
                json=update_data,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                card = response.json()
                self.log_test("Update Single Field", True, f"Updated notes: {card.get('notes')}")
            else:
                self.log_test("Update Single Field", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Update Single Field", False, f"Exception: {str(e)}")
        
        # Test updating multiple fields
        try:
            update_data = {
                "card_name": "Updated Card Name",
                "notes": "Multiple fields updated",
                "is_favorite": True
            }
            response = self.session.put(
                f"{self.base_url}/cards/{card_id}",
                json=update_data,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                card = response.json()
                self.log_test("Update Multiple Fields", True, 
                            f"Updated card name: {card.get('card_name')}, favorite: {card.get('is_favorite')}")
            else:
                self.log_test("Update Multiple Fields", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Update Multiple Fields", False, f"Exception: {str(e)}")
        
        # Test with invalid card ID
        try:
            response = self.session.put(
                f"{self.base_url}/cards/invalid_id",
                json={"notes": "test"},
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 400:
                self.log_test("Update with Invalid ID", True, "Correctly returned 400 for invalid ID")
            else:
                self.log_test("Update with Invalid ID", False, 
                            f"Expected 400, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Update with Invalid ID", False, f"Exception: {str(e)}")
    
    def test_toggle_favorite(self):
        """Test PUT /api/cards/{id}/favorite - Toggle favorite"""
        print("=== Testing PUT /api/cards/{id}/favorite (Toggle Favorite) ===")
        
        # Use first available card ID
        test_ids = KNOWN_CARD_IDS + self.created_card_ids
        if not test_ids:
            self.log_test("Toggle Favorite Tests", False, "No card IDs available for testing")
            return
        
        card_id = test_ids[0]
        
        # Test setting favorite to true
        try:
            response = self.session.put(f"{self.base_url}/cards/{card_id}/favorite?is_favorite=true")
            if response.status_code == 200:
                self.log_test("Set Favorite True", True, "Successfully set favorite to true")
            else:
                self.log_test("Set Favorite True", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Set Favorite True", False, f"Exception: {str(e)}")
        
        # Test setting favorite to false
        try:
            response = self.session.put(f"{self.base_url}/cards/{card_id}/favorite?is_favorite=false")
            if response.status_code == 200:
                self.log_test("Set Favorite False", True, "Successfully set favorite to false")
            else:
                self.log_test("Set Favorite False", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Set Favorite False", False, f"Exception: {str(e)}")
        
        # Test with invalid card ID
        try:
            response = self.session.put(f"{self.base_url}/cards/invalid_id/favorite?is_favorite=true")
            if response.status_code == 400:
                self.log_test("Toggle Favorite Invalid ID", True, "Correctly returned 400 for invalid ID")
            else:
                self.log_test("Toggle Favorite Invalid ID", False, 
                            f"Expected 400, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Toggle Favorite Invalid ID", False, f"Exception: {str(e)}")
    
    def test_delete_card(self):
        """Test DELETE /api/cards/{id} - Delete card"""
        print("=== Testing DELETE /api/cards/{id} (Delete Card) ===")
        
        # Only delete cards we created, not the known test cards
        if not self.created_card_ids:
            self.log_test("Delete Card Tests", False, "No created card IDs available for deletion testing")
            return
        
        # Test deleting a valid card (use last created card)
        card_id = self.created_card_ids[-1]
        try:
            response = self.session.delete(f"{self.base_url}/cards/{card_id}")
            if response.status_code == 200:
                self.log_test("Delete Valid Card", True, f"Successfully deleted card {card_id[:8]}...")
                self.created_card_ids.remove(card_id)
            else:
                self.log_test("Delete Valid Card", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Delete Valid Card", False, f"Exception: {str(e)}")
        
        # Test with invalid card ID
        try:
            response = self.session.delete(f"{self.base_url}/cards/invalid_id")
            if response.status_code == 400:
                self.log_test("Delete with Invalid ID", True, "Correctly returned 400 for invalid ID")
            else:
                self.log_test("Delete with Invalid ID", False, 
                            f"Expected 400, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Delete with Invalid ID", False, f"Exception: {str(e)}")
        
        # Test with non-existent card ID
        try:
            fake_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format
            response = self.session.delete(f"{self.base_url}/cards/{fake_id}")
            if response.status_code == 404:
                self.log_test("Delete Non-existent Card", True, "Correctly returned 404 for non-existent card")
            else:
                self.log_test("Delete Non-existent Card", False, 
                            f"Expected 404, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Delete Non-existent Card", False, f"Exception: {str(e)}")
    
    def test_get_merchants(self):
        """Test GET /api/merchants - Get merchant groups"""
        print("=== Testing GET /api/merchants (Get Merchant Groups) ===")
        
        # Test without filters
        try:
            response = self.session.get(f"{self.base_url}/merchants")
            if response.status_code == 200:
                merchants = response.json()
                self.log_test("Get All Merchants", True, f"Retrieved {len(merchants)} merchant groups")
            else:
                self.log_test("Get All Merchants", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get All Merchants", False, f"Exception: {str(e)}")
        
        # Test with search parameter
        try:
            response = self.session.get(f"{self.base_url}/merchants?search=Starbucks")
            if response.status_code == 200:
                merchants = response.json()
                self.log_test("Get Merchants with Search", True, f"Found {len(merchants)} merchant groups")
            else:
                self.log_test("Get Merchants with Search", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Merchants with Search", False, f"Exception: {str(e)}")
        
        # Test with favorites_only
        try:
            response = self.session.get(f"{self.base_url}/merchants?favorites_only=true")
            if response.status_code == 200:
                merchants = response.json()
                self.log_test("Get Favorite Merchants", True, f"Found {len(merchants)} favorite merchant groups")
            else:
                self.log_test("Get Favorite Merchants", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Favorite Merchants", False, f"Exception: {str(e)}")
    
    def test_get_stats(self):
        """Test GET /api/stats - Get statistics"""
        print("=== Testing GET /api/stats (Get Statistics) ===")
        
        try:
            response = self.session.get(f"{self.base_url}/stats")
            if response.status_code == 200:
                stats = response.json()
                self.log_test("Get Statistics", True, 
                            f"Stats - Total: {stats.get('total_cards')}, Favorites: {stats.get('favorite_cards')}, Merchants: {stats.get('total_merchants')}")
            else:
                self.log_test("Get Statistics", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Statistics", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Comprehensive Backend API Testing")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Test API health first
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Run all tests
        self.test_create_card()
        self.test_get_cards()
        self.test_get_single_card()
        self.test_update_card()
        self.test_toggle_favorite()
        self.test_delete_card()
        self.test_get_merchants()
        self.test_get_stats()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)