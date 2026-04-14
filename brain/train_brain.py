"""
GravityBrain Training Script v1.0
==================================
Trains the GravityBrain Transformer on local text data.
Outputs progress bars, loss charts, and sample generations.

Usage:
    python train_brain.py                          # Train with defaults
    python train_brain.py --epochs 5 --lr 3e-4     # Custom hyperparameters
    python train_brain.py --max_steps 100           # Quick smoke test
"""

import argparse
import glob
import math
import os
import sys
import time

import torch
from torch.utils.data import Dataset, DataLoader

# Import our custom modules
from tokenizer import CharTokenizer
from gravity_model import GravityBrain


# =============================================================
#  TEXT DATASET
# =============================================================
class TextDataset(Dataset):
    """Character-level dataset that creates sliding windows over text."""

    def __init__(self, data: torch.Tensor, block_size: int):
        self.data = data
        self.block_size = block_size

    def __len__(self):
        return max(0, len(self.data) - self.block_size - 1)

    def __getitem__(self, idx):
        x = self.data[idx: idx + self.block_size]
        y = self.data[idx + 1: idx + self.block_size + 1]
        return x, y


# =============================================================
#  LOAD ALL TRAINING DATA
# =============================================================
def load_corpus(data_dir: str) -> str:
    """Load all .txt and .md files from data directory."""
    corpus = ""
    patterns = ['*.txt', '*.md']
    for pattern in patterns:
        for filepath in glob.glob(os.path.join(data_dir, pattern)):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                corpus += content + "\n\n"
                print(f"  📄 Loaded: {os.path.basename(filepath)} ({len(content):,} chars)")

    if not corpus.strip():
        print("  ⚠️  No training data found! Creating default corpus...")
        corpus = create_default_corpus(data_dir)

    return corpus


def create_default_corpus(data_dir: str) -> str:
    """Create a default training corpus if none exists."""
    default_text = """
Antigravity — это система нового поколения для достижения финансовых целей.
Наша главная цель — 500,000 рублей к 31 августа через контент-автоматизацию.

Стратегия монетизации:
1. YouTube Shorts — короткие вирусные видео о саморазвитии и дисциплине
2. TikTok — адаптация контента для молодой аудитории
3. Instagram Reels — визуально насыщенный контент
4. Telegram — основной хаб монетизации и трафика

Ключевые принципы работы:
- Каждое действие должно приближать к цели в 500к рублей
- Контент создается ежедневно, без выходных
- Качество важнее количества, но скорость критична
- AI-автоматизация — наше конкурентное преимущество

Antigravity не просто инструмент. Это философия движения вперёд.
Гравитация тянет вниз — мы движемся вверх. Всегда.

Content Strategy Framework:
- Hook в первые 3 секунды видео
- Проблема → Решение → Призыв к действию
- Музыка и визуал синхронизированы для максимального вовлечения
- A/B тестирование заголовков каждую неделю

Финансовый трекер:
- Цель: 500,000 RUB
- Дедлайн: 31 августа
- Источники: AdSense, партнёрки, донаты, спонсорства
- Минимальная дневная выручка для достижения цели: ~3,500 RUB

Мотивация:
Дисциплина побеждает мотивацию. Каждый день — это возможность стать лучше.
Не жди идеального момента. Создай его. Antigravity — это ты в движении.
Успех — не финальная точка. Это процесс, который никогда не останавливается.
"""
    os.makedirs(data_dir, exist_ok=True)
    filepath = os.path.join(data_dir, 'antigravity_corpus.txt')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(default_text)
    print(f"  ✅ Created default corpus: {filepath}")
    return default_text


# =============================================================
#  TRAINING LOOP
# =============================================================
def train(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"\n{'='*60}")
    print(f"  🧠 GravityBrain Training v1.0")
    print(f"  Device: {device}")
    print(f"{'='*60}\n")

    # --- 1. Load Data ---
    print("[Phase 1] Loading training corpus...")
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    corpus = load_corpus(data_dir)
    print(f"  Total corpus size: {len(corpus):,} characters\n")

    # --- 2. Build Tokenizer ---
    print("[Phase 2] Building tokenizer...")
    tokenizer = CharTokenizer().build_vocab(corpus)

    # Save tokenizer for inference
    weights_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights')
    os.makedirs(weights_dir, exist_ok=True)
    tokenizer.save(os.path.join(weights_dir, 'tokenizer.json'))

    # Encode full corpus
    encoded = tokenizer.encode(corpus)
    data = torch.tensor(encoded, dtype=torch.long)
    print(f"  Encoded length: {len(data):,} tokens\n")

    # --- 3. Create Dataset ---
    print("[Phase 3] Creating dataset...")
    dataset = TextDataset(data, args.block_size)
    dataloader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        drop_last=True,
        num_workers=0,
    )
    print(f"  Dataset size: {len(dataset):,} samples")
    print(f"  Batches per epoch: {len(dataloader):,}\n")

    # --- 4. Create Model ---
    print("[Phase 4] Initializing GravityBrain...")
    model = GravityBrain(
        vocab_size=tokenizer.vocab_size,
        n_embd=args.n_embd,
        n_head=args.n_head,
        n_layer=args.n_layer,
        block_size=args.block_size,
        dropout=args.dropout,
    ).to(device)

    # --- 5. Optimizer & Scheduler ---
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=0.01,
        betas=(0.9, 0.95),
    )
    total_steps = min(args.max_steps, len(dataloader) * args.epochs) if args.max_steps else len(dataloader) * args.epochs
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=total_steps)

    # --- 6. Training ---
    print(f"\n[Phase 5] Training for {args.epochs} epoch(s), max {total_steps} steps...")
    print(f"{'─'*60}")

    global_step = 0
    best_loss = float('inf')
    start_time = time.time()

    for epoch in range(1, args.epochs + 1):
        model.train()
        epoch_loss = 0
        epoch_steps = 0

        for batch_idx, (x, y) in enumerate(dataloader):
            if args.max_steps and global_step >= args.max_steps:
                break

            x, y = x.to(device), y.to(device)
            logits, loss = model(x, y)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()

            epoch_loss += loss.item()
            epoch_steps += 1
            global_step += 1

            # Progress bar
            if global_step % 5 == 0 or global_step == 1:
                elapsed = time.time() - start_time
                steps_per_sec = global_step / elapsed if elapsed > 0 else 0
                avg_loss = epoch_loss / epoch_steps
                lr_now = scheduler.get_last_lr()[0]

                bar_len = 30
                progress = global_step / total_steps
                filled = int(bar_len * progress)
                bar = '█' * filled + '░' * (bar_len - filled)

                sys.stdout.write(
                    f"\r  [{bar}] Step {global_step}/{total_steps} | "
                    f"Loss: {avg_loss:.4f} | LR: {lr_now:.2e} | "
                    f"{steps_per_sec:.1f} steps/s"
                )
                sys.stdout.flush()

            # Generate sample every N steps
            if global_step % args.sample_every == 0:
                print(f"\n\n  📝 Sample at step {global_step}:")
                sample = generate_sample(model, tokenizer, device, "Antigravity", 100)
                print(f"  \"{sample}\"\n")

        # End of epoch
        avg_epoch_loss = epoch_loss / max(epoch_steps, 1)
        print(f"\n  ✅ Epoch {epoch}/{args.epochs} complete | Avg Loss: {avg_epoch_loss:.4f}")

        # Save best model
        if avg_epoch_loss < best_loss:
            best_loss = avg_epoch_loss
            checkpoint = {
                'model_state': model.state_dict(),
                'vocab_size': tokenizer.vocab_size,
                'n_embd': args.n_embd,
                'n_head': args.n_head,
                'n_layer': args.n_layer,
                'block_size': args.block_size,
                'loss': best_loss,
            }
            save_path = os.path.join(weights_dir, 'gravity_brain.pt')
            torch.save(checkpoint, save_path)
            print(f"  💾 Model saved to {save_path} (loss: {best_loss:.4f})")

        if args.max_steps and global_step >= args.max_steps:
            break

    # --- 7. Final Generation ---
    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"  Training complete in {total_time:.1f}s")
    print(f"  Best loss: {best_loss:.4f}")
    print(f"{'='*60}")

    print("\n  🎯 Final generation samples:")
    for prompt in ["Antigravity", "500", "Контент", "Цель"]:
        sample = generate_sample(model, tokenizer, device, prompt, 120)
        print(f"\n  Prompt: \"{prompt}\"")
        print(f"  Output: \"{sample}\"")

    print(f"\n{'='*60}")
    print(f"  ✅ GravityBrain is ready! Run server.py to serve it.")
    print(f"{'='*60}\n")


def generate_sample(model, tokenizer, device, prompt: str, max_tokens: int = 100) -> str:
    """Generate text from a prompt."""
    model.eval()
    ids = tokenizer.encode(prompt)
    x = torch.tensor([ids], dtype=torch.long, device=device)
    with torch.no_grad():
        out = model.generate(x, max_new_tokens=max_tokens, temperature=0.8, top_k=40)
    return tokenizer.decode(out[0].tolist())


# =============================================================
#  CLI
# =============================================================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train GravityBrain v1.0')
    parser.add_argument('--epochs', type=int, default=3, help='Number of training epochs')
    parser.add_argument('--lr', type=float, default=3e-4, help='Learning rate')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--block_size', type=int, default=128, help='Context window size')
    parser.add_argument('--n_embd', type=int, default=64, help='Embedding dimension')
    parser.add_argument('--n_head', type=int, default=4, help='Number of attention heads')
    parser.add_argument('--n_layer', type=int, default=4, help='Number of transformer layers')
    parser.add_argument('--dropout', type=float, default=0.1, help='Dropout probability')
    parser.add_argument('--max_steps', type=int, default=None, help='Max training steps (for testing)')
    parser.add_argument('--sample_every', type=int, default=50, help='Generate sample every N steps')

    args = parser.parse_args()
    train(args)
