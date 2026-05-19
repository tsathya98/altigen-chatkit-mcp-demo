"""Create (or refresh) the OpenAI Vector Store that powers RAG for the demo.

Run once after seeding the DB:
    uv run python scripts/bootstrap_vector_store.py

The resulting vector-store ID is written to `data/vector_store_id.txt` and
read at runtime by the chat backend.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "data" / "docs"
ID_FILE = ROOT / "data" / "vector_store_id.txt"
STORE_NAME = "altigen-pharma-knowledge"


def main() -> None:
    load_dotenv(ROOT / ".env")
    if not os.getenv("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY missing — populate .env first.")
    if not DOCS_DIR.exists():
        sys.exit(f"No docs at {DOCS_DIR} — run scripts/seed.py first.")

    client = OpenAI()
    files = sorted(DOCS_DIR.glob("*.md"))
    if not files:
        sys.exit(f"No markdown docs in {DOCS_DIR}.")

    print(f"Creating vector store '{STORE_NAME}' from {len(files)} docs…")
    vs = client.vector_stores.create(name=STORE_NAME)
    handles = [open(p, "rb") for p in files]
    try:
        client.vector_stores.file_batches.upload_and_poll(
            vector_store_id=vs.id,
            files=handles,
        )
    finally:
        for h in handles:
            h.close()

    ID_FILE.write_text(vs.id, encoding="utf-8")
    print(f"Vector store ready: {vs.id}")
    print(f"Wrote ID to {ID_FILE}")


if __name__ == "__main__":
    main()
