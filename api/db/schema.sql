-- Run against your Tiger Cloud service:  psql "$DATABASE_URL" -f db/schema.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS majors (
    slug         text PRIMARY KEY,
    name         text NOT NULL,
    field        text NOT NULL,
    mdc_program  text NOT NULL,
    summary      text NOT NULL,
    embedding    vector(768)           -- Gemini embedding of name + summary, for semantic matching
);

CREATE TABLE IF NOT EXISTS courses (
    code     text PRIMARY KEY,         -- e.g. 'COP1334'
    title    text NOT NULL,
    credits  int  NOT NULL
);

CREATE TABLE IF NOT EXISTS program_courses (
    major_slug  text REFERENCES majors(slug) ON DELETE CASCADE,
    course_code text REFERENCES courses(code) ON DELETE CASCADE,
    term        int,                   -- suggested semester
    PRIMARY KEY (major_slug, course_code)
);

CREATE TABLE IF NOT EXISTS prerequisites (
    course_code text REFERENCES courses(code) ON DELETE CASCADE,
    requires    text REFERENCES courses(code) ON DELETE CASCADE,
    PRIMARY KEY (course_code, requires)
);

CREATE TABLE IF NOT EXISTS saved_roadmaps (
    id          bigserial PRIMARY KEY,
    user_id     text NOT NULL,         -- Auth0 `sub`
    major_slug  text REFERENCES majors(slug),
    roadmap     jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_roadmaps_user_idx ON saved_roadmaps (user_id);

-- Example semantic match once embeddings are filled in:
-- SELECT slug, 1 - (embedding <=> $1) AS similarity FROM majors ORDER BY embedding <=> $1 LIMIT 3;
