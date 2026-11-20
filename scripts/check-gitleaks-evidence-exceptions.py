#!/usr/bin/env python3
"""Exercise the real CI scanner against receipt exceptions and denied neighbors.

Only disposable synthetic credentials are constructed, outside the checkout.
The caller resolves one image ID for both these controls and the repository scan.
Reports remain redacted; output contains rule IDs and paths, never matched values.
"""

import argparse
import base64
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path


RECEIPTS = Path("docs/specs/agent-synchronized-engineering/reviews/2026-11-19-independent")
OLD_DIGEST = "962dcaf20576c2603f30c4b438bdbef9bf83ffb687024a9d89c65dc0ae468412"
NEW_DIGEST = "b8f6f6fdf4ce97aca68824b9eae3b08d22cbdb6c0abf56989429f3f74b5a492d"
CONTRACT = "5893a48fe504a8d5c6b47bb552c493685e950fab62d44334702a92edc7c9474d"
API_PATH = "Tesbo-Frontend/lib/api.ts"
CONTRACT_PATH = "04_MCP_API_CONTRACTS.md"
KNOWN_MAPS = {
    "native-green-profile-9519.json": {API_PATH: OLD_DIGEST, CONTRACT_PATH: CONTRACT},
    "native-green-profile-9519-v2.json": {API_PATH: OLD_DIGEST, CONTRACT_PATH: CONTRACT},
    "native-occurrence-repair-evidence.json": {API_PATH: NEW_DIGEST},
    "native-green-profile-965a87a1-v3.json": {API_PATH: NEW_DIGEST, CONTRACT_PATH: CONTRACT},
}


def scan(image, config, root, files, label):
    case = root / label
    checkout = case / "checkout"
    reports = case / "reports"
    checkout.mkdir(parents=True)
    reports.mkdir()
    for name, content in files.items():
        target = checkout / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    result = subprocess.run(
        ["docker", "run", "--rm", "-v", f"{checkout}:/repo:ro",
         "-v", f"{config}:/control.toml:ro", "-v", f"{reports}:/reports",
         image, "dir", "/repo", "--config", "/control.toml", "--redact",
         "--exit-code", "1", "--report-format", "json",
         "--report-path", "/reports/findings.json"],
        capture_output=True, text=True, check=False,
    )
    report = reports / "findings.json"
    if result.returncode not in (0, 1) or not report.is_file():
        raise RuntimeError(f"{label}: scanner execution/report failed (exit {result.returncode})")
    findings = json.loads(report.read_text(encoding="utf-8"))
    if not isinstance(findings, list) or result.returncode != bool(findings):
        raise RuntimeError(f"{label}: inconsistent scanner exit/report")
    witnesses = []
    for finding in findings:
        path = finding["File"]
        relative = path.removeprefix("/repo/")
        if relative not in files:
            raise RuntimeError(f"{label}: unexpected reported path {path}")
        witnesses.append((relative, finding["RuleID"]))
    print(json.dumps({"control": label, "findings": witnesses}), flush=True)
    return witnesses


def require_findings(actual, expected, label):
    for witness, minimum in expected.items():
        if actual.count(witness) < minimum:
            raise AssertionError(f"{label}: missing expected rule/path/count {witness}: {minimum}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True, help="Resolved image ID, also used for the real scan")
    parser.add_argument("--config", type=Path, default=Path(".gitleaks.toml"))
    args = parser.parse_args()
    config = args.config.resolve(strict=True)
    repo = config.parent
    # Confirm the excepted mappings are actual retained evidence, not invented controls.
    for filename, mappings in KNOWN_MAPS.items():
        content = (repo / RECEIPTS / filename).read_text(encoding="utf-8")
        for key, digest in mappings.items():
            if f'"{key}": "{digest}"' not in content:
                raise AssertionError(f"Reviewed mapping missing from {filename}: {key}")

    with tempfile.TemporaryDirectory(prefix="tesbo-gitleaks-controls-") as temp:
        root = Path(temp)
        default_config = root / "default.toml"
        default_config.write_text("[extend]\nuseDefault = true\n", encoding="utf-8")
        allowed = {
            str(RECEIPTS / filename): json.dumps(values, indent=2) + "\n"
            for filename, values in KNOWN_MAPS.items()
        }
        expected = {
            (str(RECEIPTS / filename), "generic-api-key"): len(values)
            for filename, values in KNOWN_MAPS.items()
        }
        baseline = scan(args.image, default_config, root, allowed, "known-maps-default")
        require_findings(baseline, expected, "known-maps-default")
        if len(baseline) != sum(expected.values()):
            raise AssertionError("Known-map baseline has unexplained additional findings")
        if scan(args.image, config, root, allowed, "known-maps-corrected"):
            raise AssertionError("Reviewed hash maps were not precisely excepted")

        filename = str(RECEIPTS / "native-green-profile-9519.json")
        known = json.dumps({API_PATH: OLD_DIGEST}) + "\n"
        different_hex = hashlib.sha256(b"tesbo synthetic different digest control").hexdigest()
        generic = base64.b64encode(hashlib.sha256(b"tesbo synthetic generic control").digest()).decode()
        provider = "ghp_" + hashlib.sha256(b"tesbo synthetic provider control").hexdigest()[:36]
        denied = [
            ("outside-path", "src/receipt.json", known, "generic-api-key"),
            ("nested-lookalike", "src/" + filename, known, "generic-api-key"),
            ("different-name", str(RECEIPTS / "unreviewed.json"), known, "generic-api-key"),
            ("name-suffix", filename + ".extra", known, "generic-api-key"),
            ("different-digest", filename, json.dumps({API_PATH: different_hex}), "generic-api-key"),
            ("wrong-historical-digest", filename, json.dumps({API_PATH: NEW_DIGEST}), "generic-api-key"),
            ("generic-in-allowed-path", filename, json.dumps({"service_api_key": generic}), "generic-api-key"),
            ("provider-in-allowed-path", filename, json.dumps({"credential": provider}), "github-pat"),
            ("additional-on-same-line", filename,
             json.dumps({API_PATH: OLD_DIGEST, "service_api_key": generic}), "generic-api-key"),
        ]
        for label, path, content, rule in denied:
            for mode, selected_config in (("default", default_config), ("corrected", config)):
                result = scan(args.image, selected_config, root, {path: content}, f"{label}-{mode}")
                require_findings(result, {(path, rule): 1}, f"{label}-{mode}")
                if label == "additional-on-same-line":
                    expected_count = 2 if mode == "default" else 1
                    if result.count((path, rule)) != expected_count:
                        raise AssertionError(f"{label}-{mode}: unexpected same-line suppression")
        print("PASS: 7 exact hash mappings and 9 denied neighbors, each checked with both configurations")


if __name__ == "__main__":
    main()
