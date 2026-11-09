/**
 * js/ui/adaptive_shell_controller.js - Адаптивная Оболочка (Adaptive Shell) PharmaGateWeb
 * 
 * Архитектура:
 * 1. 🖥️ Desktop (>= 901px): Полноценная многооконная WebOS, Fluent Taskbar, Drag & Resize, каскад окон.
 * 2. 📱 Mobile (<= 900px): Чистый, легкий мобильный портал с текстовыми кнопками и ссылками без визуала,
 *    мгновенный переход к инструментам, полноэкранный режим с кнопкой «‹ К разделам» и поддержка системной кнопки «Назад».
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
        this.forceDesktop = false;
    }

    init() {
        if (typeof window === 'undefined') return;

        // Проверяем сохраненный принудительный режим десктопа
        this.forceDesktop = localStorage.getItem('pharmagate_force_desktop') === 'true';
        if (this.forceDesktop) {
            document.body.classList.add('force-desktop-mode');
        }

        if (typeof window !== 'undefined') { const mql = window.matchMedia('(max-width: 900px)'); this._updateMode(mql.matches); }

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
    }

    _updateMode(isMobileWidth) {
        this.isMobile = isMobileWidth && !this.forceDesktop;
        document.body.classList.toggle('shell-mobile', this.isMobile);
        document.body.classList.toggle('shell-desktop', !this.isMobile);

        if (this.isMobile) {
            if (this.currentActiveApp) {
                this.openMobilePortalApp(this.currentActiveApp, false);
            } else {
                this.closeMobilePortalApp(false);
            }
        } else {
            // Десктоп: снимаем мобильные полноэкранные классы
            document.querySelectorAll('.os-window').forEach(win => {
                win.classList.remove('mobile-active-page');
            });
        }
    }

    openMobilePortalApp(winId, pushHistory = true) {
        if (!winId || typeof document === 'undefined') return;

        const win = document.getElementById(winId);
        if (!win) return;

        this.currentActiveApp = winId;

        // Скрываем все остальные окна
        document.querySelectorAll('.os-window').forEach(w => {
            if (w.id !== winId) {
                w.classList.add('minimized');
                w.classList.remove('mobile-active-page');
            }
        });

        // Разворачиваем нужное окно
        win.classList.remove('minimized');
        win.classList.add('mobile-active-page');

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

        // Скроллим наверх
        window.scrollTo(0, 0);
    }

    closeMobilePortalApp(backHistory = true) {
        this.currentActiveApp = null;

        // Сворачиваем все окна
        document.querySelectorAll('.os-window').forEach(w => {
            w.classList.add('minimized');
            w.classList.remove('mobile-active-page');
        });

        // Показываем мобильный портал
        const portal = document.getElementById('mobilePortal');
        if (portal) portal.style.display = 'flex';

        if (backHistory && typeof history !== 'undefined' && window.location.hash) {
            history.pushState({}, '', window.location.pathname);
        }

        this.app?.crossPlatform?.playSound?.('click');
        window.scrollTo(0, 0);
    }

    toggleForceDesktopMode() {
        this.forceDesktop = !this.forceDesktop;
        if (typeof localStorage !== 'undefined') localStorage.setItem('pharmagate_force_desktop', String(this.forceDesktop));
        if (typeof document !== 'undefined') document.body.classList.toggle('force-desktop-mode', this.forceDesktop);

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
            backBtn.className = 'mobile-portal-back-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs mr-2 cursor-pointer shadow active:scale-95 transition-transform';
            backBtn.innerHTML = '<span>‹</span><span>К разделам</span>';
            backBtn.setAttribute('title', 'Вернуться к списку разделов');
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeMobilePortalApp(true);
            });

            // Вставляем кнопку назад в начало шапки окна
            header.insertBefore(backBtn, header.firstChild);
        });
    }
}
