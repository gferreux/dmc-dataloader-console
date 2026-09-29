#!/bin/sh
set -eu
PORT="${PORT:-8080}"
API_BASE_URL="${API_BASE_URL:-}"
USE_MOCK="${USE_MOCK:-false}"
export PORT API_BASE_URL USE_MOCK

envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
envsubst '${API_BASE_URL} ${USE_MOCK}' < /opt/runtime-config.template.json > /usr/share/nginx/html/assets/runtime-config.json

exec nginx -g 'daemon off;'
