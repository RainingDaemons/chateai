FROM nvidia/cuda:12.9.0-base-ubuntu22.04
RUN echo "Installing system requirements..."
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev \ 
    git build-essential ca-certificates pkg-config \
    && rm -rf /var/lib/apt/lists/*
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN echo "Installing python dependencies..."
RUN python3 -m pip install --upgrade pip
RUN pip3 install "torch==2.9.0" "torchvision==0.24.0" --index-url https://download.pytorch.org/whl/cu129
RUN pip3 install "vllm==0.13.0" 
RUN pip3 install "fastapi[standard]" "pydantic" "transformers" "accelerate" "safetensors"
RUN pip3 install "torch-c-dlpack-ext"
RUN mkdir -p /models
VOLUME ["/models"]
WORKDIR /app
CMD ["fastapi", "run", "main.py", "--host", "0.0.0.0", "--port", "8000"]
