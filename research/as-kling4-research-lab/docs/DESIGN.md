# Design and scope — 2026-10-29

The user asked for a runnable research draft of the Runway Kling4 image-to-video endpoint, every line of prototype source, commands from start through completed clip, and detailed timelines. The design follows the user's standing instruction to proceed without repeated questions.

Architecture: zero-dependency Node22.18+ REST client and file-backed CLI; static mobile-first Thai command/simulation workbench; official-source snapshot. Website never receives a key. Public request lifecycle is reproducible; proprietary model/server code is unavailable. Validated subset is first/middle/last and image references; video references explicitly excluded.

Chosen approach: REST + laboratory makes polling/recovery visible; a visual-only copy cannot run a task, and an SDK-only snippet obscures control. This is an implementer choice, not a claimed user selection. No paid generation in the build. Explicit live/spend/estimate-budget flags precede future user execution.

Correctness: POST once, persist ID before waiting, >=5s sequential status reads plus jitter/backoff, local timeout retains task, no auth on output download, partial files never presented as finished, secrets excluded from exports. API wall time and creative shot time are separate. No fixed generation time, exact middle-frame timestamp, inference steps or perfect identity lock claimed.

Deliver source, executable CLI/cURL, examples, tests, Thai report, sources, scorecard, agent instructions, ZIP, isolated GitHub research branch and private Site draft. Browser QA remains unverified after infrastructure timeout/reset; local HTTP checks do not replace it.
