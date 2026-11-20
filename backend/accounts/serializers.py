from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Role, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "school"]
        read_only_fields = fields


class PublicRegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, v):
        v = v.lower()
        if User.objects.filter(email=v).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return v

    def validate(self, attrs):
        validate_password(attrs["password"])
        return attrs

    def create(self, data):
        return User.objects.create_user(email=data["email"], password=data["password"],
                                        full_name=data["full_name"], role=Role.PUBLIC_USER)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    portal = serializers.ChoiceField(choices=["public", "school", "platform"], default="public")

    PORTAL_ROLES = {
        "public": {Role.PUBLIC_USER},
        "school": {Role.SCHOOL_ADMIN, Role.TEACHER, Role.STUDENT},
        "platform": {Role.SUPER_ADMIN},
    }

    def validate(self, attrs):
        user = authenticate(email=attrs["email"].lower(), password=attrs["password"])
        # Same message for every failure: no account enumeration.
        if not user or not user.is_active or user.role not in self.PORTAL_ROLES[attrs["portal"]]:
            raise serializers.ValidationError("Invalid credentials for this portal.")
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["school"] = user.school_id
        attrs["user"], attrs["refresh"] = user, refresh
        return attrs
