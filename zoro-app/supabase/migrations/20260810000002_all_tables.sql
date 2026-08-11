-- ============================================
-- Zoro Topics & Conversations Schema
-- Run this in Supabase Dashboard → SQL Editor
-- Project: bnqrzxscdrivvsbqtggq
-- ============================================

-- 1. Topics table
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'agent' CHECK (source IN ('agent', 'user')),
  source_name TEXT,
  source_url TEXT,
  votes INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'writing', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  submitted_by TEXT,
  published_at TIMESTAMPTZ
);

-- 2. Topic votes table
CREATE TABLE IF NOT EXISTS topic_votes (
  id BIGSERIAL PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(topic_id, client_id)
);

-- 3. Inbound emails table
CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  from_address TEXT NOT NULL,
  to_addresses TEXT[],
  subject TEXT,
  body TEXT,
  html_body TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  agent_processing_status TEXT DEFAULT 'pending',
  email_thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Email log (outbound)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('inbound', 'outbound')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ,
  data JSONB
);

-- 5. User context (for memory/conversation state)
CREATE TABLE IF NOT EXISTS user_context (
  user_id TEXT PRIMARY KEY,
  memory_jsonb JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics (status);
CREATE INDEX IF NOT EXISTS idx_topics_status_votes ON topics (status, votes DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_votes_topic_id ON topic_votes(topic_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_user ON inbound_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);

-- 7. Enable RLS
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies - topics
DROP POLICY IF EXISTS "Public read active topics" ON topics;
CREATE POLICY "Public read active topics" ON topics FOR SELECT USING (status = 'active' AND source = 'agent');
DROP POLICY IF EXISTS "Service role full access" ON topics;
CREATE POLICY "Service role full access" ON topics FOR ALL USING (true) WITH CHECK (true);

-- 9. RLS Policies - topic_votes
DROP POLICY IF EXISTS "Anyone insert vote" ON topic_votes;
CREATE POLICY "Anyone insert vote" ON topic_votes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Service role read votes" ON topic_votes;
CREATE POLICY "Service role read votes" ON topic_votes FOR SELECT USING (true);

-- 10. RLS Policies - inbound_emails
DROP POLICY IF EXISTS "Service role access emails" ON inbound_emails;
CREATE POLICY "Service role access emails" ON inbound_emails FOR ALL USING (true) WITH CHECK (true);

-- 11. RLS Policies - email_logs
DROP POLICY IF EXISTS "Service role access logs" ON email_logs;
CREATE POLICY "Service role access logs" ON email_logs FOR ALL USING (true) WITH CHECK (true);

-- 12. RLS Policies - user_context
DROP POLICY IF EXISTS "Service role access context" ON user_context;
CREATE POLICY "Service role access context" ON user_context FOR ALL USING (true) WITH CHECK (true);

-- 13. Functions
CREATE OR REPLACE FUNCTION public.increment_topic_votes(p_topic_id TEXT)
RETURNS TABLE (new_votes INTEGER) AS $$
BEGIN
  UPDATE topics SET votes = votes + 1, updated_at = NOW()
  WHERE id = p_topic_id
  RETURNING votes INTO new_votes;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_topic_queue(p_source TEXT DEFAULT 'agent')
RETURNS TABLE (
  id TEXT, title TEXT, description TEXT, url TEXT, source TEXT,
  source_name TEXT, votes INTEGER, category TEXT, status TEXT,
  created_at TIMESTAMPTZ, notes TEXT, submitted_by TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.description, t.url, t.source, t.source_name,
         t.votes, t.category, t.status, t.created_at, t.notes, t.submitted_by
  FROM topics t
  WHERE t.status = 'active' AND (p_source IS NULL OR t.source = p_source)
  ORDER BY t.votes DESC, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. RLS for user_context with auth
DROP POLICY IF EXISTS "Users can read own context" ON user_context;
CREATE POLICY "Users can read own context" ON user_context
  FOR SELECT USING (auth.uid()::text = user_id);
DROP POLICY IF EXISTS "Users can update own context" ON user_context;
CREATE POLICY "Users can update own context" ON user_context
  FOR UPDATE USING (auth.uid()::text = user_id);
