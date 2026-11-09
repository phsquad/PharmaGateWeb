/**
 * js/ui/webos_ui_controller.js - Визуальный контроллер и движок окружения WebOS 2026.3.0
 * 
 * Включает:
 * 1. 🪟 Панель задач Windows 11 (Fluent Centered Taskbar & Dock 2.0):
 *    - Отображает ТОЛЬКО запущенные / открытые прямо сейчас программы!
 *    - Иконки-тайлы 40x40px без горизонтального нагромождения текста.
 *    - Светящаяся акцентная полоска под активным окном (как в Windows 11).
 *    - Индикаторная микро-точка под фоновыми / свернутыми программами.
 * 2. 🕒 Системный Трей Windows 11:
 *    - Двухстрочные часы и дата (время сверху, дата снизу).
 *    - Стрелка трея ^ для скрытых значков (Zoom, Кодировка, Перевод строк, Профиль).
 *    - Защита Windows Defender / ФЛК (🛡️), Сеть (🛜), Звук (🔊), Язык (РУС).
 *    - Полоска Aero Peek (Show Desktop) на правом краю.
 * 3. ❐ Представление задач & Виртуальные рабочие столы (Task View / Win+Tab):
 *    - Карточки открытых окон с мини-превью и переключение рабочих столов 1 и 2.
 * 4. 🖱️ Контекстное меню Windows 11 (Desktop & Window Context Menus):
 *    - Меню рабочего стола с горячими клавишами (F5, Ctrl+K, Win+L, Ctrl+Shift+C).
 *    - Контекстное меню шапки окна (Свернуть, Развернуть, Прижать 50%, Закрыть).
 * 5. 📱 Полная адаптивность под любые экраны (4K, 1080p, ноутбуки 1366x768, планшеты, смартфоны).
 * 6. 📥 Перетаскивание файлов прямо на обои рабочего стола (Desktop File Drop Catcher).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { MdlpValidator } from '../domain/mdlp_validator.js';

function safeGet(key, defVal = null) {
    try {
        return typeof localStorage !== 'undefined' && localStorage ? localStorage.getItem(key) : defVal;
    } catch (e) {
        return defVal;
    }
}

function safeSet(key, val) {
    try {
        if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(key, val);
    } catch (e) {}
}

function safeRemove(key) {
    try {
        if (typeof localStorage !== 'undefined' && localStorage) localStorage.removeItem(key);
    } catch (e) {}
}

export class WebOsUiController {
    constructor(app) {
        this.app = app;
        this.isLocked = false;
        this.lockClockInterval = null;
        this.selectedDesktopIcons = new Set();
        this.isMarqueeSelecting = false;
        this.marqueeStartX = 0;
        this.marqueeStartY = 0;
        this.isDockCentered = true;
        this.activeVirtualDesktop = 1;
        this.activeLang = 'РУС';
        this.allWindowsMinimized = false;
        this.preShowDesktopState = [];
        this.activeContextMenuTarget = null;

        // Набор ТОЛЬКО открытых прямо сейчас окон (по умолчанию открыт только Редактор Накладных)
        this.runningApps = new Set(['winEditor']);

        // Метаданные всех приложений WebOS
        this.appsCatalog = {
            winEditor: { id: 'winEditor', title: 'Редактор Накладных', icon: '📄', badge: 'EDI Grid' },
            winCameraScanner: { id: 'winCameraScanner', title: 'ТСД Сканер', icon: '📱', badge: 'Честный ЗНАК' },
            winBatchProcessor: { id: 'winBatchProcessor', title: 'Пакетный EDI', icon: '📦', badge: 'Конвейер' },
            winJnvlp: { id: 'winJnvlp', title: 'ЖНВЛП & Цены', icon: '💊', badge: '89 регионов' },
            winLabelPrinter: { id: 'winLabelPrinter', title: 'Печать ценников', icon: '🏷️', badge: 'Термопринтер' },
            winDiffViewer: { id: 'winDiffViewer', title: 'Сравнение EDI', icon: '⇄', badge: 'Visual Diff' },
            winSqlConsole: { id: 'winSqlConsole', title: 'SQL Консоль', icon: '>_', badge: 'SQLite WASM' },
            winDb: { id: 'winDb', title: 'СУБД ERP', icon: '🗄️', badge: 'Каталог ГРЛС' },
            winReconcile: { id: 'winReconcile', title: 'Сверка Накладных', icon: '📋', badge: 'Smart Match' },
            winSchema: { id: 'winSchema', title: 'Конструктор Схем', icon: '📐', badge: 'DBF Doctor' },
            winWizard: { id: 'winWizard', title: 'Мастер 2.0', icon: '🚀', badge: 'Конвертация' },
            winInspector: { id: 'winInspector', title: 'Инспектор ФЛК', icon: '🛠️', badge: 'Аудит' },
            winKb: { id: 'winKb', title: 'База Знаний', icon: '📚', badge: '25+ регламентов' },
            winGuide: { id: 'winGuide', title: 'Гид F1', icon: '📖', badge: 'Обучение' },
            winSettings: { id: 'winSettings', title: 'Параметры', icon: '⚙️', badge: 'Система' },
            winUpdateCenter: { id: 'winUpdateCenter', title: 'Центр Обновлений', icon: '🔄', badge: 'v2026.3.3' },
            winScale: { id: 'winScale', title: 'Экран & Масштаб', icon: '🔎±', badge: 'Auto-DPI' },
            winPersonalization: { id: 'winPersonalization', title: 'Персонализация', icon: '🎨', badge: 'Обои & Темы' }
        };
    }

    init() {
        this._patchWindowLifecycle();
        this._initDesktopMarquee();
        this._initControlCenter();
        this._initLockScreen();
        this._initBarcodeGadget();
        this._initStickyNotesGadget();
        this._enhanceTaskbar();
        this._initTaskView();
        this._initContextMenus();
        this._initDesktopFileDrop();
        this._initResponsiveGridAutoArrange();
        this._bindGlobalOsShortcuts();
        console.log("[WebOsUiController] Windows 11 Fluent WebOS окружение успешно запущено.");
    }

    // =========================================================================
    // 1. ЖИЗНЕННЫЙ ЦИКЛ ОКОН & УМНЫЙ ТАСКБАР (ТОЛЬКО ОТКРЫТЫЕ ОКНА)
    // =========================================================================

    _patchWindowLifecycle() {
        const app = this.app;
        if (!app) return;

        // Патч открытия окна: добавляем окно в runningApps
        app.openApp = (winId) => {
            if (winId === 'winPersonalization' || winId === 'winScale') {
                app.openSettingsTab?.('tabPersonalization');
                return;
            }
            if (winId === 'winLiteMode') {
                app.toggleLiteMode?.();
                return;
            }

            const win = typeof document !== 'undefined' ? document.getElementById(winId) : null;
            if (!win) return;

            // Добавляем в список запущенных программ
            this.runningApps.add(winId);

            const wasMinimized = win.classList.contains('minimized');
            win.classList.remove('minimized');
            app.focusWindow?.(winId);

            // Адаптивное центрирование если окно вылезло за экран
            this._clampWindowInViewport(win);

            if (wasMinimized) {
                win.classList.add('win-opening');
                setTimeout(() => {
                    win.classList.remove('win-opening');
                }, 260);
                app.crossPlatform?.playSound?.('window_open');
            }

            this.allWindowsMinimized = false;
            this._enhanceTaskbar();
            app._redrawWindowContents?.(winId);
        };

        // Патч сворачивания окна: окно остается в runningApps, но скрыто
        app.minimizeApp = (winId) => {
            const win = typeof document !== 'undefined' ? document.getElementById(winId) : null;
            if (!win || win.classList.contains('minimized')) return;

            win.classList.add('win-minimizing');
            app.crossPlatform?.playSound?.('window_close');

            setTimeout(() => {
                win.classList.add('minimized');
                win.classList.remove('win-minimizing');
                this._enhanceTaskbar();
            }, 180);
        };

        // Патч закрытия окна: окно УДАЛЯЕТСЯ из runningApps и исчезает с панели задач!
        app.closeApp = (winId) => {
            const win = typeof document !== 'undefined' ? document.getElementById(winId) : null;
            if (!win) return;

            // Удаляем из панели задач
            this.runningApps.delete(winId);

            win.classList.add('win-minimizing');
            app.crossPlatform?.playSound?.('window_close');

            setTimeout(() => {
                win.classList.add('minimized');
                win.classList.remove('win-minimizing');
                this._enhanceTaskbar();
            }, 180);
        };

        // Патч максимизации окна
        app.maximizeApp = (winId) => {
            const win = typeof document !== 'undefined' ? document.getElementById(winId) : null;
            if (!win) return;

            const isMax = win.classList.toggle('maximized');
            const maxBtn = win.querySelector('.win-btn-max');
            if (maxBtn) {
                maxBtn.textContent = isMax ? '❐' : '□';
                maxBtn.title = isMax ? 'Восстановить размер' : 'Развернуть на весь экран';
            }

            app.crossPlatform?.playSound?.('click');
            app._redrawWindowContents?.(winId);
        };

        if (typeof document === 'undefined') return;

        // Перехват кнопок всех окон
        document.querySelectorAll('.os-window').forEach(win => {
            const header = win.querySelector('.win-header');
            if (!header) return;

            // Двойной клик по заголовку разворачивает окно
            header.addEventListener('dblclick', (e) => {
                if (e.target.closest('button, input, select, textarea')) return;
                app.maximizeApp(win.id);
            });

            // Правый клик по заголовку открывает контекстное меню окна
            header.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showWindowContextMenu(e, win.id);
            });

            // Отключение задержек transition во время перетаскивания (60fps)
            header.addEventListener('pointerdown', () => {
                win.classList.add('is-dragging');
            });
            window.addEventListener('pointerup', () => {
                win.classList.remove('is-dragging');
            });

            // Кнопка закрытия (X) полностью закрывает приложение и убирает из панели задач
            const closeBtn = win.querySelector('.win-btn-close');
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    app.closeApp(win.id);
                };
            }

            // Кнопка сворачивания (_) сворачивает на панель задач
            const minBtn = win.querySelector('.win-btn-min');
            if (minBtn) {
                minBtn.onclick = (e) => {
                    e.stopPropagation();
                    app.minimizeApp(win.id);
                };
            }
        });
    }

    // Ограничение положения окна в границах экрана
    _clampWindowInViewport(win) {
        if (!win || win.classList.contains('maximized')) return;
        const winW = win.offsetWidth || 700;
        const winH = win.offsetHeight || 480;
        const maxL = Math.max(10, window.innerWidth - winW - 16);
        const maxT = Math.max(10, window.innerHeight - winH - 64);

        if (win.offsetLeft > maxL) win.style.left = `${maxL}px`;
        if (win.offsetTop > maxT) win.style.top = `${maxT}px`;
        if (win.offsetLeft < 10) win.style.left = '16px';
        if (win.offsetTop < 10) win.style.top = '16px';
    }

    // =========================================================================
    // 2. WINDOWS 11 ПАНЕЛЬ ЗАДАЧ (ОТОБРАЖАЕТ ТОЛЬКО ОТКРЫТЫЕ ПРОГРАММЫ)
    // =========================================================================

    _enhanceTaskbar() {
        const app = this.app;
        if (!app) return;

        // Привязываем слушатели колесика мыши и скролла к панели задач
        if (typeof document !== 'undefined') {
            const container = document.getElementById('taskbarAppsContainer');
            const btnLeft = document.getElementById('btnTaskbarScrollLeft');
            const btnRight = document.getElementById('btnTaskbarScrollRight');
            const btnOverflow = document.getElementById('btnTaskbarOverflow');
            const overflowDropdown = document.getElementById('taskbarOverflowDropdown');

            if (container && !container._wheelBound) {
                container._wheelBound = true;
                container.addEventListener('wheel', (e) => {
                    if (e.deltaY !== 0) {
                        e.preventDefault();
                        container.scrollLeft += (e.deltaY * 1.5);
                        this._updateTaskbarOverflowUI();
                    }
                }, { passive: false });

                container.addEventListener('scroll', () => {
                    this._updateTaskbarOverflowUI();
                });

                window.addEventListener('resize', () => {
                    this._updateTaskbarOverflowUI();
                });
            }

            if (btnLeft && !btnLeft._clickBound) {
                btnLeft._clickBound = true;
                btnLeft.addEventListener('click', () => {
                    container?.scrollBy({ left: -140, behavior: 'smooth' });
                });
            }

            if (btnRight && !btnRight._clickBound) {
                btnRight._clickBound = true;
                btnRight.addEventListener('click', () => {
                    container?.scrollBy({ left: 140, behavior: 'smooth' });
                });
            }

            if (btnOverflow && !btnOverflow._clickBound) {
                btnOverflow._clickBound = true;
                btnOverflow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    overflowDropdown?.classList.toggle('hidden');
                });
                document.addEventListener('click', () => {
                    overflowDropdown?.classList.add('hidden');
                });
            }
        }

        app._updateTaskbar = () => {
            if (typeof document === 'undefined') return;
            const container = document.getElementById('taskbarAppsContainer');
            const divider = document.getElementById('taskbarDockDivider');
            if (!container) return;

            // Если открытых программ нет, скрываем разделитель и очищаем контейнер
            if (this.runningApps.size === 0) {
                container.innerHTML = '';
                if (divider) divider.style.display = 'none';
                this._updateTaskbarOverflowUI();
                return;
            }

            if (divider) divider.style.display = 'block';

            // Отображаем ТОЛЬКО те программы, которые сейчас запущены в runningApps!
            const runningItems = Array.from(this.runningApps)
                .map(id => this.appsCatalog[id])
                .filter(Boolean);

            container.innerHTML = runningItems.map(item => {
                const win = document.getElementById(item.id);
                const isMinimized = !win || win.classList.contains('minimized');
                const isFront = !isMinimized && (parseInt(win.style.zIndex || '10', 10) >= (app.topZIndex - 1));

                // Стили кнопки тайла как в Windows 11
                let tileClass = 'taskbar-app-tile relative w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none shrink-0 ';
                if (isFront) {
                    tileClass += 'bg-white/15 is-active';
                } else if (!isMinimized) {
                    tileClass += 'bg-white/5 hover:bg-white/10';
                } else {
                    tileClass += 'hover:bg-white/10 opacity-75 hover:opacity-100';
                }

                // Индикатор под иконкой
                const indicatorHtml = isFront
                    ? '<span class="taskbar-active-line"></span>'
                    : '<span class="taskbar-running-dot"></span>';

                return `
                    <button class="${tileClass}"
                            onclick="window.PharmaGate.webOsUi.handleTaskbarIconClick('${item.id}')"
                            oncontextmenu="window.PharmaGate.webOsUi.showTaskbarContextMenu(event, '${item.id}')"
                            data-tooltip-title="${item.icon} ${item.title}"
                            data-tooltip-desc="${isFront ? 'Активно на переднем плане' : (isMinimized ? 'Свернуто — нажмите для разворачивания' : 'В фоновом режиме')}"
                            data-tooltip-badge="${item.badge}"
                            data-tooltip-pos="top"
                            aria-label="${item.title}">
                        <span class="text-xl filter drop-shadow leading-none flex items-center justify-center font-bold">${item.icon}</span>
                        ${indicatorHtml}
                    </button>
                `;
            }).join('');

            this._updateTaskbarOverflowUI();
        };

        app._updateTaskbar();
    }

    _updateTaskbarOverflowUI() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('taskbarAppsContainer');
        const btnLeft = document.getElementById('btnTaskbarScrollLeft');
        const btnRight = document.getElementById('btnTaskbarScrollRight');
        const btnOverflow = document.getElementById('btnTaskbarOverflow');
        const overflowCount = document.getElementById('taskbarOverflowCount');
        const overflowDropdown = document.getElementById('taskbarOverflowDropdown');

        if (!container) return;

        const isOverflowing = container.scrollWidth > (container.clientWidth + 2);
        
        if (btnLeft && btnRight) {
            if (isOverflowing) {
                btnLeft.classList.toggle('hidden', container.scrollLeft <= 4);
                btnRight.classList.toggle('hidden', container.scrollLeft >= (container.scrollWidth - container.clientWidth - 4));
            } else {
                btnLeft.classList.add('hidden');
                btnRight.classList.add('hidden');
            }
        }

        if (btnOverflow && overflowDropdown && overflowCount) {
            if (isOverflowing && this.runningApps.size > 5) {
                const hiddenCount = Math.max(1, Math.round((container.scrollWidth - container.clientWidth) / 44));
                overflowCount.textContent = `+${hiddenCount}`;
                btnOverflow.classList.remove('hidden');

                // Рендерим выпадающий список окон для быстрого переключения
                const runningItems = Array.from(this.runningApps)
                    .map(id => this.appsCatalog[id])
                    .filter(Boolean);

                overflowDropdown.innerHTML = runningItems.map(item => {
                    const win = document.getElementById(item.id);
                    const isMin = !win || win.classList.contains('minimized');
                    return `
                        <button class="w-full px-2.5 py-1.5 text-left hover:bg-blue-600/30 hover:text-white rounded flex items-center justify-between gap-3 text-xs text-slate-200 cursor-pointer"
                                onclick="window.PharmaGate.webOsUi.handleTaskbarIconClick('${item.id}')">
                            <span class="flex items-center gap-2 truncate">
                                <span>${item.icon}</span>
                                <span class="truncate">${item.title}</span>
                            </span>
                            <span class="text-[10px] text-slate-500 font-mono">${isMin ? 'свернуто' : 'открыто'}</span>
                        </button>
                    `;
                }).join('');
            } else {
                btnOverflow.classList.add('hidden');
                overflowDropdown.classList.add('hidden');
            }
        }
    }

    // Клик по значку в панели задач (поведение Windows 11)
    handleTaskbarIconClick(winId) {
        const win = document.getElementById(winId);
        if (!win) return;

        const isMinimized = win.classList.contains('minimized');
        const isFront = !isMinimized && (parseInt(win.style.zIndex || '10', 10) >= (this.app.topZIndex - 1));

        if (isMinimized) {
            // Разворачиваем и выводим на передний план
            this.app.openApp(winId);
        } else if (isFront) {
            // Если активно на переднем плане — сворачиваем
            this.app.minimizeApp(winId);
        } else {
            // Если в фоне — выводим на передний план
            this.app.focusWindow(winId);
            this._enhanceTaskbar();
        }
    }

    // Свернуть все окна / Показать рабочий стол (Aero Peek strip)
    toggleShowDesktop() {
        const openWins = Array.from(this.runningApps)
            .map(id => document.getElementById(id))
            .filter(w => w && !w.classList.contains('minimized'));

        if (openWins.length > 0) {
            this.preShowDesktopState = openWins.map(w => w.id);
            openWins.forEach(w => this.app.minimizeApp(w.id));
            this.allWindowsMinimized = true;
            this.app.crossPlatform?.playSound?.('click');
            this.app._showToast?.('🖥️ Рабочий стол отображен');
        } else if (this.preShowDesktopState.length > 0) {
            this.preShowDesktopState.forEach(id => this.app.openApp(id));
            this.allWindowsMinimized = false;
            this.app.crossPlatform?.playSound?.('click');
        }
    }

    // Переключение языка РУС / ENG
    toggleLanguage() {
        this.activeLang = this.activeLang === 'РУС' ? 'ENG' : 'РУС';
        const btn = document.getElementById('btnLangToggle');
        if (btn) btn.textContent = this.activeLang;
        this.app.crossPlatform?.playSound?.('click');
        this.app._showToast?.(`🌐 Язык переключен: ${this.activeLang === 'РУС' ? 'Русский' : 'English'}`);
    }

    // Всплывающее меню скрытых значков (^)
    toggleTrayOverflow() {
        const flyout = document.getElementById('trayOverflowFlyout');
        if (!flyout) return;
        const isHidden = flyout.classList.toggle('hidden');
        if (!isHidden) {
            this.app.crossPlatform?.playSound?.('click');
        }
    }

    // =========================================================================
    // 3. ПРЕДСТАВЛЕНИЕ ЗАДАЧ / ВИРТУАЛЬНЫЕ РАБОЧИЕ СТОЛЫ (TASK VIEW)
    // =========================================================================

    _initTaskView() {
        if (typeof document === 'undefined') return;
        const overlay = document.getElementById('taskViewOverlay');
        if (!overlay) return;

        // Клик мимо карточек закрывает оверлей
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.id === 'taskViewGrid') {
                this.closeTaskView();
            }
        });

        // Переключение виртуальных столов
        overlay.querySelectorAll('.vdesktop-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const desk = parseInt(tab.getAttribute('data-desk') || '1', 10);
                this.switchVirtualDesktop(desk);
            });
        });
    }

    toggleTaskView() {
        const overlay = document.getElementById('taskViewOverlay');
        if (!overlay) return;
        if (overlay.classList.contains('hidden')) {
            this.openTaskView();
        } else {
            this.closeTaskView();
        }
    }

    openTaskView() {
        const overlay = document.getElementById('taskViewOverlay');
        const grid = document.getElementById('taskViewGrid');
        const countBadge = document.getElementById('taskViewCountBadge');
        if (!overlay || !grid) return;

        this.app.crossPlatform?.playSound?.('click');

        // Рендерим карточки всех запущенных окон
        const openItems = Array.from(this.runningApps)
            .map(id => this.appsCatalog[id])
            .filter(Boolean);

        if (countBadge) countBadge.textContent = String(openItems.length);

        if (openItems.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <span class="text-4xl">🪟</span>
                    <span class="text-sm">Нет открытых окон</span>
                    <button onclick="window.PharmaGate.openApp('winEditor'); window.PharmaGate.webOsUi.closeTaskView()" class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold mt-2 cursor-pointer">Открыть Накладную</button>
                </div>
            `;
        } else {
            grid.innerHTML = openItems.map(item => {
                const win = document.getElementById(item.id);
                const isMinimized = !win || win.classList.contains('minimized');
                return `
                    <div class="group relative rounded-2xl bg-slate-900/90 border border-white/10 hover:border-blue-500/80 p-3 flex flex-col justify-between h-48 transition-all cursor-pointer shadow-xl hover:shadow-2xl hover:scale-[1.02]"
                         onclick="window.PharmaGate.openApp('${item.id}'); window.PharmaGate.webOsUi.closeTaskView()">
                        <div class="flex items-center justify-between pb-2 border-b border-white/10">
                            <span class="flex items-center gap-2 text-xs font-bold text-white truncate">
                                <span>${item.icon}</span>
                                <span>${item.title}</span>
                            </span>
                            <button onclick="event.stopPropagation(); window.PharmaGate.closeApp('${item.id}'); window.PharmaGate.webOsUi.openTaskView()"
                                    class="w-6 h-6 rounded hover:bg-red-600/80 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer">✕</button>
                        </div>
                        <div class="flex-1 flex flex-col items-center justify-center text-center p-2 text-slate-400">
                            <span class="text-4xl filter drop-shadow">${item.icon}</span>
                            <span class="text-[10px] text-slate-500 font-mono mt-2">${item.badge}</span>
                            <span class="text-[9px] px-2 py-0.5 rounded-full ${isMinimized ? 'bg-slate-800 text-slate-400' : 'bg-emerald-950 text-emerald-300'} mt-1 font-semibold">${isMinimized ? 'Свернуто' : 'Активно'}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        overlay.classList.remove('hidden');
    }

    closeTaskView() {
        const overlay = document.getElementById('taskViewOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

    switchVirtualDesktop(deskNumber) {
        this.activeVirtualDesktop = deskNumber;
        document.querySelectorAll('.vdesktop-tab').forEach(tab => {
            const isMatch = parseInt(tab.getAttribute('data-desk') || '1', 10) === deskNumber;
            tab.classList.toggle('active', isMatch);
            tab.classList.toggle('bg-blue-600/30', isMatch);
            tab.classList.toggle('border-blue-500/60', isMatch);
            tab.classList.toggle('bg-white/5', !isMatch);
            tab.classList.toggle('border-white/10', !isMatch);
        });

        this.app.crossPlatform?.playSound?.('chime');
        this.app._showToast?.(`🖥️ Переключение на: Рабочий стол ${deskNumber}`);

        // Для стола 2 по умолчанию предлагаем СУБД и SQL
        if (deskNumber === 2 && !this.runningApps.has('winDb')) {
            this.app.openApp('winDb');
        }
    }

    // =========================================================================
    // 4. КОНТЕКСТНЫЕ МЕНЮ (WINDOWS 11 FLUENT CONTEXT MENUS)
    // =========================================================================

    _initContextMenus() {
        if (typeof document === 'undefined') return;

        const dMenu = document.getElementById('desktopContextMenu');
        const wMenu = document.getElementById('windowContextMenu');

        const hideAll = () => {
            dMenu?.classList.add('hidden');
            wMenu?.classList.add('hidden');
        };

        // Клик в любом месте закрывает меню
        document.addEventListener('click', hideAll);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideAll();
        });

        // 1. Правый клик по рабочему столу
        const desktopArea = document.getElementById('desktopArea');
        desktopArea?.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.os-window, #taskbar, #startMenu, #controlCenterModal')) return;
            e.preventDefault();
            hideAll();

            if (!dMenu) return;
            this.app.crossPlatform?.playSound?.('click');

            const mWidth = 330;
            const mHeight = 360;
            const left = Math.max(10, Math.min(window.innerWidth - mWidth - 10, e.clientX));
            const top = Math.max(10, Math.min(window.innerHeight - mHeight - 50, e.clientY));

            dMenu.style.left = `${left}px`;
            dMenu.style.top = `${top}px`;
            dMenu.classList.remove('hidden');
        });

        // Привязка обработчиков пунктов меню
        document.getElementById('ctxRefreshDesktop')?.addEventListener('click', () => {
            this.app.crossPlatform?.playSound?.('click');
            this.app._showToast?.('🔄 Рабочий стол обновлен');
        });
        document.getElementById('ctxArrangeGrid')?.addEventListener('click', () => {
            this.app.crossPlatform?.arrangeIconsGrid?.();
        });
        document.getElementById('ctxToggleIcons')?.addEventListener('click', () => {
            const isHidden = document.body.classList.contains('desktop-icons-hidden');
            this.app.crossPlatform?.toggleDesktopIcons?.(isHidden);
        });
        document.getElementById('ctxNewInvoice')?.addEventListener('click', () => {
            this.app.openApp('winWizard');
        });
        document.getElementById('ctxDemoInvoice')?.addEventListener('click', () => {
            this.app.crossPlatform?.generateDemoPharmaInvoice?.(50);
        });
        document.getElementById('ctxOpenSpotlightMenu')?.addEventListener('click', () => {
            this.app.crossPlatform?.openCommandPalette?.();
        });
        document.getElementById('ctxTaskViewMenu')?.addEventListener('click', () => {
            this.toggleTaskView();
        });
        document.getElementById('ctxControlCenterMenu')?.addEventListener('click', () => {
            this.toggleControlCenter();
        });
        document.getElementById('ctxOpenSql')?.addEventListener('click', () => {
            this.app.openApp('winSqlConsole');
        });
        document.getElementById('ctxPersonalization')?.addEventListener('click', () => {
            this.app.openSettingsTab?.('tabPersonalization');
        });
        document.getElementById('ctxSystemSettings')?.addEventListener('click', () => {
            this.app.openApp('winSettings');
        });
        document.getElementById('ctxLockScreen')?.addEventListener('click', () => {
            this.lockWebOs();
        });

        // 2. Обработчики контекстного меню окна
        document.getElementById('wctxMin')?.addEventListener('click', () => {
            if (this.activeContextMenuTarget) this.app.minimizeApp(this.activeContextMenuTarget);
        });
        document.getElementById('wctxMax')?.addEventListener('click', () => {
            if (this.activeContextMenuTarget) this.app.maximizeApp(this.activeContextMenuTarget);
        });
        document.getElementById('wctxSnapLeft')?.addEventListener('click', () => {
            if (this.activeContextMenuTarget) this._snapWindow(this.activeContextMenuTarget, 'left');
        });
        document.getElementById('wctxSnapRight')?.addEventListener('click', () => {
            if (this.activeContextMenuTarget) this._snapWindow(this.activeContextMenuTarget, 'right');
        });
        document.getElementById('wctxClose')?.addEventListener('click', () => {
            if (this.activeContextMenuTarget) this.app.closeApp(this.activeContextMenuTarget);
        });
    }

    showWindowContextMenu(e, winId) {
        this.activeContextMenuTarget = winId;
        const wMenu = document.getElementById('windowContextMenu');
        if (!wMenu) return;

        this.app.crossPlatform?.playSound?.('click');

        const mWidth = 210;
        const mHeight = 180;
        const left = Math.max(10, Math.min(window.innerWidth - mWidth - 10, e.clientX));
        const top = Math.max(10, Math.min(window.innerHeight - mHeight - 50, e.clientY));

        wMenu.style.left = `${left}px`;
        wMenu.style.top = `${top}px`;
        wMenu.classList.remove('hidden');
    }

    showTaskbarContextMenu(e, winId) {
        e.preventDefault();
        e.stopPropagation();
        this.showWindowContextMenu(e, winId);
    }

    _snapWindow(winId, side) {
        const win = document.getElementById(winId);
        if (!win) return;
        win.classList.remove('maximized', 'minimized');
        const halfW = Math.floor((window.innerWidth - 12) / 2);
        const fullH = window.innerHeight - 56;

        win.style.width = `${halfW}px`;
        win.style.height = `${fullH}px`;
        win.style.top = '6px';
        win.style.left = side === 'left' ? '6px' : `${halfW + 6}px`;

        this.app.focusWindow(winId);
        this.app._redrawWindowContents?.(winId);
    }

    // =========================================================================
    // 5. ПРИЕМ ФАЙЛОВ ПРЯМО НА ОБОИ СТОЛА (DESKTOP DRAG & DROP)
    // =========================================================================

    _initDesktopFileDrop() {
        if (typeof window === 'undefined') return;

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer?.files || []);
            if (files.length === 0) return;

            if (files.length === 1) {
                this.app.openApp('winEditor');
                this.app._loadFileDirectly?.(files[0]);
                this.app._showToast?.(`📥 Открыт файл: ${files[0].name}`);
            } else {
                this.app.openApp('winBatchProcessor');
                this.app.handleBatchFiles?.(files);
                this.app._showToast?.(`📦 Пакетная загрузка: ${files.length} накладных`);
            }
        });
    }

    // =========================================================================
    // 6. АДАПТИВНОЕ АВТОВЫРАВНИВАНИЕ ЗНАЧКОВ НА ВСЕХ ЭКРАНАХ
    // =========================================================================

    _initResponsiveGridAutoArrange() {
        if (typeof window === 'undefined') return;

        const onResize = () => {
            // Перевыравнивание всех окон если вылезли
            document.querySelectorAll('.os-window:not(.minimized)').forEach(win => {
                this._clampWindowInViewport(win);
            });

            // На мобильных экранах (< 768px)
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                document.body.classList.add('is-mobile-screen');
            } else {
                document.body.classList.remove('is-mobile-screen');
            }
        };

        window.addEventListener('resize', onResize);
        setTimeout(onResize, 500);
    }

    // =========================================================================
    // 7. ЛАССО, ЦЕНТР УПРАВЛЕНИЯ, ЭКРАН БЛОКИРОВКИ, ГАДЖЕТЫ
    // =========================================================================

    _initDesktopMarquee() {
        if (typeof document === 'undefined') return;
        const desktopArea = document.getElementById('desktopArea');
        if (!desktopArea) return;

        let marquee = document.getElementById('desktopMarquee');
        if (!marquee) {
            marquee = document.createElement('div');
            marquee.id = 'desktopMarquee';
            marquee.className = 'desktop-marquee hidden';
            desktopArea.appendChild(marquee);
        }

        const icons = () => Array.from(document.querySelectorAll('.desktop-icon'));

        desktopArea.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.os-window, #taskbar, #startMenu, .desktop-gadget, #desktopQuickWidget, #desktopContextMenu, #controlCenterModal, #timeFlyoutModal, #taskViewOverlay')) {
                return;
            }

            const clickedIcon = e.target.closest('.desktop-icon');
            if (clickedIcon) {
                if (e.ctrlKey || e.metaKey) {
                    clickedIcon.classList.toggle('selected');
                } else {
                    icons().forEach(i => i.classList.toggle('selected', i === clickedIcon));
                }
                return;
            }

            if (!e.ctrlKey && !e.metaKey) {
                icons().forEach(i => i.classList.remove('selected'));
            }

            this.isMarqueeSelecting = true;
            const rect = desktopArea.getBoundingClientRect();
            this.marqueeStartX = e.clientX - rect.left;
            this.marqueeStartY = e.clientY - rect.top;

            marquee.style.left = `${this.marqueeStartX}px`;
            marquee.style.top = `${this.marqueeStartY}px`;
            marquee.style.width = '0px';
            marquee.style.height = '0px';
            marquee.classList.remove('hidden');

            try { desktopArea.setPointerCapture(e.pointerId); } catch (err) {}
        });

        desktopArea.addEventListener('pointermove', (e) => {
            if (!this.isMarqueeSelecting) return;

            const rect = desktopArea.getBoundingClientRect();
            const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

            const left = Math.min(this.marqueeStartX, currentX);
            const top = Math.min(this.marqueeStartY, currentY);
            const width = Math.abs(currentX - this.marqueeStartX);
            const height = Math.abs(currentY - this.marqueeStartY);

            marquee.style.left = `${left}px`;
            marquee.style.top = `${top}px`;
            marquee.style.width = `${width}px`;
            marquee.style.height = `${height}px`;

            const mRight = left + width;
            const mBottom = top + height;

            icons().forEach(icon => {
                const iLeft = icon.offsetLeft;
                const iTop = icon.offsetTop;
                const iRight = iLeft + icon.offsetWidth;
                const iBottom = iTop + icon.offsetHeight;

                const intersects = !(mRight < iLeft || left > iRight || mBottom < iTop || top > iBottom);
                if (intersects) {
                    icon.classList.add('selected');
                } else if (!e.ctrlKey && !e.metaKey) {
                    icon.classList.remove('selected');
                }
            });
        });

        const stopMarquee = (e) => {
            if (!this.isMarqueeSelecting) return;
            this.isMarqueeSelecting = false;
            marquee.classList.add('hidden');
            try { desktopArea.releasePointerCapture(e.pointerId); } catch (err) {}
        };

        desktopArea.addEventListener('pointerup', stopMarquee);
        desktopArea.addEventListener('pointercancel', stopMarquee);

        icons().forEach(icon => {
            icon.addEventListener('dblclick', () => {
                const appTarget = icon.getAttribute('data-app');
                if (appTarget && this.app?.openApp) {
                    this.app.openApp(appTarget);
                }
            });
        });
    }

    _initControlCenter() {
        if (typeof document === 'undefined') return;
        const btnToggle = document.getElementById('btnOpenControlCenter');
        const modal = document.getElementById('controlCenterModal');
        if (!btnToggle || !modal) return;

        btnToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleControlCenter();
        });

        document.addEventListener('click', (e) => {
            if (!modal.contains(e.target) && !btnToggle.contains(e.target) && !modal.classList.contains('hidden')) {
                this.closeControlCenter();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.closeControlCenter();
            }
        });

        const volSlider = document.getElementById('ccVolumeSlider');
        const volLabel = document.getElementById('ccVolumeLabel');
        if (volSlider && volLabel) {
            volSlider.value = safeGet('pharmagate_audio_volume', '80');
            volLabel.textContent = `${volSlider.value}%`;

            volSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                volLabel.textContent = `${val}%`;
                safeSet('pharmagate_audio_volume', val);
                if (this.app?.crossPlatform) {
                    this.app.crossPlatform.audioGain = val / 100;
                    this.app.crossPlatform.audioEnabled = val > 0;
                }
            });

            volSlider.addEventListener('change', () => {
                this.app?.crossPlatform?.playSound?.('chime');
            });
        }

        const dpiSlider = document.getElementById('ccDpiSlider');
        const dpiLabel = document.getElementById('ccDpiLabel');
        if (dpiSlider && dpiLabel) {
            const currentZoom = Math.round((this.app?.crossPlatform?.zoomFactor || 1) * 100);
            dpiSlider.value = currentZoom;
            dpiLabel.textContent = `${currentZoom}%`;

            dpiSlider.addEventListener('input', (e) => {
                const zoomVal = parseInt(e.target.value, 10);
                dpiLabel.textContent = `${zoomVal}%`;
                if (this.app?.crossPlatform) {
                    this.app.crossPlatform.applyZoom?.(zoomVal / 100, false);
                }
            });
        }

        const blurSelect = document.getElementById('ccBlurSelect');
        if (blurSelect) {
            blurSelect.value = safeGet('pharmagate_blur_mode', 'strong');
            blurSelect.addEventListener('change', (e) => {
                this.app?.crossPlatform?.setWindowBlur?.(e.target.value, true);
            });
        }

        modal.querySelectorAll('.cc-theme-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const theme = chip.getAttribute('data-theme');
                if (theme && this.app?.crossPlatform) {
                    this.app.crossPlatform.setTheme?.(theme, true);
                    this._syncControlCenterThemeChips(theme);
                }
            });
        });

        modal.querySelectorAll('.cc-os-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const os = chip.getAttribute('data-os');
                if (os && this.app?.crossPlatform) {
                    this.app.crossPlatform.setOsPersona?.(os);
                    this._syncControlCenterOsChips(os);
                }
            });
        });

        document.getElementById('ccToggleLite')?.addEventListener('click', () => {
            this.app?.toggleLiteMode?.();
            this._syncControlCenterToggles();
        });

        document.getElementById('ccToggleFullscreen')?.addEventListener('click', () => {
            this.app?.toggleFullscreen?.();
            this._syncControlCenterToggles();
        });

        document.getElementById('ccBtnLockScreen')?.addEventListener('click', () => {
            this.closeControlCenter();
            this.lockWebOs();
        });

        document.getElementById('ccBtnClearCache')?.addEventListener('click', () => {
            this.app?.crossPlatform?.clearAppCache?.();
        });

        modal.querySelectorAll('.cc-wp-thumb').forEach(thumb => {
            thumb.addEventListener('click', () => {
                const wp = thumb.getAttribute('data-wp');
                if (wp && this.app?.crossPlatform) {
                    this.app.crossPlatform.setWallpaper?.(wp, true);
                    modal.querySelectorAll('.cc-wp-thumb').forEach(t => t.classList.remove('ring-2', 'ring-blue-500'));
                    thumb.classList.add('ring-2', 'ring-blue-500');
                }
            });
        });
    }

    toggleControlCenter() {
        const modal = document.getElementById('controlCenterModal');
        if (!modal) return;
        const isHidden = modal.classList.contains('hidden');
        if (isHidden) this.openControlCenter();
        else this.closeControlCenter();
    }

    openControlCenter() {
        const modal = document.getElementById('controlCenterModal');
        if (!modal) return;
        document.getElementById('timeFlyoutModal')?.classList.add('hidden');
        document.getElementById('startMenu')?.classList.add('hidden');
        this._syncControlCenterToggles();
        modal.classList.remove('hidden');
        this.app?.crossPlatform?.playSound?.('click');
    }

    closeControlCenter() {
        const modal = document.getElementById('controlCenterModal');
        if (modal) modal.classList.add('hidden');
    }

    _syncControlCenterToggles() {
        if (typeof document === 'undefined') return;
        const isLite = document.body.classList.contains('lite-mode');
        const btnLite = document.getElementById('ccToggleLite');
        if (btnLite) {
            btnLite.classList.toggle('bg-blue-600', isLite);
            btnLite.classList.toggle('text-white', isLite);
            btnLite.classList.toggle('bg-slate-800', !isLite);
            btnLite.classList.toggle('text-slate-300', !isLite);
        }

        const isFs = !!document.fullscreenElement;
        const btnFs = document.getElementById('ccToggleFullscreen');
        if (btnFs) {
            btnFs.classList.toggle('bg-blue-600', isFs);
            btnFs.classList.toggle('text-white', isFs);
            btnFs.classList.toggle('bg-slate-800', !isFs);
            btnFs.classList.toggle('text-slate-300', !isFs);
        }

        const curTheme = this.app?.crossPlatform?.activeTheme || 'fluent-dark';
        this._syncControlCenterThemeChips(curTheme);

        const curOs = this.app?.crossPlatform?.configuredOs || 'auto';
        this._syncControlCenterOsChips(curOs);
    }

    _syncControlCenterThemeChips(theme) {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.cc-theme-chip').forEach(chip => {
            const match = chip.getAttribute('data-theme') === theme;
            chip.classList.toggle('bg-blue-600', match);
            chip.classList.toggle('text-white', match);
            chip.classList.toggle('border-blue-400', match);
            chip.classList.toggle('bg-slate-800/80', !match);
            chip.classList.toggle('text-slate-300', !match);
            chip.classList.toggle('border-slate-700', !match);
        });
    }

    _syncControlCenterOsChips(os) {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.cc-os-chip').forEach(chip => {
            const match = chip.getAttribute('data-os') === os;
            chip.classList.toggle('bg-blue-600', match);
            chip.classList.toggle('text-white', match);
            chip.classList.toggle('border-blue-400', match);
            chip.classList.toggle('bg-slate-800/80', !match);
            chip.classList.toggle('text-slate-300', !match);
            chip.classList.toggle('border-slate-700', !match);
        });
    }

    _initLockScreen() {
        if (typeof document === 'undefined') return;
        const lockScreen = document.getElementById('osLockScreen');
        const btnUnlock = document.getElementById('btnUnlockScreen');
        if (!lockScreen) return;

        btnUnlock?.addEventListener('click', () => {
            this.unlockWebOs();
        });

        window.addEventListener('keydown', (e) => {
            if (this.isLocked && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                this.unlockWebOs();
            }
        });

        lockScreen.addEventListener('click', (e) => {
            if (this.isLocked && !e.target.closest('#lockUserCard')) {
                this.unlockWebOs();
            }
        });
    }

    lockWebOs() {
        if (typeof document === 'undefined') return;
        const lockScreen = document.getElementById('osLockScreen');
        if (!lockScreen) return;

        this.isLocked = true;
        lockScreen.classList.remove('hidden', 'lock-exiting');

        this._updateLockClock();
        if (this.lockClockInterval) clearInterval(this.lockClockInterval);
        this.lockClockInterval = setInterval(() => this._updateLockClock(), 1000);

        this.app?.crossPlatform?.playSound?.('click');
    }

    unlockWebOs() {
        if (typeof document === 'undefined') return;
        const lockScreen = document.getElementById('osLockScreen');
        if (!lockScreen) return;

        lockScreen.classList.add('lock-exiting');
        this.app?.crossPlatform?.playSound?.('chime');

        setTimeout(() => {
            lockScreen.classList.add('hidden');
            lockScreen.classList.remove('lock-exiting');
            this.isLocked = false;
            if (this.lockClockInterval) {
                clearInterval(this.lockClockInterval);
                this.lockClockInterval = null;
            }
        }, 280);
    }

    _updateLockClock() {
        if (typeof document === 'undefined') return;
        const now = new Date();
        const timeEl = document.getElementById('lockClockTime');
        const dateEl = document.getElementById('lockClockDate');

        if (timeEl) {
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            timeEl.textContent = `${h}:${m}:${s}`;
        }

        if (dateEl) {
            const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            const dateStr = now.toLocaleDateString('ru-RU', options);
            dateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        }
    }

    _initBarcodeGadget() {
        if (typeof document === 'undefined') return;
        const input = document.getElementById('gadgetBarcodeInput');
        const resultBox = document.getElementById('gadgetBarcodeResult');
        const btnSend = document.getElementById('btnGadgetSendToScanner');
        const btnClear = document.getElementById('btnGadgetBarcodeClear');

        if (!input || !resultBox) return;

        const updateValidation = () => {
            const raw = input.value.trim();
            if (!raw) {
                resultBox.innerHTML = '<span class="text-slate-400">Введите штрихкод (EAN-13) или КИЗ Честный ЗНАК для мгновенного анализа...</span>';
                if (btnSend) btnSend.classList.add('hidden');
                return;
            }

            if (raw.length >= 25 || raw.startsWith('01') || raw.includes('\x1d')) {
                const dm = MdlpValidator.validateDataMatrix(raw, 'pharma');
                if (dm.isValid) {
                    resultBox.innerHTML = `
                        <div class="space-y-1">
                            <div class="flex items-center gap-1.5 text-emerald-400 font-bold">
                                <span>✔</span>
                                <span>Честный ЗНАК: Валиден (100%)</span>
                            </div>
                            <div class="text-[11px] font-mono text-slate-300">
                                GTIN: <b class="text-white">${dm.gtin}</b> · Серия: <b class="text-white">${dm.series || '—'}</b> · Срок: <b class="text-white">${dm.expDate || '—'}</b>
                            </div>
                            <div class="text-[10px] text-slate-400 truncate">
                                SN: ${dm.serial} · Криптохвост: 44 знака OK
                            </div>
                        </div>
                    `;
                } else {
                    resultBox.innerHTML = `
                        <div class="space-y-1">
                            <div class="flex items-center gap-1.5 text-amber-400 font-semibold">
                                <span>⚠</span>
                                <span>Честный ЗНАК: Замечания структуры</span>
                            </div>
                            <div class="text-[10px] text-amber-300">
                                ${dm.errors?.[0] || 'Неверный контрольный разряд GTIN или длина криптохвоста'}
                            </div>
                        </div>
                    `;
                }
                if (btnSend) btnSend.classList.remove('hidden');
                return;
            }

            if (/^\d{12,13}$/.test(raw)) {
                const eanCheck = MdlpValidator.validateEan13(raw);
                if (eanCheck.isValid) {
                    resultBox.innerHTML = `
                        <div class="space-y-1">
                            <div class="flex items-center gap-1.5 text-emerald-400 font-bold">
                                <span>✔</span>
                                <span>EAN-13: Контрольная цифра верна</span>
                            </div>
                            <div class="text-[11px] font-mono text-slate-300">
                                Штрихкод: <b class="text-white">${eanCheck.raw}</b>
                            </div>
                        </div>
                    `;
                } else {
                    resultBox.innerHTML = `
                        <div class="space-y-1">
                            <div class="flex items-center gap-1.5 text-red-400 font-semibold">
                                <span>✕</span>
                                <span>EAN-13: Ошибка контрольного разряда</span>
                            </div>
                            <div class="text-[10px] text-red-300">
                                Ожидается контрольная цифра: <b>${eanCheck.calculatedCheckDigit}</b>, указана: <b>${eanCheck.actualCheckDigit}</b>
                            </div>
                        </div>
                    `;
                }
                if (btnSend) btnSend.classList.remove('hidden');
                return;
            }

            resultBox.innerHTML = '<span class="text-amber-400">Неизвестный формат (требуется 13 цифр EAN или КИЗ Честный ЗНАК)</span>';
            if (btnSend) btnSend.classList.add('hidden');
        };

        input.addEventListener('input', updateValidation);

        btnClear?.addEventListener('click', () => {
            input.value = '';
            updateValidation();
            input.focus();
        });

        btnSend?.addEventListener('click', () => {
            const raw = input.value.trim();
            if (!raw) return;
            this.app?.openApp?.('winCameraScanner');
            const manualInp = document.getElementById('inpScanManualCode');
            if (manualInp) {
                manualInp.value = raw;
                document.getElementById('btnScanManualApply')?.click();
            }
        });
    }

    _initStickyNotesGadget() {
        if (typeof document === 'undefined') return;
        const noteArea = document.getElementById('gadgetStickyNotesText');
        const charCount = document.getElementById('gadgetNotesChars');
        const clearBtn = document.getElementById('btnGadgetNotesClear');
        const gadget = document.getElementById('desktopGadgetNotes');

        if (!noteArea || !gadget) return;

        noteArea.value = safeGet('pharmagate_sticky_note', '');
        if (charCount) charCount.textContent = `${noteArea.value.length} симв.`;

        const savedColor = safeGet('pharmagate_sticky_color', 'amber');
        this._setStickyNoteColor(savedColor);

        noteArea.addEventListener('input', () => {
            const val = noteArea.value;
            safeSet('pharmagate_sticky_note', val);
            if (charCount) charCount.textContent = `${val.length} симв.`;
        });

        clearBtn?.addEventListener('click', () => {
            noteArea.value = '';
            safeRemove('pharmagate_sticky_note');
            if (charCount) charCount.textContent = '0 симв.';
            noteArea.focus();
        });

        gadget.querySelectorAll('.btn-sticky-color').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.getAttribute('data-color');
                if (color) {
                    this._setStickyNoteColor(color);
                    safeSet('pharmagate_sticky_color', color);
                }
            });
        });
    }

    _setStickyNoteColor(color) {
        if (typeof document === 'undefined') return;
        const gadget = document.getElementById('desktopGadgetNotes');
        if (!gadget) return;

        const colorMap = {
            amber: { bg: 'bg-amber-950/30', header: 'bg-amber-500/20 text-amber-300 border-amber-500/30', text: 'text-amber-100' },
            emerald: { bg: 'bg-emerald-950/30', header: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', text: 'text-emerald-100' },
            blue: { bg: 'bg-blue-950/30', header: 'bg-blue-500/20 text-blue-300 border-blue-500/30', text: 'text-blue-100' },
            purple: { bg: 'bg-purple-950/30', header: 'bg-purple-500/20 text-purple-300 border-purple-500/30', text: 'text-purple-100' }
        };

        const theme = colorMap[color] || colorMap.amber;
        const header = gadget.querySelector('.desktop-gadget-header');
        const content = gadget.querySelector('.gadget-content');

        if (header) {
            header.className = `desktop-gadget-header border-b ${theme.header}`;
        }
        if (content) {
            content.className = `gadget-content p-2.5 ${theme.bg}`;
        }
    }

    _bindGlobalOsShortcuts() {
        if (typeof window === 'undefined') return;
        window.addEventListener('keydown', (e) => {
            // Win+L или Ctrl+Alt+L — Блокировка экрана
            if ((e.code === 'KeyL' && (e.metaKey || (e.ctrlKey && e.altKey))) || (e.key === 'l' && e.ctrlKey && e.altKey)) {
                e.preventDefault();
                this.lockWebOs();
                return;
            }

            // Win+Tab — Представление задач
            if (e.code === 'Tab' && (e.metaKey || (e.altKey && !e.ctrlKey))) {
                e.preventDefault();
                this.toggleTaskView();
                return;
            }

            // Win или Ctrl+Esc — Открыть меню Пуск
            if (e.key === 'Meta' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                this.app?.toggleStartMenu?.();
                return;
            }

            // Ctrl+Shift+C — Открыть Центр Управления
            if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.code === 'KeyC')) {
                e.preventDefault();
                this.toggleControlCenter();
                return;
            }

            // F5 — Обновить рабочий стол
            if (e.key === 'F5' && !e.ctrlKey) {
                e.preventDefault();
                this.app._showToast?.('🔄 Рабочий стол обновлен');
                this.app.crossPlatform?.playSound?.('click');
                return;
            }
        });
    }
}

export function initWebOsUi(app) {
    const controller = new WebOsUiController(app);
    controller.init();
    app.webOsUi = controller;
    return controller;
}
