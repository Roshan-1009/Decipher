import httpx
import json # <-- RE-ADDED: Need this for serializing the trace AND parsing the new AI response
from typing import List # <-- NEW: Import List for type hinting

# httpx handles JSON encoding/decoding automatically.

import os
API_KEY = "AIzaSyACkydJiSec7Tuxi3TvEKg_me72kAasxIo"

API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"

# This system prompt guides the AI to be a helpful tutor
SYSTEM_PROMPT = "You are an expert Python tutor. Explain the following line of code to a beginner in one or two simple sentences, in a friendly and encouraging tone. Do not be overly technical."

# --- NEW: System Prompt for the Summary Feature ---
SUMMARY_SYSTEM_PROMPT = """
You are an expert Python tutor. You will be given a user's Python code and the final step of its execution trace.
Your job is to provide a high-level, concise summary (2-4 sentences) explaining the final outcome of the code.

- Explain what the code accomplished (e.g., "The code successfully built a list...").
- Use the 'variables' and 'output' from the final trace step to describe the result.
- If there was an error, briefly explain the error.
- Be friendly, encouraging, and easy to understand. Do not just repeat the code line by line.
"""

# --- NEW: System Prompt for the Variable Mapper ---
VARIABLE_MAPPER_SYSTEM_PROMPT = """
You are a Python code analyzer. You will be given a user's Python code and a list of its variables.
Based on how the variables are used, map each variable to its most likely data structure type.
The valid types are: 'graph', 'stack', 'queue','binary_tree','linked_list', 'dictionary', 'set', 'heap' (or 'priority_queue'), or 'other'.
Respond in JSON format ONLY. Do not include any other text, explanations, or markdown.

Example:
Code:
'''
g = {0: [1], 1: [0]}
q = [0]
q.pop(0)
'''
Variables: ['g', 'q']

Your JSON response:
{
  "g": "graph",
  "q": "queue"
}
"""

async def get_ai_explanation(code_line: str) -> str:
    """
    Sends a line of code to the Gemini API and returns a simple explanation.
    """
    
    # This is the payload we send to the Gemini API
    payload = {
        "contents": [{ "parts": [{ "text": code_line }] }],
        "systemInstruction": {
            "parts": [{ "text": SYSTEM_PROMPT }]
        }
    }
    print(f"DEBUG: Requesting URL -> {API_URL}")
    try:
        # Use httpx for an asynchronous API call
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                API_URL, 
                json=payload, # This 'json=' is an argument name, not the module
                headers={"Content-Type": "application/json"}
            )
            # Raise an error if the request was unsuccessful
            response.raise_for_status() 
            
            result = response.json() # This '.json()' is a method of the response object
            
            # Extract the text from the AI's response
            text = result.get("candidates")[0].get("content").get("parts")[0].get("text")
            return text.strip()
            
    except httpx.HTTPStatusError as e:
        print(f"HTTP Error: {e.response.status_code} - {e.response.text}")
        return f"Error from AI: {e.response.status_code}"
    except Exception as e:
        print(f"AI Explainer Error: {e}") # Log the error to the server console
        return "Error: Could not get explanation at this time."

# --- NEW: Function for getting the overall summary ---
async def get_ai_summary(code: str, final_step: dict) -> str:
    """
    Sends the full code and the final execution step to the Gemini API
    and returns a high-level summary.
    """
    
    # Create a clean prompt for the AI
    user_prompt = f"""
Here is my Python code:
---
{code}
---

Here is the final step of the execution trace, which shows the final variables, output, and any errors:
---
{json.dumps(final_step, indent=2)}
---

Please provide a summary of what this code did, based on its final state.
"""
    
    payload = {
        "contents": [{ "parts": [{ "text": user_prompt }] }],
        "systemInstruction": {
            "parts": [{ "text": SUMMARY_SYSTEM_PROMPT }]
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                API_URL, 
                json=payload, 
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            result = response.json()
            text = result.get("candidates")[0].get("content").get("parts")[0].get("text")
            return text.strip()
            
    except httpx.HTTPStatusError as e:
        print(f"HTTP Error (Summary): {e.response.status_code} - {e.response.text}")
        return f"Error from AI: {e.response.status_code}"
    except Exception as e:
        print(f"AI Summary Error: {e}")
        return "Error: Could not get summary at this time."


# --- NEW: Function for the Variable Mapper ---
async def get_ai_variable_map(code: str, var_names: List[str]) -> dict:
    """
    Sends the code and variable names to the AI to get a type map.
    """
    
    if not var_names:
        return {} # No variables to map

    user_prompt = f"""
Code:
---
{code}
---
Variables: {var_names}

Your JSON response:
"""
    
    payload = {
        "contents": [{ "parts": [{ "text": user_prompt }] }],
        "systemInstruction": {
            "parts": [{ "text": VARIABLE_MAPPER_SYSTEM_PROMPT }]
        },
        # --- NEW: Force JSON output ---
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                API_URL, 
                json=payload, 
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            result = response.json()
            
            # The AI's response text *is* the JSON
            text = result.get("candidates")[0].get("content").get("parts")[0].get("text")
            
            # Parse the JSON string into a Python dict
            return json.loads(text)
            
    except Exception as e:
        print(f"AI Variable Map Error: {e}")
        # On failure, return an empty map so the frontend doesn't break
        return {}