-- Create the ai_drafts table
CREATE TABLE IF NOT EXISTS public.ai_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.form_submissions(id),
  ai_response JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'sent')),
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on status for faster filtering of pending items
CREATE INDEX IF NOT EXISTS idx_ai_drafts_status ON public.ai_drafts(status);

-- Enable RLS (Optional, but good practice)
ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;

-- Allow Service Role full access (if not automatic)
CREATE POLICY "Service Role Full Access" ON public.ai_drafts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
