from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User
from common.models import AuditLog, audit
from common.permissions import IsSuperAdmin
from notifications.services import notify
from public_exams.models import PublicAttempt, PublicQuestion, PublicResult, PublicTest
from schools.models import School, SchoolStatus
from schools.serializers import SchoolSerializer


class MetricsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        by_status = dict(School.objects.values_list("status").annotate(n=Count("id")))
        by_role = dict(User.objects.values_list("role").annotate(n=Count("id")))
        return Response({"schools": by_status,
                         "pending": by_status.get(SchoolStatus.PENDING, 0),
                         "users_by_role": by_role,
                         "public_users": by_role.get(Role.PUBLIC_USER, 0),
                         "public_tests": PublicTest.objects.filter(is_published=True).count(),
                         "public_questions": PublicQuestion.objects.filter(is_active=True).count(),
                         "public_attempts": PublicAttempt.objects.count(),
                         "public_results": PublicResult.objects.count()})


class SchoolListView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = SchoolSerializer
    filterset_fields = ["status"]
    search_fields = ["name", "registration_number", "email"]

    def get_queryset(self):
        return (School.objects.annotate(member_count=Count("members"))
                .order_by("-created_at"))


class ReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "reject", "correction"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class SchoolReviewView(APIView):
    """Approve/reject with actor, time and reason recorded; approval activates the school admin."""
    permission_classes = [IsSuperAdmin]

    @transaction.atomic
    def post(self, request, pk):
        s = generics.get_object_or_404(School.objects.select_for_update(), pk=pk)
        ser = ReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d, note = ser.validated_data["decision"], ser.validated_data.get("note", "")
        if d != "approve" and not note:
            return Response({"error": {"code": 400, "message": "A note is required."}}, status=400)
        s.status = {"approve": SchoolStatus.APPROVED, "reject": SchoolStatus.REJECTED,
                    "correction": SchoolStatus.CORRECTION}[d]
        s.review_note, s.reviewed_by_id, s.reviewed_at = note, request.user.pk, timezone.now()
        s.save()
        if d == "approve":
            User.objects.filter(school=s, role=Role.SCHOOL_ADMIN).update(is_active=True)
            admin = User.objects.filter(school=s, role=Role.SCHOOL_ADMIN).first()
            if admin:
                notify(admin, "school", "Your school is approved",
                       "Sign in to set up academic years, classes and students.", link="/school",
                       key=f"school-approved:{s.pk}")
        audit(request.user, f"school.{d}", s.pk, school=s, note=note)
        return Response(SchoolSerializer(s).data)


class AuditSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ["id", "action", "target", "actor_email", "detail", "created_at"]


class AuditListView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AuditSerializer
    filterset_fields = ["action"]
    queryset = AuditLog.objects.select_related("actor").order_by("-id")


# ---------------- Platform user management ----------------
class AdminUserSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source="school.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "school", "school_name",
                  "is_active", "date_joined"]


class UserListView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AdminUserSerializer
    filterset_fields = ["role", "is_active"]
    search_fields = ["email", "full_name"]
    queryset = User.objects.select_related("school").order_by("-date_joined")


class UserStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class UserStatusView(APIView):
    """Activate/deactivate any account. An admin cannot deactivate themselves."""
    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        if user.pk == request.user.pk:
            return Response({"error": {"code": 400, "message": "You cannot change your own status."}}, status=400)
        ser = UserStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user.is_active = ser.validated_data["is_active"]
        user.save(update_fields=["is_active"])
        audit(request.user, "user.activate" if user.is_active else "user.deactivate", user.pk,
              school=user.school, email=user.email)
        return Response(AdminUserSerializer(user).data)
