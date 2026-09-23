/**
 * js/services/cross_platform_hub.js - Модуль кроссплатформенной совместимости (Linux, macOS, Windows).
 * 
 * Включает:
 * 1. Определение хостовой ОС (macOS, Windows, Linux, iOS/Android) и адаптация стилей окон/панелей.
 * 2. Родные стили окон (macOS Traffic Lights слева vs Windows Fluent справа vs Linux Adwaita).
 * 3. Динамические горячие клавиши (⌘ Cmd для Mac vs Ctrl для Win/Linux) и поддержка жестов трекпада.
 * 4. File System Access API (прямое чтение и сохранение файлов без загрузки в папку Downloads).
 * 5. Буфер обмена: интеграция с MS Excel (Win/Mac), Apple Numbers (macOS) и LibreOffice Calc (Linux).
 * 6. Переключатель кодировок (DOS CP866 / Win CP1251 / UTF-8) и окончаний строк (Windows CRLF ↔ Linux/Mac LF).
 * 7. Spotlight / Command Palette (⌘K / Ctrl+K) с быстрым поиском действий.
 * 8. Генератор демонстрационных фармацевтических накладных для быстрого тестирования на любой ОС.
 * 9. Синтезатор звуковых эффектов Web Audio API.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class CrossPlatformHub {
    constructor(appInstance) {
        this.app = appInstance;
        this.activeFileHandle = null;
        this.detectedOs = this._detectHostOs();
        this.configuredOs = localStorage.getItem('pharmagate_os_persona') || 'auto';
        this.activeLineEnding = localStorage.getItem('pharmagate_line_ending') || (this.detectedOs === 'windows' ? 'crlf' : 'lf');
        this.activeEncoding = localStorage.getItem('pharmagate_export_encoding') || 'cp866';
        this.audioEnabled = localStorage.getItem('pharmagate_sound_fx') === 'true';
        this.zoomLevel = parseFloat(localStorage.getItem('pharmagate_zoom_level') || '1.0');
        this.audioCtx = null;
    }

    /**
     * Инициализация всех систем кроссплатформенности
     */
    init() {
        this._applyOsPersona();
        this._initSpotlightPalette();
        this._initClipboardPasteListener();
        this._initZoomAndDisplayControls();
        this._updateUiShortcutsBadges();
        this._renderSystemIndicators();
        console.log(`[CrossPlatformHub] Инициализирован. ОС: ${this.detectedOs} (Режим: ${this.configuredOs}), Перевод строк: ${this.activeLineEnding.toUpperCase()}, Звук: ${this.audioEnabled}`);
    }

    // =========================================================================
    // 1. ДЕТЕКЦИЯ И АДАПТАЦИЯ ОС (macOS / Windows / Linux)
    // =========================================================================

    _detectHostOs() {
        const ua = navigator.userAgent || '';
        const platform = navigator.userAgentData?.platform || navigator.platform || '';
        if (/mac|iphone|ipad|ipod/i.test(platform) || /macintosh|mac os x/i.test(ua)) return 'macos';
        if (/win/i.test(platform) || /windows/i.test(ua)) return 'windows';
        if (/linux/i.test(platform) || /linux|x11/i.test(ua)) return 'linux';
        return 'windows';
    }

    getEffectiveOs() {
        return this.configuredOs === 'auto' ? this.detectedOs : this.configuredOs;
    }

    setOsPersona(persona) {
        this.configuredOs = persona;
        localStorage.setItem('pharmagate_os_persona', persona);
        this._applyOsPersona();
        this._updateUiShortcutsBadges();
        this._renderSystemIndicators();
        this.playSound('click');
        this.app._showToast(`🖥️ Режим оформления переключен на: ${this._getOsDisplayName(this.getEffectiveOs())}`);
    }

    _getOsDisplayName(os) {
        if (os === 'macos') return 'macOS (Apple Cupertino)';
        if (os === 'windows') return 'Windows 11 (Microsoft Fluent)';
        if (os === 'linux') return 'Linux (GNOME / KDE / Ubuntu)';
        return os;
    }

    _applyOsPersona() {
        const effectiveOs = this.getEffectiveOs();
        const root = document.documentElement;

        root.classList.remove('os-mode-macos', 'os-mode-windows', 'os-mode-linux');
        root.classList.add(`os-mode-${effectiveOs}`);

        // Обновляем шапки окон: в macOS кнопки перемещаются влево в виде Traffic Lights
        document.querySelectorAll('.os-window').forEach(win => {
            const header = win.querySelector('.win-header');
            if (!header) return;

            const titleWrap = header.querySelector('.flex.items-center.gap-2');
            const btnsWrap = header.querySelector('.flex.items-center.gap-1');

            if (effectiveOs === 'macos') {
                if (btnsWrap && !btnsWrap.classList.contains('mac-traffic-lights')) {
                    btnsWrap.classList.add('mac-traffic-lights', 'order-first', 'mr-3');
                    header.classList.add('flex-row', 'items-center');
                    if (titleWrap) titleWrap.classList.add('flex-1', 'text-center', 'pr-8');
                }
            } else {
                if (btnsWrap && btnsWrap.classList.contains('mac-traffic-lights')) {
                    btnsWrap.classList.remove('mac-traffic-lights', 'order-first', 'mr-3');
                    if (titleWrap) titleWrap.classList.remove('flex-1', 'text-center', 'pr-8');
                }
            }
        });

        // Обновляем вид кнопки «Пуск»
        const startBtn = document.querySelector('#taskbar button[onclick*="toggleStartMenu"]');
        if (startBtn) {
            if (effectiveOs === 'macos') {
                startBtn.innerHTML = '🍎';
                startBtn.title = 'Меню Apple (macOS)';
            } else if (effectiveOs === 'linux') {
                startBtn.innerHTML = '🐧';
                startBtn.title = 'Меню приложений (Linux)';
            } else {
                startBtn.innerHTML = '🪟';
                startBtn.title = 'Меню Пуск (Windows)';
            }
        }
    }

    _updateUiShortcutsBadges() {
        const isMac = this.getEffectiveOs() === 'macos';
        const modKey = isMac ? '⌘' : 'Ctrl+';
        const optKey = isMac ? '⌥' : 'Alt+';

        // Обновляем подсказки клавиш
        const keyO = document.getElementById('kbdOpenHint');
        if (keyO) keyO.innerText = `${modKey}O`;
        const keyS = document.getElementById('kbdSaveHint');
        if (keyS) keyS.innerText = `${modKey}S`;
        const keyK = document.getElementById('kbdSpotlightHint');
        if (keyK) keyK.innerText = `${modKey}K`;
        const keyZ = document.getElementById('kbdUndoHint');
        if (keyZ) keyZ.innerText = `${modKey}Z`;
        const keyY = document.getElementById('kbdRedoHint');
        if (keyY) keyY.innerText = isMac ? `⌘⇧Z` : `Ctrl+Y`;
    }

    // =========================================================================
    // 2. NATIVE FILE SYSTEM ACCESS API (Chromium на Mac, Windows, Linux)
    // =========================================================================

    async openNativeFileDialog() {
        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [
                        {
                            description: 'Фармацевтические документы (DBF, Excel, XML, JSON, CSV, Access)',
                            accept: {
                                'application/x-dbf': ['.dbf'],
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                                'application/vnd.ms-excel': ['.xls'],
                                'text/xml': ['.xml'],
                                'application/json': ['.json'],
                                'text/csv': ['.csv'],
                                'application/x-msaccess': ['.accdb', '.mdb']
                            }
                        }
                    ],
                    multiple: false
                });

                if (handle) {
                    this.activeFileHandle = handle;
                    const file = await handle.getFile();
                    this.playSound('click');
                    await this.app.loadFile(file);
                    return true;
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('[CrossPlatformHub] showOpenFilePicker сбой, используем fallback:', err);
                } else {
                    return false;
                }
            }
        }

        // Fallback: стандартный input[type=file]
        document.getElementById('fileInput')?.click();
        return false;
    }

    async saveNativeFileDialog(filename, blob) {
        if ('showSaveFilePicker' in window) {
            try {
                const ext = filename.split('.').pop().toLowerCase();
                const mimeType = ext === 'dbf' ? 'application/x-dbf' : (ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/xml');
                
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: `Файл ${ext.toUpperCase()}`,
                        accept: { [mimeType]: [`.${ext}`] }
                    }]
                });

                if (handle) {
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    this.activeFileHandle = handle;
                    this.playSound('success');
                    this.app._showToast(`💾 Файл '${handle.name}' успешно сохранен на диск через File System API!`);
                    return true;
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('[CrossPlatformHub] showSaveFilePicker сбой, используем fallback:', err);
                } else {
                    return false;
                }
            }
        }

        // Fallback: стандартное скачивание через <a>
        const link = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        this.playSound('success');
        return true;
    }

    // =========================================================================
    // 3. БУФЕР ОБМЕНА: ИНТЕГРАЦИЯ С EXCEL, LIBREOFFICE CALC И APPLE NUMBERS
    // =========================================================================

    _initClipboardPasteListener() {
        window.addEventListener('paste', async (e) => {
            // Если фокус в текстовом инпуте - не перехватываем
            if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;

            const clipText = e.clipboardData?.getData('text/plain') || '';
            if (!clipText || !clipText.includes('\t')) return; // Не табличные данные

            e.preventDefault();
            this._handlePastedTableData(clipText);
        });
    }

    async _handlePastedTableData(tsvText) {
        try {
            const lines = tsvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length < 2) return;

            const rawHeaders = lines[0].split('\t').map(h => h.trim());
            const dataRows = lines.slice(1);

            const confirmed = confirm(
                `📋 Обнаружены табличные данные из буфера обмена (${lines.length - 1} строк, колонок: ${rawHeaders.length}).\n\n` +
                `Импортировать в текущую накладную?`
            );
            if (!confirmed) return;

            this.app._saveSnapshot();

            const newRecords = [];
            dataRows.forEach(line => {
                const cols = line.split('\t');
                const rec = {};
                this.app.schema.fields.forEach((f, idx) => {
                    const headerIdx = rawHeaders.findIndex(h => h.toUpperCase() === f.name.toUpperCase());
                    if (headerIdx !== -1 && cols[headerIdx] !== undefined) {
                        const val = cols[headerIdx].trim();
                        rec[f.name] = (f.type === 'N' || f.type === 'F') ? (parseFloat(val.replace(',', '.')) || 0) : val;
                    } else if (cols[idx] !== undefined) {
                        const val = cols[idx].trim();
                        rec[f.name] = (f.type === 'N' || f.type === 'F') ? (parseFloat(val.replace(',', '.')) || 0) : val;
                    } else {
                        rec[f.name] = (f.type === 'N' || f.type === 'F') ? 0 : '';
                    }
                });
                newRecords.push(rec);
            });

            this.app.records = [...this.app.records, ...newRecords];
            this.app.mainGrid.updateData(this.app.records, this.app.schema, []);
            this.app._revalidateDocument();
            this.playSound('success');
            this.app._showToast(`📋 Добавлено ${newRecords.length} строк из буфера обмена (Excel / Calc / Numbers)!`);
        } catch (err) {
            console.error('[CrossPlatformHub] Ошибка парсинга буфера обмена:', err);
            this.app._showToast(`❌ Ошибка вставки: ${err.message}`);
        }
    }

    async copyCurrentGridAsTsv() {
        if (!this.app.records.length) {
            this.app._showToast("⚠️ Накладная пуста, нечего копировать!");
            return;
        }

        const success = await this.app.mainGrid.exportToClipboardTSV();
        if (success) {
            this.playSound('click');
            this.app._showToast(`📋 ${this.app.records.length} строк скопировано в буфер обмена! Вставьте в Excel / Calc / Numbers.`);
        }
    }

    // =========================================================================
    // 4. КОДИРОВКИ И ОКОНЧАНИЯ СТРОК (Windows CRLF ↔ Linux/Mac LF)
    // =========================================================================

    setLineEnding(le) {
        this.activeLineEnding = le.toLowerCase() === 'crlf' ? 'crlf' : 'lf';
        localStorage.setItem('pharmagate_line_ending', this.activeLineEnding);
        this._renderSystemIndicators();
        this.playSound('click');
        this.app._showToast(`📄 Формат окончаний строк: ${this.activeLineEnding.toUpperCase()} (${this.activeLineEnding === 'crlf' ? 'Windows \\r\\n' : 'Linux / macOS \\n'})`);
    }

    setEncoding(enc) {
        this.activeEncoding = enc;
        localStorage.setItem('pharmagate_export_encoding', enc);
        this._renderSystemIndicators();
        this.playSound('click');
        this.app._showToast(`🔤 Целевая кодировка экспорта: ${enc.toUpperCase()}`);
    }

    getLineEndingString() {
        return this.activeLineEnding === 'crlf' ? '\r\n' : '\n';
    }

    // =========================================================================
    // 5. ДИСПЛЕЙ, МАСШТАБ, ПОЛНЫЙ ЭКРАН И ЖЕСТЫ
    // =========================================================================

    _initZoomAndDisplayControls() {
        this.applyZoom(this.zoomLevel);

        // Полноэкранный режим по F11
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });
    }

    applyZoom(level) {
        this.zoomLevel = Math.max(0.75, Math.min(1.5, Math.round(level * 100) / 100));
        localStorage.setItem('pharmagate_zoom_level', String(this.zoomLevel));
        const desktop = document.getElementById('desktopArea');
        if (desktop) {
            desktop.style.transformOrigin = 'top left';
            desktop.style.zoom = `${this.zoomLevel * 100}%`;
        }
        const zoomVal = document.getElementById('hudZoomVal');
        if (zoomVal) zoomVal.innerText = `${Math.round(this.zoomLevel * 100)}%`;
    }

    zoomIn() { this.applyZoom(this.zoomLevel + 0.1); this.playSound('click'); }
    zoomOut() { this.applyZoom(this.zoomLevel - 0.1); this.playSound('click'); }
    zoomReset() { this.applyZoom(1.0); this.playSound('click'); }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
            this.app._showToast("🖥️ Полноэкранный режим активирован");
        } else {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            this.app._showToast("🖥️ Обычный режим окна");
        }
        this.playSound('click');
    }

    // =========================================================================
    // 6. ЗВУКОВЫЕ ЭФФЕКТЫ (Web Audio API)
    // =========================================================================

    toggleSound(enabled) {
        this.audioEnabled = enabled !== undefined ? enabled : !this.audioEnabled;
        localStorage.setItem('pharmagate_sound_fx', String(this.audioEnabled));
        if (this.audioEnabled) this.playSound('success');
        this.app._showToast(this.audioEnabled ? "🔔 Звуковые эффекты включены" : "🔕 Звуковые эффекты выключены");
    }

    playSound(type = 'click') {
        if (!this.audioEnabled) return;
        try {
            if (!this.audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) this.audioCtx = new AudioContextClass();
            }
            if (!this.audioCtx) return;
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            if (type === 'click') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.04);
            } else if (type === 'success') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'error') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.setValueAtTime(160, now + 0.08);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch (e) {
            // Audio context policy or silence
        }
    }

    // =========================================================================
    // 7. ДЕМОНСТРАЦИОННАЯ ФАРМАЦЕВТИЧЕСКАЯ НАКЛАДНАЯ (Для Mac/Linux пользователей)
    // =========================================================================

    generateDemoPharmaInvoice(count = 50) {
        const meds = [
            { name: "Амоксиклав таб 875мг+125мг №14", firm: "Lek d.d.", cntr: "Словения", nds: 10, price: 420.50, isZh: true },
            { name: "Нурофен Экспресс капс 200мг №16", firm: "Reckitt Benckiser", cntr: "Великобритания", nds: 20, price: 185.00, isZh: false },
            { name: "Ксарелто таб п/о 20мг №28", firm: "Bayer AG", cntr: "Германия", nds: 10, price: 3450.00, isZh: true },
            { name: "Мирамистин р-р 0.01% фл 150мл", firm: "Инфамед", cntr: "Россия", nds: 10, price: 380.20, isZh: false },
            { name: "Омепразол капс 20мг №30", firm: "Озон ООО", cntr: "Россия", nds: 10, price: 68.00, isZh: true },
            { name: "Супрастин таб 25мг №20", firm: "Egis Pharmaceuticals", cntr: "Венгрия", nds: 10, price: 172.40, isZh: true },
            { name: "Ингавирин капс 90мг №10", firm: "Валента Фарм", cntr: "Россия", nds: 20, price: 790.00, isZh: false },
            { name: "Бинт марлевый стер 7м х 14см", firm: "Ньюфарм", cntr: "Россия", nds: 0, price: 32.50, isZh: false },
            { name: "Шприц одноразовый 5мл 3-комп", firm: "SFM Medical", cntr: "Германия", nds: 0, price: 14.20, isZh: false },
            { name: "Дексаметазон амп 4мг/мл 1мл №25", firm: "KRKA", cntr: "Словения", nds: 10, price: 210.00, isZh: true }
        ];

        this.app._saveSnapshot();
        const records = [];
        const today = new Date().toISOString().slice(0, 10);

        for (let i = 1; i <= count; i++) {
            const med = meds[(i - 1) % meds.length];
            const qnt = ((i % 8) + 1) * 5;
            let price2 = med.price;
            let sumstr = Math.round(qnt * price2 * 100) / 100;

            // Намеренные ошибки ФЛК для демонстрации возможностей анализатора
            if (i === 3) sumstr += 50.0; // Ошибка математики суммы
            let codepst = String(1000 + i);
            if (i === 7) codepst = "12"; // Ошибка неполного артикула (без ведущих нулей)
            let gtd = med.cntr === "Россия" ? "б/гтд" : `10702070/120524/${String(1000000 + i).slice(1)}`;
            if (i === 5 && med.cntr !== "Россия") gtd = "10702070/INVALID/99"; // Неверный формат ГТД

            const expDate = new Date();
            expDate.setMonth(expDate.getMonth() + 18 + (i % 12));
            const dateSrok = expDate.toISOString().slice(0, 10);

            records.push({
                CODEPST: codepst,
                NAME: med.name,
                SER: `Б-${String(202500 + i).slice(-4)}`,
                QNT: qnt,
                PRICE2: price2,
                SUMSTR: sumstr,
                SUMSNDS: sumstr,
                NDS: med.nds,
                DATESROK: dateSrok,
                CNTR: med.cntr,
                FIRM: med.firm,
                REGPRC: med.isZh ? Math.round(price2 * 0.95 * 100) / 100 : 0.0,
                NUMGTD: gtd,
                EAN13: `460000${String(1000000 + i).slice(1)}`,
                GTIN: `0460000${String(1000000 + i).slice(1)}`,
                PODRCD: "001",
                NDOC: "DEMO-026/26",
                DATEDOC: today
            });
        }

        this.app.records = records;
        this.app.activeFileName = `Демо_Фарм_Накладная_${count}стр.dbf`;
        this.app.mainGrid.updateData(this.app.records, this.app.schema, []);
        this.app._revalidateDocument();
        this.app.openApp('winEditor');
        this.playSound('success');
        this.app._showToast(`🎲 Сгенерирована демонстрационная накладная на ${count} медикаментов с ФЛК-метками!`);
    }

    // =========================================================================
    // 8. SPOTLIGHT & COMMAND PALETTE (⌘K / Ctrl+K)
    // =========================================================================

    _initSpotlightPalette() {
        const palette = document.getElementById('commandPaletteModal');
        const input = document.getElementById('paletteSearchInput');
        const results = document.getElementById('paletteResultsList');
        if (!palette || !input || !results) return;

        const openPalette = () => {
            palette.classList.remove('hidden');
            palette.classList.add('flex');
            input.value = '';
            input.focus();
            this._renderPaletteItems('');
            this.playSound('click');
        };

        const closePalette = () => {
            palette.classList.add('hidden');
            palette.classList.remove('flex');
        };

        // Горячая клавиша ⌘K / Ctrl+K
        window.addEventListener('keydown', (e) => {
            const isMod = e.metaKey || e.ctrlKey;
            if (isMod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (palette.classList.contains('hidden')) openPalette();
                else closePalette();
            } else if (e.key === 'Escape' && !palette.classList.contains('hidden')) {
                closePalette();
            }
        });

        palette.addEventListener('click', (e) => {
            if (e.target === palette) closePalette();
        });

        input.addEventListener('input', (e) => {
            this._renderPaletteItems(e.target.value);
        });

        // Навигация стрелками
        input.addEventListener('keydown', (e) => {
            const items = results.querySelectorAll('.palette-item');
            if (!items.length) return;
            let activeIdx = Array.from(items).findIndex(it => it.classList.contains('active-item'));

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIdx = (activeIdx + 1) % items.length;
                this._highlightPaletteItem(items, activeIdx);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIdx = (activeIdx - 1 + items.length) % items.length;
                this._highlightPaletteItem(items, activeIdx);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIdx !== -1 && items[activeIdx]) {
                    items[activeIdx].click();
                } else if (items[0]) {
                    items[0].click();
                }
            }
        });

        // Кнопка поиска в Taskbar
        document.getElementById('btnOpenSpotlight')?.addEventListener('click', openPalette);
    }

    _highlightPaletteItem(items, idx) {
        items.forEach((it, i) => {
            if (i === idx) {
                it.classList.add('active-item', 'bg-blue-600/30', 'border-blue-500/80');
                it.scrollIntoView({ block: 'nearest' });
            } else {
                it.classList.remove('active-item', 'bg-blue-600/30', 'border-blue-500/80');
            }
        });
    }

    _getCommandPaletteActions() {
        const isMac = this.getEffectiveOs() === 'macos';
        const modKey = isMac ? '⌘' : 'Ctrl+';

        return [
            {
                id: 'open_file',
                title: 'Открыть накладную (DBF / Excel / XML / JSON / Access)',
                shortcut: `${modKey}O`,
                icon: '📁',
                category: 'Файлы',
                action: () => this.openNativeFileDialog()
            },
            {
                id: 'save_dbf',
                title: 'Сохранить накладную в DBF (DOS CP866 / Win-1251)',
                shortcut: `${modKey}S`,
                icon: '💾',
                category: 'Файлы',
                action: () => this.app.downloadDbf()
            },
            {
                id: 'export_torg12',
                title: 'Экспорт в Excel: Унифицированная форма ТОРГ-12',
                shortcut: '',
                icon: '📄',
                category: 'Экспорт',
                action: () => document.getElementById('btnExportTorg12')?.click()
            },
            {
                id: 'export_upd',
                title: 'Экспорт в XML: Титул продавца УПД 970@ (ФНС КНД 1115131)',
                shortcut: '',
                icon: '📑',
                category: 'Экспорт',
                action: () => document.getElementById('btnExportUpd')?.click()
            },
            {
                id: 'demo_data',
                title: '🎲 Загрузить демо-накладную (50 медикаментов с ФЛК-ошибками)',
                shortcut: '',
                icon: '🎲',
                category: 'Тестирование',
                action: () => this.generateDemoPharmaInvoice(50)
            },
            {
                id: 'auto_repair',
                title: 'Запустить авторемонт ФЛК и коммерческих правил',
                shortcut: 'F5',
                icon: '🛡️',
                category: 'ФЛК',
                action: () => this.app.runAutoRepair()
            },
            {
                id: 'copy_tsv',
                title: 'Скопировать накладную в буфер как TSV (для Excel / Calc / Numbers)',
                shortcut: `${modKey}C`,
                icon: '📋',
                category: 'Буфер',
                action: () => this.copyCurrentGridAsTsv()
            },
            {
                id: 'open_editor',
                title: 'Открыть: Редактор накладной (Tabulator Studio)',
                shortcut: '',
                icon: '📄',
                category: 'Окна',
                action: () => this.app.openApp('winEditor')
            },
            {
                id: 'open_reconcile',
                title: 'Открыть: Каскадная сверка Заказ ↔ Накладная (otkaz.dbf)',
                shortcut: '',
                icon: '⚖️',
                category: 'Окна',
                action: () => this.app.openApp('winReconcile')
            },
            {
                id: 'open_schema',
                title: 'Открыть: Конструктор структуры и схемы DBF/Access',
                shortcut: '',
                icon: '📐',
                category: 'Окна',
                action: () => this.app.openApp('winSchema')
            },
            {
                id: 'open_erp',
                title: 'Открыть: Mini-ERP Справочник номенклатуры (SQLite WASM)',
                shortcut: '',
                icon: '🗄️',
                category: 'Окна',
                action: () => this.app.openApp('winDb')
            },
            {
                id: 'open_kb',
                title: 'Открыть: База Знаний ФЛК и стандарты фармсетей',
                shortcut: '',
                icon: '📚',
                category: 'Окна',
                action: () => this.app.openApp('winKb')
            },
            {
                id: 'open_inspector',
                title: 'Открыть: Инспектор правок (Live Diff Studio)',
                shortcut: '',
                icon: '🛠️',
                category: 'Окна',
                action: () => this.app.openApp('winInspector')
            },
            {
                id: 'open_settings',
                title: 'Открыть: Центр настроек PharmaGate EDI',
                shortcut: '',
                icon: '⚙️',
                category: 'Окна',
                action: () => this.app.openApp('winSettings')
            },
            {
                id: 'os_macos',
                title: 'Оформление ОС: переключить на macOS (Apple Cupertino)',
                shortcut: '',
                icon: '🍎',
                category: 'Стиль ОС',
                action: () => this.setOsPersona('macos')
            },
            {
                id: 'os_win',
                title: 'Оформление ОС: переключить на Windows 11 (Fluent)',
                shortcut: '',
                icon: '🪟',
                category: 'Стиль ОС',
                action: () => this.setOsPersona('windows')
            },
            {
                id: 'os_linux',
                title: 'Оформление ОС: переключить на Linux (GNOME / KDE)',
                shortcut: '',
                icon: '🐧',
                category: 'Стиль ОС',
                action: () => this.setOsPersona('linux')
            },
            {
                id: 'toggle_fullscreen',
                title: 'Полноэкранный режим (Fullscreen)',
                shortcut: 'F11',
                icon: '🖥️',
                category: 'Вид',
                action: () => this.toggleFullscreen()
            },
            {
                id: 'line_crlf',
                title: 'Перевод строк: Windows CRLF (\\r\\n)',
                shortcut: '',
                icon: '📄',
                category: 'Кодировки',
                action: () => this.setLineEnding('crlf')
            },
            {
                id: 'line_lf',
                title: 'Перевод строк: Linux / macOS LF (\\n)',
                shortcut: '',
                icon: '📄',
                category: 'Кодировки',
                action: () => this.setLineEnding('lf')
            },
            {
                id: 'enc_cp866',
                title: 'Кодировка DBF: DOS CP866 (0x26)',
                shortcut: '',
                icon: '🔤',
                category: 'Кодировки',
                action: () => this.setEncoding('cp866')
            },
            {
                id: 'enc_cp1251',
                title: 'Кодировка DBF: Windows CP1251 (0x25)',
                shortcut: '',
                icon: '🔤',
                category: 'Кодировки',
                action: () => this.setEncoding('windows-1251')
            },
            {
                id: 'undo',
                title: 'Отменить последнее действие (Undo)',
                shortcut: `${modKey}Z`,
                icon: '⏪',
                category: 'Правка',
                action: () => this.app.undo()
            },
            {
                id: 'redo',
                title: 'Повторить отмененное действие (Redo)',
                shortcut: isMac ? '⌘⇧Z' : 'Ctrl+Y',
                icon: '⏩',
                category: 'Правка',
                action: () => this.app.redo()
            }
        ];
    }

    _renderPaletteItems(filterText = '') {
        const results = document.getElementById('paletteResultsList');
        if (!results) return;

        const q = filterText.trim().toLowerCase();
        const actions = this._getCommandPaletteActions();
        const filtered = actions.filter(a => !q || a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.shortcut.toLowerCase().includes(q));

        if (!filtered.length) {
            results.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs italic">Ничего не найдено по запросу "${filterText}"</div>`;
            return;
        }

        results.innerHTML = filtered.map((item, idx) => `
            <div data-idx="${idx}" class="palette-item flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-slate-700 hover:bg-slate-800/60 cursor-pointer transition-colors ${idx === 0 ? 'active-item bg-blue-600/20 border-blue-500/50' : ''}">
                <div class="flex items-center gap-3">
                    <span class="text-lg w-6 text-center">${item.icon}</span>
                    <div>
                        <div class="text-xs font-semibold text-white">${item.title}</div>
                        <div class="text-[10px] text-slate-400">${item.category}</div>
                    </div>
                </div>
                ${item.shortcut ? `<span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-blue-400 font-mono">${item.shortcut}</span>` : ''}
            </div>
        `).join('');

        results.querySelectorAll('.palette-item').forEach((el, idx) => {
            el.addEventListener('click', () => {
                document.getElementById('commandPaletteModal')?.classList.add('hidden');
                filtered[idx].action();
            });
        });
    }

    // =========================================================================
    // 9. СИСТЕМНЫЕ ИНДИКАТОРЫ В ПАНЕЛИ ЗАДАЧ (HUD)
    // =========================================================================

    _renderSystemIndicators() {
        const osBadge = document.getElementById('hudOsBadge');
        if (osBadge) {
            const os = this.getEffectiveOs();
            const icon = os === 'macos' ? '🍎 Mac' : (os === 'linux' ? '🐧 Linux' : '🪟 Win');
            osBadge.innerHTML = `<span class="cursor-pointer" title="Нажмите для смены стиля ОС">${icon}</span>`;
        }

        const leBadge = document.getElementById('hudLineEndingBadge');
        if (leBadge) {
            leBadge.innerText = this.activeLineEnding.toUpperCase();
            leBadge.title = `Окончания строк: ${this.activeLineEnding.toUpperCase()} (${this.activeLineEnding === 'crlf' ? 'Windows \\r\\n' : 'Linux/Mac \\n'}). Нажмите для переключения.`;
        }

        const encBadge = document.getElementById('hudEncBadge');
        if (encBadge) {
            encBadge.innerText = this.activeEncoding.includes('866') ? 'CP866' : (this.activeEncoding.includes('1251') ? 'CP1251' : 'UTF-8');
            encBadge.title = `Кодировка DBF: ${encBadge.innerText}. Нажмите для переключения.`;
        }
    }
}
