/**
 * js/services/guide_service.js
 * Интерактивный гид и пошаговое руководство пользователя PharmaGate EDI Studio 2026.
 * Bilingual: Russian / English.
 * 
 * Включает:
 * - 10 подробных иллюстрированных модулей пошагового обучения
 * - Интерактивную песочницу (Live EDI Sandbox): ФЛК-валидатор, калькулятор ЖНВЛП, сканер DataMatrix, конвертер кодировок
 * - Шпаргалку оператора (Cheat sheet): спецификации DBF, ставки НДС, статусы, горячие клавиши
 * - Интерактивный FAQ с поиском и аккордеоном
 * - Кликабельную навигацию: переходы между шагами, быстрый запуск функций в окнах WebOS
 * - Сохранение прогресса изучения и выбранного языка в localStorage
 */

export class GuideService {
    constructor(app) {
        this.app = app;
        this.lang = localStorage.getItem('pharmagate_guide_lang') || 'ru';
        this.activeTab = 'tutorial'; // 'tutorial' | 'sandbox' | 'cheatsheet' | 'faq'
        this.currentStepIndex = 0;
        this.searchQuery = '';
        this.activeCategory = 'all';
        this.completedSteps = JSON.parse(localStorage.getItem('pharmagate_guide_completed') || '[]');
        this.faqQuery = '';
        this.openFaqId = null;

        // Инициализация симуляторов песочницы
        this.sandboxState = {
            flkRow: {
                name: 'Амоксициллин 500мг №20 капс.',
                producer: 'Фармстандарт-Лексредства',
                series: '40822',
                expDate: '2027-04-01',
                barcode: '460166900123', // Намеренно неверная длина или чек-сумма для демонстрации
                qnt: 10,
                price: 185.50,
                sumStr: 1800.00, // Намеренное расхождение: должно быть 1855.00
                vat: 10,
                isJnvlp: true,
                regPrice: 195.00,
                gtd: '10130010/220524/001' // Неполный номер ГТД
            },
            flkFixed: false,
            flkIssues: [],
            jnvlpCalc: {
                prodPrice: 150.00,
                region: 'msk',
                type: 'wholesale',
                vatRate: 10,
                resMarkupPct: 15,
                resMaxPrice: 172.50,
                resWithVat: 189.75
            },
            dataMatrixRaw: '0104601669001234215ABC12391FFD092dGVzdGNyeXB0bzEyMzQ1Njc4OQ==',
            dataMatrixParsed: null,
            encodingSample: 'DOS_CP866'
        };

        this._initStepDefinitions();
    }

    _initStepDefinitions() {
        this.steps = [
            {
                id: 'step_intro',
                category: 'start',
                time: '2 мин / 2 min',
                icon: '🚀',
                title: {
                    ru: '1. Быстрый старт и обзор сервиса',
                    en: '1. Quick Start & Gateway Overview'
                },
                subtitle: {
                    ru: 'Что такое PharmaGate EDI, поддерживаемые форматы и как открыть первую накладную',
                    en: 'What PharmaGate EDI is, supported formats, and opening your first invoice'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                <b class="text-white">PharmaGate AccessForge Studio</b> — это промышленное рабочее место фармацевтического документооборота (EDI), работающее полностью в вашем браузере по стандарту WebAssembly (WASM). Сервис не требует установки программ и не передает коммерческие тайны на сторонние серверы.
                            </p>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div class="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                    <div class="text-blue-400 font-bold text-xs mb-1">📁 Поддерживаемые форматы</div>
                                    <div class="text-xs text-slate-300">DBF (dBase III/IV, FoxPro), XML УПД 970@ (ФНС), Excel XLSX/XLS, CSV, JSON, MS Access MDB/ACCDB.</div>
                                </div>
                                <div class="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                    <div class="text-emerald-400 font-bold text-xs mb-1">🎯 Профили сетей</div>
                                    <div class="text-xs text-slate-300">НЕО-ФАРМ, Ригла, Катрен, 36.6, Апрель, Протек, Пульс, Фармкомплект с автоматической настройкой ФЛК.</div>
                                </div>
                                <div class="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                    <div class="text-purple-400 font-bold text-xs mb-1">⚡ 100% Offline & Безопасность</div>
                                    <div class="text-xs text-slate-300">Все вычисления, база ГРЛС и сверка выполняются локально в оперативной памяти вашего ПК.</div>
                                </div>
                            </div>

                            <div class="p-4 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 rounded-xl border border-blue-800/40 space-y-2">
                                <h4 class="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                                    <span>👉</span> Инструкция: Как открыть и проверить накладную за 3 шага
                                </h4>
                                <ol class="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                                    <li><b class="text-white">Шаг 1:</b> Нажмите кнопку <span class="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-semibold border border-slate-700">📂 Открыть (Ctrl+O)</span> в тулбаре или просто перетащите файл <code class="text-blue-400">.dbf</code> или <code class="text-emerald-400">.xlsx</code> мышью на экран.</li>
                                    <li><b class="text-white">Шаг 2:</b> Система автоматически определит кодировку (CP866 или Windows-1251), структуру колонок и рассчитает итоги.</li>
                                    <li><b class="text-white">Шаг 3:</b> Обратите внимание на статус в нижней панели задач — если есть ошибки, нажмите <span class="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-semibold">⚡ Авто-Ремонт 99% (F5)</span>.</li>
                                </ol>
                            </div>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                <b class="text-white">PharmaGate AccessForge Studio</b> is an enterprise-grade pharmaceutical EDI (Electronic Data Interchange) gateway running 100% client-side via WebAssembly. It requires zero server setup and never sends your proprietary commercial data to external clouds.
                            </p>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div class="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                    <div class="text-blue-400 font-bold text-xs mb-1">📁 Supported Formats</div>
                                    <div class="text-xs text-slate-300">DBF (dBase III/IV, FoxPro), XML UPD 970@ (FTS), Excel XLSX/XLS, CSV, JSON, MS Access MDB/ACCDB.</div>
                                </div>
                                <div class="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                    <div class="text-emerald-400 font-bold text-xs mb-1">🎯 Network Profiles</div>
                                    <div class="text-xs text-slate-300">NEO-PHARM, Rigla, Katren, 36.6, April, Protek, Pulse with automatic compliance rule tuning.</div>
                                </div>
                                <div class="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                    <div class="text-purple-400 font-bold text-xs mb-1">⚡ 100% Offline & Private</div>
                                    <div class="text-xs text-slate-300">All calculations, state drug registry queries, and reconciliation happen inside local browser RAM.</div>
                                </div>
                            </div>

                            <div class="p-4 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 rounded-xl border border-blue-800/40 space-y-2">
                                <h4 class="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                                    <span>👉</span> Tutorial: Open and Inspect an Invoice in 3 Steps
                                </h4>
                                <ol class="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                                    <li><b class="text-white">Step 1:</b> Click <span class="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-semibold border border-slate-700">📂 Open (Ctrl+O)</span> in the toolbar or simply drag and drop any <code class="text-blue-400">.dbf</code> or <code class="text-emerald-400">.xlsx</code> file onto the workspace.</li>
                                    <li><b class="text-white">Step 2:</b> PharmaGate automatically auto-detects encoding (CP866 or Windows-1251), maps column fields, and computes financial totals.</li>
                                    <li><b class="text-white">Step 3:</b> Check the bottom status HUD — if warnings or errors are flagged, press <span class="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-semibold">⚡ Auto-Repair 99% (F5)</span>.</li>
                                </ol>
                            </div>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '🎲 Загрузить тестовую накладную (50 строк) и открыть редактор',
                        en: '🎲 Load Demo Invoice (50 Rows) & Open Editor'
                    },
                    handler: (app) => {
                        app.crossPlatform?.generateDemoPharmaInvoice(50);
                        app.openApp('winEditor');
                    }
                },
                proTip: {
                    ru: '💡 Совет: Нажмите клавишу <b>⌘K / Ctrl+K</b> в любой момент, чтобы вызвать глобальную командную палитру (Spotlight) для мгновенного перехода к любому файлу или окну.',
                    en: '💡 Pro Tip: Press <b>⌘K / Ctrl+K</b> anytime to summon the global Command Palette (Spotlight) for instant navigation to any file or window.'
                }
            },
            {
                id: 'step_editor',
                category: 'invoices',
                time: '3 мин / 3 min',
                icon: '📄',
                title: {
                    ru: '2. Редактор накладных (winEditor)',
                    en: '2. Working with the Invoice Editor (winEditor)'
                },
                subtitle: {
                    ru: 'Навигация по таблице, редактирование ячеек, авто-перерасчет сумм и экспорт',
                    en: 'Grid navigation, in-cell editing, automatic recalculation, and exporting'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                Окно <b class="text-white">Редактор Накладной (EDI Grid View)</b> предназначено для высокоскоростной обработки фарм-накладных объемом до 100 000+ строк без зависаний благодаря виртуальному скроллингу.
                            </p>

                            <div class="space-y-2 text-xs">
                                <h4 class="font-bold text-white flex items-center gap-1.5">
                                    <span>⌨️</span> Как быстро работать с ячейками:
                                </h4>
                                <ul class="space-y-1.5 text-slate-300">
                                    <li class="flex items-start gap-2">
                                        <span class="text-blue-400 font-mono font-bold">1.</span>
                                        <span><b>Кликните дважды или нажмите Enter:</b> Ячейка переходит в режим редактирования. Поддерживается клавиатурная навигация: <kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">Tab</kbd> переход к следующей колонке, <kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">Стрелки</kbd> переход по строкам.</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-blue-400 font-mono font-bold">2.</span>
                                        <span><b>Авто-балансировка сумм:</b> При изменении количества (<code class="text-blue-300">QNT</code>) или цены (<code class="text-blue-300">PRICE2</code>) сумма строки (<code class="text-blue-300">SUMSTR</code>) пересчитывается автоматически с математической точностью до сотых долей копейки.</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-blue-400 font-mono font-bold">3.</span>
                                        <span><b>Цветовая индикация строк:</b> 
                                            <span class="text-rose-400 font-semibold">Красный фон ячейки</span> — критическая ошибка ФЛК; 
                                            <span class="text-amber-400 font-semibold">Желтый фон</span> — коммерческое предупреждение (например, остаточный срок годности < 180 дней); 
                                            <span class="text-emerald-400 font-semibold">Зеленый</span> — строка полностью валидна.
                                        </span>
                                    </li>
                                </ul>
                            </div>

                            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <div class="font-bold text-xs text-white">💾 Кнопки экспорта в тулбаре накладной:</div>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div class="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-blue-400">💾 Сохранить DBF</b>
                                        <p class="text-[11px] text-slate-400">Экспорт в DOS CP866 или Win-1251 для загрузки в 1С / аптечный терминал.</p>
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-emerald-400">📑 Экспорт УПД XML</b>
                                        <p class="text-[11px] text-slate-400">Титул продавца по приказу ФНС №970@ для систем ЭДО (Диадок, СБИС).</p>
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-amber-400">📊 Excel ТОРГ-12</b>
                                        <p class="text-[11px] text-slate-400">Печатная форма унифицированной товарной накладной с НДС.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                The <b class="text-white">Invoice Editor (EDI Grid View)</b> is built for real-time high-density pharmaceutical processing, supporting up to 100,000+ items smoothly with virtual viewport rendering.
                            </p>

                            <div class="space-y-2 text-xs">
                                <h4 class="font-bold text-white flex items-center gap-1.5">
                                    <span>⌨️</span> Fast Cell Operations & Hotkeys:
                                </h4>
                                <ul class="space-y-1.5 text-slate-300">
                                    <li class="flex items-start gap-2">
                                        <span class="text-blue-400 font-mono font-bold">1.</span>
                                        <span><b>Double-click or press Enter:</b> Activates inline editor. Use <kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">Tab</kbd> to jump across columns, <kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">Arrow keys</kbd> to move between rows.</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-blue-400 font-mono font-bold">2.</span>
                                        <span><b>Auto Math Balancing:</b> Editing quantity (<code class="text-blue-300">QNT</code>) or wholesale price (<code class="text-blue-300">PRICE2</code>) instantly recalculates line total (<code class="text-blue-300">SUMSTR</code>) with banker's rounding precision.</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-blue-400 font-mono font-bold">3.</span>
                                        <span><b>Color Highlights:</b> 
                                            <span class="text-rose-400 font-semibold">Red cells</span> indicate critical compliance failure; 
                                            <span class="text-amber-400 font-semibold">Yellow cells</span> flag commercial warnings (e.g. expiration date < 180 days); 
                                            <span class="text-emerald-400 font-semibold">Green</span> marks verified records.
                                        </span>
                                    </li>
                                </ul>
                            </div>

                            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <div class="font-bold text-xs text-white">💾 Toolbar Export Actions:</div>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div class="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-blue-400">💾 Save DBF</b>
                                        <p class="text-[11px] text-slate-400">Export in DOS CP866 or Win-1251 for 1C or legacy ERP import.</p>
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-emerald-400">📑 Export UPD XML</b>
                                        <p class="text-[11px] text-slate-400">Standard Seller Title under FTS Order No. 970@ for Diadoc/SBIS.</p>
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-amber-400">📊 Excel TORG-12</b>
                                        <p class="text-[11px] text-slate-400">Printable official goods invoice with full tax breakdowns.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '📄 Открыть Редактор Накладных прямо сейчас',
                        en: '📄 Open Invoice Editor Right Now'
                    },
                    handler: (app) => {
                        app.openApp('winEditor');
                    }
                },
                proTip: {
                    ru: '💡 Совет: Нажмите <b>Ctrl+S</b>, чтобы мгновенно выгрузить накладную в формате DBF с текущей выбранной кодировкой (CP866 или Windows-1251).',
                    en: '💡 Pro Tip: Press <b>Ctrl+S</b> to instantly download your table in DBF format with the active encoding (CP866 or Windows-1251).'
                }
            },
            {
                id: 'step_flk',
                category: 'flk',
                time: '3 мин / 3 min',
                icon: '🛡️',
                title: {
                    ru: '3. Валидация ФЛК и Авто-Ремонт 99%',
                    en: '3. FLC Compliance Audit & 1-Click Auto-Repair'
                },
                subtitle: {
                    ru: 'Что такое форматно-логический контроль и как устранять 99% ошибок в 1 клик',
                    en: 'Understanding FLC validation rules and repairing 99% of errors instantly'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                <b class="text-white">ФЛК (Форматно-Логический Контроль)</b> — это строгий набор стандартов фармацевтического рынка РФ, нарушение которого приводит к блокировке накладной аптечной сетью, штрафам Росздравнадзора или возврату партии товара.
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">🔍 Что проверяет движок ФЛК PharmaGate:</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                                    <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                                        <b class="text-rose-400">1. Ведущие нули артикулов:</b> При импорте из Excel число <code>004512</code> часто превращается в <code>4512</code>. Движок восстанавливает нули.
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                                        <b class="text-rose-400">2. Контрольный разряд EAN-13:</b> Проверка алгоритма контрольной суммы по стандарту GS1 (Modulo 10).
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                                        <b class="text-rose-400">3. Формат ГТД и РУ:</b> Регистрационные удостоверения Минздрава и номера таможенных деклараций проверяются по маске ФТС.
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                                        <b class="text-rose-400">4. Ставки НДС и формулы:</b> Строгий аудит: 10% для ЛС, 20% для косметики и 0% для льготных медицинских изделий.
                                    </div>
                                </div>
                            </div>

                            <div class="p-4 bg-emerald-950/30 rounded-xl border border-emerald-600/40 space-y-2">
                                <h4 class="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                                    <span>⚡</span> Кнопка «Авто-Ремонт 99%» (F5) — как она работает:
                                </h4>
                                <p class="text-xs text-slate-300 leading-relaxed">
                                    При нажатии кнопки <b class="text-white">Авто-Ремонт</b> запускается многопроходный алгоритм: он пересчитывает расхождения копеек, исправляет обрезанные нули в артикулах, нормализует разделители дат, подтягивает правильные ставки НДС из каталога ГРЛС и балансирует суммы. Все действия протоколируются в окне <b class="text-white">Инспектор</b> с возможностью отката (Undo).
                                </p>
                            </div>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                <b class="text-white">FLC (Format and Logic Control)</b> is the mandatory regulatory validation suite enforced across Russian pharmacy supply chains. Submitting non-compliant documents causes EDI rejection, fines, or delayed customs releases.
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">🔍 What the FLC Engine Audits:</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                                    <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                                        <b class="text-rose-400">1. Leading Item Zeros:</b> Excel frequently strips leading zeros (turning <code>004512</code> into <code>4512</code>). PharmaGate restores them.
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                                        <b class="text-rose-400">2. EAN-13 Check Digit:</b> Full Modulo-10 checksum validation adhering strictly to GS1 barcode standards.
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                                        <b class="text-rose-400">3. Customs & Registration IDs:</b> Ministry of Health Registration Certificates and Customs Declarations (GTD) verified via official regex patterns.
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                                        <b class="text-rose-400">4. VAT Rates & Calculations:</b> 10% for medicines, 20% for cosmetics, 0% for tax-exempt medical supplies.
                                    </div>
                                </div>
                            </div>

                            <div class="p-4 bg-emerald-950/30 rounded-xl border border-emerald-600/40 space-y-2">
                                <h4 class="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                                    <span>⚡</span> The "Auto-Repair 99%" Button (F5) in Action:
                                </h4>
                                <p class="text-xs text-slate-300 leading-relaxed">
                                    Clicking <b class="text-white">Auto-Repair</b> triggers a multi-pass heuristic resolver: it rebalances cent rounding errors, recovers stripped item code zeros, normalizes date separators, re-assigns catalog-grounded VAT tiers, and traces prices. All changes are logged into the <b class="text-white">Action Inspector</b> with 50-step Undo capability.
                                </p>
                            </div>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '⚡ Протестировать Авто-Ремонт на текущем документе (F5)',
                        en: '⚡ Execute Auto-Repair on Active Invoice (F5)'
                    },
                    handler: (app) => {
                        app.openApp('winEditor');
                        document.getElementById('btnAutoRepair')?.click();
                    }
                },
                proTip: {
                    ru: '💡 Совет: Перейдите на вкладку <b>«Песочница»</b> вверху этого окна, чтобы интерактивно попробовать исправление ошибок на демонстрационном примере прямо здесь.',
                    en: '💡 Pro Tip: Switch to the <b>"Sandbox"</b> tab at the top of this window to interactively test error repair on a live example right here.'
                }
            },
            {
                id: 'step_jnvlp',
                category: 'flk',
                time: '3 мин / 3 min',
                icon: '💊',
                title: {
                    ru: '4. ЖНВЛП: Контроль предельных цен и надбавок',
                    en: '4. Essential Medicines (VED/ЖНВЛП) Price Caps'
                },
                subtitle: {
                    ru: 'Государственное регулирование цен, предельные оптовые/розничные надбавки и протокол согласования',
                    en: 'Government price regulations, wholesale/retail margin caps, and price matching protocols'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                Для препаратов из перечня <b class="text-white">ЖНВЛП (Жизненно необходимые и важнейшие лекарственные препараты)</b> действует строгое ценообразование по Постановлению Правительства РФ №865. Превышение зарегистрированной цены производителя или региональной надбавки влечет отзыв лицензии и штрафы.
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">📊 Ключевые поля контроля ЖНВЛП в таблице:</h4>
                                <div class="space-y-1.5 text-xs text-slate-300">
                                    <div class="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                                        <span class="font-mono text-purple-400">IS_JNVLP</span>
                                        <span>Признак включения в перечень ЖНВЛП (T = Истина, F = Ложь)</span>
                                    </div>
                                    <div class="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                                        <span class="font-mono text-purple-400">REG_PRICE</span>
                                        <span>Зарегистрированная предельная цена производителя (из реестра Минздрава)</span>
                                    </div>
                                    <div class="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                                        <span class="font-mono text-purple-400">PR_PROIZV</span>
                                        <span>Фактическая цена производителя в накладной (не может превышать REG_PRICE)</span>
                                    </div>
                                    <div class="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                                        <span class="font-mono text-purple-400">OPT_NDB</span>
                                        <span>Оптовая надбавка в рублях и процентах (контроль по субъекту РФ)</span>
                                    </div>
                                </div>
                            </div>

                            <p class="text-xs text-slate-300">
                                При обнаружении превышения цены движок PharmaGate подсвечивает ячейку фиолетовой рамкой с предупреждением и предлагает пересчитать протокол согласования цен по региональной шкале.
                            </p>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                Medicines on the <b class="text-white">VED / ЖНВЛП (Vital and Essential Drugs)</b> list are strictly price-regulated under Russian Federal Decree No. 865. Exceeding registered manufacturer prices or regional distributor margins triggers severe legal penalties.
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">📊 Key VED Fields Monitored in the Table:</h4>
                                <div class="space-y-1.5 text-xs text-slate-300">
                                    <div class="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                                        <span class="font-mono text-purple-400">IS_JNVLP</span>
                                        <span>Boolean flag for essential medicine status (T = True, F = False)</span>
                                    </div>
                                    <div class="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                                        <span class="font-mono text-purple-400">REG_PRICE</span>
                                        <span>Official maximum registered producer price from the Health Ministry</span>
                                    </div>
                                    <div class="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                                        <span class="font-mono text-purple-400">PR_PROIZV</span>
                                        <span>Actual manufacturer price on the invoice (must not exceed REG_PRICE)</span>
                                    </div>
                                    <div class="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                                        <span class="font-mono text-purple-400">OPT_NDB</span>
                                        <span>Wholesale distributor margin (audited against regional price caps)</span>
                                    </div>
                                </div>
                            </div>

                            <p class="text-xs text-slate-300">
                                If a price violation occurs, PharmaGate highlights the line with a purple warning badge and offers automated recalculation according to the regional margin formula.
                            </p>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '📊 Открыть калькулятор ЖНВЛП в песочнице',
                        en: '📊 Open VED Calculator in Sandbox'
                    },
                    handler: (app, guide) => {
                        guide.switchTab('sandbox');
                    }
                },
                proTip: {
                    ru: '💡 Совет: В окне <b>«База Знаний» (F1)</b> собраны актуальные нормативные акты Минздрава и ФАС со всеми региональными коэффициентами надбавок по всей России.',
                    en: '💡 Pro Tip: The <b>"Knowledge Base" (F1)</b> window includes official FAS and Ministry of Health regulatory orders with regional margin tiers across all Russian regions.'
                }
            },
            {
                id: 'step_erp_db',
                category: 'database',
                time: '2.5 мин / 2.5 min',
                icon: '🗄️',
                title: {
                    ru: '5. СУБД ERP и Каталог ГРЛС (SQLite WASM)',
                    en: '5. Local ERP Database & State Catalog (SQLite WASM)'
                },
                subtitle: {
                    ru: 'Встроенная база данных 12 000+ медикаментов, поиск по МНН и синхронизация с накладной',
                    en: 'Embedded 12,000+ drug catalog, INN search, and local SQL synchronization'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                В приложение встроена полноценная реляционная СУБД <b class="text-white">SQLite WebAssembly</b> (sql.js). Она работает полностью в памяти браузера без установки SQL Server или PostgreSQL и содержит официальный справочник ГРЛС.
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                    <div class="text-emerald-400 font-bold">🔍 Быстрый поиск в окне «СУБД ERP»:</div>
                                    <p class="text-slate-300">Мгновенный поиск медикаментов по любому параметру: торговому наименованию, МНН (международному непатентованному названию), штрихкоду EAN-13, производителю или форме выпуска.</p>
                                </div>
                                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                    <div class="text-blue-400 font-bold">🔄 Синхронизация с накладной:</div>
                                    <p class="text-slate-300">Кликните «В накладную» в строке справочника, чтобы мгновенно перенести точные реквизиты препарата (штрихкод, производитель, признак ЖНВЛП) в открытую накладную.</p>
                                </div>
                            </div>

                            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                                <b>Режим офлайн:</b> База кэшируется в локальном хранилище браузера (IndexedDB) и готова к работе даже при полном отсутствии интернета в аптеке или на оптовом складе.
                            </div>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                PharmaGate embeds a high-performance relational <b class="text-white">SQLite WebAssembly engine</b> (sql.js). Operating entirely in memory with no remote database setup, it contains preloaded state drug registry data.
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                    <div class="text-emerald-400 font-bold">🔍 Fast Search in "ERP DB" Window:</div>
                                    <p class="text-slate-300">Instant lookup by trade brand, INN (International Nonproprietary Name), EAN-13 barcode, manufacturer, dosage form, or packaging size.</p>
                                </div>
                                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                    <div class="text-blue-400 font-bold">🔄 1-Click Invoice Sync:</div>
                                    <p class="text-slate-300">Click "Transfer to Invoice" to inject official registry parameters (barcode, producer, VED price cap) directly into the active editing grid.</p>
                                </div>
                            </div>

                            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                                <b>Offline Resilience:</b> The SQL database is persisted in IndexedDB, guaranteeing immediate offline availability even during pharmacy network outages.
                            </div>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '🗄️ Открыть СУБД ERP (Каталог ГРЛС)',
                        en: '🗄️ Open ERP Database (Catalog)'
                    },
                    handler: (app) => {
                        app.openApp('winDb');
                    }
                },
                proTip: {
                    ru: '💡 Совет: В окне «СУБД ERP» доступен прямой экспорт любого выборки номенклатуры в Excel кнопкой «Экспорт каталога».',
                    en: '💡 Pro Tip: In the ERP DB window, you can directly export any filtered subset of pharmaceuticals to Excel using the "Export Catalog" button.'
                }
            },
            {
                id: 'step_reconcile',
                category: 'reconcile',
                time: '3 мин / 3 min',
                icon: '⚖️',
                title: {
                    ru: '6. Каскадная сверка номенклатуры (winReconcile)',
                    en: '6. Smart Nomenclature Reconciliation (winReconcile)'
                },
                subtitle: {
                    ru: 'Устранение разногласий наименований поставщиков с базой сети через Smart Match',
                    en: 'Resolving supplier nomenclature differences with pharmacy stock using Smart Match'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                Главная проблема аптечного ритейла — различия в написании одного и того же лекарства у разных поставщиков (например, <i>«Нурофен таб 200мг №10»</i> у Катрена и <i>«Нурофен табл. п/о 200 мг N10 Рекитт»</i> у Протека).
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">⚡ 5-уровневый каскад Smart Match:</h4>
                                <ol class="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                                    <li><b>Уровень 1 (Артикул сети):</b> Точное совпадение внутреннего номенклатурного кода (100% точность).</li>
                                    <li><b>Уровень 2 (Штрихкод EAN-13):</b> Совпадение по международному штрихкоду потребительской упаковки.</li>
                                    <li><b>Уровень 3 (Маркировка GTIN):</b> Проверка идентификатора товара в системе Честный ЗНАК.</li>
                                    <li><b>Уровень 4 (Каноническое имя):</b> Нормализация дозировок, форм и фасовок (мг, мл, №, капс).</li>
                                    <li><b>Уровень 5 (Fuzzy-алгоритм 80%+):</b> Нечеткое сопоставление по расстоянию Левенштейна и токенам.</li>
                                </ol>
                            </div>

                            <p class="text-xs text-slate-300">
                                В окне <b class="text-white">Сверка</b> оператор видит процент совпадения и может в 1 клик подтвердить связь или выгрузить <b>Акт расхождений в Excel</b> и файл отказов <code class="text-amber-400">otkaz.dbf</code>.
                            </p>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                The most common challenge in pharmacy inventory management is supplier naming discrepancy (e.g. <i>"Nurofen tab 200mg #10"</i> from Katren vs <i>"Nurofen coated tbl 200 mg N10 Reckitt"</i> from Protek).
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">⚡ The 5-Tier Smart Match Cascade:</h4>
                                <ol class="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                                    <li><b>Tier 1 (Internal SKU):</b> Exact network item identifier matching (100% confidence).</li>
                                    <li><b>Tier 2 (EAN-13 Barcode):</b> Exact package retail barcode alignment.</li>
                                    <li><b>Tier 3 (Marking GTIN):</b> Chestny ZNAK serial GTIN verification.</li>
                                    <li><b>Tier 4 (Normalized Title):</b> Automated normalization of dosages and units (mg, ml, caps, count).</li>
                                    <li><b>Tier 5 (Fuzzy Levenshtein 80%+):</b> Token-based fuzzy string match with confidence score.</li>
                                </ol>
                            </div>

                            <p class="text-xs text-slate-300">
                                In the <b class="text-white">Reconciliation</b> window, the operator reviews matching scores, confirms linkages in 1 click, and exports the <b>Discrepancy Act to Excel</b> alongside <code class="text-amber-400">otkaz.dbf</code>.
                            </p>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '⚖️ Открыть модуль Каскадной Сверки',
                        en: '⚖️ Open Nomenclature Reconciliation Module'
                    },
                    handler: (app) => {
                        app.openApp('winReconcile');
                    }
                },
                proTip: {
                    ru: '💡 Совет: Для одновременной сверки двух таблиц используйте оконную стратегию <b>«Сплит 50/50»</b> в выпадающем меню панели задач.',
                    en: '💡 Pro Tip: To compare two tables side-by-side, choose the <b>"Split 50/50"</b> window layout strategy from the taskbar selector.'
                }
            },
            {
                id: 'step_schema',
                category: 'database',
                time: '2.5 мин / 2.5 min',
                icon: '📐',
                title: {
                    ru: '7. Конструктор схем и форматов (winSchema)',
                    en: '7. Schema & Access/DBF Designer (winSchema)'
                },
                subtitle: {
                    ru: 'Визуальное проектирование структур DBF/Access, типы полей (C, N, D, L, M) и правила',
                    en: 'Visual modeling of DBF/Access structures, field data types, and byte allocation'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                Окно <b class="text-white">Конструктор Схем Данных</b> позволяет создавать и настраивать кастомные структуры таблиц для любых аптечных систем, баз MS Access (.mdb) и шлюзов интеграции.
                            </p>

                            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">⚙️ Возможности конструктора:</h4>
                                <ul class="space-y-1.5 text-xs text-slate-300">
                                    <li><b>• Поддерживаемые типы данных dBase:</b> <code>C (Character)</code>, <code>N (Numeric)</code>, <code>D (Date)</code>, <code>L (Logical)</code>, <code>M (Memo)</code>.</li>
                                    <li><b>• Настройка точности:</b> Задание длины поля (Field Length) и знаков после запятой (Decimals).</li>
                                    <li><b>• Аудит DBF Doctor:</b> Живой расчет байтового размера одной строки (Record Length) и предупреждение о переполнении лимитов dBase.</li>
                                    <li><b>• Экспорт схемы:</b> Сохранение спецификации в формате JSON для повторного использования командой.</li>
                                </ul>
                            </div>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                The <b class="text-white">Data Schema Designer</b> window enables visual modeling and customization of database schemas for custom pharmacy gateways, MS Access (.mdb), and DBF specifications.
                            </p>

                            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">⚙️ Designer Capabilities:</h4>
                                <ul class="space-y-1.5 text-xs text-slate-300">
                                    <li><b>• Supported dBase Types:</b> <code>C (Character)</code>, <code>N (Numeric)</code>, <code>D (Date)</code>, <code>L (Logical)</code>, <code>M (Memo)</code>.</li>
                                    <li><b>• Precision Controls:</b> Field Length and decimal point configuration.</li>
                                    <li><b>• DBF Doctor Audit:</b> Live calculation of single-row byte footprint (Record Length) and dBase 4000-byte barrier warnings.</li>
                                    <li><b>• Schema Export:</b> Download schema definitions as JSON for team configuration distribution.</li>
                                </ul>
                            </div>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '📐 Открыть Конструктор схем и полей',
                        en: '📐 Open Schema & Field Designer'
                    },
                    handler: (app) => {
                        app.openApp('winSchema');
                    }
                },
                proTip: {
                    ru: '💡 Совет: Имя поля в dBase III не должно превышать 10 латинских символов. Конструктор автоматически валидирует имена при вводе.',
                    en: '💡 Pro Tip: dBase III field names must not exceed 10 ASCII characters. The designer automatically enforces this invariant on the fly.'
                }
            },
            {
                id: 'step_wizard',
                category: 'invoices',
                time: '2.5 мин / 2.5 min',
                icon: '🚀',
                title: {
                    ru: '8. Мастер создания накладной 2.0 (2D DataMatrix)',
                    en: '8. Creation Wizard 2.0 & 2D DataMatrix Scanner'
                },
                subtitle: {
                    ru: 'Пошаговый ассистент создания накладной с нуля и эмуляция терминала сбора данных (ТСД)',
                    en: 'Step-by-step invoice generation from scratch and handheld 2D DataMatrix terminal emulation'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                <b class="text-white">Мастер создания накладной 2.0 (winWizard)</b> предназначен для операторов склада и приемщиков товара. Он позволяет быстро создать накладную с нуля и оснащен встроенным терминалом сканирования кодов «Честный ЗНАК» (МДЛП).
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">📦 Этапы мастера:</h4>
                                <ol class="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                                    <li><b>Реквизиты документа:</b> Номер накладной, дата поставки, выбор поставщика и аптеки-получателя.</li>
                                    <li><b>Терминал 2D-сканера:</b> Поддержка считывания маркировки GS1 DataMatrix с разбором GTIN, индивидуального серийного номера и криптохвоста.</li>
                                    <li><b>Калькулятор цен:</b> Быстрый ввод количества, цен поставщика и автоматический расчет НДС и сумм.</li>
                                    <li><b>Финализация:</b> Генерация готового документа и мгновенная отправка в Редактор Накладных.</li>
                                </ol>
                            </div>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                The <b class="text-white">Creation Wizard 2.0 (winWizard)</b> provides warehouse receiving operators with a streamlined invoice generator equipped with an embedded Chestny ZNAK (MDLP) 2D DataMatrix scanning simulator.
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">📦 Wizard Workflow Steps:</h4>
                                <ol class="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                                    <li><b>Document Header:</b> Invoice number, delivery date, supplier, and receiving pharmacy selection.</li>
                                    <li><b>2D Scanner Terminal:</b> Live GS1 DataMatrix parsing separating GTIN (01), serial (21), and cryptographic checksums.</li>
                                    <li><b>Price Engine:</b> Instant calculation of wholesale/retail margins, tax tiers, and line totals.</li>
                                    <li><b>Finalization:</b> Immediate compilation into a validated document loaded into the primary Editor.</li>
                                </ol>
                            </div>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '🚀 Запустить Мастер создания накладной 2.0',
                        en: '🚀 Launch Creation Wizard 2.0'
                    },
                    handler: (app) => {
                        app.openApp('winWizard');
                    }
                },
                proTip: {
                    ru: '💡 Совет: Нажмите клавишу <b>Ctrl+N</b>, чтобы открыть Мастер создания накладной в любой момент.',
                    en: '💡 Pro Tip: Press <b>Ctrl+N</b> from anywhere in the application to immediately open the Creation Wizard.'
                }
            },
            {
                id: 'step_inspector',
                category: 'flk',
                time: '2 мин / 2 min',
                icon: '🛠️',
                title: {
                    ru: '9. Инспектор изменений и Журнал аудита (winInspector)',
                    en: '9. Action Inspector & Audit Log (winInspector)'
                },
                subtitle: {
                    ru: 'Полная история изменений, трассировка цен и откат правок до 50 шагов (Undo/Redo)',
                    en: 'Full revision history, price audits, and up to 50-step Undo/Redo state machine'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                Окно <b class="text-white">Инспектор Изменений (Action Inspector)</b> обеспечивает полную безопасность работы. Любая правка ячейки оператором или автоматический ремонт ФЛК протоколируются в защищенном журнале.
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                    <div class="text-violet-400 font-bold">📜 Таблица «Было ➔ Станет»:</div>
                                    <p class="text-slate-300">Наглядное сравнение исходного значения ячейки и предложенного исправления с указанием причины (например: <i>«Исправлен НДС с 20% на 10% по справочнику ГРЛС»</i>).</p>
                                </div>
                                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                    <div class="text-blue-400 font-bold">⏪ Машина Времени (Undo/Redo):</div>
                                    <p class="text-slate-300">Глубина отката до 50 операций. Если вы случайно изменили строку или применили авторемонт не к той колонке — нажмите <kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">Ctrl+Z</kbd>.</p>
                                </div>
                            </div>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                The <b class="text-white">Action Inspector (winInspector)</b> guarantees complete audit safety. Every single modification made by an operator or by automatic repair is tracked in an immutable session journal.
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                    <div class="text-violet-400 font-bold">📜 "Before ➔ After" Diff Grid:</div>
                                    <p class="text-slate-300">Visual before/after comparisons detailing exact changes and underlying reasons (e.g.: <i>"VAT updated from 20% to 10% per State Drug Registry classification"</i>).</p>
                                </div>
                                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                    <div class="text-blue-400 font-bold">⏪ Time Machine (Undo/Redo):</div>
                                    <p class="text-slate-300">Up to 50 undo states. Revert any accidental row deletion or batch change instantly using standard <kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">Ctrl+Z</kbd>.</p>
                                </div>
                            </div>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '🛠️ Открыть Инспектор Изменений и Аудит',
                        en: '🛠️ Open Action Inspector & Audit Log'
                    },
                    handler: (app) => {
                        app.openApp('winInspector');
                    }
                },
                proTip: {
                    ru: '💡 Совет: Отчет аудита можно выгрузить в текстовый протокол для передачи старшему провизору или IT-отделу сети.',
                    en: '💡 Pro Tip: You can export the entire audit trail into a formal report for submission to senior pharmacists or network IT admins.'
                }
            },
            {
                id: 'step_settings',
                category: 'settings',
                time: '2.5 мин / 2.5 min',
                icon: '⚙️',
                title: {
                    ru: '10. Настройки, Рабочий стол и Оптимизация (winSettings)',
                    en: '10. Settings, Desktop Styles & Hardware Profiles'
                },
                subtitle: {
                    ru: 'Выбор стилей ОС (Windows 11 / macOS / Linux), профили оборудования и горячие клавиши',
                    en: 'Choosing OS styles (Win 11 / macOS / Linux), hardware optimization profiles, and hotkeys'
                },
                content: {
                    ru: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                Окно <b class="text-white">Центр Настроек (winSettings)</b> позволяет гибко адаптировать интерфейс системы под любое устройство: стационарный моноблок, рабочий ноутбук или ручной планшет/ТСД на аптечном складе.
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">🖥️ Ключевые разделы Центра Настроек:</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-blue-400">🎨 Оформление и Обои:</b>
                                        <p class="text-[11px] text-slate-400 mt-1">Темы Windows 11 Fluent, macOS Cupertino Glass, Matrix и 10 фотообоев высокого разрешения.</p>
                                    </div>
                                    <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-emerald-400">🖥️ Рабочий стол & Dock:</b>
                                        <p class="text-[11px] text-slate-400 mt-1">Панель задач снизу (Windows), плавающий Dock (macOS) или верхняя панель (Ubuntu / Linux).</p>
                                    </div>
                                    <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-purple-400">🚀 Оптимизация под ПК:</b>
                                        <p class="text-[11px] text-slate-400 mt-1">Пресеты Lite TSD (для слабых устройств), Сенсорный режим 36px и Режим экономии батареи.</p>
                                    </div>
                                </div>
                            </div>

                            <p class="text-xs text-slate-300">
                                Все настройки мгновенно сохраняются в вашем браузере и остаются активными при следующем открытии сервиса.
                            </p>
                        </div>
                    `,
                    en: `
                        <div class="space-y-4">
                            <p class="text-sm leading-relaxed text-slate-300">
                                The <b class="text-white">Control Center & Settings (winSettings)</b> window lets you tailor the WebOS environment to any screen or hardware: stationary dual-monitor workstations, laptops, or handheld warehouse tablets.
                            </p>

                            <div class="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 class="font-bold text-xs text-white">🖥️ Core Configuration Sections:</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-blue-400">🎨 Themes & Wallpapers:</b>
                                        <p class="text-[11px] text-slate-400 mt-1">Windows 11 Fluent, macOS Cupertino Glass, Matrix, and high-fidelity desktop backdrops.</p>
                                    </div>
                                    <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-emerald-400">🖥️ Desktop & Dock:</b>
                                        <p class="text-[11px] text-slate-400 mt-1">Bottom Taskbar (Windows), Floating Dock (macOS), or Top System Bar (Ubuntu / GNOME).</p>
                                    </div>
                                    <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                        <b class="text-purple-400">🚀 Hardware Profiles:</b>
                                        <p class="text-[11px] text-slate-400 mt-1">Lite TSD preset (for budget warehouse terminals), 36px Touch Mode, and Battery Saver.</p>
                                    </div>
                                </div>
                            </div>

                            <p class="text-xs text-slate-300">
                                All preferences are persisted locally in your browser and automatically restored on your next visit.
                            </p>
                        </div>
                    `
                },
                action: {
                    btnText: {
                        ru: '⚙️ Открыть Центр Настроек',
                        en: '⚙️ Open Control Center & Settings'
                    },
                    handler: (app) => {
                        app.openApp('winSettings');
                    }
                },
                proTip: {
                    ru: '💡 Совет: Нажмите на часы в правом нижнем углу панели задач, чтобы открыть интерактивный календарь и фармацевтический таймер регламентов.',
                    en: '💡 Pro Tip: Click the taskbar clock to open the interactive calendar flyout and pharmaceutical EDI regulatory countdown timer.'
                }
            }
        ];

        // FAQ статьи
        this.faqItems = [
            {
                id: 'faq_1',
                q: {
                    ru: 'Что делать, если при открытии DBF файла вместо букв нечитаемые знаки («кракозябры»)?',
                    en: 'What should I do if a DBF file opens with corrupted characters ("mojibake")?'
                },
                a: {
                    ru: 'Это стандартная проблема кодировок. Старые аптечные шлюзы 1С используют кодировку DOS (CP866), а новые — Windows-1251. В правом нижнем углу панели задач нажмите на кнопку «CP866 / CP1251» или используйте селектор в тулбаре накладной, чтобы переключить кодовую страницу за 1 клик.',
                    en: 'This is a character encoding mismatch. Legacy pharmacy systems use DOS CP866, while newer ERPs use Windows-1251. Click the "CP866 / CP1251" badge in the bottom taskbar or invoice toolbar to toggle the codepage in 1 click.'
                }
            },
            {
                id: 'faq_2',
                q: {
                    ru: 'Как быстро исправить ошибку расхождения сумм строк (SUMSTR != QNT * PRICE)?',
                    en: 'How do I quickly fix row calculation discrepancies (SUMSTR != QNT * PRICE)?'
                },
                a: {
                    ru: 'Нажмите клавишу F5 или зеленую кнопку «⚡ Авто-Ремонт 99%» в тулбаре накладной. Алгоритм сбалансирует округление копеек во всех строках таблицы по правилам бухгалтерского учета Минфина РФ.',
                    en: 'Press F5 or click "⚡ Auto-Repair 99%" in the invoice toolbar. The mathematical engine will automatically recalculate and balance cent rounding across all rows following official accounting rules.'
                }
            },
            {
                id: 'faq_3',
                q: {
                    ru: 'Безопасно ли загружать сюда конфиденциальные накладные и коммерческие цены?',
                    en: 'Is it secure to load confidential invoices and pricing data into this web app?'
                },
                a: {
                    ru: 'Абсолютно безопасно. Приложение выполнено по технологии Client-Side WebAssembly: все данные обрабатываются исключительно в оперативной памяти вашего браузера. Ни один файл, строка или сумма не передаются на сторонние серверы.',
                    en: 'Completely secure. PharmaGate is engineered as a 100% Client-Side WebAssembly application. All calculations occur inside your browser memory; zero files, rows, or prices ever leave your machine.'
                }
            },
            {
                id: 'faq_4',
                q: {
                    ru: 'Как выгрузить накладную в формате XML УПД для Диадок или СБИС?',
                    en: 'How do I export an invoice as an official XML UPD for Diadoc or SBIS?'
                },
                a: {
                    ru: 'Откройте накладную в Редакторе, нажмите кнопку «Экспорт» в верхнем меню окна и выберите «XML УПД (ФНС №970@)». Будет сформирован юридически значимый XML-файл Титула продавца (КНД 1115131) готовый к отправке оператору ЭДО.',
                    en: 'Open the invoice in the Editor, click "Export" in the window toolbar, and select "XML UPD (FTS No. 970@)". This compiles an official Seller Title XML (KND 1115131) compliant with Diadoc and SBIS requirements.'
                }
            },
            {
                id: 'faq_5',
                q: {
                    ru: 'Как вернуть прежнее значение ячейки, если оператор допустил ошибку?',
                    en: 'How can an operator undo a mistake in a table cell?'
                },
                a: {
                    ru: 'Используйте стандартное клавиатурное сочетание Ctrl+Z (или ⌘Z на Mac), либо откройте окно «Инспектор» и нажмите кнопку отката нужной операции. Система помнит до 50 последних состояний документа.',
                    en: 'Press standard Ctrl+Z (or ⌘Z on macOS), or open the "Action Inspector" window and click the Undo button next to the relevant transaction. The system maintains a 50-step state history.'
                }
            },
            {
                id: 'faq_6',
                q: {
                    ru: 'Что делать, если штрихкод EAN-13 подсвечен красным цветом?',
                    en: 'What if an EAN-13 barcode is highlighted in red?'
                },
                a: {
                    ru: 'Красная подсветка штрихкода означает ошибку контрольного разряда (последней 13-й цифры) по алгоритму GS1 Modulo 10, либо неверную длину (не 13 цифр). Кнопка «Авто-Ремонт» попытается восстановить контрольную цифру или найти правильный штрихкод в локальном справочнике ГРЛС.',
                    en: 'A red highlight means the 13th check digit failed the GS1 Modulo-10 checksum, or the length is incorrect. Clicking "Auto-Repair" recalculates the check digit or matches the item with the verified State Drug Registry.'
                }
            },
            {
                id: 'faq_7',
                q: {
                    ru: 'Как работать на медленном компьютере или планшете на складе?',
                    en: 'How can I optimize performance on a budget computer or warehouse tablet?'
                },
                a: {
                    ru: 'Откройте «Центр Настроек» ➔ вкладку «Оптимизация & Устройства» и нажмите кнопку «Пресет: Lite TSD» или кликните иконку «⚡ Lite» в правом нижнем углу панели задач. Это отключит ресурсоемкие анимации и размытия и сделает отклик мгновенным.',
                    en: 'Open "Settings Center" ➔ "Optimization & Devices" tab and select "Preset: Lite TSD" or click the "⚡ Lite" button on the taskbar. This disables blur effects and animations, delivering instant responsiveness on low-end hardware.'
                }
            }
        ];
    }

    setLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return;
        this.lang = lang;
        localStorage.setItem('pharmagate_guide_lang', lang);
        this.render();
        this.app.showToast?.(
            lang === 'ru' ? '🇷🇺 Язык гида переключен на русский' : '🇬🇧 Guide language switched to English',
            'info',
            2000
        );
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        this.render();
    }

    selectStep(index) {
        if (index < 0 || index >= this.steps.length) return;
        this.currentStepIndex = index;
        this.renderTutorialStep();
        this.app.crossPlatform?.playSound('click');
    }

    toggleStepCompletion(stepId) {
        const idx = this.completedSteps.indexOf(stepId);
        if (idx === -1) {
            this.completedSteps.push(stepId);
            this.app.crossPlatform?.playSound('success');
        } else {
            this.completedSteps.splice(idx, 1);
            this.app.crossPlatform?.playSound('click');
        }
        localStorage.setItem('pharmagate_guide_completed', JSON.stringify(this.completedSteps));
        this.render();
    }

    render() {
        const win = document.getElementById('winGuide');
        if (!win) return;

        // Обновление заголовка окна и языкового переключателя
        const titleEl = document.getElementById('guideWinTitle');
        if (titleEl) {
            titleEl.textContent = this.lang === 'ru' 
                ? '📖 Интерактивный Гид & Обучение — PharmaGate EDI Studio' 
                : '📖 Interactive User Guide & Tutorial — PharmaGate EDI Studio';
        }

        const btnRu = document.getElementById('btnGuideLangRu');
        const btnEn = document.getElementById('btnGuideLangEn');
        if (btnRu) {
            btnRu.className = this.lang === 'ru'
                ? 'px-2 py-0.5 rounded text-white bg-blue-600 transition-colors cursor-pointer'
                : 'px-2 py-0.5 rounded text-slate-400 hover:text-white transition-colors cursor-pointer';
        }
        if (btnEn) {
            btnEn.className = this.lang === 'en'
                ? 'px-2 py-0.5 rounded text-white bg-blue-600 transition-colors cursor-pointer'
                : 'px-2 py-0.5 rounded text-slate-400 hover:text-white transition-colors cursor-pointer';
        }

        // Обновление текста на вкладках тулбара
        const lblTut = document.querySelector('.guide-label-tab-tut');
        const lblSand = document.querySelector('.guide-label-tab-sand');
        const lblCheat = document.querySelector('.guide-label-tab-cheat');
        const lblFaq = document.querySelector('.guide-label-tab-faq');
        if (lblTut) lblTut.textContent = this.lang === 'ru' ? 'Пошаговый гид' : 'Step-by-Step Tutorial';
        if (lblSand) lblSand.textContent = this.lang === 'ru' ? 'Песочница EDI' : 'Live Sandbox';
        if (lblCheat) lblCheat.textContent = this.lang === 'ru' ? 'Шпаргалка' : 'Cheat Sheet';
        if (lblFaq) lblFaq.textContent = this.lang === 'ru' ? 'Вопросы и ответы (FAQ)' : 'FAQ & Help';

        // Обновление прогресс-бейджа
        const badgeEl = document.getElementById('guideProgressBadge');
        const completedCount = this.completedSteps.length;
        const pct = Math.round((completedCount / this.steps.length) * 100);
        if (badgeEl) {
            badgeEl.textContent = this.lang === 'ru'
                ? `${completedCount} / ${this.steps.length} пройдено (${pct}%)`
                : `${completedCount} / ${this.steps.length} completed (${pct}%)`;
        }

        const pctSidebar = document.getElementById('guideSidebarPct');
        const barSidebar = document.getElementById('guideSidebarBar');
        if (pctSidebar) pctSidebar.textContent = `${pct}%`;
        if (barSidebar) barSidebar.style.width = `${pct}%`;

        // Обновление кнопок вкладок
        const navContainer = document.getElementById('guideNavTabs');
        if (navContainer) {
            navContainer.querySelectorAll('.guide-tab-btn').forEach(btn => {
                const tab = btn.getAttribute('data-tab');
                if (tab === this.activeTab) {
                    btn.className = 'guide-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm border border-blue-500 cursor-pointer';
                } else {
                    btn.className = 'guide-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent cursor-pointer';
                }
            });
        }

        // Скрытие / показ панелей
        const pTutorial = document.getElementById('guidePanelTutorial');
        const pSandbox = document.getElementById('guidePanelSandbox');
        const pCheatsheet = document.getElementById('guidePanelCheatsheet');
        const pFaq = document.getElementById('guidePanelFaq');

        if (pTutorial) pTutorial.classList.toggle('hidden', this.activeTab !== 'tutorial');
        if (pSandbox) pSandbox.classList.toggle('hidden', this.activeTab !== 'sandbox');
        if (pCheatsheet) pCheatsheet.classList.toggle('hidden', this.activeTab !== 'cheatsheet');
        if (pFaq) pFaq.classList.toggle('hidden', this.activeTab !== 'faq');

        if (this.activeTab === 'tutorial') {
            this.renderTutorialList();
            this.renderTutorialStep();
        } else if (this.activeTab === 'sandbox') {
            this.renderSandbox();
        } else if (this.activeTab === 'cheatsheet') {
            this.renderCheatsheet();
        } else if (this.activeTab === 'faq') {
            this.renderFaq();
        }
    }

    renderTutorialList() {
        const listEl = document.getElementById('guideStepList');
        if (!listEl) return;

        const q = this.searchQuery.trim().toLowerCase();
        const filtered = this.steps.map((st, i) => ({ step: st, originalIndex: i })).filter(item => {
            if (this.activeCategory !== 'all' && item.step.category !== this.activeCategory) return false;
            if (!q) return true;
            const t = item.step.title[this.lang].toLowerCase();
            const s = item.step.subtitle[this.lang].toLowerCase();
            return t.includes(q) || s.includes(q);
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="p-4 text-center text-xs text-slate-500">
                    ${this.lang === 'ru' ? 'Темы не найдены' : 'No topics found'}
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered.map(item => {
            const isSelected = item.originalIndex === this.currentStepIndex;
            const isDone = this.completedSteps.includes(item.step.id);
            const activeClass = isSelected 
                ? 'bg-blue-600/20 text-white border-blue-500/60 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border-slate-800/60';

            return `
                <button onclick="window.PharmaGate.guideService.selectStep(${item.originalIndex})"
                        class="w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${activeClass}">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-base shrink-0">${item.step.icon}</span>
                        <div class="min-w-0">
                            <div class="font-semibold text-xs truncate leading-snug ${isSelected ? 'text-white' : 'text-slate-200'}">
                                ${item.step.title[this.lang]}
                            </div>
                            <div class="text-[10px] text-slate-400 truncate">
                                ${item.step.time}
                            </div>
                        </div>
                    </div>
                    <div onclick="event.stopPropagation(); window.PharmaGate.guideService.toggleStepCompletion('${item.step.id}')" 
                         class="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${isDone ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700 bg-slate-900/80 text-transparent hover:border-slate-500'}"
                         title="${this.lang === 'ru' ? 'Отметить как пройденное' : 'Mark as completed'}">
                        ✓
                    </div>
                </button>
            `;
        }).join('');
    }

    renderTutorialStep() {
        const step = this.steps[this.currentStepIndex];
        const container = document.getElementById('guideStepContentContainer');
        if (!container || !step) return;

        const isDone = this.completedSteps.includes(step.id);
        const hasPrev = this.currentStepIndex > 0;
        const hasNext = this.currentStepIndex < this.steps.length - 1;

        container.innerHTML = `
            <div class="space-y-4 max-w-3xl">
                <!-- Заголовок шага -->
                <div class="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <div class="text-[11px] font-mono text-blue-400 uppercase tracking-wider mb-0.5">
                            ${this.lang === 'ru' ? `Шаг ${this.currentStepIndex + 1} из ${this.steps.length}` : `Step ${this.currentStepIndex + 1} of ${this.steps.length}`} · ${step.time}
                        </div>
                        <h2 class="text-lg font-bold text-white flex items-center gap-2">
                            <span>${step.icon}</span>
                            <span>${step.title[this.lang]}</span>
                        </h2>
                        <p class="text-xs text-slate-400 mt-0.5">${step.subtitle[this.lang]}</p>
                    </div>

                    <button onclick="window.PharmaGate.guideService.toggleStepCompletion('${step.id}')"
                            class="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto ${isDone ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}">
                        <span>${isDone ? '✓' : '○'}</span>
                        <span>${isDone ? (this.lang === 'ru' ? 'Пройдено' : 'Completed') : (this.lang === 'ru' ? 'Отметить пройденным' : 'Mark as complete')}</span>
                    </button>
                </div>

                <!-- Быстрое интерактивное действие ("Попробуйте прямо сейчас") -->
                ${step.action ? `
                    <div class="p-3 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-xl border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="text-xs">
                            <div class="font-bold text-blue-300 flex items-center gap-1.5">
                                <span>⚡</span> ${this.lang === 'ru' ? 'Интерактивное действие шага:' : 'Interactive step action:'}
                            </div>
                            <div class="text-slate-300 text-[11px]">${this.lang === 'ru' ? 'Нажмите кнопку для мгновенного выполнения в системе' : 'Click to immediately test this feature in the system'}</div>
                        </div>
                        <button id="btnGuideActionTrigger" 
                                class="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/30 shrink-0">
                            ${step.action.btnText[this.lang]}
                        </button>
                    </div>
                ` : ''}

                <!-- Основной обучающий контент -->
                <div class="guide-prose">
                    ${step.content[this.lang]}
                </div>

                <!-- Экспертная подсказка -->
                ${step.proTip ? `
                    <div class="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                        ${step.proTip[this.lang]}
                    </div>
                ` : ''}

                <!-- Навигационные кнопки Вперед / Назад -->
                <div class="pt-4 border-t border-slate-800 flex items-center justify-between">
                    <button onclick="window.PharmaGate.guideService.selectStep(${this.currentStepIndex - 1})"
                            ${!hasPrev ? 'disabled' : ''}
                            class="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${hasPrev ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 cursor-pointer' : 'opacity-40 text-slate-500 border-slate-800 cursor-not-allowed'}">
                        <span>←</span>
                        <span>${this.lang === 'ru' ? 'Предыдущий шаг' : 'Previous Step'}</span>
                    </button>

                    <div class="text-[11px] text-slate-500 font-mono">
                        ${this.currentStepIndex + 1} / ${this.steps.length}
                    </div>

                    <button onclick="window.PharmaGate.guideService.selectStep(${this.currentStepIndex + 1})"
                            ${!hasNext ? 'disabled' : ''}
                            class="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${hasNext ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 cursor-pointer shadow-md shadow-blue-600/30' : 'opacity-40 text-slate-500 border-slate-800 cursor-not-allowed'}">
                        <span>${this.lang === 'ru' ? 'Следующий шаг' : 'Next Step'}</span>
                        <span>→</span>
                    </button>
                </div>
            </div>
        `;

        // Привязка клика к действию шага
        const actionBtn = document.getElementById('btnGuideActionTrigger');
        if (actionBtn && step.action?.handler) {
            actionBtn.addEventListener('click', () => {
                step.action.handler(this.app, this);
            });
        }
    }

    renderSandbox() {
        const container = document.getElementById('guideSandboxContainer');
        if (!container) return;

        const isRu = this.lang === 'ru';
        const flk = this.sandboxState.flkRow;
        const flkFixed = this.sandboxState.flkFixed;
        const jnvlp = this.sandboxState.jnvlpCalc;

        container.innerHTML = `
            <div class="space-y-6 max-w-4xl">
                <!-- Описание песочницы -->
                <div class="p-3.5 bg-[#090d16] rounded-xl border border-slate-800">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <span>🧪</span>
                        <span>${isRu ? 'Интерактивная песочница и симуляторы PharmaGate' : 'PharmaGate Interactive Live Sandbox & Simulators'}</span>
                    </h3>
                    <p class="text-xs text-slate-400 mt-1">
                        ${isRu 
                            ? 'Протестируйте алгоритмы валидации ФЛК, калькулятор ЖНВЛП и разбор кодов маркировки прямо здесь без изменения боевых документов.' 
                            : 'Test FLC validation algorithms, VED margin formulas, and DataMatrix scanning right here without modifying production documents.'}
                    </p>
                </div>

                <!-- Симулятор 1: Валидатор ФЛК и 1-Click Ремонт -->
                <div class="p-4 bg-[#090d16] rounded-xl border border-slate-800 space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="font-bold text-xs text-white flex items-center gap-2">
                            <span>🛡️</span>
                            <span>${isRu ? 'Симулятор 1: Проверка и авто-ремонт строки накладной' : 'Simulator 1: FLC Row Inspection & Auto-Repair'}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono border ${flkFixed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}">
                            ${flkFixed ? (isRu ? '✓ 100% ФЛК Пройдено' : '✓ 100% FLC Compliant') : (isRu ? '⚠️ Обнаружено 3 ошибки ФЛК' : '⚠️ 3 FLC Issues Found')}
                        </span>
                    </div>

                    <!-- Таблица симулируемой строки -->
                    <div class="overflow-x-auto border border-slate-800 rounded-lg">
                        <table class="w-full text-left text-xs text-slate-200">
                            <thead class="bg-slate-900/90 text-[10px] uppercase font-mono text-slate-400">
                                <tr>
                                    <th class="p-2">Товар</th>
                                    <th class="p-2">Штрихкод</th>
                                    <th class="p-2 text-right">Кол-во</th>
                                    <th class="p-2 text-right">Цена</th>
                                    <th class="p-2 text-right">Сумма строки</th>
                                    <th class="p-2 text-center">ГТД / РУ</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800 bg-[#030712]">
                                <tr>
                                    <td class="p-2 font-medium">${flk.name}</td>
                                    <td class="p-2 font-mono ${!flkFixed ? 'text-rose-400 bg-rose-950/20 font-bold' : 'text-emerald-400'}">${flk.barcode}</td>
                                    <td class="p-2 text-right font-mono">${flk.qnt}</td>
                                    <td class="p-2 text-right font-mono">${flk.price.toFixed(2)} ₽</td>
                                    <td class="p-2 text-right font-mono ${!flkFixed ? 'text-rose-400 bg-rose-950/20 font-bold' : 'text-emerald-400 font-bold'}">${flk.sumStr.toFixed(2)} ₽</td>
                                    <td class="p-2 text-center font-mono ${!flkFixed ? 'text-amber-400 bg-amber-950/20' : 'text-slate-300'}">${flk.gtd}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Список ошибок или подтверждение -->
                    <div class="text-xs">
                        ${!flkFixed ? `
                            <div class="p-2.5 bg-rose-950/20 rounded-lg border border-rose-500/30 space-y-1 text-[11px] text-rose-300">
                                <div>• <b>Ошибка расчета:</b> Сумма строки 1800.00 ₽ не равна QNT (10) * PRICE (185.50) = 1855.00 ₽ (расхождение 55.00 ₽).</div>
                                <div>• <b>Невалидный EAN-13:</b> Штрихкод ${flk.barcode} содержит всего 12 цифр вместо 13.</div>
                                <div>• <b>Неполный номер ГТД:</b> Номер таможенной декларации не соответствует маске ФТС РФ.</div>
                            </div>
                        ` : `
                            <div class="p-2.5 bg-emerald-950/20 rounded-lg border border-emerald-500/30 space-y-1 text-[11px] text-emerald-300">
                                <div>✓ <b>Сумма сбалансирована:</b> 10 * 185.50 = 1855.00 ₽.</div>
                                <div>✓ <b>Штрихкод нормализован:</b> Дополнен валидный контрольный разряд GS1 Modulo-10 (4601669001235).</div>
                                <div>✓ <b>ГТД исправлен:</b> Подставлен зарегистрированный номер РУ Минздрава РФ.</div>
                            </div>
                        `}
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <button id="btnSandboxAutoRepair" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30">
                            <span>⚡</span> ${isRu ? 'Выполнить Авто-Ремонт 1-Click' : 'Execute 1-Click Auto-Repair'}
                        </button>
                        <button id="btnSandboxResetFlk" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer">
                            <span>🔄</span> ${isRu ? 'Сбросить в исходное состояние' : 'Reset Sample'}
                        </button>
                    </div>
                </div>

                <!-- Симулятор 2: Калькулятор ЖНВЛП -->
                <div class="p-4 bg-[#090d16] rounded-xl border border-slate-800 space-y-3">
                    <div class="font-bold text-xs text-white flex items-center gap-2">
                        <span>💊</span>
                        <span>${isRu ? 'Симулятор 2: Калькулятор предельных надбавок ЖНВЛП (ПП РФ №865)' : 'Simulator 2: VED Margin & Price Cap Calculator'}</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                            <label class="text-[11px] text-slate-400 block mb-1">${isRu ? 'Цена производителя (без НДС):' : 'Manufacturer Price (w/o VAT):'}</label>
                            <input type="number" id="sandboxJnvlpPrice" value="${jnvlp.prodPrice}" class="w-full bg-[#030712] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono">
                        </div>
                        <div>
                            <label class="text-[11px] text-slate-400 block mb-1">${isRu ? 'Субъект РФ:' : 'Russian Region:'}</label>
                            <select id="sandboxJnvlpRegion" class="w-full bg-[#030712] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white">
                                <option value="msk">г. Москва (15% опт / 28% розн)</option>
                                <option value="mo">Московская область (14% опт / 26% розн)</option>
                                <option value="spb">г. Санкт-Петербург (13% опт / 25% розн)</option>
                                <option value="nsk">Новосибирская обл. (16% опт / 29% розн)</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[11px] text-slate-400 block mb-1">${isRu ? 'Тип надбавки:' : 'Margin Type:'}</label>
                            <select id="sandboxJnvlpType" class="w-full bg-[#030712] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white">
                                <option value="wholesale">Оптовая надбавка (дистрибьютор)</option>
                                <option value="retail">Розничная надбавка (аптека)</option>
                            </select>
                        </div>
                    </div>

                    <div class="p-3 bg-[#030712] rounded-xl border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                            <div class="text-[10px] text-slate-400">${isRu ? 'Предельная надбавка:' : 'Max Legal Margin:'}</div>
                            <div id="sandboxJnvlpMarkupVal" class="text-sm font-bold text-purple-400 font-mono">${jnvlp.resMarkupPct}%</div>
                        </div>
                        <div>
                            <div class="text-[10px] text-slate-400">${isRu ? 'Макс. цена без НДС:' : 'Max Price w/o VAT:'}</div>
                            <div id="sandboxJnvlpMaxVal" class="text-sm font-bold text-white font-mono">${jnvlp.resMaxPrice.toFixed(2)} ₽</div>
                        </div>
                        <div>
                            <div class="text-[10px] text-slate-400">${isRu ? 'Итого с НДС 10%:' : 'Total with 10% VAT:'}</div>
                            <div id="sandboxJnvlpTotalVal" class="text-sm font-bold text-emerald-400 font-mono">${jnvlp.resWithVat.toFixed(2)} ₽</div>
                        </div>
                    </div>
                </div>

                <!-- Симулятор 3: Парсер маркировки GS1 DataMatrix (Честный ЗНАК) -->
                <div class="p-4 bg-[#090d16] rounded-xl border border-slate-800 space-y-3">
                    <div class="font-bold text-xs text-white flex items-center gap-2">
                        <span>📦</span>
                        <span>${isRu ? 'Симулятор 3: Сканер и парсер маркировки GS1 DataMatrix' : 'Simulator 3: GS1 DataMatrix Scanner & Parser'}</span>
                    </div>

                    <div>
                        <label class="text-[11px] text-slate-400 block mb-1">${isRu ? 'Строка со сканера 2D-штрихкода (GS1 Raw):' : 'Raw Scanner 2D Barcode String:'}</label>
                        <input type="text" id="sandboxDataMatrixInput" value="${this.sandboxState.dataMatrixRaw}" class="w-full bg-[#030712] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono">
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                        <div class="p-2 rounded bg-[#030712] border border-slate-800">
                            <span class="text-[10px] text-slate-400 block">AI 01 (GTIN):</span>
                            <span id="dmGtinVal" class="text-blue-400 font-bold">04601669001234</span>
                        </div>
                        <div class="p-2 rounded bg-[#030712] border border-slate-800">
                            <span class="text-[10px] text-slate-400 block">AI 21 (Серия/SN):</span>
                            <span id="dmSerialVal" class="text-purple-400 font-bold">5ABC123</span>
                        </div>
                        <div class="p-2 rounded bg-[#030712] border border-slate-800">
                            <span class="text-[10px] text-slate-400 block">AI 91 (Ключ):</span>
                            <span id="dmKeyVal" class="text-amber-400 font-bold">FFD0</span>
                        </div>
                        <div class="p-2 rounded bg-[#030712] border border-slate-800">
                            <span class="text-[10px] text-slate-400 block">AI 92 (Криптохвост):</span>
                            <span id="dmCryptoVal" class="text-emerald-400 font-bold truncate block">dGVzdG...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Слушатели для симулятора ФЛК
        document.getElementById('btnSandboxAutoRepair')?.addEventListener('click', () => {
            this.sandboxState.flkFixed = true;
            this.sandboxState.flkRow.sumStr = 1855.00;
            this.sandboxState.flkRow.barcode = '4601669001235';
            this.sandboxState.flkRow.gtd = 'РУ ФСР 2012/13420';
            this.renderSandbox();
            this.app.crossPlatform?.playSound('success');
        });

        document.getElementById('btnSandboxResetFlk')?.addEventListener('click', () => {
            this.sandboxState.flkFixed = false;
            this.sandboxState.flkRow.sumStr = 1800.00;
            this.sandboxState.flkRow.barcode = '460166900123';
            this.sandboxState.flkRow.gtd = '10130010/220524/001';
            this.renderSandbox();
            this.app.crossPlatform?.playSound('click');
        });

        // Слушатели для калькулятора ЖНВЛП
        const calcJnvlp = () => {
            const price = parseFloat(document.getElementById('sandboxJnvlpPrice')?.value || '150');
            const reg = document.getElementById('sandboxJnvlpRegion')?.value || 'msk';
            const type = document.getElementById('sandboxJnvlpType')?.value || 'wholesale';

            let pct = 15;
            if (reg === 'msk') pct = type === 'wholesale' ? 15 : 28;
            else if (reg === 'mo') pct = type === 'wholesale' ? 14 : 26;
            else if (reg === 'spb') pct = type === 'wholesale' ? 13 : 25;
            else if (reg === 'nsk') pct = type === 'wholesale' ? 16 : 29;

            const maxPrice = price * (1 + pct / 100);
            const total = maxPrice * 1.10;

            const mkEl = document.getElementById('sandboxJnvlpMarkupVal');
            const mxEl = document.getElementById('sandboxJnvlpMaxVal');
            const ttEl = document.getElementById('sandboxJnvlpTotalVal');

            if (mkEl) mkEl.textContent = `${pct}%`;
            if (mxEl) mxEl.textContent = `${maxPrice.toFixed(2)} ₽`;
            if (ttEl) ttEl.textContent = `${total.toFixed(2)} ₽`;
        };

        document.getElementById('sandboxJnvlpPrice')?.addEventListener('input', calcJnvlp);
        document.getElementById('sandboxJnvlpRegion')?.addEventListener('change', calcJnvlp);
        document.getElementById('sandboxJnvlpType')?.addEventListener('change', calcJnvlp);

        // Слушатели для DataMatrix
        document.getElementById('sandboxDataMatrixInput')?.addEventListener('input', (e) => {
            const raw = e.target.value;
            // Простое извлечение для интерактивности
            const gtinMatch = raw.match(/01(\d{14})/);
            const gtin = gtinMatch ? gtinMatch[1] : (raw.slice(2, 16) || '—');
            const el = document.getElementById('dmGtinVal');
            if (el) el.textContent = gtin;
        });
    }

    renderCheatsheet() {
        const container = document.getElementById('guideCheatsheetContainer');
        if (!container) return;

        const isRu = this.lang === 'ru';

        container.innerHTML = `
            <div class="space-y-6 max-w-4xl">
                <!-- Заголовок шпаргалки -->
                <div class="p-3.5 bg-[#090d16] rounded-xl border border-slate-800">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <span>⚡</span>
                        <span>${isRu ? 'Оперативная шпаргалка фармацевта и оператора EDI' : 'Operator Cheat Sheet: Formats, DBF Fields & Tax Codes'}</span>
                    </h3>
                    <p class="text-xs text-slate-400 mt-1">
                        ${isRu 
                            ? 'Справочная таблица основных полей таблиц DBF, правил применения ставок НДС и системных горячих клавиш.' 
                            : 'Quick reference guide of dBase schema column names, Russian VAT taxation tiers, and keyboard shortcuts.'}
                    </p>
                </div>

                <!-- 1. Спецификация стандартных колонок DBF накладной -->
                <div class="p-4 bg-[#090d16] rounded-xl border border-slate-800 space-y-2.5">
                    <div class="font-bold text-xs text-white flex items-center gap-2">
                        <span>📋</span>
                        <span>${isRu ? 'Стандартные поля DBF накладной (dBase III / FoxPro)' : 'Standard DBF Invoice Schema Fields'}</span>
                    </div>

                    <div class="overflow-x-auto border border-slate-800 rounded-lg">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-slate-900 text-[10px] uppercase font-mono text-slate-400">
                                <tr>
                                    <th class="p-2">Поле DBF</th>
                                    <th class="p-2">Тип</th>
                                    <th class="p-2">${isRu ? 'Назначение' : 'Purpose'}</th>
                                    <th class="p-2">${isRu ? 'Правило ФЛК' : 'FLC Rule'}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800 font-mono text-[11px] text-slate-300">
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">NAME</td>
                                    <td class="p-2 text-slate-400">C (120)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Торговое наименование препарата' : 'Commercial medicine brand name'}</td>
                                    <td class="p-2 font-sans text-emerald-400">${isRu ? 'Обязательное (NOT NULL)' : 'Mandatory (NOT NULL)'}</td>
                                </tr>
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">PROIZV</td>
                                    <td class="p-2 text-slate-400">C (80)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Завод-производитель и страна' : 'Manufacturer and manufacturing country'}</td>
                                    <td class="p-2 font-sans text-slate-400">${isRu ? 'Рекомендуемое' : 'Recommended'}</td>
                                </tr>
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">BARCODE</td>
                                    <td class="p-2 text-slate-400">C (13)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Штрихкод потребительской упаковки EAN-13' : 'Package EAN-13 barcode'}</td>
                                    <td class="p-2 font-sans text-amber-400">${isRu ? 'Контрольный разряд Modulo-10' : 'Modulo-10 Checksum'}</td>
                                </tr>
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">SERIA</td>
                                    <td class="p-2 text-slate-400">C (20)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Производственная серия партии' : 'Production lot / batch series'}</td>
                                    <td class="p-2 font-sans text-emerald-400">${isRu ? 'Обязательное' : 'Mandatory'}</td>
                                </tr>
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">EXP_DATE</td>
                                    <td class="p-2 text-slate-400">D (8)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Срок годности препарата (ГГГГММДД)' : 'Expiration date (YYYYMMDD)'}</td>
                                    <td class="p-2 font-sans text-amber-400">${isRu ? 'Остаточный срок > 180 дней' : 'Remaining shelf life > 180 d'}</td>
                                </tr>
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">PRICE2</td>
                                    <td class="p-2 text-slate-400">N (12, 2)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Оптовая цена поставщика без НДС' : 'Distributor price w/o VAT'}</td>
                                    <td class="p-2 font-sans text-emerald-400">${isRu ? 'Положительное число > 0' : 'Positive number > 0'}</td>
                                </tr>
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">QNT</td>
                                    <td class="p-2 text-slate-400">N (10, 0)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Количество упаковок' : 'Package quantity'}</td>
                                    <td class="p-2 font-sans text-emerald-400">${isRu ? 'Целое число > 0' : 'Integer > 0'}</td>
                                </tr>
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">SUMSTR</td>
                                    <td class="p-2 text-slate-400">N (14, 2)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Сумма строки (QNT * PRICE2)' : 'Row line total'}</td>
                                    <td class="p-2 font-sans text-rose-400">${isRu ? 'Строго равен QNT * PRICE2' : 'Must strictly match product'}</td>
                                </tr>
                                <tr>
                                    <td class="p-2 text-blue-400 font-bold">NDS</td>
                                    <td class="p-2 text-slate-400">N (4, 1)</td>
                                    <td class="p-2 font-sans">${isRu ? 'Ставка НДС (0%, 10%, 20%)' : 'VAT rate (0%, 10%, 20%)'}</td>
                                    <td class="p-2 font-sans text-emerald-400">${isRu ? 'Только 0, 10, 20' : 'Strictly 0, 10, 20'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 2. Ставки НДС и формулы -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="p-3 bg-[#090d16] rounded-xl border border-slate-800">
                        <div class="text-xs font-bold text-emerald-400 mb-1">Ставка НДС 10% (Льготная)</div>
                        <p class="text-[11px] text-slate-400 leading-tight">Применяется к лекарственным средствам из перечня Правительства РФ (ст. 164 НК РФ).</p>
                    </div>
                    <div class="p-3 bg-[#090d16] rounded-xl border border-slate-800">
                        <div class="text-xs font-bold text-blue-400 mb-1">Ставка НДС 20% (Базовая)</div>
                        <p class="text-[11px] text-slate-400 leading-tight">Применяется к БАДам, лечебной косметике, средствам гигиены и сопутствующим товарам.</p>
                    </div>
                    <div class="p-3 bg-[#090d16] rounded-xl border border-slate-800">
                        <div class="text-xs font-bold text-purple-400 mb-1">Ставка НДС 0% (Освобождение)</div>
                        <p class="text-[11px] text-slate-400 leading-tight">Применяется к важнейшим медицинским изделиям по списку Минпромторга при наличии РУ.</p>
                    </div>
                </div>

                <!-- 3. Горячие клавиши системы -->
                <div class="p-4 bg-[#090d16] rounded-xl border border-slate-800 space-y-2">
                    <div class="font-bold text-xs text-white">⌨️ Горячие клавиши PharmaGate WebOS:</div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div class="p-2 bg-[#030712] rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">Командная палитра:</span>
                            <span class="font-mono text-blue-400 font-bold">⌘K / Ctrl+K</span>
                        </div>
                        <div class="p-2 bg-[#030712] rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">Открыть файл:</span>
                            <span class="font-mono text-blue-400 font-bold">⌘O / Ctrl+O</span>
                        </div>
                        <div class="p-2 bg-[#030712] rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">Сохранить DBF:</span>
                            <span class="font-mono text-blue-400 font-bold">⌘S / Ctrl+S</span>
                        </div>
                        <div class="p-2 bg-[#030712] rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">Авто-Ремонт ФЛК:</span>
                            <span class="font-mono text-emerald-400 font-bold">F5</span>
                        </div>
                        <div class="p-2 bg-[#030712] rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">Этот Гид / Справка:</span>
                            <span class="font-mono text-cyan-400 font-bold">F1</span>
                        </div>
                        <div class="p-2 bg-[#030712] rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">Создать (Мастер):</span>
                            <span class="font-mono text-blue-400 font-bold">⌘N / Ctrl+N</span>
                        </div>
                        <div class="p-2 bg-[#030712] rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">Откат правки (Undo):</span>
                            <span class="font-mono text-purple-400 font-bold">⌘Z / Ctrl+Z</span>
                        </div>
                        <div class="p-2 bg-[#030712] rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">На весь экран:</span>
                            <span class="font-mono text-amber-400 font-bold">F11</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderFaq() {
        const container = document.getElementById('guideFaqContainer');
        if (!container) return;

        const isRu = this.lang === 'ru';
        const q = this.faqQuery.trim().toLowerCase();

        const filtered = this.faqItems.filter(item => {
            if (!q) return true;
            const question = item.q[this.lang].toLowerCase();
            const answer = item.a[this.lang].toLowerCase();
            return question.includes(q) || answer.includes(q);
        });

        container.innerHTML = `
            <div class="space-y-4 max-w-3xl">
                <!-- Поиск по FAQ -->
                <div class="flex items-center gap-2">
                    <input type="text" id="guideFaqSearchInput" value="${this.faqQuery}" 
                           placeholder="${isRu ? '🔍 Поиск по вопросам и ответам (НДС, кодировка, кракозябры, Диадок)...' : '🔍 Search FAQ topics...'}"
                           class="flex-1 bg-[#090d16] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500">
                </div>

                <!-- Список вопросов-аккордеонов -->
                <div class="space-y-2">
                    ${filtered.length === 0 ? `
                        <div class="p-6 text-center text-xs text-slate-500 bg-[#090d16] rounded-xl border border-slate-800">
                            ${isRu ? 'По вашему запросу вопросов не найдено' : 'No matching questions found'}
                        </div>
                    ` : filtered.map(item => {
                        const isOpen = this.openFaqId === item.id;
                        return `
                            <div class="border border-slate-800/80 rounded-xl overflow-hidden bg-[#090d16] transition-colors">
                                <button onclick="window.PharmaGate.guideService.toggleFaq('${item.id}')"
                                        class="w-full px-4 py-3 text-left font-semibold text-xs flex items-center justify-between gap-3 text-slate-200 hover:text-white cursor-pointer">
                                    <span class="flex items-center gap-2">
                                        <span class="text-blue-400">❓</span>
                                        <span>${item.q[this.lang]}</span>
                                    </span>
                                    <span class="text-slate-500 font-mono text-sm shrink-0">${isOpen ? '▲' : '▼'}</span>
                                </button>
                                ${isOpen ? `
                                    <div class="px-4 pb-3.5 pt-1 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 bg-[#060a12]">
                                        ${item.a[this.lang]}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        document.getElementById('guideFaqSearchInput')?.addEventListener('input', (e) => {
            this.faqQuery = e.target.value;
            this.renderFaq();
        });
    }

    toggleFaq(faqId) {
        this.openFaqId = this.openFaqId === faqId ? null : faqId;
        this.renderFaq();
    }
}
