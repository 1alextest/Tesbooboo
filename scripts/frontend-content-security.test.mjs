import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

// Exercise the frontend's installed libraries, not copies from an unrelated test dependency tree.
const requireFrontend = createRequire(new URL("../Tesbo-Frontend/package.json", import.meta.url));
const lock = JSON.parse(readFileSync(new URL("../Tesbo-Frontend/package-lock.json", import.meta.url), "utf8"));
const core = requireFrontend("@tiptap/core");
const XLSX = requireFrontend("xlsx");

test("one patched TipTap family, patched paste runtime and official integrity-locked SheetJS", () => {
  const tiptap = Object.entries(lock.packages).filter(([name]) => name.includes("node_modules/@tiptap/"));
  assert.ok(tiptap.length > 10);
  for (const [name, entry] of tiptap) assert.equal(entry.version, "3.33.1", name);
  const view = lock.packages["node_modules/prosemirror-view"].version.split(".").map(Number);
  assert.ok(view[0] > 1 || (view[0] === 1 && (view[1] > 42 || (view[1] === 42 && view[2] >= 3))));
  const sheetjs = lock.packages["node_modules/xlsx"];
  assert.equal(sheetjs.version, "0.20.3");
  assert.equal(sheetjs.resolved, "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz");
  assert.match(sheetjs.integrity, /^sha512-/);
  assert.equal(XLSX.version, "0.20.3");
});

test("TipTap mergeAttributes does not turn an own __proto__ value into inherited event attributes", () => {
  const malicious = JSON.parse('{"__proto__":{"onerror":"tesboSyntheticProbe"},"title":"kept","class":"first"}');
  const result = core.mergeAttributes(malicious, { class: "second", "data-control": "normal" });
  assert.equal(result.onerror, undefined);
  assert.equal(Object.prototype.onerror, undefined);
  assert.equal(result.title, "kept");
  assert.equal(result.class, "first second");
  assert.equal(result["data-control"], "normal");
});

for (const kind of ["block", "inline"]) {
  test(`complete ${kind} Markdown attribute tokenizer handles adversarial prefixes within a bounded child process`, () => {
    // GHSA-j95f-988m-3j2f shapes, synthetic/local only. A separate process bounds the old quadratic
    // parser even when its synchronous work would prevent a test-runner timeout from firing.
    // This is a generous completion deadline, not a production latency/scaling certification.
    const code = `
      const assert = require('node:assert/strict');
      const { createRequire } = require('node:module');
      const core = createRequire(${JSON.stringify(new URL("../Tesbo-Frontend/package.json", import.meta.url).href)})('@tiptap/core');
      const block = ${JSON.stringify(kind)} === 'block';
      const spec = block
        ? core.createAtomBlockMarkdownSpec({ nodeName: 'probe' })
        : core.createInlineMarkdownSpec({ nodeName: 'probe', selfClosing: true });
      const source = block ? ':::probe {' + '__QUOTED_0'.repeat(16384) + '__QUOTED_0__} :::\\n'
        : '[probe ' + '0'.repeat(131072) + ']';
      assert.ok(spec.markdownTokenizer.tokenize(source, [], {}));
      const control = block ? ':::probe {label="normal"} :::\\n' : '[probe label="normal"]';
      assert.ok(spec.markdownTokenizer.tokenize(control, [], {}));
    `;
    execFileSync(process.execPath, ["-e", code], { timeout: 8_000, stdio: "pipe" });
  });
}

for (const bookType of ["xlsx", "biff8"]) {
  test(`SheetJS ${bookType} round-trips multiple sheets, Unicode, cached formulas and text without evaluation`, () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Title"], ["Unselected control"]]), "Control");
    const sheet = XLSX.utils.aoa_to_sheet([["Title", "Description"], ["Привет café 漢字", '<script>tesboSyntheticProbe</script>']]);
    sheet.C1 = { t: "s", v: "Formula" };
    sheet.C2 = { t: "n", f: "1+1", v: 2 };
    sheet["!ref"] = "A1:C2";
    XLSX.utils.book_append_sheet(workbook, sheet, "Cases");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType });
    const parsed = XLSX.read(bytes, { type: "buffer", cellDates: false });
    assert.deepEqual(parsed.SheetNames, ["Control", "Cases"]);
    assert.deepEqual(XLSX.utils.sheet_to_json(parsed.Sheets.Cases, { header: 1, raw: false, defval: "" }), [
      ["Title", "Description", "Formula"], ["Привет café 漢字", '<script>tesboSyntheticProbe</script>', "2"],
    ]);
    assert.equal(Object.prototype.tesboSyntheticProbe, undefined);
  });
}

test("SheetJS CSV preserves quoted newlines, BOM-less Unicode and prototype-shaped header text", () => {
  const csv = 'Title,Description,__proto__\r\n"Привет café 漢字","line one\nline two",not-an-object\r\n';
  const workbook = XLSX.read(csv, { type: "string", cellDates: false });
  assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false }), [
    ["Title", "Description", "__proto__"], ["Привет café 漢字", "line one\nline two", "not-an-object"],
  ]);
  assert.equal(Object.prototype["not-an-object"], undefined);
});
