from django.urls import path
from . import views as v

urlpatterns = [
    path("public/dashboard/", v.PublicDashboardView.as_view()),
    path("public/leaderboard/", v.LeaderboardView.as_view()),
    path("school/dashboard/", v.SchoolDashboardView.as_view()),
    path("school/exams/<int:exam_id>/export/", v.ExamResultsCSVView.as_view()),
]
