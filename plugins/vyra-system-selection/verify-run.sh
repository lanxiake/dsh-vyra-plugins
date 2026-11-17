#!/bin/sh
# Run the plugin's tests.
#
# These cover the pure logic only: prompt assembly, layout maths, settings persistence, and the
# in-page selection helper. Nothing here touches the mouse, the clipboard, or real windows —
# anything that drives the desktop is verified by hand, because a test that synthesizes input
# fights whatever else the machine is doing and reports that conflict as a failure.
#
# Why this script is written the way it is:
#   * `$DSH_EXE` overrides the client path; the default is this author's install. The tests that
#     need the app (process-tree) skip themselves without it, so the script stays usable anywhere.
#   * The exit code is checked before the output is filtered. `cmd | grep` reports grep's status,
#     so a failing test run used to exit 0 — which is how a test file that did not exist went
#     unnoticed long enough for a `ReferenceError` to ship.
set -eu
DSH="${DSH_EXE:-/c/Users/75791/AppData/Local/Programs/DeepSeek Harness/DeepSeek Harness.exe}"
here=$(dirname "$0")
failed=0

run() {
  file="$here/$1"
  echo ""
  echo "=== $1 ==="
  if [ ! -f "$file" ]; then
    echo "MISSING: $1" >&2
    failed=1
    return
  fi
  # Capture, then filter: the pipeline's status is grep's, not the runner's.
  output=$(DSH_DESKTOP_NODE_EXECUTABLE="$DSH" ELECTRON_RUN_AS_NODE=1 "$DSH" --expose-internals --test "$file" 2>&1) || failed=1
  printf '%s\n' "$output" | grep -v "crashpad_client_win\|not connected"
}

run test/core.test.js
run test/client.test.js
run test/plugin.test.js
run test/process-tree.test.js

if [ "$failed" -ne 0 ]; then
  echo ""
  echo "FAILED" >&2
  exit 1
fi
echo ""
echo "all suites passed"
