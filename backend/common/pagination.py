from rest_framework.pagination import CursorPagination, PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class KeysetPagination(CursorPagination):
    """Deep paging in O(log n) for large, fast-changing lists (attempts, audit)."""
    page_size = 25
    ordering = "-id"
