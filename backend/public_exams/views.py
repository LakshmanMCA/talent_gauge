from django.db.models import Count, Q
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.cache import cached, invalidate_on_commit, public_key
from common.models import audit
from common.permissions import IsPublicUser, IsSuperAdmin
from common.throttles import AnswerSaveThrottle, ExamStartThrottle
from . import services
from .models import AttemptStatus, Category, PublicAttempt, PublicQuestion, PublicResult, PublicTest
from .serializers import (AdminQuestionSerializer, AdminTestSerializer, CategorySerializer,
                          ResultSerializer, TestListSerializer)

CATS_KEY, HOME_KEY = public_key("categories"), public_key("home")


class CategoryListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        def load():
            qs = (Category.objects.filter(is_published=True)
                  .annotate(test_count=Count("tests", filter=Q(tests__is_published=True))))
            return CategorySerializer(qs, many=True).data
        return Response(cached(CATS_KEY, 300, load))


class HomeStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        def load():
            from accounts.models import Role, User
            return {"tests": PublicTest.objects.filter(is_published=True).count(),
                    "questions": PublicQuestion.objects.filter(is_active=True).count(),
                    "learners": User.objects.filter(role=Role.PUBLIC_USER).count(),
                    "categories": Category.objects.filter(is_published=True).count()}
        return Response(cached(HOME_KEY, 120, load))


class TestListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = TestListSerializer
    filterset_fields = ["category"]
    search_fields = ["title"]

    def get_queryset(self):
        return (PublicTest.objects.filter(is_published=True).select_related("category")
                .annotate(question_count=Count("publictestquestion")).order_by("-id"))


class TestDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = TestListSerializer

    def get_queryset(self):
        return PublicTest.objects.filter(is_published=True).select_related("category") \
            .annotate(question_count=Count("publictestquestion"))


class StartAttemptView(APIView):
    permission_classes = [IsPublicUser]
    throttle_classes = [ExamStartThrottle]

    def post(self, request, test_id):
        a = services.start_attempt(request.user, test_id)
        return Response({"attempt_id": a.pk, "test": a.test.title, "expires_at": a.expires_at,
                         "questions": services.client_questions(a),
                         "answers": {x.question_id: {"selected": x.selected, "marked": x.marked}
                                     for x in a.answers.all()}})


class _AttemptMixin:
    permission_classes = [IsPublicUser]

    def get_attempt(self, request, pk):
        # ownership enforced in the query: other users' attempts are simply 404
        return generics.get_object_or_404(PublicAttempt.objects.select_related("test"), pk=pk, user=request.user)


class SaveAnswerView(_AttemptMixin, APIView):
    throttle_classes = [AnswerSaveThrottle]

    def post(self, request, pk):
        attempt = self.get_attempt(request, pk)
        services.save_answer(attempt, int(request.data.get("question_id", -1)),
                             request.data.get("selected"), bool(request.data.get("marked", False)))
        return Response({"saved": True})


class SubmitView(_AttemptMixin, APIView):
    def post(self, request, pk):
        result = services.finalize(self.get_attempt(request, pk))
        return Response(ResultSerializer(result).data)


class ReviewView(_AttemptMixin, APIView):
    """Answer key is released only after the attempt is closed."""
    def get(self, request, pk):
        a = self.get_attempt(request, pk)
        if a.status == AttemptStatus.IN_PROGRESS:
            return Response({"error": {"code": 403, "message": "Review opens after submission."}}, status=403)
        chosen = dict(a.answers.values_list("question_id", "selected"))
        return Response([{"id": q["id"], "prompt": q["prompt"], "options": q["options"],
                          "correct": q["correct"], "selected": chosen.get(q["id"]),
                          "explanation": q["explanation"]} for q in a.snapshot])


class MyResultsView(generics.ListAPIView):
    permission_classes = [IsPublicUser]
    serializer_class = ResultSerializer

    def get_queryset(self):
        return PublicResult.objects.filter(user=self.request.user).select_related("test").order_by("-created_at")


# ---------------- Super Admin content management ----------------
class _AdminBase(viewsets.ModelViewSet):
    permission_classes = [IsSuperAdmin]

    def _bust(self):
        invalidate_on_commit(CATS_KEY, HOME_KEY)

    def perform_create(self, ser):
        obj = ser.save()
        self._bust()
        audit(self.request.user, f"{self.basename}.create", obj.pk)

    def perform_update(self, ser):
        obj = ser.save()
        self._bust()
        audit(self.request.user, f"{self.basename}.update", obj.pk)

    def perform_destroy(self, inst):
        audit(self.request.user, f"{self.basename}.delete", inst.pk)
        inst.delete()
        self._bust()


class AdminCategoryViewSet(_AdminBase):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class AdminQuestionViewSet(_AdminBase):
    queryset = PublicQuestion.objects.select_related("category").order_by("-id")
    serializer_class = AdminQuestionSerializer
    filterset_fields = ["category", "difficulty", "is_active"]
    search_fields = ["prompt"]


class AdminTestViewSet(_AdminBase):
    queryset = (PublicTest.objects.select_related("category")
                .prefetch_related("publictestquestion_set").order_by("-id"))
    serializer_class = AdminTestSerializer
    filterset_fields = ["category", "is_published"]

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        t = self.get_object()
        if not t.blueprint and not t.publictestquestion_set.exists():
            return Response({"error": {"code": 400, "message": "Add questions before publishing."}}, status=400)
        t.is_published = True
        t.save(update_fields=["is_published", "updated_at"])
        self._bust()
        audit(request.user, "public_test.publish", t.pk)
        return Response({"published": True})
