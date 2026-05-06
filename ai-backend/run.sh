#!/bin/bash
# Local development runner — activates venv and starts server.
# On Render the start command (render.yaml) is used instead.

PORT="${AI_SERVICE_PORT:-8000}"

if [ -d "venv" ]; then
  source venv/bin/activate
fi

exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload
