# ComfyUI Setup Guide

## ✅ Completed

- ComfyUI cloned to `C:\Users\jcgus\Documents\ComfyUI`
- Virtual environment created and dependencies installed
- PyTorch with CUDA 12.1 installed
- Backend client implemented
- Frontend integration complete

## 📥 Next Steps: Download Image Models

### Option 1: SDXL Base (Recommended - ~6.5GB)

1. **Download from HuggingFace:**
   ```powershell
   # Using huggingface-cli (if installed)
   cd C:\Users\jcgus\Documents\ComfyUI
   .\venv\Scripts\Activate.ps1
   huggingface-cli download stabilityai/stable-diffusion-xl-base-1.0 sd_xl_base_1.0.safetensors --local-dir models/checkpoints
   ```

2. **Or download manually:**
   - Visit: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
   - Download `sd_xl_base_1.0.safetensors`
   - Place in: `C:\Users\jcgus\Documents\ComfyUI\models\checkpoints\`

### Option 2: FLUX Schnell (Faster, ~5GB)

1. **Download FLUX:**
   ```powershell
   huggingface-cli download black-forest-labs/FLUX.1-schnell-dev --include "*.safetensors" --local-dir models/checkpoints
   ```

## 🚀 Starting ComfyUI

### Method 1: Using the startup script
```powershell
cd C:\Users\jcgus\Documents\beastAI
.\start_comfyui.ps1
```

### Method 2: Manual start
```powershell
cd C:\Users\jcgus\Documents\ComfyUI
.\venv\Scripts\Activate.ps1
python main.py --port 8188
```

ComfyUI will be available at:
- **Web UI:** http://127.0.0.1:8188
- **API:** http://127.0.0.1:8188

## ✅ Verify Setup

1. **Check ComfyUI is running:**
   ```powershell
   Invoke-WebRequest -Uri "http://127.0.0.1:8188/system_stats" -UseBasicParsing
   ```

2. **Check from backend:**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:8001/api/images/health" -UseBasicParsing
   ```

3. **Test image generation:**
   - Open frontend: http://localhost:3000
   - Click "Image" mode tab
   - Enter a prompt like "a beautiful sunset over mountains"
   - Click Send
   - Wait for image generation (30-60 seconds first time)

## 🎨 Using Image Generation

1. **In Frontend:**
   - Switch to "Image" mode tab in header
   - Enter your prompt
   - Generated image will appear in chat

2. **API Direct:**
   ```powershell
   $body = @{
       prompt = "a cyberpunk cityscape at night"
       width = 1024
       height = 1024
       steps = 20
   } | ConvertTo-Json
   
   Invoke-WebRequest -Uri "http://localhost:8001/api/images/generate" `
       -Method POST -ContentType "application/json" -Body $body
   ```

## 🔧 Troubleshooting

### ComfyUI won't start
- Check if port 8188 is available: `netstat -an | findstr 8188`
- Verify virtual environment is activated
- Check GPU is detected: `python -c "import torch; print(torch.cuda.is_available())"`

### "No models found" error
- Ensure model file is in `ComfyUI/models/checkpoints/`
- File should be named `sd_xl_base_1.0.safetensors` (or update workflow in code)

### Generation fails
- Check ComfyUI logs for errors
- Verify model is loaded (check ComfyUI web UI)
- Ensure GPU has enough VRAM (SDXL needs ~6GB)

## 📊 Performance Tips

- **First generation:** ~30-60 seconds (model loading)
- **Subsequent:** ~10-20 seconds per 1024x1024 image
- **Lower resolution:** Use 512x512 for faster generation
- **Fewer steps:** Reduce to 15-20 steps for speed

---

**Status:** Code complete, waiting for model download and ComfyUI startup.

