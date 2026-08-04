#!/usr/bin/env python3
"""Small env loader for local scripts.

Loads key=value pairs from .env.local / .env.production / .env when present,
without overriding variables already set by the shell/CI.
"""
from __future__ import annotations

import os
from pathlib import Path


def load_local_env() -> None:
    root = Path(__file__).resolve().parents[1]
    for name in (".env.local", ".env.production", ".env"):
        path = root / name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
