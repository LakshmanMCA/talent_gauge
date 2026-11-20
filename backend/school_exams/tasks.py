from celery import shared_task
from django.utils import timezone

from .models import SchoolAttempt
from . import services


@shared_task
def auto_submit_expired(batch=200):
    """Idempotent sweep: finalize attempts whose server deadline has passed."""
    ids = list(SchoolAttempt.objects.filter(status="in_progress", expires_at__lte=timezone.now())
               .values_list("id", flat=True)[:batch])
    for a in SchoolAttempt.objects.filter(id__in=ids):
        services.finalize(a, "expired")
    return len(ids)
