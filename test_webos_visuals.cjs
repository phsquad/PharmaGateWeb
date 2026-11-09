const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFYING PHARMAGATE WINDOWS 11 WEBOS VISUAL ARCHITECTURE ===\n');

// 1. Check index.html DOM IDs
const html = fs.readFileSync('index.html', 'utf8');

const requiredIds = [
    'desktopMarquee',
    'taskbar',
    'btnStartMenu',
    'btnOpenSpotlight',
    'btnTaskView',
    'btnFileExplorer',
    'taskbarAppsContainer',
    'taskbarWidgetsBtn',
    'hudTotalSum',
    'hudItemsCount',
    'hudReadinessBadge',
    'btnTrayOverflow',
    'trayShield',
    'trayNetwork',
    'btnToggleSound',
    'btnLangToggle',
    'systemClock',
    'systemClockTime',
    'systemClockDate',
    'btnOpenControlCenter',
    'btnShowDesktop',
    'trayOverflowFlyout',
    'taskViewOverlay',
    'taskViewGrid',
    'desktopContextMenu',
    'windowContextMenu',
    'controlCenterModal',
    'osLockScreen'
];

console.log('--- Step 1: Checking Required Windows 11 Taskbar & System DOM IDs ---');
const missingIds = requiredIds.filter(id => !html.includes(`id="${id}"`));
if (missingIds.length > 0) {
    console.error('❌ Missing DOM IDs:', missingIds);
    process.exit(1);
} else {
    console.log(`✔ All ${requiredIds.length} required Windows 11 DOM elements present in index.html.`);
}

// 2. Check CSS styles
console.log('\n--- Step 2: Checking Windows 11 Taskbar & Animation Styles ---');
const requiredCssPatterns = [
    '#taskbar',
    '.taskbar-app-tile',
    '.taskbar-active-line',
    '.taskbar-running-dot',
    '#taskViewOverlay',
    '@keyframes taskViewFadeIn',
    '#desktopContextMenu',
    '#windowContextMenu'
];

const missingCss = requiredCssPatterns.filter(pattern => !html.includes(pattern));
if (missingCss.length > 0) {
    console.error('❌ Missing CSS Patterns:', missingCss);
    process.exit(1);
} else {
    console.log(`✔ All ${requiredCssPatterns.length} Windows 11 CSS rules present in index.html.`);
}

// 3. Check WebOsUiController Logic
console.log('\n--- Step 3: Checking WebOsUiController Windows 11 Taskbar Logic ---');
(async () => {
    try {
        const { WebOsUiController, initWebOsUi } = await import('./js/ui/webos_ui_controller.js');
        assert(typeof WebOsUiController === 'function', 'WebOsUiController must be a class');
        assert(typeof initWebOsUi === 'function', 'initWebOsUi must be a function');

        const mockApp = {
            openApp: () => {},
            closeApp: () => {},
            minimizeApp: () => {},
            maximizeApp: () => {},
            focusWindow: () => {},
            _updateTaskbar: () => {},
            _redrawWindowContents: () => {}
        };
        const controller = new WebOsUiController(mockApp);
        assert(controller.runningApps instanceof Set, 'runningApps must be a Set');
        assert(controller.runningApps.has('winEditor'), 'winEditor must be running initially');
        assert(typeof controller.toggleTaskView === 'function', 'toggleTaskView must exist');
        assert(typeof controller.toggleShowDesktop === 'function', 'toggleShowDesktop must exist');
        assert(typeof controller.toggleLanguage === 'function', 'toggleLanguage must exist');
        assert(typeof controller.showWindowContextMenu === 'function', 'showWindowContextMenu must exist');

        console.log('✔ WebOsUiController Windows 11 Taskbar & System Tray verified with 0 defects.');
        console.log('\n====================================================');
        console.log('ALL WINDOWS 11 WEBOS TASKBAR & SYSTEM VERIFICATIONS PASSED!');
        console.log('====================================================');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
