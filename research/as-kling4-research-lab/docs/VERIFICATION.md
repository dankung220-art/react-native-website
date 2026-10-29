# Verification record — 2026-10-29

Automated tests: **33 passed, 0 failed** after the review fix pass. No live generation or paid API request was made.

Independent read-only review found four important issues; all have fixes and regression coverage:

1. Copied cURL block could submit twice. Commands now have one executable wrapper; wire examples are commented. A test executes the entire exported snippet against local submission stubs and observes exactly one POST.
2. Failed audit writes could mask an accepted task ID. The CLI persists the receipt before TASK_CREATED logging; best-effort error logging preserves the original error and ID. A real filesystem-failure regression covers this path.
3. Same-directory partial multi-output recovery stopped on the first existing file. outputs.json checkpoints now tie task/index to file size and SHA-256; resume re-hashes existing outputs and downloads only missing ones. A tamper test refuses modified files.
4. JSON-to-Form could show an old image while exporting a new image. Shared image state synchronizes preview/metadata and invalidates stale async decodes. Pure-state regressions cover URL/data replacement, clear during decode, and later selection winning.

Minor review items were addressed in the same bounded fix pass: stale image loading, nonzero exit status and all-output behavior in the Node example, and rejecting insecure media redirect targets before requesting them. No minor finding is knowingly deferred.

The local HTTP server test proves root serving, blocked secret/source paths, and absence of a live POST route. This is not visual browser verification.

**Browser/rendered QA: unverified.** The cloud-browser create-tab operation timed out; the environment reset afterward. Files were restored and the suite re-run. Desktop/mobile layout, native file selection, clipboard, rendered interactions and browser console behavior still require visual QA.

**Provider behavior: unverified by live call.** Model availability/input semantics/pricing are grounded in the official sources snapshot, not an executed generation. Actual billing, generation latency, output decodability and visual/audio quality require a user-authorized live run. MP4 download checks content type and container signature, not full codec decoding.

Private Site deployment status and GitHub commit are verified through their native service responses at handoff; successful publication does not remove the browser QA limit.
