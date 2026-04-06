-- ================================================
-- LoyaltyApp Database Schema for Supabase
-- ================================================
-- Version: 1.1.0-dev
-- Last Updated: 2026-04-04
-- 
-- SCHEMA CONVENTIONS:
-- - Primary keys: Named {table}_id (e.g., user_id, merchant_id) for clarity
-- - Foreign keys: Reference {table}_id from parent table
-- - ID Type: UUID (gen_random_uuid()) for distributed ID generation
-- - Timestamps: created_at (immutable), updated_at (auto-updated via trigger)
-- - RLS: Row Level Security enabled on all user-data tables
--
-- TABLES:
-- - users: Extends auth.users with profile data (1:1 relationship)
-- - merchants: Directory of available merchants (service_role managed)
-- - loyalty_cards: User's saved loyalty cards (user managed)
--
-- VIEWS:
-- - loyalty_cards_with_merchants: Denormalized view for card+merchant queries
--
-- NOTES:
-- - This schema is aligned with production database (v1.0.0+)
-- - All migrations use IF NOT EXISTS for idempotency
-- - Indexes added for performance on common query patterns
-- ================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLE 1: users (extends auth.users)
-- ================================================
CREATE TABLE IF NOT EXISTS public.users (
  user_id UUID NOT NULL DEFAULT gen_random_uuid(),
  username TEXT UNIQUE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id),
  CONSTRAINT users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- RLS Policies for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
  ON public.users FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================
-- TABLE 2: merchants
-- ================================================
CREATE TABLE IF NOT EXISTS public.merchants (
  merchant_id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  category TEXT,
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (merchant_id)
);

-- RLS Policies for merchants
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants are visible to everyone"
  ON public.merchants FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Only service role can modify merchants
CREATE POLICY "Only service role can insert merchants"
  ON public.merchants FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Only service role can update merchants"
  ON public.merchants FOR UPDATE
  TO service_role
  USING (true);

-- ================================================
-- TABLE 3: loyalty_cards
-- ================================================
CREATE TABLE IF NOT EXISTS public.loyalty_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(merchant_id) ON DELETE RESTRICT,
  card_name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  notes TEXT,
  image_base64 TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_user_id ON public.loyalty_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_merchant_id ON public.loyalty_cards(merchant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_favorite ON public.loyalty_cards(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_search ON public.loyalty_cards USING gin(to_tsvector('english', card_name || ' ' || barcode || ' ' || COALESCE(notes, '')));

-- RLS Policies for loyalty_cards
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own loyalty cards"
  ON public.loyalty_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loyalty cards"
  ON public.loyalty_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loyalty cards"
  ON public.loyalty_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own loyalty cards"
  ON public.loyalty_cards FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================
-- INDEXES: Performance optimization
-- ================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_user_id ON public.loyalty_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_merchant_id ON public.loyalty_cards(merchant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_favorite ON public.loyalty_cards(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_search ON public.loyalty_cards USING gin(to_tsvector('english', card_name || ' ' || barcode || ' ' || COALESCE(notes, '')));

-- ================================================
-- TRIGGERS: Auto-update updated_at timestamp
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_cards_updated_at
  BEFORE UPDATE ON public.loyalty_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- PRE-POPULATE MERCHANTS
-- ================================================
INSERT INTO public.merchants (name, description, logo_url, category, website) VALUES
  ('Starbucks', 'Coffee chain with rewards program', 'https://logo.clearbit.com/starbucks.com', 'Coffee & Cafe', 'https://www.starbucks.com'),
  ('Target', 'Retail chain with Circle rewards', 'https://logo.clearbit.com/target.com', 'Retail', 'https://www.target.com'),
  ('Walmart', 'Retail chain with savings program', 'https://logo.clearbit.com/walmart.com', 'Retail', 'https://www.walmart.com'),
  ('Costco', 'Wholesale membership warehouse', 'https://logo.clearbit.com/costco.com', 'Wholesale', 'https://www.costco.com'),
  ('CVS Pharmacy', 'Pharmacy and drugstore chain', 'https://logo.clearbit.com/cvs.com', 'Pharmacy', 'https://www.cvs.com'),
  ('Walgreens', 'Pharmacy and convenience store', 'https://logo.clearbit.com/walgreens.com', 'Pharmacy', 'https://www.walgreens.com'),
  ('Whole Foods Market', 'Organic and natural foods supermarket', 'https://logo.clearbit.com/wholefoodsmarket.com', 'Grocery', 'https://www.wholefoodsmarket.com'),
  ('Kroger', 'Supermarket chain with fuel points', 'https://logo.clearbit.com/kroger.com', 'Grocery', 'https://www.kroger.com'),
  ('Safeway', 'Grocery store chain', 'https://logo.clearbit.com/safeway.com', 'Grocery', 'https://www.safeway.com'),
  ('Best Buy', 'Electronics retail chain', 'https://logo.clearbit.com/bestbuy.com', 'Electronics', 'https://www.bestbuy.com'),
  ('Sephora', 'Beauty and cosmetics retailer', 'https://logo.clearbit.com/sephora.com', 'Beauty', 'https://www.sephora.com'),
  ('Dunkin''', 'Coffee and donut chain', 'https://logo.clearbit.com/dunkindonuts.com', 'Coffee & Cafe', 'https://www.dunkindonuts.com'),
  ('Panera Bread', 'Bakery-cafe chain', 'https://logo.clearbit.com/panerabread.com', 'Restaurant', 'https://www.panerabread.com'),
  ('Chipotle', 'Mexican grill restaurant chain', 'https://logo.clearbit.com/chipotle.com', 'Restaurant', 'https://www.chipotle.com'),
  ('Subway', 'Sandwich restaurant chain', 'https://logo.clearbit.com/subway.com', 'Restaurant', 'https://www.subway.com'),
  ('AMC Theatres', 'Movie theater chain', 'https://logo.clearbit.com/amctheatres.com', 'Entertainment', 'https://www.amctheatres.com'),
  ('Marriott', 'Hotel and resort chain', 'https://logo.clearbit.com/marriott.com', 'Travel & Hospitality', 'https://www.marriott.com'),
  ('Hilton', 'Hotel and hospitality company', 'https://logo.clearbit.com/hilton.com', 'Travel & Hospitality', 'https://www.hilton.com'),
  ('Delta Air Lines', 'Major airline carrier', 'https://logo.clearbit.com/delta.com', 'Travel & Hospitality', 'https://www.delta.com'),
  ('United Airlines', 'Major airline carrier', 'https://logo.clearbit.com/united.com', 'Travel & Hospitality', 'https://www.united.com')
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- HELPFUL VIEWS
-- ================================================

-- View: loyalty_cards_with_merchants
-- Purpose: Provides a denormalized view of loyalty cards with merchant details
--          to simplify queries that need both card and merchant information.
-- Note: This is a VIRTUAL view (not a table) - data is read from underlying tables
-- Usage: SELECT * FROM loyalty_cards_with_merchants WHERE user_id = '...';
CREATE OR REPLACE VIEW loyalty_cards_with_merchants AS
SELECT 
  lc.*,
  m.name as merchant_name,
  m.logo_url as merchant_logo_url,
  m.category as merchant_category
FROM public.loyalty_cards lc
INNER JOIN public.merchants m ON lc.merchant_id = m.merchant_id;

-- Grant access to views
GRANT SELECT ON loyalty_cards_with_merchants TO authenticated;
