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
NATIVE_PROSE_PATH = Path(
    "docs/specs/agent-synchronized-engineering/reviews/2026-11-20-native-qa/"
    "native-backend-fix-review.md"
)
NATIVE_PROSE_SHA256 = "b084c144d6ba7f150c692b6065132cfd45e94309871c4182164044ec7f9e1b78"
# This is review prose, not a credential. Build the scanner fixture from two ordinary
# fragments so the test control itself is not mistaken for another unreviewed receipt.
NATIVE_PROSE_FRAGMENT = "".join(("new-key 404, ", "anonymous/foreign "))

# Pin the exact reviewed canonical document revisions. Earlier originals remain
# in Git history. Any subsequent amendment requires a new evidence review and
# exact digest update. Only these two ordinary prose matches are excepted,
# under their exact paths and the generic-api-key rule.
CANONICAL_PROSE = [
    ("technical", Path("docs/qa-orchestration/03_TECHNICAL_DESIGN.md"),
     "76422bbade48dd19ab983a9e721f5f9b71927d4c72fba275b8dc5ab8706bd556",
     "".join(("auth, ", "finalization/", "merge ")), "merge", "merge2"),
    ("contracts", Path("docs/qa-orchestration/04_MCP_API_CONTRACTS.md"),
     "83957d20ad7e2fb33522665ac3627fb26c862deeec32fc385ac9c4d7307a6836",
     "".join(("token. Reject cycles, ", "missing/foreign/", "unapproved ")), "unapproved", "unapproved2"),
]


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
    native_receipt = (repo / NATIVE_PROSE_PATH).read_bytes()
    if hashlib.sha256(native_receipt).hexdigest() != NATIVE_PROSE_SHA256:
        raise AssertionError("Frozen native review bytes changed; prose exception needs review")
    native_prose = [line for line in native_receipt.decode("utf-8").splitlines()
                    if NATIVE_PROSE_FRAGMENT in line]
    if len(native_prose) != 1:
        raise AssertionError("Expected exactly one independently reviewed native prose line")

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

        native_path = str(NATIVE_PROSE_PATH)
        prose_line = native_prose[0] + "\n"
        native_positive = {native_path: prose_line}
        baseline = scan(args.image, default_config, root, native_positive, "native-prose-default")
        if baseline != [(native_path, "generic-api-key")]:
            raise AssertionError("Native prose baseline must prove the single observed false positive")
        if scan(args.image, config, root, native_positive, "native-prose-corrected"):
            raise AssertionError("The reviewed native prose match was not precisely excepted")
        native_denied = [
            ("native-outside-path", "src/native-review.md", prose_line, "generic-api-key"),
            ("native-nested-path", "src/" + native_path, prose_line, "generic-api-key"),
            ("native-name-suffix", native_path + ".extra", prose_line, "generic-api-key"),
            ("native-altered-prose", native_path,
             prose_line.replace("anonymous/foreign", "anonymous/foreign2"), "generic-api-key"),
            ("native-generic-credential", native_path,
             json.dumps({"service_api_key": generic}), "generic-api-key"),
            ("native-provider-credential", native_path,
             json.dumps({"credential": provider}), "github-pat"),
            ("native-additional-same-line", native_path,
             prose_line.rstrip("\n") + " " + json.dumps({"service_api_key": generic}) + "\n",
             "generic-api-key"),
        ]
        for label, path, content, rule in native_denied:
            for mode, selected_config in (("default", default_config), ("corrected", config)):
                result = scan(args.image, selected_config, root, {path: content}, f"{label}-{mode}")
                require_findings(result, {(path, rule): 1}, f"{label}-{mode}")
                if label == "native-additional-same-line":
                    expected_count = 2 if mode == "default" else 1
                    if result.count((path, rule)) != expected_count:
                        raise AssertionError(f"{label}-{mode}: unexpected same-line suppression")
        print("PASS: 7 exact hash mappings, 1 exact prose match, and 16 denied neighbors; "
              "each checked with both configurations")

        for label, path, digest, fragment, original_word, changed_word in CANONICAL_PROSE:
            original = (repo / path).read_bytes()
            if hashlib.sha256(original).hexdigest() != digest:
                raise AssertionError(f"{label}: canonical original changed; exception needs review")
            matching = [line for line in original.decode("utf-8").splitlines() if fragment in line]
            if len(matching) != 1:
                raise AssertionError(f"{label}: expected one reviewed canonical prose line")
            prose = matching[0] + "\n"
            exact_path = str(path)
            baseline = scan(args.image, default_config, root, {exact_path: prose}, f"canonical-{label}-default")
            if baseline != [(exact_path, "generic-api-key")]:
                raise AssertionError(f"{label}: default must reproduce the single observed prose finding")
            if scan(args.image, config, root, {exact_path: prose}, f"canonical-{label}-corrected"):
                raise AssertionError(f"{label}: exact canonical prose exception did not match")
            denied_prose = [
                ("outside", f"src/{path.name}", prose, "generic-api-key"),
                ("nested", "src/" + exact_path, prose, "generic-api-key"),
                ("suffix", exact_path + ".extra", prose, "generic-api-key"),
                ("altered", exact_path, prose.replace(fragment, fragment.replace(original_word, changed_word)), "generic-api-key"),
                ("generic", exact_path, json.dumps({"service_api_key": generic}), "generic-api-key"),
                ("provider", exact_path, json.dumps({"credential": provider}), "github-pat"),
                ("same-line", exact_path, prose.rstrip("\n") + " " + json.dumps({"service_api_key": generic}) + "\n", "generic-api-key"),
            ]
            for neighbor, candidate_path, content, rule in denied_prose:
                for mode, selected_config in (("default", default_config), ("corrected", config)):
                    name = f"canonical-{label}-{neighbor}-{mode}"
                    actual = scan(args.image, selected_config, root, {candidate_path: content}, name)
                    require_findings(actual, {(candidate_path, rule): 1}, name)
                    if neighbor == "same-line" and actual.count((candidate_path, rule)) != (2 if mode == "default" else 1):
                        raise AssertionError(f"{name}: unexpected same-line suppression")
        print("PASS: 2 exact canonical prose matches and 14 denied neighbors; both configurations", flush=True)


        # Protect the frozen original Blue receipt without changing any reviewer
        # evidence or disabling broader sourcegraph-access-token detection.
        # Exact Git object identity for these two hashes was checked against
        # their respective repository commit endpoints before this exception.
        blue_receipt = Path("docs/specs/agent-synchronized-engineering/reviews/2026-11-19-gex-rerun/receipts/blue-a-v1.md")
        source_git = "6897f989b055a955280f" + "810c7daace86f74057fa"
        method_git = "d83549c85a4dcd047fb40" + "dc4fba4ec62737ab0fc"
        frozen = (repo / blue_receipt).read_text(encoding="utf-8")
        if frozen.count(source_git) < 2 or frozen.count(method_git) < 1:
            raise AssertionError("Pinned Git object identifiers missing from frozen Blue receipt")
        original_lines = (
            "sourcegraph keyword present elsewhere in original Blue review\\n"
            "- **Application source:** 1alextest/Tesbooboo at " + source_git + ", read exclusively through Git objects.\n"
            "- **Method source:** NesberryEnterprise/Nesberry at the supplied recovered " + method_git + " root.\n"
            "2. Git object resolution: **" + source_git + " resolves as a commit**.\n"
        )
        baseline_blue = scan(args.image, default_config, root,
                             {str(blue_receipt): original_lines}, "blue-commits-default")
        # Gitleaks deduplicates the repeated source commit within one file;
        # the two distinct verified Git objects are the actual findings.
        expected_blue = {(str(blue_receipt), "sourcegraph-access-token"): 2}
        require_findings(baseline_blue, expected_blue, "blue-commits-default")
        if len(baseline_blue) != 2:
            raise AssertionError("Blue commit baseline has unexpected extra findings")
        if scan(args.image, config, root, {str(blue_receipt): original_lines},
                "blue-commits-corrected"):
            raise AssertionError("Exact Git commit exception did not clear the reviewed matches")

        other_git = hashlib.sha1(b"tesbo independently different sourcegraph control").hexdigest()
        neighbor_cases = [
            ("blue-outside-path", "src/blue-a-v1.md", original_lines, 2, "sourcegraph-access-token"),
            ("blue-nested-path", "src/" + str(blue_receipt), original_lines, 2, "sourcegraph-access-token"),
            ("blue-suffix", str(blue_receipt) + ".extra", original_lines, 2, "sourcegraph-access-token"),
            ("blue-new-sha", str(blue_receipt), "sourcegraph\nOriginal source " + other_git + "\n", 1, "sourcegraph-access-token"),
            ("blue-original-plus-new-sha", str(blue_receipt), "sourcegraph\nOriginal source " + source_git + " and new " + other_git + "\n", 1, "sourcegraph-access-token"),
            ("blue-provider-token", str(blue_receipt), "Provider sample " + provider + "\n", 1, "github-pat"),
        ]
        for label, path, content, expected_count, rule in neighbor_cases:
            result = scan(args.image, config, root, {path: content}, label)
            if result.count((path, rule)) != expected_count or len(result) != expected_count:
                raise AssertionError(f"{label}: wrong allowed/denied count for {rule}")
        print("PASS: two independently resolved pinned Git IDs excluded only in frozen Blue receipt; six denied neighbors", flush=True)

if __name__ == "__main__":
    main()
