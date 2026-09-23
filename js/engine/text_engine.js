/**
 * js/engine/text_engine.js - Текстовая санация и глубокий парсер GS1 DataMatrix (МДЛП).
 * Обеспечивает:
 * - Строгое сохранение регистра Base62 в серийных номерах (AI 21);
 * - Расчет дня 00 в AI 17 (срок годности до конца месяца);
 * - Замену латинских омоглифов-двойников в русских словах;
 * - Полную санацию текста под регламенты 36.6, A.v.e и Протек.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { DateEngine } from './date_engine.js';

export class ParsedDataMatrix {
    constructor(isValid, gtin, serial, cryptoKey, cryptoTail, expDate, batchLot, fullKiz, rawCode, errorMessage, productCategory) {
        this.isValid = isValid;
        this.gtin = gtin || '';
        this.serial = serial || ''; // СТРОГО регистрозависимый Base62!
        this.cryptoKey = cryptoKey || '';
        this.cryptoTail = cryptoTail || '';
        this.expDate = expDate || null;
        this.batchLot = batchLot || '';
        this.fullKiz = fullKiz || '';
        this.rawCode = rawCode || '';
        this.errorMessage = errorMessage || '';
        this.productCategory = productCategory || 'GENERAL';
    }

    toFnsXmlKiz() {
        if (this.fullKiz) return this.fullKiz;
        if (this.gtin && this.serial) return `01${this.gtin}21${this.serial}`;
        return this.rawCode;
    }
}

export class DataMatrixParser {
    static LP_PATTERN = /^01(?<gtin>\d{14})21(?<serial>[!-~]{13})/;
    static BAD_PATTERN = /^01(?<gtin>\d{14})21(?<serial>[!-~]{7,13})(?:\x1d|\u001d|91|$)/;
    static EXP_PATTERN = /17(?<exp>\d{6})/;
    static BATCH_PATTERN = /10(?<batch>[a-zA-Z0-9а-яА-Я\-_]{3,20})(?:\x1d|\u001d|17|21|91|$)/;
    static CRYPTO_PATTERN = /91(?<ck>[!-~]{4})(?:\x1d|\u001d)?92(?<ct>[!-~]{44,88})/;

    static cleanScannerArtifacts(rawCode) {
        if (!rawCode) return "";
        let s = String(rawCode).trim();
        s = s.replace(/^(?:\]d2|\]Q3|\[GS\]|\(01\))/, '');
        s = s.replace(/^[\x1d\u001d\x00]+/, '');
        return s;
    }

    static parse(rawCode) {
        if (!rawCode) {
            return new ParsedDataMatrix(false, "", "", "", "", null, "", "", "", "Пустой код маркировки", "GENERAL");
        }

        const cleanRaw = this.cleanScannerArtifacts(rawCode);
        let gtin = "", serial = "", cryptoKey = "", cryptoTail = "", expDate = null, batchLot = "";

        // 1. Извлечение срока годности (AI 17)
        const expMatch = this.EXP_PATTERN.exec(cleanRaw);
        if (expMatch && expMatch.groups) {
            const expStr = expMatch.groups.exp;
            const y = 2000 + parseInt(expStr.slice(0, 2), 10);
            const m = parseInt(expStr.slice(2, 4), 10);
            let d = parseInt(expStr.slice(4, 6), 10);

            if (m >= 1 && m <= 12) {
                if (d === 0) {
                    d = new Date(y, m, 0).getDate(); // Последний день месяца
                }
                expDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }

        // 2. Извлечение серии (AI 10)
        const batchMatch = this.BATCH_PATTERN.exec(cleanRaw);
        if (batchMatch && batchMatch.groups) {
            batchLot = batchMatch.groups.batch.trim();
        }

        // 3. Извлечение криптохвоста (AI 91/92)
        const cryptoMatch = this.CRYPTO_PATTERN.exec(cleanRaw);
        if (cryptoMatch && cryptoMatch.groups) {
            cryptoKey = cryptoMatch.groups.ck;
            cryptoTail = cryptoMatch.groups.ct;
        }

        // 4. Лекарственные препараты (13 знаков серийного номера)
        const lpMatch = this.LP_PATTERN.exec(cleanRaw);
        if (lpMatch && lpMatch.groups) {
            gtin = lpMatch.groups.gtin;
            serial = lpMatch.groups.serial; // Регистр Base62 сохранен!
            const kiz = `01${gtin}21${serial}`;
            return new ParsedDataMatrix(true, gtin, serial, cryptoKey, cryptoTail, expDate, batchLot, kiz, cleanRaw, "", "LP");
        }

        // 5. БАД / Антисептики (7..13 знаков)
        const badMatch = this.BAD_PATTERN.exec(cleanRaw);
        if (badMatch && badMatch.groups) {
            gtin = badMatch.groups.gtin;
            serial = badMatch.groups.serial;
            const kiz = `01${gtin}21${serial}`;
            return new ParsedDataMatrix(true, gtin, serial, cryptoKey, cryptoTail, expDate, batchLot, kiz, cleanRaw, "", "BAD");
        }

        return new ParsedDataMatrix(false, "", "", "", "", null, "", "", cleanRaw, "Некорректная структура маркировки", "GENERAL");
    }
}

export class EncodingGuard {
    static HOMOGLYPH_MAP = {
        'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х', 'y': 'у',
        'A': 'А', 'B': 'В', 'E': 'Е', 'K': 'К', 'M': 'М', 'H': 'Н', 'O': 'О',
        'P': 'Р', 'C': 'С', 'T': 'Т', 'X': 'Х', 'Y': 'У'
    };

    static fixHomoglyphs(text) {
        if (!text) return "";
        const words = String(text).split(' ');
        return words.map(word => {
            const hasCyr = /[а-яА-ЯёЁ]/.test(word);
            if (hasCyr) {
                return word.split('').map(ch => this.HOMOGLYPH_MAP[ch] || ch).join('');
            }
            return word;
        }).join(' ');
    }

    static sanitizeText366(text) {
        if (!text) return "";
        let s = String(text);

        // Санация типографики для DOS CP866
        s = s.replace(/[«»“”„‟]/g, '"')
             .replace(/[—–−‒]/g, '-')
             .replace(/№/g, 'N')
             .replace(/°/g, ' град.')
             .replace(/±/g, '+/-')
             .replace(/[µμ]/g, 'мк')
             .replace(/[\xa0\u200b\ufeff]/g, ' ')
             .replace(/""/g, '"');

        s = this.fixHomoglyphs(s);
        s = s.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ');
        return s.trim();
    }

    static sanitizeCodepstProtek(code) {
        if (!code) return "";
        let s = String(code).trim().replace(/[\xa0\u200b\t\s]/g, '');
        if (s.endsWith('.0')) s = s.slice(0, -2);
        return s.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\-_]/g, '').toUpperCase();
    }
}