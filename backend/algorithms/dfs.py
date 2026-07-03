def dfs_steps(graph, start):
    """Return step-by-step DFS states for visualization."""
    visited = set()
    stack = [start]
    order = []
    steps = []

    while stack:
        node = stack.pop()

        if node not in visited:
            visited.add(node)
            order.append(node)

            # Save a snapshot of the current state
            steps.append({
                "current": node,
                "stack": list(stack),
                "visited": sorted(list(visited)),
                "order_so_far": list(order)
            })

            # Add unvisited neighbors to the stack
            # Reverse to maintain a more intuitive traversal order
            for neighbor in reversed(graph.get(node, [])):
                if neighbor not in visited:
                    stack.append(neighbor)

    return {"steps": steps, "final_order": order}