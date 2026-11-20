from rest_framework.permissions import BasePermission
from accounts.models import Role


def _role(request):
    u = request.user
    return getattr(u, "role", None) if u.is_authenticated else None


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == Role.SUPER_ADMIN


class IsSchoolAdmin(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == Role.SCHOOL_ADMIN and request.user.school_id is not None


class IsSchoolStaff(BasePermission):
    def has_permission(self, request, view):
        return _role(request) in (Role.SCHOOL_ADMIN, Role.TEACHER) and request.user.school_id is not None


class IsSchoolStudent(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == Role.STUDENT and request.user.school_id is not None


class IsPublicUser(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == Role.PUBLIC_USER


class TenantScopedMixin:
    """Every school-owned queryset is filtered by the *authenticated user's*
    verified school, never by a browser-supplied id. Cross-tenant ids give 404,
    so the existence of other schools' records is not leaked."""
    def get_queryset(self):
        return super().get_queryset().filter(school_id=self.request.user.school_id)

    def perform_create(self, serializer):
        serializer.save(school_id=self.request.user.school_id)
