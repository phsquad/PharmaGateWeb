/**
 * js/engine/pharma_math.js - Финансово-фармацевтический модуль расчетов и GS1 Modulo-10.
 * Реализует:
 * - Банковское округление (ROUND_HALF_UP);
 * - Дельта-расчет НДС (SUMSTR = SUM_NO_NDS + SUMSNDS);
 * - Контроль предельных цен реестра ЖНВЛП;
 * - Универсальный алгоритм контрольных сумм GS1 Modulo-10.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class PharmaMath {
    static cleanDecimal(val, defaultVal = 0.0) {
        if (val === null || val === undefined) return defaultVal;
        if (typeof val === 'number') return isNaN(val) ? defaultVal : val;

        let s = String(val).trim();
        if (!s || /^(none|null|nan|-|б\/ц|бесплатно)$/i.test(s)) return defaultVal;

        // Защита от дат
        if (/\d{1,4}[./-]\d{1,2}[./-]\d{2,4}/.test(s)) return defaultVal;

        s = s.replace(/[₽$€]|руб\.?|kop\.?/gi, '')
             .replace(/[\s\xa0\u200b']/g, '')
             .replace(',', '.');

        s = s.replace(/[^\d.-]/g, '');
        if (s.indexOf('.') !== s.lastIndexOf('.')) {
            const parts = s.split('.');
            s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
        }

        const num = parseFloat(s);
        return isNaN(num) ? defaultVal : num;
    }

    static roundMoney(val) {
        const num = this.cleanDecimal(val);
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    static calculateLine(qnt, price2, ndsPercent = 10) {
        const q = this.cleanDecimal(qnt, 1.0);
        const p2 = this.roundMoney(price2);
        const nds = this.cleanDecimal(ndsPercent, 10.0);

        if (q <= 0 || p2 <= 0) {
            return { price2n: 0.0, sumstr: 0.0, sumsnds: 0.0 };
        }

        const sumstr = this.roundMoney(q * p2);

        if (nds === 0) {
            return { price2n: p2, sumstr: sumstr, sumsnds: 0.0 };
        }

        const ndsRate = 1.0 + (nds / 100.0);
        const price2n = this.roundMoney(p2 / ndsRate);
        const sumNoNds = this.roundMoney(sumstr / ndsRate);
        const sumsnds = this.roundMoney(sumstr - sumNoNds);

        return { price2n, sumstr, sumsnds };
    }

    static checkJnvlpCeiling(price2n, regprc, maxMarkupPercent = 25.0) {
        const p2n = this.cleanDecimal(price2n);
        const reg = this.cleanDecimal(regprc);
        if (reg <= 0 || p2n <= 0) return { isExceeded: false, message: "" };

        const ceiling = this.roundMoney(reg * (1.0 + maxMarkupPercent / 100.0));
        if (p2n > ceiling) {
            const diff = this.roundMoney(p2n - ceiling);
            return {
                isExceeded: true,
                message: `Превышение цены ЖНВЛП на ${diff.toFixed(2)} руб. (Лимит: ${ceiling.toFixed(2)} руб.)`
            };
        }
        return { isExceeded: false, message: "" };
    }
}

export class GS1BarcodeValidator {
    static calculateModulo10(digitsStr) {
        const clean = String(digitsStr || '').replace(/\D/g, '');
        if (!clean) return "";

        let sum = 0;
        const len = clean.length;
        for (let i = 0; i < len; i++) {
            const d = parseInt(clean[len - 1 - i], 10);
            const weight = (i % 2 === 0) ? 3 : 1;
            sum += d * weight;
        }

        const checkDigit = (10 - (sum % 10)) % 10;
        return String(checkDigit);
    }

    static validateEan13(ean) {
        const clean = String(ean || '').replace(/\D/g, '');
        if (clean.length !== 13) return false;
        return clean[12] === this.calculateModulo10(clean.slice(0, 12));
    }

    static repairEan13(val) {
        let raw = String(val || '').trim();
        if (raw.endsWith('.0')) raw = raw.slice(0, -2);
        const clean = raw.replace(/\D/g, '');

        if (!clean) return { ean13: "", isModified: false, desc: "" };

        if (clean.length === 14 && clean.startsWith('0')) {
            const cand = clean.slice(1);
            if (this.validateEan13(cand)) return { ean13: cand, isModified: true, desc: "EAN13 извлечен из GTIN-14" };
        }

        if (clean.length === 12) {
            const check = this.calculateModulo10(clean);
            return { ean13: `${clean}${check}`, isModified: true, desc: "Рассчитана контрольная сумма EAN-13" };
        }

        if (clean.length > 0 && clean.length < 12) {
            const padded = clean.padStart(12, '0');
            const check = this.calculateModulo10(padded);
            return { ean13: `${padded}${check}`, isModified: true, desc: "Дополнен нулями до 13 знаков" };
        }

        if (clean.length === 13) {
            if (this.validateEan13(clean)) {
                return { ean13: clean, isModified: clean !== raw, desc: "EAN13 валиден" };
            }
            const recalc = `${clean.slice(0, 12)}${this.calculateModulo10(clean.slice(0, 12))}`;
            return { ean13: recalc, isModified: true, desc: "Исправлена контрольная сумма EAN13" };
        }

        return { ean13: raw, isModified: false, desc: "" };
    }
}