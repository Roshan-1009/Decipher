import React, { useState, useRef, useEffect } from "react";
// import html2canvas from 'html2canvas'; // <-- 1. REMOVED
// import GIF from 'gif.js.optimized'; // <-- 2. REMOVED

// --- NEW IMPORTS HERE ---
// src/App.jsx

// --- REPLACE THESE IMPORTS ---
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css"; // This gives the dark "VS Code" look
import "prismjs/components/prism-python";
// -----------------------------

import Editor from 'react-simple-code-editor';
// Remove the old: import { highlight, languages } from 'prismjs/components/prism-core';
// --- CSS (GlobalStyles Component) ---
const GlobalStyles = () => (
    <style>{`
    /* Minimal base styles - Tailwind handles the rest */
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
    }
    /* Custom scrollbar styles */
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    /* Graph styles */
     .graph-node text {
      font-size: 14px;
      font-weight: bold;
      text-anchor: middle;
      dominant-baseline: middle; /* Better vertical centering */
      fill: #fff; /* White text inside nodes */
      pointer-events: none;
    }
     .graph-edge {
      stroke: #38bdf8; /* Tailwind: stroke-sky-500 */
      stroke-width: 2px;
      stroke-opacity: 0.7;
    }

    /* --- NEW: Binary Tree CSS --- */
    .tree-node {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem 0.5rem;
    }
      /* 1. Functions (Blue) */
    .token.function, .token.builtin {
        color: #38bdf8 !important; 
        font-weight: bold;
    }

    /* 2. Strings (Orange) */
    .token.string {
        color: #fbbf24 !important; 
    }

    /* 3. Keywords (Purple) */
    .token.keyword {
        color: #c084fc !important; 
        font-style: italic;
    }

    /* 4. Remove default outline */
    .npm__react-simple-code-editor__textarea {
        outline: none !important;
    }
    .tree-node-value {
      background-color: #e0f2fe; /* sky-100 */
      border: 1px solid #38bdf8; /* sky-500 */
      color: #0c4a6e; /* sky-900 */
      border-radius: 9999px; /* rounded-full */
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      z-index: 10;
    }
    .tree-children {
      display: flex;
      position: relative;
      padding-top: 1.5rem;
    }
    /* Horizontal line from parent to children */
    .tree-children::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      height: 1.5rem;
      width: 2px;
      background-color: #38bdf8; /* sky-500 */
    }
    /* Connecting lines for children */
    .tree-node > .tree-children > .tree-node::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      height: 2px;
      width: 100%;
      background-color: #38bdf8; /* sky-500 */
    }
    .tree-node > .tree-children > .tree-node:first-child::before {
      left: 50%;
      width: 50%;
    }
    .tree-node > .tree-children > .tree-node:last-child::before {
      left: 0;
      width: 50%;
    }
    .tree-node > .tree-children > .tree-node:only-child::before {
      display: none; /* No horizontal line if only one child */
    }
  `}</style>
);


// --- GraphVisualizer Component ---
// This component is "dumb" and just renders what it's given.
// The "smart" logic is in StateVisualizer.
const GraphVisualizer = ({ name, graphData, variables }) => {
    const currentState = variables;
    // --- DYNAMIC NODE MAPPING ---
    const staticPositions = [
        { x: 300, y: 50 }, { x: 150, y: 130 }, { x: 450, y: 130 },
        { x: 100, y: 220 }, { x: 200, y: 220 }, { x: 400, y: 220 },
        { x: 50, y: 50 }, { x: 550, y: 50 }, { x: 50, y: 250 }, { x: 550, y: 250 }
    ];
    const nodeIds = Object.keys(graphData);
    const nodePositions = nodeIds.reduce((acc, nodeId, index) => {
        acc[nodeId] = staticPositions[index % staticPositions.length];
        return acc;
    }, {});
    const nodes = nodeIds.map(id => ({
        id: id,
        ...(nodePositions[id] || { x: 50, y: 50 })
    }));
    const edges = [];
    Object.entries(graphData).forEach(([sourceId, neighbors]) => {
        if (Array.isArray(neighbors)) {
            neighbors.forEach(targetId => {
                const sourceStr = String(sourceId);
                const targetStr = String(targetId);
                if (nodePositions[sourceStr] && nodePositions[targetStr] && sourceStr < targetStr) {
                    edges.push({ source: sourceStr, target: targetStr, id: `${sourceStr}-${targetStr}` });
                }
            });
        }
    });
    // --- ROBUST NODE FILL LOGIC ---
    const getNodeFill = (nodeId) => {
        // Find variable names from the map
        const queueVarName = Object.keys(variables.variable_map || {}).find(k => variables.variable_map[k] === 'queue');
        const stackVarName = Object.keys(variables.variable_map || {}).find(k => variables.variable_map[k] === 'stack');

        // Get data from those variables, or default to checking hardcoded names
        const queue = (queueVarName && Array.isArray(variables[queueVarName])) ? variables[queueVarName] : (Array.isArray(variables.queue) ? variables.queue : []);
        const stack = (stackVarName && Array.isArray(variables[stackVarName])) ? variables[stackVarName] : (Array.isArray(variables.stack) ? variables.stack : []);
        const visited = Array.isArray(variables.visited) ? variables.visited : (variables.visited instanceof Set ? Array.from(variables.visited) : []);

        const currentNode = currentState.current_node ?? currentState.current ?? currentState.node;
        const nodeIdStr = String(nodeId);
        if (String(currentNode) === nodeIdStr) return '#d62728';
        const frontier = queue.length > 0 ? queue : stack;
        if (Array.isArray(frontier) && frontier.map(String).includes(nodeIdStr)) return '#ffd700';
        const visitedStrings = visited.map(String);
        if (visitedStrings.includes(nodeIdStr)) return '#ff7f0e';
        return '#0f172a';
    };

    return (
        <div className="mb-4">
            <span className="font-semibold font-mono text-sm text-gray-300">{name} =</span>
            <svg className="graph-svg w-full h-[300px] border border-gray-700 rounded bg-gray-900 mt-1" viewBox="0 0 600 300">
                {edges.map(edge => (<line key={edge.id} className="graph-edge" x1={nodePositions[edge.source]?.x} y1={nodePositions[edge.source]?.y} x2={nodePositions[edge.target]?.x} y2={nodePositions[edge.target]?.y} />))}
                {nodes.map(node => (<g key={node.id} className="graph-node"><circle cx={node.x} cy={node.y} r="22" fill={getNodeFill(node.id)} stroke="#38bdf8" strokeWidth="2" /><text x={node.x} y={node.y} >{node.id}</text> </g>))}
            </svg>
        </div>
    );
};

// --- StackVisualizer Component (UPGRADED) ---
const StackVisualizer = ({ name, stack }) => {
    // Smart Data Finder
    let stackItems = [];
    if (Array.isArray(stack)) {
        stackItems = stack;
    } else if (stack && typeof stack === 'object') {
        // Look for 'items', 'stack', 'data', or ANY array property
        if (Array.isArray(stack.items)) stackItems = stack.items;
        else if (Array.isArray(stack.stack)) stackItems = stack.stack; // Matches your self.stack
        else if (Array.isArray(stack.data)) stackItems = stack.data;
        else {
            // Fallback: Find the first array property in the object
            const firstArray = Object.values(stack).find(val => Array.isArray(val));
            if (firstArray) stackItems = firstArray;
        }
    }

    return (
        <div className="mb-4">
            <div className="flex justify-between items-end mb-1">
                <span className="font-semibold font-mono text-sm text-gray-300">{name}</span>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Stack</span>
            </div>

            <div className="flex flex-col-reverse items-center justify-start border border-gray-700 rounded-lg bg-gray-900/50 p-2 min-h-[150px] max-h-64 overflow-auto scrollbar-hide relative">
                {stackItems.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-gray-600 text-xs italic">Empty</span>
                    </div>
                )}
                {stackItems.map((item, index) => (
                    <div
                        key={`${item}-${index}`}
                        className={`flex items-center justify-center w-3/4 px-3 py-2 my-0.5 border border-yellow-500 bg-yellow-200/90 text-yellow-900 rounded text-xs font-bold shadow-sm transition-all hover:scale-105 ${index === stackItems.length - 1 ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900' : ''}`}
                    >
                        {String(item)}
                    </div>
                ))}
                <div className="w-full flex justify-between px-4 text-[9px] text-gray-500 font-mono mt-auto pt-2 border-t border-gray-800/50">
                    <span>BOTTOM</span>
                    {stackItems.length > 0 && <span>TOP</span>}
                </div>
            </div>
        </div>
    );
};

// --- QueueVisualizer Component (UPGRADED) ---
const QueueVisualizer = ({ name, queue }) => {
    // --- THIS IS THE FIX ---
    // The 'queue' prop could be a simple array [A, B] (from a deque)
    // OR our serialized custom class { "__type__": "Queue", "items": [A, B] }
    // We check for the .items property and use that if it exists.
    let queueItems = [];
    if (Array.isArray(queue)) {
        queueItems = queue; // It's a simple list (like from a deque)
    } else if (queue && queue.items && Array.isArray(queue.items)) {
        queueItems = queue.items; // It's our custom Queue class!
    }
    // --- END OF FIX ---

    return (
        <div className="mb-4">
            <span className="font-semibold font-mono text-sm text-gray-300">{name} =</span>
            <div className="flex items-center gap-2 mt-1 border border-gray-700 rounded-lg bg-gray-900 p-2 min-h-[56px] max-w-full overflow-x-auto scrollbar-hide">
                <span className="text-xs text-gray-500 mr-2 flex-shrink-0">Front</span>
                {queueItems.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-gray-500 text-xs italic">Queue is empty</span>
                    </div>
                )}
                {/* Use queueItems here */}
                {queueItems.map((item, index) => (
                    <div
                        key={`${item}-${index}`}
                        className="border border-green-400 bg-green-100 text-green-900 px-3 py-2 rounded text-xs text-center font-medium flex-shrink-0"
                    >
                        {String(item)}
                    </div>
                ))}
                <span className="text-xs text-gray-500 ml-auto flex-shrink-0">Back</span>
            </div>
        </div>
    );
};

// --- Dictionary/Hash Map Visualizer ---
const DictionaryVisualizer = ({ name, dictionary }) => {
    const entries = Object.entries(dictionary);

    return (
        <div className="mb-4">
            <span className="font-semibold font-mono text-sm text-gray-300">{name} =</span>
            <div className="mt-1 border border-gray-700 rounded-lg bg-gray-900 max-h-48 overflow-auto scrollbar-hide">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr>
                            <th className="p-2 font-semibold text-amber-400 font-mono w-1/3">Key</th>
                            <th className="p-2 font-semibold text-amber-400 font-mono">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {entries.length === 0 && (
                            <tr>
                                <td colSpan="2" className="p-2 text-gray-500 italic text-center">Dictionary is empty</td>
                            </tr>
                        )}
                        {entries.map(([key, value]) => (
                            <tr key={key}>
                                <td className="p-2 font-mono text-green-300">{String(key)}</td>
                                <td className="p-2 font-mono text-white">{String(value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Set Visualizer ---
const SetVisualizer = ({ name, set }) => {
    const items = Array.isArray(set) ? set : [];

    return (
        <div className="mb-4">
            <span className="font-semibold font-mono text-sm text-gray-300">{name} = set()</span>
            <div className="flex flex-wrap gap-1 mt-1 border border-gray-700 rounded-lg bg-gray-900 p-2 min-h-[56px]">
                {items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-gray-500 text-xs italic">Set is empty</span>
                    </div>
                )}
                {items.map((item, index) => (
                    <div
                        key={`${item}-${index}`}
                        className="border border-purple-400 bg-purple-100 text-purple-900 px-3 py-1 rounded text-xs min-w-[30px] text-center font-medium"
                    >
                        {String(item)}
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Heap (Priority Queue) Visualizer ---
const HeapVisualizer = ({ name, heap }) => {
    const items = Array.isArray(heap) ? heap : [];

    return (
        <div className="mb-4">
            <span className="font-semibold font-mono text-sm text-gray-300">{name} = heap[]</span>
            <div className="flex items-center gap-2 mt-1 border border-gray-700 rounded-lg bg-gray-900 p-2 min-h-[56px] max-w-full overflow-x-auto scrollbar-hide">
                <span className="text-xs text-gray-500 mr-2 flex-shrink-0">Root (Min)</span>
                {items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-gray-500 text-xs italic">Heap is empty</span>
                    </div>
                )}
                {items.map((item, index) => (
                    <div
                        key={`${item}-${index}`}
                        className={`border ${index === 0
                            ? 'border-yellow-400 bg-yellow-100 text-yellow-900 font-bold'
                            : 'border-gray-600 bg-gray-700 text-white'
                            } px-3 py-2 rounded text-xs text-center font-medium flex-shrink-0`}
                    >
                        {String(item)}
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- LinkedList Visualizer ---
const LinkedListVisualizer = ({ name, list }) => {
    // Helper function to recursively parse the linked list
    const parseList = (node) => {
        if (!node || typeof node !== 'object' || node === null) {
            return null; // End of list
        }

        if (typeof node === 'string' && node.includes('Circular reference')) {
            return { data: '...', next: null };
        }

        // --- FIX: Use .data (or .key for the tree) ---
        const data = node.data; // Changed from node.key
        const nextNode = node.next;

        return {
            data: data,
            next: parseList(nextNode) // Recurse
        };
    };

    // Helper function to build the nodes array from the parsed list
    const buildNodes = (head) => {
        const nodes = [];
        let current = head;
        while (current) {
            nodes.push(current.data);
            current = current.next;
        }
        return nodes;
    };

    // Start parsing from the head
    // Check if the list object itself and its head exist
    const headNode = (list && list.head) ? parseList(list.head) : null;
    const nodes = headNode ? buildNodes(headNode) : [];

    // Handle case where list exists but head is null
    if (list && !list.head) {
        return (
            <div className="mb-4">
                <span className="font-semibold font-mono text-sm text-gray-300">{name} =</span>
                <div className="flex items-center gap-1 mt-1 border border-gray-700 rounded-lg bg-gray-900 p-2 min-h-[56px] max-w-full overflow-x-auto scrollbar-hide">
                    <span className="text-xs text-gray-500 mr-2 flex-shrink-0">Head</span>
                    <span className="text-gray-500 text-xs ml-1 flex-shrink-0">None</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-4">
            <span className="font-semibold font-mono text-sm text-gray-300">{name} =</span>
            <div className="flex items-center gap-1 mt-1 border border-gray-700 rounded-lg bg-gray-900 p-2 min-h-[56px] max-w-full overflow-x-auto scrollbar-hide">
                <span className="text-xs text-gray-500 mr-2 flex-shrink-0">Head</span>
                {nodes.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-gray-500 text-xs italic">Linked List is empty</span>
                    </div>
                )}

                {nodes.map((data, index) => (
                    <React.Fragment key={index}>
                        {/* Node */}
                        <div
                            className="border border-sky-400 bg-sky-100 text-sky-900 px-3 py-2 rounded text-xs text-center font-medium flex-shrink-0"
                        >
                            {String(data)}
                        </div>
                        {/* Arrow */}
                        {index < nodes.length - 1 && (
                            <span className="text-sky-400 font-mono text-lg flex-shrink-0">→</span>
                        )}
                    </React.Fragment>
                ))}

                {nodes.length > 0 && (
                    <React.Fragment>
                        <span className="text-sky-400 font-mono text-lg flex-shrink-0">→</span>
                        <span className="text-gray-500 text-xs ml-1 flex-shrink-0">None</span>
                    </React.Fragment>
                )}
            </div>
        </div>
    );
};


// --- NEW: Binary Tree Visualizer ---
const BinaryTreeVisualizer = ({ name, root }) => {

    // This is a recursive helper component to render the tree
    const TreeNode = ({ node }) => {
        // Base case: If node is null (or not an object), don't render anything
        if (!node || typeof node !== 'object' || node === null) {
            return null;
        }

        // Check for serialized 'None'
        if (typeof node === 'string' && node.includes('None')) {
            return null;
        }

        // Check for circular reference
        if (typeof node === 'string' && node.includes('Circular reference')) {
            return <div className="tree-node-value">...</div>;
        }

        // The tracer serializes our Node class with 'key', 'left', 'right'
        // --- FIX: Use .key (or .data for linked list) ---
        const { key, left, right } = node;

        const hasChildren = (left && (left.key !== undefined)) || (right && (right.key !== undefined));

        return (
            <div className="tree-node">
                {/* This node's value */}
                <div className="tree-node-value" title={`Node(${key})`}>
                    {String(key)}
                </div>

                {/* Render this node's children */}
                {hasChildren && (
                    <div className="tree-children">
                        <TreeNode node={left} />
                        <TreeNode node={right} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="mb-4">
            <span className="font-semibold font-mono text-sm text-gray-300">{name} =</span>
            <div className="mt-1 border border-gray-700 rounded-lg bg-gray-900 p-4 max-w-full overflow-x-auto scrollbar-hide">
                {/* --- FIX: Check for root.key --- */}
                {(!root || (root.key === undefined)) ? (
                    <span className="text-gray-500 text-xs italic">Tree is empty</span>
                ) : (
                    <TreeNode node={root} />
                )}
            </div>
        </div>
    );
};


// --- VariableDisplay Component (UPGRADED) ---
const VariableDisplay = ({ variables, variableMap }) => {
    if (!variables || typeof variables !== 'object') return null;

    const vizMap = variableMap || {};

    const specialVarNames = Object.keys(vizMap).filter(name =>
        vizMap[name] === 'graph' ||
        vizMap[name] === 'stack' ||
        vizMap[name] === 'queue' ||
        vizMap[name] === 'dictionary' ||
        vizMap[name] === 'set' ||
        vizMap[name] === 'heap' ||
        vizMap[name] === 'priority_queue' ||
        vizMap[name] === 'linked_list' ||
        vizMap[name] === 'binary_tree' // <-- ADD THIS
    );

    const internalVars = ['current_node', 'current', 'node', 'neighbors', 'start_node', 'start', 'variable_map'];

    const nonSpecialVars = Object.entries(variables).filter(([name]) =>
        !specialVarNames.includes(name) && !internalVars.includes(name)
    );

    if (nonSpecialVars.length === 0) return <p className="text-gray-500 text-xs italic">(No other variables to show)</p>;

    return (
        <div>
            <h3 className="text-md font-semibold mb-2 text-gray-400 flex-shrink-0">Other Variables</h3>
            {nonSpecialVars.map(([name, value]) => {

                if (Array.isArray(value)) {
                    return (
                        <div key={name} className="mb-4">
                            <span className="font-semibold font-mono text-sm text-gray-300">{name} =</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {value.map((item, index) => (
                                    <div key={`${item}-${index}`} className="border border-blue-400 bg-blue-100 text-blue-900 px-3 py-1 rounded text-xs min-w-[30px] text-center font-medium">
                                        {String(item)}
                                    </div>
                                ))}
                                {value.length === 0 && <span className="text-gray-500 text-xs italic">(empty list)</span>}
                            </div>
                        </div>
                    );
                }

                // Simple Variable Display
                if (typeof value !== 'object' || value === null) {
                    return (
                        <div key={name} className="mb-2">
                            <span className="font-semibold font-mono text-sm text-gray-300">{name} = </span>
                            <span className="text-sm text-green-300">{String(value)}</span>
                        </div>
                    );
                }

                // Fallback for complex objects that weren't mapped
                if (typeof value === 'object' && value !== null && value.__type__) {
                    return (
                        <div key={name} className="mb-2">
                            <span className="font-semibold font-mono text-sm text-gray-300">{name} = </span>
                            <span className="text-sm text-gray-500">{`[${value.__type__} object]`}</span>
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
}

// --- StateVisualizer Component (UPGRADED) ---
const StateVisualizer = ({ variables, variableMap, isFinished }) => {
    if (!variables || typeof variables !== 'object' || Object.keys(variables).length === 0) {
        if (isFinished) return <div className="mt-4 p-2 text-center text-green-400 bg-green-900/50 rounded border border-green-700">Execution Finished!</div>;
        return <p className="text-gray-500 text-xs italic">(No variables to show for this step)</p>;
    }
    // This calls the function you defined!
    const vizMap = variableMap || inferVariableMap(variables);
    Object.entries(variables).forEach(([name, value]) => {
        // If the AI already mapped it, skip.
        if (vizMap[name]) return;

        // 1. Detect by Class Name (e.g., class Stack)
        if (value && typeof value === 'object' && value.__type__) {
            const type = value.__type__.toLowerCase();
            if (type.includes('stack')) vizMap[name] = 'stack';
            if (type.includes('queue')) vizMap[name] = 'queue';
            if (type.includes('node') || type.includes('tree')) vizMap[name] = 'binary_tree';
            if (type.includes('graph')) vizMap[name] = 'graph';
            if (type.includes('list') && value.next) vizMap[name] = 'linked_list'; // Linked List heuristic
        }

        // 2. Detect by Variable Name (Fallback)
        // If I name my variable 'myStack', it should look like a stack!
        const lowerName = name.toLowerCase();
        if (Array.isArray(value)) {
            if (lowerName.includes('stack')) vizMap[name] = 'stack';
            else if (lowerName.includes('queue')) vizMap[name] = 'queue';
            else if (lowerName.includes('heap')) vizMap[name] = 'heap';
        }
    });
    // --- Add treeVar ---
    let graphVar = null, stackVar = null, queueVar = null, dictVar = null, setVar = null, heapVar = null, linkedListVar = null, treeVar = null;

    for (const name in vizMap) {
        if (vizMap[name] === 'graph') graphVar = name;
        if (vizMap[name] === 'stack') stackVar = name;
        if (vizMap[name] === 'queue') queueVar = name;
        if (vizMap[name] === 'dictionary') dictVar = name;
        if (vizMap[name] === 'set') setVar = name;
        if (vizMap[name] === 'heap' || vizMap[name] === 'priority_queue') heapVar = name;
        if (vizMap[name] === 'linked_list') linkedListVar = name;
        if (vizMap[name] === 'binary_tree') treeVar = name; // <-- Find the tree
    }

    const graphData = graphVar && variables[graphVar];
    const stackData = stackVar && variables[stackVar];
    const queueData = queueVar && variables[queueVar];
    const dictData = dictVar && variables[dictVar];
    const setData = setVar && variables[setVar];
    const heapData = heapVar && variables[heapVar];
    const linkedListData = linkedListVar && variables[linkedListVar];
    const treeData = treeVar && variables[treeVar]; // <-- Get the tree data

    // --- Add treeData ---
    const hasSpecialViz = graphData || stackData || queueData || dictData || setData || heapData || linkedListData || treeData;

    return (
        <div className="space-y-4">
            {/* Render the component if its data exists */}
            {graphData && (
                <GraphVisualizer name={graphVar} graphData={graphData} variables={variables} />
            )}
            {dictData && (
                <DictionaryVisualizer name={dictVar} dictionary={dictData} />
            )}
            {stackData && (
                <StackVisualizer name={stackVar} stack={stackData} />
            )}
            {queueData && (
                <QueueVisualizer name={queueVar} queue={queueData} />
            )}
            {setData && (
                <SetVisualizer name={setVar} set={setData} />
            )}
            {heapData && (
                <HeapVisualizer name={heapVar} heap={heapData} />
            )}
            {linkedListData && (
                <LinkedListVisualizer name={linkedListVar} list={linkedListData} />
            )}

            {/* --- RENDER THE BINARY TREE VISUALIZER --- */}
            {treeData && (
                <BinaryTreeVisualizer name={treeVar} root={treeData} variables={variables} /> // <-- Added variables={variables}
            )}

            {/* Add a divider if we had special viz AND we have other vars */}
            {hasSpecialViz && <div className="border-t border-gray-700 pt-4"></div>}

            <VariableDisplay variables={variables} variableMap={vizMap} />
            {isFinished && <div className="mt-4 p-2 text-center text-green-400 bg-green-900/50 rounded border border-green-700">Execution Finished!</div>}
        </div>
    );
};

// --- Default Code ---
const defaultCodeWithInput = `# Hey, Welcome to Decipher!
# This is our new code visualizer, still in the testing phase.

print("Hey, Welcome to Decipher! 👋")
print("-" * 30)
print("This code will build an array, one letter at a time.")
print("Click 'Play' to see it in action!")

word = "DECIPHER"
char_array = []

for char in word:
    print(f"Adding '{char}' to the array...")
    char_array.append(char)

print("-" * 30)
print("All done! Check out the 'Execution State'.")
print(f"Final array: {char_array}")
`;

// --- AI Explanation Icon ---
const AiIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 group-hover:opacity-100 transition-opacity">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v-2a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v2" />
    </svg>
);

// --- Autoplay Icons ---
const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 3v18l15-9L6 3z" />
    </svg>
);

const PauseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    </svg>
);


// --- NEW: Export Icons ---
const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const GifIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4" />
        <path d="M9 3V1" />
        <path d="M12 3V1" />
        <path d="M15 3V1" />
        <path d="M12 14v-4h-2" />
        <path d="M12 10h.01" />
        <path d="M15 14v-4h2" />
        <path d="M17 10h.01" />
    </svg>
);

// --- NEW: Spinner Component (Moved to top level) ---
const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


// --- Main App Component ---
export default function PythonVisualizer() {
    // --- State Hooks ---
    const [code, setCode] = useState(defaultCodeWithInput);
    const [userInput, setUserInput] = useState("");
    const [trace, setTrace] = useState([]);
    // --- NEW: AI Variable Map State ---
    const [variableMap, setVariableMap] = useState({});
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editorWidth, setEditorWidth] = useState(50);
    const containerRef = useRef(null);
    const isResizing = useRef(false);

    // --- REFINED: Ref for the visualizer panel ---
    const visualizerRef = useRef(null);

    // --- REFINED: AI Explanation State ---
    const [aiLineExplanation, setAiLineExplanation] = useState("");
    const [isLineLoading, setIsLineLoading] = useState(false);

    // --- NEW: AI Summary State ---
    const [aiSummary, setAiSummary] = useState("");
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);

    // --- NEW: Autoplay State ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [autoplaySpeed, setAutoplaySpeed] = useState(500); // Default 500ms

    // --- NEW: Export State ---
    const [isExporting, setIsExporting] = useState(null); // e.g., "PNG" or "GIF"

    // --- Backend API URL ---
    // --- 3. FIX: Hardcode API URL to avoid import.meta ---
    const API_BASE_URL = 'http://127.0.0.1:8001';

    // --- Backend Interaction (UPGRADED) ---
    const handleVisualize = async () => {
        setIsLoading(true); setError(null); setTrace([]); setCurrentStep(0);
        // --- NEW: Clear old summaries on new run ---
        setAiLineExplanation("");
        setAiSummary("");
        setIsPlaying(false); // Stop autoplay on new run
        setIsExporting(null); // Clear exporting state
        setVariableMap({}); // Clear old variable map

        const inputs = userInput.split('\n');

        try {
            const response = await fetch(`${API_BASE_URL}/python/visualize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, inputs }),
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();

            if (data.error) setError(data.error);

            // --- SMART AI MAPPER LOGIC ---
            const stepsArray = Array.isArray(data.steps) ? data.steps : [];
            const varMap = (data.variable_map && typeof data.variable_map === 'object') ? data.variable_map : {};

            const formattedTrace = stepsArray.map(step => {
                const currentVars = (step && typeof step.variables === 'object' && step.variables !== null) ? step.variables : {};
                const output = (step && typeof step.output === 'string') ? step.output : '';
                const line = (step && typeof step.line === 'number') ? step.line : null;
                const event = (step && typeof step.event === 'string') ? step.event : 'line';
                // --- Store the map in *every* step for convenience ---
                return { line, event, variables: { ...currentVars, variable_map: varMap }, output };
            });

            setTrace(formattedTrace || []);
            setVariableMap(varMap); // <-- Store the map from the AI

        } catch (e) {
            setError(`Failed to connect to the server: ${e.message}`);
            setTrace([]);
            setVariableMap({});
        } finally {
            setIsLoading(false);
        }
    };

    // --- REFINED: AI Line Explanation Handler ---
    const handleExplainLine = async (lineNumber) => {
        const lineContent = code.split('\n')[lineNumber - 1];
        if (!lineContent || lineContent.trim() === "") {
            setAiLineExplanation("This line is empty.");
            return;
        }

        setIsLineLoading(true);
        setAiLineExplanation(""); // Clear previous line explanation
        setAiSummary(""); // Clear summary

        try {
            const response = await fetch(`${API_BASE_URL}/python/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_line: lineContent }),
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            setAiLineExplanation(data.explanation || "No explanation received.");
        } catch (e) {
            setAiLineExplanation(`Failed to get explanation: ${e.message}`);
        } finally {
            setIsLineLoading(false);
        }
    };

    // --- NEW: AI Summary Handler ---
    const handleGetSummary = async () => {
        if (!trace || trace.length === 0) {
            setAiSummary("Run the code first to get a summary.");
            return;
        }

        setIsSummaryLoading(true);
        setAiSummary(""); // Clear previous summary
        setAiLineExplanation(""); // Clear line explanation

        try {
            const response = await fetch(`${API_BASE_URL}/python/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send the full code and the full trace
                body: JSON.stringify({ code, trace }),
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            setAiSummary(data.summary || "No summary received.");
        } catch (e) {
            setAiSummary(`Failed to get summary: ${e.message}`);
        } finally {
            setIsSummaryLoading(false);
        }
    };


    // --- Stepping Logic ---
    // REFINED: handleNext and handlePrevious now stop autoplay
    const handleNext = () => {
        setIsPlaying(false);
        if (trace && currentStep < trace.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };
    const handlePrevious = () => {
        setIsPlaying(false);
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    // --- NEW: Autoplay Logic ---
    const handleReset = () => {
        setIsPlaying(false);
        setCurrentStep(0);
    };

    const handleAutoplayToggle = () => {
        setIsPlaying(!isPlaying);
    };

    // This effect handles the autoplay interval
    useEffect(() => {
        let intervalId = null;
        if (isPlaying && currentStep < trace.length - 1) {
            intervalId = setInterval(() => {
                // Use functional update to avoid stale state
                setCurrentStep(prevStep => prevStep + 1);
            }, autoplaySpeed);
        } else {
            // Stop playing if end is reached
            setIsPlaying(false);
        }
        // Cleanup function
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isPlaying, currentStep, trace.length, autoplaySpeed]); // Re-run effect if these change
    // --- NEW: Auto-Closing Brackets Handler ---
    const handleKeyDown = (e) => {
        const { selectionStart, selectionEnd, value } = e.target;

        // Define pairs
        const pairs = {
            '(': ')',
            '[': ']',
            '{': '}',
            '"': '"',
            "'": "'",
        };

        // Check if the key pressed is one of our triggers
        if (pairs[e.key]) {
            e.preventDefault(); // Stop the default single character insertion

            const openChar = e.key;
            const closeChar = pairs[e.key];

            // Insert both characters: Open + Close
            const newValue =
                value.substring(0, selectionStart) +
                openChar + closeChar +
                value.substring(selectionEnd);

            setCode(newValue);

            // Move cursor to the middle (between the brackets)
            // We need to use setTimeout to wait for the state update to render
            setTimeout(() => {
                e.target.selectionStart = selectionStart + 1;
                e.target.selectionEnd = selectionStart + 1;
            }, 0);
        }

        // Optional: Handle "Backspace" to delete pairs (VS Code style)
        // If cursor is between () and user hits backspace, delete both.
        if (e.key === 'Backspace') {
            const charBefore = value[selectionStart - 1];
            const charAfter = value[selectionStart];

            if (
                (charBefore === '(' && charAfter === ')') ||
                (charBefore === '[' && charAfter === ']') ||
                (charBefore === '{' && charAfter === '}') ||
                (charBefore === '"' && charAfter === '"') ||
                (charBefore === "'" && charAfter === "'")
            ) {
                e.preventDefault();
                const newValue =
                    value.substring(0, selectionStart - 1) +
                    value.substring(selectionEnd + 1);

                setCode(newValue);

                setTimeout(() => {
                    e.target.selectionStart = selectionStart - 1;
                    e.target.selectionEnd = selectionStart - 1;
                }, 0);
            }
        }
    };

    // --- NEW: Export Logic ---

    // Triggers a browser download for a data URL
    const triggerDownload = (dataUrl, filename) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Export the *current* step as a PNG
    const handleExportPNG = async () => {
        // --- 4. Use window.html2canvas ---
        if (!visualizerRef.current || typeof window.html2canvas === 'undefined') {
            setError("PNG export library is not loaded.");
            return;
        }
        setIsExporting("PNG...");

        try {
            const canvas = await window.html2canvas(visualizerRef.current, {
                useCORS: true,
                backgroundColor: '#111827' // bg-gray-900
            });
            triggerDownload(canvas.toDataURL('image/png'), `decipher-step-${currentStep + 1}.png`);
        } catch (e) {
            console.error("Error exporting PNG:", e);
            setError("Could not export PNG.");
        } finally {
            setIsExporting(null);
        }
    };

    // Export the *entire animation* as a GIF
    const handleExportGIF = async () => {
        // --- 5. Use window.GIF and window.html2canvas ---
        if (!visualizerRef.current || !trace.length || typeof window.GIF === 'undefined' || typeof window.html2canvas === 'undefined') {
            setError("GIF export libraries are not loaded.");
            return;
        }

        setIsPlaying(false); // Stop autoplay
        setIsExporting("GIF... 0%");

        const originalStep = currentStep;
        const panel = visualizerRef.current;

        const gif = new window.GIF({
            workers: 2,
            quality: 10,
            width: panel.offsetWidth,
            height: panel.offsetHeight,
            // --- FIXED: Use local worker script ---
            workerScript: '/gif.worker.js'
        });

        // Loop through each step, take a screenshot, and add to GIF
        for (let i = 0; i < trace.length; i++) {
            setIsExporting(`GIF... ${Math.round((i / trace.length) * 100)}%`);

            // 1. Set the app to the correct step
            setCurrentStep(i);

            // 2. Wait for React to re-render the UI
            // A short delay is needed for the DOM to update
            await new Promise(resolve => setTimeout(resolve, 50));

            // 3. Take the screenshot
            const canvas = await window.html2canvas(panel, {
                useCORS: true,
                backgroundColor: '#111827' // bg-gray-900
            });

            // 4. Add the screenshot as a frame
            gif.addFrame(canvas, {
                copy: true,
                delay: autoplaySpeed // Use the speed from the slider
            });
        }

        gif.on('finished', (blob) => {
            triggerDownload(URL.createObjectURL(blob), 'decipher-visualization.gif');
            setIsExporting(null);
            // Restore original step
            setCurrentStep(originalStep);
        });

        setIsExporting("Compiling GIF...");
        gif.render();
    };

    
    // --- Resizing Logic ---
    const handleMouseDown = () => (isResizing.current = true);
    const handleMouseUp = () => (isResizing.current = false);
    const handleMouseMove = (e) => {
        if (!isResizing.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let newWidth = ((e.clientX - rect.left) / rect.width) * 100;
        if (newWidth < 20) newWidth = 20;
        if (newWidth > 80) newWidth = 80;
        setEditorWidth(newWidth);
    };

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    // --- Derived State for Rendering ---
    const currentStepData = (Array.isArray(trace) && trace.length > currentStep) ? trace[currentStep] : null;
    const currentLine = currentStepData?.event === 'line' ? currentStepData.line : null;
    const isFinished = currentStepData?.event === 'finished';
    const currentOutput = typeof currentStepData?.output === 'string' ? currentStepData.output : '';
    const codeLines = typeof code === 'string' ? code.split('\n') : [];

    // --- UPGRADED: Get variable map from current step ---
    const currentVariableMap = currentStepData?.variables?.variable_map || variableMap;

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center py-8 px-4 overflow-hidden">
            <GlobalStyles />
            <h1 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Decipher Code Visualizer
            </h1>
            <div ref={containerRef} className="w-full max-w-7xl flex gap-2 flex-1 mb-8" style={{ minHeight: "500px" }}>
                {/* Code Editor Panel */}
                <div style={{ width: `${editorWidth}%` }} className="bg-gray-800/70 backdrop-blur-lg rounded-2xl p-4 shadow-lg flex flex-col">
                    {/* Code Editor */}
                    <h2 className="text-lg font-semibold mb-2 text-gray-200">Python Code</h2>
                    <div className="flex flex-1 border border-gray-700 rounded-lg overflow-hidden">

                        {/* Line Gutter */}
                        <div className="bg-gray-900 p-2 text-right text-gray-500 text-xs select-none font-mono">
                            {codeLines.map((_, i) => (
                                <div key={i} className={`flex items-center justify-end h-[21px] ${i + 1 === currentLine ? 'text-cyan-400 font-bold' : ''}`}>
                                    {/* --- NEW: AI Button --- */}
                                    <button
                                        title="Ask AI to explain this line"
                                        onClick={() => handleExplainLine(i + 1)}
                                        className="group w-[14px] mr-2 text-gray-600 hover:text-cyan-400"
                                    >
                                        <AiIcon />
                                    </button>
                                    {i + 1}
                                </div>
                            ))}
                        </div>
                        {/* Text Area */}
                        {/* Main Code Editor - Swapped for Syntax Highlighting */}
                        <Editor
                            value={code}
                            onValueChange={code => setCode(code)}
                            highlight={code => {
                                if (Prism.languages.python) {
                                    return Prism.highlight(code, Prism.languages.python, "python");
                                }
                                return code;
                            }}
                            padding={10} // Padding matches the gutter's vertical alignment
                            onKeyDown={handleKeyDown} // Keeps your auto-closing brackets working
                            className="font-mono text-sm"
                            style={{
                                fontFamily: '"Fira code", "Fira Mono", monospace',
                                fontSize: 14,
                                lineHeight: '21px', // CRITICAL: Matches the height of your line numbers
                                backgroundColor: '#111827', // Dark gray background
                                color: '#86efac',           // Base text color
                                flex: 1,                    // Makes it fill the remaining width
                                minHeight: '100%',
                            }}
                            textareaClassName="focus:outline-none"
                        />
                    </div>

                    {/* User Input */}
                    <h3 className="text-lg font-semibold mb-2 text-gray-200 mt-4">User Input (one per line)</h3>
                    {/* Replace textarea with this: */}
                    {/* User Input */}
                    <Editor
                        value={userInput}
                        onValueChange={input => setUserInput(input)}
                        highlight={code => {
                            if (Prism.languages.python) {
                                return Prism.highlight(code, Prism.languages.python, "python");
                            }
                            return code; // Fallback to plain text if python is missing
                        }}
                        padding={10}
                        className="font-mono text-sm"
                        style={{
                            fontFamily: '"Fira code", "Fira Mono", monospace',
                            fontSize: 14,
                            backgroundColor: '#111827',
                            color: '#86efac',
                            minHeight: '100px', // Gave it a fixed height so it's visible
                        }}
                        textareaClassName="focus:outline-none"
                    />

                    {/* Visualize Button */}
                    <button onClick={handleVisualize} disabled={isLoading} className={`mt-4 px-5 py-2.5 rounded-full font-semibold transition-all ${isLoading ? "bg-gray-700 cursor-not-allowed text-gray-400" : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white"}`}>
                        {isLoading ? "Visualizing..." : "Visualize Execution"}
                    </button>
                </div>

                {/* Resizer */}
                <div onMouseDown={handleMouseDown} className="w-1.5 cursor-col-resize bg-gray-600 hover:bg-cyan-400 rounded-full transition-colors"></div>

                {/* Visualization & State Panel */}
                <div style={{ width: `${100 - editorWidth}%` }} className="bg-gray-800/70 backdrop-blur-lg rounded-2xl p-4 shadow-lg flex flex-col overflow-hidden relative">

                    {/* --- NEW: Export Loading Overlay --- */}
                    {isExporting && (
                        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
                            <Spinner />
                            <span className="text-lg font-semibold text-white mt-4">{isExporting}</span>
                            {isExporting.startsWith("GIF") && <span className="text-sm text-gray-400 mt-2">This may take a moment...</span>}
                        </div>
                    )}

                    {/* Controls */}
                    {Array.isArray(trace) && trace.length > 0 && (
                        <div className="mb-3 p-2 bg-gray-700/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                {/* --- NEW: Reset Button --- */}
                                <button onClick={handleReset} title="Go to Start" className="px-3 py-2 bg-gray-600 rounded disabled:opacity-50 hover:bg-gray-500 transition">
                                    <ResetIcon />
                                </button>
                                <button onClick={handlePrevious} disabled={currentStep === 0} className="px-4 py-1 bg-gray-600 rounded disabled:opacity-50 hover:bg-gray-500 transition">Previous</button>

                                {/* --- NEW: Play/Pause Button --- */}
                                <button onClick={handleAutoplayToggle} title={isPlaying ? "Pause" : "Play"} className="px-3 py-2 bg-cyan-600 rounded disabled:opacity-50 hover:bg-cyan-500 transition">
                                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                </button>

                                <span className="font-semibold text-sm">Step {currentStep + 1} of {trace.length}</span>
                                <button onClick={handleNext} disabled={!trace || currentStep >= trace.length - 1} className="px-4 py-1 bg-gray-600 rounded disabled:opacity-50 hover:bg-gray-500 transition">Next</button>
                            </div>

                            {/* --- NEW: Speed Slider --- */}
                            <div className="flex items-center gap-2 mt-3">
                                <label htmlFor="speed" className="text-xs text-gray-400">Speed</label>
                                <input
                                    type="range"
                                    id="speed"
                                    min="50"  // 50ms (fast)
                                    max="1500" // 1.5s (slow)
                                    value={autoplaySpeed}
                                    onChange={(e) => setAutoplaySpeed(Number(e.target.value))}
                                    step="50"
                                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-cyan-500"
                                />
                                <span className="text-xs text-gray-400 w-12 text-right">{autoplaySpeed}ms</span>
                            </div>
                        </div>
                    )}
                    {error && <div className="p-3 mb-3 bg-red-900/50 text-red-300 border border-red-700 rounded-lg text-sm"><strong>Error:</strong> {error}</div>}

                    {/* --- Panel Content (Wrapped in Ref) --- */}
                    <div className="flex-1 flex flex-col overflow-auto scrollbar-hide space-y-4 bg-gray-900/0">
                        {/* --- FIXED: Ref is now on this div --- */}
                        <div ref={visualizerRef} className="state-section bg-gray-900 rounded-lg">
                            <h2 className="text-lg font-semibold mb-2 text-gray-200 flex-shrink-0 px-3 pt-3">Execution State</h2>
                            <div className="state-display p-3 text-sm overflow-auto scrollbar-hide min-h-[100px]">
                                {Array.isArray(trace) && trace.length > 0 && currentStepData ? (
                                    <StateVisualizer
                                        variables={currentStepData.variables || {}}
                                        variableMap={currentVariableMap}
                                        isFinished={isFinished}
                                    />
                                ) : (<p className="text-gray-500 text-xs italic">Run visualization to see the steps here.</p>)}
                            </div>
                        </div>

                        {/* --- REFINED: AI Explainer Panel (Handles both Line and Summary) --- */}
                        <div className="ai-section">
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">AI Explainer</h2>

                            {/* NEW: Show "Get Summary" button when finished */}
                            {isFinished && !aiSummary && !isSummaryLoading && (
                                <button
                                    onClick={handleGetSummary}
                                    className="w-full mb-2 px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-500 transition"
                                >
                                    Get AI Summary of Execution
                                </button>
                            )}

                            <div className="ai-panel min-h-[6rem] bg-gray-900 border border-gray-700 text-gray-300 rounded-lg p-3 text-sm font-mono overflow-auto scrollbar-hide whitespace-pre-wrap">
                                {isSummaryLoading
                                    ? "Analyzing execution..."
                                    : aiSummary
                                        ? aiSummary
                                        : isLineLoading
                                            ? "Asking AI about line..."
                                            : aiLineExplanation
                                                ? aiLineExplanation
                                                : "Click the icon next to a line for a quick explanation, or run the code to get a full summary."
                                }
                            </div>
                        </div>

                        <div className="flex-shrink-0">
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">Output (Print Statements)</h2>
                            <div className="output-panel h-24 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg p-3 text-xs font-mono overflow-auto scrollbar-hide whitespace-pre-wrap">
                                {currentOutput || (Array.isArray(trace) && trace.length > 0 ? '(No output for this step)' : 'Output will appear here...')}
                            </div>
                        </div>
                    </div>

                    {/* --- NEW: Export Buttons (Appear when finished) --- */}
                    {isFinished && !isExporting && (
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={handleExportPNG}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 rounded-lg font-semibold hover:bg-gray-500 transition"
                            >
                                <DownloadIcon />
                                Export PNG (Current Step)
                            </button>
                            <button
                                onClick={handleExportGIF}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 transition"
                            >
                                <GifIcon />
                                Export GIF (Animation)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}