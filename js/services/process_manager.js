/**
 * js/services/process_manager.js - Диспетчер процессов и Оконный Менеджер (WindowManager Core)
 * 
 * Ключевые возможности:
 * 1. Таблица процессов: PID, AppID, состояние данных, геометрия и жизненный цикл;
 * 2. Бесшовное переключение Shell (Десктоп WebOS <-> Мобильный Портал) без потери состояния и несохраненных данных;
 * 3. Z-Index стек и фокус окон с предотвращением наложения и коллизий;
 * 4. Автоматическое сохранение снимка процессов в sessionStorage / SessionCache;
 * 5. Адаптивное центрирование и безопасное ограничение геометрии (Viewport Clamping).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class ProcessManager {
    static _instance = null;

    static getInstance(app = null) {
        if (!ProcessManager._instance) {
            ProcessManager._instance = new ProcessManager(app);
        } else if (app && !ProcessManager._instance.app) {
            ProcessManager._instance.app = app;
        }
        return ProcessManager._instance;
    }

    constructor(app = null) {
        this.app = app;
        this.processTable = new Map(); // pid -> ProcessRecord
        this.appToPidMap = new Map();  // appId -> pid
        this._nextPid = 100;
        this._topZIndex = 20;
        this._activePid = null;
        this._listeners = new Map(); // event -> Set of callbacks

        // Дефолтные параметры известных окон
        this.appRegistry = {
            winEditor: { title: 'Редактор Накладных', icon: '📄', defaultW: 1120, defaultH: 640 },
            winExplorer: { title: 'Проводник VFS', icon: '📁', defaultW: 1060, defaultH: 680 },
            winCameraScanner: { title: 'Камера ТСД', icon: '📱', defaultW: 560, defaultH: 680 },
            winBatchProcessor: { title: 'Пакетный EDI', icon: '📦', defaultW: 1040, defaultH: 640 },
            winJnvlp: { title: 'ЖНВЛП & Цены', icon: '💊', defaultW: 1060, defaultH: 660 },
            winLabelPrinter: { title: 'Печать ценников', icon: '🏷️', defaultW: 1020, defaultH: 660 },
            winDiffViewer: { title: 'Сравнение EDI', icon: '⇄', defaultW: 1120, defaultH: 680 },
            winSqlConsole: { title: 'SQL Консоль', icon: '>_', defaultW: 1080, defaultH: 660 },
            winDb: { title: 'СУБД ERP', icon: '🗄️', defaultW: 1000, defaultH: 580 },
            winReconcile: { title: 'Сверка Накладных', icon: '📋', defaultW: 1000, defaultH: 580 },
            winSchema: { title: 'Конструктор Схем', icon: '📐', defaultW: 980, defaultH: 580 },
            winWizard: { title: 'Мастер 2.0', icon: '🚀', defaultW: 920, defaultH: 580 },
            winInspector: { title: 'Инспектор ФЛК', icon: '🛠️', defaultW: 960, defaultH: 580 },
            winKb: { title: 'База Знаний', icon: '📚', defaultW: 920, defaultH: 580 },
            winGuide: { title: 'Гид & Обучение', icon: '🎓', defaultW: 1040, defaultH: 630 },
            winSettings: { title: 'Параметры', icon: '⚙️', defaultW: 840, defaultH: 560 },
            winUpdateCenter: { title: 'Центр Обновлений', icon: '🔄', defaultW: 1040, defaultH: 680 },
            winScale: { title: 'Экран & Масштаб', icon: '🖥️±', defaultW: 800, defaultH: 500 },
            winPersonalization: { title: 'Персонализация', icon: '🎨', defaultW: 820, defaultH: 540 }
        };

        this._restoreSessionProcesses();
    }

    // =========================================================================
    // 1. ЖИЗНЕННЫЙ ЦИКЛ ПРОЦЕССА (SPAWN, FOCUS, MINIMIZE, TERMINATE)
    // =========================================================================

    /**
     * Запуск процесса или вывод существующего экземпляра на передний план
     * @param {string} appId - DOM id окна (напр. 'winEditor')
     * @param {Object} initialState - Начальное состояние
     * @returns {Object} Запущенный процесс
     */
    spawn(appId, initialState = {}) {
        if (!appId) return null;

        // Если процесс для данного appId уже существует, переводим фокус
        if (this.appToPidMap.has(appId)) {
            const existingPid = this.appToPidMap.get(appId);
            this.focus(existingPid);
            return this.processTable.get(existingPid);
        }

        const pid = this._nextPid++;
        const meta = this.appRegistry[appId] || { title: appId, icon: '🪟', defaultW: 900, defaultH: 600 };
        const domEl = typeof document !== 'undefined' ? document.getElementById(appId) : null;

        let bounds = {
            left: 200 + (this.processTable.size * 28) % 240,
            top: 40 + (this.processTable.size * 24) % 180,
            width: meta.defaultW,
            height: meta.defaultH,
            isMaximized: false,
            isMinimized: false,
            zIndex: ++this._topZIndex
        };

        if (domEl) {
            const rect = domEl.getBoundingClientRect();
            if (rect.width > 100 && rect.height > 100) {
                bounds.width = Math.round(rect.width);
                bounds.height = Math.round(rect.height);
                bounds.left = Math.round(domEl.offsetLeft || rect.left);
                bounds.top = Math.round(domEl.offsetTop || rect.top);
            }
            bounds.isMinimized = false;
            bounds.isMaximized = domEl.classList.contains('maximized');
            if (domEl.style.zIndex) {
                bounds.zIndex = Math.max(bounds.zIndex, parseInt(domEl.style.zIndex, 10) || bounds.zIndex);
            }
        }

        const processRecord = {
            pid,
            appId,
            title: meta.title,
            icon: meta.icon,
            status: 'running',
            createdAt: Date.now(),
            bounds,
            state: { ...initialState }
        };

        this.processTable.set(pid, processRecord);
        this.appToPidMap.set(appId, pid);
        this._activePid = pid;

        if (domEl) {
            domEl.setAttribute('data-pid', String(pid));
            domEl.classList.remove('minimized');
            domEl.style.zIndex = String(bounds.zIndex);
            this._clampWindowInViewport(domEl);
        }

        this._emit('process:spawned', processRecord);
        this._persistProcessTable();
        return processRecord;
    }

    /**
     * Активация процесса и подъем окна на самый верх Z-индекса
     * @param {number|string} pidOrAppId 
     */
    focus(pidOrAppId) {
        const proc = this._resolveProcess(pidOrAppId);
        if (!proc) return;

        proc.bounds.zIndex = ++this._topZIndex;
        proc.status = 'running';
        proc.bounds.isMinimized = false;
        this._activePid = proc.pid;

        const domEl = typeof document !== 'undefined' ? document.getElementById(proc.appId) : null;
        if (domEl) {
            domEl.classList.remove('minimized');
            domEl.style.zIndex = String(proc.bounds.zIndex);

            // Визуальный активный класс для окна
            document.querySelectorAll('.os-window').forEach(w => w.classList.remove('active-window-focused'));
            domEl.classList.add('active-window-focused');
        }

        this._emit('process:focused', proc);
        this._persistProcessTable();
    }

    /**
     * Сворачивание окна процесса
     * @param {number|string} pidOrAppId 
     */
    minimize(pidOrAppId) {
        const proc = this._resolveProcess(pidOrAppId);
        if (!proc) return;

        proc.status = 'suspended';
        proc.bounds.isMinimized = true;

        const domEl = typeof document !== 'undefined' ? document.getElementById(proc.appId) : null;
        if (domEl) {
            domEl.classList.add('minimized');
            domEl.classList.remove('active-window-focused');
        }

        // Переводим фокус на следующее открытое окно
        if (this._activePid === proc.pid) {
            this._activePid = null;
            const openProcs = Array.from(this.processTable.values())
                .filter(p => p.status === 'running' && !p.bounds.isMinimized)
                .sort((a, b) => b.bounds.zIndex - a.bounds.zIndex);
            if (openProcs.length > 0) {
                this.focus(openProcs[0].pid);
            }
        }

        this._emit('process:minimized', proc);
        this._persistProcessTable();
    }

    /**
     * Максимизация / восстановление окна
     * @param {number|string} pidOrAppId 
     */
    toggleMaximize(pidOrAppId) {
        const proc = this._resolveProcess(pidOrAppId);
        if (!proc) return;

        const domEl = typeof document !== 'undefined' ? document.getElementById(proc.appId) : null;
        if (!domEl) return;

        const isMax = domEl.classList.toggle('maximized');
        proc.bounds.isMaximized = isMax;

        if (!isMax) {
            // Восстанавливаем прежние размеры
            domEl.style.left = `${proc.bounds.left}px`;
            domEl.style.top = `${proc.bounds.top}px`;
            domEl.style.width = `${proc.bounds.width}px`;
            domEl.style.height = `${proc.bounds.height}px`;
        }

        this.focus(proc.pid);
        this._emit('process:maximized', { proc, isMaximized: isMax });
        this._persistProcessTable();
    }

    /**
     * Завершение процесса
     * @param {number|string} pidOrAppId 
     */
    terminate(pidOrAppId) {
        const proc = this._resolveProcess(pidOrAppId);
        if (!proc) return;

        const domEl = typeof document !== 'undefined' ? document.getElementById(proc.appId) : null;
        if (domEl) {
            domEl.classList.add('minimized');
            domEl.classList.remove('active-window-focused');
            domEl.removeAttribute('data-pid');
        }

        this.processTable.delete(proc.pid);
        this.appToPidMap.delete(proc.appId);

        if (this._activePid === proc.pid) {
            this._activePid = null;
        }

        this._emit('process:terminated', proc);
        this._persistProcessTable();
    }

    // =========================================================================
    // 2. БЕСШОВНОЕ СОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ ДЛЯ ПЕРЕКЛЮЧЕНИЯ SHELL (DESKTOP <-> MOBILE)
    // =========================================================================

    /**
     * Сохранение снимка всех активных окон перед переключением в мобильный портал
     */
    saveShellSnapshot() {
        if (typeof document === 'undefined') return;

        for (const [pid, proc] of this.processTable.entries()) {
            const domEl = document.getElementById(proc.appId);
            if (!domEl) continue;

            if (!domEl.classList.contains('maximized')) {
                proc.bounds.left = domEl.offsetLeft || proc.bounds.left;
                proc.bounds.top = domEl.offsetTop || proc.bounds.top;
                proc.bounds.width = domEl.offsetWidth || proc.bounds.width;
                proc.bounds.height = domEl.offsetHeight || proc.bounds.height;
            }
            proc.bounds.isMinimized = domEl.classList.contains('minimized');
            proc.bounds.isMaximized = domEl.classList.contains('maximized');
            proc.bounds.zIndex = parseInt(domEl.style.zIndex || '10', 10);

            // Сохраняем состояние домена для конкретных окон
            if (proc.appId === 'winEditor' && this.app) {
                proc.state.recordsCount = this.app.records?.length || 0;
                proc.state.activeFileName = this.app.currentFileName || '';
            } else if (proc.appId === 'winExplorer' && this.app?.explorerController) {
                proc.state.currentPath = this.app.explorerController.currentPath || 'C:';
            }
        }

        this._persistProcessTable();
    }

    /**
     * Восстановление окон при возврате в десктопный WebOS режим
     */
    restoreShellSnapshot() {
        if (typeof document === 'undefined') return;

        for (const [pid, proc] of this.processTable.entries()) {
            const domEl = document.getElementById(proc.appId);
            if (!domEl) continue;

            domEl.style.zIndex = String(proc.bounds.zIndex);
            if (!proc.bounds.isMaximized) {
                domEl.style.left = `${proc.bounds.left}px`;
                domEl.style.top = `${proc.bounds.top}px`;
                domEl.style.width = `${proc.bounds.width}px`;
                domEl.style.height = `${proc.bounds.height}px`;
                domEl.classList.remove('maximized');
            } else {
                domEl.classList.add('maximized');
            }

            if (proc.bounds.isMinimized) {
                domEl.classList.add('minimized');
            } else {
                domEl.classList.remove('minimized');
            }

            this._clampWindowInViewport(domEl);
        }

        if (this._activePid && this.processTable.has(this._activePid)) {
            this.focus(this._activePid);
        }
    }

    // =========================================================================
    // 3. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ И ХЕЛПЕРЫ
    // =========================================================================

    _resolveProcess(pidOrAppId) {
        if (typeof pidOrAppId === 'number') {
            return this.processTable.get(pidOrAppId) || null;
        }
        if (typeof pidOrAppId === 'string') {
            const pid = this.appToPidMap.get(pidOrAppId);
            return pid ? this.processTable.get(pid) : null;
        }
        return null;
    }

    _clampWindowInViewport(domEl) {
        if (!domEl || typeof window === 'undefined') return;

        const maxW = window.innerWidth;
        const maxH = window.innerHeight;

        const currentL = domEl.offsetLeft || 0;
        const currentT = domEl.offsetTop || 0;
        const width = domEl.offsetWidth || 600;
        const height = domEl.offsetHeight || 400;

        const safeL = Math.max(10, Math.min(maxW - Math.min(width, 300), currentL));
        const safeT = Math.max(10, Math.min(maxH - Math.min(height, 120), currentT));

        domEl.style.left = `${safeL}px`;
        domEl.style.top = `${safeT}px`;
    }

    _persistProcessTable() {
        if (typeof sessionStorage === 'undefined') return;
        try {
            const dump = Array.from(this.processTable.values()).map(p => ({
                pid: p.pid,
                appId: p.appId,
                title: p.title,
                icon: p.icon,
                status: p.status,
                bounds: p.bounds,
                state: p.state
            }));
            sessionStorage.setItem('pharmagate_process_table', JSON.stringify(dump));
        } catch (e) {
            // Игнорируем квоту sessionStorage
        }
    }

    _restoreSessionProcesses() {
        if (typeof sessionStorage === 'undefined') return;
        try {
            const raw = sessionStorage.getItem('pharmagate_process_table');
            if (!raw) return;
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
                list.forEach(p => {
                    this.processTable.set(p.pid, p);
                    this.appToPidMap.set(p.appId, p.pid);
                    this._nextPid = Math.max(this._nextPid, p.pid + 1);
                    this._topZIndex = Math.max(this._topZIndex, p.bounds?.zIndex || 20);
                });
            }
        } catch (e) {}
    }

    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        return () => this._listeners.get(event)?.delete(callback);
    }

    _emit(event, data) {
        const set = this._listeners.get(event);
        if (set) {
            set.forEach(cb => {
                try { cb(data); } catch (err) { console.error(`[ProcessManager] Ошибка в обработчике ${event}:`, err); }
            });
        }
    }

    getRunningProcesses() {
        return Array.from(this.processTable.values());
    }

    getRunningAppIds() {
        return Array.from(this.appToPidMap.keys());
    }
}
