import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import subprocess

from codacy_input_diagnostics import assert_clean_checkout, classify, correlate_issues, diagnose, index_entries


class CodacyInputDiagnosticsTest(unittest.TestCase):
    def git(self, root, *args):
        return subprocess.check_output(["git", "-C", str(root), *args], stderr=subprocess.DEVNULL).decode().strip()

    def clean_repo(self, root):
        self.git(root, "init", "-q")
        (root / "source.txt").write_text("original", encoding="utf-8")
        (root / ".gitignore").write_text("ignored.txt\n", encoding="utf-8")
        self.git(root, "add", ".")
        self.git(root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                 "-c", "commit.gpgsign=false", "commit", "-qm", "fixture")
        return self.git(root, "rev-parse", "HEAD")

    def test_clean_checkout_requires_exact_commit(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            head = self.clean_repo(root)
            self.assertEqual(assert_clean_checkout(root, head), head)
            with self.assertRaisesRegex(ValueError, "event commit"):
                assert_clean_checkout(root, "0" * 40)

    def test_checkout_rejects_worktree_index_and_untracked_or_ignored_files(self):
        for kind in ("modified", "staged", "untracked", "ignored"):
            with self.subTest(kind=kind), TemporaryDirectory() as directory:
                root = Path(directory)
                head = self.clean_repo(root)
                if kind in ("modified", "staged"):
                    (root / "source.txt").write_text("changed", encoding="utf-8")
                    if kind == "staged":
                        self.git(root, "add", "source.txt")
                else:
                    name = "ignored.txt" if kind == "ignored" else "new.txt"
                    (root / name).write_text("extra", encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "checkout contains"):
                    assert_clean_checkout(root, head)

    def test_strict_utf8_stream_handles_split_codepoint_and_rejects_truncated_tail(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "valid").write_bytes(b"a" * 65535 + "é".encode("utf-8"))
            (root / "invalid").write_bytes(b"secret-marker" + b"\xc3")
            self.assertEqual(classify(root, b"100644", "valid"), "utf8")
            self.assertEqual(classify(root, b"100644", "invalid"), "non-utf8")
            output = io.StringIO()
            counts = diagnose(root, [(b"100644", "invalid")], output)
            self.assertEqual(counts, {"non-utf8": 1})
            self.assertNotIn("secret-marker", output.getvalue())

    def test_symlink_is_never_read_or_followed(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "alias").symlink_to(root / "missing")
            self.assertEqual(classify(root, b"120000", "alias"), "tracked-symlink")
            self.assertEqual(classify(root, b"100644", "alias"), "not-regular-checkout-file")
            self.assertEqual(classify(root, b"100644", "missing"), "unreadable")
            self.assertEqual(classify(root, b"160000", "submodule"), "tracked-gitlink")

    def test_nul_delimited_index_and_escaped_filename_diagnostics(self):
        raw = b"100644 abc 0\tname\n::error::unsafe\0"
        entries = list(index_entries(raw))
        self.assertEqual(entries, [(b"100644", "name\n::error::unsafe")])
        with TemporaryDirectory() as directory:
            output = io.StringIO()
            diagnose(Path(directory), entries, output)
            lines = output.getvalue().splitlines()
            self.assertEqual(len(lines), 2)
            self.assertEqual(json.loads(lines[0].split(": ", 1)[1])["path"], entries[0][1])

    def test_unmerged_index_refuses_ambiguous_inventory(self):
        with self.assertRaises(ValueError):
            list(index_entries(b"100644 abc 2\tconflict\0"))

    def test_issue_correlation_uses_only_tracked_paths_and_prints_no_source_or_messages(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "valid").write_text("ordinary", encoding="utf-8")
            (root / "binary").write_bytes(b"private-source" + b"\xff")
            output = io.StringIO()
            results = [
                {"Issue": {"filename": "valid", "message": "private-message"}},
                {"Issue": {"filename": str(root / "binary")}},
                {"Issue": {"filename": "./binary"}},
                {"Issue": {"filename": "../private-outside"}},
                {"FileMetrics": {"filename": "binary"}},
            ]
            counts = correlate_issues(root, [(b"100644", "valid"), (b"100644", "binary")], results, output)
            self.assertEqual(counts, {"issues": 4, "unmatched": 1, "non-issue-records": 1,
                                      "distinct-tracked-paths": 2, "encoding-or-access-candidates": 1})
            self.assertIn('"path": "binary"', output.getvalue())
            self.assertNotIn("private-", output.getvalue())

    def test_issue_correlation_rejects_wrong_report_shape(self):
        with self.assertRaises(ValueError):
            correlate_issues(Path("."), [], {"issues": []}, io.StringIO())
