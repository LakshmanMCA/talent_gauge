try:
    from .celery import app as celery_app
    __all__ = ("celery_app",)
except ImportError:  # celery not installed in minimal envs
    pass
