const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: VIRTUAL FILE SYSTEM (VFS) & EXPLORER CONTROLLER ===\n');

(async () => {
    try {
        // 1. Check DOM Elements in index.html
        console.log('--- Step 1: Checking Explorer DOM Elements in index.html ---');
        const html = fs.readFileSync('index.html', 'utf8');

        const requiredExplorerIds = [
            'winExplorer',
            'btnExplorerBack',
            'btnExplorerForward',
            'btnExplorerUp',
            'explorerBreadcrumbs',
            'explorerSearchInput',
            'btnExplorerViewGrid',
            'btnExplorerViewList',
            'btnExplorerNewFolder',
            'btnExplorerNewFile',
            'btnExplorerImport',
            'btnExplorerDownload',
            'btnExplorerDelete',
            'explorerFileInput',
            'explorerDropZone',
            'explorerItemsContainer',
            'explorerStatusCount',
            'explorerStatusSize'
        ];

        for (const id of requiredExplorerIds) {
            assert(html.includes(`id="${id}"`), `Missing required Explorer DOM element: id="${id}"`);
        }
        console.log(`✔ All ${requiredExplorerIds.length} required Explorer DOM elements present in index.html.`);

        // 2. Check VirtualFS CRUD operations
        console.log('\n--- Step 2: Testing VirtualFS CRUD In-Memory Operations ---');
        const { VirtualFS } = await import('./js/services/virtual_fs.js');
        const vfs = new VirtualFS();
        await vfs.init();
        assert(vfs.isReady, 'VirtualFS must be ready after init()');

        // Check root directory
        const rootItems = await vfs.readdir("C:");
        assert(rootItems.length >= 4, 'Root must contain at least 4 folders');
        const folderNames = rootItems.map(i => i.name);
        assert(folderNames.includes('Документы'), 'Root must contain Документы');
        assert(folderNames.includes('Загрузки'), 'Root must contain Загрузки');
        assert(folderNames.includes('База_ERP'), 'Root must contain База_ERP');
        assert(folderNames.includes('Схемы_DBF'), 'Root must contain Схемы_DBF');
        console.log('✔ Root directory listing verified with standard folders.');

        // mkdir
        await vfs.mkdir("C:/ТестФарма");
        const afterMkdir = await vfs.readdir("C:");
        assert(afterMkdir.some(i => i.name === 'ТестФарма' && i.type === 'folder'), 'Folder ТестФарма must exist');
        console.log('✔ Folder creation (mkdir) verified.');

        // writeFile & readFile
        const testPayload = "Лекарственный препарат;Серия;Срок;Цена\nАмоксициллин 500мг;240826;10.2028;142.50\n";
        await vfs.writeFile("C:/ТестФарма/nakladnaya.csv", testPayload, "text/csv");
        const fileContent = await vfs.readFile("C:/ТестФарма/nakladnaya.csv");
        assert.strictEqual(fileContent, testPayload, 'File content must match written payload');
        console.log('✔ File write & read verified.');

        // stat
        const fileStat = await vfs.stat("C:/ТестФарма/nakladnaya.csv");
        assert(fileStat && fileStat.name === 'nakladnaya.csv', 'Stat must return file metadata');
        assert(fileStat.size === Buffer.byteLength(testPayload, 'utf8'), 'Stat file size must be accurate');
        console.log('✔ File stat metadata verified.');

        // rename
        await vfs.rename("C:/ТестФарма/nakladnaya.csv", "C:/ТестФарма/invoice_renamed.csv");
        const renamedContent = await vfs.readFile("C:/ТестФарма/invoice_renamed.csv");
        assert.strictEqual(renamedContent, testPayload, 'Renamed file must retain content');
        const oldFile = await vfs.stat("C:/ТестФарма/nakladnaya.csv");
        assert(oldFile === null, 'Old file name must no longer exist');
        console.log('✔ File rename verified.');

        // delete
        await vfs.delete("C:/ТестФарма/invoice_renamed.csv");
        const deletedFile = await vfs.stat("C:/ТестФарма/invoice_renamed.csv");
        assert(deletedFile === null, 'Deleted file must be removed');
        await vfs.delete("C:/ТестФарма");
        const deletedDir = await vfs.stat("C:/ТестФарма");
        assert(deletedDir === null, 'Deleted folder must be removed');
        console.log('✔ File & Folder deletion verified.');

        // 3. Check ExplorerController
        console.log('\n--- Step 3: Checking ExplorerController Class & Logic ---');
        const { ExplorerController } = await import('./js/ui/explorer_controller.js');
        assert(typeof ExplorerController === 'function', 'ExplorerController must be a class constructor');

        // Mock app instance
        const mockApp = {
            vfs: vfs,
            openApp: (id) => console.log(`Mock openApp: ${id}`),
            showToast: (msg) => console.log(`Mock toast: ${msg}`)
        };
        const explorer = new ExplorerController(mockApp);
        assert.strictEqual(explorer.currentPath, "C:/Документы", 'Default explorer path should be C:/Документы');
        assert(typeof explorer.navigateTo === 'function', 'navigateTo must be a function');
        assert(typeof explorer.render === 'function', 'render must be a function');
        assert(typeof explorer.renderBreadcrumbs === 'function', 'renderBreadcrumbs must be a function');
        assert(typeof explorer.renderItemsOnly === 'function', 'renderItemsOnly must be a function');

        console.log('✔ ExplorerController initialized and methods verified.');

        console.log('\n====================================================');
        console.log('ALL VFS & EXPLORER TESTS PASSED WITH 100% SUCCESS!');
        console.log('====================================================');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
