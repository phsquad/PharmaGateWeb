const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: ADAPTIVE SHELL (MobileShell + DesktopShell) ===\n');

(async () => {
    try {
        // 1. Check module import
        const { AdaptiveShellController } = await import('./js/ui/adaptive_shell_controller.js');
        assert(typeof AdaptiveShellController === 'function', 'AdaptiveShellController must be a class');
        console.log('✔ Test 1 passed: AdaptiveShellController exported cleanly.');

        // 2. Check Mock app integration
        const mockApp = {
            focusWindow: (id) => {},
            _redrawWindowContents: (id) => {},
            crossPlatform: { playSound: (s) => {} },
            webOsUi: { _enhanceTaskbar: () => {} }
        };

        const controller = new AdaptiveShellController(mockApp);
        assert(controller.isMobile === false, 'Initially isMobile should be false');
        assert(controller.currentActiveApp === null, 'Initially currentActiveApp should be null');
        assert(controller.activeMobileTab === 'apps', 'Initially activeMobileTab should be apps');
        console.log('✔ Test 2 passed: AdaptiveShellController instance initializes state properly.');

        // 3. Test switchMobileTab logic
        let openedApp = null;
        controller.openMobileApp = (id) => { openedApp = id; };
        controller.closeMobileApp = () => { openedApp = 'closed'; };
        controller._setBottomBarActive = (t) => {};

        controller.switchMobileTab('scanner');
        assert(openedApp === 'winCameraScanner', 'scanner tab must open winCameraScanner');

        controller.switchMobileTab('invoice');
        assert(openedApp === 'winEditor', 'invoice tab must open winEditor');

        controller.switchMobileTab('settings');
        assert(openedApp === 'winSettings', 'settings tab must open winSettings');

        controller.switchMobileTab('apps');
        assert(openedApp === 'closed', 'apps tab must close apps and show launcher');
        console.log('✔ Test 3 passed: switchMobileTab routes to appropriate enterprise modules.');

        // 4. Verify index.html mobile elements
        const html = fs.readFileSync('index.html', 'utf8');
        assert(html.includes('id="mobileSpringboard"'), 'index.html must include #mobileSpringboard');
        assert(html.includes('id="mobileBottomBar"'), 'index.html must include #mobileBottomBar');
        assert(html.includes('id="mobNavScanner"'), 'index.html must include #mobNavScanner');
        assert(html.includes('id="mobNavInvoice"'), 'index.html must include #mobNavInvoice');
        assert(html.includes('id="mobNavApps"'), 'index.html must include #mobNavApps');
        assert(html.includes('id="mobNavSettings"'), 'index.html must include #mobNavSettings');
        assert(html.includes('body.shell-mobile #taskbar'), 'index.html must hide taskbar on mobile');
        assert(html.includes('body.shell-mobile .os-window.mobile-fullscreen-sheet'), 'index.html must have full-screen sheet styling');
        console.log('✔ Test 4 passed: All DOM IDs and CSS classes present in index.html.');

        console.log('\n====================================================');
        console.log('ALL ADAPTIVE SHELL TESTS PASSED WITH 100% SUCCESS!');
        console.log('====================================================\n');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
