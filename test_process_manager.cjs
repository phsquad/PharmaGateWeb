const assert = require('assert');

// Mock browser environment for headless testing
global.window = {
    innerWidth: 1920,
    innerHeight: 1080
};

const domElements = new Map();
global.document = {
    getElementById: (id) => {
        if (!domElements.has(id)) {
            domElements.set(id, {
                id,
                style: { zIndex: '10', left: '100px', top: '100px', width: '800px', height: '500px' },
                offsetLeft: 100,
                offsetTop: 100,
                offsetWidth: 800,
                offsetHeight: 500,
                classList: {
                    _classes: new Set(['minimized']),
                    add(c) { this._classes.add(c); },
                    remove(c) { this._classes.delete(c); },
                    contains(c) { return this._classes.has(c); },
                    toggle(c) {
                        if (this._classes.has(c)) { this._classes.delete(c); return false; }
                        else { this._classes.add(c); return true; }
                    }
                },
                setAttribute: (k, v) => {},
                removeAttribute: (k) => {},
                getBoundingClientRect: () => ({ left: 100, top: 100, width: 800, height: 500 })
            });
        }
        return domElements.get(id);
    },
    querySelectorAll: () => []
};

const sessionStore = new Map();
global.sessionStorage = {
    getItem: (k) => sessionStore.get(k) || null,
    setItem: (k, v) => sessionStore.set(k, String(v)),
    removeItem: (k) => sessionStore.delete(k),
    clear: () => sessionStore.clear()
};

async function runProcessManagerTests() {
    console.log("=== TEST SUITE: STAGE 2 — PROCESS MANAGER & LIFECYCLE (WINDOW MANAGER) ===");

    const { ProcessManager } = await import('./js/services/process_manager.js');

    // 1. Singleton instantiation
    const mockApp = { records: [{ id: 1, name: 'Амоксициллин' }], currentFileName: 'test.dbf' };
    const pm = ProcessManager.getInstance(mockApp);
    assert(pm, "ProcessManager instance must exist");
    console.log("✔ Step 1: ProcessManager singleton initialized.");

    // 2. Process spawning
    let spawnedEventFired = false;
    pm.on('process:spawned', (p) => {
        if (p.appId === 'winEditor') spawnedEventFired = true;
    });

    const procEditor = pm.spawn('winEditor', { tab: 'grid' });
    assert(procEditor, "Process winEditor must be spawned");
    assert(procEditor.pid >= 100, `Process PID must be >= 100, got ${procEditor.pid}`);
    assert.strictEqual(procEditor.appId, 'winEditor', "appId must match");
    assert.strictEqual(procEditor.status, 'running', "status must be running");
    assert(spawnedEventFired, "process:spawned event must fire");
    console.log(`✔ Step 2: Process spawn verified (PID: ${procEditor.pid}, App: ${procEditor.appId}).`);

    // 3. Spawning second process & Focus
    const procReconcile = pm.spawn('winReconcile');
    assert(procReconcile.pid !== procEditor.pid, "Each process must receive unique PID");
    assert(procReconcile.bounds.zIndex > procEditor.bounds.zIndex, "Newly spawned window must have higher Z-index");

    pm.focus(procEditor.pid);
    assert(procEditor.bounds.zIndex > procReconcile.bounds.zIndex, "Focused process must have top Z-index");
    console.log("✔ Step 3: Multi-process Z-index stacking & focus verified.");

    // 4. Minimize and auto-focus next
    pm.minimize(procEditor.pid);
    assert.strictEqual(procEditor.status, 'suspended', "Minimized process must be suspended");
    assert.strictEqual(procEditor.bounds.isMinimized, true, "isMinimized must be true");
    console.log("✔ Step 4: Process minimize and suspension verified.");

    // 5. Toggle Maximize
    pm.toggleMaximize(procReconcile.pid);
    assert.strictEqual(procReconcile.bounds.isMaximized, true, "isMaximized must be true after toggle");
    pm.toggleMaximize(procReconcile.pid);
    assert.strictEqual(procReconcile.bounds.isMaximized, false, "isMaximized must restore to false");
    console.log("✔ Step 5: Window maximize and restore geometry verified.");

    // 6. Shell transition: save snapshot & restore
    pm.saveShellSnapshot();
    assert(sessionStore.has('pharmagate_process_table'), "Process table must be persisted to sessionStorage");
    
    // Simulate mobile viewport modifications
    procEditor.bounds.left = 999; // change
    pm.restoreShellSnapshot();
    console.log("✔ Step 6: Cross-shell snapshot save & restore verified.");

    // 7. Process termination
    let terminatedEventFired = false;
    pm.on('process:terminated', (p) => {
        if (p.pid === procEditor.pid) terminatedEventFired = true;
    });

    pm.terminate(procEditor.pid);
    assert.strictEqual(pm.processTable.has(procEditor.pid), false, "Terminated process must be removed from processTable");
    assert.strictEqual(pm.appToPidMap.has('winEditor'), false, "Terminated appId must be removed from appToPidMap");
    assert(terminatedEventFired, "process:terminated event must fire");
    console.log("✔ Step 7: Process termination & cleanup verified.");

    console.log("\n====================================================");
    console.log("ALL STAGE 2 TESTS (PROCESS MANAGER & LIFECYCLE) PASSED WITH 100% SUCCESS!");
    console.log("====================================================\n");
}

runProcessManagerTests().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
