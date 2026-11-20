from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views as v

router = DefaultRouter()
router.register("admin/categories", v.AdminCategoryViewSet, basename="admin-category")
router.register("admin/questions", v.AdminQuestionViewSet, basename="admin-question")
router.register("admin/tests", v.AdminTestViewSet, basename="admin-test")

urlpatterns = [
    path("categories/", v.CategoryListView.as_view()),
    path("home/", v.HomeStatsView.as_view()),
    path("tests/", v.TestListView.as_view()),
    path("tests/<int:pk>/", v.TestDetailView.as_view()),
    path("attempts/start/<int:test_id>/", v.StartAttemptView.as_view()),
    path("attempts/<int:pk>/answer/", v.SaveAnswerView.as_view()),
    path("attempts/<int:pk>/submit/", v.SubmitView.as_view()),
    path("attempts/<int:pk>/review/", v.ReviewView.as_view()),
    path("results/", v.MyResultsView.as_view()),
] + router.urls
