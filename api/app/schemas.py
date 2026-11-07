from typing import Literal

from pydantic import BaseModel


class Answer(BaseModel):
    question_id: str
    value: int  # option index chosen


class QuizRequest(BaseModel):
    answers: list[Answer] = []


class Option(BaseModel):
    label: str
    value: int


class Question(BaseModel):
    id: str
    text: str
    options: list[Option]


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


class Roadmap(BaseModel):
    career: str
    summary: str
    steps: list[RoadmapStep]
    generated_by: str
