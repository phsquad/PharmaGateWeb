/**
 * js/app.js - Главный промышленный координатор и оконный менеджер PharmaGate AccessForge WebOS 2026.
 * 
 * ПОЛНОЦЕННЫЙ ЭНТЕРПРАЙЗ-РЕЛИЗ v2026.2.0 (Zero-Omission Build):
 * - 100% Client-Side WebAssembly / PWA Offline-First архитектура без серверного бэкенда;
 * - W3C Pointer Capture оконный менеджер: перетаскивание окон без срывов, 8-позиционный ресайзинг (N, S, E, W, NW, NE, SW, SE), Aero Snap силуэты;
 * - Рабочий стол Windows 11: перетаскивание ярлыков мышью и пальцем (Touch) с сохранением координат в localStorage;
 * - 5 оконных стратегий компоновки: Каскад, Сплит 50/50, Сетка 2x2, Полноэкранный фокус, Свернуть всё;
 * - Меню «Пуск» (Fluent Acrylic) с поиском, закрепленными приложениями и системной диагностикой;
 * - Редактор Накладной (EDI Grid View): виртуальная таблица 100k+ строк, O(1) подсветка ошибок ФЛК, быстрый поиск, пакетный НДС;
 * - Конструктор Схемы dBase / MS Access Table Designer с живым аудитом байтовой утилизации DBF Doctor;
 * - СУБД Mini-ERP на SQLite WASM (sql.js): реляционный проводник, O(1) поиск по EAN-13, синхронизация с накладной, экспорт в Excel;
 * - Студия Каскадной Сверки: 5-уровневый каскад (Артикул ➔ EAN13 ➔ GTIN ➔ Имя ➔ Fuzzy 80%), генерация otkaz.dbf (DOS CP866) и Акта Excel;
 * - Интерактивная База Знаний (25+ регламентов РФ: МДЛП, Честный ЗНАК, ФНС 970@, ЖНВЛП, ФЛК) с кнопками 1-Click Fix;
 * - Мастер создания накладной 2.0: терминал 2D-сканера DataMatrix (Base62), калькулятор наценок, валидатор ЖНВЛП;
 * - Инспектор Исправлений (Action Inspector): чеклист 10 задач, фильтры риска, таблица предпросмотра Было ➔ Станет;
 * - Центр Настроек: параметры авторемонта, кодировок, тест FTP-шлюза;
 * - Машина Времени (Undo/Redo стек на 25 состояний), глобальные горячие клавиши и автосохранение сессий в IndexedDB (Gzip pako.js).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { APP_CONFIG } from './engine/app_config.js';
import { getNaklSchema, FieldRule, ValidationIssue } from './domain/models.js';
import { ProfileManager } from './domain/network_profiles.js';
import { FLKEngine } from './domain/flk_engine.js';
import { CommercialGuard } from './domain/commercial_guard.js';
import { ActionInspectorEngine, ProposedAction } from './domain/action_inspector_engine.js';
import { UniversalImporter } from './services/universal_importer.js';
import { WebDBFEngine, DBFFieldDescriptor } from './engine/dbf_engine.js';
import { Torg12ExcelGenerator, UpdFns970Generator } from './services/export_service.js';
import { ReconcilerService } from './services/reconciler_service.js';
import { SQLiteWasmService } from './services/sqlite_wasm_service.js';
import { SessionCacheManager } from './services/session_cache.js';
import { DbfDoctorEngine } from './engine/dbf_doctor_engine.js';
import { DataMatrixParser, EncodingGuard } from './engine/text_engine.js';
import { DateEngine } from './engine/date_engine.js';
import { PharmaMath, GS1BarcodeValidator } from './engine/pharma_math.js';
import { PharmaVocabulary, PharmacyBranch } from './domain/pharma_vocab.js';
import { KB_ARTICLES, KB_CATEGORIES } from './domain/knowledge_base_data.js';
import { GridController } from './ui/grid_controller.js';
import { CrossPlatformHub } from './services/cross_platform_hub.js';

export class PharmaGateWebOS {
    constructor() {
        // Доменная схема и активные данные документа
        this.schema = getNaklSchema();
        this.records = [];
        this.issues = [];
        this.activeProfileKey = "neofarm";
        this.activeFileName = "Накладная_№407.dbf";
        this.metaHeader = {};
        
        // Кроссплатформенный концентратор (macOS / Windows / Linux)
        this.crossPlatform = null;
        
        // Данные сверки заказа
        this.orderRecords = [];
        this.currentReconciliation = null;

        // Машина времени (Undo / Redo)
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackDepth = 25;

        // Оконный менеджер и слои z-index
        this.topZIndex = 30;
        this.activeWindowStrategy = "cascade";
        this.windowStates = new Map();

        // База знаний
        this.kbArticles = Array.isArray(KB_ARTICLES) ? KB_ARTICLES : [];
        this.kbCategories = Array.isArray(KB_CATEGORIES) ? KB_CATEGORIES : ["Все категории"];
        this.activeKbCategory = "Все категории";

        // Виртуальные контроллеры Tabulator
        this.mainGrid = null;
        this.erpGrid = null;
        this.reconcilerGrid = null;

        // Настройки и темы
        this.currentTheme = "dark";
    }

    /**
     * Главная точка инициализации WebOS
     */
    async init() {
        console.log(`%c[PharmaGate WebOS 2026] Запуск ${APP_CONFIG.DISPLAY_NAME} v${APP_CONFIG.VERSION}`, "color: #38bdf8; font-weight: bold; font-size: 14px;");
        console.log(`%c${APP_CONFIG.COPYRIGHT}`, "color: #94a3b8; font-size: 11px;");

        // 1. Инициализация Service Worker (PWA Offline-First)
        this._initServiceWorker();

        // 2. Инициализация часов и системного трея
        this._initClock();

        // 3. Интерактивный рабочий стол: перетаскивание ярлыков с сохранением позиций
        this._initDraggableDesktopIcons();

        // 4. Оконный менеджер: W3C Pointer Capture, 8-позиционный ресайзер, Aero Snap
        this._initWindowManager();
        this._initAdaptiveViewportWatcher();

        // 5. Инициализация меню «Пуск»
        this._bindStartMenu();

        // 6. Инициализация основной таблицы Tabulator
        this.mainGrid = new GridController("#tabulatorGridContainer", {
            onDataChanged: (updatedRecords) => {
                this._saveSnapshot(false);
                this.records = updatedRecords;
                this._revalidateDocument();
            },
            onSelectionChanged: (selectedRows) => {
                this._updateSelectionStatus(selectedRows);
            }
        });
        this.mainGrid.initGrid(this.schema, this.records, this.issues);

        // 7. Инициализация СУБД Mini-ERP на базе SQLite WASM
        await this._initErpDatabase();

        // 8. Инициализация кроссплатформенного концентратора (macOS / Windows / Linux)
        this.crossPlatform = new CrossPlatformHub(this);
        this.crossPlatform.init();

        // 9. Привязка всех рабочих окон и диалоговых модулей
        this._bindEditorActions();
        this._bindSchemaDesigner();
        this._bindReconciliation();
        this._bindKnowledgeBase();
        this._bindCreateWizard();
        this._bindActionInspector();
        this._bindSettingsCenter();
        this._bindWindowStrategySelectors();

        // 10. Глобальные слушатели горячих клавиш, Drag & Drop и таймер автосохранения
        this._bindKeyboardShortcuts();
        this._bindDragAndDrop();
        this._startSessionAutoSaver();

        // 11. Загрузка демонстрационного набора данных ГРЛС/МДЛП
        this._loadDemoData();
    }

    // =========================================================================
    // 1. СИСТЕМНЫЕ СЛУЖБЫ: PWA SERVICE WORKER И ЧАСЫ
    // =========================================================================

    _initServiceWorker() {
        if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log("[PWA] Service Worker активен. Область:", reg.scope))
                .catch(err => console.warn("[PWA] Регистрация Service Worker отклонена:", err));
        }
    }

    _initClock() {
        const clock = document.getElementById('systemClock');
        const update = () => {
            const now = new Date();
            if (clock) clock.innerText = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        };
        update();
        setInterval(update, 1000);
    }

    // =========================================================================
    // 2. ИНТЕРАКТИВНЫЙ РАБОЧИЙ СТОЛ: ПЕРЕТАСКИВАНИЕ ЯРЛЫКОВ С СОХРАНЕНИЕМ
    // =========================================================================

    _initDraggableDesktopIcons() {
        const desktop = document.getElementById('desktopArea');
        if (!desktop) return;

        const icons = document.querySelectorAll('.desktop-icon');
        const savedPositions = JSON.parse(localStorage.getItem('pharmagate_icons_pos') || '{}');

        // Гарантированные координаты по умолчанию для всех иконок (включая персонализацию)
        const defaultPositions = {
            winEditor: { x: 16, y: 16 },
            winSchema: { x: 16, y: 112 },
            winDb: { x: 16, y: 208 },
            winReconcile: { x: 16, y: 304 },
            winKb: { x: 16, y: 400 },
            winWizard: { x: 120, y: 16 },
            winInspector: { x: 120, y: 112 },
            winSettings: { x: 120, y: 208 },
            winPersonalization: { x: 120, y: 304 },
            winScale: { x: 120, y: 400 },
            winLiteMode: { x: 120, y: 496 }
        };

        icons.forEach((icon) => {
            const appTarget = icon.getAttribute('data-app');
            const pos = savedPositions[appTarget] || defaultPositions[appTarget];
            if (pos) {
                icon.style.left = `${pos.x}px`;
                icon.style.top = `${pos.y}px`;
            }

            let isDrag = false;
            let startX = 0, startY = 0, initL = 0, initT = 0, moved = false;

            const onPointerDown = (e) => {
                isDrag = true;
                moved = false;
                icon.setPointerCapture(e.pointerId);
                startX = e.clientX;
                startY = e.clientY;
                initL = icon.offsetLeft;
                initT = icon.offsetTop;
            };

            const onPointerMove = (e) => {
                if (!isDrag || !icon || !desktop) return;
                const zoom = this.crossPlatform?.zoomFactor || 1;
                const dx = (e.clientX - startX) / zoom;
                const dy = (e.clientY - startY) / zoom;
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;

                if (!icon) return;
                const iconW = (icon && icon.offsetWidth) || 84;
                const iconH = (icon && icon.offsetHeight) || 80;
                const maxLeft = desktop.clientWidth - iconW - 10;
                const maxTop = desktop.clientHeight - iconH - 10;

                icon.style.left = `${Math.max(10, Math.min(maxLeft, initL + dx))}px`;
                icon.style.top = `${Math.max(10, Math.min(maxTop, initT + dy))}px`;
            };

            const onPointerUp = (e) => {
                if (!isDrag) return;
                isDrag = false;
                try { icon.releasePointerCapture(e.pointerId); } catch (err) {}

                if (!moved) {
                    this.openApp(appTarget);
                } else {
                    savedPositions[appTarget] = { x: icon.offsetLeft, y: icon.offsetTop };
                    localStorage.setItem('pharmagate_icons_pos', JSON.stringify(savedPositions));
                }
            };

            icon.addEventListener('pointerdown', onPointerDown);
            icon.addEventListener('pointermove', onPointerMove);
            icon.addEventListener('pointerup', onPointerUp);
            icon.addEventListener('pointercancel', onPointerUp);
        });
    }

    // =========================================================================
    // 3. ОКОННЫЙ МЕНЕДЖЕР WEB-OS (W3C POINTER CAPTURE + 8-WAY RESIZE + AERO SNAP)
    // =========================================================================

    _initWindowManager() {
        const snapGhost = document.getElementById('snapGhost');

        document.querySelectorAll('.os-window').forEach(win => {
            // Внедрение 8 ручек изменения размера
            this._injectResizeHandles(win);

            // Кнопки управления в шапке окна
            win.querySelector('.win-btn-min')?.addEventListener('click', (e) => { e.stopPropagation(); this.minimizeApp(win.id); });
            win.querySelector('.win-btn-max')?.addEventListener('click', (e) => { e.stopPropagation(); this.maximizeApp(win.id); });
            win.querySelector('.win-btn-close')?.addEventListener('click', (e) => { e.stopPropagation(); this.closeApp(win.id); });

            // Перетаскивание через W3C Pointer Capture
            const header = win.querySelector('.win-header');
            if (header) {
                let isDragging = false;
                let startX = 0, startY = 0;
                let initLeft = 0, initTop = 0;
                let snapAction = null; // 'max', 'left', 'right'

                header.addEventListener('pointerdown', (e) => {
                    if (e.target.closest('button, input, select, textarea')) return;
                    isDragging = true;
                    header.setPointerCapture(e.pointerId);
                    this.focusWindow(win.id);

                    startX = e.clientX;
                    startY = e.clientY;
                    initLeft = win.offsetLeft;
                    initTop = win.offsetTop;
                });

                header.addEventListener('pointermove', (e) => {
                    if (!isDragging || win.classList.contains('maximized')) return;

                    const zoom = this.crossPlatform?.zoomFactor || 1;
                    const deltaX = (e.clientX - startX) / zoom;
                    const deltaY = (e.clientY - startY) / zoom;

                    const maxLeft = window.innerWidth - 120;
                    const maxTop = window.innerHeight - 80;

                    const newLeft = Math.max(0, Math.min(maxLeft, initLeft + deltaX));
                    const newTop = Math.max(0, Math.min(maxTop, initTop + deltaY));

                    win.style.left = `${newLeft}px`;
                    win.style.top = `${newTop}px`;

                    // Детекция зон Aero Snap
                    if (snapGhost) {
                        if (e.clientY <= 10) {
                            snapAction = 'max';
                            snapGhost.style.display = 'block';
                            snapGhost.style.top = '6px';
                            snapGhost.style.left = '6px';
                            snapGhost.style.width = 'calc(100vw - 12px)';
                            snapGhost.style.height = 'calc(100vh - 60px)';
                        } else if (e.clientX <= 10) {
                            snapAction = 'left';
                            snapGhost.style.display = 'block';
                            snapGhost.style.top = '6px';
                            snapGhost.style.left = '6px';
                            snapGhost.style.width = 'calc(50vw - 8px)';
                            snapGhost.style.height = 'calc(100vh - 60px)';
                        } else if (e.clientX >= window.innerWidth - 10) {
                            snapAction = 'right';
                            snapGhost.style.display = 'block';
                            snapGhost.style.top = '6px';
                            snapGhost.style.left = 'calc(50vw + 2px)';
                            snapGhost.style.width = 'calc(50vw - 8px)';
                            snapGhost.style.height = 'calc(100vh - 60px)';
                        } else {
                            snapAction = null;
                            snapGhost.style.display = 'none';
                        }
                    }
                });

                const onDragEnd = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    try { header.releasePointerCapture(e.pointerId); } catch (err) {}

                    if (snapGhost) snapGhost.style.display = 'none';

                    if (snapAction === 'max') {
                        this.maximizeApp(win.id);
                    } else if (snapAction === 'left') {
                        win.classList.remove('maximized');
                        win.style.left = '6px';
                        win.style.top = '6px';
                        win.style.width = 'calc(50vw - 8px)';
                        win.style.height = 'calc(100vh - 60px)';
                        this._redrawWindowContents(win.id);
                    } else if (snapAction === 'right') {
                        win.classList.remove('maximized');
                        win.style.left = 'calc(50vw + 2px)';
                        win.style.top = '6px';
                        win.style.width = 'calc(50vw - 8px)';
                        win.style.height = 'calc(100vh - 60px)';
                        this._redrawWindowContents(win.id);
                    }
                    snapAction = null;
                };

                header.addEventListener('pointerup', onDragEnd);
                header.addEventListener('pointercancel', onDragEnd);
                header.addEventListener('dblclick', () => this.maximizeApp(win.id));
            }

            win.addEventListener('pointerdown', () => this.focusWindow(win.id));
        });

        this._updateTaskbar();
    }

    _injectResizeHandles(win) {
        const directions = [
            { dir: 't', cls: 'resizer-t' },
            { dir: 'b', cls: 'resizer-b' },
            { dir: 'l', cls: 'resizer-l' },
            { dir: 'r', cls: 'resizer-r' },
            { dir: 'lt', cls: 'resizer-lt' },
            { dir: 'rt', cls: 'resizer-rt' },
            { dir: 'lb', cls: 'resizer-lb' },
            { dir: 'rb', cls: 'resizer-rb' }
        ];

        directions.forEach(({ dir, cls }) => {
            const handle = document.createElement('div');
            handle.className = `win-resizer ${cls}`;
            win.appendChild(handle);

            let isResizing = false;
            let startX = 0, startY = 0;
            let startW = 0, startH = 0;
            let startL = 0, startT = 0;

            handle.addEventListener('pointerdown', (e) => {
                if (!win) return;
                isResizing = true;
                try { handle.setPointerCapture(e.pointerId); } catch (err) {}
                this.focusWindow(win.id);

                startX = e.clientX;
                startY = e.clientY;
                startW = win.offsetWidth || 340;
                startH = win.offsetHeight || 220;
                startL = win.offsetLeft || 10;
                startT = win.offsetTop || 10;
                e.stopPropagation();
            });

            handle.addEventListener('pointermove', (e) => {
                if (!isResizing || !win || win.classList.contains('maximized')) return;

                const zoom = this.crossPlatform?.zoomFactor || 1;
                const dx = (e.clientX - startX) / zoom;
                const dy = (e.clientY - startY) / zoom;

                if (dir.includes('r')) {
                    win.style.width = `${Math.max(340, startW + dx)}px`;
                }
                if (dir.includes('l')) {
                    const newW = Math.max(340, startW - dx);
                    if (newW > 340) {
                        win.style.width = `${newW}px`;
                        win.style.left = `${startL + dx}px`;
                    }
                }
                if (dir.includes('b')) {
                    win.style.height = `${Math.max(220, startH + dy)}px`;
                }
                if (dir.includes('t')) {
                    const newH = Math.max(220, startH - dy);
                    if (newH > 220) {
                        win.style.height = `${newH}px`;
                        win.style.top = `${startT + dy}px`;
                    }
                }
            });

            const onEnd = (e) => {
                if (!isResizing) return;
                isResizing = false;
                try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
                if (win) this._redrawWindowContents(win.id);
            };

            handle.addEventListener('pointerup', onEnd);
            handle.addEventListener('pointercancel', onEnd);
        });
    }

    _initAdaptiveViewportWatcher() {
        window.addEventListener('resize', () => {
            const isMobile = window.innerWidth < 768;
            document.querySelectorAll('.os-window:not(.minimized)').forEach(win => {
                if (!win) return;
                if (isMobile) {
                    win.classList.add('maximized');
                } else if (!win.classList.contains('maximized')) {
                    const winW = win.offsetWidth || 800;
                    const winH = win.offsetHeight || 500;
                    const maxL = window.innerWidth - winW - 20;
                    const maxT = window.innerHeight - winH - 80;
                    if (win.offsetLeft > maxL && maxL > 0) win.style.left = `${maxL}px`;
                    if (win.offsetTop > maxT && maxT > 0) win.style.top = `${Math.max(10, maxT)}px`;
                }
            });
            const isWinEditorOpen = !document.getElementById('winEditor')?.classList.contains('minimized');
            if (isWinEditorOpen && this.mainGrid?.isBuilt) {
                try { this.mainGrid.tabulator?.redraw(true); } catch (e) {}
            }
            const isWinDbOpen = !document.getElementById('winDb')?.classList.contains('minimized');
            if (isWinDbOpen && this.erpGrid) {
                try { this.erpGrid.redraw(true); } catch (e) {}
            }
            const isWinReconcileOpen = !document.getElementById('winReconcile')?.classList.contains('minimized');
            if (isWinReconcileOpen && this.reconcilerGrid) {
                try { this.reconcilerGrid.redraw(true); } catch (e) {}
            }
        });
    }

    _bindWindowStrategySelectors() {
        document.getElementById('strategySelect')?.addEventListener('change', (e) => {
            this.applyWindowStrategy(e.target.value);
        });
    }

    /**
     * Применяет выбранную стратегию расположения окон
     * @param {'cascade'|'split_lr'|'grid_2x2'|'focus'|'reset'} strategy 
     */
    applyWindowStrategy(strategy) {
        this.activeWindowStrategy = strategy;
        const openWins = Array.from(document.querySelectorAll('.os-window:not(.minimized)'));
        if (openWins.length === 0) return;

        const deskW = window.innerWidth;
        const deskH = window.innerHeight - 56;

        openWins.forEach(w => w.classList.remove('maximized'));

        if (strategy === 'cascade') {
            openWins.forEach((w, idx) => {
                const off = 28 * (idx % 6);
                w.style.left = `${140 + off}px`;
                w.style.top = `${20 + off}px`;
                w.style.width = `${Math.min(deskW - 160, 1100)}px`;
                w.style.height = `${Math.min(deskH - 40, 640)}px`;
                this.focusWindow(w.id);
            });
            this._showToast("🪟 Стратегия: Каскад");
        } else if (strategy === 'split_lr') {
            if (openWins.length >= 2) {
                const halfW = Math.floor((deskW - 16) / 2);
                openWins[0].style.left = '6px';
                openWins[0].style.top = '6px';
                openWins[0].style.width = `${halfW}px`;
                openWins[0].style.height = `${deskH - 12}px`;

                openWins[1].style.left = `${halfW + 10}px`;
                openWins[1].style.top = '6px';
                openWins[1].style.width = `${halfW}px`;
                openWins[1].style.height = `${deskH - 12}px`;
            } else if (openWins.length === 1) {
                openWins[0].classList.add('maximized');
            }
            this._showToast("🪟 Стратегия: Сплит 50/50");
        } else if (strategy === 'grid_2x2') {
            const halfW = Math.floor((deskW - 16) / 2);
            const halfH = Math.floor((deskH - 16) / 2);
            openWins.slice(0, 4).forEach((w, idx) => {
                const c = idx % 2;
                const r = Math.floor(idx / 2);
                w.style.left = `${6 + c * (halfW + 6)}px`;
                w.style.top = `${6 + r * (halfH + 6)}px`;
                w.style.width = `${halfW}px`;
                w.style.height = `${halfH}px`;
            });
            this._showToast("🪟 Стратегия: Сетка 2x2");
        } else if (strategy === 'focus') {
            openWins[openWins.length - 1].classList.add('maximized');
            this._showToast("🪟 Стратегия: Полноэкранный фокус");
        }

        openWins.forEach(w => this._redrawWindowContents(w.id));
    }

    focusWindow(winId) {
        document.querySelectorAll('.os-window').forEach(w => w.classList.remove('active-window'));
        const win = document.getElementById(winId);
        if (win) {
            this.topZIndex++;
            win.style.zIndex = String(this.topZIndex);
            win.classList.add('active-window');
        }
    }

    openApp(winId) {
        if (winId === 'winPersonalization' || winId === 'winScale') {
            this.openSettingsTab('tabPersonalization');
            return;
        }
        if (winId === 'winLiteMode') {
            this.toggleLiteMode();
            return;
        }
        const win = document.getElementById(winId);
        if (win) {
            win.classList.remove('minimized');
            this.focusWindow(winId);
            this._updateTaskbar();
            this._redrawWindowContents(winId);
        }
    }

    toggleLiteMode() {
        if (this.crossPlatform) {
            this.crossPlatform.setLiteMode(!this.crossPlatform.liteModeEnabled, true);
        }
    }

    toggleFullscreen() {
        if (this.crossPlatform) {
            this.crossPlatform.toggleFullscreen();
        }
    }

    closeApp(winId) {
        const win = document.getElementById(winId);
        if (win) {
            win.classList.add('minimized');
            this._updateTaskbar();
        }
    }

    minimizeApp(winId) { this.closeApp(winId); }

    maximizeApp(winId) {
        const win = document.getElementById(winId);
        if (win) {
            win.classList.toggle('maximized');
            this._redrawWindowContents(winId);
        }
    }

    toggleApp(winId) {
        const win = document.getElementById(winId);
        if (win) {
            if (win.classList.contains('minimized')) this.openApp(winId);
            else this.closeApp(winId);
        }
    }

    _redrawWindowContents(winId) {
        if (winId === 'winEditor' && this.mainGrid?.isBuilt) {
            try { this.mainGrid.tabulator?.redraw(true); } catch (e) {}
        }
        if (winId === 'winDb') this._refreshErpTable();
        if (winId === 'winSchema') this._renderSchemaDesigner();
        if (winId === 'winKb') this._renderKbCards();
        if (winId === 'winInspector') this._renderActionInspector();
        if (winId === 'winReconcile' && this.reconcilerGrid) {
            try { this.reconcilerGrid.redraw(true); } catch (e) {}
        }
    }

    _updateTaskbar() {
        const container = document.getElementById('taskbarAppsContainer');
        if (!container) return;

        const apps = [
            { id: 'winEditor', title: 'Накладная', icon: '📄' },
            { id: 'winSchema', title: 'Конструктор', icon: '📐' },
            { id: 'winDb', title: 'СУБД ERP', icon: '🗄️' },
            { id: 'winReconcile', title: 'Сверка', icon: '⚖️' },
            { id: 'winKb', title: 'База Знаний', icon: '📚' },
            { id: 'winWizard', title: 'Мастер 2.0', icon: '🚀' },
            { id: 'winInspector', title: 'Инспектор', icon: '🛠️' },
            { id: 'winSettings', title: 'Настройки', icon: '⚙️' }
        ];

        container.innerHTML = apps.map(app => {
            const win = document.getElementById(app.id);
            const isOpen = win && !win.classList.contains('minimized');
            const style = isOpen ? 'bg-slate-800 text-white border-blue-500 shadow-sm' : 'text-slate-400 hover:text-white border-transparent';

            return `
                <button onclick="window.PharmaGate.toggleApp('${app.id}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${style}">
                    <span>${app.icon}</span>
                    <span>${app.title}</span>
                </button>
            `;
        }).join('');
    }

    _bindStartMenu() {
        const btnStart = document.getElementById('btnStartMenu');
        const startMenu = document.getElementById('startMenu');
        const searchInput = document.getElementById('startSearchInput');
        const clearBtn = document.getElementById('btnStartSearchClear');
        const startMenuHeader = document.getElementById('startMenuHeader');

        const btnClose = document.getElementById('btnStartMenuClose');
        const btnMin = document.getElementById('btnStartMenuMinimize');
        const btnMax = document.getElementById('btnStartMenuMaximize');

        // Синхронизация бейджей и состояния персонализации внутри меню Пуск
        const syncStartMenuState = () => {
            const currentTheme = localStorage.getItem('pharmagate_theme') || 'fluent-dark';
            const themeNames = {
                'fluent-dark': 'Fluent Dark',
                'macos': 'macOS Glass',
                'pharma-light': 'Pharma Light',
                'cyber-matrix': 'Cyber Matrix',
                'retro-win95': 'Win95 / 2000',
                'midnight-nebula': 'Midnight Nebula'
            };
            const themeBadge = document.getElementById('startMenuThemeCurrentBadge');
            if (themeBadge) themeBadge.textContent = themeNames[currentTheme] || currentTheme;

            // Масштаб
            const currentZoom = Math.round((parseFloat(localStorage.getItem('pharmagate_zoom') || '1.0')) * 100);
            const scaleBadge = document.getElementById('startMenuScaleValueBadge');
            if (scaleBadge) scaleBadge.textContent = `${currentZoom}%`;
            const scaleSlider = document.getElementById('startScaleSlider');
            if (scaleSlider) scaleSlider.value = currentZoom;

            // Lite режим
            const isLite = localStorage.getItem('pharmagate_lite_mode') === 'true';
            const liteBadge = document.getElementById('startMenuLiteBadge');
            const liteBtn = document.getElementById('btnStartToggleLite');
            if (liteBadge) {
                liteBadge.textContent = isLite ? 'Lite: Вкл ⚡' : 'Lite: Выкл';
                liteBadge.className = isLite 
                    ? 'px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px]'
                    : 'px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]';
            }
            if (liteBtn) {
                liteBtn.textContent = isLite ? 'Выключить Lite Режим' : 'Включить Lite Режим';
                liteBtn.className = isLite
                    ? 'px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors shadow'
                    : 'px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow';
            }

            // Auto-DPI
            const autoDpi = localStorage.getItem('pharmagate_auto_dpi') === 'true';
            const autoDpiBadge = document.getElementById('startMenuAutoDpiBadge');
            const autoDpiChk = document.getElementById('chkStartAutoDpi');
            if (autoDpiBadge) {
                autoDpiBadge.textContent = autoDpi ? 'Auto-DPI: Вкл' : 'Auto-DPI: Выкл';
                autoDpiBadge.className = autoDpi
                    ? 'px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono text-[10px]'
                    : 'px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]';
            }
            if (autoDpiChk) autoDpiChk.checked = autoDpi;
        };

        this.toggleStartMenu = () => {
            if (!startMenu) return;
            const isVisible = startMenu.style.display === 'flex';
            if (isVisible) {
                startMenu.style.display = 'none';
            } else {
                startMenu.style.display = 'flex';
                syncStartMenuState();
                this.crossPlatform?.playSound('click');
                setTimeout(() => searchInput?.focus(), 50);
            }
        };

        btnStart?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStartMenu();
        });

        // Кнопки заголовка macOS / Windows Mini-Window
        btnClose?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (startMenu) startMenu.style.display = 'none';
        });

        btnMin?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (startMenu) startMenu.style.display = 'none';
        });

        btnMax?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!startMenu) return;
            const isMax = startMenu.classList.toggle('start-menu-fullscreen');
            btnMax.title = isMax ? 'Восстановить размер' : 'Развернуть на весь экран';
            btnMax.textContent = isMax ? '❐' : '⛶';
        });

        // Перетаскивание мини-окна за заголовок (Draggable Windows Mini-Window)
        if (startMenuHeader && startMenu) {
            let isDraggingMenu = false;
            let startX = 0, startY = 0, initLeft = 0, initTop = 0;

            startMenuHeader.addEventListener('pointerdown', (e) => {
                if (e.target.closest('button') || startMenu.classList.contains('start-menu-fullscreen')) return;
                isDraggingMenu = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = startMenu.getBoundingClientRect();
                initLeft = rect.left;
                initTop = rect.top;
                startMenu.style.bottom = 'auto';
                startMenu.style.left = `${initLeft}px`;
                startMenu.style.top = `${initTop}px`;
                startMenuHeader.setPointerCapture(e.pointerId);
            });

            startMenuHeader.addEventListener('pointermove', (e) => {
                if (!isDraggingMenu) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                startMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - 300, initLeft + dx))}px`;
                startMenu.style.top = `${Math.max(8, Math.min(window.innerHeight - 150, initTop + dy))}px`;
            });

            const stopDrag = () => { isDraggingMenu = false; };
            startMenuHeader.addEventListener('pointerup', stopDrag);
            startMenuHeader.addEventListener('pointercancel', stopDrag);
        }

        document.addEventListener('click', (e) => {
            if (startMenu && !startMenu.contains(e.target) && e.target !== btnStart && !btnStart?.contains(e.target)) {
                startMenu.style.display = 'none';
            }
        });

        // 1. Вкладки macOS Finder Sidebar
        const tabPinned = document.getElementById('startTabPinned');
        const tabFinder = document.getElementById('startTabFinder');
        const tabThemes = document.getElementById('startTabThemes');
        const tabScale = document.getElementById('startTabScale');
        const tabLite = document.getElementById('startTabLite');
        const tabActions = document.getElementById('startTabActions');

        const viewPinned = document.getElementById('startViewPinned');
        const viewFinder = document.getElementById('startViewFinder');
        const viewThemes = document.getElementById('startViewThemes');
        const viewScale = document.getElementById('startViewScale');
        const viewLite = document.getElementById('startViewLite');
        const viewActions = document.getElementById('startViewActions');

        const allTabs = [
            { btn: tabPinned, view: viewPinned },
            { btn: tabFinder, view: viewFinder },
            { btn: tabThemes, view: viewThemes },
            { btn: tabScale, view: viewScale },
            { btn: tabLite, view: viewLite },
            { btn: tabActions, view: viewActions }
        ];

        const switchStartTab = (targetBtn, targetView) => {
            allTabs.forEach(item => {
                if (!item.btn || !item.view) return;
                const isActive = item.btn === targetBtn;
                item.btn.className = isActive
                    ? 'start-sidebar-btn active w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-600 text-white font-medium transition-all text-left shadow-sm'
                    : 'start-sidebar-btn w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-left';
                item.view.classList.toggle('hidden', !isActive);
            });
            this.crossPlatform?.playSound('click');
        };

        allTabs.forEach(item => {
            item.btn?.addEventListener('click', () => switchStartTab(item.btn, item.view));
        });

        // 2. Загрузка файла через macOS Finder в меню Пуск
        const finderFileInput = document.getElementById('startFinderFileInput');
        finderFileInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (this.crossPlatform) {
                await this.crossPlatform.processUploadedFile(file);
                startMenu.style.display = 'none';
            }
        });

        // 3. Быстрая персонализация и темы внутри меню Пуск
        document.querySelectorAll('.btn-start-theme').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.getAttribute('data-theme');
                if (theme && this.crossPlatform) {
                    this.crossPlatform.setTheme(theme, true);
                    syncStartMenuState();
                }
            });
        });

        document.querySelectorAll('.btn-start-accent').forEach(btn => {
            btn.addEventListener('click', () => {
                const accent = btn.getAttribute('data-accent');
                if (accent && this.crossPlatform) {
                    this.crossPlatform.setAccentColor(accent, true);
                    syncStartMenuState();
                }
            });
        });

        // 4. Масштабирование внутри меню Пуск
        const startScaleSlider = document.getElementById('startScaleSlider');
        startScaleSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) / 100;
            this.crossPlatform?.applyZoom(val, false);
            syncStartMenuState();
        });
        startScaleSlider?.addEventListener('change', (e) => {
            const val = parseFloat(e.target.value) / 100;
            this.crossPlatform?.applyZoom(val, true);
            syncStartMenuState();
        });

        document.getElementById('btnStartScaleMinus')?.addEventListener('click', () => {
            this.crossPlatform?.zoomOut();
            syncStartMenuState();
        });

        document.getElementById('btnStartScalePlus')?.addEventListener('click', () => {
            this.crossPlatform?.zoomIn();
            syncStartMenuState();
        });

        document.querySelectorAll('.btn-start-scale-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const scale = parseFloat(btn.getAttribute('data-scale'));
                if (scale && this.crossPlatform) {
                    this.crossPlatform.applyZoom(scale, true);
                    syncStartMenuState();
                }
            });
        });

        document.getElementById('btnStartResetZoom')?.addEventListener('click', () => {
            this.crossPlatform?.applyZoom(1.0, true);
            syncStartMenuState();
        });

        const chkStartAutoDpi = document.getElementById('chkStartAutoDpi');
        chkStartAutoDpi?.addEventListener('change', (e) => {
            this.crossPlatform?.setAutoDpi(e.target.checked);
            syncStartMenuState();
        });

        // 5. Lite Speed переключатель в меню Пуск
        document.getElementById('btnStartToggleLite')?.addEventListener('click', () => {
            const currentLite = this.crossPlatform?.liteModeEnabled || false;
            this.crossPlatform?.setLiteMode(!currentLite, true);
            syncStartMenuState();
        });

        // 6. Живой поиск Spotlight по всем разделам
        searchInput?.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (clearBtn) clearBtn.classList.toggle('hidden', query.length === 0);

            if (query.length > 0 && viewPinned?.classList.contains('hidden') && viewFinder?.classList.contains('hidden')) {
                switchStartTab(tabPinned, viewPinned);
            }

            // Фильтрация ярлыков приложений
            document.querySelectorAll('#startAppsGrid .start-app-item').forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = (!query || text.includes(query)) ? 'flex' : 'none';
            });

            // Фильтрация списка файлов Finder
            document.querySelectorAll('#startRecentList > div').forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = (!query || text.includes(query)) ? 'flex' : 'none';
            });
        });

        clearBtn?.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                clearBtn.classList.add('hidden');
                document.querySelectorAll('#startAppsGrid .start-app-item, #startRecentList > div').forEach(item => {
                    item.style.display = 'flex';
                });
            }
        });
    }

    // =========================================================================
    // 4. ОКНО 1: РЕДАКТОР НАКЛАДНОЙ (MAIN EDI WORKSPACE)
    // =========================================================================

    _bindEditorActions() {
        document.getElementById('profileSelect')?.addEventListener('change', (e) => {
            this.activeProfileKey = e.target.value;
            this._revalidateDocument();
            this._showToast(`🎯 Шлюз сети переключен: ${ProfileManager.getProfile(this.activeProfileKey).title}`);
        });

        const fileInput = document.getElementById('fileInput');
        document.getElementById('btnOpenFile')?.addEventListener('click', () => {
            if (this.crossPlatform) {
                this.crossPlatform.openNativeFileDialog();
            } else {
                fileInput?.click();
            }
        });
        fileInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                await this.loadFile(file);
                fileInput.value = '';
            }
        });

        document.getElementById('btnLoadDemoInvoice')?.addEventListener('click', () => {
            this.crossPlatform?.generateDemoPharmaInvoice(50);
        });

        document.getElementById('btnAutoRepair')?.addEventListener('click', () => {
            const { repairedRecords, fixedCount } = FLKEngine.autoRepairRecords(this.schema, this.records, this.activeProfileKey);
            this._saveSnapshot();
            this.records = repairedRecords;
            this.mainGrid.updateData(this.records, this.schema, []);
            this._revalidateDocument();
            this._showToast(`🎉 Супер Авто-Ремонт 99% завершен: устранено ${fixedCount} замечаний!`);
        });

        document.getElementById('btnSaveDbf')?.addEventListener('click', () => {
            this.saveDocumentFile();
        });

        document.getElementById('btnExportTorg12')?.addEventListener('click', () => {
            if (!this.records.length) return this._showToast("⚠️ Накладная пуста!");
            Torg12ExcelGenerator.generate(this.records, { ndoc: this.records[0]?.NDOC, datedoc: this.records[0]?.DATEDOC });
            this._showToast("📄 Накладная ТОРГ-12 выгружена в Excel!");
        });

        document.getElementById('btnExportUpd')?.addEventListener('click', () => {
            if (!this.records.length) return this._showToast("⚠️ Накладная пуста!");
            UpdFns970Generator.downloadXml(this.records, this.metaHeader);
            this._showToast("📑 Титул продавца XML УПД 970@ (Windows-1251) успешно сформирован!");
        });

        document.getElementById('gridSearchInput')?.addEventListener('input', (e) => {
            this.mainGrid.searchAndSelect(e.target.value);
        });

        document.getElementById('btnVat10')?.addEventListener('click', () => {
            this._saveSnapshot();
            this.mainGrid.applyVatToSelection(10);
            this._revalidateDocument();
            this._showToast("🏷️ НДС 10% применен к выделенным строкам!");
        });

        document.getElementById('btnVat0')?.addEventListener('click', () => {
            this._saveSnapshot();
            this.mainGrid.applyVatToSelection(0);
            this._revalidateDocument();
            this._showToast("🏷️ 0% НДС (Медизделия) применен к выделенным строкам!");
        });

        document.getElementById('btnCopyTsv')?.addEventListener('click', async () => {
            const ok = await this.mainGrid.copySelectionToClipboard();
            if (ok) this._showToast("📋 Таблица скопирована в буфер обмена для Microsoft Excel (TSV)!");
        });
    }

    // =========================================================================
    // 5. ОКНО 2: КОНСТРУКТОР СХЕМЫ (ACCESS TABLE DESIGN VIEW)
    // =========================================================================

    _bindSchemaDesigner() {
        document.getElementById('btnSchemaAddRow')?.addEventListener('click', () => {
            const name = prompt("Имя поля dBase (до 10 знаков ASCII):", "NEW_FIELD");
            if (name && name.trim()) {
                const clean = name.trim().toUpperCase().slice(0, 10);
                this.schema.fields.push(new FieldRule(clean, "C", 50, 0, false, clean));
                this._renderSchemaDesigner();
                this._showToast(`➕ Поле '${clean}' добавлено в спецификацию!`);
            }
        });

        document.getElementById('btnSchemaApplyToDoc')?.addEventListener('click', () => {
            this._saveSnapshot();
            this.mainGrid.initGrid(this.schema, this.records, this.issues);
            this._revalidateDocument();
            this._showToast("✅ Структура полей применена к активной накладной!");
        });

        document.getElementById('btnDbfDoctorAutoFix')?.addEventListener('click', () => {
            const audit = DbfDoctorEngine.analyzeSchemaVsData(this.schema, this.records);
            let fixed = 0;
            audit.forEach(item => {
                if (item.status === 'OVERFLOW' || item.status === 'CRITICAL_TIGHT') {
                    const f = this.schema.fields.find(field => field.name === item.fieldName);
                    if (f) { f.length = item.recommendedLength; fixed++; }
                }
            });
            this._renderSchemaDesigner();
            this._showToast(`🚑 DBF Doctor: расширено ${fixed} переполненных полей!`);
        });

        document.getElementById('btnDbfDoctorCompact')?.addEventListener('click', () => {
            const audit = DbfDoctorEngine.analyzeSchemaVsData(this.schema, this.records);
            let comp = 0;
            audit.forEach(item => {
                if (item.status === 'WASTE' && item.type === 'C') {
                    const f = this.schema.fields.find(field => field.name === item.fieldName);
                    if (f) { f.length = item.recommendedLength; comp++; }
                }
            });
            this._renderSchemaDesigner();
            this._showToast(`✂️ DBF Doctor: сжато ${comp} полей (-50% размера)!`);
        });
    }

    _renderSchemaDesigner() {
        const tbody = document.getElementById('schemaDesignerTableBody');
        if (!tbody) return;

        const audit = DbfDoctorEngine.analyzeSchemaVsData(this.schema, this.records);
        const auditMap = new Map(audit.map(a => [a.fieldName, a]));

        tbody.innerHTML = this.schema.fields.map((f, idx) => {
            const a = auditMap.get(f.name) || { maxActualLength: 0, status: "OPTIMAL" };
            const isOverflow = a.status === 'OVERFLOW';
            const colorClass = isOverflow ? 'text-red-400 font-bold' : (a.status === 'WASTE' ? 'text-amber-400' : 'text-slate-300');
            const badge = isOverflow ? '🔴 OVERFLOW' : (a.status === 'WASTE' ? '🟡 WASTE' : '🟢 OPTIMAL');

            return `
                <tr class="hover:bg-slate-800/60 transition-colors">
                    <td class="p-2 font-bold ${colorClass} flex items-center gap-1.5">
                        <span>${f.name}</span>
                        <span class="text-[9px] px-1 py-0.2 rounded bg-slate-900 border border-slate-700 font-mono">${badge}</span>
                    </td>
                    <td class="p-2">
                        <select onchange="window.PharmaGate._updateFieldType(${idx}, this.value)" class="bg-[#030712] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white cursor-pointer">
                            <option value="C" ${f.type === 'C' ? 'selected' : ''}>Текст (C)</option>
                            <option value="N" ${f.type === 'N' ? 'selected' : ''}>Число (N)</option>
                            <option value="D" ${f.type === 'D' ? 'selected' : ''}>Дата (D)</option>
                            <option value="L" ${f.type === 'L' ? 'selected' : ''}>Логический (L)</option>
                        </select>
                    </td>
                    <td class="p-2">
                        <input type="number" min="1" max="254" value="${f.length}" onchange="window.PharmaGate._updateFieldLen(${idx}, this.value)" class="w-16 bg-[#030712] border border-slate-700 rounded px-1 text-right text-xs text-white font-mono">
                        <span class="text-[10px] text-slate-500 ml-1 font-mono">(${a.maxActualLength}б)</span>
                    </td>
                    <td class="p-2">
                        <input type="number" min="0" max="6" value="${f.decimal}" onchange="window.PharmaGate._updateFieldDec(${idx}, this.value)" class="w-12 bg-[#030712] border border-slate-700 rounded px-1 text-right text-xs text-white font-mono">
                    </td>
                    <td class="p-2 text-center">
                        <input type="checkbox" ${f.required ? 'checked' : ''} onchange="window.PharmaGate._updateFieldReq(${idx}, this.checked)" class="rounded text-blue-600 cursor-pointer">
                    </td>
                    <td class="p-2">
                        <input type="text" value="${f.userName || f.name}" onchange="window.PharmaGate._updateFieldUser(${idx}, this.value)" class="bg-[#030712] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 w-44">
                    </td>
                    <td class="p-2 text-center">
                        <button onclick="window.PharmaGate._deleteField(${idx})" class="text-red-400 hover:text-red-300 font-bold text-xs p-1 rounded hover:bg-red-950/40 cursor-pointer">✕</button>
                    </td>
                </tr>
            `;
        }).join('');

        const impact = DbfDoctorEngine.calculateSizeImpact(this.schema, {}, this.records.length);
        const calcEl = document.getElementById('dbfDoctorSizeCalc');
        if (calcEl) calcEl.innerText = `Размер: ~${impact.newKb} КБ (Полей: ${this.schema.fields.length})`;
    }

    _updateFieldType(idx, val) { this.schema.fields[idx].type = val; this._renderSchemaDesigner(); }
    _updateFieldLen(idx, val) { this.schema.fields[idx].length = parseInt(val, 10) || 1; this._renderSchemaDesigner(); }
    _updateFieldDec(idx, val) { this.schema.fields[idx].decimal = parseInt(val, 10) || 0; this._renderSchemaDesigner(); }
    _updateFieldReq(idx, val) { this.schema.fields[idx].required = val; }
    _updateFieldUser(idx, val) { this.schema.fields[idx].userName = val; }
    _deleteField(idx) {
        if (this.schema.fields.length <= 1) return this._showToast("⚠️ Схема обязана содержать хотя бы одно поле!");
        this.schema.fields.splice(idx, 1);
        this._renderSchemaDesigner();
    }

    // =========================================================================
    // 6. ОКНО 3: СУБД MINI-ERP (SQLITE WASM EXPLORER)
    // =========================================================================

    async _initErpDatabase() {
        try {
            await SQLiteWasmService.initDatabase();
        } catch (err) {
            console.warn("[SQLite ERP] Ошибка инициализации базы:", err);
        }

        document.getElementById('erpSearchInput')?.addEventListener('input', (e) => this._refreshErpTable(e.target.value));

        document.getElementById('btnSyncDbWithInvoice')?.addEventListener('click', () => {
            if (!this.records || this.records.length === 0) return this._showToast("⚠️ Накладная пуста: откройте файл перед синхронизацией!");
            const count = SQLiteWasmService.bulkInsertProducts(this.records);
            this._refreshErpTable();
            this._showToast(`✅ СУБД Mini-ERP пополнена на ${count} номенклатурных позиций!`);
        });

        document.getElementById('btnExportDbExcel')?.addEventListener('click', () => {
            const { records } = SQLiteWasmService.searchProductsPaginated("", 5000);
            if (!records || records.length === 0) return this._showToast("⚠️ Справочник номенклатуры пуст!");
            const ws = window.XLSX.utils.json_to_sheet(records);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Номенклатура");
            window.XLSX.writeFile(wb, "MiniERP_Номенклатура.xlsx");
            this._showToast("📄 Справочник номенклатуры экспортирован в Excel!");
        });
    }

    _initErpTableIfNeeded() {
        if (this.erpGrid || !document.getElementById('erpGridContainer')) return;
        const cols = [
            { title: "Артикул", field: "codepst", width: 110, hozAlign: "center" },
            { title: "Наименование препарата", field: "name", width: 280 },
            { title: "Штрихкод EAN-13", field: "ean13", width: 130, hozAlign: "center" },
            { title: "GTIN-14", field: "gtin", width: 140, hozAlign: "center" },
            { title: "Производитель", field: "firm", width: 180 },
            { title: "Страна", field: "cntr", width: 110, hozAlign: "center" },
            { title: "НДС %", field: "nds", width: 80, hozAlign: "right" },
            { title: "Реестр ЖНВЛП", field: "regprc", width: 120, hozAlign: "right", formatter: (c) => parseFloat(c.getValue() || 0).toFixed(2) }
        ];
        try {
            this.erpGrid = new window.Tabulator("#erpGridContainer", {
                data: [],
                columns: cols,
                layout: "fitDataFill",
                height: "100%",
                placeholder: "<div class='text-slate-400 py-8 text-center text-xs'>Справочник пуст. Нажмите «Синхронизировать с накладной».</div>"
            });
        } catch (e) {
            console.warn("[ERP Grid] Init error:", e);
        }
    }

    _refreshErpTable(query = "") {
        if (!SQLiteWasmService.db) return;
        this._initErpTableIfNeeded();
        if (!this.erpGrid) return;
        const { records, totalCount } = SQLiteWasmService.searchProductsPaginated(query, 250);

        const badge = document.getElementById('erpRecordsCountBadge');
        if (badge) badge.innerText = `${totalCount} записей`;

        try {
            this.erpGrid.setData(records);
        } catch (e) {
            console.warn("[ERP Grid] setData error:", e);
        }
    }

    // =========================================================================
    // 7. ОКНО 4: СВЕРКА ЗАКАЗА (RECONCILER STUDIO)
    // =========================================================================

    _bindReconciliation() {
        const input = document.getElementById('orderFileInput');
        document.getElementById('btnLoadOrderFile')?.addEventListener('click', () => input?.click());
        input?.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                const rep = await UniversalImporter.importFile(file, file.name);
                this.orderRecords = rep.mappedRecords;
                this._runReconciliation();
                input.value = '';
            }
        });

        document.getElementById('btnSaveOtkazDbf')?.addEventListener('click', () => {
            if (this.currentReconciliation?.otkazRecords?.length > 0) {
                const buf = ReconcilerService.saveOtkazDBF(this.currentReconciliation.otkazRecords);
                WebDBFEngine.downloadAsFile(buf, "otkaz.dbf");
                this._showToast("💾 Файл дефектуры otkaz.dbf успешно скачан!");
            }
        });

        document.getElementById('btnSaveReconcileActExcel')?.addEventListener('click', () => {
            if (this.currentReconciliation?.discrepancies?.length > 0) {
                const wsData = [
                    ["АКТ РАСХОЖДЕНИЙ И ДЕФЕКТУРНАЯ ВЕДОМОСТЬ"],
                    [`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`],
                    [`Процент исполнения заказа: ${this.currentReconciliation.fulfillmentRatePercent}%`],
                    [],
                    ["№", "Статус", "Артикул", "Наименование", "Описание инцидента"]
                ];

                this.currentReconciliation.discrepancies.forEach((d, idx) => {
                    wsData.push([idx + 1, d.severity, d.code, d.name, d.message]);
                });

                const ws = window.XLSX.utils.aoa_to_sheet(wsData);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, "Акт расхождений");
                window.XLSX.writeFile(wb, "Акт_расхождений_поставки.xlsx");
                this._showToast("📄 Акт расхождений сохранен в Excel!");
            }
        });
    }

    _runReconciliation() {
        if (!this.orderRecords || this.orderRecords.length === 0) return this._showToast("⚠️ Загрузите файл заказа!");

        const rep = ReconcilerService.reconcile(this.orderRecords, this.records);
        this.currentReconciliation = rep;

        document.getElementById('recFulfillmentRate').innerText = `${rep.fulfillmentRatePercent}%`;
        document.getElementById('recTotalOrderSum').innerText = `${rep.totalOrderedSum.toFixed(2)} ₽`;
        document.getElementById('recTotalDeliveredSum').innerText = `${rep.totalDeliveredSum.toFixed(2)} ₽`;
        document.getElementById('recTotalRefusedSum').innerText = `${rep.totalRefusedSum.toFixed(2)} ₽`;

        const btnOtkaz = document.getElementById('btnSaveOtkazDbf');
        const btnAct = document.getElementById('btnSaveReconcileActExcel');

        if (btnOtkaz) btnOtkaz.disabled = rep.otkazRecords.length === 0;
        if (btnAct) btnAct.disabled = rep.discrepancies.length === 0;

        const cols = [
            { title: "Статус", field: "severity", width: 110, formatter: (c) => c.getValue() === 'CRITICAL' ? '<span class="text-red-400 font-bold">🔴 КРИТИЧНО</span>' : '<span class="text-amber-400 font-bold">🟡 ВНИМАНИЕ</span>' },
            { title: "Артикул", field: "code", width: 110, hozAlign: "center" },
            { title: "Наименование", field: "name", width: 220 },
            { title: "Описание расхождения", field: "message", width: 450 }
        ];

        if (!this.reconcilerGrid) {
            this.reconcilerGrid = new window.Tabulator("#reconcilerGridContainer", { data: rep.discrepancies, columns: cols, layout: "fitDataFill", height: "100%" });
        } else {
            this.reconcilerGrid.setColumns(cols);
            this.reconcilerGrid.setData(rep.discrepancies);
        }

        if (rep.otkazRecords.length > 0) {
            SQLiteWasmService.logDefectura(rep.otkazRecords, this.records[0]?.NDOC || "1");
        }

        this._showToast(`⚖️ Сверка завершена: ${rep.fulfillmentRatePercent}% исполнение, ${rep.discrepancies.length} расхождений`);
    }

    // =========================================================================
    // 8. ОКНО 5: ИНТЕРАКТИВНАЯ БАЗА ЗНАНИЙ (25+ СТАТЕЙ С 1-CLICK FIX)
    // =========================================================================

    _bindKnowledgeBase() {
        this._renderKbCategoryChips();
        this._renderKbCards();

        document.getElementById('kbSearchInput')?.addEventListener('input', (e) => {
            this._renderKbCards(e.target.value);
        });
    }

    _renderKbCategoryChips() {
        const container = document.querySelector('.kb-category-chips');
        if (!container) return;

        container.innerHTML = this.kbCategories.map(cat => `
            <button onclick="window.PharmaGate._setKbCategory('${cat}')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border ${this.activeKbCategory === cat ? 'bg-blue-600 text-white border-blue-500 shadow-sm' : 'bg-[#030712] text-slate-400 border-slate-800 hover:text-white'}">
                ${cat}
            </button>
        `).join('');
    }

    _setKbCategory(cat) {
        this.activeKbCategory = cat;
        this._renderKbCategoryChips();
        this._renderKbCards(document.getElementById('kbSearchInput')?.value || '');
    }

    _renderKbCards(query = "") {
        const container = document.getElementById('kbCardsGrid');
        if (!container || !this.kbArticles) return;

        const q = query.trim().toLowerCase();
        const filtered = this.kbArticles.filter(a => {
            const matchCat = (this.activeKbCategory === "Все категории") || (a.category === this.activeKbCategory);
            if (!matchCat) return false;
            if (!q) return true;
            return `${a.code} ${a.title} ${a.symptoms} ${a.cause} ${a.solution} ${a.legal} ${(a.tags || []).join(' ')}`.toLowerCase().includes(q);
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="col-span-2 p-8 text-center bg-[#090d16] rounded-xl border border-slate-800 text-slate-400">
                    <div class="text-2xl mb-2">🔍</div>
                    <div class="font-bold text-sm text-slate-300">Ничего не найдено по запросу "${query}"</div>
                    <div class="text-xs text-slate-500 mt-1">Попробуйте ключевые слова: subjid, гтд, 1990, катрен, ндс.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map((art, idx) => `
            <div class="p-3.5 rounded-xl bg-[#090d16] border border-slate-800 space-y-2.5 flex flex-col justify-between shadow-lg hover:border-slate-700 transition-colors">
                <div>
                    <div class="flex justify-between text-[10px] font-mono">
                        <span class="px-1.5 py-0.5 rounded font-bold border ${art.severity === 'CRITICAL' ? 'bg-red-950 text-red-300 border-red-800' : 'bg-amber-950 text-amber-300 border-amber-800'}">${art.code}</span>
                        <span class="text-slate-400">${(art.networks || []).join(', ')}</span>
                    </div>
                    <h4 class="text-xs font-bold text-white mt-1.5">${art.title}</h4>
                    <div class="space-y-1 text-[11px] mt-1.5">
                        <div class="p-1.5 rounded bg-red-950/20 text-red-300 border border-red-900/40"><b>Симптом:</b> ${art.symptoms}</div>
                        <div class="p-1.5 rounded bg-slate-900 text-slate-300"><b>Причина:</b> ${art.cause}</div>
                        <div class="p-1.5 rounded bg-emerald-950/20 text-emerald-300 border border-emerald-900/40"><b>Решение:</b> ${art.solution}</div>
                    </div>
                    <div class="text-[10px] text-slate-400 mt-2">⚖️ <b>НПА:</b> ${art.legal}</div>
                </div>
                <div class="pt-2 border-t border-slate-800 flex justify-end">
                    <button onclick="window.PharmaGate._executeKbAction('${art.fixActionType}', '${art.title}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer">
                        🚀 1-Click Fix
                    </button>
                </div>
            </div>
        `).join('');
    }

    _executeKbAction(actionType, title) {
        if (!this.records || this.records.length === 0) return this._showToast("⚠️ Накладная пуста!");

        this._saveSnapshot();
        let fixed = 0;

        if (actionType === 'CLEAR_SUBJID') {
            this.records.forEach(r => { if (String(r.SUBJID || '').includes('00000000')) { r.SUBJID = ""; fixed++; } });
        } else if (actionType === 'RECALC_MATH') {
            this.records.forEach(r => {
                const q = PharmaMath.cleanDecimal(r.QNT, 1.0);
                const p2 = PharmaMath.cleanDecimal(r.PRICE2, 0.0);
                if (q > 0 && p2 > 0) { r.SUMSTR = PharmaMath.roundMoney(q * p2); fixed++; }
            });
        } else if (actionType === 'RECLASSIFY_GTD') {
            this.records.forEach(r => {
                if (PharmaVocabulary.normalizeCountry(r.CNTR) === 'Россия' && /рзн|ру|фср/i.test(r.NUMGTD)) {
                    r.SERTIF = r.NUMGTD; r.NUMGTD = 'б/гтд'; fixed++;
                }
            });
        } else if (actionType === 'PAD_ZEROS') {
            this.records.forEach(r => {
                const code = String(r.CODEPST || '').trim();
                if (/^\d+$/.test(code) && code.length < 6) { r.CODEPST = code.padStart(6, '0'); fixed++; }
            });
        } else if (actionType === 'ZERO_VAT') {
            this.records.forEach(r => {
                const p2 = PharmaMath.cleanDecimal(r.PRICE2, 0.0);
                const p2n = PharmaMath.cleanDecimal(r.PRICE2N, 0.0);
                if (p2 > 0 && Math.abs(p2 - p2n) < 0.01) {
                    r.NDS = 0; r.PRICE2N = p2; r.SUMSNDS = 0.0; fixed++;
                }
            });
        } else if (actionType === 'DUMMY_DATES') {
            this.records.forEach(r => {
                ['GDATE', 'DATEMADE', 'BILLDT', 'DATEZ'].forEach(dKey => {
                    if (r[dKey] && (String(r[dKey]).startsWith('1990') || String(r[dKey]).startsWith('1900'))) {
                        r[dKey] = null; fixed++;
                    }
                });
            });
        } else if (actionType === 'KATREN_TRIAD') {
            this.records.forEach(r => {
                if (!r.SER || /^(000000|тест|null)$/i.test(r.SER)) { r.SER = "б/с"; fixed++; }
                const p2 = PharmaMath.cleanDecimal(r.PRICE2, 0.0);
                const p1 = PharmaMath.cleanDecimal(r.PRICE1, 0.0);
                if (p1 <= 0 && p2 > 0) { r.PRICE1 = PharmaMath.roundMoney(p2 / 1.10); fixed++; }
            });
        } else if (actionType === 'SANITIZE_TYPO') {
            this.records.forEach(r => {
                if (r.NAME) { r.NAME = EncodingGuard.sanitizeText366(r.NAME); fixed++; }
            });
        }

        this.mainGrid.updateData(this.records, this.schema);
        this._revalidateDocument();
        this._showToast(`🚀 1-Click Fix применен: исправлено ${fixed} записей!`);
    }

    // =========================================================================
    // 9. ОКНО 6: МАСТЕР СОЗДАНИЯ 2.0 (2D DATA MATRIX)
    // =========================================================================

    _bindCreateWizard() {
        document.getElementById('wizardScannerInput')?.addEventListener('input', (e) => {
            const parsed = DataMatrixParser.parse(e.target.value);
            if (parsed.isValid) {
                if (parsed.gtin) document.getElementById('wzEan13').value = parsed.gtin.slice(-13);
                if (parsed.batchLot) document.getElementById('wzSer').value = parsed.batchLot;
                if (parsed.expDate) document.getElementById('wzGdate').value = parsed.expDate;
                this._showToast("📟 Код DataMatrix успешно распознан сканером!");
            }
        });

        document.getElementById('btnWizardAddRow')?.addEventListener('click', () => {
            const name = document.getElementById('wzName')?.value || "Новый препарат";
            const ean = document.getElementById('wzEan13')?.value || "4607003560014";
            const code = document.getElementById('wzCodepst')?.value || String(this.records.length + 1).padStart(6, '0');
            const ser = document.getElementById('wzSer')?.value || "б/с";
            const gdate = document.getElementById('wzGdate')?.value || DateEngine.calculateExpiryDate(new Date(), 24);
            const qnt = parseFloat(document.getElementById('wzQnt')?.value) || 1.0;
            const p2 = parseFloat(document.getElementById('wzPrice2')?.value) || 100.0;
            const fin = PharmaMath.calculateLine(qnt, p2, 10);
            const todayIso = new Date().toISOString().split('T')[0];

            this._saveSnapshot();
            this.records.push({
                NDOC: this.records[0]?.NDOC || "1",
                DATEDOC: this.records[0]?.DATEDOC || todayIso,
                CODEPST: code,
                EAN13: ean,
                NAME: name,
                SER: ser,
                GDATE: gdate,
                DATEMADE: todayIso,
                QNT: qnt,
                PRICE1: fin.price2n,
                PRICE2: p2,
                PRICE2N: fin.price2n,
                NDS: 10,
                SUMSTR: fin.sumstr,
                SUMSNDS: fin.sumsnds,
                CNTR: "Россия",
                FIRM: "-",
                REGPRC: 0.00,
                NUMGTD: "б/гтд",
                PODRCD: "001"
            });

            this.mainGrid.updateData(this.records, this.schema, []);
            this._revalidateDocument();
            this.closeApp('winWizard');
            this._showToast(`➕ Позиция '${name}' добавлена в накладную!`);
        });
    }

    // =========================================================================
    // 10. ОКНО 7: ИНСПЕКТОР ПРАВОК (ACTION INSPECTOR DIFF STUDIO)
    // =========================================================================

    _bindActionInspector() {
        document.getElementById('btnInspectorApplyChecked')?.addEventListener('click', () => {
            const actions = ActionInspectorEngine.generateActionPlan(this.schema, this.records, this.activeProfileKey);
            const selectedIds = new Set(actions.map(a => a.actionId));
            const { repairedRecords, appliedCount } = ActionInspectorEngine.applySelectedActions(this.schema, this.records, selectedIds, this.activeProfileKey);

            this._saveSnapshot();
            this.records = repairedRecords;
            this.mainGrid.updateData(this.records, this.schema, []);
            this._revalidateDocument();
            this.closeApp('winInspector');
            this._showToast(`🛠️ Инспектор применил ${appliedCount} правок с живым аудитом!`);
        });
    }

    _renderActionInspector() {
        const actions = ActionInspectorEngine.generateActionPlan(this.schema, this.records, this.activeProfileKey);
        const list = document.getElementById('inspectorActionsList');
        const diffBody = document.getElementById('inspectorDiffTableBody');

        if (list) {
            list.innerHTML = actions.map(act => `
                <div class="p-2 rounded bg-[#030712] border border-slate-800 text-[11px]">
                    <div class="font-bold text-slate-200 flex justify-between">
                        <span>${act.title}</span>
                        <span class="text-[9px] px-1 rounded bg-blue-950 text-blue-300 font-mono">${act.affectedRowsCount} стр.</span>
                    </div>
                </div>
            `).join('') || '<div class="text-slate-500 italic">Замечаний не обнаружено.</div>';
        }

        if (diffBody) {
            const allDiffs = actions.flatMap(a => a.diffSamples);
            diffBody.innerHTML = allDiffs.map(d => `
                <tr class="hover:bg-slate-800/40">
                    <td class="p-2 font-bold">${d.rowIndex}</td>
                    <td class="p-2 text-blue-400 font-bold">${d.fieldName}</td>
                    <td class="p-2 text-red-400 bg-red-950/20">${d.oldValue}</td>
                    <td class="p-2 text-emerald-400 bg-emerald-950/20 font-bold">${d.newValue}</td>
                    <td class="p-2 text-slate-400 font-sans">${d.description}</td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="p-4 text-center text-slate-500">Нет изменений.</td></tr>';
        }
    }

    // =========================================================================
    // 11. ОКНО 8: ЦЕНТР НАСТРОЕК
    // =========================================================================

    _bindSettingsCenter() {
        // Навигация по вкладкам Центра Настроек
        const tabBtns = document.querySelectorAll('.settings-tab-btn');
        const panels = document.querySelectorAll('.settings-panel');

        const switchTab = (tabId) => {
            tabBtns.forEach(btn => {
                const isCurrent = btn.getAttribute('data-tab') === tabId;
                if (isCurrent) {
                    btn.className = 'settings-tab-btn w-full px-3 py-2 rounded-xl text-left font-semibold text-xs flex items-center gap-2.5 transition-all bg-blue-600 text-white shadow-md shadow-blue-600/30';
                } else {
                    btn.className = 'settings-tab-btn w-full px-3 py-2 rounded-xl text-left font-semibold text-xs flex items-center gap-2.5 transition-all text-slate-300 hover:text-white hover:bg-slate-800/60';
                }
            });

            panels.forEach(p => {
                p.classList.toggle('hidden', p.id !== tabId);
            });
            this.crossPlatform?.playSound('click');
        };

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                if (targetTab) switchTab(targetTab);
            });
        });

        // Глобальный метод открытия настроек на нужной вкладке
        this.openSettingsTab = (tabId) => {
            this.openApp('winSettings');
            switchTab(tabId);
        };

        // Хост индикатор
        const hostBadge = document.getElementById('detectedHostBadge');
        if (hostBadge && this.crossPlatform) {
            hostBadge.innerText = `Хост: ${this.crossPlatform.detectedHost.name}`;
        }

        // Селектор стиля ОС в настройках
        const selOs = document.getElementById('settingOsPersona');
        if (selOs && this.crossPlatform) {
            selOs.value = this.crossPlatform.currentPersona;
            selOs.addEventListener('change', (e) => {
                this.crossPlatform.setPersona(e.target.value);
            });
        }

        // Селектор окончаний строк в настройках
        const selLineEnding = document.getElementById('settingLineEnding');
        if (selLineEnding && this.crossPlatform) {
            selLineEnding.value = this.crossPlatform.lineEnding;
            selLineEnding.addEventListener('change', (e) => {
                this.crossPlatform.setLineEnding(e.target.value);
            });
        }

        // Селектор кодировки сохранения в настройках
        const selEncoding = document.getElementById('settingEncoding');
        if (selEncoding && this.crossPlatform) {
            selEncoding.value = this.crossPlatform.activeEncoding;
            selEncoding.addEventListener('change', (e) => {
                this.crossPlatform.setEncoding(e.target.value);
            });
        }

        // Звуковые эффекты и громкость
        const chkSound = document.getElementById('settingSoundFx');
        if (chkSound && this.crossPlatform) {
            chkSound.checked = this.crossPlatform.soundEnabled;
            chkSound.addEventListener('change', (e) => {
                this.crossPlatform.setSoundEnabled(e.target.checked);
            });
        }

        const volRange = document.getElementById('settingVolumeRange');
        if (volRange && this.crossPlatform) {
            volRange.value = String(Math.round((this.crossPlatform.soundVolume || 0.8) * 100));
            volRange.addEventListener('input', (e) => {
                const v = parseInt(e.target.value, 10) / 100;
                this.crossPlatform.soundVolume = v;
                localStorage.setItem('pharmagate_sound_volume', String(v));
            });
        }

        document.getElementById('btnTestSound')?.addEventListener('click', () => {
            this.crossPlatform?.playSound('success');
        });

        // Масштабирование в настройках
        document.getElementById('btnSettingZoomMinus')?.addEventListener('click', () => {
            if (!this.crossPlatform) return;
            this.crossPlatform.setZoom(this.crossPlatform.zoomFactor - 0.1);
            const disp = document.getElementById('settingZoomDisplay');
            if (disp) disp.innerText = `${Math.round(this.crossPlatform.zoomFactor * 100)}%`;
        });
        document.getElementById('btnSettingZoomPlus')?.addEventListener('click', () => {
            if (!this.crossPlatform) return;
            this.crossPlatform.setZoom(this.crossPlatform.zoomFactor + 0.1);
            const disp = document.getElementById('settingZoomDisplay');
            if (disp) disp.innerText = `${Math.round(this.crossPlatform.zoomFactor * 100)}%`;
        });
        document.getElementById('btnSettingZoomReset')?.addEventListener('click', () => {
            if (!this.crossPlatform) return;
            this.crossPlatform.setZoom(1.0);
            const disp = document.getElementById('settingZoomDisplay');
            if (disp) disp.innerText = '100%';
        });

        // Кнопка генерации демо-накладной в настройках
        document.getElementById('btnSettingDemo50')?.addEventListener('click', () => {
            this.crossPlatform?.generateDemoPharmaInvoice(50);
            this.openApp('winEditor');
        });

        // Резервное копирование и сброс кэша
        document.getElementById('btnExportFullBackup')?.addEventListener('click', () => {
            this.crossPlatform?.exportFullSessionBackup();
        });

        document.getElementById('btnClearAppCache')?.addEventListener('click', () => {
            this.crossPlatform?.clearAppCache();
        });

        // Сохранение и загрузка настроек алгоритмов ФЛК
        const flkCheckboxes = [
            'chkAutoMath', 'chkZeroVat', 'chkPadZeros', 'chkGtdRu',
            'chkEan13', 'chkExpDate', 'chkCryptoDataMatrix'
        ];
        const savedRules = JSON.parse(localStorage.getItem('pharmagate_flk_rules') || '{}');
        flkCheckboxes.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (savedRules[id] !== undefined) el.checked = savedRules[id];
            el.addEventListener('change', () => {
                savedRules[id] = el.checked;
                localStorage.setItem('pharmagate_flk_rules', JSON.stringify(savedRules));
                this._revalidateDocument();
                this.crossPlatform?.playSound('click');
            });
        });

        // Счетчик Undo/Redo
        this._updateUndoCounter = () => {
            const countEl = document.getElementById('storageUndoCount');
            if (countEl) {
                countEl.innerText = `${this.undoStack.length} / ${this.maxStackDepth}`;
            }
        };
        this._updateUndoCounter();

        // Кнопка Spotlight в таскбаре
        document.getElementById('btnOpenSpotlight')?.addEventListener('click', () => {
            this.crossPlatform?.openCommandPalette();
        });

        // Клик по бейджу ОС в таскбаре: циклическое переключение ОС
        document.getElementById('hudOsBadge')?.addEventListener('click', () => {
            if (!this.crossPlatform) return;
            const cycle = { 'windows': 'macos', 'macos': 'linux', 'linux': 'windows' };
            const next = cycle[this.crossPlatform.currentPersona] || 'macos';
            this.crossPlatform.setPersona(next);
            if (selOs) selOs.value = next;
        });

        // Клик по бейджу CRLF/LF: переключение окончаний строк
        document.getElementById('hudLineEndingBadge')?.addEventListener('click', () => {
            if (!this.crossPlatform) return;
            const next = this.crossPlatform.lineEnding === 'crlf' ? 'lf' : 'crlf';
            this.crossPlatform.setLineEnding(next);
            if (selLineEnding) selLineEnding.value = next;
        });

        // Клик по бейджу кодировки: переключение CP866 / CP1251
        document.getElementById('hudEncBadge')?.addEventListener('click', () => {
            if (!this.crossPlatform) return;
            const next = this.crossPlatform.activeEncoding === 'cp866' ? 'windows-1251' : 'cp866';
            this.crossPlatform.setEncoding(next);
            if (selEncoding) selEncoding.value = next;
        });

        // Зум кнопки в таскбаре
        document.getElementById('btnZoomMinus')?.addEventListener('click', () => {
            this.crossPlatform?.setZoom(this.crossPlatform.zoomFactor - 0.1);
        });
        document.getElementById('btnZoomPlus')?.addEventListener('click', () => {
            this.crossPlatform?.setZoom(this.crossPlatform.zoomFactor + 0.1);
        });
        document.getElementById('btnToggleFullscreen')?.addEventListener('click', () => {
            this.crossPlatform?.toggleFullscreen();
        });

        // Звук кнопка в таскбаре
        document.getElementById('btnToggleSound')?.addEventListener('click', () => {
            if (!this.crossPlatform) return;
            const next = !this.crossPlatform.soundEnabled;
            this.crossPlatform.setSoundEnabled(next);
            if (chkSound) chkSound.checked = next;
        });
    }

    // =========================================================================
    // 12. ВАЛИДАЦИЯ ФЛК, HUD И МАШИНА ВРЕМЕНИ
    // =========================================================================

    _revalidateDocument() {
        const flk = FLKEngine.validateDocument(this.schema, this.records, this.activeProfileKey);
        const fraud = CommercialGuard.inspect(this.records);
        this.issues = [...flk, ...fraud];
        this.mainGrid.updateIssues(this.issues);

        const readiness = FLKEngine.calculateReadinessScore(this.issues, this.records.length);

        let totalSum = 0.0;
        this.records.forEach(r => { totalSum += PharmaMath.cleanDecimal(r.SUMSTR, 0.0); });

        document.getElementById('hudTotalSum').innerText = `${totalSum.toFixed(2)} ₽`;
        document.getElementById('hudItemsCount').innerText = `${this.records.length}`;

        const badge = document.getElementById('hudReadinessBadge');
        if (badge) {
            badge.innerText = `${readiness.score}% ${readiness.statusText}`;
            badge.className = readiness.score >= 90 ? 'text-emerald-400 font-bold' : (readiness.score >= 50 ? 'text-amber-400 font-bold' : 'text-red-400 font-bold');
        }

        const bar = document.getElementById('readinessProgressBar');
        if (bar) bar.style.width = `${readiness.score}%`;
        const pct = document.getElementById('readinessProgressPercent');
        if (pct) pct.innerText = `${readiness.score}%`;

        const list = document.getElementById('issuesListContainer');
        if (list) {
            list.innerHTML = this.issues.map(i => `
                <div class="p-1.5 rounded border text-[10px] ${i.severity === 'CRITICAL' ? 'bg-red-950/40 border-red-900 text-red-300' : 'bg-amber-950/40 border-amber-900 text-amber-300'}">
                    <b>${i.severity === 'CRITICAL' ? '🔴' : '🟡'} Стр. ${i.rowIndex || 'Шапка'} [${i.field}]:</b> ${i.userText}
                </div>
            `).join('');
        }
    }

    async loadFile(file) {
        try {
            const report = await UniversalImporter.importFile(file, file.name, this.schema);
            this._saveSnapshot();
            
            this.records = report.mappedRecords;
            this.metaHeader = report.metaHeader || {};
            this.activeFileName = file.name;

            const detected = ProfileManager.detectBestProfile(report.canonicalHeaders, this.records, this.metaHeader);
            if (detected) {
                this.activeProfileKey = detected;
                const sel = document.getElementById('profileSelect');
                if (sel) sel.value = detected;
            }

            this.mainGrid.updateData(this.records, this.schema, []);
            this._revalidateDocument();

            const badge = document.getElementById('winEditorFileBadge');
            if (badge) badge.innerText = file.name;

            this._showToast(`✅ Документ '${file.name}' (${this.records.length} строк) успешно загружен!`);
        } catch (e) {
            console.error(e);
            this._showToast(`❌ Ошибка чтения файла: ${e.message}`);
        }
    }

    _updateSelectionStatus(selectedRows) {
        const count = selectedRows.length;
        if (count > 0) {
            const badge = document.getElementById('winEditorFileBadge');
            if (badge) badge.innerText = `Выделено: ${count} из ${this.records.length}`;
        }
    }

    _saveSnapshot(clearRedo = true) {
        this.undoStack.push(JSON.stringify(this.records));
        if (this.undoStack.length > this.maxStackDepth) this.undoStack.shift();
        if (clearRedo) this.redoStack = [];
        this._updateUndoCounter?.();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        this.redoStack.push(JSON.stringify(this.records));
        this.records = JSON.parse(this.undoStack.pop());
        this.mainGrid.updateData(this.records, this.schema, []);
        this._revalidateDocument();
        this._updateUndoCounter?.();
        this._showToast("⏪ Отмена действия (Undo)");
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.undoStack.push(JSON.stringify(this.records));
        this.records = JSON.parse(this.redoStack.pop());
        this.mainGrid.updateData(this.records, this.schema, []);
        this._revalidateDocument();
        this._updateUndoCounter?.();
        this._showToast("⏩ Повтор действия (Redo)");
    }

    saveDocumentFile() {
        const prof = ProfileManager.getProfile(this.activeProfileKey);
        const encoding = this.crossPlatform?.activeEncoding || prof.targetEncoding || 'cp866';
        const fields = this.schema.fields.map(f => new DBFFieldDescriptor(f.name, f.type, f.length, f.decimal));
        const buf = WebDBFEngine.writeDBF(fields, this.records, encoding);
        const blob = new Blob([buf], { type: 'application/x-dbf' });

        if (this.crossPlatform) {
            this.crossPlatform.saveNativeFileDialog(this.activeFileName, blob);
        } else {
            WebDBFEngine.downloadAsFile(buf, this.activeFileName);
        }
        this._showToast(`💾 Файл DBF '${this.activeFileName}' сохранен (${encoding.toUpperCase()})!`);
    }

    downloadDbf() {
        this.saveDocumentFile();
    }

    _bindKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;

            // ⌘K / Ctrl+K - Открытие Command Palette / Spotlight
            if (isCtrl && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.crossPlatform?.openCommandPalette();
            }
            // ⌘O / Ctrl+O - Открытие файла
            else if (isCtrl && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                if (this.crossPlatform) {
                    this.crossPlatform.openNativeFileDialog();
                } else {
                    document.getElementById('fileInput')?.click();
                }
            }
            // ⌘S / Ctrl+S - Сохранение файла
            else if (isCtrl && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.saveDocumentFile();
            }
            // ⌘F / Ctrl+F - Быстрый поиск в накладной
            else if (isCtrl && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                const search = document.getElementById('gridSearchInput');
                if (search) {
                    this.openApp('winEditor');
                    search.focus();
                    search.select();
                }
            }
            // ⌘W / Ctrl+W - Закрытие активного окна WebOS (вместо закрытия вкладки браузера)
            else if (isCtrl && e.key.toLowerCase() === 'w') {
                e.preventDefault();
                const activeWin = document.querySelector('.os-window.active-window:not(.minimized)');
                if (activeWin) {
                    this.closeApp(activeWin.id);
                }
            }
            // ⌘M / Ctrl+M - Свернуть активное окно
            else if (isCtrl && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                const activeWin = document.querySelector('.os-window.active-window:not(.minimized)');
                if (activeWin) {
                    this.minimizeApp(activeWin.id);
                }
            }
            // ⌘N / Ctrl+N - Создать накладную (Мастер)
            else if (isCtrl && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                this.openApp('winWizard');
            }
            // F5 - Супер авто-ремонт ФЛК
            else if (e.key === 'F5') {
                e.preventDefault();
                document.getElementById('btnAutoRepair')?.click();
            }
            // F1 - Справка / База знаний
            else if (e.key === 'F1') {
                e.preventDefault();
                this.openApp('winKb');
            }
            // F11 - Полноэкранный режим
            else if (e.key === 'F11') {
                e.preventDefault();
                this.crossPlatform?.toggleFullscreen();
            }
            // Esc - Закрытие палитры команд / меню Пуск
            else if (e.key === 'Escape') {
                const palette = document.getElementById('commandPaletteModal');
                if (palette && !palette.classList.contains('hidden')) {
                    this.crossPlatform?.closeCommandPalette();
                } else {
                    const startMenu = document.getElementById('startMenu');
                    if (startMenu && startMenu.style.display === 'flex') {
                        this.toggleStartMenu();
                    }
                }
            }
            // ⌘Z - Отмена (Undo)
            else if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.undo();
            }
            // ⌘⇧Z / Ctrl+Y - Повтор (Redo)
            else if ((isCtrl && e.key.toLowerCase() === 'y') || (isCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                this.redo();
            }
        });
    }

    _bindDragAndDrop() {
        const overlay = document.getElementById('dragDropOverlay');
        let dragCounter = 0;

        const preventAll = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // Захват всех фаз drag-and-drop в capture phase для предотвращения навигации браузера на file:///
        const events = ['dragenter', 'dragover', 'dragleave', 'drop'];
        events.forEach(eventName => {
            window.addEventListener(eventName, preventAll, { capture: true, passive: false });
            document.addEventListener(eventName, preventAll, { capture: true, passive: false });
        });

        const showOverlay = () => {
            if (overlay) {
                overlay.classList.remove('opacity-0', 'pointer-events-none');
                overlay.classList.add('opacity-100', 'pointer-events-auto');
            }
        };

        const hideOverlay = () => {
            if (overlay) {
                overlay.classList.remove('opacity-100', 'pointer-events-auto');
                overlay.classList.add('opacity-0', 'pointer-events-none');
            }
        };

        window.addEventListener('dragenter', (e) => {
            preventAll(e);
            dragCounter++;
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
                showOverlay();
            }
        }, { capture: true, passive: false });

        window.addEventListener('dragover', (e) => {
            preventAll(e);
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        }, { capture: true, passive: false });

        window.addEventListener('dragleave', (e) => {
            preventAll(e);
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                hideOverlay();
            }
        }, { capture: true, passive: false });

        window.addEventListener('drop', async (e) => {
            preventAll(e);
            dragCounter = 0;
            hideOverlay();

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                const activeWin = document.querySelector('.os-window.active-window');
                if (activeWin && activeWin.id === 'winReconcile' && /заказ|order/i.test(file.name)) {
                    try {
                        const rep = await UniversalImporter.importFile(file, file.name);
                        this.orderRecords = rep.mappedRecords;
                        this._runReconciliation();
                        this._showToast(`⚖️ Файл заказа '${file.name}' обработан!`);
                    } catch (err) {
                        this._showToast(`❌ Ошибка загрузки заказа: ${err.message}`);
                    }
                } else {
                    this.openApp('winEditor');
                    await this.loadFile(file);
                }
            }
        }, { capture: true, passive: false });
    }

    _startSessionAutoSaver() {
        setInterval(async () => {
            if (this.records && this.records.length > 0) {
                await SessionCacheManager.saveSessionSnapshot(this.activeFileName, this.metaHeader, this.records);
            }
        }, 60000);
    }

    _showToast(msg) {
        const t = document.createElement("div");
        t.className = "fixed bottom-16 right-8 z-50 bg-[#0e1422] text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2";
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.3s"; setTimeout(() => t.remove(), 300); }, 2500);
    }

    _loadDemoData() {
        this.records = [
            {
                NDOC: "407",
                DATEDOC: "2026-08-23",
                CODEPST: "000006",
                EAN13: "4657786240081",
                PRICE1: 15000.00,
                PRICE2: 17000.00,
                PRICE2N: 17000.00,
                QNT: 2.0,
                SER: "Е621125",
                GDATE: "2028-05-31",
                DATEMADE: "2026-05-01",
                NAME: "АртроМовиа суприм р-р 2,2% 2,2мл шприц №1",
                CNTR: "Россия",
                FIRM: "ООО АтрианМГ",
                NDS: 0,
                REGPRC: 17000.00,
                NUMGTD: "б/гтд",
                SERTIF: "РЗН 2024/1145",
                SUMSTR: 34000.00,
                SUMSNDS: 0.00,
                PODRCD: "771069",
                BILLNUM: "407",
                BILLDT: "2026-08-23",
                NUMZ: 407,
                DATEZ: "2026-08-23",
                MARK: 1,
                GTIN: "04657786240081",
                SUBJID: ""
            },
            {
                NDOC: "407",
                DATEDOC: "2026-08-23",
                CODEPST: "000012",
                EAN13: "4607003560014",
                PRICE1: 120.00,
                PRICE2: 150.00,
                PRICE2N: 136.36,
                QNT: 10.0,
                SER: "А102030",
                GDATE: "2027-10-15",
                DATEMADE: "2025-10-01",
                NAME: "Аспирин 500мг таб №20",
                CNTR: "Германия",
                FIRM: "Байер АГ",
                NDS: 10,
                REGPRC: 150.00,
                NUMGTD: "10130010/120825/0014520",
                SERTIF: "РОСС DE.ФМ08.Д01245",
                SUMSTR: 1500.00,
                SUMSNDS: 136.40,
                PODRCD: "771069",
                BILLNUM: "407",
                BILLDT: "2026-08-23",
                NUMZ: 407,
                DATEZ: "2026-08-23",
                MARK: 1,
                GTIN: "04607003560014",
                SUBJID: ""
            }
        ];

        this.metaHeader = {
            NDOC: "407",
            DATEDOC: "2026-08-23",
            SENDER_NAME: "ООО «АтрианМГ»",
            SENDER_INN: "7700123456",
            SENDER_KPP: "770101001",
            RCV_NAME: "Аптека НЕО-ФАРМ №1069",
            RCV_INN: "7734123456",
            RCV_KPP: "773401001",
            PODRCD: "771069",
            CONTRACT_NUM: "ДОГ-2026/01"
        };

        this.mainGrid.updateData(this.records, this.schema, []);
        this._revalidateDocument();
    }
}

// Запуск WebOS при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    const app = new PharmaGateWebOS();
    app.init().catch(err => console.error("[WebOS] Фатальный сбой:", err));
    window.PharmaGate = app;
});