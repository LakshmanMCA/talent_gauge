from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from accounts.models import Role, User
from .models import (AcademicYear, Enrollment, SchoolClass, StudentProfile, Subject,
                     TeacherAssignment, TeacherProfile)
from .services import next_admission_no, next_employee_no


class SchoolOwned(serializers.ModelSerializer):
    """Rejects related objects that belong to another school (defends against forged ids)."""
    def _check_same_school(self, obj):
        if obj is not None and obj.school_id != self.context["request"].user.school_id:
            raise serializers.ValidationError("Invalid reference.")
        return obj


class AcademicYearSerializer(SchoolOwned):
    class Meta:
        model = AcademicYear
        fields = ["id", "name", "start_date", "end_date", "is_active"]


class ClassSerializer(SchoolOwned):
    class Meta:
        model = SchoolClass
        fields = ["id", "academic_year", "name", "section"]

    def validate_academic_year(self, v):
        return self._check_same_school(v)


class SubjectSerializer(SchoolOwned):
    class Meta:
        model = Subject
        fields = ["id", "name", "code"]


class StudentSerializer(SchoolOwned):
    email = serializers.EmailField(source="user.email")
    full_name = serializers.CharField(source="user.full_name")
    password = serializers.CharField(write_only=True, min_length=8)
    school_class = serializers.PrimaryKeyRelatedField(queryset=SchoolClass.objects.all(), write_only=True)
    class_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = ["id", "admission_no", "email", "full_name", "password", "school_class", "class_name"]
        read_only_fields = ["admission_no"]

    def get_class_name(self, obj):
        enr = getattr(obj, "_enr", None)
        return str(enr[0].school_class) if enr else None

    def validate_school_class(self, v):
        return self._check_same_school(v)

    def validate(self, a):
        if self.instance is None:
            email = a["user"]["email"].lower()
            if User.objects.filter(email=email).exists():
                raise serializers.ValidationError({"email": "Already in use."})
            validate_password(a["password"])
        return a

    @transaction.atomic
    def create(self, a):
        school_id = self.context["request"].user.school_id
        u = a["user"]
        user = User.objects.create_user(email=u["email"], password=a["password"],
                                        full_name=u["full_name"], role=Role.STUDENT, school_id=school_id)
        profile = StudentProfile.objects.create(school_id=school_id, user=user,
                                                admission_no=next_admission_no(school_id))
        klass = a["school_class"]
        Enrollment.objects.create(school_id=school_id, student=profile, school_class=klass,
                                  academic_year=klass.academic_year)
        return profile


class TeacherSerializer(SchoolOwned):
    email = serializers.EmailField(source="user.email")
    full_name = serializers.CharField(source="user.full_name")
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = TeacherProfile
        fields = ["id", "employee_no", "email", "full_name", "password"]
        read_only_fields = ["employee_no"]

    def validate(self, a):
        if User.objects.filter(email=a["user"]["email"].lower()).exists():
            raise serializers.ValidationError({"email": "Already in use."})
        validate_password(a["password"])
        return a

    @transaction.atomic
    def create(self, a):
        school_id = self.context["request"].user.school_id
        u = a["user"]
        user = User.objects.create_user(email=u["email"], password=a["password"], full_name=u["full_name"],
                                        role=Role.TEACHER, school_id=school_id)
        return TeacherProfile.objects.create(school_id=school_id, user=user,
                                             employee_no=next_employee_no(school_id))


class AssignmentSerializer(SchoolOwned):
    class Meta:
        model = TeacherAssignment
        fields = ["id", "teacher", "school_class", "subject"]

    def validate(self, a):
        for f in ("teacher", "school_class", "subject"):
            self._check_same_school(a[f])
        return a
