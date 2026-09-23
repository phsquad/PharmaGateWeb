/**
 * js/engine/dbf_doctor_engine.js - Анализатор байтовой утилизации и оптимизатор размера DBF.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { WebDBFEngine } from './dbf_engine.js';
import { EncodingGuard } from './text_engine.js';

export class DbfDoctorEngine {
    /**
     * Поколоночный аудит байтовой длины данных против лимитов схемы
     */
    static analyzeSchemaVsData(schema, records, encoding = 'cp866') {
        const report = [];

        schema.fields.forEach(f => {
            const fieldKey = f.name.toUpperCase();
            let maxActualBytes = 0;

            records.forEach(r => {
                const val = r[fieldKey];
                if (val !== null && val !== undefined) {
                    if (f.type === 'C') {
                        const clean = EncodingGuard.sanitizeText366(String(val));
                        const byteLen = encoding === 'cp866' ? WebDBFEngine.encodeCP866(clean).length : clean.length;
                        if (byteLen > maxActualBytes) maxActualBytes = byteLen;
                    } else if (f.type === 'N' || f.type === 'F') {
                        const len = String(val).trim().length;
                        if (len > maxActualBytes) maxActualBytes = len;
                    } else if (f.type === 'D') {
                        maxActualBytes = 8;
                    } else if (f.type === 'L') {
                        maxActualBytes = 1;
                    }
                }
            });

            const currentLimit = Math.max(1, f.length);
            const utilPercent = Math.round((maxActualBytes / currentLimit) * 100);

            let status = "OPTIMAL";
            let recommendedLength = f.length;

            if (maxActualBytes > f.length) {
                status = "OVERFLOW";
                recommendedLength = Math.min(254, maxActualBytes + 2);
            } else if (maxActualBytes < f.length / 2 && f.type === 'C' && f.length > 30) {
                status = "WASTE";
                recommendedLength = Math.max(15, maxActualBytes + 5);
            }

            report.push({
                fieldName: fieldKey,
                type: f.type,
                currentLength: f.length,
                maxActualLength: maxActualBytes,
                utilizationPercent: utilPercent,
                status,
                recommendedLength
            });
        });

        return report;
    }

    /**
     * Расчет влияния изменения структуры на физический размер DBF в КБ
     */
    static calculateSizeImpact(schema, newLengthsMap, recordsCount) {
        const fieldsCount = schema.fields.length;
        const headerBytes = 32 + 32 * fieldsCount + 1;

        const oldRecBytes = 1 + schema.fields.reduce((acc, f) => acc + f.length, 0);
        const newRecBytes = 1 + schema.fields.reduce((acc, f) => acc + (newLengthsMap[f.name.toUpperCase()] || f.length), 0);

        const totalRecs = Math.max(1, recordsCount);
        const oldTotalBytes = headerBytes + totalRecs * oldRecBytes + 1;
        const newTotalBytes = headerBytes + totalRecs * newRecBytes + 1;

        const oldKb = Math.round(oldTotalBytes / 1024 * 10) / 10;
        const newKb = Math.round(newTotalBytes / 1024 * 10) / 10;
        const savedKb = Math.round(Math.max(0, oldTotalBytes - newTotalBytes) / 1024 * 10) / 10;

        return {
            oldKb,
            newKb,
            savedKb,
            savedPercent: oldTotalBytes > 0 ? Math.round(((oldTotalBytes - newTotalBytes) / oldTotalBytes) * 100) : 0
        };
    }
}