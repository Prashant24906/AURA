# Use Node.js as the base (with Python installed)
FROM node:20-slim

# Install Python & build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libgl1-mesa-glx \
    libglib2.0-0 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip & install global Python packages
RUN pip3 install --upgrade pip

# Copy package files for both client/server to leverage Docker cache
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install Node dependencies
RUN npm run install:all

# Copy everything else
COPY . .

# Build the frontend
RUN npm run build

# Python setup — Install ML dependencies across ALL models
# (Consolidated for Docker performance)
RUN pip3 install --no-cache-dir \
    numpy \
    opencv-python-headless \
    torch \
    torchvision \
    transformers \
    tensorflow \
    scikit-learn \
    pyttsx3 \
    speech_recognition

# Set environment variables
ENV NODE_ENV=production
ENV PYTHON_PATH=python3
ENV PORT=5000

# Expose port and start
EXPOSE 5000

CMD ["npm", "start"]
