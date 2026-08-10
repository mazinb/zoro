-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT DEFAULT 'user',
  source_name TEXT DEFAULT 'user',
  source_url TEXT,
  url TEXT,
  votes INTEGER DEFAULT 0,
  category TEXT DEFAULT 'AI',
  notes TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'writing', 'done', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create topic_votes table
CREATE TABLE IF NOT EXISTS topic_votes (
  id BIGSERIAL PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, client_id)
);

-- Index for votes lookup
CREATE INDEX IF NOT EXISTS idx_topic_votes_topic_id ON topic_votes(topic_id);
