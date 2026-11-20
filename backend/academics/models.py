from django.db import models
from django.db.models import Q

from common.models import TimeStamped


class AcademicYear(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="years")
    name = models.CharField(max_length=40)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uniq_year_name_per_school"),
            models.UniqueConstraint(fields=["school"], condition=Q(is_active=True), name="one_active_year_per_school"),
            models.CheckConstraint(check=Q(end_date__gt=models.F("start_date")), name="year_dates_valid"),
        ]

    def __str__(self):
        return self.name


class SchoolClass(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="classes")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name="classes")
    name = models.CharField(max_length=60)
    section = models.CharField(max_length=20, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["school", "academic_year", "name", "section"],
                                               name="uniq_class_per_year")]
        indexes = [models.Index(fields=["school", "academic_year"])]

    def __str__(self):
        return f"{self.name} {self.section}".strip()


class Subject(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField(max_length=80)
    code = models.CharField(max_length=20)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["school", "code"], name="uniq_subject_code")]

    def __str__(self):
        return self.name


class StudentProfile(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="students")
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="student_profile")
    admission_no = models.CharField(max_length=30)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["school", "admission_no"], name="uniq_admission_no")]


class Enrollment(TimeStamped):
    """Historical: one row per student per academic year; old rows are preserved."""
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="enrollments")
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="enrollments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="enrollments")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name="enrollments")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["student", "academic_year"], name="one_enrollment_per_year")]
        indexes = [models.Index(fields=["school", "school_class"])]


class TeacherProfile(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="teachers")
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="teacher_profile")
    employee_no = models.CharField(max_length=30)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["school", "employee_no"], name="uniq_employee_no")]


class TeacherAssignment(TimeStamped):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="assignments")
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name="assignments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["teacher", "school_class", "subject"],
                                               name="uniq_teacher_assignment")]
