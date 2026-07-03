import requests
import json

# --- START OF SCRIPT ---
print("--- Script started. ---")

# The URL for your new generic visualizer endpoint
url = "http://127.0.0.1:8001/python/visualize"
print(f"Target URL: {url}")

# A simple bubble sort algorithm as a multi-line string
bubble_sort_code = """
numbers = [3, 1, 4, 2]
n = len(numbers)
for i in range(n):
    for j in range(0, n-i-1):
        if numbers[j] > numbers[j+1]:
            numbers[j], numbers[j+1] = numbers[j+1], numbers[j]
"""

data = {"code": bubble_sort_code}

try:
    print("Sending request to the server... (will time out in 10 seconds)")
    # Add a timeout to prevent the script from hanging indefinitely
    response = requests.post(url, json=data, timeout=10)
    
    print(f"Status Code: {response.status_code}")
    print("--- Full Response ---")
    
    # Pretty-print the JSON response
    response_data = response.json()
    print(json.dumps(response_data, indent=2))

except requests.exceptions.Timeout:
    print("\n--- ERROR ---")
    print("The request timed out. This means the script could not connect to the server.")
    print("Please make sure your server is running and accessible at http://127.0.0.1:8001")

except requests.exceptions.ConnectionError:
    print("\n--- ERROR ---")
    print("Connection refused. The server is not running or is on a different port.")

except Exception as e:
    print(f"\n--- An unexpected error occurred: {e} ---")

print("--- Script finished. ---")
