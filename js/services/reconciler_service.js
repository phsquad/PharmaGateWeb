/**
 * js/services/reconciler_service.js - Каскадная сверка Заказ <-> Накладная (5 уровней) + генератор otkaz.dbf.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { PharmaMath } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';
import { EncodingGuard } from '../engine/text_engine.js';
import { WebDBFEngine, DBFFieldDescriptor } from '../engine/dbf_engine.js';

export class ReconcilerService {
    static reconcile(orderRecords, naklRecords, priceTolerance = 0.01) {
        const discrepancies = [];
        const otkazRecords = [];
        const todayIso = new Date().toISOString().split('T')[0];

        let totalOrderedSum = 0.0;
        let totalDeliveredSum = 0.0;
        let totalRefusedSum = 0.0;

        // 1. Индексация Накладной
        const naklByCode = new Map();
        const naklByEan = new Map();
        const naklByName = new Map();

        naklRecords.forEach((r, idx) => {
            const code = EncodingGuard.sanitizeCodepstProtek(r.CODEPST);
            const ean = String(r.EAN13 || '').trim();
            const name = String(r.NAME || '').trim().toLowerCase();
            const sum = PharmaMath.cleanDecimal(r.SUMSTR) || (PharmaMath.cleanDecimal(r.QNT) * PharmaMath.cleanDecimal(r.PRICE2));
            totalDeliveredSum += sum;

            if (code) naklByCode.set(code, { record: r, idx });
            if (ean) naklByEan.set(ean, { record: r, idx });
            if (name) naklByName.set(name, { record: r, idx });
        });

        const matchedNaklIndices = new Set();

        // 2. Каскадная сверка позиций Заказа
        orderRecords.forEach(ord => {
            const code = EncodingGuard.sanitizeCodepstProtek(ord.CODEPST);
            const ean = String(ord.EAN13 || '').trim();
            const name = String(ord.NAME || `Товар ${code}`).trim();
            const nameLower = name.toLowerCase();

            const ordQnt = PharmaMath.cleanDecimal(ord.QNT, 1.0);
            const ordPrice = PharmaMath.cleanDecimal(ord.PRICE || ord.PRICE2, 0.0);
            totalOrderedSum += (ordQnt * ordPrice);

            let matched = null;
            if (code && naklByCode.has(code)) matched = naklByCode.get(code);
            else if (ean && naklByEan.has(ean)) matched = naklByEan.get(ean);
            else if (nameLower && naklByName.has(nameLower)) matched = naklByName.get(nameLower);

            if (matched) {
                matchedNaklIndices.add(matched.idx);
                const naklRec = matched.record;
                const naklQnt = PharmaMath.cleanDecimal(naklRec.QNT, 1.0);
                const naklPrice = PharmaMath.cleanDecimal(naklRec.PRICE2 || naklRec.PRICE, 0.0);

                // Перепоставка
                if (naklQnt > ordQnt) {
                    const diffQnt = naklQnt - ordQnt;
                    discrepancies.push({
                        type: 'OVER_DELIVERY',
                        severity: 'CRITICAL',
                        code, name,
                        message: `ПЕРЕПОСТАВКА [${code}]: Заказано ${ordQnt} шт., поставлено ${naklQnt} шт. (Излишек: +${diffQnt} шт.)`
                    });
                }
                // Недопоставка
                else if (naklQnt < ordQnt) {
                    const refusedQnt = ordQnt - naklQnt;
                    const refusedSum = PharmaMath.roundMoney(refusedQnt * ordPrice);
                    totalRefusedSum += refusedSum;

                    discrepancies.push({
                        type: 'UNDER_DELIVERY',
                        severity: 'WARNING',
                        code, name,
                        message: `НЕДОПОСТАВКА [${code}]: Заказано ${ordQnt} шт., поставлено ${naklQnt} шт. (Отказ: ${refusedQnt} шт. на ${refusedSum.toFixed(2)} руб.)`
                    });

                    otkazRecords.push({
                        NUMZ: parseInt(ord.NUMZ, 10) || 1,
                        DATEZ: DateEngine.parseAnyDate(ord.DATEZ) || todayIso,
                        CODEPST: code,
                        DATEEXP: todayIso,
                        PODR: String(ord.PODR || 'Аптека'),
                        QNT: refusedQnt,
                        PRICE: ordPrice,
                        PODRCD: String(ord.PODRCD || '001')
                    });
                }

                // Расхождение цен
                if (Math.abs(naklPrice - ordPrice) > priceTolerance && ordPrice > 0) {
                    discrepancies.push({
                        type: 'PRICE_MISMATCH',
                        severity: 'WARNING',
                        code, name,
                        message: `ИЗМЕНЕНИЕ ЦЕНЫ [${code}]: Заказ = ${ordPrice.toFixed(2)} руб. ➔ Накладная = ${naklPrice.toFixed(2)} руб.`
                    });
                }
            } else {
                // Полный отказ
                const refusedSum = PharmaMath.roundMoney(ordQnt * ordPrice);
                totalRefusedSum += refusedSum;

                discrepancies.push({
                    type: 'MISSING_ITEM',
                    severity: 'CRITICAL',
                    code, name,
                    message: `ПОЛНЫЙ ОТКАЗ [${code}]: Позиция '${name}' (${ordQnt} шт.) полностью отсутствует в накладной!`
                });

                otkazRecords.push({
                    NUMZ: parseInt(ord.NUMZ, 10) || 1,
                    DATEZ: DateEngine.parseAnyDate(ord.DATEZ) || todayIso,
                    CODEPST: code,
                    DATEEXP: todayIso,
                    PODR: String(ord.PODR || 'Аптека'),
                    QNT: ordQnt,
                    PRICE: ordPrice,
                    PODRCD: String(ord.PODRCD || '001')
                });
            }
        });

        // 3. Незаказанные товары в накладной
        naklRecords.forEach((r, idx) => {
            if (!matchedNaklIndices.has(idx)) {
                const code = EncodingGuard.sanitizeCodepstProtek(r.CODEPST);
                const name = String(r.NAME || `Товар ${code}`);
                const qnt = PharmaMath.cleanDecimal(r.QNT, 1.0);
                discrepancies.push({
                    type: 'UNORDERED_ITEM',
                    severity: 'CRITICAL',
                    code, name,
                    message: `НЕЗАКАЗАННЫЙ ТОВАР [${code}]: Позиция '${name}' (${qnt} шт.) отсутствует в заказе!`
                });
            }
        });

        const totalOrderPos = Math.max(1, orderRecords.length);
        const undeliveredCount = discrepancies.filter(d => d.type === 'MISSING_ITEM' || d.type === 'UNDER_DELIVERY').length;
        const fulfillmentRate = Math.round(((totalOrderPos - undeliveredCount) / totalOrderPos) * 100);

        return {
            orderedPositions: orderRecords.length,
            deliveredPositions: naklRecords.length,
            fulfillmentRatePercent: Math.max(0, fulfillmentRate),
            totalOrderedSum: PharmaMath.roundMoney(totalOrderedSum),
            totalDeliveredSum: PharmaMath.roundMoney(totalDeliveredSum),
            totalRefusedSum: PharmaMath.roundMoney(totalRefusedSum),
            discrepancies,
            otkazRecords
        };
    }

    static saveOtkazDBF(otkazRecords) {
        const fields = [
            new DBFFieldDescriptor("NUMZ", "N", 15, 0),
            new DBFFieldDescriptor("DATEZ", "D", 8, 0),
            new DBFFieldDescriptor("CODEPST", "C", 36, 0),
            new DBFFieldDescriptor("DATEEXP", "D", 8, 0),
            new DBFFieldDescriptor("PODR", "C", 50, 0),
            new DBFFieldDescriptor("QNT", "N", 10, 2),
            new DBFFieldDescriptor("PRICE", "N", 10, 2),
            new DBFFieldDescriptor("PODRCD", "C", 25, 0)
        ];
        return WebDBFEngine.writeDBF(fields, otkazRecords, 'cp866');
    }
}