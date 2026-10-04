# Plan
1. Save current baseline; preserve existing dirty branch/work.
2. Data agent: repair ingestion + query eligibility, recent additions contract and tests; identify population runtime/scheduler issue.
3. Quiz agent: restore handoff, remove own scores/provenance/normalized pricing; preserve declared SCA.
4. Scene agent: isolated Three.js scene with fallback, lifecycle cleanup and automatic motion preferences.
5. Root: home/navigation/catalog redesign, runtime workflow, integrate and verify browser end-to-end.
6. Run convergence against spec/tasks and save evidence/checkpoint.

Tradeoff: Three.js is the visual layer, HTML remains the browsing/quiz interface for keyboard access, search indexing and performance. Verified events remain distinct from additions; timestamps stay internal. User superseded initial studio illustration with a subtle Japanese-inspired background and removed visible playback controls.

Sources: https://nextjs.org/docs/app/getting-started/server-and-client-components ; https://threejs.org/manual/en/responsive.html ; https://threejs.org/manual/en/cleanup.html . Installed Next package has no node_modules/next/dist/docs directory, so official docs consulted.
