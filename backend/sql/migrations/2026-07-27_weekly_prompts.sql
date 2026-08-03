-- Weekly community prompt feature: a rotating question users answer, with
-- responses visible to each other once they've answered themselves.
-- Run once against an EXISTING database; fresh databases get this from schema.sql.

CREATE TABLE IF NOT EXISTS weekly_prompts (
    prompt_id     SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    week_start    DATE NOT NULL UNIQUE,  -- Monday of the prompt week
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_responses (
    response_id     SERIAL PRIMARY KEY,
    prompt_id       INTEGER REFERENCES weekly_prompts(prompt_id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    response_text   TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, prompt_id)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prompt_responses_update_timestamp ON prompt_responses;
CREATE TRIGGER prompt_responses_update_timestamp
BEFORE UPDATE ON prompt_responses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
