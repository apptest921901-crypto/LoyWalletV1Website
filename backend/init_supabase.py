"""
Script to initialize Supabase database schema
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Get Supabase credentials
supabase_url = os.environ['SUPABASE_URL']
supabase_service_key = os.environ['SUPABASE_SERVICE_KEY']

# Create Supabase admin client
supabase: Client = create_client(supabase_url, supabase_service_key)

# Read SQL schema
sql_file = ROOT_DIR.parent / 'supabase_schema.sql'
with open(sql_file, 'r') as f:
    sql_content = f.read()

print("Initializing Supabase database schema...")
print("=" * 60)

# Execute SQL using Supabase RPC
# Note: Supabase Python client doesn't have direct SQL execution
# We need to execute via psycopg2 or use Supabase dashboard

print("\n⚠️  IMPORTANT: Please execute the following SQL in your Supabase SQL Editor:")
print("=" * 60)
print("\n1. Go to https://supabase.com/dashboard/project/tzetcqpqrtxhusssndma/sql/new")
print("2. Copy and paste the content from /app/supabase_schema.sql")
print("3. Click 'RUN' to execute the schema")
print("\nOr run this command in psql:")
print(f"psql {os.environ.get('SUPABASE_DB_URL', 'YOUR_DATABASE_URL')} < supabase_schema.sql")
print("=" * 60)

# Test connection by trying to fetch merchants
try:
    response = supabase.table("merchants").select("count", count="exact").execute()
    print(f"\n✅ Successfully connected to Supabase!")
    print(f"✅ Merchants table accessible (count: {response.count})")
except Exception as e:
    print(f"\n❌ Error connecting to Supabase: {e}")
    print("Please ensure the database schema is created first.")
