import io
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from codacy_output_guard import guard, stop_scanner


DECODE = 'Exception in thread "main" java.nio.charset.MalformedInputException: Input length = 2\n'
READ_FRAME = '\tat java.nio.file.Files.readAllLines(Files.java:3205)\n'
SARIF_FRAME = '\tat com.codacy.analysis.cli.formatter.Sarif.$anonfun$createResults$3(Sarif.scala:149)\n'
PARSE_ERROR = '11/24 22:14:20 \033[1;31mERROR\033[0m \033[36mCodacyPlugins:11\033[0m - Failed to parse output: JsResultException\n'

ANALYZER_ERROR = '11/25 03:33:35 \033[1;31mERROR\033[0;39m \033[36mc.c.a.c.a.CodacyPluginsAnalyser:31\033[0;39m - Failed analysis for trivy \n'
FILE_ERROR = '11/25 03:28:22 \033[1;31mERROR\033[0;39m \033[36mc.c.a.core.files.FileCollector:102\033[0;39m - Could not read file /checkout/.claude/skills/langfuse, make sure it is readable by everybody. \n'


class CodacyOutputTest(unittest.TestCase):
    def check(self, lines, *, status, stops=0):
        output, diagnostics, stop = io.StringIO(), io.StringIO(), Mock()
        self.assertEqual(guard(lines, output, diagnostics, stop), status)
        self.assertEqual(stop.call_count, stops)
        self.assertEqual(output.getvalue(), ''.join(lines))
        return diagnostics.getvalue()

    def test_real_findings_and_quoted_messages_pass_through(self):
        self.check(['Found 9 PowerShell results\n', 'issue: Failed to parse output: example\n',
                    'file text: ' + DECODE, SARIF_FRAME], status=0)

    def test_hung_formatter_stops_once_on_its_own_stack(self):
        self.check([DECODE, READ_FRAME, SARIF_FRAME, SARIF_FRAME], status=1, stops=1)

    def test_unrelated_exception_and_later_frame_do_not_stop_scanner(self):
        self.check([DECODE, READ_FRAME, 'Starting the next analyzer\n', SARIF_FRAME], status=0)

    def test_rejected_records_fail_at_eof_even_on_normal_scanner_exit(self):
        evidence = self.check([PARSE_ERROR, 'Found 9 PowerShell results\n', PARSE_ERROR], status=1)
        self.assertIn('rejected 2 analyzer output record(s)', evidence)

    def test_analyzer_failure_alone_fails_even_on_normal_scanner_exit(self):
        evidence = self.check([ANALYZER_ERROR, 'Found 9 PowerShell results\n'], status=1)
        self.assertIn('1 analyzer failure(s)', evidence)

    def test_unreadable_source_alone_fails_even_on_normal_scanner_exit(self):
        evidence = self.check([FILE_ERROR], status=1)
        self.assertIn('1 unreadable file(s)', evidence)

    def test_multiple_failure_categories_are_reported_separately(self):
        evidence = self.check([ANALYZER_ERROR, FILE_ERROR, PARSE_ERROR, ANALYZER_ERROR], status=1)
        self.assertIn('2 analyzer failure(s)', evidence)
        self.assertIn('1 unreadable file(s)', evidence)
        self.assertIn('rejected 1 analyzer output record(s)', evidence)

    def test_quoted_analyzer_and_file_errors_are_not_runtime_errors(self):
        self.check(['issue text: ' + ANALYZER_ERROR, 'fixture text: ' + FILE_ERROR], status=0)

    def test_docker_stop_uses_only_the_full_id_from_the_cidfile(self):
        with TemporaryDirectory() as temp, patch('codacy_output_guard.subprocess.run') as docker:
            cidfile = Path(temp) / 'cli.cid'
            container_id = 'ba' * 32
            cidfile.write_text(container_id)
            stop_scanner(cidfile)
            docker.assert_called_once_with(['docker', 'kill', container_id], check=True, timeout=15)

    def test_invalid_id_is_never_passed_to_docker(self):
        with TemporaryDirectory() as temp, patch('codacy_output_guard.subprocess.run') as docker:
            cidfile = Path(temp) / 'cli.cid'
            cidfile.write_text('another-container')
            with patch('sys.stderr', new_callable=io.StringIO) as diagnostic:
                stop_scanner(cidfile)
            docker.assert_not_called()
            self.assertIn('invalid container ID', diagnostic.getvalue())
