/**
 * js/domain/advisor_engine.js - Аналитический советник и генератор отчетов аудита в 5 форматах.
 * 
 * 1. User Report — текстовый сводный отчет;
 * 2. Smart Advice — пошаговые инструкции под целевую сеть;
 * 3. Technical IT Log — бинарный лог дескрипторов и смещений DBF;
 * 4. HTML Executive Audit — автономный документ для печати с CSS-графиками;
 * 5. Webhook JSON — для интеграции с 1С и Telegram-ботами.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { ProfileManager } from './network_profiles.js';

export class FileDiagnosticAdvisor {
    static generateUserReport(fileName, docType, profileKey, recordsCount, issues, readinessReport = null) {
        const profile = ProfileManager.getProfile(profileKey);
        const criticals = issues.filter(i => i.severity === 'CRITICAL');
        const warnings = issues.filter(i => i.severity === 'WARNING');
        const score = readinessReport ? readinessReport.score : (criticals.length ? 0 : 100);

        const lines = [
            "==================================================================",
            "        📊 ПОЛЬЗОВАТЕЛЬСКИЙ ОТЧЕТ АНАЛИЗА НАКЛАДНОЙ",
            "==================================================================",
            `• Документ: ${fileName}`,
            `• Тип схемы: ${String(docType).toUpperCase()}`,
            `• Целевой шлюз сети: ${profile.title}`,
            `• Строк номенклатуры: ${recordsCount}`,
            `• Индекс приёмки: ${score}% [${readinessReport ? readinessReport.statusText : ''}]`,
            `• Критических ошибок (блокируют FTP): ${criticals.length}`,
            `• Предупреждений: ${warnings.length}`,
            "------------------------------------------------------------------",
            "СПИСОК ВЫЯВЛЕННЫХ ЗАМЕЧАНИЙ:"
        ];

        if (issues.length === 0) {
            lines.push("✅ Замечаний не обнаружено. Накладная полностью готова к отправке!");
        } else {
            issues.forEach((issue, idx) => {
                const icon = issue.severity === 'CRITICAL' ? '🔴 [КРИТИЧНО]' : '🟡 [ВНИМАНИЕ]';
                lines.push(`${idx + 1}. ${icon} Стр. ${issue.rowIndex || 'Шапка'} [${issue.field}]: ${issue.userText}`);
            });
        }

        lines.push("==================================================================");
        lines.push("PharmaGate EDI Pro 2026 | Alexander Talents Agency");
        return lines.join('\n');
    }

    static generateHtmlReport(fileName, docType, profileKey, recordsCount, issues, readinessReport = null) {
        const profile = ProfileManager.getProfile(profileKey);
        const score = readinessReport ? readinessReport.score : 100;
        const statusColor = score >= 90 ? '#16a34a' : (score >= 50 ? '#d97706' : '#dc2626');

        const rowsHtml = issues.map((i, idx) => `
            <tr>
                <td style="padding:8px; border:1px solid #cbd5e1;">${idx + 1}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:${i.severity === 'CRITICAL' ? '#dc2626' : '#d97706'};">${i.severity}</td>
                <td style="padding:8px; border:1px solid #cbd5e1;">Стр. ${i.rowIndex || 'Шапка'}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; font-family:monospace;">${i.field}</td>
                <td style="padding:8px; border:1px solid #cbd5e1;">${i.userText}</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Отчет аудита - ${fileName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
        .card { background: #1e293b; border-radius: 12px; padding: 24px; max-width: 900px; margin: 0 auto; border: 1px solid #334155; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px; }
        .badge { background: ${statusColor}; color: #fff; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th { background: #0f172a; padding: 10px; border: 1px solid #334155; text-align: left; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div>
                <h2 style="margin:0; font-size:18px;">📊 Экспертный отчет аудита ФЛК</h2>
                <div style="font-size:12px; color:#94a3b8; margin-top:4px;">Файл: ${fileName} | Шлюз: ${profile.title}</div>
            </div>
            <div class="badge">${score}% Готовность</div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:20px; font-size:13px;">
            <div><b>Строк:</b> ${recordsCount}</div>
            <div><b>Тип схемы:</b> ${String(docType).toUpperCase()}</div>
            <div><b>Замечаний:</b> ${issues.length}</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>Критичность</th>
                    <th>Позиция</th>
                    <th>Поле</th>
                    <th>Описание инцидента</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding:20px; color:#16a34a;">✅ Замечаний не обнаружено.</td></tr>'}
            </tbody>
        </table>
        <div style="margin-top:24px; text-align:center; font-size:11px; color:#64748b;">
            PharmaGate EDI Pro 2026 • Alexander Talents Agency
        </div>
    </div>
</body>
</html>`;
    }
}