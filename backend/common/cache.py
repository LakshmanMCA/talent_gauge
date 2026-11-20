"""Namespaced cache helpers. Public and school keys can never collide.
Cache is never the source of truth: every read falls back to the DB."""
import random
from django.core.cache import cache
from django.db import transaction


def public_key(name, v=1):
    return f"public:{name}:v{v}"


def school_key(school_id, name, scope="all", v=1):
    return f"school:{int(school_id)}:{name}:{scope}:v{v}"


def cached(key, ttl, loader):
    """Read-through with TTL jitter to avoid synchronized expiry (stampede)."""
    try:
        hit = cache.get(key)
    except Exception:
        hit = None
    if hit is not None:
        return hit
    value = loader()
    try:
        cache.set(key, value, ttl + random.randint(0, max(1, ttl // 10)))
    except Exception:
        pass
    return value


def invalidate_on_commit(*keys):
    """Invalidate only after the DB transaction commits."""
    def _do():
        try:
            cache.delete_many(list(keys))
        except Exception:
            pass
    transaction.on_commit(_do)
