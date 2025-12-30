"""
Execute Supabase schema creation using direct SQL
"""
import os
from dotenv import load_dotenv
from pathlib import Path
import requests

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Get Supabase credentials
supabase_url = os.environ['SUPABASE_URL']
supabase_service_key = os.environ['SUPABASE_SERVICE_KEY']

# Read SQL schema
sql_file = ROOT_DIR.parent / 'supabase_schema.sql'
with open(sql_file, 'r') as f:
    sql_content = f.read()

print("Executing Supabase database schema...")
print("=" * 60)

# Split SQL into individual statements
sql_statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]

# Execute via Supabase REST API using RPC
headers = {
    'apikey': supabase_service_key,
    'Authorization': f'Bearer {supabase_service_key}',
    'Content-Type': 'application/json'
}

success_count = 0
error_count = 0

for i, statement in enumerate(sql_statements, 1):
    if not statement or statement.startswith('--'):
        continue
    
    print(f"\n[{i}/{len(sql_statements)}] Executing statement...")
    
    try:
        # Use Supabase PostgREST RPC to execute SQL
        response = requests.post(
            f"{supabase_url}/rest/v1/rpc/exec_sql",
            json={"query": statement},
            headers=headers,
            timeout=30
        )
        
        if response.status_code in [200, 201, 204]:
            print(f"✅ Success")
            success_count += 1
        else:
            print(f"⚠️  Status {response.status_code}: {response.text[:100]}")
            error_count += 1
    except Exception as e:
        print(f"⚠️  Error: {str(e)[:100]}")
        error_count += 1

print("\n" + "=" * 60)
print(f"Execution completed: {success_count} success, {error_count} errors/warnings")
print("=" * 60)
print("\nNote: Some errors are expected (e.g., 'already exists' for existing objects)")
print("Please verify tables in Supabase Dashboard: https://supabase.com/dashboard/project/tzetcqpqrtxhusssndma/editor")
