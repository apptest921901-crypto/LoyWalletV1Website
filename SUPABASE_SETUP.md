# SUPABASE DATABASE SETUP INSTRUCTIONS

## Status: ⚠️ Tables Need to be Created

The Supabase connection is working, but the database tables have not been created yet.

## Quick Setup Instructions

### Step 1: Open Supabase SQL Editor
Navigate to: https://supabase.com/dashboard/project/tzetcqpqrtxhusssndma/sql/new

### Step 2: Copy the Complete SQL
The SQL schema file is located at: `/app/supabase_schema.sql`

### Step 3: Execute the SQL
1. Copy ALL content from `/app/supabase_schema.sql`
2. Paste it into the Supabase SQL Editor
3. Click the "RUN" button

### Step 4: Verify Creation
After running the SQL, you should see:
- ✅ 3 Tables created: `users`, `merchants`, `loyalty_cards`
- ✅ 20 Merchants pre-populated (Starbucks, Target, Walmart, etc.)
- ✅ Row Level Security (RLS) policies enabled
- ✅ Indexes created for performance

## What the Schema Creates

### Table 1: `users`
- Extends Supabase Auth with profile data
- Fields: id, username, email, full_name, avatar_url, phone_number
- RLS: Users can only access their own profile

### Table 2: `merchants`  
- Pre-populated merchant directory
- Fields: id, name, description, logo_url, category, website
- RLS: Public read access, admin-only writes
- **Pre-populated with 20 popular merchants**

### Table 3: `loyalty_cards`
- User's loyalty cards
- Fields: id, user_id, merchant_id, card_name, barcode, notes, image_base64, is_favorite
- RLS: Users can only access their own cards
- Indexes for fast queries

## Verification Command

After creating the tables, run this to verify:

```bash
cd /app/backend && python3 -c "
from supabase import create_client
supabase = create_client(
    'https://tzetcqpqrtxhusssndma.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6ZXRjcXBxcnR4aHVzc3NuZG1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA4NzM2OSwiZXhwIjoyMDgyNjYzMzY5fQ.SlNKWDmXywEYZ-O9SLkhY2iEecrSLHpFRFIJ0iVF2_0'
)
merchants = supabase.table('merchants').select('name').limit(5).execute()
print(f'✅ Found {len(merchants.data)} merchants')
for m in merchants.data:
    print(f'  - {m[\"name\"]}')
"
```

## Database Architecture

```
┌─────────────────┐
│   auth.users    │ (Supabase Auth - Built-in)
└────────┬────────┘
         │
         │ (1:1 extends)
         ▼
┌─────────────────┐
│  public.users   │ (Profile data)
└────────┬────────┘
         │
         │ (1:Many)
         ▼
┌──────────────────────┐         ┌─────────────────┐
│ public.loyalty_cards │◄────────│ public.merchants│
│                      │ (Many:1)│                 │
│ - user_id (FK)       │         │ - Pre-populated │
│ - merchant_id (FK)   │         │ - 20 merchants  │
│ - card_name          │         └─────────────────┘
│ - barcode            │
│ - image_base64       │
│ - is_favorite        │
└──────────────────────┘
```

## Security Features

1. **Row Level Security (RLS)** - Enabled on all tables
2. **User Isolation** - Each user can only see/edit their own cards
3. **Service Role Key** - Used by backend for admin operations
4. **Anon Key** - Safe to expose in frontend (protected by RLS)

## Next Steps After Table Creation

1. Verify tables exist in Supabase Dashboard
2. Test backend API endpoints
3. Test frontend connection
4. Implement user authentication flow
