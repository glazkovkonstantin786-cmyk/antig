"""
GravityBrain Inference Server v1.0
====================================
FastAPI server that loads a trained GravityBrain model and exposes
HTTP endpoints for text generation and feedback collection.

Usage:
    python server.py                     # Start on default port 8000
    python server.py --port 9000         # Custom port
    python server.py --host 0.0.0.0      # Allow external connections
"""

import argparse
import json
import os
import time
from datetime import datetime

import torch

# Conditional import for FastAPI (with fallback for simple HTTP server)
try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    print("⚠️  FastAPI not found. Install with: pip install fastapi uvicorn")
    print("    Falling back to simple HTTP server mode...")

from tokenizer import CharTokenizer
from gravity_model import GravityBrain


# =============================================================
#  LOAD MODEL
# =============================================================
def load_model(weights_dir: str):
    """Load trained GravityBrain model and tokenizer."""
    # Load tokenizer
    tokenizer_path = os.path.join(weights_dir, 'tokenizer.json')
    if not os.path.exists(tokenizer_path):
        raise FileNotFoundError(f"Tokenizer not found at {tokenizer_path}. Train the model first!")
    
    tokenizer = CharTokenizer().load(tokenizer_path)

    # Load model checkpoint
    model_path = os.path.join(weights_dir, 'gravity_brain.pt')
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}. Train the model first!")

    checkpoint = torch.load(model_path, map_location='cpu', weights_only=True)

    model = GravityBrain(
        vocab_size=checkpoint['vocab_size'],
        n_embd=checkpoint['n_embd'],
        n_head=checkpoint['n_head'],
        n_layer=checkpoint['n_layer'],
        block_size=checkpoint['block_size'],
    )
    model.load_state_dict(checkpoint['model_state'])
    model.eval()

    print(f"[GravityBrain Server] Model loaded ({model.count_parameters():,} params, loss: {checkpoint['loss']:.4f})")
    return model, tokenizer


# =============================================================
#  FEEDBACK STORAGE
# =============================================================
def save_feedback(feedback_dir: str, message_id: str, reaction: str, message_text: str):
    """Save user feedback for future RLHF-style fine-tuning."""
    os.makedirs(feedback_dir, exist_ok=True)
    filepath = os.path.join(feedback_dir, 'feedback_log.jsonl')
    
    entry = {
        'timestamp': datetime.now().isoformat(),
        'message_id': message_id,
        'reaction': reaction,
        'message_text': message_text[:500],  # Truncate for storage
    }
    
    with open(filepath, 'a', encoding='utf-8') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    return True


# =============================================================
#  FASTAPI SERVER
# =============================================================
if HAS_FASTAPI:
    app = FastAPI(
        title="GravityBrain API",
        description="Custom neural network inference server for Antigravity",
        version="1.0.0"
    )

    # CORS — allow mobile app to connect
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global model reference
    _model = None
    _tokenizer = None
    _device = None

    class GenerateRequest(BaseModel):
        prompt: str
        max_tokens: int = 200
        temperature: float = 0.8
        top_k: int = 40

    class GenerateResponse(BaseModel):
        text: str
        tokens_generated: int
        time_ms: float
        model: str = "GravityBrain v1.0"

    class FeedbackRequest(BaseModel):
        message_id: str
        reaction: str  # "like" or "dislike"
        message_text: str = ""

    @app.on_event("startup")
    async def startup():
        global _model, _tokenizer, _device
        _device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        weights_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights')
        _model, _tokenizer = load_model(weights_dir)
        _model = _model.to(_device)
        print(f"[GravityBrain Server] Ready on {_device}")

    @app.get("/health")
    async def health():
        return {
            "status": "online",
            "model": "GravityBrain v1.0",
            "parameters": _model.count_parameters() if _model else 0,
            "device": str(_device),
        }

    @app.post("/generate", response_model=GenerateResponse)
    async def generate(req: GenerateRequest):
        if not _model or not _tokenizer:
            return GenerateResponse(text="Model not loaded", tokens_generated=0, time_ms=0)

        start = time.time()

        # Encode prompt
        ids = _tokenizer.encode(req.prompt)
        x = torch.tensor([ids], dtype=torch.long, device=_device)

        # Generate
        with torch.no_grad():
            out = _model.generate(
                x,
                max_new_tokens=req.max_tokens,
                temperature=req.temperature,
                top_k=req.top_k,
            )

        generated_text = _tokenizer.decode(out[0].tolist())
        elapsed_ms = (time.time() - start) * 1000

        return GenerateResponse(
            text=generated_text,
            tokens_generated=len(out[0]) - len(ids),
            time_ms=round(elapsed_ms, 2),
        )

    @app.post("/feedback")
    async def feedback(req: FeedbackRequest):
        feedback_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'feedback')
        save_feedback(feedback_dir, req.message_id, req.reaction, req.message_text)
        return {"status": "saved", "message_id": req.message_id, "reaction": req.reaction}


# =============================================================
#  SIMPLE HTTP FALLBACK (if FastAPI not installed)
# =============================================================
def run_simple_server(host, port, weights_dir):
    """Minimal HTTP server using built-in http.server."""
    from http.server import HTTPServer, BaseHTTPRequestHandler

    device = torch.device('cpu')
    model, tokenizer = load_model(weights_dir)
    model = model.to(device)

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path == '/generate':
                content_length = int(self.headers['Content-Length'])
                body = json.loads(self.rfile.read(content_length))
                
                prompt = body.get('prompt', '')
                max_tokens = body.get('max_tokens', 200)
                
                ids = tokenizer.encode(prompt)
                x = torch.tensor([ids], dtype=torch.long, device=device)
                
                start = time.time()
                with torch.no_grad():
                    out = model.generate(x, max_new_tokens=max_tokens)
                elapsed = (time.time() - start) * 1000
                
                result = {
                    'text': tokenizer.decode(out[0].tolist()),
                    'tokens_generated': len(out[0]) - len(ids),
                    'time_ms': round(elapsed, 2),
                    'model': 'GravityBrain v1.0',
                }
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            else:
                self.send_response(404)
                self.end_headers()

        def do_GET(self):
            if self.path == '/health':
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'online', 'model': 'GravityBrain v1.0'}).encode())

        def do_OPTIONS(self):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

    server = HTTPServer((host, port), Handler)
    print(f"[GravityBrain Server] Simple HTTP mode on http://{host}:{port}")
    server.serve_forever()


# =============================================================
#  MAIN
# =============================================================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='GravityBrain Inference Server')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Server host')
    parser.add_argument('--port', type=int, default=8000, help='Server port')
    args = parser.parse_args()

    weights_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights')

    if HAS_FASTAPI:
        uvicorn.run(app, host=args.host, port=args.port)
    else:
        run_simple_server(args.host, args.port, weights_dir)
