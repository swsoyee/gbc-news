#!/usr/bin/env python3
"""Deny git commit shell commands when npm run precommit fails."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path


COMMIT_RE = re.compile(r"(^|[;&|]\s*|\n\s*)git\s+commit\b")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print(json.dumps({"permission": "allow"}))
        return 0

    command = str(payload.get("command") or "")
    if not COMMIT_RE.search(command):
        print(json.dumps({"permission": "allow"}))
        return 0

    root = Path.cwd()
    result = subprocess.run(
        ["npm", "run", "precommit"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(json.dumps({"permission": "allow"}))
        return 0

    details = (result.stdout or "") + (result.stderr or "")
    details = details.strip()
    if len(details) > 4000:
        details = details[-4000:]

    message = (
        "commit 已拦截：`npm run precommit`（lint + format:check）未通过。"
        "请先修复后再 commit。\n\n"
        f"{details}"
    )
    print(
        json.dumps(
            {
                "permission": "deny",
                "user_message": "Commit blocked: lint/format checks failed.",
                "agent_message": message,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
