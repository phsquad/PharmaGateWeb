/**
 * js/services/camera_scanner.js - Оптический сканер 2D штрихкодов и кодов маркировки DataMatrix через веб-камеру/смартфон.
 * 
 * Поддерживает:
 * - W3C BarcodeDetector API (аппаратное ускорение Chromium / Safari iOS 17+);
 * - Управление фонариком/вспышкой устройства (Torch Track Constraints);
 * - Режимы: Верификация приемки, Добавление в накладную, Глубокий аудит КИЗ МДЛП;
 * - Звуковую (Web Audio API) и вибро-обратную связь (Haptic Vibration).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { MdlpValidator } from '../domain/mdlp_validator.js';
import { DataMatrixParser } from '../engine/text_engine.js';
import { PharmaMath } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';

export class CameraScannerService {
    constructor(appInstance) {
        this.app = appInstance;
        this.stream = null;
        this.videoEl = null;
        this.canvasEl = null;
        this.ctx = null;
        this.isScanning = false;
        this.barcodeDetector = null;
        this.scanMode = 'verify'; // 'verify' | 'add' | 'inspect'
        this.torchOn = false;
        this.currentTrack = null;
        this.lastScannedCode = '';
        this.lastScanTime = 0;
        this.audioCtx = null;
    }

    async initDetector() {
        if ('BarcodeDetector' in window) {
            try {
                const supported = await window.BarcodeDetector.getSupportedFormats();
                const formats = ['data_matrix', 'qr_code', 'ean_13', 'code_128'].filter(f => supported.includes(f));
                if (formats.length > 0) {
                    this.barcodeDetector = new window.BarcodeDetector({ formats });
                    console.log("[CameraScanner] Аппаратный BarcodeDetector активен для форматов:", formats);
                    return true;
                }
            } catch (e) {
                console.warn("[CameraScanner] Сбой инициализации BarcodeDetector:", e);
            }
        }
        return false;
    }

    async startCamera(videoElement, canvasElement, mode = 'verify') {
        this.videoEl = videoElement;
        this.canvasEl = canvasElement;
        if (this.canvasEl) this.ctx = this.canvasEl.getContext('2d', { willReadFrequently: true });
        this.scanMode = mode;

        await this.initDetector();

        try {
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoEl.srcObject = this.stream;
            await this.videoEl.play();

            const tracks = this.stream.getVideoTracks();
            if (tracks.length > 0) {
                this.currentTrack = tracks[0];
            }

            this.isScanning = true;
            this._scanLoop();
            return { ok: true };
        } catch (err) {
            console.error("[CameraScanner] Ошибка доступа к камере:", err);
            return { ok: false, error: err.name === 'NotAllowedError' ? 'Доступ к камере отклонен пользователем' : err.message };
        }
    }

    stopCamera() {
        this.isScanning = false;
        if (this.currentTrack && this.torchOn) {
            this.setTorch(false);
        }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.videoEl) {
            this.videoEl.srcObject = null;
        }
    }

    async toggleTorch() {
        return this.setTorch(!this.torchOn);
    }

    async setTorch(enable) {
        if (!this.currentTrack) return false;
        const capabilities = this.currentTrack.getCapabilities ? this.currentTrack.getCapabilities() : {};
        if (capabilities.torch) {
            try {
                await this.currentTrack.applyConstraints({
                    advanced: [{ torch: enable }]
                });
                this.torchOn = enable;
                return true;
            } catch (e) {
                console.warn("[CameraScanner] Управление фонариком недоступно:", e);
            }
        }
        return false;
    }

    _beep(freq = 1200, duration = 120) {
        try {
            if (!this.audioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.audioCtx = new AudioCtx();
            }
            if (this.audioCtx) {
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
                gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration / 1000);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start();
                osc.stop(this.audioCtx.currentTime + duration / 1000);
            }
        } catch (e) {}

        if (navigator.vibrate) {
            try { navigator.vibrate([70]); } catch (e) {}
        }
    }

    async _scanLoop() {
        if (!this.isScanning || !this.videoEl) return;

        if (this.videoEl.readyState >= 2) {
            if (this.barcodeDetector) {
                try {
                    const barcodes = await this.barcodeDetector.detect(this.videoEl);
                    if (barcodes.length > 0) {
                        const raw = barcodes[0].rawValue;
                        const now = Date.now();
                        // Защита от дребезга (debounce 1.5 сек на один и тот же код)
                        if (raw && (raw !== this.lastScannedCode || (now - this.lastScanTime) > 1500)) {
                            this.lastScannedCode = raw;
                            this.lastScanTime = now;
                            this._handleScannedBarcode(raw, barcodes[0].format);
                        }
                    }
                } catch (e) {}
            }
        }

        if (this.isScanning) {
            requestAnimationFrame(() => this._scanLoop());
        }
    }

    _handleScannedBarcode(raw, format = 'data_matrix') {
        this._beep(1400, 100);

        if (this.scanMode === 'verify') {
            this._handleVerifyMode(raw);
        } else if (this.scanMode === 'add') {
            this._handleAddMode(raw);
        } else if (this.scanMode === 'inspect') {
            this._handleInspectMode(raw);
        }
    }

    _handleVerifyMode(raw) {
        const parsed = DataMatrixParser.parse(raw);
        const searchGtin = parsed.gtin || (raw.length === 13 ? raw : '');
        const searchEan = searchGtin ? searchGtin.slice(-13) : '';
        const searchBatch = parsed.batchLot ? parsed.batchLot.toLowerCase() : '';

        // Поиск строки в активной накладной
        let foundIdx = -1;
        const records = this.app.records || [];

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const rEan = String(r.EAN13 || '').trim();
            const rGtin = String(r.GTIN || '').trim();
            const rSer = String(r.SER || '').trim().toLowerCase();

            const isBarcodeMatch = (searchEan && rEan === searchEan) || (searchGtin && rGtin === searchGtin);
            const isBatchMatch = !searchBatch || !rSer || rSer === searchBatch || rSer === 'б/с';

            if (isBarcodeMatch && isBatchMatch) {
                foundIdx = i;
                break;
            }
        }

        const resEl = document.getElementById('cameraScanResultBanner');
        if (foundIdx !== -1) {
            const matchedRow = records[foundIdx];
            if (resEl) {
                resEl.innerHTML = `
                    <div class="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500 text-white flex items-center justify-between text-xs animate-pulse">
                        <div>
                            <div class="font-bold text-emerald-300">✅ Позиция найдена в строке ${foundIdx + 1}!</div>
                            <div class="text-[11px] text-slate-200 mt-0.5">${matchedRow.NAME} (Серия: ${matchedRow.SER})</div>
                        </div>
                        <span class="px-2 py-1 rounded bg-emerald-700 text-white text-[10px] font-bold">ПОДТВЕРЖДЕНО</span>
                    </div>
                `;
            }
            this.app._showToast(`🎯 Сканер: найдена строка ${foundIdx + 1} (${matchedRow.NAME.slice(0, 20)}...)`);
            // Фокусировка в таблице Tabulator
            if (this.app.mainGrid?.tabulatorInstance) {
                try {
                    const row = this.app.mainGrid.tabulatorInstance.getRows()[foundIdx];
                    if (row) {
                        row.scrollTo();
                        row.select();
                    }
                } catch (e) {}
            }
        } else {
            if (resEl) {
                resEl.innerHTML = `
                    <div class="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500 text-white text-xs">
                        <div class="font-bold text-amber-300">⚠️ Препарат не найден в накладной!</div>
                        <div class="text-[10px] text-slate-300 mt-0.5 font-mono truncate">Код: ${raw}</div>
                    </div>
                `;
            }
            this.app._showToast("⚠️ Препарат со сканированным кодом отсутствует в накладной!");
        }
    }

    _handleAddMode(raw) {
        const parsed = DataMatrixParser.parse(raw);
        const nameInput = document.getElementById('wzName');
        const eanInput = document.getElementById('wzEan13');
        const serInput = document.getElementById('wzSer');
        const gdateInput = document.getElementById('wzGdate');

        if (parsed.gtin && eanInput) eanInput.value = parsed.gtin.slice(-13);
        if (parsed.batchLot && serInput) serInput.value = parsed.batchLot;
        if (parsed.expDate && gdateInput) gdateInput.value = parsed.expDate;

        this.app._showToast("📟 Реквизиты из DataMatrix внесены в Мастер добавления позиции!");
    }

    _handleInspectMode(raw) {
        const result = MdlpValidator.inspectDataMatrix(raw);
        const inspectEl = document.getElementById('cameraKizAuditDetails');
        if (inspectEl) {
            inspectEl.innerHTML = `
                <div class="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2 text-xs">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span class="font-bold text-white">Экспертиза КИЗ МДЛП</span>
                        <span class="px-2 py-0.5 rounded font-mono font-bold ${result.isValid ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-red-950 text-red-300 border border-red-700'}">${result.score}% ИНДЕКС</span>
                    </div>
                    <div class="space-y-1 font-mono text-[11px]">
                        <div><b>GTIN-14:</b> <span class="text-blue-400">${result.parsed.gtin || '-'}</span></div>
                        <div><b>Серийный номер:</b> <span class="text-emerald-400">${result.parsed.serial || '-'}</span></div>
                        <div><b>Срок годности:</b> <span class="text-amber-400">${result.parsed.expDate || '-'}</span></div>
                        <div><b>Серия/Партия:</b> <span class="text-purple-400">${result.parsed.batch || '-'}</span></div>
                        <div><b>Криптоключ / Хвост:</b> <span class="text-slate-400">${result.parsed.cryptoKey ? 'AI(91) + AI(92)' : 'Нет'}</span></div>
                    </div>
                    <div class="pt-2 border-t border-slate-800 space-y-1 text-[10px]">
                        ${result.details.map(d => `<div class="${d.level === 'OK' ? 'text-emerald-400' : (d.level === 'WARN' ? 'text-amber-400' : 'text-red-400')}">• ${d.message}</div>`).join('')}
                    </div>
                </div>
            `;
        }
    }
}
