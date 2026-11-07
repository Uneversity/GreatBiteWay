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


class RoadmapStep(BaseModel):
    id: str
    stage: Literal["mdc", "transfer", "career", "certification"]
    title: str
    detail: str
    duration: str
    depends_on: list[str] = []


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


class ExplainRequest(BaseModel):
    roadmap: Roadmap
    answers: list[Answer] = []  # optional: lets Gemini tie the pathway to the student's interests
