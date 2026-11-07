from fastapi import APIRouter

from app.schemas import Question, QuizRequest, QuizStep
from app.services.matching import all_questions, quiz_step

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.get("/questions", response_model=list[Question])
async def questions() -> list[Question]:
    """All checkpoints, so the client can lay out the whole descent up front."""
    return all_questions()


@router.post("/step", response_model=QuizStep)
async def step(body: QuizRequest) -> QuizStep:
    """Stateless: the client sends all answers so far, gets scores, in-range fields and depth."""
    return quiz_step(body.answers)
