"""Integration tests (need Django + pytest-django): tenant isolation, attempt integrity, retakes."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import AcademicYear, Enrollment, SchoolClass, StudentProfile, Subject
from accounts.models import Role, User
from public_exams.models import Category, PublicQuestion, PublicTest, PublicTestQuestion
from school_exams.models import SchoolExam, SchoolExamQuestion, SchoolQuestion
from schools.models import School

pytestmark = pytest.mark.django_db


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def make_school(tag):
    s = School.objects.create(name=f"S{tag}", registration_number=f"R{tag}", email=f"s{tag}@x.test", status="approved")
    admin = User.objects.create_user(f"admin{tag}@x.test", "Passw0rd!x", full_name="A", role=Role.SCHOOL_ADMIN, school=s)
    today = timezone.now().date()
    y = AcademicYear.objects.create(school=s, name="Y", start_date=today - timedelta(days=5),
                                    end_date=today + timedelta(days=300), is_active=True)
    k = SchoolClass.objects.create(school=s, academic_year=y, name="G8")
    sub = Subject.objects.create(school=s, name="Math", code="M")
    return s, admin, y, k, sub


def make_exam(s, admin, y, k, sub, attempts=1):
    stu = User.objects.create_user(f"stu{s.pk}@x.test", "Passw0rd!x", full_name="St", role=Role.STUDENT, school=s)
    sp = StudentProfile.objects.create(school=s, user=stu, admission_no=f"A{s.pk}")
    Enrollment.objects.create(school=s, student=sp, school_class=k, academic_year=y)
    qs = [SchoolQuestion.objects.create(school=s, subject=sub, created_by=admin, prompt=f"q{i}",
                                        options=["a", "b"], correct_index=0) for i in range(3)]
    ex = SchoolExam.objects.create(school=s, academic_year=y, school_class=k, subject=sub, created_by=admin,
                                   title="T", status="published", max_attempts=attempts,
                                   start_at=timezone.now() - timedelta(hours=1), end_at=timezone.now() + timedelta(days=1))
    SchoolExamQuestion.objects.bulk_create([SchoolExamQuestion(exam=ex, question=q, position=i) for i, q in enumerate(qs)])
    return stu, ex, qs


def test_cross_school_access_denied():
    a = make_school("A")
    b = make_school("B")
    _, ex_b, _ = make_exam(*b)
    admin_a = client_for(a[1])
    assert admin_a.get(f"/api/v1/school-exams/exams/{ex_b.pk}/").status_code == 404
    assert admin_a.post(f"/api/v1/school-exams/exams/{ex_b.pk}/publish/").status_code == 404
    assert admin_a.get(f"/api/v1/results/school/exams/{ex_b.pk}/export/").status_code == 404
    assert admin_a.get("/api/v1/school-exams/exams/").json()["count"] == 0


def test_student_cannot_start_other_school_exam():
    a, b = make_school("A"), make_school("B")
    stu_a, _, _ = make_exam(*a)
    _, ex_b, _ = make_exam(*b)
    assert client_for(stu_a).post(f"/api/v1/school-exams/my/start/{ex_b.pk}/").status_code == 400


def test_one_attempt_then_blocked_then_retake():
    s = make_school("A")
    stu, ex, qs = make_exam(*s)
    c = client_for(stu)
    r = c.post(f"/api/v1/school-exams/my/start/{ex.pk}/")
    assert r.status_code == 200
    aid = r.json()["attempt_id"]
    assert "correct" not in str(r.json())                    # answer key never sent
    assert c.post(f"/api/v1/school-exams/my/start/{ex.pk}/").json()["attempt_id"] == aid  # idempotent resume
    c.post(f"/api/v1/school-exams/my/attempts/{aid}/answer/", {"question_id": qs[0].id, "selected": 0}, format="json")
    assert c.post(f"/api/v1/school-exams/my/attempts/{aid}/submit/").status_code == 200
    assert c.post(f"/api/v1/school-exams/my/attempts/{aid}/submit/").status_code == 200  # double submit safe
    assert c.post(f"/api/v1/school-exams/my/start/{ex.pk}/").status_code == 403           # no restart
    admin = client_for(s[1])
    assert admin.post(f"/api/v1/school-exams/exams/{ex.pk}/retake/", {"student": stu.pk, "reason": "Network failure"},
                      format="json").status_code == 201
    assert c.post(f"/api/v1/school-exams/my/start/{ex.pk}/").status_code == 200
    from school_exams.models import SchoolAttempt, SchoolResult
    assert SchoolAttempt.objects.filter(exam=ex, student=stu).count() == 2   # history preserved
    assert SchoolResult.objects.filter(exam=ex, student=stu).count() == 1


def test_public_expired_attempt_rejects_answers():
    u = User.objects.create_user("p@x.test", "Passw0rd!x", full_name="P")
    cat = Category.objects.create(name="Q", slug="q")
    q = PublicQuestion.objects.create(category=cat, prompt="1+1", options=["1", "2"], correct_index=1)
    t = PublicTest.objects.create(category=cat, title="T", is_published=True)
    PublicTestQuestion.objects.create(test=t, question=q)
    c = client_for(u)
    r = c.post(f"/api/v1/public/attempts/start/{t.pk}/").json()
    from public_exams.models import PublicAttempt
    PublicAttempt.objects.filter(pk=r["attempt_id"]).update(expires_at=timezone.now() - timedelta(seconds=1))
    resp = c.post(f"/api/v1/public/attempts/{r['attempt_id']}/answer/", {"question_id": q.pk, "selected": 1}, format="json")
    assert resp.status_code == 403


def test_public_user_cannot_access_school_or_platform():
    u = User.objects.create_user("p2@x.test", "Passw0rd!x", full_name="P")
    c = client_for(u)
    assert c.get("/api/v1/academics/students/").status_code == 403
    assert c.get("/api/v1/platform/metrics/").status_code == 403


def test_review_hidden_until_submitted():
    u = User.objects.create_user("p3@x.test", "Passw0rd!x", full_name="P")
    cat = Category.objects.create(name="Q", slug="q2")
    q = PublicQuestion.objects.create(category=cat, prompt="x", options=["a", "b"], correct_index=0)
    t = PublicTest.objects.create(category=cat, title="T", is_published=True)
    PublicTestQuestion.objects.create(test=t, question=q)
    c = client_for(u)
    aid = c.post(f"/api/v1/public/attempts/start/{t.pk}/").json()["attempt_id"]
    assert c.get(f"/api/v1/public/attempts/{aid}/review/").status_code == 403
    c.post(f"/api/v1/public/attempts/{aid}/submit/")
    assert c.get(f"/api/v1/public/attempts/{aid}/review/").status_code == 200


def test_notification_idempotent():
    from notifications.models import Notification
    from notifications.services import notify
    u = User.objects.create_user("n@x.test", "Passw0rd!x", full_name="N")
    notify(u, "x", "T", key="k1")
    notify(u, "x", "T", key="k1")
    assert Notification.objects.filter(user=u).count() == 1
