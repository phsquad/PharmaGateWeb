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
        this.soundVolume = parseFloat(localStorage.getItem('pharmagate_sound_volume') || '0.8');
        this.zoomLevel = parseFloat(localStorage.getItem('pharmagate_zoom_level') || '1.0');
        this.activeTheme = localStorage.getItem('pharmagate_theme') || 'fluent-dark';
        this.accentColor = localStorage.getItem('pharmagate_accent') || 'blue';
        this.autoDpiEnabled = localStorage.getItem('pharmagate_auto_dpi') === 'true';
        this.liteModeEnabled = localStorage.getItem('pharmagate_lite_mode') === 'true';
        this.autoLiteMode = localStorage.getItem('pharmagate_auto_lite_mode') !== 'false';
        this.customWallpaper = localStorage.getItem('pharmagate_custom_wallpaper') || '';
        this.audioCtx = null;
    }

    get detectedHost() {
        return { name: this._getOsDisplayName(this.detectedOs) };
    }

    get currentPersona() {
        return this.configuredOs;
    }

    setPersona(persona) {
        this.setOsPersona(persona);
    }

    get lineEnding() {
        return this.activeLineEnding;
    }

    get soundEnabled() {
        return this.audioEnabled;
    }

    setSoundEnabled(enabled) {
        this.toggleSound(enabled);
    }

    get zoomFactor() {
        return this.zoomLevel;
    }

    setZoom(level) {
        this.applyZoom(level);
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
        this._initDesktopCustomization();
        this._initDesktopContextMenu();
        this._initThemeAndAccentControls();
        this._initLiteMode();
        this._initScaleAndDpiControls();
        this._initDesktopQuickWidget();
        console.log(`[CrossPlatformHub] Инициализирован. ОС: ${this.detectedOs} (Режим: ${this.configuredOs}), Перевод строк: ${this.activeLineEnding.toUpperCase()}, Звук: ${this.audioEnabled}, Тема: ${this.activeTheme}, Lite-Mode: ${this.liteModeEnabled}`);
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
        // Полноэкранный режим по F11
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });
    }

    applyZoom(level, showToast = false) {
        this.zoomLevel = Math.max(0.70, Math.min(1.75, Math.round(level * 100) / 100));
        localStorage.setItem('pharmagate_zoom_level', String(this.zoomLevel));

        const desktop = document.getElementById('desktopArea');
        if (desktop) {
            desktop.style.transformOrigin = 'top left';
            desktop.style.zoom = `${this.zoomLevel * 100}%`;
        }

        const pct = Math.round(this.zoomLevel * 100);
        const str = `${pct}%`;

        // Обновление всех текстовых индикаторов
        const hudZoomVal = document.getElementById('hudZoomVal');
        if (hudZoomVal) hudZoomVal.innerText = str;

        const scalePercentageLabel = document.getElementById('scalePercentageLabel');
        if (scalePercentageLabel) scalePercentageLabel.innerText = str;

        const dropdownScaleVal = document.getElementById('dropdownScaleVal');
        if (dropdownScaleVal) dropdownScaleVal.innerText = str;

        const settingZoomDisplay = document.getElementById('settingZoomDisplay');
        if (settingZoomDisplay) settingZoomDisplay.innerText = str;

        const quickWidgetScaleVal = document.getElementById('quickWidgetScaleVal');
        if (quickWidgetScaleVal) quickWidgetScaleVal.innerText = str;

        const startMenuScaleValueBadge = document.getElementById('startMenuScaleValueBadge');
        if (startMenuScaleValueBadge) startMenuScaleValueBadge.innerText = str;

        // Синхронизация слайдеров
        const scaleSlider = document.getElementById('scaleSlider');
        if (scaleSlider && parseInt(scaleSlider.value, 10) !== pct) scaleSlider.value = String(pct);

        const startScaleSlider = document.getElementById('startScaleSlider');
        if (startScaleSlider && parseInt(startScaleSlider.value, 10) !== pct) startScaleSlider.value = String(pct);

        const dropdownScaleSlider = document.getElementById('dropdownScaleSlider');
        if (dropdownScaleSlider && parseInt(dropdownScaleSlider.value, 10) !== pct) dropdownScaleSlider.value = String(pct);

        const quickWidgetScaleSlider = document.getElementById('quickWidgetScaleSlider');
        if (quickWidgetScaleSlider && parseInt(quickWidgetScaleSlider.value, 10) !== pct) quickWidgetScaleSlider.value = String(pct);

        // Подсветка кнопок пресетов
        document.querySelectorAll('.btn-scale-preset').forEach(btn => {
            const btnVal = Math.round(parseFloat(btn.getAttribute('data-scale')) * 100);
            const active = btnVal === pct;
            btn.className = active
                ? 'btn-scale-preset active py-1 px-2 rounded-lg bg-blue-600 text-white font-semibold border border-blue-500 font-mono text-[11px] text-center transition-colors'
                : 'btn-scale-preset py-1 px-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-mono text-[11px] text-center transition-colors';
        });

        document.querySelectorAll('.btn-quick-scale').forEach(btn => {
            const btnVal = Math.round(parseFloat(btn.getAttribute('data-quickscale')) * 100);
            const active = btnVal === pct;
            btn.className = active
                ? 'btn-quick-scale py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] text-center font-bold transition-colors'
                : 'btn-quick-scale py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] text-center transition-colors';
        });

        if (showToast) {
            this.playSound('click');
            this.app._showToast(`🔍 Масштаб экрана: ${pct}%`);
        }
    }

    zoomIn() { this.applyZoom(this.zoomLevel + 0.1, true); }
    zoomOut() { this.applyZoom(this.zoomLevel - 0.1, true); }
    zoomReset() { this.applyZoom(1.0, true); }

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

    openCommandPalette() {
        const palette = document.getElementById('commandPaletteModal');
        const input = document.getElementById('paletteSearchInput');
        if (!palette || !input) return;
        palette.classList.remove('hidden');
        palette.classList.add('flex');
        input.value = '';
        input.focus();
        this._renderPaletteItems('');
        this.playSound('click');
    }

    closeCommandPalette() {
        const palette = document.getElementById('commandPaletteModal');
        if (!palette) return;
        palette.classList.add('hidden');
        palette.classList.remove('flex');
    }

    _initSpotlightPalette() {
        const palette = document.getElementById('commandPaletteModal');
        const input = document.getElementById('paletteSearchInput');
        const results = document.getElementById('paletteResultsList');
        if (!palette || !input || !results) return;

        // Горячая клавиша ⌘K / Ctrl+K
        window.addEventListener('keydown', (e) => {
            const isMod = e.metaKey || e.ctrlKey;
            if (isMod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (palette.classList.contains('hidden')) this.openCommandPalette();
                else this.closeCommandPalette();
            } else if (e.key === 'Escape' && !palette.classList.contains('hidden')) {
                this.closeCommandPalette();
            }
        });

        palette.addEventListener('click', (e) => {
            if (e.target === palette) this.closeCommandPalette();
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
        document.getElementById('btnOpenSpotlight')?.addEventListener('click', () => this.openCommandPalette());
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
            },
            {
                id: 'custom_wallpaper',
                title: 'Персонализация: Сменить тему и обои рабочего стола',
                shortcut: '',
                icon: '🎨',
                category: 'Рабочий стол',
                action: () => this.app.openSettingsTab('tabPersonalization')
            },
            {
                id: 'arrange_grid',
                title: 'Выровнять значки рабочего стола по сетке',
                shortcut: '',
                icon: '📐',
                category: 'Рабочий стол',
                action: () => this.arrangeIconsGrid()
            },
            {
                id: 'toggle_desktop_icons',
                title: 'Показать / скрыть значки на рабочем столе',
                shortcut: '',
                icon: '📱',
                category: 'Рабочий стол',
                action: () => {
                    const isHidden = document.body.classList.contains('desktop-icons-hidden');
                    this.toggleDesktopIcons(isHidden);
                }
            },
            {
                id: 'backup_export',
                title: 'Экспорт полной резервной копии сессии (JSON)',
                shortcut: '',
                icon: '💾',
                category: 'Хранилище',
                action: () => this.exportFullSessionBackup()
            },
            {
                id: 'cache_clear',
                title: 'Очистить кэш приложения и сбросить сессию',
                shortcut: '',
                icon: '🧹',
                category: 'Система',
                action: () => this.clearAppCache()
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

    // =========================================================================
    // 10. КАСТОМИЗАЦИЯ РАБОЧЕГО СТОЛА, ОБОИ, ЗНАЧКИ И СЕТКА
    // =========================================================================

    _initDesktopCustomization() {
        if (this.customWallpaper) {
            this.setCustomWallpaper(this.customWallpaper, false);
        } else {
            const storedWp = localStorage.getItem('pharmagate_wallpaper') || 'deep-space';
            this.setWallpaper(storedWp, false);
        }

        const storedSize = localStorage.getItem('pharmagate_icon_size') || 'md';
        this.setIconSize(storedSize, false);

        const storedVis = localStorage.getItem('pharmagate_icons_visible') !== 'false';
        this.toggleDesktopIcons(storedVis, false);

        const storedBlur = localStorage.getItem('pharmagate_blur_mode') || 'strong';
        this.setWindowBlur(storedBlur, false);

        // Привязка кликов по карточкам обоев в Настройках
        document.querySelectorAll('.wp-card').forEach(card => {
            card.addEventListener('click', () => {
                const wp = card.getAttribute('data-wp');
                if (wp) {
                    this.customWallpaper = '';
                    localStorage.removeItem('pharmagate_custom_wallpaper');
                    document.body.style.backgroundImage = '';
                    this.setWallpaper(wp, true);
                }
            });
        });

        // Привязка кастомных обоев (URL)
        const btnApplyWp = document.getElementById('btnApplyWallpaperUrl');
        const inputWpUrl = document.getElementById('inputCustomWallpaperUrl');
        if (btnApplyWp && inputWpUrl) {
            if (this.customWallpaper && !this.customWallpaper.startsWith('data:')) {
                inputWpUrl.value = this.customWallpaper;
            }
            btnApplyWp.addEventListener('click', () => {
                const url = inputWpUrl.value.trim();
                if (url) {
                    this.setCustomWallpaper(url, true);
                }
            });
        }

        // Привязка кастомных обоев (Загрузка файла)
        const inputFile = document.getElementById('inputCustomWallpaperFile');
        if (inputFile) {
            inputFile.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const dataUrl = evt.target?.result;
                    if (dataUrl) {
                        this.setCustomWallpaper(String(dataUrl), true);
                    }
                };
                reader.readAsDataURL(file);
            });
        }

        // Привязка кнопок размера значков
        document.getElementById('btnIconSizeSm')?.addEventListener('click', () => this.setIconSize('sm', true));
        document.getElementById('btnIconSizeMd')?.addEventListener('click', () => this.setIconSize('md', true));
        document.getElementById('btnIconSizeLg')?.addEventListener('click', () => this.setIconSize('lg', true));

        // Привязка чекбокса отображения значков
        document.getElementById('chkShowDesktopIcons')?.addEventListener('change', (e) => {
            this.toggleDesktopIcons(e.target.checked, true);
        });

        // Кнопка упорядочивания по сетке и сброса
        document.getElementById('btnArrangeGrid')?.addEventListener('click', () => this.arrangeIconsGrid());
        document.getElementById('btnResetIconPos')?.addEventListener('click', () => this.resetIconsPosition());

        // Привязка кнопок прозрачности окон (Акриловый блюр)
        document.querySelectorAll('.btn-blur-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                const blur = btn.getAttribute('data-blur');
                if (blur) this.setWindowBlur(blur, true);
            });
        });
    }

    setCustomWallpaper(urlOrData, showToast = true) {
        if (!urlOrData) return;
        this.customWallpaper = urlOrData;
        localStorage.setItem('pharmagate_custom_wallpaper', urlOrData);

        const validWps = ['deep-space', 'emerald', 'slate', 'aurora', 'amethyst', 'obsidian', 'light-minimal', 'cyber-grid', 'nebula'];
        validWps.forEach(w => document.body.classList.remove(`wp-${w}`));

        document.body.style.backgroundImage = `url("${urlOrData}")`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';

        // Снятие подсветки с пресетов
        document.querySelectorAll('.wp-card').forEach(c => {
            c.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/50');
            c.classList.add('border-slate-800');
            const badge = c.querySelector('.wp-badge');
            if (badge) badge.classList.add('hidden');
        });

        if (showToast) {
            this.playSound('success');
            this.app._showToast('🖼️ Собственные обои рабочего стола успешно установлены!');
        }
    }

    setWallpaper(wpId, showToast = true) {
        const validWps = ['deep-space', 'emerald', 'slate', 'aurora', 'amethyst', 'obsidian', 'light-minimal', 'cyber-grid', 'nebula'];
        if (!validWps.includes(wpId)) wpId = 'deep-space';

        this.customWallpaper = '';
        localStorage.removeItem('pharmagate_custom_wallpaper');
        document.body.style.backgroundImage = '';

        validWps.forEach(w => document.body.classList.remove(`wp-${w}`));
        document.body.classList.add(`wp-${wpId}`);
        localStorage.setItem('pharmagate_wallpaper', wpId);

        // Обновление бейджей и рамок карточек обоев
        document.querySelectorAll('.wp-card').forEach(card => {
            const match = card.getAttribute('data-wp') === wpId;
            card.classList.toggle('border-blue-500', match);
            card.classList.toggle('ring-2', match);
            card.classList.toggle('ring-blue-500/50', match);
            card.classList.toggle('border-slate-800', !match);
            const badge = card.querySelector('.wp-badge');
            if (badge) badge.classList.toggle('hidden', !match);
        });

        if (showToast) {
            this.playSound('click');
            const names = {
                'deep-space': 'Глубокий Космос',
                'emerald': 'Изумрудный Фарм',
                'slate': 'Кибер-Агат',
                'aurora': 'Северное Сияние',
                'amethyst': 'Аметистовая Ночь',
                'obsidian': 'Чистый Обсидиан',
                'light-minimal': 'Светлый Минимал',
                'cyber-grid': 'Кибер-Сетка',
                'nebula': 'Туманность'
            };
            this.app._showToast(`🎨 Обои рабочего стола: ${names[wpId] || wpId}`);
        }
    }

    setIconSize(size, showToast = true) {
        const valid = ['sm', 'md', 'lg'];
        if (!valid.includes(size)) size = 'md';

        valid.forEach(s => document.body.classList.remove(`desktop-icons-${s}`));
        document.body.classList.add(`desktop-icons-${size}`);
        localStorage.setItem('pharmagate_icon_size', size);

        const btnSm = document.getElementById('btnIconSizeSm');
        const btnMd = document.getElementById('btnIconSizeMd');
        const btnLg = document.getElementById('btnIconSizeLg');
        const activeCls = 'flex-1 py-1 text-center rounded bg-blue-600 text-white font-semibold transition-colors';
        const normCls = 'flex-1 py-1 text-center rounded text-slate-300 hover:text-white transition-colors';

        if (btnSm) btnSm.className = size === 'sm' ? activeCls : normCls;
        if (btnMd) btnMd.className = size === 'md' ? activeCls : normCls;
        if (btnLg) btnLg.className = size === 'lg' ? activeCls : normCls;

        if (showToast) {
            this.playSound('click');
            const map = { sm: 'Маленькие', md: 'Средние', lg: 'Крупные' };
            this.app._showToast(`📱 Размер значков: ${map[size]}`);
        }
    }

    toggleDesktopIcons(visible, showToast = true) {
        const isVis = visible !== undefined ? Boolean(visible) : document.body.classList.contains('desktop-icons-hidden');
        if (isVis) {
            document.body.classList.remove('desktop-icons-hidden');
            localStorage.setItem('pharmagate_icons_visible', 'true');
        } else {
            document.body.classList.add('desktop-icons-hidden');
            localStorage.setItem('pharmagate_icons_visible', 'false');
        }

        const chk = document.getElementById('chkShowDesktopIcons');
        if (chk) chk.checked = isVis;

        if (showToast) {
            this.playSound('click');
            this.app._showToast(isVis ? '👁️ Значки рабочего стола включены' : '🙈 Значки рабочего стола скрыты');
        }
    }

    setWindowBlur(mode, showToast = true) {
        document.body.classList.remove('win-blur-strong', 'win-blur-none');
        if (mode === 'strong') document.body.classList.add('win-blur-strong');
        else if (mode === 'none') document.body.classList.add('win-blur-none');
        localStorage.setItem('pharmagate_blur_mode', mode);

        document.querySelectorAll('.btn-blur-mode').forEach(btn => {
            const match = btn.getAttribute('data-blur') === mode;
            if (match) {
                btn.className = 'btn-blur-mode py-1.5 px-2 rounded-lg bg-blue-600 text-white font-semibold border border-blue-500 text-center text-xs';
            } else {
                btn.className = 'btn-blur-mode py-1.5 px-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-center text-xs';
            }
        });

        if (showToast) {
            this.playSound('click');
            const map = { strong: 'Высокая (36px)', standard: 'Стандарт (28px)', none: 'Без размытия (Solid)' };
            this.app._showToast(`🪟 Прозрачность окон: ${map[mode] || mode}`);
        }
    }

    arrangeIconsGrid() {
        const desktop = document.getElementById('desktopArea');
        const icons = document.querySelectorAll('.desktop-icon');
        if (!desktop || !icons.length) return;

        const iconWidth = 104;
        const iconHeight = 100;
        const startX = 20;
        const startY = 20;
        const maxRows = Math.max(1, Math.floor((desktop.clientHeight - 80) / iconHeight));
        const savedPositions = {};

        icons.forEach((icon, index) => {
            const col = Math.floor(index / maxRows);
            const row = index % maxRows;
            const x = startX + col * iconWidth;
            const y = startY + row * iconHeight;

            icon.style.transition = 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1), top 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
            icon.style.left = `${x}px`;
            icon.style.top = `${y}px`;

            const appTarget = icon.getAttribute('data-app');
            if (appTarget) savedPositions[appTarget] = { x, y };

            setTimeout(() => {
                icon.style.transition = '';
            }, 300);
        });

        localStorage.setItem('pharmagate_icons_pos', JSON.stringify(savedPositions));
        this.playSound('click');
        this.app._showToast('📐 Значки рабочего стола упорядочены по сетке!');
    }

    resetIconsPosition() {
        localStorage.removeItem('pharmagate_icons_pos');
        this.arrangeIconsGrid();
        this.app._showToast('🔄 Расположение значков сброшено по умолчанию');
    }

    // =========================================================================
    // 11. КОНТЕКСТНОЕ МЕНЮ РАБОЧЕГО СТОЛА (DESKTOP CONTEXT MENU)
    // =========================================================================

    _initDesktopContextMenu() {
        const ctxMenu = document.getElementById('desktopContextMenu');
        const desktopArea = document.getElementById('desktopArea');
        if (!ctxMenu || !desktopArea) return;

        const hideMenu = () => {
            ctxMenu.classList.add('hidden');
        };

        // Слушатель клика правой кнопкой мыши по рабочему столу
        desktopArea.addEventListener('contextmenu', (e) => {
            // Если клик внутри открытого окна или таскбара - не перехватывать
            if (e.target.closest('.os-window') || e.target.closest('#taskbar') || e.target.closest('#startMenu')) {
                return;
            }

            e.preventDefault();
            this.playSound('click');

            const menuWidth = 230;
            const menuHeight = 310;
            const maxLeft = window.innerWidth - menuWidth - 10;
            const maxTop = window.innerHeight - menuHeight - 50;

            const left = Math.max(10, Math.min(maxLeft, e.clientX));
            const top = Math.max(10, Math.min(maxTop, e.clientY));

            ctxMenu.style.left = `${left}px`;
            ctxMenu.style.top = `${top}px`;
            ctxMenu.classList.remove('hidden');
        });

        // Закрытие при клике мимо меню
        document.addEventListener('click', (e) => {
            if (!ctxMenu.contains(e.target)) hideMenu();
        });

        // Закрытие при нажатии Escape
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !ctxMenu.classList.contains('hidden')) {
                hideMenu();
            }
        });

        // Привязка обработчиков пунктов меню
        document.getElementById('ctxRefreshDesktop')?.addEventListener('click', () => {
            hideMenu();
            this.playSound('click');
            this.app._showToast('🔄 Рабочий стол обновлен');
        });

        document.getElementById('ctxArrangeGrid')?.addEventListener('click', () => {
            hideMenu();
            this.arrangeIconsGrid();
        });

        document.getElementById('ctxToggleIcons')?.addEventListener('click', () => {
            hideMenu();
            const isHidden = document.body.classList.contains('desktop-icons-hidden');
            this.toggleDesktopIcons(isHidden);
        });

        document.getElementById('ctxDemoInvoice')?.addEventListener('click', () => {
            hideMenu();
            this.generateDemoPharmaInvoice(50);
        });

        document.getElementById('ctxNewInvoice')?.addEventListener('click', () => {
            hideMenu();
            this.app.openApp('winWizard');
        });

        document.getElementById('ctxAutoRepair')?.addEventListener('click', () => {
            hideMenu();
            this.app._autoRepairAllErrors?.();
        });

        document.getElementById('ctxScaleMenu')?.addEventListener('click', () => {
            hideMenu();
            this.app.openSettingsTab('tabPersonalization');
            this.playSound('click');
        });

        document.getElementById('ctxLiteMode')?.addEventListener('click', () => {
            hideMenu();
            this.setLiteMode(!this.liteModeEnabled, true);
        });

        document.getElementById('ctxPersonalization')?.addEventListener('click', () => {
            hideMenu();
            this.app.openSettingsTab('tabPersonalization');
        });

        document.getElementById('ctxOpenSettings')?.addEventListener('click', () => {
            hideMenu();
            this.app.openApp('winSettings');
        });

        document.getElementById('ctxFullscreen')?.addEventListener('click', () => {
            hideMenu();
            this.toggleFullscreen();
        });
    }

    // =========================================================================
    // 12. ЭКСПОРТ РЕЗЕРВНОЙ КОПИИ И СБРОС КЭША
    // =========================================================================

    exportFullSessionBackup() {
        const backup = {
            app_id: 'pharmagate_webos_2026',
            version: '2026.4 LTS Pro',
            exported_at: new Date().toISOString(),
            platform: {
                detectedOs: this.detectedOs,
                osPersona: this.configuredOs,
                lineEnding: this.activeLineEnding,
                encoding: this.activeEncoding,
                wallpaper: localStorage.getItem('pharmagate_wallpaper') || 'deep-space',
                iconSize: localStorage.getItem('pharmagate_icon_size') || 'md',
                blurMode: localStorage.getItem('pharmagate_blur_mode') || 'strong'
            },
            dataset: {
                fileName: this.app.activeFileName,
                metaHeader: this.app.metaHeader,
                recordsCount: this.app.records?.length || 0,
                records: this.app.records,
                schema: this.app.schema
            },
            desktopIconsPositions: JSON.parse(localStorage.getItem('pharmagate_icons_pos') || '{}')
        };

        const str = JSON.stringify(backup, null, 2);
        const blob = new Blob([str], { type: 'application/json' });
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `PharmaGate_Session_Backup_${dateStr}.json`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.playSound('success');
        this.app._showToast(`💾 Полная резервная копия экспортирована: ${filename}`);
    }

    // =========================================================================
    // 13. ТЕМЫ ОФОРМЛЕНИЯ И АКЦЕНТНЫЕ ЦВЕТА
    // =========================================================================

    _initThemeAndAccentControls() {
        this.setTheme(this.activeTheme, false);
        this.setAccentColor(this.accentColor, false);

        // Привязка карточек тем в Центре Настроек
        document.querySelectorAll('.theme-card').forEach(card => {
            card.addEventListener('click', () => {
                const theme = card.getAttribute('data-theme');
                if (theme) this.setTheme(theme, true);
            });
        });

        // Привязка кнопок акцентных цветов
        document.querySelectorAll('.btn-accent-color').forEach(btn => {
            btn.addEventListener('click', () => {
                const accent = btn.getAttribute('data-accent');
                if (accent) this.setAccentColor(accent, true);
            });
        });
    }

    setTheme(themeId, showToast = true) {
        const validThemes = ['fluent-dark', 'macos', 'pharma-light', 'cyber-matrix', 'retro-win95', 'midnight-nebula'];
        if (!validThemes.includes(themeId)) themeId = 'fluent-dark';

        this.activeTheme = themeId;
        localStorage.setItem('pharmagate_theme', themeId);

        validThemes.forEach(t => document.documentElement.classList.remove(`theme-${t}`));
        document.documentElement.classList.add(`theme-${themeId}`);

        // Обновление карточек тем в интерфейсе
        document.querySelectorAll('.theme-card').forEach(card => {
            const match = card.getAttribute('data-theme') === themeId;
            card.classList.toggle('border-blue-500', match);
            card.classList.toggle('border-2', match);
            card.classList.toggle('ring-2', match);
            card.classList.toggle('ring-blue-500/40', match);
            card.classList.toggle('border-slate-800', !match);
            const badge = card.querySelector('.theme-badge');
            if (badge) badge.classList.toggle('hidden', !match);
        });

        const activeBadge = document.getElementById('activeThemeBadge');
        const themeNames = {
            'fluent-dark': 'Fluent Dark',
            'macos': 'macOS Glass',
            'pharma-light': 'Pharma Light',
            'cyber-matrix': 'Matrix Terminal',
            'retro-win95': 'Win95 / 2000',
            'midnight-nebula': 'Midnight Nebula'
        };
        if (activeBadge) activeBadge.innerText = themeNames[themeId] || themeId;

        const quickThemeBadge = document.getElementById('quickWidgetThemeBadge');
        if (quickThemeBadge) quickThemeBadge.innerText = themeNames[themeId] || themeId;

        document.querySelectorAll('.btn-quick-theme').forEach(btn => {
            const isSel = btn.getAttribute('data-theme') === themeId;
            btn.classList.toggle('border-blue-500', isSel);
            btn.classList.toggle('bg-blue-600/30', isSel);
            btn.classList.toggle('text-white', isSel);
        });

        // Если выбрана macOS тема - включаем macOS стиль кнопок окон
        if (themeId === 'macos' && this.configuredOs !== 'macos') {
            this.setOsPersona('macos');
        } else if (themeId === 'retro-win95' && this.configuredOs !== 'windows') {
            this.setOsPersona('windows');
        }

        if (showToast) {
            this.playSound('click');
            this.app._showToast(`🎨 Тема оформления: ${themeNames[themeId] || themeId}`);
        }
    }

    setAccentColor(accentId, showToast = true) {
        const accents = {
            blue: { hex: '#2563eb', hover: '#1d4ed8', rgb: '37, 99, 235', name: 'Сапфировый Синий' },
            emerald: { hex: '#059669', hover: '#047857', rgb: '5, 150, 105', name: 'Изумрудный' },
            violet: { hex: '#7c3aed', hover: '#6d28d9', rgb: '124, 58, 237', name: 'Аметистовый Фиолет' },
            amber: { hex: '#d97706', hover: '#b45309', rgb: '217, 119, 6', name: 'Янтарный' },
            rose: { hex: '#e11d48', hover: '#be123c', rgb: '225, 29, 72', name: 'Рубиновый' },
            cyan: { hex: '#0891b2', hover: '#0e7490', rgb: '8, 145, 178', name: 'Морская Бирюза' }
        };

        const acc = accents[accentId] || accents.blue;
        this.accentColor = accentId;
        localStorage.setItem('pharmagate_accent', accentId);

        document.documentElement.style.setProperty('--color-accent', acc.hex);
        document.documentElement.style.setProperty('--color-accent-hover', acc.hover);
        document.documentElement.style.setProperty('--color-accent-rgb', acc.rgb);

        document.querySelectorAll('.btn-accent-color').forEach(btn => {
            const match = btn.getAttribute('data-accent') === accentId;
            btn.classList.toggle('border-blue-500', match);
            btn.classList.toggle('border-2', match);
            btn.classList.toggle('scale-105', match);
            btn.classList.toggle('border-slate-800', !match);
        });

        if (showToast) {
            this.playSound('click');
            this.app._showToast(`🎨 Акцентный цвет: ${acc.name}`);
        }
    }

    // =========================================================================
    // 14. УПРОЩЕННЫЙ РЕЖИМ ДЛЯ МЕДЛЕННОГО ПОДКЛЮЧЕНИЯ (LITE SPEED MODE)
    // =========================================================================

    _initLiteMode() {
        this.setLiteMode(this.liteModeEnabled, false);

        // Чекбокс включения Lite-mode в Настройках
        const chkLiteMode = document.getElementById('chkLiteMode');
        if (chkLiteMode) {
            chkLiteMode.checked = this.liteModeEnabled;
            chkLiteMode.addEventListener('change', (e) => {
                localStorage.setItem('pharmagate_lite_mode_user_forced', 'true');
                this.setLiteMode(e.target.checked, true);
            });
        }

        // Чекбокс автоматического включения при медленной сети
        const chkAutoLiteMode = document.getElementById('chkAutoLiteMode');
        if (chkAutoLiteMode) {
            chkAutoLiteMode.checked = this.autoLiteMode;
            chkAutoLiteMode.addEventListener('change', (e) => {
                this.autoLiteMode = e.target.checked;
                localStorage.setItem('pharmagate_auto_lite_mode', String(this.autoLiteMode));
                this._checkNetworkConnectionSpeed();
            });
        }

        // Кнопка быстрого переключения в трее панели задач
        const btnTaskbarLite = document.getElementById('btnTaskbarLiteMode');
        if (btnTaskbarLite) {
            btnTaskbarLite.addEventListener('click', () => {
                localStorage.setItem('pharmagate_lite_mode_user_forced', 'true');
                this.setLiteMode(!this.liteModeEnabled, true);
            });
        }

        this._checkNetworkConnectionSpeed();
    }

    setLiteMode(enabled, showToast = true) {
        this.liteModeEnabled = Boolean(enabled);
        localStorage.setItem('pharmagate_lite_mode', String(this.liteModeEnabled));

        document.documentElement.classList.toggle('lite-mode', this.liteModeEnabled);
        document.body.classList.toggle('lite-mode', this.liteModeEnabled);

        // Обновление чекбокса в настройках
        const chkLiteMode = document.getElementById('chkLiteMode');
        if (chkLiteMode) chkLiteMode.checked = this.liteModeEnabled;

        // Обновление бейджа статуса
        const badge = document.getElementById('liteModeBadge');
        if (badge) {
            badge.innerText = this.liteModeEnabled ? '⚡ Активен (Lite Speed)' : 'Отключен';
            badge.className = this.liteModeEnabled
                ? 'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px]'
                : 'px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]';
        }

        const btnQuickWidgetLite = document.getElementById('btnQuickWidgetToggleLite');
        if (btnQuickWidgetLite) {
            btnQuickWidgetLite.innerText = this.liteModeEnabled ? 'Включен ✓' : 'Включить';
            btnQuickWidgetLite.className = this.liteModeEnabled
                ? 'px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] transition-colors shadow'
                : 'px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition-colors shadow';
        }

        // Обновление кнопки в трее таскбара
        const taskbarIcon = document.getElementById('taskbarLiteIcon');
        const taskbarLabel = document.getElementById('taskbarLiteLabel');
        const btnTaskbarLite = document.getElementById('btnTaskbarLiteMode');

        if (taskbarIcon) taskbarIcon.innerText = this.liteModeEnabled ? '⚡' : '💎';
        if (taskbarLabel) taskbarLabel.innerText = this.liteModeEnabled ? 'Lite' : 'Full';
        if (btnTaskbarLite) {
            if (this.liteModeEnabled) {
                btnTaskbarLite.className = 'flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-500/60 text-[11px] cursor-pointer transition-colors shadow-sm shadow-amber-500/20';
            } else {
                btnTaskbarLite.className = 'flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#090d16] hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] cursor-pointer transition-colors';
            }
        }

        // Тюнинг буфера таблицы при активном Lite режиме
        if (this.app?.mainGrid?.tabulatorInstance) {
            try {
                if (this.liteModeEnabled) {
                    this.app.mainGrid.tabulatorInstance.setRenderMode('virtual');
                }
            } catch (err) {}
        }

        if (showToast) {
            this.playSound(this.liteModeEnabled ? 'warning' : 'success');
            if (this.liteModeEnabled) {
                this.app._showToast('⚡ Упрощенный режим (Lite Speed) включен: блюр и тяжелые анимации отключены!');
            } else {
                this.app._showToast('💎 Полный графический режим включен (Acrylic Glass, тени и сглаживание)');
            }
        }
    }

    _checkNetworkConnectionSpeed() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const speedBadge = document.getElementById('detectedConnectionSpeedBadge');

        if (!conn) {
            if (speedBadge) speedBadge.innerText = 'Сеть: Стандарт (Ethernet/WiFi)';
            return;
        }

        const isSlow = conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType) || (conn.rtt && conn.rtt > 400);
        const netType = conn.effectiveType ? conn.effectiveType.toUpperCase() : '4G';
        const downlink = conn.downlink ? `${conn.downlink} Mbps` : '';

        if (speedBadge) {
            speedBadge.innerText = `Сеть: ${netType} ${downlink ? `(${downlink})` : ''} · ${isSlow ? '⚠️ Медленная' : 'Быстрая'}`;
            speedBadge.className = isSlow
                ? 'font-mono text-[10px] text-amber-400 font-semibold'
                : 'font-mono text-[10px] text-emerald-400';
        }

        const userForced = localStorage.getItem('pharmagate_lite_mode_user_forced');
        if (isSlow && this.autoLiteMode && !userForced && !this.liteModeEnabled) {
            this.setLiteMode(true, true);
            this.app._showToast(`⚡ Обнаружена медленная сеть (${netType}). Автоматически активирован упрощенный режим (Lite Mode).`);
        }

        conn.addEventListener?.('change', () => this._checkNetworkConnectionSpeed());
    }

    // =========================================================================
    // 15. МАСШТАБИРОВАНИЕ ЭКРАНА, ПРОЦЕНТНЫЙ МАСШТАБ И AUTO-DPI
    // =========================================================================

    _initScaleAndDpiControls() {
        // Слайдер масштаба в Настройках
        const slider = document.getElementById('scaleSlider');
        if (slider) {
            slider.value = String(Math.round(this.zoomLevel * 100));
            slider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) / 100;
                this.applyZoom(val, false);
            });
            slider.addEventListener('change', () => {
                this.playSound('click');
                this.app._showToast(`🔍 Масштаб экрана: ${Math.round(this.zoomLevel * 100)}%`);
            });
        }

        // Слайдер в выпадающем меню таскбара
        const dropdownSlider = document.getElementById('dropdownScaleSlider');
        if (dropdownSlider) {
            dropdownSlider.value = String(Math.round(this.zoomLevel * 100));
            dropdownSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) / 100;
                this.applyZoom(val, false);
            });
        }

        // Кнопки пресетов масштаба в Настройках
        document.querySelectorAll('.btn-scale-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = parseFloat(btn.getAttribute('data-scale'));
                if (!isNaN(s)) {
                    this.applyZoom(s, true);
                }
            });
        });

        // Кнопки быстрого масштаба в выпадающем меню таскбара
        document.querySelectorAll('.btn-quick-scale').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = parseFloat(btn.getAttribute('data-quickscale'));
                if (!isNaN(s)) {
                    this.applyZoom(s, true);
                }
            });
        });

        // Чекбоксы Auto-DPI
        const chkAutoDpi = document.getElementById('chkAutoDpi');
        const dropdownChkAutoDpi = document.getElementById('dropdownChkAutoDpi');
        if (chkAutoDpi) {
            chkAutoDpi.checked = this.autoDpiEnabled;
            chkAutoDpi.addEventListener('change', (e) => {
                this.setAutoDpi(e.target.checked, true);
            });
        }
        if (dropdownChkAutoDpi) {
            dropdownChkAutoDpi.checked = this.autoDpiEnabled;
            dropdownChkAutoDpi.addEventListener('change', (e) => {
                this.setAutoDpi(e.target.checked, true);
            });
        }

        // Открытие/закрытие мини-меню масштабирования
        const trigger = document.getElementById('btnScaleMenuTrigger');
        const dropdown = document.getElementById('quickScaleDropdown');
        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
                this.playSound('click');
            });
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && e.target !== trigger) {
                    dropdown.classList.add('hidden');
                }
            });
        }

        // Слушатель изменения размера окна браузера
        window.addEventListener('resize', () => {
            this._updateResolutionIndicators();
            if (this.autoDpiEnabled) {
                this._checkAutoDpiScale(false);
            }
        });

        this._updateResolutionIndicators();
        if (this.autoDpiEnabled) {
            this._checkAutoDpiScale(false);
        } else {
            this.applyZoom(this.zoomLevel, false);
        }
    }

    _updateResolutionIndicators() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        const str = `${w}×${h} (${dpr.toFixed(1)}x)`;

        const currentDpiIndicator = document.getElementById('currentDpiIndicator');
        if (currentDpiIndicator) currentDpiIndicator.innerText = str;

        const dropdownDpiBadge = document.getElementById('dropdownDpiBadge');
        if (dropdownDpiBadge) dropdownDpiBadge.innerText = str;
    }

    setAutoDpi(enabled, showToast = true) {
        this.autoDpiEnabled = Boolean(enabled);
        localStorage.setItem('pharmagate_auto_dpi', String(this.autoDpiEnabled));

        const chkAutoDpi = document.getElementById('chkAutoDpi');
        const dropdownChkAutoDpi = document.getElementById('dropdownChkAutoDpi');
        const chkQuickWidgetAutoDpi = document.getElementById('chkQuickWidgetAutoDpi');
        if (chkAutoDpi) chkAutoDpi.checked = this.autoDpiEnabled;
        if (dropdownChkAutoDpi) dropdownChkAutoDpi.checked = this.autoDpiEnabled;
        if (chkQuickWidgetAutoDpi) chkQuickWidgetAutoDpi.checked = this.autoDpiEnabled;

        const badge = document.getElementById('autoDpiStatusBadge');
        if (badge) {
            badge.innerText = this.autoDpiEnabled ? 'Вкл (Авто)' : 'Выкл';
            badge.className = this.autoDpiEnabled
                ? 'text-[10px] px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 font-mono border border-blue-500/40'
                : 'text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono';
        }

        if (this.autoDpiEnabled) {
            this._checkAutoDpiScale(showToast);
        } else {
            if (showToast) {
                this.playSound('click');
                this.app._showToast('🔍 Авто-масштабирование Auto-DPI отключено');
            }
        }
    }

    _checkAutoDpiScale(showToast = false) {
        const w = window.innerWidth;
        const dpr = window.devicePixelRatio || 1;
        let recommendedScale = 1.0;

        if (w >= 2560 || dpr >= 2.0) {
            recommendedScale = 1.25; // 4K / Ultra-wide / Retina
        } else if (w >= 1920) {
            recommendedScale = 1.0;  // Full HD
        } else if (w >= 1440) {
            recommendedScale = 0.95; // 1440x900 laptops
        } else if (w >= 1280) {
            recommendedScale = 0.90; // 1366x768 classic laptops
        } else if (w >= 1024) {
            recommendedScale = 0.85; // tablets / small screens
        } else {
            recommendedScale = 0.75; // mobile / small viewports
        }

        this.applyZoom(recommendedScale, false);

        if (showToast) {
            this.playSound('success');
            this.app._showToast(`🔍 Auto-DPI: подобран масштаб ${Math.round(recommendedScale * 100)}% под экран ${w}px`);
        }
    }

    clearAppCache() {
        if (!confirm('Вы уверены, что хотите очистить кэш приложения, сбросить настройки и перезагрузить PharmaGate WebOS?')) {
            return;
        }
        localStorage.clear();
        sessionStorage.clear();
        this.playSound('error');
        this.app._showToast('🧹 Кэш очищен. Перезагрузка...');
        setTimeout(() => location.reload(), 600);
    }

    // =========================================================================
    // 16. БЫСТРЫЙ ВИДЖЕТ КАСТОМИЗАЦИИ НА РАБОЧЕМ СТОЛЕ
    // =========================================================================

    _initDesktopQuickWidget() {
        // Темы
        document.querySelectorAll('.btn-quick-theme').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.getAttribute('data-theme');
                if (theme) this.setTheme(theme, true);
            });
        });

        // Масштабирование - / +
        document.getElementById('btnQuickWidgetScaleMinus')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('btnQuickWidgetScalePlus')?.addEventListener('click', () => this.zoomIn());

        // Слайдер масштаба
        const slider = document.getElementById('quickWidgetScaleSlider');
        if (slider) {
            slider.value = String(Math.round(this.zoomLevel * 100));
            slider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                this.applyZoom(val / 100, false);
            });
            slider.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                this.applyZoom(val / 100, true);
            });
        }

        // Auto-DPI чекбокс
        const chkAuto = document.getElementById('chkQuickWidgetAutoDpi');
        if (chkAuto) {
            chkAuto.checked = this.autoDpiEnabled;
            chkAuto.addEventListener('change', (e) => this.setAutoDpi(e.target.checked, true));
        }

        // Сброс на 100%
        document.getElementById('btnQuickWidgetScaleReset')?.addEventListener('click', () => this.applyZoom(1.0, true));

        // Кнопка Lite Mode
        document.getElementById('btnQuickWidgetToggleLite')?.addEventListener('click', () => {
            localStorage.setItem('pharmagate_lite_mode_user_forced', 'true');
            this.setLiteMode(!this.liteModeEnabled, true);
        });

        // Кнопка перехода ко всем настройкам
        document.getElementById('btnQuickWidgetOpenSettings')?.addEventListener('click', () => {
            this.app?.openSettingsTab('tabPersonalization');
        });

        // Свернуть / развернуть виджет
        const btnToggle = document.getElementById('btnToggleQuickWidget');
        const content = document.getElementById('quickWidgetContent');
        const widget = document.getElementById('desktopQuickWidget');
        if (btnToggle && content && widget) {
            let isMin = localStorage.getItem('pharmagate_widget_min') === 'true';
            const updateMinState = () => {
                content.style.display = isMin ? 'none' : 'block';
                btnToggle.innerText = isMin ? '+' : '_';
                widget.style.width = isMin ? '240px' : '320px';
            };
            updateMinState();
            btnToggle.addEventListener('click', () => {
                isMin = !isMin;
                localStorage.setItem('pharmagate_widget_min', String(isMin));
                updateMinState();
            });
        }

        // Первичная синхронизация
        const quickThemeBadge = document.getElementById('quickWidgetThemeBadge');
        const themeNames = {
            'fluent-dark': 'Fluent Dark',
            'macos': 'macOS Glass',
            'pharma-light': 'Pharma Light',
            'cyber-matrix': 'Matrix Terminal',
            'retro-win95': 'Win95 / 2000',
            'midnight-nebula': 'Midnight Nebula'
        };
        if (quickThemeBadge) quickThemeBadge.innerText = themeNames[this.activeTheme] || this.activeTheme;

        const quickWidgetScaleVal = document.getElementById('quickWidgetScaleVal');
        if (quickWidgetScaleVal) quickWidgetScaleVal.innerText = `${Math.round(this.zoomLevel * 100)}%`;

        const btnQuickWidgetLite = document.getElementById('btnQuickWidgetToggleLite');
        if (btnQuickWidgetLite) {
            btnQuickWidgetLite.innerText = this.liteModeEnabled ? 'Включен ✓' : 'Включить';
            btnQuickWidgetLite.className = this.liteModeEnabled
                ? 'px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] transition-colors shadow'
                : 'px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition-colors shadow';
        }
    }
}
