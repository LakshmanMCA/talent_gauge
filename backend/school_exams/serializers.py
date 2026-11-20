from rest_framework import serializers

from accounts.models import Role, User
from academics.models import AcademicYear, SchoolClass, Subject, TeacherAssignment
from .models import SchoolExam, SchoolExamQuestion, SchoolQuestion, SchoolResult


def _same_school(request, obj):
    if obj.school_id != request.user.school_id:
        raise serializers.ValidationError("Invalid reference.")
    return obj


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolQuestion
        fields = ["id", "subject", "prompt", "options", "correct_index", "marks"]

    def validate_subject(self, subject):
        req = self.context["request"]
        _same_school(req, subject)
        if req.user.role == Role.TEACHER and not TeacherAssignment.objects.filter(
                teacher__user=req.user, subject=subject).exists():
            raise serializers.ValidationError("You are not assigned to this subject.")
        return subject

    def validate(self, a):
        opts = a.get("options", getattr(self.instance, "options", []))
        idx = a.get("correct_index", getattr(self.instance, "correct_index", 0))
        if not isinstance(opts, list) or not 2 <= len(opts) <= 6 or not 0 <= idx < len(opts):
            raise serializers.ValidationError("Provide 2-6 options and a valid correct_index.")
        return a


class ExamSerializer(serializers.ModelSerializer):
    question_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    question_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = SchoolExam
        fields = ["id", "title", "instructions", "academic_year", "school_class", "subject", "duration_minutes",
                  "pass_percentage", "negative_marks", "start_at", "end_at", "max_attempts",
                  "results_published", "status", "question_ids", "question_count"]
        read_only_fields = ["status"]

    def validate(self, a):
        req = self.context["request"]
        for f in ("academic_year", "school_class", "subject"):
            if f in a:
                _same_school(req, a[f])
        if "school_class" in a and "academic_year" in a and a["school_class"].academic_year_id != a["academic_year"].id:
            raise serializers.ValidationError("Class does not belong to that academic year.")
        if req.user.role == Role.TEACHER and "school_class" in a and not TeacherAssignment.objects.filter(
                teacher__user=req.user, school_class=a["school_class"], subject=a["subject"]).exists():
            raise serializers.ValidationError("You are not assigned to this class and subject.")
        if "start_at" in a and "end_at" in a and a["end_at"] <= a["start_at"]:
            raise serializers.ValidationError("End must be after start.")
        # questions must be in the same school AND subject
        ids = a.get("question_ids")
        if ids:
            ok = SchoolQuestion.objects.filter(id__in=ids, school_id=req.user.school_id,
                                               subject=a.get("subject", getattr(self.instance, "subject", None))).count()
            if ok != len(set(ids)):
                raise serializers.ValidationError("One or more questions are invalid for this exam.")
        return a

    def _sync(self, exam, ids):
        SchoolExamQuestion.objects.filter(exam=exam).delete()
        SchoolExamQuestion.objects.bulk_create(
            [SchoolExamQuestion(exam=exam, question_id=q, position=i) for i, q in enumerate(ids)])

    def create(self, data):
        ids = data.pop("question_ids", [])
        exam = super().create(data)
        self._sync(exam, ids)
        return exam

    def update(self, inst, data):
        if inst.status != "draft":
            raise serializers.ValidationError("Only draft exams can be edited.")
        ids = data.pop("question_ids", None)
        inst = super().update(inst, data)
        if ids is not None:
            self._sync(inst, ids)
        return inst


class StudentExamSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = SchoolExam
        fields = ["id", "title", "instructions", "subject_name", "duration_minutes", "start_at", "end_at",
                  "max_attempts"]


class StudentResultSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source="exam.title", read_only=True)

    class Meta:
        model = SchoolResult
        fields = ["attempt_id", "exam_title", "correct", "incorrect", "unanswered", "obtained", "total",
                  "percentage", "passed", "created_at"]
