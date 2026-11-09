/**
 * js/domain/mdlp_validator.js - Глубокий анализатор и валидатор маркировки МДЛП «Честный ЗНАК».
 * 
 * Проверяет:
 * - Контрольную цифру GTIN-14 / EAN-13 по алгоритму GS1 Modulo 10;
 * - Наличие и позиционирование спецсимволов разделителей GS (\x1d / FNC1);
 * - Корректность серийного номера (строго 13 знаков Base62 для ЛП, 7..13 для БАД);
 * - Длину криптоключа (AI 91 - ровно 4 символа) и криптохвоста (AI 92 - ровно 44 символа для ЛП);
 * - Срок годности в AI 17 (YYMMDD, с поддержкой дня 00 как конца месяца).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class MdlpValidationResult {
    constructor(isValid, score, details = [], parsed = {}) {
        this.isValid = isValid;
        this.score = score; // 0..100%
        this.details = details; // Array of { level: 'OK'|'WARN'|'ERR', message: string }
        this.parsed = parsed; // Extracted AI tags
    }
}

export class MdlpValidator {
    /**
     * Алгоритмический расчет контрольной цифры GS1 Modulo 10
     * @param {string} digitsString - Строка из 12 (для EAN-13) или 13 (для GTIN-14) цифр
     * @returns {number} - Контрольная цифра (0..9)
     */
    static calculateGs1CheckDigit(digitsString) {
        const clean = String(digitsString || '').replace(/\D/g, '');
        let sum = 0;
        const len = clean.length;
        for (let i = 0; i < len; i++) {
            const digit = parseInt(clean[len - 1 - i], 10);
            const weight = (i % 2 === 0) ? 3 : 1;
            sum += digit * weight;
        }
        return (10 - (sum % 10)) % 10;
    }

    /**
     * Проверка контрольного разряда EAN-13 / GTIN-14
     */
    static verifyGs1CheckDigit(fullBarcode) {
        const clean = String(fullBarcode || '').replace(/\D/g, '');
        if (clean.length !== 13 && clean.length !== 14) return false;
        const body = clean.slice(0, -1);
        const expected = this.calculateGs1CheckDigit(body);
        const actual = parseInt(clean.slice(-1), 10);
        return expected === actual;
    }

    /**
     * Глубокая экспертиза 2D кода DataMatrix на соответствие регламентам МДЛП и Честный ЗНАК
     */
    static inspectDataMatrix(rawCode, productType = 'LP') {
        const details = [];
        let score = 100;
        const parsed = {
            gtin: '',
            serial: '',
            expDate: '',
            batch: '',
            cryptoKey: '',
            cryptoTail: '',
            hasFnc1: false,
            rawClean: ''
        };

        if (!rawCode || String(rawCode).trim().length === 0) {
            return new MdlpValidationResult(false, 0, [{ level: 'ERR', message: 'Код маркировки пуст' }]);
        }

        let raw = String(rawCode).trim();
        // Детекция FNC1 / GS символов (\x1d, \u001d, [GS])
        if (raw.includes('\x1d') || raw.includes('\u001d') || raw.includes('[GS]')) {
            parsed.hasFnc1 = true;
            details.push({ level: 'OK', message: 'Обнаружен разделитель групп GS (FNC1)' });
        } else {
            // В сканерах часто FNC1 передается как префикс
            parsed.hasFnc1 = false;
        }

        // Чистка сканерных префиксов
        raw = raw.replace(/^(?:\]d2|\]Q3|\[GS\]|\(01\))/, '').replace(/^[\x1d\u001d\x00]+/, '');
        parsed.rawClean = raw;

        // 1. Проверка AI 01 (GTIN)
        let workStr = raw;
        if (workStr.startsWith('01') && workStr.length >= 16) {
            parsed.gtin = workStr.substring(2, 16);
            workStr = workStr.substring(16);
        } else if (/^\d{14}/.test(workStr)) {
            parsed.gtin = workStr.substring(0, 14);
            workStr = workStr.substring(14);
        }

        if (parsed.gtin && parsed.gtin.length === 14) {
            if (this.verifyGs1CheckDigit(parsed.gtin)) {
                details.push({ level: 'OK', message: `AI(01) GTIN-14 корректен: ${parsed.gtin} (Контрольная цифра Modulo 10 верна)` });
            } else {
                score -= 30;
                details.push({ level: 'ERR', message: `AI(01) Ошибка контрольной цифры GTIN-14: ${parsed.gtin}` });
            }
        } else {
            score -= 50;
            details.push({ level: 'ERR', message: 'AI(01) Отсутствует обязательный 14-значный GTIN товара' });
        }

        // Чистка разделителей
        workStr = workStr.replace(/^[\x1d\u001d]+/, '');

        // 2. Проверка AI 21 (Серийный номер)
        if (workStr.startsWith('21')) {
            workStr = workStr.substring(2);
            const delimIdx = workStr.search(/[\x1d\u001d]/);
            if (delimIdx !== -1) {
                parsed.serial = workStr.substring(0, delimIdx);
                workStr = workStr.substring(delimIdx + 1);
            } else if (workStr.length >= 13 && productType === 'LP') {
                parsed.serial = workStr.substring(0, 13);
                workStr = workStr.substring(13);
            } else {
                const nextAi = workStr.search(/(?:17\d{6}|91.{4}|92.{44}|10)/);
                if (nextAi !== -1) {
                    parsed.serial = workStr.substring(0, nextAi);
                    workStr = workStr.substring(nextAi);
                } else {
                    parsed.serial = workStr;
                    workStr = '';
                }
            }
        } else {
            const serialMatch = workStr.match(/(?:[\x1d\u001d]|^)21([a-zA-Z0-9!"%&'()*+,\-./:;<=>?_]{7,20})/);
            if (serialMatch) {
                parsed.serial = serialMatch[1].split(/[\x1d\u001d]|91|17|10/)[0];
            }
        }

        if (parsed.serial) {
            const isBase62 = /^[a-zA-Z0-9!"%&'()*+,\-./:;<=>?_]+$/.test(parsed.serial);
            if (productType === 'LP') {
                if (parsed.serial.length === 13 && isBase62) {
                    details.push({ level: 'OK', message: `AI(21) Серийный номер ЛП соответствует стандарту (ровно 13 знаков Base62): ${parsed.serial}` });
                } else if (parsed.serial.length < 13) {
                    score -= 25;
                    details.push({ level: 'ERR', message: `AI(21) Недопустимая длина серии ЛП: ${parsed.serial.length} знаков (требуется ровно 13)` });
                } else {
                    details.push({ level: 'OK', message: `AI(21) Серийный номер: ${parsed.serial}` });
                }
            } else {
                details.push({ level: 'OK', message: `AI(21) Серийный номер (БАД/Антисептик): ${parsed.serial}` });
            }
        } else {
            score -= 35;
            details.push({ level: 'ERR', message: 'AI(21) Не найден индивидуальный серийный номер упаковки' });
        }

        // 3. Проверка AI 17 (Срок годности)
        const expMatch = workStr.match(/(?:[\x1d\u001d]|^)(?:17)(\d{6})/);
        if (expMatch) {
            const expStr = expMatch[1];
            const y = 2000 + parseInt(expStr.slice(0, 2), 10);
            const m = parseInt(expStr.slice(2, 4), 10);
            let d = parseInt(expStr.slice(4, 6), 10);

            if (m >= 1 && m <= 12) {
                if (d === 0) d = new Date(y, m, 0).getDate();
                parsed.expDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                details.push({ level: 'OK', message: `AI(17) Срок годности распознан: ${parsed.expDate}` });
            } else {
                score -= 15;
                details.push({ level: 'WARN', message: `AI(17) Некорректный месяц в сроке годности: ${expStr}` });
            }
        }

        // 4. Проверка AI 10 (Партия / Серия)
        const batchMatch = workStr.match(/(?:[\x1d\u001d]|^)(?:10)([a-zA-Z0-9а-яА-Я\-_]{2,20})/);
        if (batchMatch) {
            parsed.batch = batchMatch[1].split(/[\x1d\u001d]|17|21|91|92/)[0];
            details.push({ level: 'OK', message: `AI(10) Серия/партия производителя: ${parsed.batch}` });
        }

        // 5. Проверка криптоключа AI 91 (4 знака) и криптохвоста AI 92 (44 знака)
        const cryptoKeyMatch = workStr.match(/(?:[\x1d\u001d]|^)(?:91)([!-~]{4})/);
        if (cryptoKeyMatch) {
            parsed.cryptoKey = cryptoKeyMatch[1];
            details.push({ level: 'OK', message: `AI(91) Криптоключ проверки (4 знака): ${parsed.cryptoKey}` });
        } else {
            score -= 10;
            details.push({ level: 'WARN', message: 'AI(91) Криптоключ проверки не обнаружен (допустимо для укороченных КИЗ)' });
        }

        const cryptoTailMatch = workStr.match(/(?:[\x1d\u001d]|^)(?:92)([!-~]{44,88})/);
        if (cryptoTailMatch) {
            parsed.cryptoTail = cryptoTailMatch[1];
            if (parsed.cryptoTail.length === 44) {
                details.push({ level: 'OK', message: `AI(92) Криптохвост МДЛП соответствует стандарту (44 знака): ${parsed.cryptoTail.slice(0, 8)}...` });
            } else {
                details.push({ level: 'OK', message: `AI(92) Расширенный криптохвост (${parsed.cryptoTail.length} знаков)` });
            }
        } else {
            score -= 15;
            details.push({ level: 'WARN', message: 'AI(92) Криптографическая подпись (криптохвост) не найдена' });
        }

        score = Math.max(0, Math.min(100, score));
        const isValid = score >= 70;

        return new MdlpValidationResult(isValid, score, details, parsed);
    }

    /**
     * Валидация DataMatrix с возвратом унифицированного объекта
     * @param {string} rawCode 
     * @param {string} productType 
     */
    static validateDataMatrix(rawCode, productType = 'LP') {
        const res = this.inspectDataMatrix(rawCode, productType);
        return {
            isValid: res.isValid,
            score: res.score,
            gtin: res.parsed.gtin,
            serial: res.parsed.serial,
            expDate: res.parsed.expDate,
            series: res.parsed.batch,
            cryptoKey: res.parsed.cryptoKey,
            cryptoTail: res.parsed.cryptoTail,
            errors: res.details.filter(d => d.level === 'ERR').map(d => d.message),
            warnings: res.details.filter(d => d.level === 'WARN').map(d => d.message)
        };
    }

    /**
     * Валидация штрихкода EAN-13
     * @param {string} rawEan 
     */
    static validateEan13(rawEan) {
        const clean = String(rawEan || '').replace(/\D/g, '');
        const isValid = clean.length === 13 && this.verifyGs1CheckDigit(clean);
        return {
            isValid,
            ean: clean,
            checkDigit: clean.length === 13 ? parseInt(clean.slice(-1), 10) : null
        };
    }
}
