FROM python:3.11-slim

# Install nmap
RUN apt-get update && apt-get install -y \
    nmap \
    libpcap-dev \
    net-tools \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create reports directory
RUN mkdir -p /app/reports

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
