"""Run the 2-player browser regression against an isolated local game server."""
from pathlib import Path
import subprocess
import sys


if __name__ == '__main__':
    suite = Path(__file__).resolve().parent / 'tests' / 'verify-online-match-browser.py'
    raise SystemExit(subprocess.call([sys.executable, str(suite), '--players', '2', *sys.argv[1:]]))
