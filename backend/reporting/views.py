import csv
from datetime import timedelta

from django.db.models import Avg, Count, Q, Sum
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from common.cache import cached, school_key
from common.models import audit
from common.permissions import IsPublicUser, IsSchoolAdmin, IsSchoolStaff
from public_exams.models import PublicResult
from school_exams.models import SchoolExam, SchoolResult
from accounts.models import Role


class PublicDashboardView(APIView):
    """Learner stats from DB aggregates (no per-row Python loops)."""
    permission_classes = [IsPublicUser]

    def get(self, request):
        qs = PublicResult.objects.filter(user=request.user)
        agg = qs.aggregate(tests=Count("id"), avg=Avg("percentage"), correct=Sum("correct"),
                           answered=Sum("correct") + Sum("incorrect"))
        accuracy = round(100 * agg["correct"] / agg["answered"], 1) if agg["answered"] else 0
        days = set(qs.filter(created_at__gte=timezone.now() - timedelta(days=60))
                   .dates("created_at", "day"))
        streak, d = 0, timezone.now().date()
        while d in days or (streak == 0 and d - timedelta(days=1) in days):
            if d in days:
                streak += 1
            d -= timedelta(days=1)
        recent = list(qs.select_related("test").order_by("-created_at")[:8].values(
            "attempt_id", "test__title", "percentage", "passed", "created_at"))
        trend = [float(r["percentage"]) for r in reversed(recent)]
        return Response({"tests_taken": agg["tests"], "average_score": round(float(agg["avg"] or 0), 1),
                         "accuracy": accuracy, "streak_days": streak, "trend": trend, "recent": recent})


class LeaderboardView(APIView):
    permission_classes = [IsPublicUser]

    def get(self, request):
        def load():
            rows = (PublicResult.objects.values("user__full_name").annotate(avg=Avg("percentage"), n=Count("id"))
                    .filter(n__gte=1).order_by("-avg")[:10])
            return [{"name": r["user__full_name"], "average": round(float(r["avg"]), 1), "tests": r["n"]} for r in rows]
        return Response(cached("public:leaderboard:v1", 300, load))


class SchoolDashboardView(APIView):
    """Cached per school; key carries tenant id so schools can never share an entry."""
    permission_classes = [IsSchoolStaff]

    def get(self, request):
        sid = request.user.school_id

        def load():
            from academics.models import StudentProfile, TeacherProfile
            r = SchoolResult.objects.filter(school_id=sid)
            agg = r.aggregate(avg=Avg("percentage"), n=Count("id"), passed=Count("id", filter=Q(passed=True)))
            per_subject = list(r.values("exam__subject__name").annotate(avg=Avg("percentage"), n=Count("id"))
                               .order_by("-avg")[:10])
            per_class = list(r.values("exam__school_class__name", "exam__school_class__section")
                             .annotate(avg=Avg("percentage")).order_by("exam__school_class__name"))
            return {"students": StudentProfile.objects.filter(school_id=sid, user__is_active=True).count(),
                    "teachers": TeacherProfile.objects.filter(school_id=sid, user__is_active=True).count(),
                    "exams": SchoolExam.objects.filter(school_id=sid).count(),
                    "attempts": agg["n"], "average": round(float(agg["avg"] or 0), 1),
                    "pass_rate": round(100 * agg["passed"] / agg["n"], 1) if agg["n"] else 0,
                    "by_subject": [{"subject": x["exam__subject__name"], "average": round(float(x["avg"]), 1)} for x in per_subject],
                    "by_class": [{"class": f'{x["exam__school_class__name"]} {x["exam__school_class__section"]}'.strip(),
                                  "average": round(float(x["avg"]), 1)} for x in per_class]}
        return Response(cached(school_key(sid, "dashboard"), 120, load))


class ExamResultsCSVView(APIView):
    """Streamed export: memory stays O(chunk) regardless of class size. Audited, tenant-scoped."""
    permission_classes = [IsSchoolAdmin]

    def get(self, request, exam_id):
        exam = SchoolExam.objects.filter(pk=exam_id, school_id=request.user.school_id).first()
        if not exam:
            return Response({"error": {"code": 404, "message": "Not found."}}, status=404)
        audit(request.user, "results.export", exam.pk, school=exam.school)
        rows = (SchoolResult.objects.filter(exam=exam, school_id=request.user.school_id)
                .select_related("student").order_by("student__full_name").iterator(chunk_size=500))

        class Echo:
            def write(self, v):
                return v
        w = csv.writer(Echo())

        def gen():
            yield w.writerow(["Student", "Correct", "Incorrect", "Unanswered", "Marks", "Total", "Percent", "Result"])
            for r in rows:  # CSV-injection guard on free text
                name = r.student.full_name
                name = "'" + name if name[:1] in "=+-@" else name
                yield w.writerow([name, r.correct, r.incorrect, r.unanswered, r.obtained, r.total,
                                  r.percentage, "Pass" if r.passed else "Fail"])
        resp = StreamingHttpResponse(gen(), content_type="text/csv")
        resp["Content-Disposition"] = f'attachment; filename="exam-{exam.pk}-results.csv"'
        return resp
