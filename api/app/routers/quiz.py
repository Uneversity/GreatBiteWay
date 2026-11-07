from fastapi import APIRouter, HTTPException

from app.schemas import NextQuestion, Question, QuizRequest, QuizStep, SemanticMatch, SemanticRequest
from app.services import embeddings, questions
from app.services.matching import all_questions, quiz_step

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.get("/questions", response_model=list[Question])
async def bank_questions() -> list[Question]:
    """All checkpoints, so the client can lay out the whole descent up front."""
    return all_questions()


@router.post("/step", response_model=QuizStep)
async def step(body: QuizRequest) -> QuizStep:
    """Stateless: the client sends all answers so far, gets scores, in-range fields and depth.
    Answers to Gemini-written questions count too (echo the question back in `answer.question`)."""
    return quiz_step(body.answers)


@router.post("/next", response_model=NextQuestion)
async def next_question(body: QuizRequest, gemini: bool = True) -> NextQuestion:
    """Adaptive mode: Gemini writes the next question aimed at the closest contenders.
    Falls back to the most informative bank question without a key. `?gemini=false` forces the bank."""
    return await questions.next_question(body.answers, use_gemini=gemini)


@router.post("/semantic", response_model=SemanticMatch)
async def semantic(body: SemanticRequest) -> SemanticMatch:
    """Embeds the student's answers (plus optional free text) with Gemini and ranks fields
    by cosine similarity, in Tiger Cloud via pgvector when available."""
    if not body.answers and not (body.free_text or "").strip():
        raise HTTPException(422, "Send at least one answer or some free text")
    result = await embeddings.semantic_match(body.answers, body.free_text)
    if not result:
        raise HTTPException(503, "Gemini embeddings unavailable (is GEMINI_API_KEY set?)")
    return result
