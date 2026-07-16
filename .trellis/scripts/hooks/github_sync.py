#!/usr/bin/env python3
"""GitHub Issue / Project 同步 hook（Trellis 任务生命周期）。

在 task.py 的 after_create / after_start / after_finish / after_archive 中调用。

用法:
    python3 .trellis/scripts/hooks/github_sync.py create
    python3 .trellis/scripts/hooks/github_sync.py start
    python3 .trellis/scripts/hooks/github_sync.py finish
    python3 .trellis/scripts/hooks/github_sync.py archive

环境变量:
    TASK_JSON_PATH  - task.json 绝对路径（由 task.py 注入）

本地配置（gitignore）: .trellis/hooks.local.json
{
  "github": {
    "repo": "swsoyee/gbc-news",
    "project_number": 1,
    "owner": "swsoyee"
  }
}
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def _trellis_dir() -> Path:
    task_json_path = os.environ.get("TASK_JSON_PATH", "")
    if task_json_path:
        return Path(task_json_path).resolve().parent.parent.parent
    return Path(".trellis").resolve()


def _load_config() -> dict:
    config_path = _trellis_dir() / "hooks.local.json"
    try:
        with open(config_path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _read_task() -> tuple[dict, Path]:
    path = os.environ.get("TASK_JSON_PATH", "")
    if not path:
        print("TASK_JSON_PATH not set", file=sys.stderr)
        sys.exit(1)
    task_path = Path(path)
    with open(task_path, encoding="utf-8") as f:
        return json.load(f), task_path


def _run_gh(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["gh", *args],
        check=False,
        text=True,
        capture_output=True,
    )


def _repo(cfg: dict) -> str:
    return cfg.get("github", {}).get("repo", "swsoyee/gbc-news")


def _write_meta(task: dict, task_path: Path) -> None:
    with open(task_path, "w", encoding="utf-8") as f:
        json.dump(task, f, ensure_ascii=False, indent=2)
        f.write("\n")


def create_issue(task: dict, task_path: Path, cfg: dict) -> None:
    meta = task.setdefault("meta", {})
    if meta.get("github_issue_url"):
        print(f"Issue already linked: {meta['github_issue_url']}")
        return

    title = task.get("title") or task.get("name") or "untitled"
    task_name = task.get("name") or task_path.parent.name
    body = f"""## Trellis 任务

- 任务目录: `.trellis/tasks/{task_name}/`
- PRD: `.trellis/tasks/{task_name}/prd.md`
- 优先级: `{task.get("priority", "P2")}`
- 类型: `{task.get("dev_type", "unknown")}`

请在实现过程中同步更新本 Issue 与 Project 状态。
"""

    result = _run_gh(
        [
            "issue",
            "create",
            "--repo",
            _repo(cfg),
            "--title",
            str(title),
            "--body",
            body,
        ]
    )
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        sys.exit(result.returncode)

    url = (result.stdout or "").strip()
    meta["github_issue_url"] = url
    _write_meta(task, task_path)
    print(f"Created issue: {url}")

    project_number = cfg.get("github", {}).get("project_number")
    owner = cfg.get("github", {}).get("owner")
    if project_number and owner and url:
        add = _run_gh(
            [
                "project",
                "item-add",
                str(project_number),
                "--owner",
                str(owner),
                "--url",
                url,
            ]
        )
        if add.returncode != 0:
            print(
                f"Warning: failed to add issue to project: {add.stderr or add.stdout}",
                file=sys.stderr,
            )
        else:
            print(f"Added to project #{project_number}")


def set_issue_state(task: dict, state: str) -> None:
    url = (task.get("meta") or {}).get("github_issue_url")
    if not url:
        print("No github_issue_url in task.meta; skip")
        return

    # gh issue edit 需要编号或 url
    result = _run_gh(["issue", "edit", url, "--add-label", state])
    if result.returncode != 0:
        # 标签可能不存在：退化为评论
        comment = {
            "in_progress": "状态同步：开始处理（In Progress）",
            "done": "状态同步：已完成（Done）",
        }.get(state, f"状态同步：{state}")
        _run_gh(["issue", "comment", url, "--body", comment])
        print(f"Commented on issue ({state})")
        return
    print(f"Labeled issue: {state}")


def close_issue(task: dict) -> None:
    url = (task.get("meta") or {}).get("github_issue_url")
    if not url:
        print("No github_issue_url in task.meta; skip")
        return
    result = _run_gh(["issue", "close", url, "--reason", "completed"])
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        sys.exit(result.returncode)
    print(f"Closed issue: {url}")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: github_sync.py <create|start|finish|archive>", file=sys.stderr)
        sys.exit(2)

    action = sys.argv[1]
    cfg = _load_config()
    task, task_path = _read_task()

    if action == "create":
        create_issue(task, task_path, cfg)
    elif action == "start":
        set_issue_state(task, "in_progress")
    elif action in {"finish", "archive"}:
        set_issue_state(task, "done")
        close_issue(task)
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
