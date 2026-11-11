import sys
from pathlib import Path

# Rend « app » importable depuis backend/ (les modules testés sont sans dépendance web)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
