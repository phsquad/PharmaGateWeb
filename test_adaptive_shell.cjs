const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: ADAPTIVE SHELL & CLEAN TEXT-BASED MOBILE PORTAL ===\n');

(async () => {
    try {
        // 1. Check module import
        const { AdaptiveShellController } = await import('./js/ui/adaptive_shell_controller.js');
        assert(typeof AdaptiveShellController === 'function', 'AdaptiveShellController must be a class');
        console.log('✔ Test 1 passed: AdaptiveShellController exported cleanly.');

        // 2. Check Controller initialization and state
        const mockApp = {
            focusWindow: (id) => {},
            _redrawWindowContents: (id) => {},
            crossPlatform: { playSound: (s) => {} },
            _showToast: (m) => {}
        };

        const controller = new AdaptiveShellController(mockApp);
        assert(controller.isMobile === false, 'Initially isMobile should be false');
        assert(controller.currentActiveApp === null, 'Initially currentActiveApp should be null');
        assert(controller.forceDesktop === false, 'Initially forceDesktop should be false');
        assert(typeof controller.openMobilePortalApp === 'function', 'openMobilePortalApp must be a function');
        assert(typeof controller.closeMobilePortalApp === 'function', 'closeMobilePortalApp must be a function');
        assert(typeof controller.toggleForceDesktopMode === 'function', 'toggleForceDesktopMode must be a function');
        console.log('✔ Test 2 passed: AdaptiveShellController instance initializes state and methods properly.');

        // 3. Test toggleForceDesktopMode logic
        controller.toggleForceDesktopMode();
        assert(controller.forceDesktop === true, 'forceDesktop should become true after toggle');
        controller.toggleForceDesktopMode();
        assert(controller.forceDesktop === false, 'forceDesktop should toggle back to false');
        console.log('✔ Test 3 passed: toggleForceDesktopMode toggles between mobile portal and desktop mode.');

        // 4. Verify index.html mobile elements
        const html = fs.readFileSync('index.html', 'utf8');
        assert(html.includes('id="mobilePortal"'), 'index.html must include #mobilePortal');
        assert(html.includes('class="mobile-portal-header"'), 'index.html must include mobile portal header');
        assert(html.includes('class="mobile-quick-actions"'), 'index.html must include mobile quick actions');
        assert(html.includes('class="mobile-sections-container"'), 'index.html must include mobile sections container');
        assert(html.includes('openMobilePortalApp(\'winCameraScanner\')'), 'must link to Camera-TSD scanner');
        assert(html.includes('openMobilePortalApp(\'winEditor\')'), 'must link to Invoice Editor');
        assert(html.includes('openMobilePortalApp(\'winJnvlp\')'), 'must link to JNVLP calculator');
        assert(html.includes('openMobilePortalApp(\'winExplorer\')'), 'must link to File Explorer');
        assert(html.includes('openMobilePortalApp(\'winUpdateCenter\')'), 'must link to Update Center');
        assert(html.includes('@media (max-width: 900px)'), 'index.html must contain pure CSS media query for mobile');
        assert(html.includes('body:not(.force-desktop-mode) #taskbar'), 'index.html must hide taskbar on mobile');
        assert(html.includes('body:not(.force-desktop-mode) #desktopIconsLayer'), 'index.html must hide desktop icons layer on mobile');
        assert(html.includes('.mobile-portal-back-btn'), 'index.html must style mobile back button');
        console.log('✔ Test 4 passed: All Mobile Portal DOM elements, tool links, and CSS rules verified in index.html.');

        console.log('\n====================================================');
        console.log('ALL MOBILE PORTAL & ADAPTIVE SHELL TESTS PASSED WITH 100% SUCCESS!');
        console.log('====================================================\n');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
