# Synthetic planning brief: rehearsal packet covers

## What I need

I maintain a small application for a community orchestra's rehearsal coordinator. Plan a modest addition: put a rehearsal cover sheet in front of each approved instrumental part. Explain the user flow, relevant existing capabilities, necessary changes, and how we can judge the result. You are planning, not implementing.

All material below is synthetic. There is no real orchestra, repository, or observed production system behind this specification.

## Authority and required behavior

The music librarian approves the instrumental PDFs. The coordinator may assemble and print packets and revise covers but has no authority to alter approved score pages. Changes to notation, score layout, source page order, or geometry require separate librarian approval that has not been given.

For this increment, an output packet must contain exactly one new cover followed by every source page in its original order. Score-page media boxes, crop boxes, rotations, fonts, and content must remain unchanged. There must be no automatic scaling, margin adjustment, page-number overlay, or inserted blank page on the score portion. The original source PDF must remain available unchanged.

The cover contains the approved part title, the ensemble name, and a coordinator-entered rehearsal date. These are supplied text values: reproduce them exactly, without correcting spelling, expanding abbreviations, inferring a date, or generating additional prose. A missing required value prevents completion of that packet. The cover may have its own layout; it does not establish a new layout for the score pages.

## Existing capabilities

The application already imports PDFs and stores their identities, original bytes, page counts, and page boxes. It can read approved part titles from the project record. Its packet assembler can copy existing PDF pages into a new document and prepend a supplied PDF page while retaining source-page properties. A separate setlist feature already renders a single PDF page from explicit text fields.

The existing job screen accepts text fields, reports a missing required value, previews completed PDFs, and saves a job manifest. It does not send anything to a printer automatically. The coordinator currently downloads the assembled document and chooses print settings separately.

## Examples accompanying the request

Both proposed manifests use the same approved three-page part, the exact cover text below, four output pages, and the sequence `cover, source-1, source-2, source-3`. Source pages are 210 × 297 mm, with zero rotation and matching media and crop boxes. All other source-page properties match the approved source, which is retained unchanged.

| Field | Manifest Cedar | Manifest Birch |
|---|---|---|
| Part title | Clarinet 2 — Evening Study | Clarinet 2 — Evening Study |
| Ensemble | Northbank Community Orchestra | Northbank Community Orchestra |
| Rehearsal date text | 2027-02-04 | 2027-02-04 |
| Scale applied to source-page content | 100% | 98% |

These are proposed examples to consider, not additional authority over the requirements.

## One fact we do not have

We do not know whether the operator will print on one side or both sides of the paper. Please distinguish consequences of that unknown from behavior already specified for the PDF.
