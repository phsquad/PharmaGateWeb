
export class AdaptiveShellController {
    static ALIASES = {
        winBatch: 'winBatchProcessor',
        winPriceTags: 'winLabelPrinter',
        winDatabase: 'winDb',
        winConstructor: 'winSchema'
    };

    constructor(app) {
        this.app = app;
        this.isMobile = false;
        this.currentActiveApp = null;
        this.forceDesktop = false;
        this._touchStartX = 0;
        this._touchStartY = 0;
        this._touchDeltaX = 0;
        this._touchDeltaY = 0;
        this._isSwiping = false;
    }

    init() {
        if (typeof window === 'undefined') return;

        // Проверяем сохраненный принудительный режим десктопа
        if (typeof localStorage !== 'undefined') {
            this.forceDesktop = localStorage.getItem('pharmagate_force_desktop') === 'true';
        }
        if (this.forceDesktop && typeof document !== 'undefined') {
            document.body.classList.add('force-desktop-mode');
        }

        const mql = window.matchMedia('(max-width: 900px)');
        this._updateMode(mql.matches);

        mql.addEventListener('change', (e) => {
            this._updateMode(e.matches);
        });

        // Слушатель системной кнопки "Назад" на телефоне (Android / iOS swipe)
        window.addEventListener('popstate', (e) => {
            if (this.isMobile && this.currentActiveApp) {
                this.closeMobilePortalApp(false);
            }
        });

        this._injectBackButtons();
        this._initTouchSwipeGestures();
    }

    _updateMode(isMobileWidth) {
        this.isMobile = isMobileWidth && !this.forceDesktop;
        if (typeof document !== 'undefined') {
            document.body.classList.toggle('shell-mobile', this.isMobile);
            document.body.classList.toggle('shell-desktop', !this.isMobile);
        }

        if (this.isMobile) {
            this.app?.processManager?.saveShellSnapshot();
            if (this.currentActiveApp) {
                this.openMobilePortalApp(this.currentActiveApp, false);
            } else {
                this.closeMobilePortalApp(false);
            }
        } else {
            // Десктоп: снимаем мобильные полноэкранные классы и восстанавливаем геометрию
            if (typeof document !== 'undefined') {
                document.querySelectorAll('.os-window').forEach(win => {
                    win.classList.remove('mobile-active-page');
                    win.style.transform = '';
                });
            }
            this.app?.processManager?.restoreShellSnapshot();
        }
    }

    openMobilePortalApp(winId, pushHistory = true) {
        if (!winId || typeof document === 'undefined') return;

        // Резолв алиасов
        winId = AdaptiveShellController.ALIASES[winId] || winId;

        const win = document.getElementById(winId);
        if (!win) {
            console.warn('[AdaptiveShell] Окно не найдено:', winId);
            return;
        }

        this.currentActiveApp = winId;
        this.app?.processManager?.spawn(winId);

        // Скрываем все остальные окна
        document.querySelectorAll('.os-window').forEach(w => {
            if (w.id !== winId) {
                w.classList.add('minimized');
                w.classList.remove('mobile-active-page');
                w.style.transform = '';
            }
        });

        // Разворачиваем нужное окно
        win.classList.remove('minimized');
        win.classList.add('mobile-active-page');
        win.style.transform = '';

        // Скрываем мобильный портал
        const portal = document.getElementById('mobilePortal');
        if (portal) portal.style.display = 'none';

        // Добавляем запись в историю браузера для поддержки кнопки "Назад"
        if (pushHistory && typeof history !== 'undefined') {
            history.pushState({ app: winId }, '', '#' + winId);
        }

        // Обновляем фокус и содержимое окна
        this.app?.focusWindow?.(winId);
        this.app?._redrawWindowContents?.(winId);
        this.app?.crossPlatform?.playSound?.('click');

        // Тактильный виброотклик на смартфонах
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(10); } catch (e) {}
        }

        // Скроллим наверх
        if (typeof window !== 'undefined') window.scrollTo(0, 0);
    }

    closeMobilePortalApp(backHistory = true) {
        if (this.currentActiveApp) {
            this.app?.processManager?.minimize(this.currentActiveApp);
        }
        this.currentActiveApp = null;

        // Сворачиваем все окна
        if (typeof document !== 'undefined') {
            document.querySelectorAll('.os-window').forEach(w => {
                w.classList.add('minimized');
                w.classList.remove('mobile-active-page');
                w.style.transform = '';
            });

            // Показываем мобильный портал
            const portal = document.getElementById('mobilePortal');
            if (portal) portal.style.display = 'flex';
        }

        if (backHistory && typeof history !== 'undefined' && window.location.hash) {
            history.pushState({}, '', window.location.pathname);
        }

        this.app?.crossPlatform?.playSound?.('click');
        if (typeof window !== 'undefined') window.scrollTo(0, 0);
    }

    toggleForceDesktopMode() {
        this.forceDesktop = !this.forceDesktop;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('pharmagate_force_desktop', String(this.forceDesktop));
        }
        if (typeof document !== 'undefined') {
            document.body.classList.toggle('force-desktop-mode', this.forceDesktop);
        }

        if (typeof window !== 'undefined' && window.matchMedia) {
            const mql = window.matchMedia('(max-width: 900px)');
            this._updateMode(mql.matches);
        }

        const msg = this.forceDesktop
            ? '🖥️ Активирован полный десктопный режим (WebOS)'
            : '📱 Активирован легкий мобильный режим';
        this.app?._showToast?.(msg);
        this.app?.crossPlatform?.playSound?.('click');
    }

    _injectBackButtons() {
        if (typeof document === 'undefined') return;

        document.querySelectorAll('.os-window').forEach(win => {
            const header = win.querySelector('.win-header');
            if (!header || header.querySelector('.mobile-portal-back-btn')) return;

            const backBtn = document.createElement('button');
            backBtn.className = 'mobile-portal-back-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs mr-2 cursor-pointer shadow active:scale-95 transition-transform';
            backBtn.innerHTML = '<span>‹</span><span>К разделам</span>';
            backBtn.setAttribute('title', 'Вернуться к списку разделов (или свайп вправо)');
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeMobilePortalApp(true);
            });

            header.insertBefore(backBtn, header.firstChild);
        });
    }

    _initTouchSwipeGestures() {
        if (typeof window === 'undefined') return;

        let activeWinEl = null;

        window.addEventListener('touchstart', (e) => {
            if (!this.isMobile || !this.currentActiveApp) return;
            const touch = e.touches[0];
            if (!touch) return;

            this._touchStartX = touch.clientX;
            this._touchStartY = touch.clientY;
            this._touchDeltaX = 0;
            this._touchDeltaY = 0;
            this._isSwiping = false;

            activeWinEl = document.getElementById(this.currentActiveApp);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!this.isMobile || !this.currentActiveApp || !activeWinEl) return;
            const touch = e.touches[0];
            if (!touch) return;

            this._touchDeltaX = touch.clientX - this._touchStartX;
            this._touchDeltaY = touch.clientY - this._touchStartY;

            // Если движение горизонтальное вправо (свайп от левого края или по экрану)
            if (this._touchDeltaX > 25 && Math.abs(this._touchDeltaX) > Math.abs(this._touchDeltaY) * 1.4) {
                this._isSwiping = true;
                const offset = Math.max(0, this._touchDeltaX - 20);
                activeWinEl.style.transition = 'none';
                activeWinEl.style.transform = `translateX(${offset}px)`;
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            if (!this.isMobile || !this.currentActiveApp || !activeWinEl) return;

            if (this._isSwiping) {
                activeWinEl.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';

                // Порог срабатывания свайпа (110px или свайп от самого края > 60px)
                const fromEdge = this._touchStartX < 50;
                const threshold = fromEdge ? 60 : 120;

                if (this._touchDeltaX > threshold) {
                    activeWinEl.style.transform = 'translateX(100%)';
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        try { navigator.vibrate(12); } catch (err) {}
                    }
                    setTimeout(() => {
                        this.closeMobilePortalApp(true);
                    }, 180);
                } else {
                    activeWinEl.style.transform = 'translateX(0px)';
                }
            }

            this._isSwiping = false;
            activeWinEl = null;
        }, { passive: true });
    }
}
