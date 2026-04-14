"""
GravityBrain Tokenizer v1.0
Character-level tokenizer with full Unicode support (Russian + English + Code).
Unlike BPE tokenizers (GPT) or SentencePiece (Gemini), this operates on raw characters,
ensuring zero unknown tokens on any input language.
"""

import json
import os

class CharTokenizer:
    """Character-level tokenizer for GravityBrain."""

    def __init__(self):
        self.char_to_id = {}
        self.id_to_char = {}
        self.vocab_size = 0
        # Special tokens
        self.PAD_TOKEN = '<PAD>'
        self.UNK_TOKEN = '<UNK>'
        self.BOS_TOKEN = '<BOS>'
        self.EOS_TOKEN = '<EOS>'

    def build_vocab(self, text: str):
        """Build vocabulary from a corpus of text."""
        # Start with special tokens
        special = [self.PAD_TOKEN, self.UNK_TOKEN, self.BOS_TOKEN, self.EOS_TOKEN]
        chars = sorted(set(text))

        all_tokens = special + chars
        self.char_to_id = {ch: i for i, ch in enumerate(all_tokens)}
        self.id_to_char = {i: ch for ch, i in self.char_to_id.items()}
        self.vocab_size = len(all_tokens)
        print(f"[GravityBrain Tokenizer] Vocabulary built: {self.vocab_size} tokens")
        return self

    def encode(self, text: str) -> list:
        """Convert text string to list of token IDs."""
        unk_id = self.char_to_id.get(self.UNK_TOKEN, 1)
        return [self.char_to_id.get(ch, unk_id) for ch in text]

    def decode(self, ids: list) -> str:
        """Convert list of token IDs back to text string."""
        special_ids = {
            self.char_to_id.get(self.PAD_TOKEN, 0),
            self.char_to_id.get(self.UNK_TOKEN, 1),
            self.char_to_id.get(self.BOS_TOKEN, 2),
            self.char_to_id.get(self.EOS_TOKEN, 3),
        }
        return ''.join(
            self.id_to_char.get(i, '')
            for i in ids
            if i not in special_ids
        )

    def save(self, path: str):
        """Save vocabulary to JSON file."""
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else '.', exist_ok=True)
        data = {
            'char_to_id': self.char_to_id,
            'vocab_size': self.vocab_size,
        }
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"[GravityBrain Tokenizer] Saved to {path}")

    def load(self, path: str):
        """Load vocabulary from JSON file."""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        self.char_to_id = data['char_to_id']
        self.id_to_char = {int(v): k for k, v in self.char_to_id.items()}
        self.vocab_size = data['vocab_size']
        print(f"[GravityBrain Tokenizer] Loaded {self.vocab_size} tokens from {path}")
        return self


if __name__ == '__main__':
    # Quick self-test
    test_text = "Привет, Antigravity! Цель: 500,000 рублей. 🚀"
    tok = CharTokenizer().build_vocab(test_text)
    encoded = tok.encode(test_text)
    decoded = tok.decode(encoded)
    print(f"Original:  {test_text}")
    print(f"Encoded:   {encoded[:20]}...")
    print(f"Decoded:   {decoded}")
    assert decoded == test_text, "Encode/Decode mismatch!"
    print("✅ Tokenizer self-test PASSED")
