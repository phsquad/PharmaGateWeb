/**
 * js/ui/feature_controllers.js - Контроллеры расширенных модулей PharmaGate WebOS v2026.3.0
 * 
 * Включает:
 * 1. 📷 «Камера-ТСД» — Мобильный оптический 2D-сканер DataMatrix и EAN-13 (WebRTC + BarcodeDetector API)
 * 2. 📦 Пакетный конвейер накладных — Group processing, FLK 99% авто-ремонт, ZIP-архивация и сводный реестр
 * 3. ⚖️ Региональный калькулятор ЖНВЛП — Официальная база тарифов 89 субъектов РФ (ПП РФ № 865) и Протокол цен Excel
 * 4. 🏷️ Студия печати ценников & термоэтикеток — Термопринтеры Zebra/Xprinter (58x40, 43x25, 30x20, A4), векторные штрихкоды
 * 5. 🔍 Интерактивный Visual Diff — Двухколоночное сравнение накладных (Документ А vs Документ Б) с цветовой индикацией
 * 6. 💻 SQL Консоль & Query Studio — Интерактивный анализ реляционной СУБД SQLite WASM с шаблонами и экспортом
 * 7. 🛡️ Валидатор соответствия формату МДЛП «Честный ЗНАК» — Криптографический аудит КИЗ (Modulo 10, FNC1, Base62, 44 знака)
 * 8. 🌐 Интеграция с Web Share API и PWA File Handling — Launch queue проводника ОС и системная кнопка «Поделиться»
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { CameraScannerService } from '../services/camera_scanner.js';
import { BatchProcessorService } from '../services/batch_processor.js';
import { JnvlpManager } from '../domain/jnvlp_registry.js';
import { LabelPrinterService } from '../services/label_printer.js';
import { InvoiceDiffEngine } from '../services/diff_engine.js';
import { SQLiteWasmService } from '../services/sqlite_wasm_service.js';
import { MdlpValidator } from '../domain/mdlp_validator.js';
import { UniversalImporter } from '../services/universal_importer.js';
import { PharmaMath } from '../engine/pharma_math.js';

export function bindEnterpriseFeatures(app) {
    // Инициализация сервисов на экземпляре приложения
    app.cameraScanner = new CameraScannerService();
    app.batchResults = null;
    app.diffResult = null;
    app.diffGrid = null;
    app.sqlGrid = null;
    app.scanMode = 'verify'; // 'verify' | 'add' | 'inspect'

    // Привязка всех 8 функциональных направлений
    _bindCameraScanner(app);
    _bindBatchProcessor(app);
    _bindJnvlpWindow(app);
    _bindLabelPrinter(app);
    _bindDiffViewer(app);
    _bindSqlConsole(app);
    _bindPwaFileHandling(app);
    _bindWebShare(app);

    console.log("[EnterpriseFeatures] Все 8 расширенных модулей PharmaGate v2026.3.0 успешно инициализированы.");
}

// =========================================================================
// 1. 📷 «КАМЕРА-ТСД» — МОБИЛЬНЫЙ ОПТИЧЕСКИЙ 2D-СКАНЕР
// =========================================================================

function _bindCameraScanner(app) {
    const video = document.getElementById('scannerVideo');
    const btnStart = document.getElementById('btnScanStart');
    const btnStop = document.getElementById('btnScanStop');
    const btnTorch = document.getElementById('btnScanTorchToggle');
    const lblTorch = document.getElementById('lblScanTorchState');
    const btnSound = document.getElementById('btnScanSoundToggle');
    const iconSound = document.getElementById('iconScanSound');
    const selCamera = document.getElementById('selScanCameraDevice');
    const overlayBadge = document.getElementById('scannerOverlayBadge');
    const rawCodeBox = document.getElementById('scannedRawCode');
    const typeBadge = document.getElementById('scanTypeBadge');
    const matchStatusText = document.getElementById('scanMatchStatusText');
    const matchResultBox = document.getElementById('scanMatchResultBox');

    let soundEnabled = true;

    // Переключение режимов (Сверка / Добавление / Аудит КИЗ)
    const btnVerify = document.getElementById('btnScanModeVerify');
    const btnAdd = document.getElementById('btnScanModeAdd');
    const btnInspect = document.getElementById('btnScanModeInspect');

    const setScanMode = (mode) => {
        app.scanMode = mode;
        [btnVerify, btnAdd, btnInspect].forEach(b => {
            if (!b) return;
            b.classList.remove('bg-blue-600', 'text-white', 'font-bold');
            b.classList.add('bg-slate-800', 'text-slate-300', 'font-semibold');
        });
        const activeBtn = mode === 'verify' ? btnVerify : (mode === 'add' ? btnAdd : btnInspect);
        if (activeBtn) {
            activeBtn.classList.add('bg-blue-600', 'text-white', 'font-bold');
            activeBtn.classList.remove('bg-slate-800', 'text-slate-300', 'font-semibold');
        }
    };

    btnVerify?.addEventListener('click', () => setScanMode('verify'));
    btnAdd?.addEventListener('click', () => setScanMode('add'));
    btnInspect?.addEventListener('click', () => setScanMode('inspect'));

    btnSound?.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        if (iconSound) iconSound.innerText = soundEnabled ? '🔔' : '🔕';
    });

    btnTorch?.addEventListener('click', async () => {
        const newState = await app.cameraScanner.toggleTorch();
        if (lblTorch) lblTorch.innerText = newState ? 'Выключить' : 'Фонарик';
    });

    // Определение доступных камер устройства
    app.cameraScanner.getAvailableCameras().then(devices => {
        if (selCamera && devices.length > 0) {
            selCamera.innerHTML = devices.map(d => `<option value="${d.deviceId}">${d.label || 'Камера ' + d.deviceId.slice(0, 4)}</option>`).join('');
        }
    }).catch(() => {});

    selCamera?.addEventListener('change', () => {
        if (selCamera.value) {
            app.cameraScanner.switchCamera(selCamera.value);
        }
    });

    const processScannedCode = (code) => {
        if (soundEnabled) app.cameraScanner.playBeep();
        if (rawCodeBox) rawCodeBox.innerText = code;

        const isDataMatrix = code.length > 20 || code.startsWith('01') || code.includes('\x1d');
        if (typeBadge) typeBadge.innerText = isDataMatrix ? 'DataMatrix МДЛП' : (code.length === 13 ? 'EAN-13' : 'Штрихкод');

        let parsed = null;
        if (isDataMatrix) {
            parsed = MdlpValidator.validateDataMatrix(code);
            if (document.getElementById('scanResultGtin')) document.getElementById('scanResultGtin').innerText = parsed.gtin || '—';
            if (document.getElementById('scanResultSerial')) document.getElementById('scanResultSerial').innerText = parsed.serial || '—';
            if (document.getElementById('scanResultExp')) document.getElementById('scanResultExp').innerText = parsed.expDate || '—';
            if (document.getElementById('scanResultSeries')) document.getElementById('scanResultSeries').innerText = parsed.series || '—';
        } else {
            MdlpValidator.validateEan13(code);
            if (document.getElementById('scanResultGtin')) document.getElementById('scanResultGtin').innerText = code;
            if (document.getElementById('scanResultSerial')) document.getElementById('scanResultSerial').innerText = '—';
            if (document.getElementById('scanResultExp')) document.getElementById('scanResultExp').innerText = '—';
            if (document.getElementById('scanResultSeries')) document.getElementById('scanResultSeries').innerText = '—';
        }

        if (app.scanMode === 'verify') {
            const gtinOrEan = parsed?.gtin || code.trim();
            const cleanCode = gtinOrEan.replace(/\D/g, '');

            const foundIndex = app.records.findIndex(r => {
                const rEan = String(r.EAN13 || r.ean13 || '').replace(/\D/g, '');
                const rGtin = String(r.GTIN || r.gtin || '').replace(/\D/g, '');
                const rCode = String(r.CODEPST || r.codepst || '').trim();
                return (rEan && cleanCode && rEan.includes(cleanCode)) || 
                       (rGtin && cleanCode && rGtin.includes(cleanCode)) || 
                       (cleanCode && rCode === cleanCode);
            });

            if (foundIndex !== -1) {
                const row = app.records[foundIndex];
                if (matchStatusText) {
                    matchStatusText.innerHTML = `<span class="text-emerald-400 font-bold">✔ ПОЗИЦИЯ НАЙДЕНА (строка ${foundIndex + 1}):</span> <span class="text-white">${row.NAME || row.name || 'Товар'}</span> (Кол-во: ${row.QNT || row.qnt || 1} шт.)`;
                }
                if (matchResultBox) {
                    matchResultBox.className = "p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-xs";
                }
                app._showToast(`📷 Найдена строка №${foundIndex + 1}: ${row.NAME || 'Товар'}`);
            } else {
                if (matchStatusText) {
                    matchStatusText.innerHTML = `<span class="text-rose-400 font-bold">✖ Позиция НЕ найдена в накладной</span> (Штрихкод/GTIN: ${gtinOrEan})`;
                }
                if (matchResultBox) {
                    matchResultBox.className = "p-2.5 rounded-lg bg-rose-950/60 border border-rose-700/60 text-xs";
                }
            }
        } else if (app.scanMode === 'add') {
            const gtinOrEan = parsed?.gtin || code.trim();
            const newRow = {
                CODEPST: 'S' + Math.floor(100000 + Math.random() * 900000),
                NAME: `Товар по сканеру (${gtinOrEan})`,
                SER: parsed?.series || 'б/с',
                GDATE: parsed?.expDate || '2028-12-31',
                QNT: 1.0,
                PRICE1: 90.0,
                PRICE2: 110.0,
                PRICE2N: 100.0,
                NDS: 10,
                SUMSTR: 110.0,
                SUMSNDS: 10.0,
                EAN13: gtinOrEan.length === 13 ? gtinOrEan : '',
                GTIN: gtinOrEan.length === 14 ? gtinOrEan : ''
            };
            app._saveSnapshot();
            app.records.push(newRow);
            app.mainGrid.updateData(app.records, app.schema, app.issues);
            app._revalidateDocument();
            if (matchStatusText) {
                matchStatusText.innerHTML = `<span class="text-emerald-400 font-bold">✔ Добавлена новая строка №${app.records.length}</span> в накладную!`;
            }
            if (matchResultBox) {
                matchResultBox.className = "p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-xs";
            }
            app._showToast(`➕ Добавлена новая позиция: ${gtinOrEan}`);
        } else if (app.scanMode === 'inspect') {
            if (parsed) {
                const status = parsed.isValid ? '✔ Полное соответствие спецификации МДЛП' : '✖ Ошибки в структуре DataMatrix';
                const color = parsed.isValid ? 'text-emerald-400' : 'text-rose-400';
                const errs = parsed.errors && parsed.errors.length > 0 ? `<div class="text-[10px] text-rose-300 mt-1">${parsed.errors.join('<br>')}</div>` : '';
                if (matchStatusText) {
                    matchStatusText.innerHTML = `<span class="${color} font-bold">${status}</span>${errs}`;
                }
                if (matchResultBox) {
                    matchResultBox.className = parsed.isValid ? "p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-xs" : "p-2.5 rounded-lg bg-rose-950/60 border border-rose-700/60 text-xs";
                }
            }
        }
    };

    btnStart?.addEventListener('click', async () => {
        if (overlayBadge) overlayBadge.innerText = 'Запуск камеры...';
        try {
            await app.cameraScanner.start(
                video,
                (code) => processScannedCode(code),
                (err) => {
                    if (overlayBadge) overlayBadge.innerText = 'Ошибка камеры: ' + err.message;
                }
            );
            if (overlayBadge) overlayBadge.innerText = 'Камера активна. Наведите на DataMatrix или EAN-13';
        } catch (e) {
            if (overlayBadge) overlayBadge.innerText = 'Сбой камеры: ' + e.message;
        }
    });

    btnStop?.addEventListener('click', () => {
        app.cameraScanner.stop();
        if (overlayBadge) overlayBadge.innerText = 'Камера остановлена.';
    });

    // Ручной ввод штрихкода
    const inpManual = document.getElementById('inpScanManualCode');
    const btnManual = document.getElementById('btnScanManualApply');
    const applyManual = () => {
        const val = (inpManual?.value || '').trim();
        if (val) {
            processScannedCode(val);
            inpManual.value = '';
        }
    };
    btnManual?.addEventListener('click', applyManual);
    inpManual?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyManual();
    });
}

// =========================================================================
// 2. 📦 ПАКЕТНЫЙ EDI-КОНВЕЙЕР & ZIP АРХИВ
// =========================================================================

function _bindBatchProcessor(app) {
    const fileInput = document.getElementById('batchFileInput');
    const btnSelect = document.getElementById('btnBatchSelectFiles');
    const btnProcess = document.getElementById('btnBatchProcessAll');
    const btnClear = document.getElementById('btnBatchClear');
    const btnZip = document.getElementById('btnBatchDownloadZip');
    const btnExcel = document.getElementById('btnBatchDownloadExcel');
    const dropZone = document.getElementById('batchDropZone');
    const progressWrapper = document.getElementById('batchProgressWrapper');
    const progressBar = document.getElementById('batchProgressBar');
    const progressLabel = document.getElementById('batchProgressLabel');
    const progressPercent = document.getElementById('batchProgressPercent');
    const tableBody = document.getElementById('batchFilesTableBody');

    const badgeTotal = document.getElementById('batchStatsTotal');
    const badgeOk = document.getElementById('batchStatsOk');
    const badgeFixed = document.getElementById('batchStatsFixed');
    const badgeSum = document.getElementById('batchStatsSum');

    let queuedFiles = [];

    const updateQueueTable = () => {
        if (!tableBody) return;
        if (queuedFiles.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500 font-sans">Очередь файлов пуста. Перетащите накладные в окно или нажмите «Выбрать файлы».</td></tr>';
            if (badgeTotal) badgeTotal.innerText = '0';
            if (badgeOk) badgeOk.innerText = '0';
            if (badgeFixed) badgeFixed.innerText = '0';
            if (badgeSum) badgeSum.innerText = '0.00 ₽';
            return;
        }

        tableBody.innerHTML = queuedFiles.map((f, i) => {
            const ext = f.name.split('.').pop().toUpperCase();
            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-2.5 text-center text-slate-400 font-sans">${i + 1}</td>
                    <td class="p-2.5 font-sans font-semibold text-white truncate max-w-[200px]" title="${f.name}">${f.name}</td>
                    <td class="p-2.5"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">${ext}</span></td>
                    <td class="p-2.5 text-right font-mono text-slate-400" id="batchRowLines_${i}">—</td>
                    <td class="p-2.5 text-right font-mono text-slate-400" id="batchRowSum_${i}">—</td>
                    <td class="p-2.5 text-center" id="batchRowStatus_${i}"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">В очереди</span></td>
                    <td class="p-2.5 text-center" id="batchRowAction_${i}">—</td>
                </tr>
            `;
        }).join('');

        if (badgeTotal) badgeTotal.innerText = queuedFiles.length;
    };

    btnSelect?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            queuedFiles = Array.from(e.target.files);
            updateQueueTable();
        }
    });

    dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-950/20'); });
    dropZone?.addEventListener('dragleave', () => { dropZone.classList.remove('border-blue-500', 'bg-blue-950/20'); });
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-950/20');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            queuedFiles = Array.from(e.dataTransfer.files);
            updateQueueTable();
        }
    });
    dropZone?.addEventListener('click', () => fileInput?.click());

    btnClear?.addEventListener('click', () => {
        queuedFiles = [];
        app.batchResults = null;
        updateQueueTable();
    });

    btnProcess?.addEventListener('click', async () => {
        if (queuedFiles.length === 0) {
            app._showToast('⚠️ Сначала выберите файлы для пакетной обработки!');
            return;
        }

        if (progressWrapper) progressWrapper.classList.remove('hidden');

        app.batchResults = await BatchProcessorService.processFiles(queuedFiles, (p) => {
            const pct = Math.round((p.current / p.total) * 100);
            if (progressBar) progressBar.style.width = pct + '%';
            if (progressPercent) progressPercent.innerText = pct + '%';
            if (progressLabel) progressLabel.innerText = `Обработка ${p.current} из ${p.total}: ${p.filename}`;

            const idx = p.current - 1;
            const r = p.lastResult;
            if (r) {
                const rowLines = document.getElementById(`batchRowLines_${idx}`);
                const rowSum = document.getElementById(`batchRowSum_${idx}`);
                const rowStatus = document.getElementById(`batchRowStatus_${idx}`);
                const rowAction = document.getElementById(`batchRowAction_${idx}`);

                if (rowLines) rowLines.innerText = r.linesCount;
                if (rowSum) rowSum.innerText = PharmaMath.formatMoney(r.totalSum) + ' ₽';
                if (rowStatus) {
                    rowStatus.innerHTML = r.status === 'OK' 
                        ? '<span class="px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 text-[10px]">Без ошибок</span>'
                        : `<span class="px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 text-[10px]">Ремонт: ${r.fixedCount}</span>`;
                }
                if (rowAction) {
                    rowAction.innerHTML = `<button onclick="window.PharmaGate._loadBatchItemToEditor(${idx})" class="text-blue-400 hover:text-blue-300 text-xs font-semibold underline cursor-pointer">В редактор</button>`;
                }
            }
        });

        if (progressWrapper) {
            setTimeout(() => progressWrapper.classList.add('hidden'), 1500);
        }

        if (badgeOk) badgeOk.innerText = app.batchResults.okCount;
        if (badgeFixed) badgeFixed.innerText = app.batchResults.fixedCount;
        if (badgeSum) badgeSum.innerText = PharmaMath.formatMoney(app.batchResults.totalSum) + ' ₽';

        app._showToast(`✅ Пакетная обработка завершена! Успешно: ${app.batchResults.results.length} файлов.`);
    });

    btnZip?.addEventListener('click', async () => {
        if (!app.batchResults || app.batchResults.results.length === 0) {
            app._showToast('⚠️ Сначала запустите обработку файлов!');
            return;
        }
        await BatchProcessorService.downloadBatchZip(app.batchResults, 'PharmaGate_EDI_Batch.zip');
        app._showToast('📥 Пакетный ZIP-архив успешно скачан!');
    });

    btnExcel?.addEventListener('click', () => {
        if (!app.batchResults || app.batchResults.results.length === 0) {
            app._showToast('⚠️ Сначала запустите обработку файлов!');
            return;
        }
        BatchProcessorService.exportSummaryExcel(app.batchResults, 'Сводный_реестр_накладных.xlsx');
        app._showToast('📊 Сводный реестр накладных экспортирован в Excel!');
    });

    // Экспорт обработанной накладной в редактор
    app._loadBatchItemToEditor = function(index) {
        if (!app.batchResults || !app.batchResults.results[index]) return;
        const item = app.batchResults.results[index];
        app._saveSnapshot();
        app.records = item.repairedRecords;
        app.activeFileName = item.filename;
        app.mainGrid.updateData(app.records, app.schema, []);
        app._revalidateDocument();
        const badge = document.getElementById('winEditorFileBadge');
        if (badge) badge.innerText = item.filename;
        app.openApp('winEditor');
        app._showToast(`📄 Файл '${item.filename}' загружен в EDI Редактор`);
    };
}

// =========================================================================
// 3. ⚖️ РЕГИОНАЛЬНЫЙ КАЛЬКУЛЯТОР ЖНВЛП (ПП РФ № 865) & ПРОТОКОЛ ЦЕН
// =========================================================================

function _bindJnvlpWindow(app) {
    const selRegion = document.getElementById('selJnvlpRegion');
    const inpRegPrice = document.getElementById('inpJnvlpRegPrice');
    const inpFactPrice = document.getElementById('inpJnvlpFactPrice');
    const inpOptMarkup = document.getElementById('inpJnvlpOptMarkup');
    const inpRetailMarkup = document.getElementById('inpJnvlpRetailMarkup');
    const selNds = document.getElementById('selJnvlpNds');
    const btnRecalc = document.getElementById('btnJnvlpRecalcSingle');
    const btnApplyInvoice = document.getElementById('btnJnvlpApplyCurrentInvoice');
    const btnExportProtocol = document.getElementById('btnJnvlpExportProtocol');

    const lblMaxOptMarkup = document.getElementById('lblJnvlpMaxWholesaleMarkup');
    const lblMaxOptPrice = document.getElementById('lblJnvlpMaxWholesalePrice');
    const lblMaxRetailPrice = document.getElementById('lblJnvlpMaxRetailPrice');
    const badgeStatus = document.getElementById('badgeJnvlpStatus');
    const tableBody = document.getElementById('jnvlpTableBody');
    const statsBadge = document.getElementById('jnvlpTableStatsBadge');

    if (selRegion) {
        selRegion.innerHTML = Object.entries(JnvlpManager.REGIONAL_TARIFFS).map(([k, v]) => `
            <option value="${k}">${v.name}</option>
        `).join('');
        selRegion.value = 'moscow';
    }

    const recalcSingle = () => {
        const regionKey = selRegion?.value || 'moscow';
        const regPrice = parseFloat(inpRegPrice?.value || 0) || 0;
        const factPrice = parseFloat(inpFactPrice?.value || 0) || regPrice;
        const optMarkup = parseFloat(inpOptMarkup?.value || 0) || 0;
        const retailMarkup = parseFloat(inpRetailMarkup?.value || 0) || 0;
        const nds = parseInt(selNds?.value || 10, 10);

        const res = JnvlpManager.calculateLimitPrices({
            regionKey,
            regPrice,
            manufacturerFactPrice: factPrice,
            wholesaleFactMarkup: optMarkup,
            retailFactMarkup: retailMarkup,
            ndsPct: nds
        });

        if (lblMaxOptMarkup) lblMaxOptMarkup.innerText = res.maxWholesaleMarkupPct + '%';
        if (lblMaxOptPrice) lblMaxOptPrice.innerText = PharmaMath.formatMoney(res.maxWholesalePriceWithNds) + ' ₽';
        if (lblMaxRetailPrice) lblMaxRetailPrice.innerText = PharmaMath.formatMoney(res.maxRetailPriceWithNds) + ' ₽';

        if (badgeStatus) {
            if (res.isWholesaleExcess || res.isRetailExcess) {
                badgeStatus.innerText = '✖ ПРЕВЫШЕНИЕ ПРЕДЕЛЬНОЙ НАДБАВКИ';
                badgeStatus.className = 'text-xs font-bold text-rose-400 mt-0.5';
            } else {
                badgeStatus.innerText = '● ЦЕНА В ПРЕДЕЛАХ НОРМЫ';
                badgeStatus.className = 'text-xs font-bold text-emerald-400 mt-0.5';
            }
        }
    };

    app._recalcJnvlpSingle = recalcSingle;

    btnRecalc?.addEventListener('click', recalcSingle);
    selRegion?.addEventListener('change', recalcSingle);
    inpRegPrice?.addEventListener('input', recalcSingle);
    inpFactPrice?.addEventListener('input', recalcSingle);
    inpOptMarkup?.addEventListener('input', recalcSingle);
    inpRetailMarkup?.addEventListener('input', recalcSingle);
    selNds?.addEventListener('change', recalcSingle);

    btnApplyInvoice?.addEventListener('click', () => {
        if (!app.records || app.records.length === 0) {
            app._showToast('⚠️ Накладная пуста!');
            return;
        }

        const regionKey = selRegion?.value || 'moscow';
        if (statsBadge) statsBadge.innerText = `${app.records.length} позиций`;

        if (tableBody) {
            tableBody.innerHTML = app.records.map((r, i) => {
                const regPrice = PharmaMath.cleanDecimal(r.REGPRC || r.regprc || r.PRICE2N || 100, 100.0);
                const factPrice = PharmaMath.cleanDecimal(r.PRICE1 || r.price1 || regPrice * 0.95, regPrice * 0.95);
                const factOptPrice = PharmaMath.cleanDecimal(r.PRICE2N || r.price2n || regPrice, regPrice);
                const nds = parseInt(r.NDS || r.nds || 10, 10);

                const factMarkupPct = factPrice > 0 ? PharmaMath.cleanDecimal(((factOptPrice - factPrice) / factPrice) * 100, 5.0) : 0;

                const res = JnvlpManager.calculateLimitPrices({
                    regionKey,
                    regPrice,
                    manufacturerFactPrice: factPrice,
                    wholesaleFactMarkup: factMarkupPct,
                    retailFactMarkup: 15.0,
                    ndsPct: nds
                });

                const isExcess = factMarkupPct > res.maxWholesaleMarkupPct;
                const statusHtml = isExcess
                    ? '<span class="px-2 py-0.5 rounded bg-rose-900/50 text-rose-300 font-bold text-[10px]">Превышение</span>'
                    : '<span class="px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 font-bold text-[10px]">Норма</span>';

                return `
                    <tr class="hover:bg-white/5 transition-colors">
                        <td class="p-2 text-center text-slate-400 font-sans">${i + 1}</td>
                        <td class="p-2 font-sans font-semibold text-white truncate max-w-[200px]" title="${r.NAME || r.name || ''}">${r.NAME || r.name || 'Товар'}</td>
                        <td class="p-2 text-right font-mono">${PharmaMath.formatMoney(regPrice)}</td>
                        <td class="p-2 text-right font-mono">${PharmaMath.formatMoney(factPrice)}</td>
                        <td class="p-2 text-right font-mono ${isExcess ? 'text-rose-400 font-bold' : ''}">${factMarkupPct.toFixed(1)}%</td>
                        <td class="p-2 text-right font-mono text-amber-400">${res.maxWholesaleMarkupPct}%</td>
                        <td class="p-2 text-right font-mono">${PharmaMath.formatMoney(factOptPrice)}</td>
                        <td class="p-2 text-right font-mono text-emerald-400">${PharmaMath.formatMoney(res.maxWholesalePriceWithoutNds)}</td>
                        <td class="p-2 text-center">${statusHtml}</td>
                    </tr>
                `;
            }).join('');
        }

        app._showToast(`⚖️ Расчет ЖНВЛП по региону '${JnvlpManager.REGIONAL_TARIFFS[regionKey]?.name}' выполнен!`);
    });

    btnExportProtocol?.addEventListener('click', () => {
        if (!app.records || app.records.length === 0) {
            app._showToast('⚠️ Накладная пуста! Загрузите позиции.');
            return;
        }
        const regionKey = selRegion?.value || 'moscow';
        JnvlpManager.downloadProtocolExcel(app.records, regionKey);
        app._showToast('📄 Официальный Протокол согласования цен ЖНВЛП экспортирован в Excel!');
    });

    recalcSingle();
}

// =========================================================================
// 4. 🏷️ СТУДИЯ ПЕЧАТИ ТЕРМОЭТИКЕТОК И ЦЕННИКОВ
// =========================================================================

function _bindLabelPrinter(app) {
    const selFormat = document.getElementById('selLabelFormat');
    const selBarcode = document.getElementById('selLabelBarcodeType');
    const inpOrg = document.getElementById('inpLabelOrgName');
    const chkSeries = document.getElementById('chkLabelShowSeries');
    const chkExp = document.getElementById('chkLabelShowExp');
    const chkCountry = document.getElementById('chkLabelShowCountry');
    const selQty = document.getElementById('selLabelQtyMode');
    const btnPrint = document.getElementById('btnLabelPrint');
    const previewBox = document.getElementById('labelPreviewBox');
    const badgeCount = document.getElementById('lblLabelCountBadge');

    const updatePreview = () => {
        const format = selFormat?.value || '58x40';
        const barcodeType = selBarcode?.value || 'ean13';
        const orgName = inpOrg?.value || 'Аптека «ФармаГейт»';
        const showSeries = chkSeries?.checked ?? true;
        const showExp = chkExp?.checked ?? true;
        const showCountry = chkCountry?.checked ?? true;

        const sampleProduct = (app.records && app.records[0]) || {
            NAME: 'Парацетамол таб. 500мг №20',
            PRICE2: 85.50,
            SER: '20424',
            GDATE: '2028-11-01',
            CNTR: 'Россия',
            EAN13: '4601234567890',
            GTIN: '04601234567890'
        };

        const svg = LabelPrinterService.getPreviewSvg(sampleProduct, format, {
            barcodeType,
            orgName,
            showSeries,
            showExp,
            showCountry
        });

        if (previewBox) {
            previewBox.innerHTML = svg;
        }

        const totalLabels = (app.records && app.records.length > 0)
            ? (selQty?.value === 'by_qnt' 
                ? app.records.reduce((acc, r) => acc + (parseFloat(r.QNT || r.qnt || 1) || 1), 0)
                : app.records.length)
            : 0;

        if (badgeCount) badgeCount.innerText = `Готово к печати: ${totalLabels} шт.`;
    };

    app._updateLabelPreview = updatePreview;

    [selFormat, selBarcode, inpOrg, chkSeries, chkExp, chkCountry, selQty].forEach(el => {
        el?.addEventListener('change', updatePreview);
        el?.addEventListener('input', updatePreview);
    });

    btnPrint?.addEventListener('click', () => {
        const items = (app.records && app.records.length > 0) ? app.records : [{
            NAME: 'Парацетамол таб. 500мг №20',
            PRICE2: 85.50,
            SER: '20424',
            GDATE: '2028-11-01',
            CNTR: 'Россия',
            EAN13: '4601234567890',
            GTIN: '04601234567890',
            QNT: 10
        }];

        const format = selFormat?.value || '58x40';
        const barcodeType = selBarcode?.value || 'ean13';
        const orgName = inpOrg?.value || 'Аптека «ФармаГейт»';

        LabelPrinterService.printLabels(items, format, {
            barcodeType,
            orgName,
            showSeries: chkSeries?.checked ?? true,
            showExp: chkExp?.checked ?? true,
            showCountry: chkCountry?.checked ?? true,
            useQuantity: selQty?.value === 'by_qnt'
        });

        app._showToast('🖨️ Окно термопечати ценников открыто!');
    });

    updatePreview();
}

// =========================================================================
// 5. 🔍 ИНТЕРАКТИВНЫЙ VISUAL DIFF (СРАВНЕНИЕ ДВУХ НАКЛАДНЫХ)
// =========================================================================

function _bindDiffViewer(app) {
    const fileInputA = document.getElementById('diffFileInputA');
    const fileInputB = document.getElementById('diffFileInputB');
    const btnLoadA = document.getElementById('btnDiffLoadA');
    const btnLoadB = document.getElementById('btnDiffLoadB');
    const lblFileA = document.getElementById('lblDiffFileA');
    const lblFileB = document.getElementById('lblDiffFileB');
    const btnUseCurrent = document.getElementById('btnDiffUseCurrentAsA');
    const btnExportExcel = document.getElementById('btnDiffExportExcel');

    const badgeEqual = document.getElementById('diffBadgeEqual');
    const badgeMod = document.getElementById('diffBadgeMod');
    const badgeAdd = document.getElementById('diffBadgeAdd');
    const badgeDel = document.getElementById('diffBadgeDel');
    const deltaSum = document.getElementById('diffDeltaSum');

    let docA = null;
    let docB = null;

    const runDiff = () => {
        if (!docA || !docB) return;
        app.diffResult = InvoiceDiffEngine.compareInvoices(docA, docB);

        if (badgeEqual) badgeEqual.innerText = app.diffResult.summary.equalCount;
        if (badgeMod) badgeMod.innerText = app.diffResult.summary.modifiedCount;
        if (badgeAdd) badgeAdd.innerText = app.diffResult.summary.addedCount;
        if (badgeDel) badgeDel.innerText = app.diffResult.summary.deletedCount;
        if (deltaSum) {
            const d = app.diffResult.summary.totalSumDelta;
            deltaSum.innerText = (d > 0 ? '+' : '') + PharmaMath.formatMoney(d) + ' ₽';
            deltaSum.className = d > 0 ? 'text-sm font-bold text-amber-400 mt-0.5' : (d < 0 ? 'text-sm font-bold text-emerald-400 mt-0.5' : 'text-sm font-bold text-slate-200 mt-0.5');
        }

        const container = document.getElementById('diffGridContainer');
        if (container && window.Tabulator) {
            app.diffGrid = new window.Tabulator(container, {
                data: app.diffResult.diffRows,
                layout: 'fitColumns',
                height: '100%',
                columns: [
                    {
                        title: "Статус",
                        field: "_diffStatus",
                        width: 120,
                        formatter: (cell) => {
                            const val = cell.getValue();
                            if (val === 'ADDED') return '<span class="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold text-[10px]">➕ Добавлено</span>';
                            if (val === 'DELETED') return '<span class="px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 font-bold text-[10px]">✖ Удалено</span>';
                            if (val === 'MODIFIED') return '<span class="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 font-bold text-[10px]">✏️ Изменено</span>';
                            return '<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">Без изм.</span>';
                        }
                    },
                    { title: "Артикул", field: "CODEPST", width: 100 },
                    { title: "Наименование", field: "NAME", minWidth: 200 },
                    { title: "Серия", field: "SER", width: 90 },
                    { title: "Срок", field: "GDATE", width: 90 },
                    { title: "Кол-во", field: "QNT", width: 80, hozAlign: "right" },
                    { title: "Цена с НДС", field: "PRICE2", width: 100, hozAlign: "right", formatter: (cell) => PharmaMath.formatMoney(cell.getValue()) },
                    { title: "Сумма", field: "SUMSTR", width: 110, hozAlign: "right", formatter: (cell) => PharmaMath.formatMoney(cell.getValue()) }
                ]
            });
        }

        app._showToast(`🔍 Сравнение завершено: найдено ${app.diffResult.summary.modifiedCount + app.diffResult.summary.addedCount + app.diffResult.summary.deletedCount} расхождений.`);
    };

    btnLoadA?.addEventListener('click', () => fileInputA?.click());
    fileInputA?.addEventListener('change', async (e) => {
        const f = e.target.files?.[0];
        if (f) {
            const rep = await UniversalImporter.importFile(f, f.name);
            docA = rep.mappedRecords;
            if (lblFileA) lblFileA.innerText = f.name;
            runDiff();
        }
    });

    btnLoadB?.addEventListener('click', () => fileInputB?.click());
    fileInputB?.addEventListener('change', async (e) => {
        const f = e.target.files?.[0];
        if (f) {
            const rep = await UniversalImporter.importFile(f, f.name);
            docB = rep.mappedRecords;
            if (lblFileB) lblFileB.innerText = f.name;
            runDiff();
        }
    });

    btnUseCurrent?.addEventListener('click', () => {
        if (!app.records || app.records.length === 0) {
            app._showToast('⚠️ Текущая накладная пуста!');
            return;
        }
        docA = JSON.parse(JSON.stringify(app.records));
        if (lblFileA) lblFileA.innerText = app.activeFileName || 'Текущая накладная';
        app._showToast('📥 Текущая накладная назначена как «Документ А». Теперь выберите «Документ Б» для сравнения.');
        runDiff();
    });

    btnExportExcel?.addEventListener('click', () => {
        if (!app.diffResult) {
            app._showToast('⚠️ Сначала выполните сравнение двух документов!');
            return;
        }
        InvoiceDiffEngine.exportDiffExcel(app.diffResult, 'Сравнение_накладных_Diff.xlsx');
        app._showToast('📊 Отчет о различиях накладных экспортирован в Excel!');
    });
}

// =========================================================================
// 6. 💻 SQL КОНСОЛЬ & QUERY BUILDER (СУБД MINI-ERP)
// =========================================================================

function _bindSqlConsole(app) {
    const selPresets = document.getElementById('selSqlPresets');
    const queryInput = document.getElementById('sqlQueryInput');
    const btnRun = document.getElementById('btnSqlRun');
    const btnClear = document.getElementById('btnSqlClear');
    const btnExcel = document.getElementById('btnSqlExportExcel');
    const btnCsv = document.getElementById('btnSqlExportCsv');
    const badge = document.getElementById('sqlExecutionBadge');
    const errorBanner = document.getElementById('sqlErrorBanner');
    const container = document.getElementById('sqlResultsGridContainer');

    let lastQueryResults = null;

    if (selPresets && SQLiteWasmService.SQL_PRESETS) {
        selPresets.innerHTML = SQLiteWasmService.SQL_PRESETS.map((p, i) => `
            <option value="${i}">${p.name}</option>
        `).join('');
        selPresets.addEventListener('change', () => {
            const idx = parseInt(selPresets.value, 10);
            if (SQLiteWasmService.SQL_PRESETS[idx] && queryInput) {
                queryInput.value = SQLiteWasmService.SQL_PRESETS[idx].sql;
            }
        });
    }

    const executeQuery = () => {
        const sql = (queryInput?.value || '').trim();
        if (!sql) return;

        if (app.records && app.records.length > 0) {
            SQLiteWasmService.bulkInsertProducts(app.records);
        }

        const res = SQLiteWasmService.executeUserQuery(sql);
        lastQueryResults = res;

        if (!res.success) {
            if (errorBanner) {
                errorBanner.innerText = 'Ошибка SQL: ' + res.error;
                errorBanner.classList.remove('hidden');
            }
            if (badge) badge.innerText = `Ошибка (${res.executionTimeMs} мс)`;
            return;
        }

        if (errorBanner) errorBanner.classList.add('hidden');
        if (badge) badge.innerText = `${res.rowCount} строк (${res.executionTimeMs} мс)`;

        if (container && window.Tabulator && res.columns.length > 0) {
            const tableData = res.rows.map(row => {
                const obj = {};
                res.columns.forEach((col, i) => {
                    obj[col] = row[i];
                });
                return obj;
            });

            const cols = res.columns.map(col => ({
                title: col,
                field: col,
                headerSort: true
            }));

            app.sqlGrid = new window.Tabulator(container, {
                data: tableData,
                layout: 'fitDataFill',
                height: '100%',
                columns: cols
            });
        }
    };

    btnRun?.addEventListener('click', executeQuery);
    btnClear?.addEventListener('click', () => {
        if (queryInput) queryInput.value = '';
        if (container) container.innerHTML = '';
        if (badge) badge.innerText = '0 строк (0 мс)';
        if (errorBanner) errorBanner.classList.add('hidden');
    });

    queryInput?.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            executeQuery();
        } else if (e.key === 'F5') {
            e.preventDefault();
            executeQuery();
        }
    });

    btnExcel?.addEventListener('click', () => {
        if (!lastQueryResults || !lastQueryResults.rows || lastQueryResults.rows.length === 0) {
            app._showToast('⚠️ Нет данных для экспорта!');
            return;
        }
        if (window.XLSX) {
            const wsData = [lastQueryResults.columns, ...lastQueryResults.rows];
            const wb = window.XLSX.utils.book_new();
            const ws = window.XLSX.utils.aoa_to_sheet(wsData);
            window.XLSX.utils.book_append_sheet(wb, ws, "SQL_Результаты");
            window.XLSX.writeFile(wb, "PharmaGate_SQL_Query.xlsx");
            app._showToast('📊 Результаты SQL-запроса экспортированы в Excel!');
        }
    });

    btnCsv?.addEventListener('click', () => {
        if (!lastQueryResults || !lastQueryResults.rows || lastQueryResults.rows.length === 0) {
            app._showToast('⚠️ Нет данных для экспорта!');
            return;
        }
        const lines = [
            lastQueryResults.columns.join(';'),
            ...lastQueryResults.rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';'))
        ];
        const blob = new Blob(["\uFEFF" + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'PharmaGate_SQL_Query.csv';
        a.click();
        URL.revokeObjectURL(url);
        app._showToast('📄 Результаты SQL-запроса экспортированы в CSV!');
    });
}

// =========================================================================
// 7. 🌐 PWA FILE HANDLING & 8. WEB SHARE API
// =========================================================================

function _bindPwaFileHandling(app) {
    if ('launchQueue' in window && 'setConsumer' in window.launchQueue) {
        window.launchQueue.setConsumer(async (launchParams) => {
            if (launchParams.files && launchParams.files.length > 0) {
                for (const handle of launchParams.files) {
                    try {
                        const file = await handle.getFile();
                        await app.loadFile(file);
                        app.openApp('winEditor');
                        app._showToast(`📂 Файл '${file.name}' открыт из проводника Windows/macOS!`);
                    } catch (err) {
                        console.warn("[PWA LaunchQueue] Не удалось открыть файл:", err);
                    }
                }
            }
        });
    }
}

function _bindWebShare(app) {
    const btnShare = document.getElementById('btnToolbarShare');
    if (btnShare) {
        btnShare.addEventListener('click', async () => {
            if (navigator.share) {
                try {
                    const sum = app.records.reduce((acc, r) => acc + (parseFloat(r.SUMSTR || r.sumstr || 0) || 0), 0);
                    await navigator.share({
                        title: `Накладная: ${app.activeFileName || 'Документ EDI'}`,
                        text: `PharmaGate EDI — Проверено позиций: ${app.records.length}, общая сумма: ${PharmaMath.formatMoney(sum)} ₽`,
                        url: window.location.href
                    });
                    app._showToast('🌐 Накладная успешно отправлена через системное меню!');
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        app._showToast('ℹ️ Отправка отменена');
                    }
                }
            } else {
                app._showToast('ℹ️ Web Share API доступен на смартфонах и в современных браузерах по HTTPS.');
            }
        });
    }
}
