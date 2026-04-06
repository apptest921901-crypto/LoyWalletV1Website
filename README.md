# LoyWalletV1 - Mobile Loyalty Card Organizer

LoyWalletV1 is a modern, full-stack mobile application designed to digitize and organize all your physical loyalty cards. Built with React Native (Expo), FastAPI, and Supabase, it provides a seamless experience for managing rewards, scanning barcodes, and tracking your favorite merchants.

## 🚀 Features

- **Digital Wallet:** Store all your loyalty cards in one place.
- **Barcode Scanner:** Scan physical loyalty cards using device camera with auto-detection.
- **Barcode Display:** Clear, high-quality barcode rendering for easy scanning at checkout.
- **Card Images:** Capture and store photos of physical cards for visual reference.
- **Merchant Management:** Categorized list of pre-populated popular merchants.
- **Secure Authentication:** JWT-based login and signup powered by Supabase.
- **Cloud Sync:** Your data is securely stored and accessible across devices.
- **Search & Filter:** Quickly find cards by merchant name or category.
- **Favorite Cards:** Pin your most-used cards for instant access.
- **Card Editing:** Full CRUD operations - create, read, update, and delete cards.

## 🛠️ Tech Stack

### Frontend
- **Framework:** [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Navigation:** [Expo Router](https://docs.expo.dev/routing/introduction/) (File-based routing)
- **State Management:** React Context API
- **Styling:** React Native StyleSheet with custom animations
- **HTTP Client:** Axios
- **Camera/Scanning:** `expo-camera` with barcode detection
- **Image Handling:** `expo-image-picker` for camera/gallery access

### Backend
- **Language:** Python 3.10+
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/)
- **Authentication:** JWT (JSON Web Tokens)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **ORM:** Supabase Python Client

## 📦 Project Structure

```text
LoyWalletV1/
├── frontend/             # React Native (Expo) application
│   ├── app/              # Expo Router screens
│   ├── components/       # Reusable UI components
│   ├── context/          # Auth & State management
│   └── utils/            # API & Helper functions
├── backend/              # Python FastAPI server
│   ├── venv/             # Virtual environment
│   └── server.py         # Main API implementation
└── supabase_schema.sql   # Database schema & RLS policies
```

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Expo Go app on your physical device (optional)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables in `.env`:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE=your_service_role_key
   ```
5. Start the server:
   ```bash
   python server.py
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env`:
   ```env
   EXPO_PUBLIC_BACKEND_URL=http://your_local_ip:8000
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Start the app:
   ```bash
   npx expo start -c
   ```

## 🔒 Security
This project uses **Row Level Security (RLS)** in Supabase to ensure that users can only access their own cards. All API endpoints are protected with JWT tokens verified by the FastAPI backend.

## 📄 License
MIT License - see the [LICENSE](LICENSE) file for details.
