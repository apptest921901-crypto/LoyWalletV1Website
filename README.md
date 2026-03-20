# LoyWalletV1 - Mobile Loyalty Card Organizer

LoyWalletV1 is a modern, full-stack mobile application designed to digitize and organize all your physical loyalty cards. Built with React Native (Expo), FastAPI, and Supabase, it provides a seamless experience for managing rewards, scanning barcodes, and tracking your favorite merchants.

## 🚀 Features

- **Digital Wallet:** Store all your loyalty cards in one place.
- **Barcode Display:** Clear, high-quality barcode rendering.
- **Unified Branding:** Professional "Welcome to LoyWallet!" UX notifications.
- **Skeleton UI:** Smooth loading states for a premium feel.
- **Secure Authentication:** Google OAuth and Email/Password support.

## 🛡️ Cyber Security & Legal Compliance

### EU GDPR Compliance
- **Consent Management:** Mandatory agreement to Privacy Policy and Terms of Service during registration.
- **Right to be Forgotten:** Integrated "Delete Account" feature that wipes all user data from database and auth logs.
- **Data Minimization:** Only essential profile information is collected.

### Hardened Security
- **API Rate Limiting:** Prevents brute-force and DoS attacks via `SlowAPI`.
- **Strict CORS:** Whitelisted origins prevent Cross-Site Request Forgery.
- **JWT Double-Validation:** Backend validates token signatures directly with Supabase Auth for every request.
- **Encrypted Storage:** Auth tokens are obfuscated at the device level to prevent plaintext leakage.
- **Secure Headers:** Implementation of HSTS, CSP, and XSS protection.

## 🛠️ Tech Stack

### Frontend
- **Framework:** React Native (Expo SDK 54)
- **Security:** `expo-crypto` for storage obfuscation
- **State:** React Context API

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **Security:** `SlowAPI` for rate limiting
- **Database:** Supabase (PostgreSQL) with Row Level Security (RLS)

## 📦 Project Structure

```text
LoyWalletV1/
├── frontend/             # React Native (Expo) application
├── backend/              # Python FastAPI server
└── supabase_schema.sql   # Database schema & RLS policies
```

## ⚙️ Setup & Validation

### Security Validation
To verify the security of your local instance:
1. **Test Rate Limiting:** Attempt to call `/api/` more than 10 times in a minute.
2. **Test Auth:** Try calling `/api/merchants-grouped` without a Bearer token.

### Setup
Refer to the `frontend` and `backend` directories for specific environment configuration (`.env`).

## 📄 License
MIT License - see the [LICENSE](LICENSE) file for details.
