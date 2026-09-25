# P.02 Live Verification Marker

Disposable artifact — live verification of the `smg-approve` trust boundary after the P.02 merge (PR #81).

This branch/PR exists only to run `/approve` in a controlled way and confirm that the workflow checks out and executes `run.mjs` from the **default branch** (not the PR head).

Expected lifecycle: opened → `/approve` observed → evidence captured → **closed without merge**.
