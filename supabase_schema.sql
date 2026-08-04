-- Supabase Database Schema for "Isthooi" Savings & Loan App

-- Enable Row Level Security (RLS) or public access policies
-- 1. App State Table (Single row JSON state or normalized table sync)
CREATE TABLE IF NOT EXISTS public.isthooi_app_state (
  id TEXT PRIMARY KEY DEFAULT 'primary_state',
  state_data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Turn on RLS and allow public access for simple deployment
ALTER TABLE public.isthooi_app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on isthooi_app_state"
  ON public.isthooi_app_state FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update on isthooi_app_state"
  ON public.isthooi_app_state FOR ALL USING (true);

-- Insert initial empty record placeholder
INSERT INTO public.isthooi_app_state (id, state_data)
VALUES ('primary_state', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
