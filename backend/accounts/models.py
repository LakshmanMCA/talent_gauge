from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "super_admin", "Platform Super Admin"
    PUBLIC_USER = "public_user", "Public User"
    SCHOOL_ADMIN = "school_admin", "School Admin"
    TEACHER = "teacher", "Teacher"
    STUDENT = "student", "School Student"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=Role.SUPER_ADMIN, is_staff=True, is_superuser=True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Single identity table. `school` is set ONLY for school-domain roles, which
    keeps public learners and school members explicitly separate."""
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PUBLIC_USER, db_index=True)
    school = models.ForeignKey("schools.School", null=True, blank=True, on_delete=models.PROTECT,
                               related_name="members")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]
    objects = UserManager()

    class Meta:
        constraints = [
            # school-domain roles MUST have a school; public/super admin must NOT.
            models.CheckConstraint(
                name="user_school_matches_role",
                check=(models.Q(role__in=["school_admin", "teacher", "student"], school__isnull=False)
                       | models.Q(role__in=["public_user", "super_admin"], school__isnull=True)),
            ),
        ]
        indexes = [models.Index(fields=["school", "role"])]

    def __str__(self):
        return self.email
