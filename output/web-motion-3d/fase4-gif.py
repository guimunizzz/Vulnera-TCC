"""Monta o GIF da rolagem a partir dos quadros de fase4-gif.cjs (Pillow)."""
import sys
from pathlib import Path
from PIL import Image

pasta, saida = Path(sys.argv[1]), sys.argv[2]
quadros = [Image.open(p).convert("RGB").resize((720, 450), Image.LANCZOS) for p in sorted(pasta.glob("q*.png"))]
paleta = [q.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for q in quadros]
paleta[0].save(saida, save_all=True, append_images=paleta[1:], duration=110, loop=0, optimize=True)
print(len(quadros), "quadros ->", saida, round(Path(saida).stat().st_size / 1e6, 2), "MB")
