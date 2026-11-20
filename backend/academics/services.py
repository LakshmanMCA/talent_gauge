from django.db import transaction
from django.db.models import F

from schools.models import School


def next_admission_no(school_id):
    """Concurrency-safe: row lock + atomic increment; no duplicates under load."""
    with transaction.atomic():
        s = School.objects.select_for_update().get(pk=school_id)
        n = s.next_admission_no
        School.objects.filter(pk=s.pk).update(next_admission_no=F("next_admission_no") + 1)
        return f"ADM{n:05d}"


def next_employee_no(school_id):
    with transaction.atomic():
        s = School.objects.select_for_update().get(pk=school_id)
        n = s.next_employee_no
        School.objects.filter(pk=s.pk).update(next_employee_no=F("next_employee_no") + 1)
        return f"EMP{n:05d}"
