from django.db import models


class Notification(models.Model):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=30)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=500, blank=True)
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    emailed = models.BooleanField(default=False)
    idempotency_key = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "idempotency_key"], name="uniq_notification_key")]
        indexes = [models.Index(fields=["user", "is_read", "-created_at"])]  # unread list + count


class NotificationPreference(models.Model):
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="notification_pref")
    in_app = models.BooleanField(default=True)
    email = models.BooleanField(default=True)
