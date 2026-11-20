from django.db import models
from django.db.models import Q

from common.models import TimeStamped


class SchoolQuestion(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="questions")
    subject = models.ForeignKey("academics.Subject", on_delete=models.PROTECT)
    created_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    prompt = models.TextField()
    options = models.JSONField()
    correct_index = models.PositiveSmallIntegerField()
    marks = models.DecimalField(max_digits=5, decimal_places=2, default=1)

    class Meta:
        indexes = [models.Index(fields=["school", "subject"])]


class ExamStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class SchoolExam(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="exams")
    academic_year = models.ForeignKey("academics.AcademicYear", on_delete=models.PROTECT)
    school_class = models.ForeignKey("academics.SchoolClass", on_delete=models.PROTECT)
    subject = models.ForeignKey("academics.Subject", on_delete=models.PROTECT)
    created_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    title = models.CharField(max_length=160)
    instructions = models.TextField(blank=True)
    duration_minutes = models.PositiveSmallIntegerField(default=45)
    pass_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=40)
    negative_marks = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    max_attempts = models.PositiveSmallIntegerField(default=1)
    results_published = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=ExamStatus.choices, default=ExamStatus.DRAFT)
    questions = models.ManyToManyField(SchoolQuestion, through="SchoolExamQuestion")

    class Meta:
        constraints = [models.CheckConstraint(check=Q(end_at__gt=models.F("start_at")), name="exam_window_valid")]
        indexes = [models.Index(fields=["school", "status", "start_at"]),
                   models.Index(fields=["school", "school_class"])]


class SchoolExamQuestion(models.Model):
    exam = models.ForeignKey(SchoolExam, on_delete=models.CASCADE)
    question = models.ForeignKey(SchoolQuestion, on_delete=models.PROTECT)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position"]
        constraints = [models.UniqueConstraint(fields=["exam", "question"], name="uniq_exam_question")]


class RetakeAuthorization(TimeStamped):
    """Explicit, audited permission for one extra attempt."""
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE)
    exam = models.ForeignKey(SchoolExam, on_delete=models.CASCADE, related_name="retakes")
    student = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="+")
    approved_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    reason = models.CharField(max_length=250)
    consumed = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["exam", "student", "consumed"])]


class SchoolAttempt(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="attempts")
    exam = models.ForeignKey(SchoolExam, on_delete=models.PROTECT, related_name="attempts")
    student = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="school_attempts")
    attempt_no = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=12, default="in_progress")
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    submitted_at = models.DateTimeField(null=True, blank=True)
    snapshot = models.JSONField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["exam", "student", "attempt_no"], name="uniq_attempt_no"),
            models.UniqueConstraint(fields=["exam", "student"], condition=Q(status="in_progress"),
                                    name="one_active_school_attempt"),
        ]
        indexes = [models.Index(fields=["status", "expires_at"]),
                   models.Index(fields=["school", "student", "-started_at"])]


class SchoolAnswer(models.Model):
    attempt = models.ForeignKey(SchoolAttempt, on_delete=models.CASCADE, related_name="answers")
    question_id = models.PositiveIntegerField()
    selected = models.SmallIntegerField(null=True, blank=True)
    marked = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["attempt", "question_id"], name="uniq_school_answer")]


class SchoolResult(models.Model):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="results")
    attempt = models.OneToOneField(SchoolAttempt, on_delete=models.CASCADE, related_name="result")
    exam = models.ForeignKey(SchoolExam, on_delete=models.PROTECT, related_name="results")
    student = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="+")
    correct = models.PositiveSmallIntegerField()
    incorrect = models.PositiveSmallIntegerField()
    unanswered = models.PositiveSmallIntegerField()
    obtained = models.DecimalField(max_digits=8, decimal_places=2)
    total = models.DecimalField(max_digits=8, decimal_places=2)
    percentage = models.DecimalField(max_digits=5, decimal_places=2)
    passed = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["school", "exam"]), models.Index(fields=["school", "student"])]
