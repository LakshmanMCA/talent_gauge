from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("years", views.AcademicYearViewSet, basename="year")
router.register("classes", views.ClassViewSet, basename="class")
router.register("subjects", views.SubjectViewSet, basename="subject")
router.register("students", views.StudentViewSet, basename="student")
router.register("teachers", views.TeacherViewSet, basename="teacher")
router.register("assignments", views.AssignmentViewSet, basename="assignment")
urlpatterns = router.urls
