#!/bin/bash
# Run the Anna University Result Analysis Backend

echo "Starting Anna University Result Analysis Backend..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
