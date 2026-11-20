from django.urls import path
from . import views as v

urlpatterns = [
    path("metrics/", v.MetricsView.as_view()),
    path("schools/", v.SchoolListView.as_view()),
    path("schools/<int:pk>/review/", v.SchoolReviewView.as_view()),
    path("audit/", v.AuditListView.as_view()),
    path("users/", v.UserListView.as_view()),
    path("users/<int:pk>/status/", v.UserStatusView.as_view()),
]
