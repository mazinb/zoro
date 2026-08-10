-- ============================================
-- Zoro Topics Voting System - Database Setup
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- Project: bnqrzxscdrivvsbqtggq
-- ============================================

-- 1. Create topics table
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'agent' CHECK (source IN ('agent', 'user')),
  source_name TEXT,
  votes INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  submitted_by TEXT,
  published_at TIMESTAMPTZ
);

-- 2. Create topic_votes table
CREATE TABLE IF NOT EXISTS topic_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(topic_id, session_id)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics (status);
CREATE INDEX IF NOT EXISTS idx_topics_status_votes ON topics (status, votes DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_votes_topic ON topic_votes (topic_id);

-- 4. Enable RLS
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_votes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for topics
DROP POLICY IF EXISTS "Public read active topics" ON topics;
CREATE POLICY "Public read active topics" 
  ON topics FOR SELECT 
  USING (status = 'active' AND source = 'agent');

DROP POLICY IF EXISTS "Service role full access" ON topics;
CREATE POLICY "Service role full access" 
  ON topics FOR ALL 
  USING (true) WITH CHECK (true);

-- 6. RLS Policies for topic_votes
DROP POLICY IF EXISTS "Anyone insert vote" ON topic_votes;
CREATE POLICY "Anyone insert vote" 
  ON topic_votes FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role read votes" ON topic_votes;
CREATE POLICY "Service role read votes" 
  ON topic_votes FOR SELECT 
  USING (true);

-- 7. Function to increment votes (called from API)
CREATE OR REPLACE FUNCTION public.increment_topic_votes(p_topic_id TEXT)
RETURNS TABLE (new_votes INTEGER) AS $$
BEGIN
  UPDATE topics 
  SET votes = votes + 1, updated_at = NOW()
  WHERE id = p_topic_id
  RETURNING votes INTO new_votes;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get topic queue sorted by votes (for the daily runner)
CREATE OR REPLACE FUNCTION public.get_topic_queue(p_source TEXT DEFAULT 'agent')
RETURNS TABLE (
  id TEXT,
  title TEXT,
  description TEXT,
  url TEXT,
  source TEXT,
  source_name TEXT,
  votes INTEGER,
  category TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  notes TEXT,
  submitted_by TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.description, t.url, t.source, t.source_name, t.votes, t.category, t.status, t.created_at, t.notes, t.submitted_by
  FROM topics t
  WHERE t.status = 'active'
    AND (p_source IS NULL OR t.source = p_source)
  ORDER BY t.votes DESC, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Verification queries (run after migration)
-- ============================================
-- Check tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('topics', 'topic_votes');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('topics', 'topic_votes');

-- Check RLS policies
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('topics', 'topic_votes');

-- Check functions
SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('increment_topic_votes', 'get_topic_queue');
