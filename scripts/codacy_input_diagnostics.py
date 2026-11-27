"""Read-only diagnostics for Codacy's UTF-8 SARIF formatter failure.

A candidate is not necessarily an analyzed file or the cause of the failure.
Never exclude, transcode or otherwise change the checked-out scanner input.
"""
import codecs
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess


def assert_clean_checkout(root, expected):
    """Check event identity and persistent checkout changes without logging paths."""
    head = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=root, text=True
    ).strip()
    if head != expected:
        raise ValueError("Codacy checkout does not match the event commit")
    # Git status honors assume-unchanged and skip-worktree, so a clean
    # result alone cannot establish persistent tracked-file integrity.
    flags = subprocess.check_output(["git", "ls-files", "-v", "-z"], cwd=root)
    for record in flags.split(b"\0"):
        if record and not record.startswith(b"H "):
            raise ValueError("Codacy checkout contains concealing index flags or nonordinary entries")
    status = subprocess.check_output([
        "git", "status", "--porcelain=v1", "-z", "--untracked-files=all",
        "--ignored=matching", "--ignore-submodules=none",
    ], cwd=root)
    if status:
        raise ValueError("Codacy checkout contains staged, modified, untracked or ignored files")
    return head


def index_entries(raw):
    for record in raw.split(b"\0"):
        if not record:
            continue
        metadata, path = record.split(b"\t", 1)
        mode, _, stage = metadata.split()
        if stage != b"0":
            raise ValueError("Cannot diagnose an unmerged Git index")
        yield mode, os.fsdecode(path)


def checkout_fingerprint(root):
    """Digest tracked checkout bytes and entry identity, not Git stat-cache claims."""
    raw = subprocess.check_output(["git", "ls-files", "--stage", "-z"], cwd=root)
    digest = hashlib.sha256(raw)
    for mode, path in index_entries(raw):
        candidate = root / path
        if any(parent.is_symlink() for parent in candidate.parents if parent != root and root in parent.parents):
            raise ValueError("Codacy checkout has a symlink parent")
        metadata = candidate.lstat()
        digest.update(str(stat.S_IMODE(metadata.st_mode)).encode("ascii") + b"\0")
        if mode == b"120000" and stat.S_ISLNK(metadata.st_mode):
            content = os.fsencode(os.readlink(candidate))
            digest.update(hashlib.sha256(content).digest())
        elif mode in (b"100644", b"100755") and stat.S_ISREG(metadata.st_mode):
            with os.fdopen(os.open(candidate, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as stream:
                if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                    raise ValueError("Codacy checkout file type changed")
                file_digest = hashlib.sha256()
                while chunk := stream.read(65536):
                    file_digest.update(chunk)
            digest.update(file_digest.digest())
        else:
            raise ValueError("Codacy checkout contains an unsupported input type")
    return digest.hexdigest()


def verify_fingerprint(root, expected):
    if checkout_fingerprint(root) != expected:
        raise ValueError("Codacy tracked checkout bytes or entry identity changed")


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
    try:
        head = assert_clean_checkout(root, os.environ["GITHUB_SHA"])
    except (ValueError, OSError, subprocess.SubprocessError):
        raise SystemExit("Codacy checkout identity or clean-source verification failed") from None
    print("Codacy diagnostic clean source commit: " + head)
    if sys.argv[1:] == ["--verify-checkout"]:
        sys.exit(0)
    if len(sys.argv) == 3 and sys.argv[1] in ("--record-checkout", "--verify-checkout"):
        try:
            manifest = Path(sys.argv[2])
            if sys.argv[1] == "--record-checkout":
                with manifest.open("x", encoding="ascii") as stream:
                    stream.write(checkout_fingerprint(root))
            else:
                verify_fingerprint(root, manifest.read_text(encoding="ascii"))
        except (OSError, ValueError, subprocess.SubprocessError):
            raise SystemExit("Codacy tracked checkout fingerprint verification failed") from None
        sys.exit(0)
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
