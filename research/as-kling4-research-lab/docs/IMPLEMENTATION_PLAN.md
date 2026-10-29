# AS Kling4 Research Implementation Plan

Goal: expose public request-to-output behavior with complete prototype source.

Spec: docs/DESIGN.md. Stack: Node22.18+, standard-library REST and file I/O, static ES modules, Python packaging.

Global constraints: no automatic paid run, no automatic POST retry, persist ID before polling, >=5s reads, no key in browser/log/export, two separate timelines, explicit unsupported fields.

Review focus: ambiguous submission; receipt/log storage failure; partial multi-output recovery; double-rounded promotion boundary; copied commands must not execute a second POST.

- [x] Task 1: Shared schema, price estimate, prompt compiler and boundary tests.
- [x] Task 2: REST client, CLI, audit, resume/cancel/download and transport tests.
- [x] Task 3: Thai laboratory, commands, two timelines, source report and reproduction runbook.
- [x] Task 4: Independent code review and regression fixes; all current automated tests pass. Final source snapshot and publication receipts are recorded at delivery.

Visual QA is blocked by browser infrastructure; preserve this limitation in handoff.
