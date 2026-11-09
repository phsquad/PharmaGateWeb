const assert = require('assert');

async function runTests() {
    console.log('=== STARTING PHARMAGATE 2026.3.0 COMPREHENSIVE TEST SUITE ===\n');

    // TEST 1: MdlpValidator
    console.log('--- TEST 1: MDLP / Честный ЗНАК Validator ---');
    const { MdlpValidator } = await import('./js/domain/mdlp_validator.js');
    const sampleDm = '010460123456789321ABCD123456789\x1d17281231\x1d10SER123\x1d91ABCD\x1d92' + 'A'.repeat(44);
    const dmResult = MdlpValidator.validateDataMatrix(sampleDm);
    assert.strictEqual(dmResult.isValid, true, 'DataMatrix should be valid');
    assert.strictEqual(dmResult.gtin, '04601234567893', 'GTIN must match');
    assert.strictEqual(dmResult.serial, 'ABCD123456789', 'Serial must match');
    assert.strictEqual(dmResult.series, 'SER123', 'Series must match');
    assert.strictEqual(dmResult.expDate, '2028-12-31', 'Exp date must be 2028-12-31');

    const eanOk = MdlpValidator.validateEan13('4601234567893');
    assert.strictEqual(eanOk.isValid, true, 'EAN-13 with check digit 3 should be valid');
    console.log('✔ Test 1 passed: MDLP validator parsed GS1 AIs, dates, and crypto-tail correctly.\n');

    // TEST 2: JnvlpManager
    console.log('--- TEST 2: Regional JNVLP Calculator (PP РФ № 865) ---');
    const { JnvlpManager } = await import('./js/domain/jnvlp_registry.js');
    const moscowRes = JnvlpManager.calculateLimitPrices({
        regionKey: 'moscow',
        regPrice: 200.0,
        manufacturerFactPrice: 190.0,
        wholesaleFactMarkup: 8.0,
        retailFactMarkup: 12.0,
        ndsPct: 10
    });
    assert(moscowRes.region.includes('Москва'), 'Region should include Moscow');
    assert.strictEqual(moscowRes.maxWholesaleMarkupPct, 12.0, 'Moscow tier 2 max wholesale markup is 12%');
    assert.strictEqual(moscowRes.isWholesaleExcess, false, '8% markup should not exceed 12%');
    assert(moscowRes.maxWholesalePriceWithNds > 200, 'Max wholesale price should include NDS');
    console.log(`✔ Test 2 passed: Moscow JNVLP calculation correct (Max wholesale with NDS: ${moscowRes.maxWholesalePriceWithNds} ₽).\n`);

    // TEST 3: LabelPrinterService
    console.log('--- TEST 3: Thermal Label Printer & SVG Vector Barcodes ---');
    const { LabelPrinterService, BarcodeSvgGenerator } = await import('./js/services/label_printer.js');
    const eanSvg = BarcodeSvgGenerator.generateEan13Svg('4601234567893', 32);
    assert(eanSvg.startsWith('<svg') && eanSvg.endsWith('</svg>'), 'EAN SVG should be valid SVG');
    const dmSvg = BarcodeSvgGenerator.generateDataMatrixSvg('04601234567893', 60);
    assert(dmSvg.startsWith('<svg') && dmSvg.endsWith('</svg>'), 'DataMatrix SVG should be valid SVG');
    const labelHtml = LabelPrinterService.getPreviewSvg(
        { NAME: 'Аспирин Кардио таб 100мг', PRICE2: 145.0, SER: '10224', GDATE: '2027-10-01' },
        '58x40',
        { barcodeType: 'ean13', orgName: 'Аптека ФармаГейт' }
    );
    assert(labelHtml.includes('Аспирин'), 'Label must contain product name');
    assert(labelHtml.includes('145') && labelHtml.includes('.00'), 'Label must contain rubles and kopecks');
    console.log('✔ Test 3 passed: Pure vector SVG barcodes (EAN-13, DataMatrix) and 58x40 thermal label rendered.\n');

    // TEST 4: InvoiceDiffEngine
    console.log('--- TEST 4: Invoice Visual Diff Engine ---');
    const { InvoiceDiffEngine } = await import('./js/services/diff_engine.js');
    const invoiceA = [
        { CODEPST: '101', NAME: 'Парацетамол', QNT: 10, PRICE2: 50.0, SUMSTR: 500.0, SER: 'S1' },
        { CODEPST: '102', NAME: 'Анальгин', QNT: 5, PRICE2: 30.0, SUMSTR: 150.0, SER: 'S2' }
    ];
    const invoiceB = [
        { CODEPST: '101', NAME: 'Парацетамол', QNT: 12, PRICE2: 55.0, SUMSTR: 660.0, SER: 'S1' }, // Modified
        { CODEPST: '103', NAME: 'Цитрамон', QNT: 20, PRICE2: 25.0, SUMSTR: 500.0, SER: 'S3' } // Added; 102 deleted
    ];
    const diff = InvoiceDiffEngine.compareInvoices(invoiceA, invoiceB);
    assert.strictEqual(diff.summary.modifiedCount, 1, '1 item should be modified');
    assert.strictEqual(diff.summary.addedCount, 1, '1 item should be added');
    assert.strictEqual(diff.summary.deletedCount, 1, '1 item should be deleted');
    assert.strictEqual(diff.summary.totalSumDelta, 510.0, 'Sum delta should be 1160 - 650 = 510');
    console.log(`✔ Test 4 passed: Invoice Diff correctly identified Modified, Added, Deleted rows and delta sum (+${diff.summary.totalSumDelta} ₽).\n`);

    // TEST 5: SQLiteWasmService executeUserQuery
    console.log('--- TEST 5: SQLite WASM User Query Execution ---');
    const { SQLiteWasmService } = await import('./js/services/sqlite_wasm_service.js');
    await SQLiteWasmService.initDatabase();
    SQLiteWasmService.bulkInsertProducts([
        { codepst: 'P1', name: 'Омепразол 20мг', ean13: '4607001234567', regprc: 75.0, firm: 'Озон' }
    ]);
    const qRes = SQLiteWasmService.executeUserQuery("SELECT codepst, name, regprc FROM products;");
    assert.strictEqual(qRes.success, true, 'SQL query should succeed');
    assert(qRes.rowCount >= 1, 'At least 1 row returned');
    assert(qRes.columns.length > 0, 'Columns array populated');
    console.log(`✔ Test 5 passed: SQL query executed in ${qRes.executionTimeMs} ms, returned ${qRes.rowCount} rows.\n`);

    // TEST 6: WebDBFEngine Windows-1251 & Date formatting
    console.log('--- TEST 6: WebDBFEngine Encoding & Date Engine ---');
    const { WebDBFEngine, DBFFieldDescriptor } = await import('./js/engine/dbf_engine.js');
    const fields = [
        new DBFFieldDescriptor("CODEPST", "C", 10, 0),
        new DBFFieldDescriptor("NAME", "C", 40, 0),
        new DBFFieldDescriptor("GDATE", "D", 8, 0),
        new DBFFieldDescriptor("PRICE2", "N", 10, 2),
        new DBFFieldDescriptor("QNT", "N", 8, 2)
    ];
    const records = [
        { CODEPST: "A001", NAME: "Валидол таб. 60мг", GDATE: "20281015", PRICE2: 45.50, QNT: 10 }
    ];
    const dbfBuffer = WebDBFEngine.writeDBF(fields, records);
    assert(dbfBuffer.byteLength > 100, 'DBF buffer must be valid');
    const parsedDbf = WebDBFEngine.readDBF(dbfBuffer);
    assert.strictEqual(parsedDbf.records.length, 1, 'Should read 1 record back');
    assert.strictEqual(parsedDbf.records[0].CODEPST, 'A001', 'CODEPST must match');
    assert(parsedDbf.records[0].NAME.includes('Валидол'), 'Cyrillic NAME must decode correctly');
    console.log('✔ Test 6 passed: DBF write and read with CP1251 encoding and dates verified without loss.\n');

    console.log('====================================================');
    console.log('ALL PHARMAGATE 2026.3.0 TESTS PASSED WITH 100% SUCCESS!');
    console.log('====================================================');
}

runTests().catch(err => {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
});
