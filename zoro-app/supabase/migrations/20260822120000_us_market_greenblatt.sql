-- S&P 500 Greenblatt (Magic Formula) screener cache
-- Public read; writes via service role (cron refresh)

CREATE TABLE IF NOT EXISTS us_market_greenblatt_meta (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stock_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'yahoo',
  error_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS us_market_greenblatt_stocks (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT,
  sub_industry TEXT,
  ebit NUMERIC,
  enterprise_value NUMERIC,
  earnings_yield NUMERIC,
  return_on_capital NUMERIC,
  net_fixed_assets NUMERIC,
  working_capital NUMERIC,
  invested_capital NUMERIC,
  roc_rank INTEGER,
  ey_rank INTEGER,
  combined_rank INTEGER,
  market_cap NUMERIC,
  fiscal_period_end DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_us_market_greenblatt_combined_rank
  ON us_market_greenblatt_stocks (combined_rank ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_us_market_greenblatt_sector
  ON us_market_greenblatt_stocks (sector);

ALTER TABLE us_market_greenblatt_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_market_greenblatt_stocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read greenblatt meta" ON us_market_greenblatt_meta;
CREATE POLICY "Public read greenblatt meta"
  ON us_market_greenblatt_meta FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read greenblatt stocks" ON us_market_greenblatt_stocks;
CREATE POLICY "Public read greenblatt stocks"
  ON us_market_greenblatt_stocks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role greenblatt meta" ON us_market_greenblatt_meta;
CREATE POLICY "Service role greenblatt meta"
  ON us_market_greenblatt_meta FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role greenblatt stocks" ON us_market_greenblatt_stocks;
CREATE POLICY "Service role greenblatt stocks"
  ON us_market_greenblatt_stocks FOR ALL USING (true) WITH CHECK (true);

INSERT INTO us_market_greenblatt_meta (id, refreshed_at, stock_count, source, notes)
VALUES (1, '1970-01-01'::timestamptz, 0, 'yahoo', 'Awaiting first refresh')
ON CONFLICT (id) DO NOTHING;
