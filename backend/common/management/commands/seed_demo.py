"""python manage.py seed_demo  -> demo categories, tests, one approved school and users."""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from academics.models import AcademicYear, Enrollment, SchoolClass, StudentProfile, Subject, TeacherAssignment, TeacherProfile
from accounts.models import Role, User
from public_exams.models import Category, PublicQuestion, PublicTest, PublicTestQuestion
from school_exams.models import SchoolExam, SchoolExamQuestion, SchoolQuestion
from schools.models import School, SchoolStatus

CATS = [("Quantitative Aptitude", "quant", "calculator"), ("Logical Reasoning", "reasoning", "puzzle"),
        ("Verbal Ability", "verbal", "message"), ("General Knowledge", "gk", "globe"),
        ("English", "english", "book"), ("Computer Knowledge", "computer", "cpu"),
        ("Programming", "programming", "code"), ("Technical MCQs", "technical", "wrench"),
        ("Interview Preparation", "interview", "users")]
QS = [("What is 15% of 240?", ["24", "36", "30", "42"], 1), ("Next in series: 2, 6, 12, 20, ?", ["28", "30", "32", "26"], 1),
      ("Speed 60 km/h for 2.5 hours covers?", ["120 km", "150 km", "180 km", "135 km"], 1),
      ("Average of 10, 20, 30, 40?", ["20", "25", "30", "35"], 1), ("Square root of 196?", ["12", "13", "14", "16"], 2),
      ("If A=1, B=2 then CAB = ?", ["312", "321", "213", "123"], 0), ("12 x 12 = ?", ["124", "144", "146", "154"], 1),
      ("Simple interest on 1000 at 10% for 2 years?", ["100", "200", "150", "220"], 1)]


class Command(BaseCommand):
    @transaction.atomic
    def handle(self, *a, **kw):
        cats = {s: Category.objects.get_or_create(slug=s, defaults={"name": n, "icon": i, "position": k})[0]
                for k, (n, s, i) in enumerate(CATS)}
        quant = cats["quant"]
        if not PublicQuestion.objects.exists():
            qs = [PublicQuestion.objects.create(category=quant, prompt=p, options=o, correct_index=c,
                                                explanation="Work it through step by step.") for p, o, c in QS]
            t = PublicTest.objects.create(category=quant, title="Quantitative Aptitude Mock 1", duration_minutes=15,
                                          negative_marks=0.25, is_published=True, max_attempts=0)
            PublicTestQuestion.objects.bulk_create([PublicTestQuestion(test=t, question=q, position=i) for i, q in enumerate(qs)])
        User.objects.filter(email="admin@talentgauge.test").exists() or User.objects.create_superuser(
            "admin@talentgauge.test", "Admin@12345", full_name="Platform Admin")
        User.objects.filter(email="learner@talentgauge.test").exists() or User.objects.create_user(
            "learner@talentgauge.test", "Learner@123", full_name="Demo Learner", role=Role.PUBLIC_USER)

        school, _ = School.objects.get_or_create(registration_number="DEMO-001", defaults={
            "name": "Greenfield Public School", "email": "office@greenfield.test", "status": SchoolStatus.APPROVED})
        if not User.objects.filter(email="principal@greenfield.test").exists():
            User.objects.create_user("principal@greenfield.test", "School@1234", full_name="Principal Rao",
                                     role=Role.SCHOOL_ADMIN, school=school)
            tu = User.objects.create_user("teacher@greenfield.test", "Teacher@123", full_name="Ms. Iyer",
                                          role=Role.TEACHER, school=school)
            su = User.objects.create_user("student@greenfield.test", "Student@123", full_name="Aarav Sharma",
                                          role=Role.STUDENT, school=school)
            today = date.today()
            year = AcademicYear.objects.create(school=school, name="2026-27", start_date=today - timedelta(days=120),
                                               end_date=today + timedelta(days=240), is_active=True)
            klass = SchoolClass.objects.create(school=school, academic_year=year, name="Grade 8", section="A")
            maths = Subject.objects.create(school=school, name="Mathematics", code="MATH")
            tp = TeacherProfile.objects.create(school=school, user=tu, employee_no="EMP00001")
            sp = StudentProfile.objects.create(school=school, user=su, admission_no="ADM00001")
            school.next_admission_no, school.next_employee_no = 2, 2
            school.save(update_fields=["next_admission_no", "next_employee_no"])
            Enrollment.objects.create(school=school, student=sp, school_class=klass, academic_year=year)
            TeacherAssignment.objects.create(school=school, teacher=tp, school_class=klass, subject=maths)
            sq = [SchoolQuestion.objects.create(school=school, subject=maths, created_by=tu, prompt=p, options=o,
                                                correct_index=c) for p, o, c in QS[:5]]
            ex = SchoolExam.objects.create(school=school, academic_year=year, school_class=klass, subject=maths,
                                           created_by=tu, title="Unit Test 1", duration_minutes=20, status="published",
                                           start_at=timezone.now() - timedelta(hours=1), end_at=timezone.now() + timedelta(days=30),
                                           results_published=True)
            SchoolExamQuestion.objects.bulk_create([SchoolExamQuestion(exam=ex, question=q, position=i) for i, q in enumerate(sq)])
        self.stdout.write(self.style.SUCCESS("Seeded. Logins in README."))
