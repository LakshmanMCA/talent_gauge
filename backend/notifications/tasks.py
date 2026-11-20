from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import Notification, NotificationPreference
from .services import bulk_notify


@shared_task(bind=True, autoretry_for=(OSError,), retry_backoff=True, retry_jitter=True, max_retries=4)
def send_email_notification(self, notification_id):
    n = Notification.objects.select_related("user").filter(pk=notification_id, emailed=False).first()
    if not n or not n.user.is_active:
        return "skip"
    send_mail(n.title, n.body or n.title, settings.DEFAULT_FROM_EMAIL, [n.user.email])
    Notification.objects.filter(pk=n.pk).update(emailed=True)   # idempotent on retry
    return "sent"


@shared_task
def notify_exam_published(exam_id):
    from academics.models import Enrollment
    from school_exams.models import SchoolExam
    exam = SchoolExam.objects.filter(pk=exam_id, status="published").first()
    if not exam:
        return 0
    ids = list(Enrollment.objects.filter(school_id=exam.school_id, school_class_id=exam.school_class_id,
                                         academic_year__is_active=True)
               .values_list("student__user_id", flat=True))
    return bulk_notify(ids, "exam", f"New exam: {exam.title}",
                       f"Opens {exam.start_at:%d %b %H:%M}. Duration {exam.duration_minutes} min.",
                       "/student", f"exam-published:{exam.pk}")


@shared_task
def send_exam_reminders():
    """Beat task: remind students of exams starting within the hour. Re-checks state at run time."""
    from academics.models import Enrollment
    from school_exams.models import SchoolExam
    now = timezone.now()
    total = 0
    for exam in SchoolExam.objects.filter(status="published", start_at__gt=now,
                                          start_at__lte=now + timedelta(hours=1)):
        ids = list(Enrollment.objects.filter(school_id=exam.school_id, school_class_id=exam.school_class_id,
                                             academic_year__is_active=True)
                   .values_list("student__user_id", flat=True))
        total += bulk_notify(ids, "reminder", f"Starting soon: {exam.title}",
                             f"Begins at {exam.start_at:%H:%M}.", "/student", f"exam-reminder:{exam.pk}")
    return total
