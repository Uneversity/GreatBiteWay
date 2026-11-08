-- Tiger Cloud schema. Applied by `python -m scripts.seed` (statement by statement,
-- because continuous aggregates can't be created inside a transaction).
-- Safe to re-run: everything is IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ---------------------------------------------------------------- catalog + quiz

CREATE TABLE IF NOT EXISTS traits (
    name         text PRIMARY KEY,
    description  text NOT NULL,
    sort         int  NOT NULL
);

CREATE TABLE IF NOT EXISTS majors (
    slug         text PRIMARY KEY,
    name         text NOT NULL,
    field        text NOT NULL,
    mdc_program  text NOT NULL,
    summary      text NOT NULL,
    mdc_url      text,
    profile      jsonb NOT NULL DEFAULT '{}',  -- trait -> weight 0..1, used by the quiz scorer
    sort         int   NOT NULL DEFAULT 0,
    embedding    vector(768)           -- Gemini embedding of the major's description, for semantic matching
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id    text PRIMARY KEY,
    text  text NOT NULL,
    sort  int  NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_options (
    question_id text  REFERENCES quiz_questions(id) ON DELETE CASCADE,
    idx         int   NOT NULL,         -- the `value` the client sends back
    label       text  NOT NULL,
    traits      jsonb NOT NULL,         -- trait -> weight 0..1
    PRIMARY KEY (question_id, idx)
);

-- ---------------------------------------------------------------- roadmap data

CREATE TABLE IF NOT EXISTS courses (
    code     text PRIMARY KEY,         -- e.g. 'CTS 1120'; GE-*/ELEC-* are general-education / elective slots
    title    text NOT NULL,
    credits       int  NOT NULL,
    prepares_for  text                 -- certification id, when MDC ties the course to one
);

-- A slot like GE-SOCSCI can appear in several terms, so a row is keyed by its place in the plan.
CREATE TABLE IF NOT EXISTS program_courses (
    major_slug   text REFERENCES majors(slug) ON DELETE CASCADE,
    requirement  text NOT NULL,        -- 'sequence' (the semester plan) or 'common_prereq' (extra transfer prereqs)
    term         int  NOT NULL,        -- suggested semester; 0 for common prereqs
    position     int  NOT NULL,
    course_code  text NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
    note         text,                 -- allowed alternatives, e.g. 'or STA 2023'
    PRIMARY KEY (major_slug, requirement, term, position)
);

CREATE TABLE IF NOT EXISTS program_sources (
    major_slug      text PRIMARY KEY REFERENCES majors(slug) ON DELETE CASCADE,
    source_url      text NOT NULL,     -- the MDC course sequence guide the rows were transcribed from
    effective_term  text NOT NULL
);

CREATE TABLE IF NOT EXISTS prerequisites (
    course_code text REFERENCES courses(code) ON DELETE CASCADE,
    requires    text REFERENCES courses(code) ON DELETE CASCADE,
    PRIMARY KEY (course_code, requires)
);

CREATE TABLE IF NOT EXISTS careers (
    soc_code         text PRIMARY KEY, -- BLS / O*NET occupation code
    title            text NOT NULL,
    median_pay       int  NOT NULL,    -- USD per year
    pay_year         int  NOT NULL,
    outlook          text NOT NULL,    -- e.g. '21% (Much faster than average)'
    outlook_period   text NOT NULL,    -- e.g. '2025-35'
    entry_education  text NOT NULL,
    source_url       text NOT NULL
);

CREATE TABLE IF NOT EXISTS major_careers (
    major_slug text REFERENCES majors(slug) ON DELETE CASCADE,
    soc_code   text REFERENCES careers(soc_code) ON DELETE CASCADE,
    position   int  NOT NULL DEFAULT 0,
    PRIMARY KEY (major_slug, soc_code)
);

CREATE TABLE IF NOT EXISTS certifications (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    issuer      text NOT NULL,
    why         text NOT NULL,
    source_url  text NOT NULL
);

CREATE TABLE IF NOT EXISTS major_certifications (
    major_slug  text REFERENCES majors(slug) ON DELETE CASCADE,
    cert_id     text REFERENCES certifications(id) ON DELETE CASCADE,
    timing      text NOT NULL,         -- 'during' the MDC program, 'after_program' (before any transfer) or 'after_degree' (after the bachelor's)
    position    int  NOT NULL DEFAULT 0,
    PRIMARY KEY (major_slug, cert_id)
);

CREATE TABLE IF NOT EXISTS transfer_options (
    major_slug   text REFERENCES majors(slug) ON DELETE CASCADE,
    position     int  NOT NULL,
    institution  text NOT NULL,
    program      text NOT NULL,
    notes        text NOT NULL,
    source_url   text NOT NULL,
    PRIMARY KEY (major_slug, position)
);

CREATE TABLE IF NOT EXISTS saved_roadmaps (
    id          bigserial PRIMARY KEY,
    user_id     text NOT NULL,         -- Auth0 `sub`
    major_slug  text REFERENCES majors(slug),
    roadmap     jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_roadmaps_user_idx ON saved_roadmaps (user_id);

-- ---------------------------------------------------------------- quiz analytics (TimescaleDB)

-- One row per scored quiz step. A hypertable partitions it by time automatically.
CREATE TABLE IF NOT EXISTS quiz_events (
    time         timestamptz NOT NULL DEFAULT now(),
    session_id   text,                 -- optional X-Quiz-Session header from the client
    n_answers    int     NOT NULL,
    question_id  text,                 -- the most recent answer in the request
    option_idx   int,
    top_slug     text    NOT NULL,
    top_score    real    NOT NULL,
    depth        real    NOT NULL,
    done         boolean NOT NULL
);
SELECT create_hypertable('quiz_events', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS quiz_events_question_idx ON quiz_events (question_id, time DESC);

-- Daily finished-quiz counts per matched major, kept up to date by TimescaleDB.
-- materialized_only = false also includes rows newer than the last refresh.
CREATE MATERIALIZED VIEW IF NOT EXISTS quiz_daily_matches
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket(INTERVAL '1 day', time) AS day,
       top_slug,
       count(*)        AS completions,
       avg(top_score)  AS avg_confidence
FROM quiz_events
WHERE done
GROUP BY day, top_slug
WITH NO DATA;

SELECT add_continuous_aggregate_policy('quiz_daily_matches',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);
