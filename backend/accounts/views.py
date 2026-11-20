from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.throttles import AuthThrottle
from .serializers import LoginSerializer, PublicRegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = PublicRegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        from notifications.services import notify
        notify(user, "welcome", "Welcome to Talent Gauge",
               "Your account is ready. Pick a category and take your first mock test.",
               link="/dashboard", key=f"welcome:{user.pk}")
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        r = ser.validated_data["refresh"]
        return Response({"access": str(r.access_token), "refresh": str(r),
                         "user": UserSerializer(ser.validated_data["user"]).data})


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
