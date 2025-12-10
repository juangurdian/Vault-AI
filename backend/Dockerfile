# Backend Dockerfile for Local AI Beast
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend

ENV HOST=0.0.0.0
ENV PORT=8001

EXPOSE 8001

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001"]

