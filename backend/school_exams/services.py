"""School exam engine: eligibility is enforced here in a transaction, backed by DB constraints."""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from academics.models import Enrollment
from common.models import audit
from common.scoring import score_attempt
from .models import (ExamStatus, RetakeAuthorization, SchoolAnswer, SchoolAttempt, SchoolExam,
                     SchoolResult)


def eligible_exams(student):
    """Exams for the student's CURRENT enrolment class, in their school only."""
    class_ids = Enrollment.objects.filter(student__user=student, academic_year__is_active=True) \
        .values_list("school_class_id", flat=True)
    return SchoolExam.objects.filter(school_id=student.school_id, school_class_id__in=class_ids,
                                     status=ExamStatus.PUBLISHED).select_related("subject")


def start_attempt(student, exam_id):
    exam = eligible_exams(student).filter(pk=exam_id).first()
    if not exam:
        raise ValidationError("Exam not found.")  # not-eligible == not-found, no leakage
    now = timezone.now()
    if not exam.start_at <= now <= exam.end_at:
        raise PermissionDenied("This exam is not open right now.")
    with transaction.atomic():
        active = (SchoolAttempt.objects.select_for_update()
                  .filter(exam=exam, student=student, status="in_progress").first())
        if active and active.expires_at > now:
            return active
        if active:
            finalize(active, "expired")
        used = SchoolAttempt.objects.filter(exam=exam, student=student).count()
        retake = None
        if used >= exam.max_attempts:
            retake = (RetakeAuthorization.objects.select_for_update()
                      .filter(exam=exam, student=student, consumed=False).first())
            if not retake:
                raise PermissionDenied("No attempts left. Ask your school admin to authorise a retake.")
        qs = list(exam.questions.order_by("schoolexamquestion__position"))
        if not qs:
            raise ValidationError("Exam has no questions.")
        snap = [{"id": q.id, "prompt": q.prompt, "options": q.options, "correct": q.correct_index,
                 "marks": str(q.marks), "negative": str(exam.negative_marks)} for q in qs]
        try:
            with transaction.atomic():
                attempt = SchoolAttempt.objects.create(
                    school_id=exam.school_id, exam=exam, student=student, attempt_no=used + 1, snapshot=snap,
                    expires_at=min(now + timedelta(minutes=exam.duration_minutes), exam.end_at + timedelta(minutes=5)))
        except IntegrityError:
            return SchoolAttempt.objects.get(exam=exam, student=student, status="in_progress")
        if retake:
            retake.consumed = True
            retake.save(update_fields=["consumed", "updated_at"])
        return attempt


def save_answer(attempt, qid, selected, marked):
    if attempt.status != "in_progress":
        raise PermissionDenied("Attempt is closed.")
    if attempt.expires_at <= timezone.now():
        finalize(attempt, "expired")
        raise PermissionDenied("Time is up. Your attempt was submitted.")
    q = next((q for q in attempt.snapshot if q["id"] == qid), None)
    if q is None:
        raise ValidationError("Question is not part of this attempt.")
    if selected is not None and not 0 <= selected < len(q["options"]):
        raise ValidationError("Invalid option.")
    SchoolAnswer.objects.update_or_create(attempt=attempt, question_id=qid,
                                          defaults={"selected": selected, "marked": marked})


@transaction.atomic
def finalize(attempt, status="submitted"):
    locked = SchoolAttempt.objects.select_for_update().select_related("exam").get(pk=attempt.pk)
    if locked.status != "in_progress":
        return locked.result
    answers = dict(locked.answers.values_list("question_id", "selected"))
    s = score_attempt(locked.snapshot, answers, locked.exam.pass_percentage)
    locked.status, locked.submitted_at = status, timezone.now()
    locked.save(update_fields=["status", "submitted_at", "updated_at"])
    return SchoolResult.objects.create(
        school_id=locked.school_id, attempt=locked, exam=locked.exam, student=locked.student,
        correct=s.correct, incorrect=s.incorrect, unanswered=s.unanswered, obtained=s.obtained,
        total=s.total, percentage=s.percentage, passed=s.passed)


def authorize_retake(admin, exam, student, reason):
    if student.school_id != exam.school_id or exam.school_id != admin.school_id:
        raise ValidationError("Invalid student or exam.")
    r = RetakeAuthorization.objects.create(school_id=exam.school_id, exam=exam, student=student,
                                           approved_by=admin, reason=reason)
    audit(admin, "retake.authorize", exam.pk, school=exam.school, student=student.pk, reason=reason)
    from notifications.services import notify
    notify(student, "retake", f"Retake approved: {exam.title}", reason, link=f"/student/exams/{exam.pk}",
           key=f"retake:{r.pk}")
    return r


def publish_exam(user, exam):
    if exam.status != ExamStatus.DRAFT:
        raise ValidationError("Only draft exams can be published.")
    if not exam.schoolexamquestion_set.exists():
        raise ValidationError("Add questions before publishing.")
    exam.status = ExamStatus.PUBLISHED
    exam.save(update_fields=["status", "updated_at"])
    audit(user, "exam.publish", exam.pk, school=exam.school)
    from notifications.tasks import notify_exam_published
    transaction.on_commit(lambda: notify_exam_published.delay(exam.pk))
