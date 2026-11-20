from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.SchoolRegisterView.as_view()),
    path("me/", views.MySchoolView.as_view()),
]
