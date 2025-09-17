FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
VOLUME ["/app"]  # keeps model.h5 persisted inside container volume
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]

