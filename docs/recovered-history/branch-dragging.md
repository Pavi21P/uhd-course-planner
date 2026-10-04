# Downstream branch dragging

Dragging a course follows directed original prerequisite links and stored custom
connections. It includes downstream logical gates and hidden completed courses.
Shared descendants move once, upstream courses outside that reachable branch
stay still, and isolated elective instances move alone. Cycles terminate through
an explicit visited set; a duplicate course card is a separate display node.

At drag start, the planner copies the reachable positions. Each preview is based
on this same snapshot and React Flow's world-coordinate position, so zoom/pan and
multiple pointer updates do not accumulate drift. One move batch is saved on
release, and one Undo restores the complete branch. A canceled drag does not
write the plan or create history. Escape, window blur, pointercancel and
 touchcancel freeze the original positions until release. Course-panel nudge and
reset controls remain single-card operations and are labeled accordingly.

Node measurements reported through onNodesChange are retained separately from
saved plan data. Controlled previews reuse those dimensions to avoid resetting
React Flow's initialized-node metadata. The node position data never comes from
completion bridges; hidden nodes are updated through the original graph.

Validation: six branch tests; 61 total tests; build, lint and tool typecheck pass.
Browser checks: 17 nodes moved by dragging CS 1411, one-step Undo/Redo, and a
0.833333-zoom drag of MATH 1404 including hidden CS 1411. Every moved node received
the same delta; MATH 1505 and disconnected elective CS 1408 remained stationary.
All test movements were undone and saved user positions/completion retained.
After the measurement fix, the repeated browser drag emitted no new warnings.
Cancellation logic is tested; browser automation did not separately interrupt a
held pointer gesture. Existing bundle-size warning is deferred to integration.

Integration reference: https://reactflow.dev/api-reference/react-flow
