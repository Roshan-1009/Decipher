import sys
import copy
import io
from typing import List
import types # Still needed for filtering
from collections import deque # Still needed for make_serializable

# --- NEW: Set a max depth to prevent infinite recursion in complex objects ---
MAX_DEPTH = 10

def make_serializable(obj, seen=None, current_depth=0):
    """
    Recursively convert an object into a JSON-serializable format.
    Handles custom classes, data structures, and circular references.
    """
    
    # --- 1. Handle recursion depth ---
    if current_depth > MAX_DEPTH:
        return f"repr(Object too deep to serialize)"

    # --- 2. Handle basic types ---
    if isinstance(obj, (int, float, str, bool, type(None))):
        return obj

    # --- 3. Handle circular references ---
    # We use id() as a key because objects may not be hashable
    if seen is None:
        seen = set() # Initialize the 'seen' set
    
    obj_id = id(obj)
    if obj_id in seen:
        return f"repr(Circular reference to object at {obj_id})"
    
    seen.add(obj_id) # Mark this object as seen

    # --- 4. Handle collections (pass 'seen' and depth) ---
    if isinstance(obj, (list, tuple, deque)):
        return [make_serializable(item, seen, current_depth + 1) for item in obj]
    
    if isinstance(obj, set):
        # tracer.py already converts sets to lists, but we'll
        # handle it here just in case for the final step.
        return [make_serializable(item, seen, current_depth + 1) for item in list(obj)]
    
    if isinstance(obj, dict):
        return {str(k): make_serializable(v, seen, current_depth + 1) for k, v in obj.items()}

    # --- 5. Handle custom objects/classes ---
    # Check for __dict__ to find user-defined attributes
    if hasattr(obj, '__dict__'):
        # It's a custom class! Serialize its properties.
        obj_dict = {
            "__type__": obj.__class__.__name__, # So frontend knows what it is
        }
        
        # Recurse on its attributes
        for key, value in obj.__dict__.items():
            if not key.startswith('__'): # Ignore internal attributes
                obj_dict[key] = make_serializable(value, seen, current_depth + 1)
        
        # If no serializable attributes were found, fall back to repr
        if len(obj_dict) == 1: # Only contains "__type__"
             return repr(obj)
             
        return obj_dict

    # --- 6. Fallback for any other type ---
    return repr(obj)

# --- THIS IS THE LIST OF INTERNAL VARS TO HIDE ---
# We define it once so both the tracer and final step can use it.
INTERNAL_VARS_TO_HIDE = [
    'MockInput', 'tracer', 'mock_input_function', 'output_capture', 
    'trace_python_code', 'make_serializable', 'sys', 'copy', 'io', 'List', 
    'types', 'deque', 'MAX_DEPTH', 'INTERNAL_VARS_TO_HIDE',
    'input', '__builtins__' # From the exec globals
]

def trace_python_code(code_string: str, inputs: List[str] = []):
    """
    Executes and traces arbitrary Python code, capturing variable states,
    standard output, and handling mocked user input.
    """
    trace = []
    output_capture = io.StringIO()
    
    class MockInput:
        def __init__(self, inputs_list):
            self.inputs = [val for val in inputs_list if val.strip() != '' or val == '']
            self.index = 0

        def __call__(self, prompt=""):
            output_capture.write(str(prompt))
            if self.index < len(self.inputs):
                value = self.inputs[self.index]
                self.index += 1
                output_capture.write(f"{value}\n")
                return value
            raise EOFError("End of input. More inputs were requested by the code than were provided.")

    mock_input_function = MockInput(inputs)

    def tracer(frame, event, arg):
        if event == 'line':
            variables = {}
            
            # Combine global and local variables
            all_vars = {**frame.f_globals, **frame.f_locals} 
            
            for name, value in all_vars.items():
                # --- THIS IS THE FIX ---
                # Filter out internals, modules, functions, and class definitions
                if (not name.startswith('__') and name not in INTERNAL_VARS_TO_HIDE
                and not isinstance(value, (types.ModuleType, types.FunctionType, type))): 
                    
                    variables[name] = make_serializable(value, seen=set())


            current_output = output_capture.getvalue()

            trace.append({
                "line": frame.f_lineno,
                "event": "line",
                "variables": variables,
                "output": current_output
            })
        return tracer

    # Pass the mock input function to exec()
    execution_globals = {
        '__builtins__': __builtins__,
        'input': mock_input_function,
    }
    
    original_trace = sys.gettrace()
    original_stdout = sys.stdout 
    sys.stdout = output_capture
    sys.settrace(tracer)
    
    try:
        exec(code_string, execution_globals) # Pass globals
    except Exception as e:
        sys.settrace(original_trace)
        sys.stdout = original_stdout 
        error_line = trace[-1]['line'] if trace else 'an early'
        final_output = output_capture.getvalue()
        return {"steps": trace, "error": f"Execution Error near line {error_line}: {type(e).__name__}: {e}", "final_output": final_output}
    finally:
        sys.settrace(original_trace)
        sys.stdout = original_stdout
    
    final_output = output_capture.getvalue()
    
    # --- CAPTURE FINAL VARIABLES ---
    final_variables = {}
    for name, value in execution_globals.items():
        # --- THIS IS THE FIX ---
        # Filter out internals, modules, functions, and class definitions
        if (not name.startswith('__') and name not in INTERNAL_VARS_TO_HIDE
        and not isinstance(value, (types.ModuleType, types.FunctionType, type))):

            final_variables[name] = make_serializable(value, seen=set())

    trace.append({
        "line": None,
        "event": "finished",
        "variables": final_variables,
        "output": final_output
    })
        
    return {"steps": trace, "error": None, "final_output": final_output}