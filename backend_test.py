#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Loyalty Card Organizer
Tests all endpoints with updated schema using UUIDs for card_id, merchant_id, user_id
"""

import requests
import json
import sys
from datetime import datetime
import base64
import uuid

# Backend URL from environment
BACKEND_URL = "https://lovaltyorganizer.preview.emergentagent.com/api"

# Test user credentials
TEST_USER_EMAIL = "testuser@loyaltyapp.com"
TEST_USER_PASSWORD = "TestPassword123!"
TEST_USER_FULL_NAME = "Test User"
TEST_USER_USERNAME = "testuser123"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.test_card_id = None
        self.test_merchant_id = None
        self.test_results = []
        
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

    def make_request(self, method: str, endpoint: str, data: dict = None, headers: dict = None) -> tuple:
        """Make HTTP request and return (success, response, status_code)"""
        url = f"{self.base_url}{endpoint}"
        
        # Add auth header if token available
        if self.access_token and headers is None:
            headers = {"Authorization": f"Bearer {self.access_token}"}
        elif self.access_token and headers:
            headers["Authorization"] = f"Bearer {self.access_token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, params=data)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                return False, None, 0
            
            return True, response, response.status_code
        except Exception as e:
            return False, str(e), 0
    
    def test_api_health(self):
        """Test if API is accessible"""
        print("=== Testing API Health ===")
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

    def test_auth_signup(self):
        """Test POST /api/auth/signup"""
        print("=== Testing POST /api/auth/signup ===")
        
        signup_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "full_name": TEST_USER_FULL_NAME,
            "username": TEST_USER_USERNAME
        }
        
        success, response, status_code = self.make_request("POST", "/auth/signup", signup_data)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if "user" in data and data["user"]:
                    user_data = data["user"]
                    if "user_id" in user_data:
                        self.user_id = user_data["user_id"]
                        self.log_test("Auth Signup", True, f"User created with user_id: {self.user_id}")
                        
                        # Check if session tokens are provided
                        if data.get("session", {}).get("access_token"):
                            self.access_token = data["session"]["access_token"]
                            self.log_test("Auth Signup Auto-Login", True, "Access token received")
                        return True
                    else:
                        self.log_test("Auth Signup", False, "No user_id in response")
                else:
                    self.log_test("Auth Signup", False, "No user data in response")
            except Exception as e:
                self.log_test("Auth Signup", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            # If user already exists, try login instead
            if "already" in error_msg.lower():
                self.log_test("Auth Signup", True, "User already exists, will try login")
                return self.test_auth_login()
            else:
                self.log_test("Auth Signup", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_auth_login(self):
        """Test POST /api/auth/login"""
        print("=== Testing POST /api/auth/login ===")
        
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        success, response, status_code = self.make_request("POST", "/auth/login", login_data)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if "session" in data and data["session"].get("access_token"):
                    self.access_token = data["session"]["access_token"]
                    if "user" in data and data["user"]:
                        self.user_id = data["user"]["user_id"]
                        self.log_test("Auth Login", True, f"Login successful, user_id: {self.user_id}")
                        return True
                    else:
                        self.log_test("Auth Login", False, "No user data in response")
                else:
                    self.log_test("Auth Login", False, "No access token in response")
            except Exception as e:
                self.log_test("Auth Login", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Auth Login", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_get_profile(self):
        """Test GET /api/profile"""
        print("=== Testing GET /api/profile ===")
        
        if not self.access_token:
            self.log_test("Get Profile", False, "No access token available")
            return False
        
        success, response, status_code = self.make_request("GET", "/profile")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if "user_id" in data and data["user_id"] == self.user_id:
                    self.log_test("Get Profile", True, f"Profile retrieved with user_id: {data['user_id']}")
                    return True
                else:
                    self.log_test("Get Profile", False, "user_id mismatch or missing")
            except Exception as e:
                self.log_test("Get Profile", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Get Profile", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_update_profile(self):
        """Test PUT /api/profile"""
        print("=== Testing PUT /api/profile ===")
        
        if not self.access_token:
            self.log_test("Update Profile", False, "No access token available")
            return False
        
        update_data = {
            "full_name": "Updated Test User",
            "phone_number": "+1234567890"
        }
        
        success, response, status_code = self.make_request("PUT", "/profile", update_data)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if data.get("full_name") == "Updated Test User":
                    self.log_test("Update Profile", True, "Profile updated successfully")
                    return True
                else:
                    self.log_test("Update Profile", False, "Profile not updated correctly")
            except Exception as e:
                self.log_test("Update Profile", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Update Profile", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_get_merchants(self):
        """Test GET /api/merchants"""
        print("=== Testing GET /api/merchants ===")
        
        success, response, status_code = self.make_request("GET", "/merchants")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if merchants have merchant_id and logo_url
                        merchant = data[0]
                        if "merchant_id" in merchant:
                            self.test_merchant_id = merchant["merchant_id"]
                            has_logo = "logo_url" in merchant
                            self.log_test("Get Merchants", True, 
                                          f"Found {len(data)} merchants, merchant_id: {self.test_merchant_id}, has_logo_url: {has_logo}")
                            return True
                        else:
                            self.log_test("Get Merchants", False, "No merchant_id in merchant data")
                    else:
                        self.log_test("Get Merchants", True, "No merchants found (empty list)")
                        return True
                else:
                    self.log_test("Get Merchants", False, "Response is not a list")
            except Exception as e:
                self.log_test("Get Merchants", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Get Merchants", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_create_card(self):
        """Test POST /api/cards"""
        print("=== Testing POST /api/cards ===")
        
        if not self.access_token:
            self.log_test("Create Card", False, "No access token available")
            return False
        
        if not self.test_merchant_id:
            self.log_test("Create Card", False, "No merchant_id available")
            return False
        
        # Create a simple base64 image (1x1 pixel PNG)
        sample_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        card_data = {
            "merchant_id": self.test_merchant_id,
            "card_name": "Test Loyalty Card",
            "barcode": "1234567890123",
            "notes": "Test card for API testing",
            "image_base64": sample_image,
            "is_favorite": False
        }
        
        success, response, status_code = self.make_request("POST", "/cards", card_data)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if "card_id" in data and "merchant_id" in data:
                    self.test_card_id = data["card_id"]
                    has_merchant_name = "merchant_name" in data
                    has_merchant_logo = "merchant_logo_url" in data
                    self.log_test("Create Card", True, 
                                  f"Card created with card_id: {self.test_card_id}, has_merchant_name: {has_merchant_name}, has_merchant_logo: {has_merchant_logo}")
                    return True
                else:
                    self.log_test("Create Card", False, "Missing card_id or merchant_id in response")
            except Exception as e:
                self.log_test("Create Card", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Create Card", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_get_cards(self):
        """Test GET /api/cards"""
        print("=== Testing GET /api/cards ===")
        
        if not self.access_token:
            self.log_test("Get Cards", False, "No access token available")
            return False
        
        success, response, status_code = self.make_request("GET", "/cards")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        card = data[0]
                        has_card_id = "card_id" in card
                        has_merchant_id = "merchant_id" in card
                        has_user_id = "user_id" in card
                        self.log_test("Get Cards", True, 
                                      f"Found {len(data)} cards, has_card_id: {has_card_id}, has_merchant_id: {has_merchant_id}, has_user_id: {has_user_id}")
                        return True
                    else:
                        self.log_test("Get Cards", True, "No cards found (empty list)")
                        return True
                else:
                    self.log_test("Get Cards", False, "Response is not a list")
            except Exception as e:
                self.log_test("Get Cards", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Get Cards", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_get_single_card(self):
        """Test GET /api/cards/{card_id}"""
        print("=== Testing GET /api/cards/{card_id} ===")
        
        if not self.access_token:
            self.log_test("Get Single Card", False, "No access token available")
            return False
        
        if not self.test_card_id:
            self.log_test("Get Single Card", False, "No test card_id available")
            return False
        
        success, response, status_code = self.make_request("GET", f"/cards/{self.test_card_id}")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if data.get("card_id") == self.test_card_id:
                    has_merchant_data = "merchant_name" in data and "merchant_logo_url" in data
                    self.log_test("Get Single Card", True, 
                                  f"Card retrieved successfully, has_merchant_data: {has_merchant_data}")
                    return True
                else:
                    self.log_test("Get Single Card", False, "card_id mismatch")
            except Exception as e:
                self.log_test("Get Single Card", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Get Single Card", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_update_card(self):
        """Test PUT /api/cards/{card_id}"""
        print("=== Testing PUT /api/cards/{card_id} ===")
        
        if not self.access_token:
            self.log_test("Update Card", False, "No access token available")
            return False
        
        if not self.test_card_id:
            self.log_test("Update Card", False, "No test card_id available")
            return False
        
        # Create a different base64 image
        updated_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        update_data = {
            "card_name": "Updated Test Card",
            "notes": "Updated notes for testing",
            "image_base64": updated_image,
            "is_favorite": True
        }
        
        success, response, status_code = self.make_request("PUT", f"/cards/{self.test_card_id}", update_data)
        
        if success and status_code == 200:
            try:
                data = response.json()
                if (data.get("card_name") == "Updated Test Card" and 
                    data.get("is_favorite") == True):
                    self.log_test("Update Card", True, "Card updated successfully")
                    return True
                else:
                    self.log_test("Update Card", False, "Card not updated correctly")
            except Exception as e:
                self.log_test("Update Card", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Update Card", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_toggle_favorite(self):
        """Test PUT /api/cards/{card_id}/favorite"""
        print("=== Testing PUT /api/cards/{card_id}/favorite ===")
        
        if not self.access_token:
            self.log_test("Toggle Favorite", False, "No access token available")
            return False
        
        if not self.test_card_id:
            self.log_test("Toggle Favorite", False, "No test card_id available")
            return False
        
        # Toggle to false using query parameter
        success, response, status_code = self.make_request("PUT", f"/cards/{self.test_card_id}/favorite?is_favorite=false")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if "message" in data:
                    self.log_test("Toggle Favorite", True, "Favorite status toggled successfully")
                    return True
                else:
                    self.log_test("Toggle Favorite", False, "No message in response")
            except Exception as e:
                self.log_test("Toggle Favorite", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Toggle Favorite", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_delete_card(self):
        """Test DELETE /api/cards/{card_id}"""
        print("=== Testing DELETE /api/cards/{card_id} ===")
        
        if not self.access_token:
            self.log_test("Delete Card", False, "No access token available")
            return False
        
        if not self.test_card_id:
            self.log_test("Delete Card", False, "No test card_id available")
            return False
        
        success, response, status_code = self.make_request("DELETE", f"/cards/{self.test_card_id}")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if "message" in data:
                    self.log_test("Delete Card", True, "Card deleted successfully")
                    return True
                else:
                    self.log_test("Delete Card", False, "No message in response")
            except Exception as e:
                self.log_test("Delete Card", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Delete Card", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_merchants_grouped(self):
        """Test GET /api/merchants-grouped"""
        print("=== Testing GET /api/merchants-grouped ===")
        
        if not self.access_token:
            self.log_test("Merchants Grouped", False, "No access token available")
            return False
        
        success, response, status_code = self.make_request("GET", "/merchants-grouped")
        
        if success and status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        group = data[0]
                        has_merchant_id = "merchant_id" in group
                        has_card_count = "card_count" in group
                        has_cards = "cards" in group and isinstance(group["cards"], list)
                        self.log_test("Merchants Grouped", True, 
                                      f"Found {len(data)} merchant groups, has_merchant_id: {has_merchant_id}, has_card_count: {has_card_count}, has_cards: {has_cards}")
                        return True
                    else:
                        self.log_test("Merchants Grouped", True, "No merchant groups found (empty list)")
                        return True
                else:
                    self.log_test("Merchants Grouped", False, "Response is not a list")
            except Exception as e:
                self.log_test("Merchants Grouped", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Merchants Grouped", False, f"Status {status_code}: {error_msg}")
        
        return False

    def test_get_stats(self):
        """Test GET /api/stats"""
        print("=== Testing GET /api/stats ===")
        
        if not self.access_token:
            self.log_test("Get Stats", False, "No access token available")
            return False
        
        success, response, status_code = self.make_request("GET", "/stats")
        
        if success and status_code == 200:
            try:
                data = response.json()
                required_fields = ["total_cards", "favorite_cards", "total_merchants"]
                has_all_fields = all(field in data for field in required_fields)
                
                if has_all_fields:
                    self.log_test("Get Stats", True, 
                                  f"Stats: {data['total_cards']} cards, {data['favorite_cards']} favorites, {data['total_merchants']} merchants")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Get Stats", False, f"Missing fields: {missing}")
            except Exception as e:
                self.log_test("Get Stats", False, f"JSON parse error: {e}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_test("Get Stats", False, f"Status {status_code}: {error_msg}")
        
        return False
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Comprehensive Backend API Testing")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Test API health first
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Auth tests
        if not self.test_auth_signup():
            # If signup fails, try login
            if not self.test_auth_login():
                print("❌ Authentication failed. Cannot proceed with authenticated tests.")
                return False
        
        # Profile tests
        self.test_get_profile()
        self.test_update_profile()
        
        # Merchant tests
        self.test_get_merchants()
        
        # Card tests (in order)
        self.test_create_card()
        self.test_get_cards()
        self.test_get_single_card()
        self.test_update_card()
        self.test_toggle_favorite()
        
        # Grouped endpoints
        self.test_merchants_grouped()
        self.test_get_stats()
        
        # Cleanup
        self.test_delete_card()
        
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
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)