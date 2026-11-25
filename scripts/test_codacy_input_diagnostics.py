import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from codacy_input_diagnostics import classify, diagnose, index_entries


class CodacyInputDiagnosticsTest(unittest.TestCase):
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
