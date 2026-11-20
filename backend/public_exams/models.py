from django.db import models
from django.db.models import Q

from common.models import TimeStamped


class Category(TimeStamped):
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.CharField(max_length=250, blank=True)
    icon = models.CharField(max_length=40, blank=True)
    is_published = models.BooleanField(default=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Difficulty(models.TextChoices):
    EASY = "easy", "Easy"
    MEDIUM = "medium", "Medium"
    HARD = "hard", "Hard"


class PublicQuestion(TimeStamped):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="questions")
    prompt = models.TextField()
    options = models.JSONField()                 # ["A", "B", "C", "D"]
    correct_index = models.PositiveSmallIntegerField()
    explanation = models.TextField(blank=True)
    marks = models.DecimalField(max_digits=5, decimal_places=2, default=1)
    difficulty = models.CharField(max_length=8, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["category", "is_active", "difficulty"])]
        constraints = [models.CheckConstraint(check=Q(marks__gt=0), name="pubq_marks_positive")]


class PublicTest(TimeStamped):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="tests")
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    duration_minutes = models.PositiveSmallIntegerField(default=30)
    pass_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=40)
    negative_marks = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    is_published = models.BooleanField(default=False, db_index=True)
    is_premium = models.BooleanField(default=False)
    max_attempts = models.PositiveSmallIntegerField(default=0, help_text="0 = unlimited practice")
    questions = models.ManyToManyField(PublicQuestion, through="PublicTestQuestion")
    # optional blueprint for random draw: {"count": 20, "difficulty": "easy"}
    blueprint = models.JSONField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["category", "is_published"])]


class PublicTestQuestion(models.Model):
    test = models.ForeignKey(PublicTest, on_delete=models.CASCADE)
    question = models.ForeignKey(PublicQuestion, on_delete=models.PROTECT)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position"]
        constraints = [models.UniqueConstraint(fields=["test", "question"], name="uniq_test_question")]


class AttemptStatus(models.TextChoices):
    IN_PROGRESS = "in_progress", "In progress"
    SUBMITTED = "submitted", "Submitted"
    EXPIRED = "expired", "Auto-submitted"


class PublicAttempt(TimeStamped):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="public_attempts")
    test = models.ForeignKey(PublicTest, on_delete=models.PROTECT, related_name="attempts")
    status = models.CharField(max_length=12, choices=AttemptStatus.choices, default=AttemptStatus.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()               # server-authoritative deadline
    submitted_at = models.DateTimeField(null=True, blank=True)
    # Frozen at start so later question edits never change a historical test.
    snapshot = models.JSONField()                     # [{id,prompt,options,correct,marks,negative,explanation}]

    class Meta:
        constraints = [  # at most ONE in-progress attempt per user+test: kills concurrent-start races
            models.UniqueConstraint(fields=["user", "test"], condition=Q(status="in_progress"),
                                    name="one_active_public_attempt"),
        ]
        indexes = [models.Index(fields=["user", "-started_at"]), models.Index(fields=["status", "expires_at"])]


class PublicAnswer(models.Model):
    attempt = models.ForeignKey(PublicAttempt, on_delete=models.CASCADE, related_name="answers")
    question_id = models.PositiveIntegerField()
    selected = models.SmallIntegerField(null=True, blank=True)
    marked = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["attempt", "question_id"], name="uniq_public_answer")]


class PublicResult(models.Model):
    attempt = models.OneToOneField(PublicAttempt, on_delete=models.CASCADE, related_name="result")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="public_results")
    test = models.ForeignKey(PublicTest, on_delete=models.PROTECT, related_name="results")
    correct = models.PositiveSmallIntegerField()
    incorrect = models.PositiveSmallIntegerField()
    unanswered = models.PositiveSmallIntegerField()
    obtained = models.DecimalField(max_digits=8, decimal_places=2)
    total = models.DecimalField(max_digits=8, decimal_places=2)
    percentage = models.DecimalField(max_digits=5, decimal_places=2)
    passed = models.BooleanField()
    time_taken_seconds = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"]),
                   models.Index(fields=["test", "-percentage", "time_taken_seconds"])]
