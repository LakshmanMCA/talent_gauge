from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views as v

router = DefaultRouter()
router.register("questions", v.QuestionViewSet, basename="school-question")
router.register("exams", v.ExamViewSet, basename="school-exam")

urlpatterns = [
    path("my/exams/", v.MyExamsView.as_view()),
    path("my/results/", v.MyResultsView.as_view()),
    path("my/start/<int:exam_id>/", v.StartView.as_view()),
    path("my/attempts/<int:pk>/answer/", v.AnswerView.as_view()),
    path("my/attempts/<int:pk>/submit/", v.SubmitView.as_view()),
] + router.urls
