#!/usr/bin/env python3
"""Verify a frozen documentation candidate; no application or semantic acceptance.

The preserved v1.4.48 input must be extracted from the archive identified in the
review's source manifest. The candidate is a copied set bound by INPUTS.json.
This checker does not fetch, publish, modify specifications, or run the product.
"""

import argparse
import hashlib
import json
from pathlib import Path


def digest(content):
    return hashlib.sha256(content).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.candidate.resolve(strict=True)
    baseline = args.baseline.resolve(strict=True)
    inputs = json.loads((candidate / "INPUTS.json").read_text())
    checks = []

    def check(name, passed, detail=""):
        checks.append({"check": name, "passed": bool(passed), "detail": detail})

    for item in inputs["files"]:
        content = (candidate / item["path"]).read_bytes()
        check("frozen identity: " + item["path"],
              len(content) == item["bytes"] and digest(content) == item["sha256"])

    docs = candidate / "docs/qa-orchestration"
    manifest = json.loads((docs / "source-manifest.json").read_text())
    names = sorted(path.name for path in docs.glob("0[0-7]_*.md"))
    check("canonical cardinality", len(names) == 8 and
          names == sorted(item["path"] for item in manifest["files"]))
    for item in manifest["files"]:
        path = docs / item["path"]
        content = path.read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
        check("manifest identity: " + path.name,
              len(content) == item["bytes"] and digest(content) == item["sha256"]
              and blob == item["git_blob"])
        previous = [line for line in (baseline / path.name).read_text().splitlines()
                    if not line.startswith("**Current package amendment:**")]
        current_lines = content.decode().splitlines()
        cursor = iter(current_lines)
        preserved = all(any(line == old for line in cursor) for old in previous)
        check("saved v148 body preserved: " + path.name, preserved)
        pointers = [line for line in current_lines
                    if line.startswith("**Current package amendment:**")]
        check("single v149 current pointer: " + path.name,
              len(pointers) == 1 and "1.4.49" in pointers[0]
              and "NOT FROZEN" in pointers[0])

    brief = (docs / "06_IMPLEMENTATION_AGENT_BRIEF.md").read_text()
    check("shared gate in canonical owner once",
          brief.count("**Shared distillation quality gate (UX/UI, Security and every other domain):**") == 1)
    subordinate = (candidate / "docs/specs/agent-synchronized-engineering/skills-governance.md").read_text()
    check("subordinate gate refers to canonical owner",
          "06_IMPLEMENTATION_AGENT_BRIEF.md#portable-method-for-discovery-and-principle-distillation" in subordinate)
    research = (docs / "reviews/plugin-ecosystem-obsidian-review.md").read_text()
    check("research removes first-delivery heading", "### First slice:" not in research)

    result = {
        "kind": "document_integrity_only", "candidate": inputs["candidate"],
        "input_manifest_sha256": digest((candidate / "INPUTS.json").read_bytes()),
        "verifier_sha256": digest(Path(__file__).read_bytes()),
        "checks": checks, "passed": sum(row["passed"] for row in checks),
        "failed": sum(not row["passed"] for row in checks),
        "limits": "No product/runtime/UI/native/semantic/effectiveness checks. Source and semantic review are separate receipts.",
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: result[key] for key in
                      ("candidate", "input_manifest_sha256", "passed", "failed", "limits")}))
    raise SystemExit(1 if result["failed"] else 0)


if __name__ == "__main__":
    main()
