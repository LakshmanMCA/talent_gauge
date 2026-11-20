from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView


def health(_request):
    from django.core.cache import cache
    from django.db import connection
    status = {"db": "ok", "cache": "ok"}
    try:
        connection.ensure_connection()
    except Exception:
        status["db"] = "down"
    try:
        cache.set("health", 1, 5)
    except Exception:
        status["cache"] = "down"
    return JsonResponse(status, status=200 if status["db"] == "ok" else 503)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view()),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/platform/", include("platform_admin.urls")),
    path("api/v1/public/", include("public_exams.urls")),
    path("api/v1/schools/", include("schools.urls")),
    path("api/v1/academics/", include("academics.urls")),
    path("api/v1/school-exams/", include("school_exams.urls")),
    path("api/v1/results/", include("reporting.urls")),
    path("api/v1/notifications/", include("notifications.urls")),
]
