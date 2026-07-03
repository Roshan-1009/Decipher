from collections import deque

def bfs_final(graph, start):
    """Return only the final BFS order (fallback)."""
    visited = set()
    queue = deque([start])
    order = []

    while queue:
        node = queue.popleft()
        if node not in visited:
            visited.add(node)
            order.append(node)
            queue.extend(graph.get(node, []))

    return order


def bfs_steps(graph, start):
    """Return step-by-step BFS states for visualization."""
    visited = set()
    queue = deque([start])
    order = []
    steps = []

    while queue:
        node = queue.popleft()
        if node not in visited:
            visited.add(node)
            order.append(node)
            
            # Save snapshot of current state AFTER processing current node
            steps.append({
                "current": node,
                "queue": list(queue),
                "visited": sorted(list(visited)),
                "order_so_far": list(order)
            })
            
            # Add unvisited neighbors to queue
            for neighbor in graph.get(node, []):
                if neighbor not in visited and neighbor not in queue:
                    queue.append(neighbor)

    return {"steps": steps, "final_order": order}