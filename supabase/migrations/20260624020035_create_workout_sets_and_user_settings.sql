CREATE TABLE public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  weight NUMERIC,
  reps INTEGER,
  weight_unit TEXT NOT NULL DEFAULT 'kg',
  tracking_type TEXT NOT NULL DEFAULT 'reps_weight',
  is_warmup BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workout sets"
  ON public.workout_sets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_sets.session_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE INDEX idx_workout_sets_session ON public.workout_sets(session_id);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS height_unit TEXT DEFAULT 'cm',
  ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '24h';
