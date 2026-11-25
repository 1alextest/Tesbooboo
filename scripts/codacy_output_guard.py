"""Stream CLI 7.10.4 output and fail on confirmed loss of analyzer results."""

import re
import subprocess
import sys
from pathlib import Path

ANSI_COLOR = re.compile(r"\x1b\[[0-9;]*m")
REJECTED_OUTPUT = re.compile(
    r"^\d\d/\d\d \d\d:\d\d:\d\d ERROR\s+CodacyPlugins:\d+ - Failed to parse output:"
)
ANALYZER_FAILURE = re.compile(
    r"^\d\d/\d\d \d\d:\d\d:\d\d ERROR\s+c\.c\.a\.c\.a\.CodacyPluginsAnalyser:\d+ - Failed analysis for \S+"
)
UNREADABLE_FILE = re.compile(
    r"^\d\d/\d\d \d\d:\d\d:\d\d ERROR\s+c\.c\.a\.core\.files\.FileCollector:\d+ - Could not read file "
)
DECODE_ERROR = re.compile(
    r'^Exception in thread "main" java\.nio\.charset\.MalformedInputException: Input length = \d+$'
)
SARIF_FRAME = re.compile(r"^\s+at com\.codacy\.analysis\.cli\.formatter\.Sarif\.[^\s(]+\(Sarif\.scala:\d+\)$")


def stop_scanner(cidfile):
    # Docker creates this file before starting the scanner. Never select a
    # container by image or process name on a shared Docker daemon.
    try:
        container_id = cidfile.read_text().strip()
        if not re.fullmatch(r"[0-9a-f]{64}", container_id):
            raise ValueError("invalid container ID")
        subprocess.run(["docker", "kill", container_id], check=True, timeout=15)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"Could not stop the Codacy container: {error}", file=sys.stderr)


def guard(lines, output, diagnostics, stop):
    rejected = 0
    analyzer_failures = 0
    unreadable_files = 0
    decoding_stack = False
    formatter_failed = False

    for line in lines:
        output.write(line)
        message = ANSI_COLOR.sub("", line).rstrip("\r\n")
        if REJECTED_OUTPUT.match(message):
            rejected += 1
        if ANALYZER_FAILURE.match(message):
            analyzer_failures += 1
        if UNREADABLE_FILE.match(message):
            unreadable_files += 1

        if DECODE_ERROR.fullmatch(message):
            decoding_stack = True
        elif decoding_stack:
            if SARIF_FRAME.fullmatch(message) and not formatter_failed:
                formatter_failed = True
                print(
                    "Codacy's main thread failed while encoding SARIF. Stopping the scanner.",
                    file=diagnostics,
                    flush=True,
                )
                stop()
            if not message.lstrip().startswith("at "):
                decoding_stack = False

    if rejected:
        print(f"Codacy rejected {rejected} analyzer output record(s). Analysis is incomplete.", file=diagnostics)
    if analyzer_failures:
        print(f"Codacy reported {analyzer_failures} analyzer failure(s). Analysis is incomplete.", file=diagnostics)
    if unreadable_files:
        print(f"Codacy reported {unreadable_files} unreadable file(s). Analysis is incomplete.", file=diagnostics)
    return 1 if rejected or formatter_failed or analyzer_failures or unreadable_files else 0


if __name__ == "__main__":
    # A diagnostic may itself contain non-UTF-8 source bytes. Preserve those
    # bytes in the streamed log without letting them interrupt the guard.
    sys.stdin.reconfigure(errors="surrogateescape")
    sys.stdout.reconfigure(errors="surrogateescape")
    sys.exit(guard(sys.stdin, sys.stdout, sys.stderr, lambda: stop_scanner(Path(sys.argv[1]))))
