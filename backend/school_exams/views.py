from django.db.models import Count
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User
from common.permissions import IsSchoolAdmin, IsSchoolStaff, IsSchoolStudent, TenantScopedMixin
from common.throttles import AnswerSaveThrottle, ExamStartThrottle
from . import services
from .models import SchoolAttempt, SchoolExam, SchoolQuestion, SchoolResult
from .serializers import (ExamSerializer, QuestionSerializer, StudentExamSerializer, StudentResultSerializer)


class QuestionViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsSchoolStaff]
    queryset = SchoolQuestion.objects.select_related("subject").order_by("-id")
    serializer_class = QuestionSerializer
    filterset_fields = ["subject"]
    search_fields = ["prompt"]

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        if u.role == Role.TEACHER:  # teachers only see subjects they are assigned to
            qs = qs.filter(subject__teacherassignment__teacher__user=u).distinct()
        return qs

    def perform_create(self, ser):
        ser.save(school_id=self.request.user.school_id, created_by=self.request.user)


class ExamViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsSchoolStaff]
    queryset = SchoolExam.objects.select_related("subject", "school_class").annotate(
        question_count=Count("schoolexamquestion")).order_by("-start_at")
    serializer_class = ExamSerializer
    filterset_fields = ["status", "school_class", "subject"]

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        if u.role == Role.TEACHER:
            qs = qs.filter(created_by=u)
        return qs

    def perform_create(self, ser):
        ser.save(school_id=self.request.user.school_id, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        services.publish_exam(request.user, self.get_object())
        return Response({"status": "published"})

    @action(detail=True, methods=["post"], permission_classes=[IsSchoolAdmin])
    def retake(self, request, pk=None):
        exam = self.get_object()
        student = generics.get_object_or_404(User, pk=request.data.get("student"),
                                             school_id=request.user.school_id, role=Role.STUDENT)
        reason = str(request.data.get("reason", "")).strip()
        if len(reason) < 5:
            return Response({"error": {"code": 400, "message": "A reason is required."}}, status=400)
        services.authorize_retake(request.user, exam, student, reason)
        return Response({"authorized": True}, status=201)


# ---------------- Student portal ----------------
class MyExamsView(generics.ListAPIView):
    permission_classes = [IsSchoolStudent]
    serializer_class = StudentExamSerializer

    def get_queryset(self):
        return services.eligible_exams(self.request.user).order_by("start_at")


class StartView(APIView):
    permission_classes = [IsSchoolStudent]
    throttle_classes = [ExamStartThrottle]

    def post(self, request, exam_id):
        a = services.start_attempt(request.user, exam_id)
        return Response({"attempt_id": a.pk, "expires_at": a.expires_at,
                         "questions": [{"id": q["id"], "prompt": q["prompt"], "options": q["options"],
                                        "marks": q["marks"]} for q in a.snapshot],
                         "answers": {x.question_id: {"selected": x.selected, "marked": x.marked}
                                     for x in a.answers.all()}})


class _Mixin:
    permission_classes = [IsSchoolStudent]

    def attempt(self, request, pk):
        return generics.get_object_or_404(SchoolAttempt, pk=pk, student=request.user,
                                          school_id=request.user.school_id)


class AnswerView(_Mixin, APIView):
    throttle_classes = [AnswerSaveThrottle]

    def post(self, request, pk):
        services.save_answer(self.attempt(request, pk), int(request.data.get("question_id", -1)),
                             request.data.get("selected"), bool(request.data.get("marked", False)))
        return Response({"saved": True})


class SubmitView(_Mixin, APIView):
    def post(self, request, pk):
        r = services.finalize(self.attempt(request, pk))
        if not r.exam.results_published:
            return Response({"submitted": True, "message": "Submitted. Results will be released by your school."})
        return Response(StudentResultSerializer(r).data)


class MyResultsView(generics.ListAPIView):
    permission_classes = [IsSchoolStudent]
    serializer_class = StudentResultSerializer

    def get_queryset(self):
        return (SchoolResult.objects.filter(student=self.request.user, school_id=self.request.user.school_id,
                                            exam__results_published=True)
                .select_related("exam").order_by("-created_at"))
