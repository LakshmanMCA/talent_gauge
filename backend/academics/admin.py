from django.contrib import admin
from .models import AcademicYear, SchoolClass, Subject, StudentProfile, TeacherProfile
for m in (AcademicYear, SchoolClass, Subject, StudentProfile, TeacherProfile):
    admin.site.register(m)
