from django.db import models
from common.models import TimeStamped


class SchoolStatus(models.TextChoices):
    PENDING = "pending", "Pending approval"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    CORRECTION = "correction", "Correction requested"


class School(TimeStamped):
    name = models.CharField(max_length=200)
    registration_number = models.CharField(max_length=60, unique=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=SchoolStatus.choices, default=SchoolStatus.PENDING)
    review_note = models.TextField(blank=True)
    reviewed_by_id = models.BigIntegerField(null=True, blank=True)  # no FK: avoids app cycle
    reviewed_at = models.DateTimeField(null=True, blank=True)
    next_admission_no = models.PositiveIntegerField(default=1)   # concurrency-safe counters
    next_employee_no = models.PositiveIntegerField(default=1)

    class Meta:
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return self.name
