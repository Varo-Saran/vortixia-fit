-- Add body_fat_pct to user_metrics
ALTER TABLE public.user_metrics ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC;

-- Create body_metrics_log table for history tracking
CREATE TABLE IF NOT EXISTS public.body_metrics_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weight_kg NUMERIC NOT NULL,
    body_fat_pct NUMERIC,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.body_metrics_log ENABLE ROW LEVEL SECURITY;

-- Policies for body_metrics_log
DROP POLICY IF EXISTS "Users can insert their own metrics" ON public.body_metrics_log;
CREATE POLICY "Users can insert their own metrics" ON public.body_metrics_log
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own metrics" ON public.body_metrics_log;
CREATE POLICY "Users can view their own metrics" ON public.body_metrics_log
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own metrics" ON public.body_metrics_log;
CREATE POLICY "Users can delete their own metrics" ON public.body_metrics_log
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
