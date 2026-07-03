import requests
import json

# The URL for your local BFS endpoint
url = "http://127.0.0.1:8000/python/bfs"

# The graph data, now sent as a dictionary (adjacency list)
data = {
    "graph": {
        "0": [1, 2],
        "1": [0, 3],
        "2": [0],
        "3": [1]
    },
    "start": 0
}

try:
    # Send the request
    response = requests.post(url, json=data)
    print("Status Code:", response.status_code)
    print("Response:")
    # Pretty-print the JSON response to see the steps clearly
    print(json.dumps(response.json(), indent=2))

except requests.exceptions.ConnectionError as e:
    print("Error: Connection refused.")
    print("Please make sure your FastAPI server is running.")
except Exception as e:
    print("An error occurred:", e)