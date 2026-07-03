def wavearray_final(arr):
    """Return the final wave array (fallback)."""
    n = len(arr)
    for i in range(0, n-1, 2):
        arr[i], arr[i+1] = arr[i+1], arr[i]
    return arr


def wavearray_steps(arr):
    """Return step-by-step transformations of the array for visualization."""
    steps = []
    arr_copy = arr[:]  # don’t modify original input

    for i in range(0, len(arr_copy)-1, 2):
        arr_copy[i], arr_copy[i+1] = arr_copy[i+1], arr_copy[i]
        steps.append({
            "step": i//2 + 1,
            "array": arr_copy[:]
        })

    return {"steps": steps, "final_array": arr_copy}

