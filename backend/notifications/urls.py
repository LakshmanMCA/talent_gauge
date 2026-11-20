from django.urls import path
from . import views as v

urlpatterns = [
    path("", v.ListView.as_view()),
    path("unread-count/", v.UnreadCountView.as_view()),
    path("read-all/", v.MarkAllReadView.as_view()),
    path("preferences/", v.PreferenceView.as_view()),
    path("<int:pk>/read/", v.MarkReadView.as_view()),
]
