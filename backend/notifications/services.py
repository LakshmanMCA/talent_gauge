from django.core.cache import cache
from django.db import transaction

from .models import Notification, NotificationPreference


def unread_key(user_id):
    return f"notif:unread:{int(user_id)}"


def _bust(user_ids):
    keys = [unread_key(i) for i in user_ids]

    def go():
        try:
            cache.delete_many(keys)
        except Exception:
            pass
    transaction.on_commit(go)


def notify(user, kind, title, body="", link="", key=None):
    """Idempotent: the same (user, key) never creates two notifications."""
    key = key or f"{kind}:{title}"
    pref = NotificationPreference.objects.filter(user=user).first()
    if pref and not pref.in_app:
        return None
    n, created = Notification.objects.get_or_create(
        user=user, idempotency_key=key,
        defaults={"kind": kind, "title": title, "body": body[:500], "link": link})
    if created:
        _bust([user.pk])
        if not pref or pref.email:
            from .tasks import send_email_notification
            transaction.on_commit(lambda: send_email_notification.delay(n.pk))
    return n


def bulk_notify(user_ids, kind, title, body, link, key):
    """One INSERT per batch; conflicts (already notified) are skipped."""
    rows = [Notification(user_id=u, kind=kind, title=title, body=body[:500], link=link,
                         idempotency_key=key) for u in user_ids]
    Notification.objects.bulk_create(rows, batch_size=1000, ignore_conflicts=True)
    _bust(user_ids)
    return len(rows)


def unread_count(user_id):
    key = unread_key(user_id)
    try:
        hit = cache.get(key)
    except Exception:
        hit = None
    if hit is not None:
        return hit
    n = Notification.objects.filter(user_id=user_id, is_read=False).count()
    try:
        cache.set(key, n, 120)
    except Exception:
        pass
    return n
