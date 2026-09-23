/**
 * js/domain/commercial_guard.js - Служба коммерческого аудита и Anti-Fraud контроля.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { PharmaMath } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';
import { ValidationIssue } from './models.js';
import { EncodingGuard } from '../engine/text_engine.js';

export class CommercialGuard {
    static SUSPICIOUS_SERIES = /^(?:000000|123456|тест|test|xxxxx|000|---|111111|999999)$/i;
    static ANOMALOUS_QUANTITY_THRESHOLD = 10000.0;
    static MAX_ALLOWED_PRICE_VARIANCE_RATIO = 1.20; // 20% разброс

    /**
     * Построчный коммерческий аудит финансовых рисков
     * @param {Array<Object>} records 
     * @returns {Array<ValidationIssue>}
     */
    static inspect(records) {
        const anomalies = [];
        if (!records || records.length === 0) return anomalies;

        const seenItems = new Map();
        const seenKizs = new Map();
        const itemPrices = new Map();

        records.forEach((rec, idx) => {
            const rowNum = idx + 1;
            const codepst = String(rec.CODEPST || '').trim();
            const ser = String(rec.SER || '').trim().toUpperCase();
            const name = EncodingGuard.sanitizeText366(String(rec.NAME || `Товар ${rowNum}`));

            const qnt = PharmaMath.cleanDecimal(rec.QNT, 0.0);
            const p1 = PharmaMath.cleanDecimal(rec.PRICE1, 0.0);
            const p2 = PharmaMath.cleanDecimal(rec.PRICE2, 0.0);
            const p2n = PharmaMath.cleanDecimal(rec.PRICE2N, 0.0);
            const regprc = PharmaMath.cleanDecimal(rec.REGPRC, 0.0);

            // 1. Дубликаты товарных позиций (CODEPST + SER)
            if (codepst && ser && ser !== "Б/С") {
                const comboKey = `${codepst}_${ser}`;
                if (seenItems.has(comboKey)) {
                    const firstRow = seenItems.get(comboKey);
                    anomalies.push(new ValidationIssue(
                        "CRITICAL", "CODEPST", rowNum,
                        `Дубликат в строке ${rowNum}: Препарат '${name}' с серией '${ser}' уже указан в строке ${firstRow}!`,
                        "DUPLICATE_ITEM_COMBO", "ERR_DUPLICATE_ITEM", false
                    ));
                } else {
                    seenItems.set(comboKey, rowNum);
                }
            }

            // 2. Дубликаты маркировки DataMatrix KIZ (Base62)
            const rawCisArray = rec.RAW_CIS_ARRAY || [];
            if (Array.isArray(rawCisArray)) {
                rawCisArray.forEach(kiz => {
                    const cleanKiz = String(kiz || '').trim();
                    if (cleanKiz) {
                        if (seenKizs.has(cleanKiz)) {
                            const prevRow = seenKizs.get(cleanKiz);
                            anomalies.push(new ValidationIssue(
                                "CRITICAL", "GTIN", rowNum,
                                `Повторный КИЗ маркировки в строке ${rowNum}: Код DataMatrix уже использован в строке ${prevRow}! Блокировка ГИС МТ.`,
                                "DUPLICATE_DATAMATRIX", "ERR_DUPLICATE_DATAMATRIX", false
                            ));
                        } else {
                            seenKizs.set(cleanKiz, rowNum);
                        }
                    }
                });
            }

            // 3. Защита от нулевых и отрицательных количеств
            if (qnt <= 0) {
                anomalies.push(new ValidationIssue(
                    "CRITICAL", "QNT", rowNum,
                    `Недопустимое количество в строке ${rowNum}: Указано ${qnt} шт.!`,
                    "NON_POSITIVE_QNT", "ERR_INVALID_QUANTITY", false
                ));
            }

            // 4. Защита от нулевых отпускных цен
            if (qnt > 0 && p2 <= 0) {
                anomalies.push(new ValidationIssue(
                    "CRITICAL", "PRICE2", rowNum,
                    `НУЛЕВАЯ ЦЕНА в строке ${rowNum}: Указано количество ${qnt} шт., но отпускная цена PRICE2 = 0.00 руб.!`,
                    "ZERO_PRICE_ACTIVE_QNT", "ERR_ZERO_PRICE", false
                ));
            }

            // 5. Контроль сроков годности
            const gDate = DateEngine.parseAnyDate(rec.GDATE);
            if (gDate) {
                const daysLeft = DateEngine.getDaysLeft(gDate);
                if (daysLeft <= 0) {
                    anomalies.push(new ValidationIssue(
                        "CRITICAL", "GDATE", rowNum,
                        `ПРОСРОЧЕННЫЙ ПРЕПАРАТ в строке ${rowNum}: Срок истёк (${DateEngine.formatForUI(gDate)})! Реализация запрещена ст. 57 ФЗ №61.`,
                        "EXPIRED_DRUG", "ERR_EXPIRED_DRUG", false
                    ));
                } else if (daysLeft < 90) {
                    anomalies.push(new ValidationIssue(
                        "WARNING", "GDATE", rowNum,
                        `Критический остаточный срок в строке ${rowNum}: Осталось ${daysLeft} дн. (${DateEngine.formatForUI(gDate)}). Риск возврата сетью!`,
                        "SHORT_SHELF_LIFE", "ERR_SHORT_SHELF_LIFE", true
                    ));
                }
            }

            // 6. Контроль предельных реестровых цен ЖНВЛП (REGPRC)
            if (regprc > 0 && p2n > 0) {
                const check = PharmaMath.checkJnvlpCeiling(p2n, regprc, 25.0);
                if (check.isExceeded) {
                    anomalies.push(new ValidationIssue(
                        "CRITICAL", "REGPRC", rowNum,
                        `Превышение предельной цены ЖНВЛП в строке ${rowNum}: ${check.message}`,
                        "JNVLP_CEILING_EXCEEDED", "ERR_JNVLP_OVERPRICE", false
                    ));
                }
            }

            // 7. Выявление аномалий наценки (>40% или демпинг)
            if (p1 > 0 && p2 > 0) {
                const ratio = p2 / p1;
                if (ratio > 1.40) {
                    const markup = ((ratio - 1.0) * 100).toFixed(1);
                    anomalies.push(new ValidationIssue(
                        "WARNING", "PRICE2", rowNum,
                        `Завышенная наценка в строке ${rowNum}: +${markup}% к цене изготовителя!`,
                        "MARKUP_ANOMALY_HIGH", "ERR_PRICE_MARKUP_ANOMALY", true
                    ));
                } else if (ratio < 0.30) {
                    anomalies.push(new ValidationIssue(
                        "WARNING", "PRICE2", rowNum,
                        `Критический демпинг в строке ${rowNum}: Цена в ${(1 / ratio).toFixed(1)} раз ниже себестоимости изготовителя!`,
                        "MARKUP_ANOMALY_LOW", "ERR_PRICE_MARKUP_ANOMALY", true
                    ));
                }
            }

            // 8. Контроль опечаток разряда количества (QNT > 10,000)
            if (qnt > this.ANOMALOUS_QUANTITY_THRESHOLD) {
                anomalies.push(new ValidationIssue(
                    "WARNING", "QNT", rowNum,
                    `Аномально большое количество в строке ${rowNum}: ${qnt} шт.! Проверьте опечатку разряда.`,
                    "ANOMALOUS_QUANTITY", "ERR_ANOMALOUS_QUANTITY", true
                ));
            }

            // 9. Подозрительные серии-заглушки
            if (ser && this.SUSPICIOUS_SERIES.test(ser) && ser !== "Б/С") {
                anomalies.push(new ValidationIssue(
                    "WARNING", "SER", rowNum,
                    `Подозрительный номер серии в строке ${rowNum}: '${ser}'. Укажите заводскую серию.`,
                    "SUSPICIOUS_SERIES", "ERR_SUSPICIOUS_SERIES", true
                ));
            }

            // Сбор цен для внутридокументного разброса
            if (codepst && p2 > 0) {
                if (!itemPrices.has(codepst)) itemPrices.set(codepst, []);
                itemPrices.get(codepst).push({ rowNum, price: p2 });
            }
        });

        // 10. Контроль разброса цен на один артикул (> 20%)
        itemPrices.forEach((priceList, code) => {
            if (priceList.length > 1) {
                const prices = priceList.map(p => p.price);
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                if (minP > 0 && (maxP / minP) > this.MAX_ALLOWED_PRICE_VARIANCE_RATIO) {
                    priceList.forEach(item => {
                        anomalies.push(new ValidationIssue(
                            "WARNING", "PRICE2", item.rowNum,
                            `Разброс цен артикула [${code}] в строке ${item.rowNum}: ${item.price.toFixed(2)} руб. (Мин: ${minP.toFixed(2)}, Макс: ${maxP.toFixed(2)})!`,
                            "PRICE_INCONSISTENCY", "ERR_PRICE_INCONSISTENCY", true
                        ));
                    });
                }
            }
        });

        return anomalies;
    }

    static calculateRiskScore(anomalies) {
        const critCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
        const warnCount = anomalies.filter(a => a.severity === 'WARNING').length;
        return Math.min(100, (critCount * 30) + (warnCount * 10));
    }
}