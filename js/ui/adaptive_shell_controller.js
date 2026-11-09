/**
 * js/ui/adaptive_shell_controller.js - Адаптивная оболочка PharmaGateWeb (Adaptive Shell)
 * 
 * Архитектура:
 * 1. 🖥️ DesktopShell (>= 768px): Многооконная WebOS, Fluent Taskbar, Drag & Resize, каскад окон.
 * 2. 📱 MobileShell (< 768px): Нативный полноэкранный лаунчер (Springboard), Full-Screen Sheets,
 *    нижний Bottom Navigation Bar и нативная кнопка «‹ Назад».
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class AdaptiveShellController {
    constructor(app) {
        this.app = app;
        this.isMobile = false;
        this.currentActiveApp = null;
        this.mediaQuery = null;
        this.activeMobileTab = 'apps';
    }

    init() {
        if (typeof window === 'undefined') return;

        this.mediaQuery = window.matchMedia('(max-width: 767px)');
        this._handleBreakpoint(this.mediaQuery.matches);

        this.mediaQuery.addEventListener('change', (e) => {
            this._handleBreakpoint(e.matches);
        });

        this._injectMobileBackButtons();
        this._bindBottomBar();
        this._syncMobileHud();
    }

    _handleBreakpoint(matchesMobile) {
        this.isMobile = matchesMobile;
        document.body.classList.toggle('shell-mobile', this.isMobile);
        document.body.classList.toggle('shell-desktop', !this.isMobile);

        if (this.isMobile) {
            // Переход на мобильный интерфейс
            if (this.currentActiveApp) {
                this.openMobileApp(this.currentActiveApp);
            } else {
                this.closeMobileApp();
            }
        } else {
            // Возврат в десктопный интерфейс
            document.querySelectorAll('.os-window').forEach(win => {
                win.classList.remove('mobile-fullscreen-sheet');
            });
            const springboard = document.getElementById('mobileSpringboard');
            if (springboard) springboard.classList.add('hidden');
        }
    }

    openMobileApp(winId) {
        if (!winId || typeof document === 'undefined') return;

        const win = document.getElementById(winId);
        if (!win) return;

        this.currentActiveApp = winId;

        // Скрываем все остальные окна
        document.querySelectorAll('.os-window').forEach(w => {
            if (w.id !== winId) {
                w.classList.add('minimized');
                w.classList.remove('mobile-fullscreen-sheet');
            }
        });

        // Разворачиваем выбранное окно на весь экран
        win.classList.remove('minimized');
        win.classList.add('mobile-fullscreen-sheet');

        // Скрываем лаунчер
        const springboard = document.getElementById('mobileSpringboard');
        if (springboard) springboard.classList.add('hidden');

        // Обновляем фокус и содержимое окна
        this.app.focusWindow?.(winId);
        this.app._redrawWindowContents?.(winId);

        // Обновляем активную вкладку Bottom Bar
        if (winId === 'winCameraScanner') {
            this._setBottomBarActive('scanner');
        } else if (winId === 'winEditor') {
            this._setBottomBarActive('invoice');
        } else if (winId === 'winSettings') {
            this._setBottomBarActive('settings');
        } else {
            this._setBottomBarActive('apps');
        }

        this.app.crossPlatform?.playSound?.('click');
        this.app.webOsUi?._enhanceTaskbar?.();
    }

    closeMobileApp() {
        this.currentActiveApp = null;

        // Сворачиваем все окна
        document.querySelectorAll('.os-window').forEach(w => {
            w.classList.add('minimized');
            w.classList.remove('mobile-fullscreen-sheet');
        });

        // Показываем мобильный лаунчер (Springboard)
        const springboard = document.getElementById('mobileSpringboard');
        if (springboard) {
            springboard.classList.remove('hidden');
        }

        this._setBottomBarActive('apps');
        this._syncMobileHud();
        this.app.crossPlatform?.playSound?.('click');
        this.app.webOsUi?._enhanceTaskbar?.();
    }

    switchMobileTab(tabName) {
        this.activeMobileTab = tabName;
        this._setBottomBarActive(tabName);

        switch (tabName) {
            case 'scanner':
                this.openMobileApp('winCameraScanner');
                break;
            case 'invoice':
                this.openMobileApp('winEditor');
                break;
            case 'apps':
                this.closeMobileApp();
                break;
            case 'settings':
                this.openMobileApp('winSettings');
                break;
            default:
                this.closeMobileApp();
        }
    }

    _setBottomBarActive(tabName) {
        document.querySelectorAll('.mob-nav-btn').forEach(btn => {
            btn.classList.remove('text-blue-400', 'active');
            btn.classList.add('text-slate-400');
        });

        const activeMap = {
            'scanner': 'mobNavScanner',
            'invoice': 'mobNavInvoice',
            'apps': 'mobNavApps',
            'settings': 'mobNavSettings'
        };

        const targetId = activeMap[tabName];
        if (targetId) {
            const btn = document.getElementById(targetId);
            if (btn) {
                btn.classList.remove('text-slate-400');
                btn.classList.add('text-blue-400', 'active');
            }
        }
    }

    _injectMobileBackButtons() {
        if (typeof document === 'undefined') return;

        document.querySelectorAll('.os-window').forEach(win => {
            const header = win.querySelector('.win-header');
            if (header && !header.querySelector('.mobile-back-btn')) {
                const backBtn = document.createElement('button');
                backBtn.className = 'mobile-back-btn hidden items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-blue-600/30 text-white text-xs font-bold mr-2 cursor-pointer transition-colors shrink-0';
                backBtn.innerHTML = '<span class="text-sm leading-none">‹</span><span>Назад</span>';
                backBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.closeMobileApp();
                };
                header.insertBefore(backBtn, header.firstChild);
            }
        });
    }

    _bindBottomBar() {
        if (typeof document === 'undefined') return;

        document.getElementById('mobNavScanner')?.addEventListener('click', () => this.switchMobileTab('scanner'));
        document.getElementById('mobNavInvoice')?.addEventListener('click', () => this.switchMobileTab('invoice'));
        document.getElementById('mobNavApps')?.addEventListener('click', () => this.switchMobileTab('apps'));
        document.getElementById('mobNavSettings')?.addEventListener('click', () => this.switchMobileTab('settings'));
    }

    _syncMobileHud() {
        if (typeof document === 'undefined') return;

        const totalSumEl = document.getElementById('hudTotalSum');
        const itemsCountEl = document.getElementById('hudItemsCount');
        const mobSumEl = document.getElementById('mobHudSum');
        const mobCountEl = document.getElementById('mobHudCount');

        if (mobSumEl && totalSumEl) {
            mobSumEl.textContent = totalSumEl.textContent;
        }
        if (mobCountEl && itemsCountEl) {
            mobCountEl.textContent = itemsCountEl.textContent;
        }
    }
}
