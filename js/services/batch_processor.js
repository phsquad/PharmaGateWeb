/**
 * js/services/batch_processor.js - Пакетный конвейер потоковой обработки накладных и формирования ZIP-архивов.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { UniversalImporter } from './universal_importer.js';
import { FLKEngine } from '../domain/flk_engine.js';
import { WebDBFEngine, DBFFieldDescriptor } from '../engine/dbf_engine.js';
import { ProfileManager } from '../domain/network_profiles.js';
import { UpdFns970Generator } from './export_service.js';
import { getNaklSchema } from '../domain/models.js';

export class BatchFileItem {
    constructor(file, index) {
        this.id = 'batch_' + Date.now() + '_' + index;
        this.file = file;
        this.name = file.name;
        this.size = file.size;
        this.status = 'QUEUED'; // 'QUEUED', 'PROCESSING', 'DONE', 'ERROR'
        this.recordsCount = 0;
        this.totalSum = 0;
        this.issuesBefore = 0;
        this.issuesAfter = 0;
        this.fixedCount = 0;
        this.detectedProfile = 'neofarm';
        this.parsedData = null;
        this.repairedRecords = [];
        this.repairedBuffer = null;
        this.errorMsg = '';
    }
}

export class BatchProcessorService {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.schema = getNaklSchema();
        this.onProgress = null;
    }

    addFiles(files) {
        const added = [];
        for (let i = 0; i < files.length; i++) {
            const item = new BatchFileItem(files[i], this.queue.length + i);
            this.queue.push(item);
            added.push(item);
        }
        return added;
    }

    clearQueue() {
        this.queue = [];
    }

    async processAll(profileKey = 'auto') {
        this.isProcessing = true;
        let processedCount = 0;

        for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];
            if (item.status === 'DONE') continue;

            item.status = 'PROCESSING';
            if (this.onProgress) this.onProgress(i, this.queue.length, item);

            try {
                const report = await UniversalImporter.importFile(item.file, item.name, this.schema);
                item.parsedData = report;
                item.recordsCount = report.mappedRecords.length;

                // Детекция профиля
                const targetProfile = profileKey === 'auto' 
                    ? (ProfileManager.detectBestProfile(report.canonicalHeaders, report.mappedRecords, report.metaHeader) || 'neofarm')
                    : profileKey;
                item.detectedProfile = targetProfile;

                // Первичный аудит ФЛК
                const initialIssues = FLKEngine.validateDocument(this.schema, report.mappedRecords, targetProfile);
                item.issuesBefore = initialIssues.length;

                // Авто-ремонт 99%
                const { repairedRecords, fixedCount } = FLKEngine.autoRepairRecords(this.schema, report.mappedRecords, targetProfile);
                item.repairedRecords = repairedRecords;
                item.fixedCount = fixedCount;

                // Повторный аудит ФЛК
                const finalIssues = FLKEngine.validateDocument(this.schema, repairedRecords, targetProfile);
                item.issuesAfter = finalIssues.length;

                // Подсчет суммы
                let sum = 0;
                repairedRecords.forEach(r => { sum += parseFloat(r.SUMSTR || 0) || 0; });
                item.totalSum = sum;

                // Генерация бинарного файла на выходе
                const ext = item.name.split('.').pop().toLowerCase();
                if (ext === 'xml') {
                    const xmlOut = UpdFns970Generator.generateXml(repairedRecords, report.metaHeader);
                    item.repairedBuffer = xmlOut.arrayBuffer;
                } else {
                    const fields = this.schema.fields.map(f => new DBFFieldDescriptor(f.name, f.type, f.length, f.decimal));
                    item.repairedBuffer = WebDBFEngine.writeDBF(fields, repairedRecords, 'cp866');
                }

                item.status = 'DONE';
            } catch (err) {
                item.status = 'ERROR';
                item.errorMsg = err.message;
                console.error(`[BatchProcessor] Ошибка файла ${item.name}:`, err);
            }

            processedCount++;
            if (this.onProgress) this.onProgress(processedCount, this.queue.length, item);
        }

        this.isProcessing = false;
        return this.queue;
    }

    /**
     * Создание сводного реестра приёмки в Excel (SheetJS)
     */
    generateSummaryRegistryExcel() {
        if (!window.XLSX) return null;

        const summaryRows = [
            ["СВОДНЫЙ РЕЕСТР ПАКЕТНОЙ ПРИЁМКИ И АУДИТА НАКЛАДНЫХ PHARMAGATE"],
            [`Дата формирования: ${new Date().toLocaleString('ru-RU')}`],
            [`Всего файлов в пакете: ${this.queue.length}`],
            []
        ];

        const header = [
            "№",
            "Имя исходного файла",
            "Статус обработки",
            "Целевой шлюз сети",
            "Строк",
            "Сумма с НДС, руб.",
            "Замечаний до ремонта",
            "Исправлено замечаний",
            "Остаточных замечаний",
            "Результат"
        ];
        const dataRows = [header];

        let grandTotalSum = 0;
        let grandTotalRows = 0;
        let grandTotalFixed = 0;

        this.queue.forEach((item, idx) => {
            grandTotalSum += item.totalSum;
            grandTotalRows += item.recordsCount;
            grandTotalFixed += item.fixedCount;

            dataRows.push([
                idx + 1,
                item.name,
                item.status === 'DONE' ? 'УСПЕШНО' : 'ОШИБКА',
                ProfileManager.getProfile(item.detectedProfile)?.title || item.detectedProfile,
                item.recordsCount,
                item.totalSum.toFixed(2),
                item.issuesBefore,
                item.fixedCount,
                item.issuesAfter,
                item.status === 'DONE' ? 'Готов к отправке на FTP' : item.errorMsg
            ]);
        });

        dataRows.push([]);
        dataRows.push([
            "ИТОГО ПО ПАКЕТУ:", "", "", "", grandTotalRows, grandTotalSum.toFixed(2), "", grandTotalFixed, "", ""
        ]);

        const ws = window.XLSX.utils.aoa_to_sheet([...summaryRows, ...dataRows]);
        ws['!cols'] = [
            { wch: 5 }, { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 8 },
            { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }
        ];

        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Сводный реестр");
        return wb;
    }

    /**
     * Формирование и скачивание единого ZIP-архива
     */
    async downloadZipBundle(archiveName = 'Пакет_Накладных_PharmaGate.zip') {
        const doneItems = this.queue.filter(i => i.status === 'DONE' && i.repairedBuffer);
        if (doneItems.length === 0) throw new Error("Нет успешно обработанных файлов для архивации.");

        // Проверяем наличие JSZip в глобальной области
        if (window.JSZip) {
            const zip = new window.JSZip();
            const folder = zip.folder("repaired_invoices");

            doneItems.forEach(item => {
                const baseName = item.name.replace(/\.[^/.]+$/, "");
                const ext = item.name.split('.').pop().toLowerCase();
                const outName = `${baseName}_fixed.${ext === 'xml' ? 'xml' : 'dbf'}`;
                folder.file(outName, item.repairedBuffer);
            });

            // Добавляем Excel реестр внутрь архива
            const wb = this.generateSummaryRegistryExcel();
            if (wb) {
                const excelBuf = window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
                zip.file("Сводный_реестр_приёмки.xlsx", excelBuf);
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            const blobUrl = URL.createObjectURL(content);
            link.href = blobUrl;
            link.download = archiveName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            return true;
        } else {
            // Fallback без JSZip: скачиваем сводный Excel и файлы по отдельности
            const wb = this.generateSummaryRegistryExcel();
            if (wb) window.XLSX.writeFile(wb, "Сводный_реестр_приёмки.xlsx");

            doneItems.forEach((item, delayIdx) => {
                setTimeout(() => {
                    WebDBFEngine.downloadAsFile(item.repairedBuffer, `fixed_${item.name}`);
                }, delayIdx * 300);
            });
            return true;
        }
    }
}
