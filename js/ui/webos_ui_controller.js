/**
 * js/ui/webos_ui_controller.js - Визуальный контроллер и движок окружения WebOS
 * 
 * Включает:
 * 1. 🪟 Физика и микро-анимации окон (плавное открытие, сворачивание в док, максимизация, double-click заголовок)
 * 2. 🖱️ Лассо-выделение рабочего стола (Desktop Marquee Selection) мышью и тачем
 * 3. 🎛️ Центр Управления WebOS (Control Center & Quick Settings) — ползунки громкости, DPI, темы, обои, ОС
 * 4. 🔒 Экран блокировки WebOS (Lock Screen) — часы, аватар провизора, разблокировка (Win+L / Space)
 * 5. 🔍 Быстрый виджет проверки КИЗ и штрихкодов Честный ЗНАК / EAN-13 прямо на рабочем столе
 * 6. 📝 Цветные стикеры-заметки (Sticky Notes) с автосохранением и палитрой
 * 7. 🚀 Центрированный Док и умные индикаторы активных приложений на панели задач
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
        this.isDockCentered = safeGet('pharmagate_dock_centered') === 'true';
    }

    init() {
        this._patchWindowLifecycle();
        this._initDesktopMarquee();
        this._initControlCenter();
        this._initLockScreen();
        this._initBarcodeGadget();
        this._initStickyNotesGadget();
        this._initDockCenterToggle();
        this._enhanceTaskbar();
        this._bindGlobalOsShortcuts();
        console.log("[WebOsUiController] Визуальная система WebOS успешно запущена.");
    }

    // =========================================================================
    // 1. ПЛАВНАЯ ФИЗИКА И АНИМАЦИИ ОКОН
    // =========================================================================

    _patchWindowLifecycle() {
        const app = this.app;
        if (!app) return;

        // Патч открытия окна со spring-анимацией
        const origOpen = app.openApp?.bind(app);
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

            const wasMinimized = win.classList.contains('minimized');
            win.classList.remove('minimized');
            app.focusWindow?.(winId);

            if (wasMinimized) {
                win.classList.add('win-opening');
                setTimeout(() => {
                    win.classList.remove('win-opening');
                }, 260);
                app.crossPlatform?.playSound?.('window_open');
            }

            app._updateTaskbar?.();
            app._redrawWindowContents?.(winId);
        };

        // Патч сворачивания окна с полетом вниз
        app.closeApp = (winId) => {
            const win = typeof document !== 'undefined' ? document.getElementById(winId) : null;
            if (!win || win.classList.contains('minimized')) return;

            win.classList.add('win-minimizing');
            app.crossPlatform?.playSound?.('window_close');

            setTimeout(() => {
                win.classList.add('minimized');
                win.classList.remove('win-minimizing');
                app._updateTaskbar?.();
            }, 180);
        };

        app.minimizeApp = (winId) => {
            app.closeApp(winId);
        };

        // Патч максимизации окна с переключением глифа
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

        // Улучшение заголовков всех окон: double-click для максимизации и сглаживание перетаскивания
        document.querySelectorAll('.os-window').forEach(win => {
            const header = win.querySelector('.win-header');
            if (!header) return;

            header.addEventListener('dblclick', (e) => {
                if (e.target.closest('button, input, select, textarea')) return;
                app.maximizeApp(win.id);
            });

            header.addEventListener('pointerdown', () => {
                win.classList.add('is-dragging');
            });
            window.addEventListener('pointerup', () => {
                win.classList.remove('is-dragging');
            });
        });
    }

    // =========================================================================
    // 2. ЛАССО-ВЫДЕЛЕНИЕ ЗНАЧКОВ РАБОЧЕГО СТОЛА (MARQUEE SELECTION)
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
            if (e.target.closest('.os-window, #taskbar, #startMenu, .desktop-gadget, #desktopQuickWidget, #desktopContextMenu, #controlCenterModal, #timeFlyoutModal')) {
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

    // =========================================================================
    // 3. ЦЕНТР УПРАВЛЕНИЯ WEBOS (CONTROL CENTER & QUICK SETTINGS)
    // =========================================================================

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

        // 1. Ползунок громкости звуков Web Audio
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

        // 2. Ползунок масштабирования DPI
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

        // 3. Ползунок прозрачности окон (Блюр/Акрил)
        const blurSelect = document.getElementById('ccBlurSelect');
        if (blurSelect) {
            blurSelect.value = safeGet('pharmagate_blur_mode', 'strong');
            blurSelect.addEventListener('change', (e) => {
                this.app?.crossPlatform?.setWindowBlur?.(e.target.value, true);
            });
        }

        // 4. Чипы выбора тем оформления
        modal.querySelectorAll('.cc-theme-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const theme = chip.getAttribute('data-theme');
                if (theme && this.app?.crossPlatform) {
                    this.app.crossPlatform.setTheme?.(theme, true);
                    this._syncControlCenterThemeChips(theme);
                }
            });
        });

        // 5. Чипы выбора персоны ОС
        modal.querySelectorAll('.cc-os-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const os = chip.getAttribute('data-os');
                if (os && this.app?.crossPlatform) {
                    this.app.crossPlatform.setOsPersona?.(os);
                    this._syncControlCenterOsChips(os);
                }
            });
        });

        // 6. Быстрые переключатели: Lite Mode, Fullscreen, Lock, PWA
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

        // 7. Мини-карусель обоев рабочего стола
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
        if (isHidden) {
            this.openControlCenter();
        } else {
            this.closeControlCenter();
        }
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
        const modal = document.getElementById('controlCenterModal');
        if (!modal) return;

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

    // =========================================================================
    // 4. ЭКРАН БЛОКИРОВКИ WEBOS (LOCK SCREEN)
    // =========================================================================

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

    // =========================================================================
    // 5. БЫСТРЫЙ ВИДЖЕТ ПРОВЕРКИ КИЗ И ШТРИХКОДОВ НА РАБОЧЕМ СТОЛЕ
    // =========================================================================

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

            // 1. Проверяем как DataMatrix Честный ЗНАК
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

            // 2. Проверяем как EAN-13
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

    // =========================================================================
    // 6. ЦВЕТНЫЕ СТИКЕРЫ-ЗАМЕТКИ (STICKY NOTES GADGET)
    // =========================================================================

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

    // =========================================================================
    // 7. ДОК И УМНЫЕ ИНДИКАТОРЫ ПАНЕЛИ ЗАДАЧ
    // =========================================================================

    _initDockCenterToggle() {
        if (typeof document === 'undefined') return;
        if (this.isDockCentered) {
            document.body.classList.add('dock-centered');
        }

        document.getElementById('btnToggleDockCenter')?.addEventListener('click', () => {
            this.isDockCentered = !this.isDockCentered;
            document.body.classList.toggle('dock-centered', this.isDockCentered);
            safeSet('pharmagate_dock_centered', String(this.isDockCentered));
            this.app?.crossPlatform?.playSound?.('click');
            this.app?._showToast?.(this.isDockCentered ? '📌 Док приложений центрирован' : '📌 Док приложений прижат влево');
        });
    }

    _enhanceTaskbar() {
        const app = this.app;
        if (!app) return;

        app._updateTaskbar = () => {
            if (typeof document === 'undefined') return;
            const container = document.getElementById('taskbarAppsContainer');
            if (!container) return;

            const apps = [
                { id: 'winEditor', title: 'Накладная', icon: '📄', badge: 'EDI Grid' },
                { id: 'winCameraScanner', title: 'ТСД Сканер', icon: '📱', badge: 'Честный ЗНАК' },
                { id: 'winBatchProcessor', title: 'Пакетный EDI', icon: '📦', badge: 'Конвейер' },
                { id: 'winJnvlp', title: 'ЖНВЛП & Цены', icon: '⚖️', badge: '89 регионов' },
                { id: 'winLabelPrinter', title: 'Ценники', icon: '🏷️', badge: 'Термопринтер' },
                { id: 'winDiffViewer', title: 'Сравнение', icon: '🔍', badge: 'Visual Diff' },
                { id: 'winSqlConsole', title: 'SQL Консоль', icon: '💻', badge: 'SQLite WASM' },
                { id: 'winDb', title: 'СУБД ERP', icon: '🗄️', badge: 'Каталог ГРЛС' },
                { id: 'winReconcile', title: 'Сверка', icon: '⚖️', badge: 'Smart Match' },
                { id: 'winSchema', title: 'Конструктор', icon: '📐', badge: 'DBF Doctor' },
                { id: 'winWizard', title: 'Мастер 2.0', icon: '🚀', badge: 'Конвертация' },
                { id: 'winInspector', title: 'Инспектор', icon: '🛠️', badge: 'Аудит ФЛК' },
                { id: 'winKb', title: 'База Знаний', icon: '📚', badge: '25+ регламентов' },
                { id: 'winGuide', title: 'Гид F1', icon: '📖', badge: 'Обучение' },
                { id: 'winSettings', title: 'Настройки', icon: '⚙️', badge: 'Параметры' }
            ];

            container.innerHTML = apps.map(item => {
                const win = document.getElementById(item.id);
                const isOpen = win && !win.classList.contains('minimized');
                const isFront = isOpen && (parseInt(win.style.zIndex || '10', 10) >= (app.topZIndex - 1));

                let btnClass = 'relative px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ';
                if (isOpen) {
                    if (isFront) {
                        btnClass += 'bg-blue-600/25 text-white border border-blue-500/80 shadow-md shadow-blue-500/20 active-taskbar-item';
                    } else {
                        btnClass += 'bg-slate-800/90 text-slate-200 border border-slate-700 hover:bg-slate-700/80';
                    }
                } else {
                    btnClass += 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent';
                }

                const dotHtml = isOpen
                    ? `<span class="taskbar-dot ${isFront ? 'taskbar-dot-active' : ''}"></span>`
                    : '';

                return `
                    <button onclick="window.PharmaGate.toggleApp('${item.id}')"
                            class="${btnClass}"
                            data-tooltip-title="${item.icon} ${item.title}"
                            data-tooltip-desc="Нажмите для переключения или сворачивания окна"
                            data-tooltip-badge="${item.badge}"
                            data-tooltip-pos="top"
                            aria-label="${item.title}">
                        <span>${item.icon}</span>
                        <span class="taskbar-title truncate max-w-[85px]">${item.title}</span>
                        ${dotHtml}
                    </button>
                `;
            }).join('');
        };

        app._updateTaskbar();
    }

    // =========================================================================
    // 8. ГЛОБАЛЬНЫЕ СИСТЕМНЫЕ ГОРЯЧИЕ КЛАВИШИ WEBOS
    // =========================================================================

    _bindGlobalOsShortcuts() {
        if (typeof window === 'undefined') return;
        window.addEventListener('keydown', (e) => {
            if ((e.code === 'KeyL' && (e.metaKey || (e.ctrlKey && e.altKey))) || (e.key === 'l' && e.ctrlKey && e.altKey)) {
                e.preventDefault();
                this.lockWebOs();
                return;
            }

            if (e.key === 'Meta' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                this.app?.toggleStartMenu?.();
                return;
            }

            if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.code === 'KeyC')) {
                e.preventDefault();
                this.toggleControlCenter();
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
