"""Read-only diagnostics for Codacy's UTF-8 SARIF formatter failure.

A candidate is not necessarily an analyzed file or the cause of the failure.
Never exclude, transcode or otherwise change the checked-out scanner input.
"""
import codecs
import json
import os
from pathlib import Path
import stat
import subprocess


def index_entries(raw):
    for record in raw.split(b"\0"):
        if not record:
            continue
        metadata, path = record.split(b"\t", 1)
        mode, _, stage = metadata.split()
        if stage != b"0":
            raise ValueError("Cannot diagnose an unmerged Git index")
        yield mode, os.fsdecode(path)


def classify(root, mode, path):
    if mode == b"120000":
        return "tracked-symlink"
    if mode == b"160000":
        return "tracked-gitlink"
    if mode not in (b"100644", b"100755"):
        return "unexpected-index-mode"
    candidate = root / path
    try:
        if not stat.S_ISREG(candidate.lstat().st_mode):
            return "not-regular-checkout-file"
        decoder = codecs.getincrementaldecoder("utf-8")(errors="strict")
        with candidate.open("rb") as stream:
            while chunk := stream.read(65536):
                decoder.decode(chunk, final=False)
            decoder.decode(b"", final=True)
    except UnicodeDecodeError:
        return "non-utf8"
    except OSError:
        return "unreadable"
    return "utf8"


def diagnose(root, entries, output):
    counts = {}
    for mode, path in entries:
        status = classify(root, mode, path)
        counts[status] = counts.get(status, 0) + 1
        if status != "utf8":
            # Escape control characters in untrusted filenames; never print file contents.
            print("Codacy input candidate: " + json.dumps(
                {"path": path, "status": status}, ensure_ascii=True), file=output)
    print("Codacy input inventory: " + json.dumps(counts, sort_keys=True), file=output)
    return counts


def correlate_issues(root, entries, results, output):
    """Match issue filenames only against the Git index; never open reported paths.

    The pinned JSON formatter serializes a sealed Result type. Other variants
    (metrics and clones) are not issue locations. A partial result is only a clue,
    even if an issue points to a file the SARIF formatter cannot decode.
    """
    if not isinstance(results, list):
        raise ValueError("Expected a Codacy JSON result array")
    tracked = {path: mode for mode, path in entries}
    matched = set()
    counts = {"issues": 0, "unmatched": 0, "non-issue-records": 0}
    for result in results:
        issue = result.get("Issue") if isinstance(result, dict) else None
        if not isinstance(issue, dict):
            counts["non-issue-records"] += 1
            continue
        counts["issues"] += 1
        filename = issue.get("filename")
        if not isinstance(filename, str):
            counts["unmatched"] += 1
            continue
        # No path normalization or filesystem access based on analyzer input.
        # Accept only exact tracked paths, optionally with the checkout prefix.
        if filename.startswith(str(root) + "/"):
            filename = filename[len(str(root)) + 1:]
        if filename.startswith("./"):
            filename = filename[2:]
        if filename not in tracked:
            counts["unmatched"] += 1
            continue
        matched.add(filename)
    candidates = 0
    for path in sorted(matched):
        status = classify(root, tracked[path], path)
        if status != "utf8":
            candidates += 1
            print("Codacy issue encoding candidate: " + json.dumps(
                {"path": path, "status": status}, ensure_ascii=True), file=output)
    counts["distinct-tracked-paths"] = len(matched)
    counts["encoding-or-access-candidates"] = candidates
    print("Codacy issue correlation (diagnostic only): " + json.dumps(counts, sort_keys=True), file=output)
    return counts


if __name__ == "__main__":
    import sys
    root = Path.cwd()
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    if head != os.environ["GITHUB_SHA"]:
        raise SystemExit("Codacy diagnostic checkout does not match the event commit")
    print("Codacy diagnostic source commit: " + head)
    entries = subprocess.check_output(["git", "ls-files", "--stage", "-z"], cwd=root)
    if len(sys.argv) == 3 and sys.argv[1] == "--correlate":
        # A killed scanner may have left a partial or invalid JSON report.
        # Never print parser exception text or raw data.
        try:
            report = Path(sys.argv[2])
            if report.stat().st_size > 64 * 1024 * 1024:
                raise ValueError("Diagnostic size limit exceeded")
            with report.open("r", encoding="utf-8") as stream:
                results = json.load(stream)
            correlate_issues(root, index_entries(entries), results, sys.stdout)
        except (OSError, ValueError, RecursionError):
            raise SystemExit("Codacy JSON diagnostic unavailable or invalid; no correlation established") from None
    elif len(sys.argv) == 1:
        diagnose(root, index_entries(entries), sys.stdout)
    else:
        raise SystemExit("Unexpected diagnostic arguments")
