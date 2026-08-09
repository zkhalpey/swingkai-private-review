#!/usr/bin/env python3
"""Generate deterministic SwingKai PWA icons without external dependencies."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "icons"


def blend(base: tuple[int, int, int], top: tuple[int, int, int], alpha: float) -> tuple[int, int, int]:
    return (
        round(base[0] * (1 - alpha) + top[0] * alpha),
        round(base[1] * (1 - alpha) + top[1] * alpha),
        round(base[2] * (1 - alpha) + top[2] * alpha),
    )


def pixel(size: int, x: int, y: int) -> tuple[int, int, int, int]:
    nx = (x + 0.5) / size
    ny = (y + 0.5) / size
    distance = math.hypot(nx - 0.44, ny - 0.34)
    base = blend((7, 18, 34), (37, 86, 142), max(0.0, 1.0 - distance / 0.75) * 0.72)

    cx, cy = 0.5, 0.5
    radius = math.hypot(nx - cx, ny - cy)
    for ring, width, alpha in ((0.35, 0.010, 0.34), (0.27, 0.008, 0.24)):
        if abs(radius - ring) < width:
            base = blend(base, (167, 207, 232), alpha)

    if radius < 0.145:
        base = blend((18, 45, 85), (42, 73, 111), max(0.0, 1.0 - radius / 0.145))

    # Motion needle, angled upward to the right.
    ax, ay, bx, by = 0.50, 0.50, 0.69, 0.29
    vx, vy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((nx - ax) * vx + (ny - ay) * vy) / (vx * vx + vy * vy)))
    px, py = ax + t * vx, ay + t * vy
    if math.hypot(nx - px, ny - py) < 0.016 and t > 0.05:
        base = (240, 248, 255)

    if radius < 0.038:
        base = (167, 207, 232)
    return (*base, 255)


def write_png(path: Path, size: int) -> None:
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row.extend(pixel(size, x, y))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for filename, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
        write_png(ROOT / filename, size)
        print(f"generated {filename} ({size}x{size})")


if __name__ == "__main__":
    main()
