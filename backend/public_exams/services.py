"""Public exam engine. Server is authoritative for time, eligibility and scoring."""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from common.scoring import score_attempt
from common.selection import reservoir_sample
from .models import (AttemptStatus, PublicAnswer, PublicAttempt, PublicQuestion, PublicResult, PublicTest)


def _build_snapshot(test):
    if test.blueprint:
        ids = PublicQuestion.objects.filter(category_id=test.category_id, is_active=True)
        if test.blueprint.get("difficulty"):
            ids = ids.filter(difficulty=test.blueprint["difficulty"])
        picked = reservoir_sample(ids.values_list("id", flat=True).iterator(chunk_size=2000),
                                  int(test.blueprint.get("count", 10)))
        qs = list(PublicQuestion.objects.filter(id__in=picked))
    else:
        qs = list(PublicQuestion.objects.filter(publictestquestion__test=test, is_active=True)
                  .order_by("publictestquestion__position"))
    return [{"id": q.id, "prompt": q.prompt, "options": q.options, "correct": q.correct_index,
             "marks": str(q.marks), "negative": str(test.negative_marks),
             "explanation": q.explanation} for q in qs]


def start_attempt(user, test_id):
    """Idempotent + race-safe: returns the active attempt if one exists."""
    test = PublicTest.objects.filter(pk=test_id, is_published=True).first()
    if not test:
        raise ValidationError("Test not found.")           # unpublished == not discoverable
    if test.is_premium:
        raise PermissionDenied("Premium access required.")  # entitlement hook (subscriptions app)
    with transaction.atomic():
        active = (PublicAttempt.objects.select_for_update()
                  .filter(user=user, test=test, status=AttemptStatus.IN_PROGRESS).first())
        if active and active.expires_at > timezone.now():
            return active
        if active:
            finalize(active, AttemptStatus.EXPIRED)
        if test.max_attempts:
            used = PublicAttempt.objects.filter(user=user, test=test).count()
            if used >= test.max_attempts:
                raise PermissionDenied("Attempt limit reached for this test.")
        snap = _build_snapshot(test)
        if not snap:
            raise ValidationError("This test has no questions yet.")
        try:
            with transaction.atomic():
                return PublicAttempt.objects.create(
                    user=user, test=test, snapshot=snap,
                    expires_at=timezone.now() + timedelta(minutes=test.duration_minutes))
        except IntegrityError:   # concurrent start lost the race -> return the winner
            return PublicAttempt.objects.get(user=user, test=test, status=AttemptStatus.IN_PROGRESS)


def client_questions(attempt):
    """Strip answers/scoring metadata before sending to the browser."""
    return [{"id": q["id"], "prompt": q["prompt"], "options": q["options"], "marks": q["marks"]}
            for q in attempt.snapshot]


def save_answer(attempt, question_id, selected, marked):
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise PermissionDenied("Attempt is closed.")
    if attempt.expires_at <= timezone.now():
        finalize(attempt, AttemptStatus.EXPIRED)
        raise PermissionDenied("Time is up. Your attempt was submitted.")
    q = next((q for q in attempt.snapshot if q["id"] == question_id), None)
    if q is None:
        raise ValidationError("Question is not part of this attempt.")
    if selected is not None and not (0 <= selected < len(q["options"])):
        raise ValidationError("Invalid option.")
    PublicAnswer.objects.update_or_create(attempt=attempt, question_id=question_id,
                                          defaults={"selected": selected, "marked": marked})


@transaction.atomic
def finalize(attempt, status=AttemptStatus.SUBMITTED):
    """Atomic + idempotent: repeated calls return the same result."""
    locked = PublicAttempt.objects.select_for_update().get(pk=attempt.pk)
    if locked.status != AttemptStatus.IN_PROGRESS:
        return locked.result
    answers = dict(locked.answers.values_list("question_id", "selected"))
    s = score_attempt(locked.snapshot, answers, locked.test.pass_percentage)
    now = timezone.now()
    locked.status, locked.submitted_at = status, now
    locked.save(update_fields=["status", "submitted_at", "updated_at"])
    taken = int(min((now - locked.started_at).total_seconds(), locked.test.duration_minutes * 60))
    result = PublicResult.objects.create(
        attempt=locked, user=locked.user, test=locked.test, correct=s.correct, incorrect=s.incorrect,
        unanswered=s.unanswered, obtained=s.obtained, total=s.total, percentage=s.percentage,
        passed=s.passed, time_taken_seconds=taken)
    from notifications.services import notify
    notify(locked.user, "result", f"Result ready: {locked.test.title}",
           f"You scored {s.percentage}% ({s.correct} correct).", link=f"/results/{locked.pk}",
           key=f"pub-result:{locked.pk}")
    return result
