# Planning engine implementation plan

1. Write and run failing pure-engine tests for a 10×12 shed and variant/invalid inputs.
2. Implement deterministic, separated takeoff geometry, editable example pricing, cut lists and foundation-specific steps. Keep structural sizing explicitly provisional.
3. Test and implement bounded image selection/compression and an optional, server-only vision route. Validate images and structured responses; suggestions never change geometry without confirmation.
4. Connect the four-step wizard, options, price editor, dimensioned SVG and printable output.
5. Verify lint, tests, production build and local HTTP smoke checks; document assumptions and configuration. Commit locally only.

Default case: wood shed, 10×12×8 ft, 6/12 gable, 12-inch overhang, 16-inch framing, skids, one 3-ft-wide × 7-ft-high door and two 3×3-ft windows. Quantities use approximately 10% purchasing waste; cut list is net, not a stock optimization/certified cutting schedule. Rectangular footprint, width is roof span, ridge runs along length. No load/span adequacy inferred from dimensions or photos. Other structure types are preliminary shell estimates, not complete residential or garage designs.
