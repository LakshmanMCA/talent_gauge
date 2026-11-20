from django.contrib import admin
from .models import Category, PublicQuestion, PublicTest
for m in (Category, PublicQuestion, PublicTest):
    admin.site.register(m)
