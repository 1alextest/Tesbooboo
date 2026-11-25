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


if __name__ == "__main__":
    import sys
    root = Path.cwd()
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    if head != os.environ["GITHUB_SHA"]:
        raise SystemExit("Codacy diagnostic checkout does not match the event commit")
    print("Codacy diagnostic source commit: " + head)
    entries = subprocess.check_output(["git", "ls-files", "--stage", "-z"], cwd=root)
    diagnose(root, index_entries(entries), sys.stdout)
