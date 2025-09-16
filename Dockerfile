# Use Python base image
FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Install pip dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Cloud Run expects the container to listen on $PORT
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Run backend with Gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:8080", "backend_proxy:app"]
