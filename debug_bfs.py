from backend.algorithms.bfs import bfs_steps

# Test the BFS function directly
graph = {0: [1, 2], 1: [0, 3], 2: [0], 3: [1]}
start = 0

result = bfs_steps(graph, start)
print("Direct function result:")
print(result)
print("\nSteps:")
for i, step in enumerate(result["steps"]):
    print(f"Step {i+1}: {step}")
