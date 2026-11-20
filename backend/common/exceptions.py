from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """Uniform error envelope: {"error": {"code", "message", "details"}}."""
    response = exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    simple = isinstance(data, dict) and "detail" in data
    response.data = {"error": {"code": response.status_code,
                               "message": str(data["detail"]) if simple else "Request failed",
                               "details": None if simple else data}}
    return response
