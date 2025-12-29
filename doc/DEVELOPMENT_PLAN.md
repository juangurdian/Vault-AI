# 🔥 Local AI Beast - Development Plan

## Executive Summary

This document provides a detailed, phase-by-phase development plan for building the Local AI Beast platform. Each phase includes specific tasks, deliverables, testing criteria, and estimated timelines.

**Target Hardware:** ASUS ROG Zephyrus | RTX 3070 (8GB VRAM) | 40GB RAM | Ryzen 5900H

---

## Phase 0: Environment Setup & Prerequisites
**Duration:** 2-3 Days | **Priority:** Critical

### 0.1 Development Environment
- [ ] Install Python 3.11+ (recommended for best compatibility)
- [ ] Install Node.js 18+ LTS
- [ ] Install Docker Desktop with WSL2 backend
- [ ] Enable NVIDIA Container Toolkit for GPU passthrough
- [ ] Install Git and configure SSH keys

### 0.2 NVIDIA Setup
```powershell
# Verify CUDA installation
nvidia-smi

# Install CUDA Toolkit 12.x if not present
# Download from: https://developer.nvidia.com/cuda-downloads

# Verify cuDNN installation
# Required for optimal inference performance
```

### 0.3 Project Structure
```
beastAI/
├── docker/                    # Docker configurations
│   ├── docker-compose.yml
│   ├── docker-compose.offline.yml
│   └── Dockerfile.comfyui
├── backend/                   # FastAPI services
│   ├── api/
│   ├── agents/
│   ├── router/
│   ├── rag/
│   └── utils/
├── frontend/                  # Custom Next.js frontend (Phase 6)
│   ├── components/
│   ├── app/
│   └── lib/
├── models/                    # Model configurations
│   └── litellm_config.yaml
├── knowledge/                 # Local RAG documents
├── scripts/                   # Utility scripts
│   ├── start_offline.sh
│   ├── download_models.sh
│   └── health_check.py
├── config/
│   ├── settings.yaml
│   └── .env
└── tests/
```

### 0.4 Deliverables
- [ ] Working Python virtual environment
- [ ] Docker with GPU support verified
- [ ] Project directory structure created
- [ ] Git repository initialized

### 0.5 Verification
```powershell
# Test Docker GPU access
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

---

## Phase 1: Foundation Layer
**Duration:** Week 1 | **Priority:** Critical

### 1.1 Ollama Installation & Configuration
**Day 1-2**

#### Tasks
- [ ] Download and install Ollama for Windows
- [ ] Configure Ollama environment variables
- [ ] Set up model storage location (ensure SSD for speed)

```powershell
# Install Ollama (Windows)
# Download from: https://ollama.com/download/windows

# Set environment variables (optional, for custom model storage)
$env:OLLAMA_MODELS = "D:\ollama\models"
$env:OLLAMA_HOST = "0.0.0.0:11434"

# Start Ollama
ollama serve
```

#### Model Downloads
```bash
# Priority 1 - Essential (Download First)
ollama pull qwen3:4b          # Fast daily driver (~2.5GB)
ollama pull qwen3:8b          # Balanced general (~4.5GB)
ollama pull nomic-embed-text  # Embeddings for RAG (~274MB)

# Priority 2 - Specialized
ollama pull deepseek-r1:8b    # Reasoning (~5GB)
ollama pull qwen2.5-coder:7b  # Coding (~4GB)
ollama pull llava:7b          # Vision (~4.5GB)

# Priority 3 - Optional Heavy
ollama pull deepseek-r1:14b   # Heavy reasoning, uses RAM offload (~8GB)
```

#### Verification
- [ ] Run `ollama list` - all models appear
- [ ] Test each model with simple prompt
- [ ] Verify VRAM usage stays within limits

### 1.2 Open WebUI Deployment
**Day 2-3**

#### Docker Compose Setup
```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    ports:
      - "3000:8080"
    volumes:
      - open_webui_data:/app/backend/data
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - WEBUI_AUTH=false
      - ENABLE_RAG_WEB_SEARCH=true
      - RAG_EMBEDDING_MODEL=nomic-embed-text
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped

volumes:
  open_webui_data:
```

#### Tasks
- [ ] Create docker-compose.yml
- [ ] Launch Open WebUI container
- [ ] Configure initial settings
- [ ] Test model switching in UI
- [ ] Enable RAG with embedding model

#### Verification
- [ ] Access UI at http://localhost:3000
- [ ] Send test messages to each model
- [ ] Upload test document for RAG

### 1.3 SearXNG Search Engine
**Day 4**

#### Docker Compose Addition
```yaml
# Add to docker-compose.yml
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    ports:
      - "8080:8080"
    volumes:
      - ./config/searxng:/etc/searxng
    environment:
      - SEARXNG_BASE_URL=http://localhost:8080
    restart: unless-stopped
```

#### SearXNG Configuration
```yaml
# config/searxng/settings.yml
general:
  instance_name: "Local AI Beast Search"

search:
  safe_search: 0
  autocomplete: "google"
  default_lang: "en"

server:
  secret_key: "your-secret-key-here"
  
engines:
  - name: google
    engine: google
    disabled: false
  - name: duckduckgo
    engine: duckduckgo
    disabled: false
  - name: wikipedia
    engine: wikipedia
    disabled: false
```

#### Tasks
- [ ] Create SearXNG configuration
- [ ] Deploy SearXNG container
- [ ] Test search functionality
- [ ] Configure Open WebUI to use SearXNG

### 1.4 Phase 1 Deliverables
- [ ] Ollama running with 6+ models
- [ ] Open WebUI accessible and functional
- [ ] SearXNG providing web search
- [ ] Basic RAG working with uploaded documents
- [ ] All services start via single docker-compose command

### 1.5 Phase 1 Testing Checklist
| Test | Expected Result | Status |
|------|-----------------|--------|
| Chat with qwen3:4b | Fast response (<2s first token) | ⬜ |
| Chat with qwen3:8b | Quality response, ~35 tok/s | ⬜ |
| Reasoning with deepseek-r1:8b | Step-by-step reasoning | ⬜ |
| Code with qwen2.5-coder:7b | Valid Python code | ⬜ |
| Vision with llava:7b | Image description | ⬜ |
| Web search via SearXNG | Returns search results | ⬜ |
| RAG query | Returns relevant chunks | ⬜ |

---

## Phase 2: Intelligent Model Router
**Duration:** Week 2 | **Priority:** High

### 2.1 LiteLLM Proxy Setup
**Day 1-2**

#### Configuration File
```yaml
# models/litellm_config.yaml
model_list:
  - model_name: auto
    litellm_params:
      model: ollama/qwen3:8b
      api_base: http://localhost:11434
      
  - model_name: fast
    litellm_params:
      model: ollama/qwen3:4b
      api_base: http://localhost:11434
      
  - model_name: balanced
    litellm_params:
      model: ollama/qwen3:8b
      api_base: http://localhost:11434
      
  - model_name: reasoning
    litellm_params:
      model: ollama/deepseek-r1:8b
      api_base: http://localhost:11434
      
  - model_name: coding
    litellm_params:
      model: ollama/qwen2.5-coder:7b
      api_base: http://localhost:11434
      
  - model_name: vision
    litellm_params:
      model: ollama/llava:7b
      api_base: http://localhost:11434

general_settings:
  master_key: "sk-beast-local-key"
  drop_params: true
```

#### Docker Addition
```yaml
# Add to docker-compose.yml
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    container_name: litellm
    ports:
      - "4000:4000"
    volumes:
      - ./models/litellm_config.yaml:/app/config.yaml
    command: ["--config", "/app/config.yaml"]
    depends_on:
      - ollama
    restart: unless-stopped
```

### 2.2 Custom Router Service
**Day 3-5**

#### Backend Structure
```
backend/
├── __init__.py
├── main.py                # FastAPI entry point
├── config.py              # Settings management
├── router/
│   ├── __init__.py
│   ├── classifier.py      # Query classification
│   ├── router.py          # Model routing logic
│   └── models.py          # Pydantic models
└── utils/
    ├── __init__.py
    └── network.py         # Online/offline detection
```

#### Core Router Implementation
```python
# backend/router/classifier.py
from enum import Enum
from typing import Optional
import re

class TaskType(str, Enum):
    SIMPLE_CHAT = "simple_chat"
    GENERAL = "general"
    REASONING = "reasoning"
    CODING = "coding"
    VISION = "vision"
    CREATIVE = "creative"

class QueryClassifier:
    """Classifies queries to determine optimal model routing."""
    
    REASONING_PATTERNS = [
        r"\bwhy\b.*\?",
        r"\bexplain\b",
        r"\banalyze\b",
        r"\bcompare\b",
        r"\bstep[- ]by[- ]step\b",
        r"\bthink\b.*\bthrough\b",
        r"\breason\b",
        r"\bprove\b",
        r"\bderive\b",
    ]
    
    CODING_PATTERNS = [
        r"\bcode\b",
        r"\bfunction\b",
        r"\bclass\b",
        r"\bdef\b\s+\w+",
        r"\bdebug\b",
        r"\bpython\b",
        r"\bjavascript\b",
        r"\btypescript\b",
        r"\brust\b",
        r"\bapi\b",
        r"\bimport\b\s+\w+",
        r"```",
    ]
    
    def __init__(self):
        self.reasoning_re = re.compile(
            "|".join(self.REASONING_PATTERNS), 
            re.IGNORECASE
        )
        self.coding_re = re.compile(
            "|".join(self.CODING_PATTERNS), 
            re.IGNORECASE
        )
    
    def classify(
        self, 
        query: str, 
        has_images: bool = False,
        context_length: int = 0
    ) -> TaskType:
        """Classify a query into a task type."""
        
        # Vision takes priority if images present
        if has_images:
            return TaskType.VISION
        
        query_lower = query.lower()
        word_count = len(query.split())
        
        # Check for coding patterns
        if self.coding_re.search(query):
            return TaskType.CODING
        
        # Check for reasoning patterns
        if self.reasoning_re.search(query):
            return TaskType.REASONING
        
        # Short queries = simple chat
        if word_count < 15 and context_length < 1000:
            return TaskType.SIMPLE_CHAT
        
        # Default to general
        return TaskType.GENERAL
    
    def estimate_complexity(self, query: str) -> float:
        """Estimate query complexity from 0.0 to 1.0."""
        factors = []
        
        # Length factor
        word_count = len(query.split())
        factors.append(min(word_count / 100, 1.0))
        
        # Question complexity
        question_words = len(re.findall(r'\b(why|how|what if|explain)\b', query.lower()))
        factors.append(min(question_words / 3, 1.0))
        
        # Technical terms (rough heuristic)
        technical_pattern = r'\b[A-Z][a-z]+[A-Z]\w*\b'  # CamelCase
        technical_count = len(re.findall(technical_pattern, query))
        factors.append(min(technical_count / 5, 1.0))
        
        return sum(factors) / len(factors)
```

```python
# backend/router/router.py
from typing import Optional, Dict, Any
from .classifier import QueryClassifier, TaskType

class ModelRouter:
    """Routes queries to optimal models based on classification."""
    
    MODEL_MAP = {
        TaskType.SIMPLE_CHAT: "qwen3:4b",
        TaskType.GENERAL: "qwen3:8b",
        TaskType.REASONING: "deepseek-r1:8b",
        TaskType.CODING: "qwen2.5-coder:7b",
        TaskType.VISION: "llava:7b",
        TaskType.CREATIVE: "qwen3:8b",
    }
    
    COMPLEXITY_THRESHOLD = 0.7
    
    def __init__(self):
        self.classifier = QueryClassifier()
    
    def route(
        self, 
        query: str,
        images: Optional[list] = None,
        context: Optional[str] = None,
        force_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """Route a query to the optimal model."""
        
        # Allow manual override
        if force_model and force_model != "auto":
            return {
                "model": force_model,
                "task_type": "manual",
                "complexity": None,
                "routing_reason": "User specified model"
            }
        
        has_images = images is not None and len(images) > 0
        context_length = len(context) if context else 0
        
        # Classify the query
        task_type = self.classifier.classify(
            query, 
            has_images=has_images,
            context_length=context_length
        )
        
        # Check complexity for potential upgrade
        complexity = self.classifier.estimate_complexity(query)
        
        # Select model
        model = self.MODEL_MAP[task_type]
        
        # Upgrade to reasoning model for high complexity
        if complexity > self.COMPLEXITY_THRESHOLD and task_type not in [TaskType.VISION, TaskType.CODING]:
            model = self.MODEL_MAP[TaskType.REASONING]
            routing_reason = f"Upgraded to reasoning model due to high complexity ({complexity:.2f})"
        else:
            routing_reason = f"Routed based on task type: {task_type.value}"
        
        return {
            "model": model,
            "task_type": task_type.value,
            "complexity": complexity,
            "routing_reason": routing_reason
        }
```

```python
# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx

from router.router import ModelRouter

app = FastAPI(title="Local AI Beast Router")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = ModelRouter()

class Message(BaseModel):
    role: str
    content: str
    images: Optional[List[str]] = None

class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "auto"
    stream: Optional[bool] = False

class ChatResponse(BaseModel):
    model_used: str
    routing_info: dict
    response: dict

@app.post("/v1/chat/completions", response_model=ChatResponse)
async def chat_completions(request: ChatRequest):
    """Route and process chat completion requests."""
    
    # Get the last user message
    last_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_message = msg
            break
    
    if not last_message:
        raise HTTPException(status_code=400, detail="No user message found")
    
    # Route the request
    routing = router.route(
        query=last_message.content,
        images=last_message.images,
        force_model=request.model
    )
    
    # Forward to Ollama
    async with httpx.AsyncClient(timeout=300.0) as client:
        ollama_response = await client.post(
            "http://localhost:11434/api/chat",
            json={
                "model": routing["model"],
                "messages": [{"role": m.role, "content": m.content} for m in request.messages],
                "stream": False
            }
        )
    
    if ollama_response.status_code != 200:
        raise HTTPException(
            status_code=ollama_response.status_code,
            detail="Ollama request failed"
        )
    
    return ChatResponse(
        model_used=routing["model"],
        routing_info=routing,
        response=ollama_response.json()
    )

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Local AI Beast Router"}

@app.get("/models")
async def list_models():
    """List available models and their purposes."""
    return {
        "models": [
            {"name": "auto", "description": "Automatic routing based on query"},
            {"name": "qwen3:4b", "description": "Fast responses, simple queries"},
            {"name": "qwen3:8b", "description": "Balanced quality and speed"},
            {"name": "deepseek-r1:8b", "description": "Complex reasoning tasks"},
            {"name": "qwen2.5-coder:7b", "description": "Code generation and debugging"},
            {"name": "llava:7b", "description": "Vision and image analysis"},
        ]
    }
```

### 2.3 Phase 2 Deliverables
- [ ] LiteLLM proxy running and configured
- [ ] Custom router service with query classification
- [ ] API endpoints for chat routing
- [ ] Routing accuracy > 85% on test cases

### 2.4 Phase 2 Testing
```python
# tests/test_router.py
import pytest
from backend.router.router import ModelRouter
from backend.router.classifier import TaskType

router = ModelRouter()

test_cases = [
    # (query, expected_task_type, expected_model)
    ("Hi", TaskType.SIMPLE_CHAT, "qwen3:4b"),
    ("What's 2+2?", TaskType.SIMPLE_CHAT, "qwen3:4b"),
    ("Write a Python function to sort a list", TaskType.CODING, "qwen2.5-coder:7b"),
    ("Explain why the sky is blue step by step", TaskType.REASONING, "deepseek-r1:8b"),
    ("Debug this code: def foo(): pritn('hello')", TaskType.CODING, "qwen2.5-coder:7b"),
    ("Compare and contrast TCP vs UDP protocols", TaskType.REASONING, "deepseek-r1:8b"),
]

@pytest.mark.parametrize("query,expected_type,expected_model", test_cases)
def test_routing(query, expected_type, expected_model):
    result = router.route(query)
    assert result["task_type"] == expected_type.value
    assert result["model"] == expected_model
```

---

## Phase 3: Image Generation Pipeline
**Duration:** Week 3 | **Priority:** High

### 3.1 ComfyUI Installation
**Day 1-2**

#### Manual Installation (Recommended for Windows)
```powershell
# Clone ComfyUI
cd C:\Users\jcgus\Documents
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install PyTorch with CUDA
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install requirements
pip install -r requirements.txt

# Install GGUF support for FLUX
cd custom_nodes
git clone https://github.com/city96/ComfyUI-GGUF
pip install -r ComfyUI-GGUF/requirements.txt
```

### 3.2 Model Downloads
**Day 2-3**

```
ComfyUI/
├── models/
│   ├── checkpoints/
│   │   ├── sd_xl_base_1.0.safetensors      # SDXL Base (~6.5GB)
│   │   └── flux1-schnell-Q5_K_M.gguf       # FLUX Schnell quantized (~5GB)
│   ├── vae/
│   │   └── sdxl_vae.safetensors            # SDXL VAE (~335MB)
│   ├── clip/
│   │   └── clip_l.safetensors              # CLIP text encoder
│   └── unet/
│       └── flux1-schnell-Q5_K_M.gguf       # For GGUF workflow
```

#### Download Sources
- SDXL: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
- FLUX GGUF: https://huggingface.co/city96/FLUX.1-schnell-gguf

### 3.3 ComfyUI API Client
**Day 3-4**

```python
# backend/image_gen/comfyui_client.py
import websocket
import json
import uuid
import urllib.request
import urllib.parse
from typing import Optional
import base64

class ComfyUIClient:
    """Client for interacting with ComfyUI API."""
    
    def __init__(self, server_address: str = "127.0.0.1:8188"):
        self.server_address = server_address
        self.client_id = str(uuid.uuid4())
    
    def queue_prompt(self, workflow: dict) -> str:
        """Queue a workflow and return the prompt ID."""
        payload = {
            "prompt": workflow,
            "client_id": self.client_id
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"http://{self.server_address}/prompt",
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        response = urllib.request.urlopen(req)
        return json.loads(response.read())['prompt_id']
    
    def get_image(self, filename: str, subfolder: str, folder_type: str) -> bytes:
        """Retrieve generated image from ComfyUI."""
        params = urllib.parse.urlencode({
            "filename": filename,
            "subfolder": subfolder,
            "type": folder_type
        })
        url = f"http://{self.server_address}/view?{params}"
        with urllib.request.urlopen(url) as response:
            return response.read()
    
    def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 20,
        cfg: float = 7.0,
        seed: Optional[int] = None
    ) -> bytes:
        """Generate an image and return bytes."""
        
        if seed is None:
            seed = uuid.uuid4().int % (2**32)
        
        workflow = self._build_sdxl_workflow(
            prompt, negative_prompt, width, height, steps, cfg, seed
        )
        
        prompt_id = self.queue_prompt(workflow)
        
        # Wait for completion via websocket
        ws = websocket.WebSocket()
        ws.connect(f"ws://{self.server_address}/ws?clientId={self.client_id}")
        
        output_images = []
        while True:
            msg = ws.recv()
            if isinstance(msg, str):
                message = json.loads(msg)
                if message['type'] == 'executing':
                    data = message['data']
                    if data['node'] is None and data['prompt_id'] == prompt_id:
                        break
        
        ws.close()
        
        # Get history and retrieve image
        history = self._get_history(prompt_id)
        for node_id, node_output in history[prompt_id]['outputs'].items():
            if 'images' in node_output:
                for image in node_output['images']:
                    image_data = self.get_image(
                        image['filename'],
                        image['subfolder'],
                        image['type']
                    )
                    return image_data
        
        raise Exception("No image generated")
    
    def _get_history(self, prompt_id: str) -> dict:
        """Get generation history."""
        url = f"http://{self.server_address}/history/{prompt_id}"
        with urllib.request.urlopen(url) as response:
            return json.loads(response.read())
    
    def _build_sdxl_workflow(
        self,
        prompt: str,
        negative: str,
        width: int,
        height: int,
        steps: int,
        cfg: float,
        seed: int
    ) -> dict:
        """Build SDXL workflow JSON."""
        return {
            "3": {
                "class_type": "KSampler",
                "inputs": {
                    "cfg": cfg,
                    "denoise": 1,
                    "latent_image": ["5", 0],
                    "model": ["4", 0],
                    "negative": ["7", 0],
                    "positive": ["6", 0],
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "seed": seed,
                    "steps": steps
                }
            },
            "4": {
                "class_type": "CheckpointLoaderSimple",
                "inputs": {
                    "ckpt_name": "sd_xl_base_1.0.safetensors"
                }
            },
            "5": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                    "batch_size": 1,
                    "height": height,
                    "width": width
                }
            },
            "6": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "clip": ["4", 1],
                    "text": prompt
                }
            },
            "7": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "clip": ["4", 1],
                    "text": negative
                }
            },
            "8": {
                "class_type": "VAEDecode",
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                }
            },
            "9": {
                "class_type": "SaveImage",
                "inputs": {
                    "filename_prefix": "beast_gen",
                    "images": ["8", 0]
                }
            }
        }
```

### 3.4 Image Generation API Endpoint
```python
# backend/api/image_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64

from image_gen.comfyui_client import ComfyUIClient

router = APIRouter(prefix="/api/image", tags=["image"])

client = ComfyUIClient()

class ImageGenRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    steps: Optional[int] = 20
    seed: Optional[int] = None

class ImageGenResponse(BaseModel):
    image_base64: str
    seed: int
    prompt: str

@router.post("/generate", response_model=ImageGenResponse)
async def generate_image(request: ImageGenRequest):
    """Generate an image from a text prompt."""
    try:
        image_bytes = client.generate_image(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            seed=request.seed
        )
        
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        return ImageGenResponse(
            image_base64=image_base64,
            seed=request.seed or 0,
            prompt=request.prompt
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 3.5 Phase 3 Deliverables
- [ ] ComfyUI installed with GPU support
- [ ] SDXL and/or FLUX models downloaded
- [ ] API client for programmatic access
- [ ] Image generation endpoint working
- [ ] Integration with chat (detect image requests)

### 3.6 Phase 3 Testing
| Test | Expected Result | Status |
|------|-----------------|--------|
| ComfyUI starts | No errors, GPU detected | ⬜ |
| SDXL 1024x1024 | Image in ~10 seconds | ⬜ |
| FLUX Q5 512x512 | Image in ~30 seconds | ⬜ |
| API endpoint | Returns base64 image | ⬜ |

---

## Phase 4: AI Agents Framework
**Duration:** Week 4-5 | **Priority:** High

### 4.1 Agent Architecture Design
**Day 1**

```
┌─────────────────────────────────────────────────┐
│                 Agent Manager                    │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Research │  │  Coding  │  │  General │      │
│  │  Agent   │  │  Agent   │  │  Agent   │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │             │             │
│       └─────────────┼─────────────┘             │
│                     ▼                           │
│            ┌───────────────┐                    │
│            │  Tool Router  │                    │
│            └───────┬───────┘                    │
│                    │                            │
│    ┌───────────────┼───────────────┐           │
│    ▼               ▼               ▼           │
│ ┌──────┐      ┌──────┐       ┌──────┐         │
│ │Search│      │ Code │       │ File │         │
│ │ Tool │      │ Exec │       │ Tool │         │
│ └──────┘      └──────┘       └──────┘         │
└─────────────────────────────────────────────────┘
```

### 4.2 Base Agent Implementation
**Day 2-3**

```python
# backend/agents/base.py
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
import ollama

class ToolCall(BaseModel):
    name: str
    arguments: Dict[str, Any]

class ToolResult(BaseModel):
    name: str
    result: Any
    success: bool
    error: Optional[str] = None

class AgentResponse(BaseModel):
    content: str
    tool_calls: List[ToolCall] = []
    tool_results: List[ToolResult] = []
    model_used: str
    thinking: Optional[str] = None

class BaseTool(ABC):
    """Base class for agent tools."""
    
    name: str
    description: str
    parameters: Dict[str, Any]
    
    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """Execute the tool with given arguments."""
        pass
    
    def to_schema(self) -> Dict[str, Any]:
        """Convert to OpenAI-compatible function schema."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters
            }
        }

class BaseAgent(ABC):
    """Base class for AI agents."""
    
    def __init__(
        self,
        model: str,
        system_prompt: str,
        tools: Optional[List[BaseTool]] = None,
        max_iterations: int = 10
    ):
        self.model = model
        self.system_prompt = system_prompt
        self.tools = {tool.name: tool for tool in (tools or [])}
        self.max_iterations = max_iterations
        self.client = ollama.Client()
    
    async def run(self, user_input: str, context: Optional[str] = None) -> AgentResponse:
        """Run the agent on user input."""
        messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        
        if context:
            messages.append({"role": "system", "content": f"Context:\n{context}"})
        
        messages.append({"role": "user", "content": user_input})
        
        tool_calls = []
        tool_results = []
        
        for iteration in range(self.max_iterations):
            response = self.client.chat(
                model=self.model,
                messages=messages,
                tools=[tool.to_schema() for tool in self.tools.values()] if self.tools else None
            )
            
            message = response['message']
            
            # Check for tool calls
            if 'tool_calls' in message and message['tool_calls']:
                for tool_call in message['tool_calls']:
                    tool_name = tool_call['function']['name']
                    tool_args = tool_call['function']['arguments']
                    
                    tool_calls.append(ToolCall(name=tool_name, arguments=tool_args))
                    
                    # Execute tool
                    if tool_name in self.tools:
                        try:
                            result = await self.tools[tool_name].execute(**tool_args)
                            tool_results.append(ToolResult(
                                name=tool_name,
                                result=result,
                                success=True
                            ))
                            messages.append({
                                "role": "tool",
                                "content": str(result),
                                "name": tool_name
                            })
                        except Exception as e:
                            tool_results.append(ToolResult(
                                name=tool_name,
                                result=None,
                                success=False,
                                error=str(e)
                            ))
                            messages.append({
                                "role": "tool",
                                "content": f"Error: {str(e)}",
                                "name": tool_name
                            })
                    else:
                        tool_results.append(ToolResult(
                            name=tool_name,
                            result=None,
                            success=False,
                            error=f"Unknown tool: {tool_name}"
                        ))
            else:
                # No tool calls, return response
                return AgentResponse(
                    content=message['content'],
                    tool_calls=tool_calls,
                    tool_results=tool_results,
                    model_used=self.model
                )
        
        return AgentResponse(
            content="Max iterations reached",
            tool_calls=tool_calls,
            tool_results=tool_results,
            model_used=self.model
        )
```

### 4.3 Research Agent
**Day 4-5**

```python
# backend/agents/research_agent.py
from typing import List, Optional
from .base import BaseAgent, BaseTool
import httpx

class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Search the web for information on a topic"
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query"
            },
            "num_results": {
                "type": "integer",
                "description": "Number of results to return",
                "default": 5
            }
        },
        "required": ["query"]
    }
    
    def __init__(self, searxng_url: str = "http://localhost:8080"):
        self.searxng_url = searxng_url
    
    async def execute(self, query: str, num_results: int = 5) -> List[dict]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.searxng_url}/search",
                params={
                    "q": query,
                    "format": "json",
                    "categories": "general"
                }
            )
            results = response.json().get("results", [])[:num_results]
            return [
                {
                    "title": r.get("title"),
                    "url": r.get("url"),
                    "snippet": r.get("content")
                }
                for r in results
            ]

class FetchPageTool(BaseTool):
    name = "fetch_page"
    description = "Fetch and extract text content from a webpage"
    parameters = {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The URL to fetch"
            }
        },
        "required": ["url"]
    }
    
    async def execute(self, url: str) -> str:
        try:
            from trafilatura import fetch_url, extract
            downloaded = fetch_url(url)
            if downloaded:
                text = extract(downloaded)
                return text[:5000] if text else "Could not extract content"
            return "Could not fetch URL"
        except Exception as e:
            return f"Error fetching page: {str(e)}"

class ResearchAgent(BaseAgent):
    """Agent specialized in web research and information synthesis."""
    
    def __init__(self):
        super().__init__(
            model="deepseek-r1:8b",
            system_prompt="""You are a research assistant that conducts thorough web research.
            
Your process:
1. Break down the research topic into key questions
2. Use web_search to find relevant information
3. Use fetch_page to get detailed content from promising URLs
4. Synthesize findings into a comprehensive report

Always cite your sources with URLs. Be thorough but concise.""",
            tools=[
                WebSearchTool(),
                FetchPageTool()
            ],
            max_iterations=15
        )
```

### 4.4 Coding Agent
**Day 6-7**

```python
# backend/agents/coding_agent.py
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
from .base import BaseAgent, BaseTool, ToolResult

class ExecutePythonTool(BaseTool):
    name = "execute_python"
    description = "Execute Python code and return the output"
    parameters = {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Python code to execute"
            }
        },
        "required": ["code"]
    }
    
    async def execute(self, code: str) -> dict:
        with tempfile.TemporaryDirectory() as tmpdir:
            code_file = Path(tmpdir) / "solution.py"
            code_file.write_text(code)
            
            try:
                result = subprocess.run(
                    ["python", str(code_file)],
                    capture_output=True,
                    timeout=30,
                    cwd=tmpdir,
                    text=True
                )
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "return_code": result.returncode
                }
            except subprocess.TimeoutExpired:
                return {
                    "success": False,
                    "stdout": "",
                    "stderr": "Execution timed out (30s limit)",
                    "return_code": -1
                }

class ReadFileTool(BaseTool):
    name = "read_file"
    description = "Read contents of a file"
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path to the file"
            }
        },
        "required": ["path"]
    }
    
    async def execute(self, path: str) -> str:
        try:
            # Security: only allow reading from specific directories
            allowed_paths = [Path.cwd(), Path.home() / "projects"]
            file_path = Path(path).resolve()
            
            if not any(str(file_path).startswith(str(p)) for p in allowed_paths):
                return f"Access denied: {path}"
            
            return file_path.read_text()
        except Exception as e:
            return f"Error reading file: {str(e)}"

class WriteFileTool(BaseTool):
    name = "write_file"
    description = "Write content to a file"
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path to the file"
            },
            "content": {
                "type": "string",
                "description": "Content to write"
            }
        },
        "required": ["path", "content"]
    }
    
    async def execute(self, path: str, content: str) -> str:
        try:
            file_path = Path(path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content)
            return f"Successfully wrote to {path}"
        except Exception as e:
            return f"Error writing file: {str(e)}"

class CodingAgent(BaseAgent):
    """Agent specialized in code generation and execution."""
    
    def __init__(self):
        super().__init__(
            model="qwen2.5-coder:7b",
            system_prompt="""You are an expert programmer. Your job is to:
1. Understand the coding task
2. Write clean, well-documented code
3. Test the code by executing it
4. Fix any errors and iterate

Guidelines:
- Always include error handling
- Add type hints for Python code
- Write modular, reusable code
- Test your code before returning the final answer""",
            tools=[
                ExecutePythonTool(),
                ReadFileTool(),
                WriteFileTool()
            ],
            max_iterations=10
        )
```

### 4.5 Agent Manager & API
```python
# backend/agents/manager.py
from typing import Dict, Optional
from enum import Enum
from .base import BaseAgent, AgentResponse
from .research_agent import ResearchAgent
from .coding_agent import CodingAgent

class AgentType(str, Enum):
    RESEARCH = "research"
    CODING = "coding"
    GENERAL = "general"

class AgentManager:
    """Manages and routes requests to appropriate agents."""
    
    def __init__(self):
        self.agents: Dict[AgentType, BaseAgent] = {
            AgentType.RESEARCH: ResearchAgent(),
            AgentType.CODING: CodingAgent(),
        }
    
    async def run_agent(
        self,
        agent_type: AgentType,
        query: str,
        context: Optional[str] = None
    ) -> AgentResponse:
        """Run specified agent with query."""
        if agent_type not in self.agents:
            raise ValueError(f"Unknown agent type: {agent_type}")
        
        agent = self.agents[agent_type]
        return await agent.run(query, context)
    
    def classify_and_route(self, query: str) -> AgentType:
        """Automatically classify query and determine agent."""
        query_lower = query.lower()
        
        research_keywords = ["research", "find out", "what is", "search", "look up"]
        coding_keywords = ["code", "write", "function", "debug", "implement", "program"]
        
        if any(kw in query_lower for kw in coding_keywords):
            return AgentType.CODING
        elif any(kw in query_lower for kw in research_keywords):
            return AgentType.RESEARCH
        
        return AgentType.GENERAL
```

### 4.6 Phase 4 Deliverables
- [ ] Base agent framework implemented
- [ ] Research agent with web search & page fetching
- [ ] Coding agent with code execution sandbox
- [ ] Agent manager for routing
- [ ] API endpoints for agent interactions

### 4.7 Phase 4 Testing
| Test | Expected Result | Status |
|------|-----------------|--------|
| Research agent searches web | Returns search results | ⬜ |
| Research agent synthesizes info | Produces report with citations | ⬜ |
| Coding agent writes Python | Generates valid Python code | ⬜ |
| Coding agent executes code | Returns execution output | ⬜ |
| Agent routing | Correct agent selected | ⬜ |

---

## Phase 5: RAG & Deep Research
**Duration:** Week 6 | **Priority:** High

### 5.1 ChromaDB Setup
**Day 1**

```python
# backend/rag/vector_store.py
import chromadb
from chromadb.config import Settings
import ollama
from typing import List, Optional, Dict, Any
from pathlib import Path

class LocalVectorStore:
    """Local vector store using ChromaDB and Ollama embeddings."""
    
    def __init__(
        self,
        persist_directory: str = "./data/chromadb",
        embedding_model: str = "nomic-embed-text"
    ):
        self.persist_directory = persist_directory
        self.embedding_model = embedding_model
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )
    
    def _embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using Ollama."""
        embeddings = []
        for text in texts:
            response = ollama.embeddings(
                model=self.embedding_model,
                prompt=text
            )
            embeddings.append(response['embedding'])
        return embeddings
    
    def add_documents(
        self,
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[str]] = None
    ):
        """Add documents to the vector store."""
        if not ids:
            import uuid
            ids = [str(uuid.uuid4()) for _ in documents]
        
        if not metadatas:
            metadatas = [{"source": "unknown"} for _ in documents]
        
        embeddings = self._embed(documents)
        
        self.collection.add(
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
    
    def search(
        self,
        query: str,
        k: int = 5,
        where: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar documents."""
        query_embedding = self._embed([query])[0]
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where=where
        )
        
        return [
            {
                "content": doc,
                "metadata": meta,
                "distance": dist
            }
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            )
        ]
    
    def delete_collection(self):
        """Delete the collection."""
        self.client.delete_collection("knowledge_base")
```

### 5.2 Document Ingestion Pipeline
**Day 2-3**

```python
# backend/rag/ingestion.py
from pathlib import Path
from typing import List, Optional
import hashlib
from dataclasses import dataclass

@dataclass
class Document:
    content: str
    source: str
    doc_type: str
    chunk_index: int = 0
    total_chunks: int = 1

class DocumentIngester:
    """Ingests documents from various sources."""
    
    SUPPORTED_EXTENSIONS = {'.txt', '.md', '.pdf', '.py', '.js', '.html'}
    CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 200
    
    def __init__(self, vector_store):
        self.vector_store = vector_store
    
    def ingest_file(self, file_path: Path) -> int:
        """Ingest a single file."""
        if file_path.suffix not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {file_path.suffix}")
        
        content = self._read_file(file_path)
        chunks = self._chunk_text(content)
        
        documents = []
        metadatas = []
        ids = []
        
        for i, chunk in enumerate(chunks):
            doc_id = self._generate_id(file_path, i)
            documents.append(chunk)
            metadatas.append({
                "source": str(file_path),
                "doc_type": file_path.suffix[1:],
                "chunk_index": i,
                "total_chunks": len(chunks)
            })
            ids.append(doc_id)
        
        self.vector_store.add_documents(documents, metadatas, ids)
        return len(chunks)
    
    def ingest_folder(
        self,
        folder_path: Path,
        extensions: Optional[List[str]] = None
    ) -> dict:
        """Ingest all files from a folder."""
        if extensions is None:
            extensions = list(self.SUPPORTED_EXTENSIONS)
        
        stats = {"files": 0, "chunks": 0, "errors": []}
        
        for ext in extensions:
            for file_path in folder_path.rglob(f"*{ext}"):
                try:
                    chunks = self.ingest_file(file_path)
                    stats["files"] += 1
                    stats["chunks"] += chunks
                except Exception as e:
                    stats["errors"].append({"file": str(file_path), "error": str(e)})
        
        return stats
    
    def _read_file(self, file_path: Path) -> str:
        """Read file content based on type."""
        if file_path.suffix == '.pdf':
            return self._read_pdf(file_path)
        else:
            return file_path.read_text(encoding='utf-8', errors='ignore')
    
    def _read_pdf(self, file_path: Path) -> str:
        """Read PDF file."""
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                text = "\n".join(
                    page.extract_text() or "" 
                    for page in pdf.pages
                )
            return text
        except ImportError:
            raise ImportError("Install pdfplumber: pip install pdfplumber")
    
    def _chunk_text(self, text: str) -> List[str]:
        """Chunk text with overlap."""
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.CHUNK_SIZE
            chunk = text[start:end]
            
            # Try to break at sentence/paragraph boundary
            if end < len(text):
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                if break_point > self.CHUNK_SIZE // 2:
                    chunk = chunk[:break_point + 1]
                    end = start + break_point + 1
            
            chunks.append(chunk.strip())
            start = end - self.CHUNK_OVERLAP
        
        return [c for c in chunks if c]
    
    def _generate_id(self, file_path: Path, chunk_index: int) -> str:
        """Generate unique ID for a chunk."""
        content = f"{file_path}:{chunk_index}"
        return hashlib.md5(content.encode()).hexdigest()
```

### 5.3 Deep Research Pipeline
**Day 4-5**

```python
# backend/rag/deep_research.py
from typing import List, Optional
from dataclasses import dataclass
import asyncio
from .vector_store import LocalVectorStore
import httpx
import ollama

@dataclass
class ResearchReport:
    topic: str
    summary: str
    key_findings: List[str]
    sources: List[str]
    raw_content: str

class DeepResearchPipeline:
    """Multi-step research pipeline combining web search and RAG."""
    
    def __init__(
        self,
        vector_store: LocalVectorStore,
        searxng_url: str = "http://localhost:8080",
        planner_model: str = "deepseek-r1:8b",
        synthesizer_model: str = "qwen3:8b"
    ):
        self.vector_store = vector_store
        self.searxng_url = searxng_url
        self.planner_model = planner_model
        self.synthesizer_model = synthesizer_model
    
    async def research(
        self,
        topic: str,
        depth: int = 3,
        include_local: bool = True
    ) -> ResearchReport:
        """Conduct deep research on a topic."""
        
        # Step 1: Generate research plan
        plan = await self._generate_plan(topic, depth)
        queries = self._parse_queries(plan)
        
        # Step 2: Execute web searches
        web_results = await self._execute_searches(queries)
        
        # Step 3: Fetch and process web pages
        documents = await self._fetch_pages(web_results)
        
        # Step 4: Search local knowledge base
        local_results = []
        if include_local:
            local_results = self.vector_store.search(topic, k=10)
        
        # Step 5: Combine and synthesize
        all_content = self._combine_sources(documents, local_results)
        
        # Step 6: Generate report
        report = await self._synthesize_report(topic, all_content)
        
        return ResearchReport(
            topic=topic,
            summary=report["summary"],
            key_findings=report["key_findings"],
            sources=[d["url"] for d in documents],
            raw_content=all_content
        )
    
    async def _generate_plan(self, topic: str, depth: int) -> str:
        """Generate a research plan."""
        prompt = f"""Create a comprehensive research plan for: {topic}

Generate {depth * 3} diverse search queries that will cover:
- Basic definitions and overview
- Key concepts and components
- Recent developments and news
- Expert opinions and analysis
- Practical applications

Return only the search queries, one per line."""
        
        response = ollama.chat(
            model=self.planner_model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response['message']['content']
    
    def _parse_queries(self, plan: str) -> List[str]:
        """Extract search queries from plan."""
        lines = plan.strip().split('\n')
        queries = []
        for line in lines:
            # Clean up numbering and bullet points
            query = line.strip().lstrip('0123456789.-) ')
            if query and len(query) > 5:
                queries.append(query)
        return queries
    
    async def _execute_searches(self, queries: List[str]) -> List[dict]:
        """Execute multiple search queries."""
        all_results = []
        
        async with httpx.AsyncClient() as client:
            for query in queries:
                try:
                    response = await client.get(
                        f"{self.searxng_url}/search",
                        params={"q": query, "format": "json"},
                        timeout=10.0
                    )
                    results = response.json().get("results", [])[:5]
                    all_results.extend(results)
                except Exception as e:
                    print(f"Search error for '{query}': {e}")
        
        # Deduplicate by URL
        seen_urls = set()
        unique_results = []
        for result in all_results:
            url = result.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_results.append(result)
        
        return unique_results
    
    async def _fetch_pages(self, results: List[dict]) -> List[dict]:
        """Fetch content from result URLs."""
        from trafilatura import fetch_url, extract
        
        documents = []
        for result in results[:15]:  # Limit to 15 pages
            try:
                downloaded = fetch_url(result["url"])
                if downloaded:
                    text = extract(downloaded)
                    if text:
                        documents.append({
                            "url": result["url"],
                            "title": result.get("title", ""),
                            "content": text[:3000]  # Limit content length
                        })
            except Exception as e:
                print(f"Fetch error for {result['url']}: {e}")
        
        return documents
    
    def _combine_sources(
        self,
        web_docs: List[dict],
        local_results: List[dict]
    ) -> str:
        """Combine all sources into formatted content."""
        sections = []
        
        # Web sources
        sections.append("## Web Sources\n")
        for doc in web_docs:
            sections.append(f"### {doc['title']}\nSource: {doc['url']}\n{doc['content']}\n")
        
        # Local knowledge
        if local_results:
            sections.append("\n## Local Knowledge Base\n")
            for result in local_results:
                sections.append(f"### From: {result['metadata'].get('source', 'Unknown')}\n{result['content']}\n")
        
        return "\n".join(sections)
    
    async def _synthesize_report(self, topic: str, content: str) -> dict:
        """Synthesize final research report."""
        prompt = f"""Based on the following research materials, create a comprehensive report on: {topic}

Research Materials:
{content[:15000]}

Create a report with:
1. Executive Summary (2-3 paragraphs)
2. Key Findings (5-7 bullet points)
3. Detailed Analysis
4. Conclusions

Be thorough but concise. Cite sources where relevant."""
        
        response = ollama.chat(
            model=self.synthesizer_model,
            messages=[{"role": "user", "content": prompt}]
        )
        
        report_text = response['message']['content']
        
        # Parse key findings (simple extraction)
        key_findings = []
        for line in report_text.split('\n'):
            if line.strip().startswith(('-', '•', '*')) and len(line) > 10:
                key_findings.append(line.strip().lstrip('-•* '))
        
        return {
            "summary": report_text,
            "key_findings": key_findings[:7]
        }
```

### 5.4 RAG API Endpoints
```python
# backend/api/rag_routes.py
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import tempfile
from pathlib import Path

from rag.vector_store import LocalVectorStore
from rag.ingestion import DocumentIngester
from rag.deep_research import DeepResearchPipeline

router = APIRouter(prefix="/api/rag", tags=["rag"])

vector_store = LocalVectorStore()
ingester = DocumentIngester(vector_store)
research_pipeline = DeepResearchPipeline(vector_store)

class SearchRequest(BaseModel):
    query: str
    k: int = 5

class ResearchRequest(BaseModel):
    topic: str
    depth: int = 3
    include_local: bool = True

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and ingest a document."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)
    
    try:
        chunks = ingester.ingest_file(tmp_path)
        return {"status": "success", "chunks_created": chunks, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        tmp_path.unlink()

@router.post("/search")
async def search_knowledge(request: SearchRequest):
    """Search the knowledge base."""
    results = vector_store.search(request.query, k=request.k)
    return {"results": results}

@router.post("/research")
async def deep_research(request: ResearchRequest):
    """Conduct deep research on a topic."""
    try:
        report = await research_pipeline.research(
            topic=request.topic,
            depth=request.depth,
            include_local=request.include_local
        )
        return {
            "topic": report.topic,
            "summary": report.summary,
            "key_findings": report.key_findings,
            "sources": report.sources
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 5.5 Phase 5 Deliverables
- [ ] ChromaDB setup and working
- [ ] Document ingestion pipeline (txt, md, pdf, code)
- [ ] Semantic search functionality
- [ ] Deep research pipeline with web + local sources
- [ ] API endpoints for RAG operations

### 5.6 Phase 5 Testing
| Test | Expected Result | Status |
|------|-----------------|--------|
| Ingest text file | Chunked and stored | ⬜ |
| Ingest PDF | Text extracted and indexed | ⬜ |
| Search query | Returns relevant chunks | ⬜ |
| Deep research | Multi-source report generated | ⬜ |

---

## Phase 6: Frontend & Integration
**Duration:** Week 7-8 | **Priority:** Medium

### 6.1 Open WebUI Extensions
**Day 1-3**

#### Custom Functions (Open WebUI Pipelines)
```python
# pipelines/auto_router.py
"""
title: Auto Router Pipeline
description: Automatically routes queries to optimal models
"""

from typing import Optional, List
import requests

class Pipeline:
    def __init__(self):
        self.router_url = "http://localhost:8001"
    
    async def on_startup(self):
        print("Auto Router Pipeline started")
    
    async def on_shutdown(self):
        pass
    
    def pipe(
        self,
        user_message: str,
        model_id: str,
        messages: List[dict],
        body: dict
    ) -> dict:
        # Get routing decision
        response = requests.post(
            f"{self.router_url}/v1/chat/completions",
            json={"messages": messages, "model": "auto"}
        )
        
        routing = response.json()
        
        # Update model in body
        body["model"] = routing["model_used"]
        
        # Add routing info to response
        return body
```

### 6.2 Custom Next.js Frontend (Optional)
**Day 4-8**

#### Project Setup
```bash
npx create-next-app@latest beast-ui --typescript --tailwind --app
cd beast-ui
npm install @radix-ui/react-icons lucide-react
npx shadcn-ui@latest init
```

#### Core Components
```typescript
// app/page.tsx
import { ChatInterface } from '@/components/chat/ChatInterface'

export default function Home() {
  return (
    <main className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <ChatInterface />
    </main>
  )
}
```

```typescript
// components/chat/ChatInterface.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Code, Search, Image } from 'lucide-react'

type Mode = 'chat' | 'research' | 'code' | 'image'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  timestamp: Date
}

export function ChatInterface() {
  const [mode, setMode] = useState<Mode>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const endpoint = mode === 'chat' 
        ? '/api/chat'
        : mode === 'research'
        ? '/api/research'
        : mode === 'code'
        ? '/api/code'
        : '/api/image'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: 'auto'
        })
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response?.message?.content || data.content,
        model: data.model_used,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Mode Selector */}
      <div className="flex gap-2 p-4 border-b border-white/10">
        <ModeButton 
          icon={<Sparkles className="w-4 h-4" />}
          label="Chat" 
          active={mode === 'chat'} 
          onClick={() => setMode('chat')} 
        />
        <ModeButton 
          icon={<Search className="w-4 h-4" />}
          label="Research" 
          active={mode === 'research'} 
          onClick={() => setMode('research')} 
        />
        <ModeButton 
          icon={<Code className="w-4 h-4" />}
          label="Code" 
          active={mode === 'code'} 
          onClick={() => setMode('code')} 
        />
        <ModeButton 
          icon={<Image className="w-4 h-4" />}
          label="Image" 
          active={mode === 'image'} 
          onClick={() => setMode('image')} 
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Ask anything in ${mode} mode...`}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 
                       text-white placeholder-white/40 focus:outline-none focus:ring-2 
                       focus:ring-purple-500/50"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 
                       rounded-xl px-4 py-3 text-white transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
```

### 6.3 Full Integration Testing
**Day 7-8**

#### Integration Test Suite
```python
# tests/integration/test_full_pipeline.py
import pytest
import httpx
import asyncio

BASE_URL = "http://localhost:8001"

@pytest.mark.asyncio
async def test_chat_routing():
    """Test that chat requests are routed correctly."""
    async with httpx.AsyncClient() as client:
        # Simple query should use fast model
        response = await client.post(
            f"{BASE_URL}/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": "Hi!"}],
                "model": "auto"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["model_used"] == "qwen3:4b"

@pytest.mark.asyncio
async def test_coding_query():
    """Test coding queries use code model."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": "Write a Python function to calculate factorial"}],
                "model": "auto"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["model_used"] == "qwen2.5-coder:7b"

@pytest.mark.asyncio
async def test_research_pipeline():
    """Test deep research pipeline."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BASE_URL}/api/rag/research",
            json={
                "topic": "Quantum computing basics",
                "depth": 2,
                "include_local": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "sources" in data

@pytest.mark.asyncio
async def test_image_generation():
    """Test image generation endpoint."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BASE_URL}/api/image/generate",
            json={
                "prompt": "A beautiful sunset over mountains",
                "width": 512,
                "height": 512,
                "steps": 10
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "image_base64" in data
```

### 6.4 Phase 6 Deliverables
- [ ] Open WebUI extended with custom pipelines
- [ ] (Optional) Custom Next.js frontend
- [ ] All services integrated
- [ ] Full integration tests passing
- [ ] Documentation updated

---

## Phase 7: Offline Mode & Polish
**Duration:** Week 8+ | **Priority:** Medium

### 7.1 Offline Detection System
```python
# backend/utils/network.py
import socket
from functools import wraps
from typing import Callable, Any
import asyncio

_online_status = None
_last_check = 0

def is_online(timeout: float = 2.0, cache_seconds: float = 30.0) -> bool:
    """Check if we have internet connectivity with caching."""
    global _online_status, _last_check
    import time
    
    current_time = time.time()
    if _online_status is not None and (current_time - _last_check) < cache_seconds:
        return _online_status
    
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=timeout)
        _online_status = True
    except OSError:
        _online_status = False
    
    _last_check = current_time
    return _online_status

def requires_internet(fallback_message: str = "This feature requires internet."):
    """Decorator for functions that need internet."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            if not is_online():
                return {
                    "status": "offline",
                    "message": fallback_message,
                    "offline_alternative": "Use local RAG search instead."
                }
            return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            if not is_online():
                return {
                    "status": "offline",
                    "message": fallback_message
                }
            return func(*args, **kwargs)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator
```

### 7.2 Startup Scripts
```powershell
# scripts/start_beast.ps1
# Local AI Beast Startup Script (Windows)

Write-Host "🔥 Starting Local AI Beast..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Check for required services
Write-Host "`n📦 Checking prerequisites..." -ForegroundColor Yellow

# Check Ollama
if (Get-Process -Name "ollama" -ErrorAction SilentlyContinue) {
    Write-Host "  ✅ Ollama is running" -ForegroundColor Green
} else {
    Write-Host "  🚀 Starting Ollama..." -ForegroundColor Yellow
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Check models
Write-Host "`n📋 Checking models..." -ForegroundColor Yellow
$requiredModels = @("qwen3:4b", "qwen3:8b", "deepseek-r1:8b", "qwen2.5-coder:7b", "nomic-embed-text")
$installedModels = ollama list | ForEach-Object { $_.Split()[0] }

foreach ($model in $requiredModels) {
    if ($installedModels -contains $model) {
        Write-Host "  ✅ $model" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $model (missing - run 'ollama pull $model')" -ForegroundColor Red
    }
}

# Start Docker services
Write-Host "`n🐳 Starting Docker services..." -ForegroundColor Yellow
Set-Location $PSScriptRoot\..\docker
docker-compose up -d

# Start backend
Write-Host "`n🔧 Starting backend services..." -ForegroundColor Yellow
Set-Location $PSScriptRoot\..\backend
Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001" -WindowStyle Hidden

# Wait for services
Write-Host "`n⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Health check
Write-Host "`n🏥 Running health checks..." -ForegroundColor Yellow
$services = @(
    @{Name="Ollama"; URL="http://localhost:11434/api/tags"},
    @{Name="Open WebUI"; URL="http://localhost:3000"},
    @{Name="Router API"; URL="http://localhost:8001/health"},
    @{Name="SearXNG"; URL="http://localhost:8080"}
)

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri $service.URL -TimeoutSec 5 -UseBasicParsing
        Write-Host "  ✅ $($service.Name)" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ $($service.Name) (not responding)" -ForegroundColor Red
    }
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "✅ Local AI Beast is ready!" -ForegroundColor Green
Write-Host "`n📍 Access points:" -ForegroundColor White
Write-Host "   Chat Interface: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   API (Router):   http://localhost:8001" -ForegroundColor Cyan
Write-Host "   Ollama:         http://localhost:11434" -ForegroundColor Cyan
Write-Host "   SearXNG:        http://localhost:8080" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan
```

### 7.3 Phase 7 Deliverables
- [ ] Offline detection and graceful degradation
- [ ] Pre-download checklist script
- [ ] Startup/shutdown scripts
- [ ] Health monitoring dashboard
- [ ] Performance optimization

---

## Testing & Quality Assurance

### Automated Test Suite
```python
# tests/conftest.py
import pytest
import asyncio

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def router():
    from backend.router.router import ModelRouter
    return ModelRouter()

@pytest.fixture
def vector_store():
    from backend.rag.vector_store import LocalVectorStore
    return LocalVectorStore(persist_directory="./test_data/chromadb")
```

### CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio
      
      - name: Run unit tests
        run: pytest tests/unit -v
      
      - name: Run integration tests
        run: pytest tests/integration -v --tb=short
```

---

## Resource Requirements

### Hardware Utilization Estimates

| Component | RAM | VRAM | Disk |
|-----------|-----|------|------|
| Ollama (idle) | 1GB | - | - |
| Qwen3 4B loaded | 4GB | 3GB | 2.5GB |
| Qwen3 8B loaded | 6GB | 6GB | 4.5GB |
| DeepSeek-R1 8B | 8GB | 6GB | 5GB |
| LLaVA 7B | 6GB | 6GB | 4.5GB |
| ComfyUI + SDXL | 4GB | 7GB | 7GB |
| ChromaDB | 2GB | - | Variable |
| Open WebUI | 1GB | - | 500MB |

### Total Requirements
- **RAM:** 16-20GB when multiple models loaded
- **VRAM:** 6-8GB (single model at a time)
- **Disk:** ~50GB for all models and data

---

## Milestones & Success Criteria

### Milestone 1: Foundation (End of Week 1)
✅ Can chat with local models through Open WebUI
✅ Web search working via SearXNG
✅ Basic RAG functioning

### Milestone 2: Intelligence (End of Week 3)
✅ Smart model routing with 85%+ accuracy
✅ Image generation from chat
✅ Multiple model switching transparent to user

### Milestone 3: Agents (End of Week 5)
✅ Research agent produces quality reports
✅ Coding agent can write and test code
✅ Tools execute reliably

### Milestone 4: Production Ready (End of Week 8)
✅ Full offline capability
✅ All integrations working
✅ Performance optimized
✅ Documentation complete

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| VRAM overflow | High | Model queue system, offloading |
| Model quality issues | Medium | Multiple model fallbacks |
| Docker networking | Medium | Document host.docker.internal |
| API rate limits (SearXNG) | Low | Request throttling, caching |
| Disk space | Medium | Model pruning, cleanup scripts |

---

## Next Steps

1. **Immediate:** Set up development environment (Phase 0)
2. **This Week:** Complete Phase 1 foundation
3. **Ongoing:** Follow phase timeline, adjust based on learnings

---

*This development plan is a living document. Update as you progress and discover new requirements.*

**Last Updated:** December 5, 2025

