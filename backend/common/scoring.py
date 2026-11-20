"""Deterministic single-pass O(Q) scoring shared by public and school exams.
Inputs are plain dicts so the function is trivially unit-testable."""
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Score:
    correct: int
    incorrect: int
    unanswered: int
    obtained: Decimal
    total: Decimal
    percentage: Decimal
    passed: bool


def score_attempt(questions, answers, pass_percentage):
    """questions: iterable of dict(id, correct, marks, negative);
    answers: dict question_id -> selected option (hash map => O(1) lookup)."""
    correct = incorrect = unanswered = 0
    obtained = total = Decimal("0")
    for q in questions:
        marks = Decimal(str(q["marks"]))
        total += marks
        sel = answers.get(q["id"])
        if sel is None or sel == "":
            unanswered += 1
        elif sel == q["correct"]:
            correct += 1
            obtained += marks
        else:
            incorrect += 1
            obtained -= Decimal(str(q.get("negative", 0)))
    obtained = max(obtained, Decimal("0"))
    pct = (obtained / total * 100).quantize(Decimal("0.01")) if total else Decimal("0")
    return Score(correct, incorrect, unanswered, obtained, total, pct, pct >= Decimal(str(pass_percentage)))
