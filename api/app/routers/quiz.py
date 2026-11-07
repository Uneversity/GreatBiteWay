from fastapi import APIRouter

from app.schemas import QuizRequest, QuizStep
from app.services.matching import quiz_step

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/step", response_model=QuizStep)
async def step(body: QuizRequest) -> QuizStep:
    """Stateless: the client sends all answers so far, gets the next question + depth."""
    return quiz_step(body.answers)
