#!/bin/sh
set -e
# First run generates migrations (commit backend/*/migrations afterwards), then applies them.
python manage.py makemigrations --noinput
python manage.py migrate --noinput
python manage.py collectstatic --noinput
exec "$@"
