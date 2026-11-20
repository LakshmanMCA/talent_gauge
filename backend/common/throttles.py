from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthThrottle(AnonRateThrottle):
    scope = "auth"


class ExamStartThrottle(UserRateThrottle):
    scope = "exam_start"


class AnswerSaveThrottle(UserRateThrottle):
    scope = "answer_save"
