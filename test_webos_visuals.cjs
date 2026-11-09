const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFYING PHARMAGATE WEBOS VISUAL ARCHITECTURE ===\n');

// 1. Check index.html DOM IDs
const html = fs.readFileSync('index.html', 'utf8');

const requiredIds = [
    'desktopMarquee',
    'btnToggleDockCenter',
    'btnOpenControlCenter',
    'controlCenterModal',
    'ccVolumeSlider',
    'ccDpiSlider',
    'ccBlurSelect',
    'ccToggleLite',
    'ccToggleFullscreen',
    'ccBtnLockScreen',
    'ccBtnClearCache',
    'osLockScreen',
    'lockClockTime',
    'lockClockDate',
    'btnUnlockScreen',
    'desktopGadgetBarcode',
    'gadgetBarcodeInput',
    'gadgetBarcodeResult',
    'btnGadgetSendToScanner',
    'btnGadgetNotesClear'
];

console.log('--- Step 1: Checking Required WebOS DOM IDs in index.html ---');
const missingIds = requiredIds.filter(id => !html.includes(`id="${id}"`));
if (missingIds.length > 0) {
    console.error('❌ Missing DOM IDs:', missingIds);
    process.exit(1);
} else {
    console.log(`✔ All ${requiredIds.length} required WebOS DOM elements present in index.html.`);
}

// 2. Check CSS styles
console.log('\n--- Step 2: Checking WebOS Keyframe Animations & Glassmorphism ---');
const requiredCssPatterns = [
    '@keyframes webOsWinOpen',
    '@keyframes webOsWinMinimize',
    '.win-opening',
    '.win-minimizing',
    '.desktop-marquee',
    '.desktop-icon.selected',
    '.taskbar-dot',
    '.taskbar-dot-active',
    '#controlCenterModal',
    '#osLockScreen',
    '.os-mode-macos .win-header .win-btn-close'
];

const missingCss = requiredCssPatterns.filter(pattern => !html.includes(pattern));
if (missingCss.length > 0) {
    console.error('❌ Missing CSS Patterns:', missingCss);
    process.exit(1);
} else {
    console.log(`✔ All ${requiredCssPatterns.length} WebOS CSS rules present in index.html.`);
}

// 3. Check WebOsUiController module
console.log('\n--- Step 3: Checking WebOsUiController Logic ---');
(async () => {
    try {
        const { WebOsUiController, initWebOsUi } = await import('./js/ui/webos_ui_controller.js');
        assert(typeof WebOsUiController === 'function', 'WebOsUiController must be a class constructor');
        assert(typeof initWebOsUi === 'function', 'initWebOsUi must be an exported function');
        
        // Mock app instance
        const mockApp = {
            openApp: () => {},
            closeApp: () => {},
            maximizeApp: () => {},
            focusWindow: () => {},
            _updateTaskbar: () => {},
            _redrawWindowContents: () => {}
        };
        const controller = new WebOsUiController(mockApp);
        assert(controller.isLocked === false, 'Initial lock state must be false');
        assert(typeof controller._patchWindowLifecycle === 'function', '_patchWindowLifecycle must exist');
        assert(typeof controller.lockWebOs === 'function', 'lockWebOs must exist');
        assert(typeof controller.unlockWebOs === 'function', 'unlockWebOs must exist');

        console.log('✔ WebOsUiController module verified successfully with 0 defects.');
        console.log('\n====================================================');
        console.log('ALL PHARMAGATE WEBOS VISUAL UPGRADE VERIFICATIONS PASSED!');
        console.log('====================================================');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
