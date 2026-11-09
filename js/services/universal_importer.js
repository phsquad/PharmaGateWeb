/**
 * js/services/universal_importer.js - ETL-модуль потокового импорта Excel, DBF, XML УПД 970@, Access, JSON 1С и CSV.
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
import { FuzzyColumnMatcher } from '../domain/fuzzy_column_matcher.js';
import { ColumnPresetManager } from '../domain/column_presets.js';
import { AccessWasmDriver } from './access_wasm_driver.js';

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
    /**
     * Полноценный парсер электронных УПД (Приказы ФНС России № ЕД-7-26/970@ и № ММВ-7-15/820@)
     */
    static parseUpdXml(xmlString) {
        if (typeof DOMParser === 'undefined') {
            throw new Error('DOMParser недоступен в данной среде.');
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Ошибка структуры XML: ' + parseError.textContent.slice(0, 100));
        }

        const metaHeader = {};
        const documentEl = doc.querySelector('Документ');
        if (documentEl) {
            metaHeader.NDOC = documentEl.getAttribute('ПорядНомСчФ') || documentEl.getAttribute('НомДок') || '1';
            metaHeader.DATEDOC = documentEl.getAttribute('ДатаСчФ') || documentEl.getAttribute('ДатаДок') || '';
        }

        const seller = doc.querySelector('СвПрод СвЮЛУч, СвПрод СвИП');
        if (seller) {
            metaHeader.SENDER_NAME = seller.getAttribute('НаимОрг') || seller.getAttribute('ФИО') || '';
            metaHeader.SENDER_INN = seller.getAttribute('ИННЮЛ') || seller.getAttribute('ИННФЛ') || '';
            metaHeader.SENDER_KPP = seller.getAttribute('КПП') || '';
        }

        const buyer = doc.querySelector('СвПокуп СвЮЛУч, СвПокуп СвИП');
        if (buyer) {
            metaHeader.RCV_NAME = buyer.getAttribute('НаимОрг') || buyer.getAttribute('ФИО') || '';
            metaHeader.RCV_INN = buyer.getAttribute('ИННЮЛ') || buyer.getAttribute('ИННФЛ') || '';
            metaHeader.RCV_KPP = buyer.getAttribute('КПП') || '';
        }

        const itemEls = doc.querySelectorAll('ТаблСчФакт СведТов');
        const rawRecords = [];

        itemEls.forEach((item, idx) => {
            const row = {};
            row.NAME = item.getAttribute('НаимТов') || ('Товар ' + (idx + 1));
            row.QNT = parseFloat(item.getAttribute('КолТов')) || 1.0;
            row.PRICE2N = parseFloat(item.getAttribute('ЦенаТов')) || 0.0;
            row.SUMSTR = parseFloat(item.getAttribute('СтТовУчНал')) || 0.0;
            row.SUMSNDS = parseFloat(item.getAttribute('СумНал')) || 0.0;

            const rawNds = item.getAttribute('НалСт') || '';
            row.NDS = parseInt(rawNds.replace(/\D/g, ''), 10) || 0;
            if (rawNds.toLowerCase().includes('без')) row.NDS = 0;

            if (row.QNT > 0 && row.SUMSTR > 0) {
                row.PRICE2 = PharmaMath.roundMoney(row.SUMSTR / row.QNT);
            } else if (row.PRICE2N > 0) {
                row.PRICE2 = PharmaMath.roundMoney(row.PRICE2N * (1 + row.NDS / 100));
            }

            const dop = item.querySelector('ДопСведТов');
            if (dop) {
                row.CODEPST = dop.getAttribute('Артикул') || dop.getAttribute('КодТов') || '';
            }

            const gtd = item.querySelector('СвТД');
            if (gtd) {
                row.NUMGTD = gtd.getAttribute('НомТД') || '';
                row.CNTR = gtd.getAttribute('КрНаимСтр') || gtd.getAttribute('КодПроисх') || '';
            }

            const kizEl = item.querySelector('НомСредИдент');
            if (kizEl) {
                const kiz = kizEl.getAttribute('КИЗ') || kizEl.getAttribute('НомУпак') || '';
                if (kiz) {
                    if (kiz.startsWith('01') && kiz.length >= 16) {
                        row.GTIN = kiz.slice(2, 16);
                        row.EAN13 = row.GTIN.slice(-13);
                    }
                }
            }

            const textInfs = item.querySelectorAll('ТекстИнф');
            textInfs.forEach(ti => {
                const ident = (ti.getAttribute('Идент') || '').toUpperCase();
                const val = ti.getAttribute('Значен') || '';
                if (ident.includes('СЕРИЯ') || ident === 'SER') row.SER = val;
                else if (ident.includes('СРОК') || ident.includes('ГОДЕН') || ident === 'GDATE') row.GDATE = val;
                else if (ident.includes('ИЗГОТОВЛЕНИЯ') || ident.includes('ВЫПУСКА') || ident === 'DATEMADE') row.DATEMADE = val;
                else if (ident.includes('ПРОИЗВОДИТЕЛ') || ident === 'PRICE1') row.PRICE1 = parseFloat(val) || 0.0;
                else if (ident.includes('РЕЕСТР') || ident.includes('ЖНВЛП') || ident === 'REGPRC') row.REGPRC = parseFloat(val) || 0.0;
                else if (ident.includes('ШТРИХ') || ident === 'EAN13') row.EAN13 = val;
                else if (ident.includes('GTIN')) row.GTIN = val;
                else if (ident.includes('ФИРМА') || ident.includes('ЗАВОД') || ident === 'FIRM') row.FIRM = val;
                else if (ident.includes('АПТЕК') || ident === 'PODRCD') row.PODRCD = val;
            });

            rawRecords.push(row);
        });

        return { metaHeader, rawRecords };
    }

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

        // 1. ИЗОЛЯЦИЯ И ПАРСИНГ ФОРМАТОВ
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
                let headerRowIdx = 0;
                for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
                    const rowStr = jsonData[i].join(' ').toUpperCase();
                    if (rowStr.includes('НАИМЕНОВАНИЕ') || rowStr.includes('ТОВАР') || rowStr.includes('ЦЕНА') || rowStr.includes('CODEPST') || rowStr.includes('АРТИКУЛ')) {
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
        } else if (ext === 'xml') {
            // XML УПД 970@ / 820@
            let xmlText;
            const bytes = new Uint8Array(arrayBuffer);
            if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
                xmlText = new TextDecoder('utf-8').decode(bytes.subarray(3));
            } else {
                try {
                    xmlText = new TextDecoder('windows-1251').decode(arrayBuffer);
                    if (xmlText.includes('encoding="utf-8"') || xmlText.includes("encoding='utf-8'")) {
                        xmlText = new TextDecoder('utf-8').decode(arrayBuffer);
                    }
                } catch {
                    xmlText = new TextDecoder('utf-8').decode(arrayBuffer);
                }
            }
            const xmlRes = this.parseUpdXml(xmlText);
            rawRecords = xmlRes.rawRecords;
            rawHeaders = rawRecords.length > 0 ? Object.keys(rawRecords[0]) : [];
            metaHeader = xmlRes.metaHeader;
            formatInfo = "XML УПД (Приказ ФНС 970@ / 820@)";
        } else if (ext === 'json') {
            const text = new TextDecoder('utf-8').decode(arrayBuffer);
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                rawRecords = parsed;
            } else if (parsed && typeof parsed === 'object') {
                metaHeader = { ...parsed };
                delete metaHeader.LINES;
                delete metaHeader.ITEMS;
                delete metaHeader.PRODUCTS;
                rawRecords = parsed.LINES || parsed.ITEMS || parsed.PRODUCTS || [];
            }
            rawHeaders = rawRecords.length > 0 ? Object.keys(rawRecords[0]) : [];
            formatInfo = "1C JSON Exchange v2026";
        } else if (ext === 'accdb' || ext === 'mdb') {
            try {
                const accRes = await AccessWasmDriver.readAccessDatabase(arrayBuffer);
                rawHeaders = accRes.columns || [];
                rawRecords = accRes.records || [];
                formatInfo = `MS Access (${accRes.tableName || ext.toUpperCase()})`;
            } catch (accErr) {
                console.warn("[Access Importer] Предупреждение:", accErr);
                throw new Error(`Формат MS Access (.${ext}): ${accErr.message}`);
            }
        } else {
            // CSV / TSV / TXT с автодетекцией UTF-8 / Windows-1251
            let text;
            const bytes = new Uint8Array(arrayBuffer);
            if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
                text = new TextDecoder('utf-8').decode(bytes.subarray(3));
            } else {
                try {
                    text = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
                } catch {
                    text = new TextDecoder('windows-1251').decode(arrayBuffer);
                }
            }
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length > 0) {
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
                formatInfo = `CSV (${delimiter === ';' ? 'Точка с запятой' : (delimiter === '\t' ? 'Табуляция' : 'Запятая')})`;
            }
        }

        // 2. ОЧИСТКА ПРИЗРАКОВ
        const { records: cleanedRecords, ghostsCount } = PipelineSanitizers.cleanBatch(rawRecords);

        // 3. МАППИНГ И КАСТИНГ ТИПОВ С ПОДДЕРЖКОЙ AI-МАТЧЕРА
        const defaultDocDate = metaHeader.DATEDOC ? DateEngine.parseAnyDate(metaHeader.DATEDOC) : new Date().toISOString().split('T')[0];
        const defaultNdoc = String(metaHeader.NDOC || '1').trim();
        const defaultPodrcd = String(metaHeader.PODRCD || '001').trim();

        // Сбор образцов значений для нечеткого маппинга
        const headerSamples = new Map();
        if (cleanedRecords.length > 0) {
            rawHeaders.forEach(h => {
                const samples = cleanedRecords.slice(0, 5).map(r => r[h]);
                headerSamples.set(h, samples);
            });
        }

        const mappedRecords = cleanedRecords.map(r => {
            const rowDict = {};

            Object.entries(r).forEach(([k, v]) => {
                const kClean = String(k).trim().toUpperCase().replace(/[\s.-]/g, '_');
                let targetKey = MAPPING_1C_TO_SENTINEL[kClean];

                // Если не найдено в статическом словаре, проверяем интеллектуальный AI-матчер
                if (!targetKey && typeof FuzzyColumnMatcher !== 'undefined') {
                    const samples = headerSamples.get(k) || [v];
                    const suggestion = FuzzyColumnMatcher.matchColumn(k, samples, schema);
                    if (suggestion && suggestion.suggestedTarget && suggestion.confidencePercent >= 65) {
                        targetKey = suggestion.suggestedTarget;
                    }
                }

                if (!targetKey) {
                    targetKey = kClean;
                }

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
