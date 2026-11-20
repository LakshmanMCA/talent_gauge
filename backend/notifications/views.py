from django.db import transaction
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "link", "is_read", "created_at"]


class ListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    filterset_fields = ["is_read", "kind"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")


class UnreadCountView(APIView):
    def get(self, request):
        return Response({"unread": services.unread_count(request.user.pk)})


class MarkReadView(APIView):
    def post(self, request, pk):
        Notification.objects.filter(pk=pk, user=request.user).update(is_read=True)
        services._bust([request.user.pk])
        return Response({"ok": True})


class MarkAllReadView(APIView):
    def post(self, request):
        with transaction.atomic():
            Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
            services._bust([request.user.pk])
        return Response({"ok": True})


class PrefSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["in_app", "email"]


class PreferenceView(generics.RetrieveUpdateAPIView):
    serializer_class = PrefSerializer

    def get_object(self):
        return NotificationPreference.objects.get_or_create(user=self.request.user)[0]
