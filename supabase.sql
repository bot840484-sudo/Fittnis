-- =============================================================================
-- FITTNIS - Supabase Database Schema & RPC Functions
-- =============================================================================
-- This file contains all database schema, RLS policies, and RPC functions
-- needed for the Fittnis fitness app.
--
-- To apply: Copy and paste into Supabase SQL Editor, or run via CLI:
--   supabase db push --file supabase.sql
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLES
-- =============================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  height_cm NUMERIC(5,2),
  weight_kg NUMERIC(5,2),
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  goal TEXT CHECK (goal IN ('lose_weight', 'gain_muscle', 'maintain', 'endurance', 'flexibility')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  units TEXT DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  language TEXT DEFAULT 'uz' CHECK (language IN ('uz', 'ru', 'en')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings (JSON for flexible storage)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workouts
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('strength', 'cardio', 'flexibility', 'sport')),
  duration_min INTEGER,
  calories INTEGER,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Runs (GPS tracked)
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  distance_km NUMERIC(6,2),
  duration_sec INTEGER,
  calories INTEGER,
  pace_sec_per_km INTEGER,
  coords JSONB, -- Array of [lat, lng] points
  elevation_gain NUMERIC(8,2),
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food logs
CREATE TABLE IF NOT EXISTS food_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories INTEGER DEFAULT 0,
  protein NUMERIC(6,2) DEFAULT 0,
  carbs NUMERIC(6,2) DEFAULT 0,
  fat NUMERIC(6,2) DEFAULT 0,
  portion INTEGER DEFAULT 100,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User stats (aggregated for leaderboard)
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_workouts INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  total_distance_km NUMERIC(10,2) DEFAULT 0,
  total_active_minutes INTEGER DEFAULT 0,
  total_calories_burned INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  rank TEXT DEFAULT 'E',
  title TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements / Titles
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  requirement JSONB,
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- Friends
CREATE TABLE IF NOT EXISTS friends (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('daily', 'weekly', 'monthly', 'custom')),
  target_type TEXT CHECK (target_type IN ('workouts', 'runs', 'distance', 'calories', 'streak')),
  target_value INTEGER,
  xp_reward INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User challenges
CREATE TABLE IF NOT EXISTS user_challenges (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, challenge_id)
);

-- AI usage tracking (for rate limiting)
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('claude', 'gemini')),
  tokens_used INTEGER DEFAULT 0,
  request_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_runs_user_date ON runs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_xp ON user_stats(xp DESC);
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, created_at);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to view other profiles (for leaderboard, friends)
CREATE POLICY "Profiles are viewable by all authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- User settings policies
CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workouts policies
CREATE POLICY "Users can manage own workouts" ON workouts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Runs policies
CREATE POLICY "Users can manage own runs" ON runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Food logs policies
CREATE POLICY "Users can manage own food logs" ON food_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User stats policies
CREATE POLICY "Users can view own stats" ON user_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON user_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Stats are viewable by all authenticated (for leaderboard)" ON user_stats
  FOR SELECT USING (auth.role() = 'authenticated');

-- Achievements policies
CREATE POLICY "Achievements are public" ON achievements
  FOR SELECT USING (true);

CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Friends policies
CREATE POLICY "Users can manage own friendships" ON friends
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- Challenges policies
CREATE POLICY "Challenges are public" ON challenges
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own challenges" ON user_challenges
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI usage policies
CREATE POLICY "Users can view own AI usage" ON ai_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert AI usage" ON ai_usage
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- TRIGGERS & FUNCTIONS
-- =============================================================================

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON workouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_runs_updated_at
  BEFORE UPDATE ON runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_food_logs_updated_at
  BEFORE UPDATE ON food_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON user_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- USER STATS AGGREGATION (for leaderboard)
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_user_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_workouts INTEGER;
  v_runs INTEGER;
  v_distance NUMERIC;
  v_minutes INTEGER;
  v_calories INTEGER;
  v_streak INTEGER;
  v_longest_streak INTEGER;
  v_last_date DATE;
  v_xp INTEGER;
  v_level INTEGER;
  v_rank TEXT;
BEGIN
  -- Aggregate workouts
  SELECT
    COUNT(*),
    COALESCE(SUM(duration_min), 0),
    COALESCE(SUM(calories), 0),
    MAX(date)
  INTO v_workouts, v_minutes, v_calories, v_last_date
  FROM workouts
  WHERE user_id = p_user_id;

  -- Aggregate runs
  SELECT
    COUNT(*),
    COALESCE(SUM(distance_km), 0),
    COALESCE(SUM(duration_sec), 0) / 60,
    COALESCE(SUM(calories), 0)
  INTO v_runs, v_distance, v_minutes, v_calories
  FROM runs
  WHERE user_id = p_user_id;

  -- Calculate streak
  WITH RECURSIVE dates AS (
    SELECT date FROM workouts WHERE user_id = p_user_id
    UNION
    SELECT date FROM runs WHERE user_id = p_user_id
    UNION
    SELECT date FROM food_logs WHERE user_id = p_user_id
  ),
  unique_dates AS (
    SELECT DISTINCT date FROM dates
  ),
  streak_calc AS (
    SELECT
      date,
      date - (ROW_NUMBER() OVER (ORDER BY date DESC) || ' days')::INTERVAL AS grp
    FROM unique_dates
  ),
  streak_groups AS (
    SELECT grp, COUNT(*) AS cnt, MAX(date) AS max_date
    FROM streak_calc
    GROUP BY grp
    ORDER BY max_date DESC
  )
  SELECT COALESCE(MAX(cnt), 0), COALESCE(MAX(max_date), NULL)
  INTO v_streak, v_last_date
  FROM streak_groups
  WHERE max_date >= CURRENT_DATE - INTERVAL '1 day' OR max_date IS NULL;

  -- Longest streak
  WITH RECURSIVE dates AS (
    SELECT date FROM workouts WHERE user_id = p_user_id
    UNION
    SELECT date FROM runs WHERE user_id = p_user_id
    UNION
    SELECT date FROM food_logs WHERE user_id = p_user_id
  ),
  unique_dates AS (
    SELECT DISTINCT date FROM dates
  ),
  streak_calc AS (
    SELECT
      date,
      date - (ROW_NUMBER() OVER (ORDER BY date) || ' days')::INTERVAL AS grp
    FROM unique_dates
  ),
  streak_groups AS (
    SELECT grp, COUNT(*) AS cnt
    FROM streak_calc
    GROUP BY grp
  )
  SELECT COALESCE(MAX(cnt), 0) INTO v_longest_streak FROM streak_groups;

  -- Calculate XP: workouts*10 + runs*15 + distance_km*2 + minutes/30*1
  v_xp := v_workouts * 10 + v_runs * 15 + FLOOR(v_distance * 2) + FLOOR(v_minutes / 30);

  -- Calculate level (formula: level = floor(sqrt(xp/100)) + 1, max 100)
  v_level := LEAST(FLOOR(SQRT(v_xp::NUMERIC / 100)) + 1, 100);

  -- Calculate rank
  v_rank := CASE
    WHEN v_level >= 90 THEN 'MONARX'
    WHEN v_level >= 80 THEN 'S'
    WHEN v_level >= 70 THEN 'A'
    WHEN v_level >= 60 THEN 'B'
    WHEN v_level >= 50 THEN 'C'
    WHEN v_level >= 30 THEN 'D'
    ELSE 'E'
  END;

  -- Upsert user_stats
  INSERT INTO user_stats (
    user_id, total_workouts, total_runs, total_distance_km,
    total_active_minutes, total_calories_burned,
    current_streak, longest_streak, last_activity_date,
    xp, level, rank
  ) VALUES (
    p_user_id, v_workouts, v_runs, v_distance,
    v_minutes, v_calories,
    v_streak, v_longest_streak, v_last_date,
    v_xp, v_level, v_rank
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_workouts = EXCLUDED.total_workouts,
    total_runs = EXCLUDED.total_runs,
    total_distance_km = EXCLUDED.total_distance_km,
    total_active_minutes = EXCLUDED.total_active_minutes,
    total_calories_burned = EXCLUDED.total_calories_burned,
    current_streak = EXCLUDED.current_streak,
    longest_streak = EXCLUDED.longest_streak,
    last_activity_date = EXCLUDED.last_activity_date,
    xp = EXCLUDED.xp,
    level = EXCLUDED.level,
    rank = EXCLUDED.rank,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to refresh stats on workout/run/food insert/update/delete
CREATE OR REPLACE FUNCTION trigger_refresh_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_user_stats(COALESCE(NEW.user_id, OLD.user_id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_workout_stats ON workouts;
CREATE TRIGGER trigger_workout_stats
  AFTER INSERT OR UPDATE OR DELETE ON workouts
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_user_stats();

DROP TRIGGER IF EXISTS trigger_run_stats ON runs;
CREATE TRIGGER trigger_run_stats
  AFTER INSERT OR UPDATE OR DELETE ON runs
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_user_stats();

DROP TRIGGER IF EXISTS trigger_food_stats ON food_logs;
CREATE TRIGGER trigger_food_stats
  AFTER INSERT OR UPDATE OR DELETE ON food_logs
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_user_stats();

-- =============================================================================
-- RPC FUNCTIONS FOR LEADERBOARD
-- =============================================================================

-- Get leaderboard (top N users)
CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  total_workouts INTEGER,
  total_runs INTEGER,
  total_distance_km NUMERIC,
  total_active_minutes INTEGER,
  total_calories_burned INTEGER,
  current_streak INTEGER,
  longest_streak INTEGER,
  level INTEGER,
  xp INTEGER,
  rank TEXT,
  score BIGINT,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      us.user_id,
      p.full_name,
      p.avatar_url,
      us.total_workouts,
      us.total_runs,
      us.total_distance_km,
      us.total_active_minutes,
      us.total_calories_burned,
      us.current_streak,
      us.longest_streak,
      us.level,
      us.xp,
      us.rank,
      (us.total_workouts * 10 + us.total_runs * 15 + us.current_streak * 5 + (us.total_active_minutes / 60) * 2) AS score,
      ROW_NUMBER() OVER (ORDER BY (us.total_workouts * 10 + us.total_runs * 15 + us.current_streak * 5 + (us.total_active_minutes / 60) * 2) DESC) AS rank_position
    FROM user_stats us
    LEFT JOIN profiles p ON p.id = us.user_id
    WHERE us.xp > 0
  )
  SELECT * FROM ranked
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's rank
CREATE OR REPLACE FUNCTION get_my_rank(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  total_workouts INTEGER,
  total_runs INTEGER,
  total_distance_km NUMERIC,
  total_active_minutes INTEGER,
  total_calories_burned INTEGER,
  current_streak INTEGER,
  longest_streak INTEGER,
  level INTEGER,
  xp INTEGER,
  rank TEXT,
  score BIGINT,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      us.user_id,
      p.full_name,
      p.avatar_url,
      us.total_workouts,
      us.total_runs,
      us.total_distance_km,
      us.total_active_minutes,
      us.total_calories_burned,
      us.current_streak,
      us.longest_streak,
      us.level,
      us.xp,
      us.rank,
      (us.total_workouts * 10 + us.total_runs * 15 + us.current_streak * 5 + (us.total_active_minutes / 60) * 2) AS score,
      ROW_NUMBER() OVER (ORDER BY (us.total_workouts * 10 + us.total_runs * 15 + us.current_streak * 5 + (us.total_active_minutes / 60) * 2) DESC) AS rank_position
    FROM user_stats us
    LEFT JOIN profiles p ON p.id = us.user_id
    WHERE us.xp > 0
  )
  SELECT * FROM ranked
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get weekly leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard_weekly(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  workouts_this_week INTEGER,
  runs_this_week INTEGER,
  distance_this_week NUMERIC,
  minutes_this_week INTEGER,
  calories_this_week INTEGER,
  score BIGINT,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly AS (
    SELECT
      w.user_id,
      COUNT(w.id) AS workouts_this_week,
      COALESCE(SUM(w.duration_min), 0) AS minutes_this_week,
      COALESCE(SUM(w.calories), 0) AS calories_this_week
    FROM workouts w
    WHERE w.date >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY w.user_id
  ),
  weekly_runs AS (
    SELECT
      r.user_id,
      COUNT(r.id) AS runs_this_week,
      COALESCE(SUM(r.distance_km), 0) AS distance_this_week,
      COALESCE(SUM(r.duration_sec), 0) / 60 AS run_minutes,
      COALESCE(SUM(r.calories), 0) AS run_calories
    FROM runs r
    WHERE r.date >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY r.user_id
  ),
  combined AS (
    SELECT
      COALESCE(w.user_id, r.user_id) AS user_id,
      COALESCE(w.workouts_this_week, 0) AS workouts_this_week,
      COALESCE(w.minutes_this_week, 0) AS minutes_this_week,
      COALESCE(w.calories_this_week, 0) AS calories_this_week,
      COALESCE(r.runs_this_week, 0) AS runs_this_week,
      COALESCE(r.distance_this_week, 0) AS distance_this_week,
      COALESCE(r.run_minutes, 0) AS run_minutes,
      COALESCE(r.run_calories, 0) AS run_calories
    FROM weekly w
    FULL JOIN weekly_runs r ON w.user_id = r.user_id
  ),
  ranked AS (
    SELECT
      c.user_id,
      p.full_name,
      p.avatar_url,
      c.workouts_this_week,
      c.runs_this_week,
      c.distance_this_week,
      c.minutes_this_week + c.run_minutes AS minutes_this_week,
      c.calories_this_week + c.run_calories AS calories_this_week,
      (c.workouts_this_week * 10 + c.runs_this_week * 15 + (c.minutes_this_week + c.run_minutes) / 60 * 2) AS score,
      ROW_NUMBER() OVER (ORDER BY (c.workouts_this_week * 10 + c.runs_this_week * 15 + (c.minutes_this_week + c.run_minutes) / 60 * 2) DESC) AS rank_position
    FROM combined c
    LEFT JOIN profiles p ON p.id = c.user_id
  )
  SELECT * FROM ranked
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get monthly leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard_monthly(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  workouts_this_month INTEGER,
  runs_this_month INTEGER,
  distance_this_month NUMERIC,
  minutes_this_month INTEGER,
  calories_this_month INTEGER,
  score BIGINT,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly AS (
    SELECT
      w.user_id,
      COUNT(w.id) AS workouts_this_month,
      COALESCE(SUM(w.duration_min), 0) AS minutes_this_month,
      COALESCE(SUM(w.calories), 0) AS calories_this_month
    FROM workouts w
    WHERE w.date >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY w.user_id
  ),
  monthly_runs AS (
    SELECT
      r.user_id,
      COUNT(r.id) AS runs_this_month,
      COALESCE(SUM(r.distance_km), 0) AS distance_this_month,
      COALESCE(SUM(r.duration_sec), 0) / 60 AS run_minutes,
      COALESCE(SUM(r.calories), 0) AS run_calories
    FROM runs r
    WHERE r.date >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY r.user_id
  ),
  combined AS (
    SELECT
      COALESCE(w.user_id, r.user_id) AS user_id,
      COALESCE(w.workouts_this_month, 0) AS workouts_this_month,
      COALESCE(w.minutes_this_month, 0) AS minutes_this_month,
      COALESCE(w.calories_this_month, 0) AS calories_this_month,
      COALESCE(r.runs_this_month, 0) AS runs_this_month,
      COALESCE(r.distance_this_month, 0) AS distance_this_month,
      COALESCE(r.run_minutes, 0) AS run_minutes,
      COALESCE(r.run_calories, 0) AS run_calories
    FROM monthly w
    FULL JOIN monthly_runs r ON w.user_id = r.user_id
  ),
  ranked AS (
    SELECT
      c.user_id,
      p.full_name,
      p.avatar_url,
      c.workouts_this_month,
      c.runs_this_month,
      c.distance_this_month,
      c.minutes_this_month + c.run_minutes AS minutes_this_month,
      c.calories_this_month + c.run_calories AS calories_this_month,
      (c.workouts_this_month * 10 + c.runs_this_month * 15 + (c.minutes_this_month + c.run_minutes) / 60 * 2) AS score,
      ROW_NUMBER() OVER (ORDER BY (c.workouts_this_month * 10 + c.runs_this_month * 15 + (c.minutes_this_month + c.run_minutes) / 60 * 2) DESC) AS rank_position
    FROM combined c
    LEFT JOIN profiles p ON p.id = c.user_id
  )
  SELECT * FROM ranked
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_settings (user_id, data)
  VALUES (NEW.id, '{}')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- DEFAULT ACHIEVEMENTS
-- =============================================================================
INSERT INTO achievements (code, name, description, icon, category, requirement, xp_reward) VALUES
  ('first_workout', 'Birinchi Mashq', 'Birinchi mashqingizni bajaring', '💪', 'workout', '{"workouts": 1}', 50),
  ('workout_10', '10 Mashq', '10 ta mashq bajaring', '💪', 'workout', '{"workouts": 10}', 100),
  ('workout_50', '50 Mashq', '50 ta mashq bajaring', '🏋️', 'workout', '{"workouts": 50}', 500),
  ('workout_100', '100 Mashq', '100 ta mashq bajaring', '🏋️‍♂️', 'workout', '{"workouts": 100}', 1000),
  ('first_run', 'Birinchi Yugurish', 'Birinchi yugurishingizni bajaring', '🏃', 'run', '{"runs": 1}', 50),
  ('run_10', '10 Yugurish', '10 ta yugurish bajaring', '🏃', 'run', '{"runs": 10}', 100),
  ('run_50', '50 Yugurish', '50 ta yugurish bajaring', '🏃‍♂️', 'run', '{"runs": 50}', 500),
  ('run_100', '100 Yugurish', '100 ta yugurish bajaring', '🏃‍♂️', 'run', '{"runs": 100}', 1000),
  ('streak_3', '3 Kun Seriyasi', '3 kun davomida faol bo\'ling', '🔥', 'streak', '{"streak": 3}', 100),
  ('streak_7', '1 Hafta Seriyasi', '7 kun davomida faol bo\'ling', '🔥', 'streak', '{"streak": 7}', 200),
  ('streak_30', '1 Oy Seriyasi', '30 kun davomida faol bo\'ling', '🔥', 'streak', '{"streak": 30}', 1000),
  ('distance_5k', '5K Yugurish', 'Jami 5 km yuguring', '🏅', 'distance', '{"distance_km": 5}', 100),
  ('distance_10k', '10K Yugurish', 'Jami 10 km yuguring', '🏅', 'distance', '{"distance_km": 10}', 200),
  ('distance_50k', '50K Yugurish', 'Jami 50 km yuguring', '🏅', 'distance', '{"distance_km": 50}', 500),
  ('distance_100k', '100K Yugurish', 'Jami 100 km yuguring', '🏆', 'distance', '{"distance_km": 100}', 1000),
  ('calories_1000', '1000 Kaloriya', '1000 kaloriya yuqquading', '🔥', 'calories', '{"calories": 1000}', 100),
  ('calories_10000', '10000 Kaloriya', '10000 kaloriya yuqquading', '🔥', 'calories', '{"calories": 10000}', 500),
  ('level_10', '10-Daraja', '10-darajaga erishing', '⭐', 'level', '{"level": 10}', 500),
  ('level_25', '25-Daraja', '25-darajaga erishing', '⭐', 'level', '{"level": 25}', 1000),
  ('level_50', '50-Daraja', '50-darajaga erishing', '⭐', 'level', '{"level": 50}', 2000),
  ('level_100', 'MONARX', '100-darajaga erishing (Maksimal)', '👑', 'level', '{"level": 100}', 5000),
  ('food_10', '10 Ovqat', '10 ta ovqat yozuvini qo\'shing', '🍎', 'food', '{"food_logs": 10}', 100),
  ('food_50', '50 Ovqat', '50 ta ovqat yozuvini qo\'shing', '🍽️', 'food', '{"food_logs": 50}', 500),
  ('early_bird', 'Ertalabki Quvon', 'Tong 6:00 oldin mashq qiling', '🌅', 'special', '{"early_workout": true}', 200),
  ('night_owl', 'Kechki Quvon', 'Tush 22:00 keyin mashq qiling', '🌙', 'special', '{"late_workout": true}', 200),
  ('weekend_warrior', 'Dam olish Kunlari Jahoni', 'Shanba va yakshanba mashq qiling', '🏖️', 'special', '{"weekend_workout": true}', 200)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- =============================================================================
-- REALTIME PUBLICATION (for live updates)
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE workouts, runs, food_logs, user_stats, user_achievements, friends, user_challenges;