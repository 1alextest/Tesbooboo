#!/usr/bin/env python3
"""Bounded Tesbo review-input integrity. Not a semantic, runtime, or Graph verifier."""
import argparse
import copy
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

VERSION = "tesbo-native-review-trace/1.0"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.PIPE)


def safe_path(path):
    return isinstance(path, str) and path and not PurePosixPath(path).is_absolute() and ".." not in PurePosixPath(path).parts


def validate(profile, repo, canonical):
    errors = []
    if profile.get("version") != VERSION:
        return ["Wrong profile version"]
    source, tree = profile.get("source", ""), profile.get("tree", "")
    if not re.fullmatch(r"[0-9a-f]{40}", source) or not re.fullmatch(r"[0-9a-f]{40}", tree):
        return ["Invalid immutable source/tree identity"]
    try:
        actual = git(repo, "rev-parse", source + "^{tree}").decode().strip()
        if actual != tree:
            errors.append("Source tree mismatch")
    except subprocess.CalledProcessError:
        return ["Source commit unavailable"]
    canonical_text = {}
    originals = profile.get("canonical_files", {})
    if len(originals) != 8 or sorted(p[:2] for p in originals) != [f"{i:02d}" for i in range(8)]:
        errors.append("Canonical input must retain the declared eight-file package")
    for path, sha in originals.items():
        if not safe_path(path):
            errors.append("Unsafe canonical path")
            continue
        try:
            data = (canonical / path).read_bytes()
            if digest(data) != sha:
                errors.append("Canonical bytes changed: " + path)
            canonical_text[path] = data.decode("utf-8")
        except (OSError, UnicodeError):
            errors.append("Canonical input unavailable: " + path)
    paths = profile.get("source_files", {})
    if not paths:
        errors.append("Empty source inventory")
    for path, sha in paths.items():
        if not safe_path(path):
            errors.append("Unsafe source path")
            continue
        try:
            if digest(git(repo, "show", source + ":" + path)) != sha:
                errors.append("Source bytes changed: " + path)
        except subprocess.CalledProcessError:
            errors.append("Source input unavailable: " + path)
    required = profile.get("required_contracts", [])
    rows = profile.get("contracts", [])
    ids = [row.get("id") for row in rows]
    if not required or len(required) != len(set(required)) or sorted(ids) != sorted(required):
        errors.append("Declared contract coverage mismatch")
    if len(ids) != len(set(ids)):
        errors.append("Duplicate contract row")
    allowed = {"source_verified", "runtime_partial", "runtime_verified", "open"}
    for row in rows:
        label = str(row.get("id"))
        for name in ("meaning", "owner", "manual_disposition", "limitations"):
            if not isinstance(row.get(name), str) or not row[name].strip():
                errors.append(label + ": missing " + name)
        if row.get("evidence_status") not in allowed:
            errors.append(label + ": invalid evidence status")
        for group in ("design", "tasks", "writers", "consumers", "proofs"):
            refs = row.get(group, [])
            if not isinstance(refs, list) or not refs:
                errors.append(label + ": missing " + group)
                continue
            for path in refs:
                if path not in paths:
                    errors.append(label + ": unbound " + group + " path")
        refs = row.get("canonical", [])
        if not isinstance(refs, list) or not refs:
            errors.append(label + ": missing canonical trace")
        for ref in refs:
            text = canonical_text.get(ref.get("file", ""), "")
            token = ref.get("id", "")
            if not token or not re.search(r"(?<![A-Z0-9-])" + re.escape(token) + r"(?![A-Z0-9-])", text):
                errors.append(label + ": undefined canonical reference " + str(token))
    if not isinstance(profile.get("excluded_claims"), list) or not profile["excluded_claims"]:
        errors.append("Missing evidence limits")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--canonical", type=Path, required=True)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--negative-controls", action="store_true")
    args = parser.parse_args()
    raw = args.profile.read_bytes()
    profile = json.loads(raw)
    errors = validate(profile, args.repo, args.canonical)
    controls = {}
    if args.negative_controls and not errors:
        changed = copy.deepcopy(profile)
        changed["contracts"].pop()
        controls["removed_declared_contract"] = bool(validate(changed, args.repo, args.canonical))
        changed = copy.deepcopy(profile)
        changed["source_files"][next(iter(changed["source_files"]))] = "0" * 64
        controls["wrong_source_hash"] = bool(validate(changed, args.repo, args.canonical))
        changed = copy.deepcopy(profile)
        changed["contracts"][0]["canonical"][0]["id"] = "FR-999999"
        controls["undefined_canonical_reference"] = bool(validate(changed, args.repo, args.canonical))
        changed = copy.deepcopy(profile)
        changed["contracts"][0]["consumers"] = []
        controls["missing_consumer_edge"] = bool(validate(changed, args.repo, args.canonical))
        if not all(controls.values()):
            errors.append("A negative control was not detected")
    print(json.dumps({"verifier": VERSION, "mode": "declared trace/input integrity only",
        "source": profile.get("source"), "tree": profile.get("tree"),
        "profile_sha256": digest(raw), "script_sha256": digest(Path(__file__).read_bytes()),
        "contracts": len(profile.get("contracts", [])), "source_files": len(profile.get("source_files", {})),
        "canonical_files": len(profile.get("canonical_files", {})), "errors": errors,
        "negative_controls": controls, "semantic_verified": False, "runtime_verified": False,
        "full_scope_coverage_verified": False, "graph_verifier": False}, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
