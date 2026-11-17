#!/bin/sh
# Run the plugin's tests.
#
# These cover the pure logic only: prompt assembly, layout maths, settings persistence, and the
# in-page selection helper. Nothing here touches the mouse, the clipboard, or real windows —
# anything that drives the desktop is verified by hand, because a test that synthesizes input
# fights whatever else the machine is doing and reports that conflict as a failure.
set -e
DSH="/c/Users/75791/AppData/Local/Programs/DeepSeek Harness/DeepSeek Harness.exe"
here=$(dirname "$0")

run() {
  echo ""
  echo "=== $1 ==="
  DSH_DESKTOP_NODE_EXECUTABLE="$DSH" ELECTRON_RUN_AS_NODE=1 "$DSH" --expose-internals --test "$here/$1" 2>&1 |
    grep -v "crashpad_client_win\|not connected"
}

run test/core.test.js
run test/client.test.js
run test/plugin.test.js
run test/process-tree.test.js
