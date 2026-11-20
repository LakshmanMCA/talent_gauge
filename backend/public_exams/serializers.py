from rest_framework import serializers
from .models import Category, PublicQuestion, PublicResult, PublicTest, PublicTestQuestion


class CategorySerializer(serializers.ModelSerializer):
    test_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ["id", "parent", "name", "slug", "description", "icon", "is_published", "position", "test_count"]


class TestListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    question_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PublicTest
        fields = ["id", "title", "description", "category", "category_name", "duration_minutes",
                  "pass_percentage", "is_premium", "question_count"]


class AdminQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicQuestion
        fields = ["id", "category", "prompt", "options", "correct_index", "explanation", "marks",
                  "difficulty", "is_active"]

    def validate(self, a):
        opts = a.get("options", getattr(self.instance, "options", []))
        idx = a.get("correct_index", getattr(self.instance, "correct_index", 0))
        if not isinstance(opts, list) or not 2 <= len(opts) <= 6:
            raise serializers.ValidationError("Provide between 2 and 6 options.")
        if not 0 <= idx < len(opts):
            raise serializers.ValidationError("correct_index is out of range.")
        return a


class AdminTestSerializer(serializers.ModelSerializer):
    question_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    selected_question_ids = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = PublicTest
        fields = ["id", "category", "title", "description", "duration_minutes", "pass_percentage",
                  "negative_marks", "is_published", "is_premium", "max_attempts", "blueprint",
                  "question_ids", "selected_question_ids", "question_count"]

    def get_selected_question_ids(self, obj):
        return [ptq.question_id for ptq in obj.publictestquestion_set.all()]

    def get_question_count(self, obj):
        return len(self.get_selected_question_ids(obj))

    def _sync(self, test, ids):
        PublicTestQuestion.objects.filter(test=test).delete()
        PublicTestQuestion.objects.bulk_create(
            [PublicTestQuestion(test=test, question_id=qid, position=i) for i, qid in enumerate(ids)])

    def create(self, data):
        ids = data.pop("question_ids", [])
        test = super().create(data)
        self._sync(test, ids)
        return test

    def update(self, inst, data):
        ids = data.pop("question_ids", None)
        inst = super().update(inst, data)
        if ids is not None:
            self._sync(inst, ids)
        return inst


class ResultSerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source="test.title", read_only=True)
    attempt_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = PublicResult
        fields = ["attempt_id", "test_title", "correct", "incorrect", "unanswered", "obtained", "total",
                  "percentage", "passed", "time_taken_seconds", "created_at"]
