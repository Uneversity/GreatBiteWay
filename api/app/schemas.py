from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Option(BaseModel):
    label: str
    value: int
    # Only set on Gemini-written questions. Bank questions keep their weights server-side.
    traits: dict[str, float] | None = None


class Question(BaseModel):
    id: str
    text: str
    options: list[Option]
    source: Literal["bank", "gemini"] = "bank"


class Answer(BaseModel):
    question_id: str
    value: int  # option index chosen
    # For Gemini-written questions only: echo back the Question you were given so
    # the stateless backend can score it. Ignored for bank questions.
    question: Question | None = None


class QuizRequest(BaseModel):
    answers: list[Answer] = []


class FieldMatch(BaseModel):
    slug: str
    name: str
    score: float


class QuizStep(BaseModel):
    depth: float
    done: bool
    next_question: Question | None
    top_matches: list[FieldMatch]
    in_range: list[FieldMatch]  # fields still plausible given the answers so far


class NextQuestion(BaseModel):
    done: bool  # True when one field is confident enough or the question cap is hit
    question: Question | None
    source: Literal["gemini", "bank", "none"]
    focus: list[FieldMatch]  # the close contenders this question is meant to separate
    focus_traits: list[str]  # the traits that best separate those contenders


class SemanticRequest(BaseModel):
    answers: list[Answer] = []
    free_text: str | None = Field(default=None, max_length=1000)  # "in your own words, what do you enjoy?"


class SemanticMatch(BaseModel):
    matches: list[FieldMatch]  # score = cosine similarity between student and field embeddings
    backend: Literal["pgvector", "memory"]
    profile_text: str  # the text that was embedded, for transparency/debugging


class Major(BaseModel):
    slug: str
    name: str
    field: str
    mdc_program: str
    summary: str
    mdc_url: str | None = None


class CourseRef(BaseModel):
    code: str
    title: str
    credits: int
    note: str | None = None  # allowed alternatives, e.g. "or STA 2023"
    prepares_for: str | None = None  # certification name


class RoadmapStep(BaseModel):
    id: str
    stage: Literal["mdc", "transfer", "career", "certification"]
    title: str
    detail: str
    duration: str
    depends_on: list[str] = []
    courses: list[CourseRef] = []
    source_url: str | None = None  # where this step's facts come from


class Prerequisite(BaseModel):
    code: str
    title: str
    depth: int  # 1 = direct prerequisite, 2 = prerequisite of a prerequisite, ...
    requires: list[str]


class Insights(BaseModel):
    steps_24h: int
    finished_7d: int
    top_matches_7d: list[FieldMatch]  # score = share of finished quizzes
    hourly_steps_24h: list[dict]  # [{"hour": iso, "steps": n}]
    popular_answers: list[dict]  # [{"question_id", "option_idx", "label", "count"}]


class StepNote(BaseModel):
    id: str
    note: str


class RoadmapExplanation(BaseModel):
    summary: str
    step_notes: list[StepNote]
    first_move: str
    generated_by: str


class Roadmap(BaseModel):
    career: str
    summary: str
    steps: list[RoadmapStep]
    generated_by: str
    explanation: RoadmapExplanation | None = None


class SaveRoadmapRequest(BaseModel):
    major_slug: str


class SavedRoadmapSummary(BaseModel):
    id: int
    major_slug: str
    major_name: str
    created_at: datetime
    updated_at: datetime


class SavedRoadmap(SavedRoadmapSummary):
    roadmap: Roadmap


class QuizResult(BaseModel):
    id: int
    answers: list[Answer]
    top_matches: list[FieldMatch]
    depth: float
    done: bool
    created_at: datetime


class Me(BaseModel):
    user_id: str  # Auth0 `sub`
    saved_roadmaps: int
    quiz_results: int


class ExplainRequest(BaseModel):
    roadmap: Roadmap
    answers: list[Answer] = []  # optional: lets Gemini tie the pathway to the student's interests


class ElaborateRequest(BaseModel):
    roadmap: Roadmap
    step_id: str


class StepFact(BaseModel):
    label: str  # e.g. "Format", "Who it's for"
    value: str


class StepElaboration(BaseModel):
    """A deeper look at one roadmap step, shown in the side panel when a student clicks it."""
    step_id: str
    headline: str
    overview: str
    specs: list[StepFact]  # quick facts: format, length, cost notes, where it happens
    what_to_expect: list[str]
    how_to_prepare: list[str]
    questions_to_ask: list[str]  # for an MDC advisor
    leads_to: str  # how this step sets up the next one
    generated_by: str
