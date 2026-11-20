from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.permissions import IsSchoolAdmin
from common.throttles import AuthThrottle
from .models import School
from .serializers import SchoolRegistrationSerializer, SchoolSerializer


class SchoolRegisterView(generics.GenericAPIView):
    serializer_class = SchoolRegistrationSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        school = ser.save()
        return Response({"id": school.id, "status": school.status,
                         "message": "Application received. You can sign in once it is approved."},
                        status=status.HTTP_201_CREATED)


class MySchoolView(generics.RetrieveUpdateAPIView):
    """School Admin edits ONLY their own school (resolved from the token user)."""
    serializer_class = SchoolSerializer
    permission_classes = [IsSchoolAdmin]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return School.objects.get(pk=self.request.user.school_id)
