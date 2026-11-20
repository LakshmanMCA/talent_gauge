import uuid
from django.utils.deprecation import MiddlewareMixin


class RequestIDMiddleware(MiddlewareMixin):
    """Attach a correlation id to every request/response for log tracing."""
    def process_request(self, request):
        request.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex

    def process_response(self, request, response):
        response["X-Request-ID"] = getattr(request, "request_id", "")
        return response
