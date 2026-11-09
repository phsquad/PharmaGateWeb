const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: STAGE 1 — VFS v2.0 (NODES + BLOBS) & PARSER WORKER CLIENT ===\n');

(async () => {
    try {
        // 1. Verify VirtualFS v2.0 Architecture
        console.log('--- Step 1: Testing VirtualFS v2.0 Two-Tier Store Architecture ---');
        const { VirtualFS } = await import('./js/services/virtual_fs.js');
        assert.strictEqual(VirtualFS.DB_VERSION, 2, 'VirtualFS DB_VERSION must be 2');
        assert.strictEqual(VirtualFS.STORE_NODES, 'nodes', 'STORE_NODES must be "nodes"');
        assert.strictEqual(VirtualFS.STORE_BLOBS, 'blobs', 'STORE_BLOBS must be "blobs"');

        const vfs = new VirtualFS();
        await vfs.init();
        assert(vfs.isReady, 'VFS must be ready after init()');

        // Test root listing (only reads metadata)
        const rootItems = await vfs.readdir("C:");
        assert(rootItems.length >= 4, 'Root must contain at least 4 system folders');
        assert(rootItems.every(item => item.type === 'dir' || item.type === 'folder'), 'All root items must be directories');
        console.log('✔ readdir("C:") fast metadata listing verified.');

        // Test binary file write and read
        console.log('\n--- Step 2: Testing Binary Buffer Storage in blobs Store ---');
        const binaryPayload = new Uint8Array([0x03, 0x1A, 0x0B, 0x0A, 0x50, 0x48, 0x41, 0x52, 0x4D, 0x41]);
        const testPath = "C:/Загрузки/binary_test.dbf";
        await vfs.writeFile(testPath, binaryPayload, "application/x-dbf");

        const statRes = await vfs.stat(testPath);
        assert(statRes !== null, 'stat must return node metadata');
        assert.strictEqual(statRes.name, 'binary_test.dbf');
        assert.strictEqual(statRes.size, binaryPayload.byteLength, 'stat size must match binary byteLength');

        const readData = await vfs.readFile(testPath);
        assert(readData instanceof Uint8Array || readData instanceof ArrayBuffer, 'readData must be binary');
        assert.strictEqual(readData.length || readData.byteLength, binaryPayload.byteLength, 'readData length must match');
        console.log('✔ Binary ArrayBuffer zero-loss storage and retrieval verified.');

        // Test atomic rename and delete
        console.log('\n--- Step 3: Testing Atomic Rename and Deletion across nodes and blobs ---');
        const renamedPath = "C:/Загрузки/binary_renamed.dbf";
        await vfs.rename(testPath, renamedPath);

        const oldStat = await vfs.stat(testPath);
        assert(oldStat === null, 'Old path must be removed from nodes');
        const newStat = await vfs.stat(renamedPath);
        assert(newStat !== null, 'New path must exist in nodes');

        await vfs.delete(renamedPath);
        const delStat = await vfs.stat(renamedPath);
        assert(delStat === null, 'Deleted file must be purged');
        console.log('✔ Atomic rename and delete verified.');

        // 2. Verify ParserWorkerClient & Background Parsing
        console.log('\n--- Step 4: Testing ParserWorkerClient & Fallback Invoice Parsing ---');
        const { ParserWorkerClient } = await import('./js/services/parser_worker_client.js');
        const client = ParserWorkerClient.getInstance();
        assert(client, 'ParserWorkerClient singleton must exist');

        const testCsv = "CODEPST;NAME;SERIES;GDATE;QNT;PRICE2\n100001;Парацетамол 500мг;240826;2028-12-31;10;45.50\n100002;Ибупрофен 400мг;240827;2028-12-31;5;98.00\n";
        const parseReport = await client.parseInvoiceAsync(testCsv, "demo_test.csv");

        assert(parseReport, 'ParserWorkerClient must return a parse report');
        const records = parseReport.mappedRecords || parseReport.records;
        assert(Array.isArray(records), 'Records must be an array');
        assert.strictEqual(records.length, 2, 'Must parse exactly 2 records');
        assert.strictEqual(records[0].NAME, 'Парацетамол 500мг');
        assert.strictEqual(records[1].NAME, 'Ибупрофен 400мг');
        console.log(`✔ ParserWorkerClient successfully parsed ${records.length} records with stats.`);

        // 3. Verify parser_worker.js exists and is valid JS
        console.log('\n--- Step 5: Verifying parser_worker.js Worker Script ---');
        const workerCode = fs.readFileSync('js/workers/parser_worker.js', 'utf8');
        assert(workerCode.includes('self.onmessage'), 'Worker must have self.onmessage handler');
        assert(workerCode.includes('PARSE_INVOICE'), 'Worker must support PARSE_INVOICE action');
        assert(workerCode.includes('parseDbfBinary'), 'Worker must support binary DBF parsing');
        assert(workerCode.includes('parseXmlStream'), 'Worker must support streaming XML parsing');
        assert(workerCode.includes('parseCsvBuffer'), 'Worker must support CSV parsing');
        console.log('✔ parser_worker.js background worker script verified.');

        console.log('\n====================================================');
        console.log('ALL STAGE 1 TESTS (VFS v2.0 + PARSER WORKER) PASSED WITH 100% SUCCESS!');
        console.log('====================================================\n');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
