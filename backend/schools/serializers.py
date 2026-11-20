from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from accounts.models import Role, User
from .models import School


class SchoolSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = ["id", "name", "registration_number", "email", "phone", "address",
                  "status", "review_note", "member_count", "created_at"]
        read_only_fields = ["id", "status", "review_note", "created_at"]

    def get_member_count(self, obj):
        return getattr(obj, "member_count", None) or obj.members.count()


class SchoolRegistrationSerializer(serializers.Serializer):
    school_name = serializers.CharField(max_length=200)
    registration_number = serializers.CharField(max_length=60)
    school_email = serializers.EmailField()
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    admin_name = serializers.CharField(max_length=150)
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, a):
        if School.objects.filter(registration_number__iexact=a["registration_number"]).exists():
            raise serializers.ValidationError({"registration_number": "Already registered."})
        if School.objects.filter(email__iexact=a["school_email"]).exists():
            raise serializers.ValidationError({"school_email": "Already registered."})
        if User.objects.filter(email__iexact=a["admin_email"]).exists():
            raise serializers.ValidationError({"admin_email": "An account with this email exists."})
        validate_password(a["admin_password"])
        return a

    @transaction.atomic
    def create(self, a):
        school = School.objects.create(
            name=a["school_name"], registration_number=a["registration_number"],
            email=a["school_email"].lower(), phone=a.get("phone", ""), address=a.get("address", ""))
        # Admin account stays inactive until Super Admin approves (no premature activation).
        User.objects.create_user(email=a["admin_email"], password=a["admin_password"],
                                 full_name=a["admin_name"], role=Role.SCHOOL_ADMIN,
                                 school=school, is_active=False)
        return school
