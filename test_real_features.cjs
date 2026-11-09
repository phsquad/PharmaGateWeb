const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: REAL FEATURES & TOUCH/SWIPE INTEGRATION ===\n');

(async () => {
    try {
        // 1. Check AdaptiveShellController aliases & touch gestures
        console.log('--- Step 1: Verifying Touch/Swipe Engine & Aliases ---');
        const { AdaptiveShellController } = await import('./js/ui/adaptive_shell_controller.js');
        assert(AdaptiveShellController.ALIASES, 'ALIASES map must exist');
        assert.strictEqual(AdaptiveShellController.ALIASES.winBatch, 'winBatchProcessor');
        assert.strictEqual(AdaptiveShellController.ALIASES.winPriceTags, 'winLabelPrinter');
        assert.strictEqual(AdaptiveShellController.ALIASES.winDatabase, 'winDb');
        assert.strictEqual(AdaptiveShellController.ALIASES.winConstructor, 'winSchema');

        const controller = new AdaptiveShellController({});
        assert(typeof controller._initTouchSwipeGestures === 'function', '_initTouchSwipeGestures must be a function');
        console.log('✔ Aliases and TouchSwipeGestures verified.');

        // 2. Check feature_controllers.js real feature bindings
        console.log('\n--- Step 2: Verifying Real Feature Implementations in feature_controllers.js ---');
        const fcCode = fs.readFileSync('js/ui/feature_controllers.js', 'utf8');
        assert(fcCode.includes('function _bindReconcileWindow(app)'), '_bindReconcileWindow must exist');
        assert(fcCode.includes('function _bindInspectorWindow(app)'), '_bindInspectorWindow must exist');
        assert(fcCode.includes('function _bindSchemaWindow(app)'), '_bindSchemaWindow must exist');
        assert(fcCode.includes('function _bindDbWindow(app)'), '_bindDbWindow must exist');
        assert(fcCode.includes('function _bindWizardWindow(app)'), '_bindWizardWindow must exist');
        assert(fcCode.includes('btnLoadOrderFile'), 'btnLoadOrderFile event listener must exist');
        assert(fcCode.includes('btnInspectorApplyChecked'), 'btnInspectorApplyChecked event listener must exist');
        assert(fcCode.includes('btnSchemaApplyToDoc'), 'btnSchemaApplyToDoc event listener must exist');
        assert(fcCode.includes('btnSyncDbWithInvoice'), 'btnSyncDbWithInvoice event listener must exist');
        assert(fcCode.includes('btnWizardAddRow'), 'btnWizardAddRow event listener must exist');
        console.log('✔ All 5 real feature modules (Reconcile, Inspector, Schema, Db, Wizard) verified.');

        // 3. Check index.html mobile touch styles and onclick targets
        console.log('\n--- Step 3: Verifying index.html Mobile Portal and Touch CSS ---');
        const html = fs.readFileSync('index.html', 'utf8');
        assert(html.includes('touch-action: pan-y !important;'), 'Must have touch-action: pan-y !important');
        assert(html.includes('-webkit-overflow-scrolling: touch !important;'), 'Must have -webkit-overflow-scrolling: touch');
        assert(html.includes("openMobilePortalApp('winBatchProcessor')"), 'Mobile portal must link to winBatchProcessor');
        assert(html.includes("openMobilePortalApp('winLabelPrinter')"), 'Mobile portal must link to winLabelPrinter');
        assert(html.includes("openMobilePortalApp('winDb')"), 'Mobile portal must link to winDb');
        assert(html.includes("openMobilePortalApp('winSchema')"), 'Mobile portal must link to winSchema');
        console.log('✔ index.html touch styles and canonical links verified.');

        console.log('\n====================================================');
        console.log('ALL REAL FEATURES & TOUCH/SWIPE TESTS PASSED WITH 100% SUCCESS!');
        console.log('====================================================\n');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
