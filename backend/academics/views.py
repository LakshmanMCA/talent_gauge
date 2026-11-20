from django.db.models import Prefetch
from rest_framework import viewsets

from common.permissions import IsSchoolAdmin, IsSchoolStaff
from common.permissions import TenantScopedMixin
from .models import (AcademicYear, Enrollment, SchoolClass, StudentProfile, Subject,
                     TeacherAssignment, TeacherProfile)
from . import serializers as s


class _Base(TenantScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsSchoolAdmin]


class AcademicYearViewSet(_Base):
    queryset = AcademicYear.objects.all().order_by("-start_date")
    serializer_class = s.AcademicYearSerializer


class ClassViewSet(_Base):
    queryset = SchoolClass.objects.select_related("academic_year").order_by("name", "section")
    serializer_class = s.ClassSerializer
    filterset_fields = ["academic_year"]


class SubjectViewSet(_Base):
    queryset = Subject.objects.all().order_by("name")
    serializer_class = s.SubjectSerializer
    search_fields = ["name", "code"]

    def get_permissions(self):  # teachers may read subjects
        return [IsSchoolStaff()] if self.action in ("list", "retrieve") else super().get_permissions()


class StudentViewSet(_Base):
    serializer_class = s.StudentSerializer
    search_fields = ["user__full_name", "user__email", "admission_no"]

    def get_queryset(self):
        latest = Enrollment.objects.select_related("school_class").order_by("-academic_year__start_date")
        return (StudentProfile.objects.filter(school_id=self.request.user.school_id)
                .select_related("user")
                .prefetch_related(Prefetch("enrollments", queryset=latest, to_attr="_enr"))
                .order_by("admission_no"))

    http_method_names = ["get", "post", "delete", "head", "options"]

    def perform_destroy(self, instance):  # deactivate, never hard-delete history
        instance.user.is_active = False
        instance.user.save(update_fields=["is_active"])


class TeacherViewSet(_Base):
    queryset = TeacherProfile.objects.select_related("user").order_by("employee_no")
    serializer_class = s.TeacherSerializer
    search_fields = ["user__full_name", "user__email", "employee_no"]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def perform_destroy(self, instance):
        instance.user.is_active = False
        instance.user.save(update_fields=["is_active"])


class AssignmentViewSet(_Base):
    queryset = TeacherAssignment.objects.select_related("teacher__user", "school_class", "subject")
    serializer_class = s.AssignmentSerializer
