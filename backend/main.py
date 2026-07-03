import asyncio
import sys
import os
import tempfile
from fastapi import WebSocket, WebSocketDisconnect

from pathlib import Path
from typing import List, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# --- Import AI and tracing functions ---
from backend.algorithms.wavearray import wavearray_steps
from backend.algorithms.bfs import bfs_steps
from backend.algorithms.dfs import dfs_steps
from backend.tracer import trace_python_code
# --- 1. Import the new variable mapper function ---
from backend.ai_explainer import get_ai_explanation, get_ai_summary, get_ai_variable_map

# --- NEW: Interactive Terminal Endpoint (WebSockets) ---
@app.websocket("/ws/run")
async def run_interactive_code(websocket: WebSocket):
    await websocket.accept()
    
    try:
        # 1. Receive the code from the client
        data = await websocket.receive_json()
        code = data.get("code", "")
        
        # 2. Save code to a temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as tmp:
            tmp.write(code)
            tmp_path = tmp.name

        # 3. Create a subprocess to run the code
        # We use asyncio to run it without blocking the server
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-u", tmp_path, # "-u" forces unbuffered output (crucial for real-time)
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # 4. Define tasks to read stdout/stderr and send to client
        async def read_stream(stream, channel):
            while True:
                line = await stream.read(1024) # Read in chunks
                if not line:
                    break
                try:
                    text = line.decode('utf-8')
                    await websocket.send_json({"type": channel, "data": text})
                except:
                    break

        # 5. Define task to receive input from client and write to stdin
        async def write_input():
            try:
                while True:
                    data = await websocket.receive_json()
                    if data.get("type") == "input":
                        user_input = data.get("data", "")
                        if process.stdin:
                            process.stdin.write(user_input.encode('utf-8'))
                            await process.stdin.drain()
            except WebSocketDisconnect:
                pass
            except Exception as e:
                print(f"Input error: {e}")

        # 6. Run all tasks concurrently
        input_task = asyncio.create_task(write_input())
        stdout_task = asyncio.create_task(read_stream(process.stdout, "stdout"))
        stderr_task = asyncio.create_task(read_stream(process.stderr, "stderr"))

        # Wait for process to finish
        await process.wait()
        
        # Cancel input listener since process is done
        input_task.cancel()
        await stdout_task
        await stderr_task
        
        # Notify client we are done
        await websocket.send_json({"type": "exit", "code": process.returncode})

    except Exception as e:
        await websocket.send_json({"type": "stderr", "data": f"\nError: {str(e)}\n"})
    finally:
        # Cleanup temp file
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.remove(tmp_path)
        try:
            await websocket.close()
        except:
            pass
        
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
CPP_DIR = BACKEND_DIR / "cpp"

app = FastAPI(title="Algorithms API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request Models ---
class WaveArrayRequest(BaseModel):
    numbers: List[int]

class GraphRequest(BaseModel):
    graph: Dict[str, List[int]]
    start: int

class CodeExecutionRequest(BaseModel):
    code: str
    inputs: List[str] = [] # For handling user input

class ExplainCodeRequest(BaseModel): 
    code_line: str

# --- NEW: Request Model for Summary ---
class SummarizeCodeRequest(BaseModel):
    code: str
    trace: List[Dict[str, Any]] # Send the whole trace

# --- Endpoints ---
@app.post("/python/wavearray")
def wavearray_py(req: WaveArrayRequest) -> Dict[str, Any]:
    """
    Runs the wave array algorithm (pre-defined).
    """
    return wavearray_steps(req.numbers)

@app.post("/python/bfs")
def bfs_py(req: GraphRequest) -> Dict[str, Any]:
    """
    Runs the BFS algorithm (pre-defined).
    """
    graph_int_keys = {int(k): v for k, v in req.graph.items()}
    return bfs_steps(graph_int_keys, req.start)

@app.post("/python/dfs")
def dfs_py(req: GraphRequest) -> Dict[str, Any]:
    """
    Runs the DFS algorithm (pre-defined).
    """
    graph_int_keys = {int(k): v for k, v in req.graph.items()}
    return dfs_steps(graph_int_keys, req.start)

# --- 2. Make the /visualize endpoint 'async def' ---
@app.post("/python/visualize")
async def visualize_py(req: CodeExecutionRequest) -> Dict[str, Any]:
    """
    Traces arbitrary Python code with user inputs.
    Now also calls the AI to create a variable map.
    """
    # 1. Run the tracer (this is synchronous)
    trace_data = trace_python_code(req.code, req.inputs)
    
    variable_map = {}
    try:
        # 2. Get the final variables from the trace
        if trace_data.get("steps"):
            final_step_vars = trace_data["steps"][-1].get("variables", {})
            var_names = list(final_step_vars.keys())
            
            # 3. Call the new async AI function
            if var_names:
                variable_map = await get_ai_variable_map(req.code, var_names)
                
    except Exception as e:
        print(f"Error during variable mapping: {e}")
        # Continue anyway, just with an empty map
    
    # 4. Add the map to the response
    trace_data["variable_map"] = variable_map
    
    return trace_data

@app.post("/python/explain") 
async def explain_py(req: ExplainCodeRequest) -> Dict[str, str]: 
    """
    Accepts a line of Python code and returns an AI-generated explanation.
    """
    explanation = await get_ai_explanation(req.code_line)
    return {"explanation": explanation}

# --- NEW: Endpoint for Summary ---
@app.post("/python/summarize")
async def summarize_py(req: SummarizeCodeRequest) -> Dict[str, str]:
    """
    Accepts the full code and trace, and returns an AI-generated summary.
    """
    if not req.trace:
        return {"summary": "Execution trace is empty, cannot generate summary."}
        
    # Send only the final step to the AI to save tokens
    final_step = req.trace[-1]
    summary = await get_ai_summary(req.code, final_step)
    return {"summary": summary}


@app.get("/")
def root() -> dict:
    """
    Root endpoint for health check.
    """
    return {"status": "ok"}