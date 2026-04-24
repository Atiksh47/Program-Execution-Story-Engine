from backend.models import CallTreeNode, TraceEvent


def _is_recursive(events: list[TraceEvent]) -> bool:
    """Return True if any function calls itself (appears in its own call stack)."""
    for e in events:
        if e.event == "call" and e.func_name != "<module>":
            # call_stack includes func_name at the end (pushed before event emit);
            # check if it was already present before this call
            if e.func_name in e.call_stack[:-1]:
                return True
    return False


def build_call_tree(events: list[TraceEvent]) -> CallTreeNode | None:
    """
    Post-process trace events into a call tree.
    Returns None for non-recursive programs (no interesting tree to show).
    """
    if not events or not _is_recursive(events):
        return None

    root = CallTreeNode(
        id=0,
        func_name="<module>",
        start_step=events[0].step,
        end_step=events[-1].step,
        depth=0,
    )

    stack: list[CallTreeNode] = [root]
    node_id = 1

    for event in events:
        if event.event == "call" and event.func_name != "<module>":
            node = CallTreeNode(
                id=node_id,
                func_name=event.func_name,
                args={k: str(v) for k, v in list(event.locals.items())[:4]},
                start_step=event.step,
                depth=event.depth,
            )
            node_id += 1
            stack[-1].children.append(node)
            stack.append(node)

        elif event.event == "return" and event.func_name != "<module>":
            if len(stack) > 1:
                top = stack[-1]
                top.end_step = event.step
                top.return_value = event.return_value
                stack.pop()

    return root
