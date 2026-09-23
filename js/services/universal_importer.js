/**
 * js/services/universal_importer.js - ETL-модуль потокового импорта Excel, DBF, Access, JSON 1С и CSV.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { WebDBFEngine } from '../engine/dbf_engine.js';
import { DateEngine } from '../engine/date_engine.js';
import { PharmaMath } from '../engine/pharma_math.js';
import { EncodingGuard } from '../engine/text_engine.js';
import { PipelineSanitizers } from '../engine/pipeline_sanitizers.js';
import { getNaklSchema } from '../domain/models.js';

export const MAPPING_1C_TO_SENTINEL = {
    'PROD_CODE': 'CODEPST', 'CODE_PST': 'CODEPST', 'АРТИКУЛ': 'CODEPST', 'КОД': 'CODEPST', 
    'КОД_ТОВАРА': 'CODEPST', 'КОДТОВАРА': 'CODEPST', 'ITEM_CODE': 'CODEPST', 'KOD': 'CODEPST',
    'NAME': 'NAME', 'НАИМЕНОВАНИЕ': 'NAME', 'НАИМЕНОВАНИЕ_ТОВАРА': 'NAME', 'НАЗВАНИЕ': 'NAME', 
    'ТОВАР': 'NAME', 'PRODUCT_NAME': 'NAME', 'ПРЕПАРАТ': 'NAME', 'НОМЕНКЛАТУРА': 'NAME',
    'EAN13': 'EAN13', 'ШТРИХКОД': 'EAN13', 'ШТРИХ_КОД': 'EAN13', 'BARCODE': 'EAN13', 'EAN': 'EAN13',
    'SER': 'SER', 'СЕРИЯ': 'SER', 'ПАРТИЯ': 'SER', 'BATCH': 'SER', 'LOT': 'SER',
    'GDATE': 'GDATE', 'СРОК': 'GDATE', 'СРОК_ГОДНОСТИ': 'GDATE', 'ГОДЕН_ДО': 'GDATE', 'EXP_DATE': 'GDATE',
    'DATEMADE': 'DATEMADE', 'ДАТА_ВЫПУСКА': 'DATEMADE', 'ДАТА_ИЗГОТОВЛЕНИЯ': 'DATEMADE',
    'QNT': 'QNT', 'КОЛИЧЕСТВО': 'QNT', 'КОЛВО': 'QNT', 'КОЛ-ВО': 'QNT', 'QUANTITY': 'QNT',
    'PRICE1': 'PRICE1', 'ЦЕНА_ИЗГОТОВИТЕЛЯ': 'PRICE1', 'ЦЕНА_ПРОИЗВОДИТЕЛЯ': 'PRICE1',
    'PRICE2': 'PRICE2', 'ЦЕНА_С_НДС': 'PRICE2', 'ЦЕНА_ОТПУСКНАЯ': 'PRICE2', 'ЦЕНА': 'PRICE2',
    'PRICE2N': 'PRICE2N', 'ЦЕНА_БЕЗ_НДС': 'PRICE2N', 'ЦЕНА2Н': 'PRICE2N',
    'NDS': 'NDS', 'НДС': 'NDS', 'СТАВКА_НДС': 'NDS', 'VAT_RATE': 'NDS',
    'SUMSTR': 'SUMSTR', 'СУММА_С_НДС': 'SUMSTR', 'ВСЕГО_С_НДС': 'SUMSTR', 'СУММА': 'SUMSTR',
    'SUMSNDS': 'SUMSNDS', 'СУММА_НДС': 'SUMSNDS', 'НДС_СУММА': 'SUMSNDS',
    'FIRM': 'FIRM', 'ПРОИЗВОДИТЕЛЬ': 'FIRM', 'ИЗГОТОВИТЕЛЬ': 'FIRM',
    'CNTR': 'CNTR', 'СТРАНА': 'CNTR', 'СТРАНА_ПРОИСХОЖДЕНИЯ': 'CNTR',
    'NUMGTD': 'NUMGTD', 'ГТД': 'NUMGTD', 'НОМЕР_ГТД': 'NUMGTD', 'РУ': 'NUMGTD',
    'REGPRC': 'REGPRC', 'РЕЕСТРОВАЯ_ЦЕНА': 'REGPRC', 'ЖНВЛП': 'REGPRC',
    'GTIN': 'GTIN', 'ГТИН': 'GTIN', 'GTIN14': 'GTIN',
    'SUBJID': 'SUBJID', 'SUBJECT_ID': 'SUBJID', 'МОД': 'SUBJID',
    'PODRCD': 'PODRCD', 'КОД_АПТЕКИ': 'PODRCD', 'NDOC': 'NDOC', 'НОМЕР_НАКЛАДНОЙ': 'NDOC',
    'DATEDOC': 'DATEDOC', 'ДАТА_НАКЛАДНОЙ': 'DATEDOC', 'BILLNUM': 'BILLNUM', 'BILLDT': 'BILLDT'
};

export class UniversalImporter {
    static async importFile(fileOrBuffer, fileName = "document.xlsx", targetSchema = null) {
        const schema = targetSchema || getNaklSchema();
        const ext = fileName.split('.').pop().toLowerCase();
        let arrayBuffer;

        if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
            arrayBuffer = await fileOrBuffer.arrayBuffer();
        } else {
            arrayBuffer = fileOrBuffer;
        }

        let rawHeaders = [];
        let rawRecords = [];
        let formatInfo = "Unknown";
        let metaHeader = {};

        // 1. ИЗОЛЯЦИЯ
        if (ext === 'dbf') {
            const dbfData = WebDBFEngine.readDBF(arrayBuffer);
            rawHeaders = dbfData.fields.map(f => f.name);
            rawRecords = dbfData.records;
            formatInfo = `dBase III (${dbfData.activeEncoding.toUpperCase()}, байт 0x${dbfData.languageByte.toString(16)})`;
        } else if (ext === 'xlsx' || ext === 'xls') {
            if (!window.XLSX) throw new Error("Библиотека SheetJS (xlsx.full.min.js) не подключена.");
            const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

            if (jsonData.length > 0) {
                // Поиск строки заголовков
                let headerRowIdx = 0;
                for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
                    const rowStr = jsonData[i].join(' ').toUpperCase();
                    if (rowStr.includes('НАИМЕНОВАНИЕ') || rowStr.includes('ТОВАР') || rowStr.includes('ЦЕНА') || rowStr.includes('CODEPST')) {
                        headerRowIdx = i;
                        break;
                    }
                }
                rawHeaders = jsonData[headerRowIdx].map(h => String(h || '').trim());
                rawRecords = jsonData.slice(headerRowIdx + 1).map(row => {
                    const obj = {};
                    rawHeaders.forEach((h, cIdx) => {
                        if (h) obj[h] = row[cIdx] !== undefined ? row[cIdx] : "";
                    });
                    return obj;
                });
            }
            formatInfo = "Excel OpenXML (SheetJS)";
        } else if (ext === 'json') {
            const text = new TextDecoder('utf-8').decode(arrayBuffer);
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                rawRecords = parsed;
            } else if (parsed && typeof parsed === 'object') {
                metaHeader = { ...parsed };
                delete metaHeader.LINES;
                delete metaHeader.ITEMS;
                rawRecords = parsed.LINES || parsed.ITEMS || parsed.PRODUCTS || [];
            }
            rawHeaders = rawRecords.length > 0 ? Object.keys(rawRecords[0]) : [];
            formatInfo = "1C JSON Exchange v2026";
        } else {
            // CSV / TSV / TXT
            const text = new TextDecoder('windows-1251').decode(arrayBuffer);
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            const delimiter = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
            rawHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
            rawRecords = lines.slice(1).map(l => {
                const parts = l.split(delimiter);
                const obj = {};
                rawHeaders.forEach((h, idx) => {
                    obj[h] = parts[idx] ? parts[idx].trim().replace(/^"|"$/g, '') : "";
                });
                return obj;
            });
            formatInfo = `CSV (${delimiter === ';' ? 'Точка с запятой' : 'Табуляция'})`;
        }

        // 2. ОЧИСТКА ПРИЗРАКОВ
        const { records: cleanedRecords, ghostsCount } = PipelineSanitizers.cleanBatch(rawRecords);

        // 3. МАППИНГ И КАСТИНГ ТИПОВ
        const defaultDocDate = metaHeader.DATEDOC ? DateEngine.parseAnyDate(metaHeader.DATEDOC) : new Date().toISOString().split('T')[0];
        const defaultNdoc = String(metaHeader.NDOC || '1').trim();
        const defaultPodrcd = String(metaHeader.PODRCD || '001').trim();

        const mappedRecords = cleanedRecords.map(r => {
            const rowDict = {};

            Object.entries(r).forEach(([k, v]) => {
                const kClean = String(k).trim().toUpperCase().replace(/[\s.-]/g, '_');
                const targetKey = MAPPING_1C_TO_SENTINEL[kClean] || kClean;
                const fieldRule = schema.fields.find(f => f.name === targetKey);

                if (!fieldRule) {
                    rowDict[targetKey] = v;
                    return;
                }

                if (fieldRule.type === 'N' || fieldRule.type === 'F') {
                    rowDict[targetKey] = PharmaMath.cleanDecimal(v);
                } else if (fieldRule.type === 'D') {
                    rowDict[targetKey] = DateEngine.parseAnyDate(v);
                } else if (fieldRule.type === 'C') {
                    if (['CODEPST', 'EAN13', 'GTIN', 'SER'].includes(targetKey)) {
                        rowDict[targetKey] = EncodingGuard.sanitizeCodepstProtek(String(v || ''));
                    } else {
                        rowDict[targetKey] = EncodingGuard.sanitizeText366(String(v || ''));
                    }
                } else {
                    rowDict[targetKey] = v;
                }
            });

            // Автонаследование шапки
            if (!rowDict.NDOC) rowDict.NDOC = defaultNdoc;
            if (!rowDict.DATEDOC) rowDict.DATEDOC = defaultDocDate;
            if (!rowDict.PODRCD) rowDict.PODRCD = defaultPodrcd;
            if (!rowDict.BILLNUM) rowDict.BILLNUM = rowDict.NDOC;
            if (!rowDict.BILLDT) rowDict.BILLDT = rowDict.DATEDOC;
            if (!rowDict.NUMZ) rowDict.NUMZ = parseInt(rowDict.NDOC, 10) || 1;
            if (!rowDict.DATEZ) rowDict.DATEZ = rowDict.DATEDOC;

            return rowDict;
        });

        return {
            canonicalHeaders: schema.fields.map(f => f.name),
            mappedRecords,
            encodingInfo: formatInfo,
            metaHeader,
            ghostsRemoved: ghostsCount
        };
    }
}