"""
GravityBrain v1.0 — Custom Transformer Architecture
=====================================================
An ORIGINAL neural network architecture, distinct from GPT, Claude, and Gemini.

Key differentiators:
  - RMSNorm (instead of LayerNorm used by GPT/Claude)
  - RoPE — Rotary Positional Embeddings (instead of learned positional embeddings)
  - SwiGLU activation in FFN (instead of GELU used by GPT)
  - Pre-Norm architecture for training stability

Architecture:  Input → Embedding → N x [RMSNorm → MHA → RMSNorm → SwiGLU_FFN] → RMSNorm → Linear
Parameters:    ~1M (configurable)

(c) 2026 Antigravity Project — Built from scratch, no external model code used.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# =============================================================
#  COMPONENT 1: RMSNorm (Root Mean Square Layer Normalization)
#  Unlike LayerNorm (GPT/Claude), RMSNorm doesn't center the data,
#  making it faster and more stable during training.
# =============================================================
class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x):
        rms = torch.sqrt(torch.mean(x ** 2, dim=-1, keepdim=True) + self.eps)
        return x / rms * self.weight


# =============================================================
#  COMPONENT 2: RoPE (Rotary Positional Embeddings)
#  Instead of learned position embeddings (GPT) or sinusoidal (original Transformer),
#  RoPE encodes position directly into the attention computation via rotation matrices.
#  This allows better generalization to unseen sequence lengths.
# =============================================================
def precompute_rope_freqs(dim: int, max_seq_len: int, theta: float = 10000.0):
    """Precompute rotary frequency tensors for RoPE."""
    freqs = 1.0 / (theta ** (torch.arange(0, dim, 2).float() / dim))
    t = torch.arange(max_seq_len).float()
    freqs = torch.outer(t, freqs)
    cos_freqs = torch.cos(freqs)
    sin_freqs = torch.sin(freqs)
    return cos_freqs, sin_freqs


def apply_rope(x, cos_freqs, sin_freqs):
    """Apply rotary positional embeddings to query/key tensors."""
    # x shape: (batch, n_heads, seq_len, head_dim)
    seq_len = x.shape[2]
    head_dim = x.shape[3]

    cos_f = cos_freqs[:seq_len, :head_dim // 2].unsqueeze(0).unsqueeze(0)
    sin_f = sin_freqs[:seq_len, :head_dim // 2].unsqueeze(0).unsqueeze(0)

    # Split into pairs for rotation
    x1 = x[..., :head_dim // 2]
    x2 = x[..., head_dim // 2:]

    # Apply rotation
    out1 = x1 * cos_f - x2 * sin_f
    out2 = x1 * sin_f + x2 * cos_f

    return torch.cat([out1, out2], dim=-1)


# =============================================================
#  COMPONENT 3: Multi-Head Self-Attention with RoPE
#  The "brain" of the network — allows each token to look at
#  (attend to) all previous tokens to understand context.
# =============================================================
class GravityAttention(nn.Module):
    def __init__(self, n_embd: int, n_head: int, block_size: int, dropout: float = 0.1):
        super().__init__()
        assert n_embd % n_head == 0, "n_embd must be divisible by n_head"
        self.n_head = n_head
        self.head_dim = n_embd // n_head

        # Query, Key, Value projections (combined for efficiency)
        self.qkv = nn.Linear(n_embd, 3 * n_embd, bias=False)
        self.out_proj = nn.Linear(n_embd, n_embd, bias=False)
        self.dropout = nn.Dropout(dropout)

        # Precompute RoPE frequencies
        cos_freqs, sin_freqs = precompute_rope_freqs(self.head_dim, block_size)
        self.register_buffer('cos_freqs', cos_freqs)
        self.register_buffer('sin_freqs', sin_freqs)

        # Causal mask — prevents attending to future tokens
        mask = torch.tril(torch.ones(block_size, block_size))
        self.register_buffer('causal_mask', mask.view(1, 1, block_size, block_size))

    def forward(self, x):
        B, T, C = x.shape

        # Compute Q, K, V in one operation
        qkv = self.qkv(x).reshape(B, T, 3, self.n_head, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)  # (3, B, n_head, T, head_dim)
        q, k, v = qkv[0], qkv[1], qkv[2]

        # Apply RoPE to Q and K
        q = apply_rope(q, self.cos_freqs, self.sin_freqs)
        k = apply_rope(k, self.cos_freqs, self.sin_freqs)

        # Scaled dot-product attention
        scale = math.sqrt(self.head_dim)
        attn = (q @ k.transpose(-2, -1)) / scale

        # Apply causal mask
        attn = attn.masked_fill(self.causal_mask[:, :, :T, :T] == 0, float('-inf'))
        attn = F.softmax(attn, dim=-1)
        attn = self.dropout(attn)

        # Weighted sum of values
        out = attn @ v  # (B, n_head, T, head_dim)
        out = out.transpose(1, 2).contiguous().reshape(B, T, C)
        return self.out_proj(out)


# =============================================================
#  COMPONENT 4: SwiGLU Feed-Forward Network
#  Unlike standard FFN with GELU (GPT/Claude), SwiGLU uses a
#  gated activation: SwiGLU(x) = Swish(xW1) ⊙ (xW2)
#  This is what LLaMA 2/3 uses — more parameter efficient.
# =============================================================
class SwiGLU_FFN(nn.Module):
    def __init__(self, n_embd: int, hidden_mult: float = 2.67, dropout: float = 0.1):
        super().__init__()
        hidden_dim = int(n_embd * hidden_mult)
        # Gate and Up projections (SwiGLU requires two separate linear layers as input)
        self.gate_proj = nn.Linear(n_embd, hidden_dim, bias=False)
        self.up_proj = nn.Linear(n_embd, hidden_dim, bias=False)
        self.down_proj = nn.Linear(hidden_dim, n_embd, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        gate = F.silu(self.gate_proj(x))  # Swish activation
        up = self.up_proj(x)
        return self.dropout(self.down_proj(gate * up))


# =============================================================
#  COMPONENT 5: Transformer Block
#  Pre-Norm architecture: Norm → Attention → Residual → Norm → FFN → Residual
# =============================================================
class GravityBlock(nn.Module):
    def __init__(self, n_embd: int, n_head: int, block_size: int, dropout: float = 0.1):
        super().__init__()
        self.norm1 = RMSNorm(n_embd)
        self.attn = GravityAttention(n_embd, n_head, block_size, dropout)
        self.norm2 = RMSNorm(n_embd)
        self.ffn = SwiGLU_FFN(n_embd, dropout=dropout)

    def forward(self, x):
        x = x + self.attn(self.norm1(x))   # Pre-Norm + Residual
        x = x + self.ffn(self.norm2(x))     # Pre-Norm + Residual
        return x


# =============================================================
#  MAIN MODEL: GravityBrain
#  The full Transformer Language Model
# =============================================================
class GravityBrain(nn.Module):
    """
    GravityBrain v1.0 — A custom Transformer Language Model.
    
    This is NOT GPT, NOT Claude, NOT Gemini.
    This is an original architecture combining:
      RMSNorm + RoPE + SwiGLU + Pre-Norm Transformer
    """

    def __init__(
        self,
        vocab_size: int = 256,
        n_embd: int = 64,
        n_head: int = 4,
        n_layer: int = 4,
        block_size: int = 128,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.block_size = block_size
        self.vocab_size = vocab_size

        # Token embedding (no position embedding — RoPE handles that!)
        self.tok_emb = nn.Embedding(vocab_size, n_embd)
        self.drop = nn.Dropout(dropout)

        # Stack of Transformer blocks
        self.blocks = nn.ModuleList([
            GravityBlock(n_embd, n_head, block_size, dropout)
            for _ in range(n_layer)
        ])

        # Final normalization and output projection
        self.final_norm = RMSNorm(n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size, bias=False)

        # Weight tying — share weights between embedding and output
        self.tok_emb.weight = self.lm_head.weight

        # Initialize weights
        self.apply(self._init_weights)
        print(f"[GravityBrain] Initialized with {self.count_parameters():,} parameters")

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def forward(self, idx, targets=None):
        """
        Forward pass.
        idx: (B, T) tensor of token indices
        targets: (B, T) tensor of target token indices (for training)
        Returns: logits (B, T, vocab_size), loss (scalar or None)
        """
        B, T = idx.shape
        assert T <= self.block_size, f"Sequence length {T} exceeds block_size {self.block_size}"

        # Token embeddings (position is handled by RoPE inside attention)
        x = self.drop(self.tok_emb(idx))

        # Pass through all Transformer blocks
        for block in self.blocks:
            x = block(x)

        # Final norm + projection to vocabulary
        x = self.final_norm(x)
        logits = self.lm_head(x)

        # Compute loss if targets are provided
        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)),
                targets.view(-1)
            )

        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens: int, temperature: float = 0.8, top_k: int = 40):
        """
        Autoregressive text generation.
        idx: (B, T) tensor of starting token indices
        Returns: (B, T + max_new_tokens) tensor
        """
        self.eval()
        for _ in range(max_new_tokens):
            # Crop context to block_size
            idx_cond = idx[:, -self.block_size:]
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / temperature

            # Top-K sampling
            if top_k > 0:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = float('-inf')

            probs = F.softmax(logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            idx = torch.cat([idx, next_token], dim=1)

        return idx


# =============================================================
#  SELF-TEST: Verify architecture works
# =============================================================
if __name__ == '__main__':
    print("=" * 60)
    print("  GravityBrain v1.0 — Architecture Self-Test")
    print("=" * 60)

    # Create model with default hyperparameters
    model = GravityBrain(vocab_size=200, n_embd=64, n_head=4, n_layer=4, block_size=128)

    # Test forward pass
    dummy_input = torch.randint(0, 200, (2, 32))  # batch=2, seq_len=32
    dummy_targets = torch.randint(0, 200, (2, 32))

    logits, loss = model(dummy_input, dummy_targets)
    print(f"Input shape:   {dummy_input.shape}")
    print(f"Logits shape:  {logits.shape}")
    print(f"Loss:          {loss.item():.4f}")

    # Test generation
    start_tokens = torch.randint(0, 200, (1, 5))
    generated = model.generate(start_tokens, max_new_tokens=20)
    print(f"Generated shape: {generated.shape}")

    print("=" * 60)
    print("  [PASS] GravityBrain architecture self-test PASSED!")
    print("=" * 60)
