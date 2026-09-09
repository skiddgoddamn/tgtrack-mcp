<div align="center">

# tgtrack-mcp

**Управляй аккаунтом [tgtrack](https://tgtrack.ru) / «Откуда Подписки» из AI-агента — каналы, интеграции (рекламные системы), настройки трекинг-скрипта, цели и ссылки — без официального API.**

![license](https://img.shields.io/badge/license-MIT-blue)
![MCP](https://img.shields.io/badge/MCP-server-6E56CF)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![tests](https://img.shields.io/badge/tests-passing-34c759)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-34c759)

[English](./README.md) · **Русский**

</div>

## Зачем

tgtrack («Откуда Подписки») отслеживает, **откуда приходят подписчики Telegram-канала**, и отправляет офлайн-конверсии *«подписка»* обратно в Яндекс.Метрику / Директ. Всё — каналы, «рекламные системы» (интеграции), трекинг-скрипт лендинга, цели, ссылки, отчёты — живёт только в панели `settings.tgtrack.ru`. **Публичного API нет.**

**tgtrack-mcp** отдаёт этот control-plane как [MCP](https://modelcontextprotocol.io)-инструменты. Он ходит в те же внутренние эндпоинты, что и панель, и **подписывает каждый запрос ровно как панель** (короткоживущий JWT + md5-подпись), так что агент (Claude и т.п.) может смотреть каналы, читать и создавать интеграции, править настройки скрипта, цели и ссылки — за один проход.

- 🔑 **Работает по токену панели** — JWT из URL `settings.tgtrack.ru`, ничего не скрапится и не хардкодится
- 🧩 **26 инструментов** — control plane настроек **плюс рантайм Bot API** (события старта/стопа, глубокие цели, `get_user_info`); чтение + безопасные записи, опасные действия за `confirm: true`
- 🧮 **Точная подпись** — `H = md5(md5(JSON + T) + T)`, проверена на живом сэмпле
- 🪶 **TypeScript, ESM, strict** — тонкий, MIT, без секретов в репозитории

## Как это работает

Каждый вызов — `POST` на `https://api.tgtrack.ru/API/settings/<endpoint>.php` с телом `multipart/form-data` из двух полей:

```
JSON = JSON.stringify({ ...params, T, tn })   // T = unix-секунды, tn = твой JWT
H    = md5( md5(JSON + T) + T )               // подпись запроса (соль = T)
```

Ответ — конверт `{ S, D, M }`: `S === 0` — успех, данные в `D.data`; иначе инструмент вернёт типизированную ошибку (`217/218` = плохой/истёкший токен → понятное «обнови токен»).

## Требования

1. **Node ≥ 18.**
2. **Токен tgtrack** (`TGTRACK_TOKEN`): открой [settings.tgtrack.ru](https://settings.tgtrack.ru) и скопируй значение параметра `t=` из адресной строки (или cookie `tgtrack_token`). Токен короткоживущий (~72 ч); рабочего refresh у tgtrack нет — при истечении вставь свежий.

## Установка

```bash
npm install
npm run build
```

Подключение к MCP-клиенту (см. [`.mcp.json.example`](./.mcp.json.example)):

```json
{
  "mcpServers": {
    "tgtrack": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "TGTRACK_TOKEN": "<JWT из ?t=... в settings.tgtrack.ru>" }
    }
  }
}
```

## Инструменты

### Чтение

| Инструмент | Назначение |
|------------|------------|
| `tgtrack_list_channels` | Список всех каналов / групп / ботов аккаунта. |
| `tgtrack_get_channel` | Канал целиком: интеграции (рекламные системы), ссылки, настройки скрипта и отчётов. |
| `tgtrack_get_integration_script` | Собрать готовый `<script>` + ссылку `click.tgtrack.ru` по `linkID` + `counterID` (без запроса к API). |

### Интеграции («рекламные системы»)

| Инструмент | Назначение |
|------------|------------|
| `tgtrack_create_integration` | Создать интеграцию. Для `yandex` вернёт `grantAccessUrl` + `webCreationCode` (заверши OAuth в браузере). |
| `tgtrack_set_script_settings` | Настройки скрипта интеграции (strict mode, задержка конверсии, авто-одобрение, флаги целей…). |
| `tgtrack_update_goal` | Обновить цель (имя/значение в Метрике), опционально создать. |
| `tgtrack_yandex_web_create_status` | Статус авто-создания целей Яндекса по `webCreationCode`. |
| `tgtrack_get_restore_yandex_link` | Ссылка для повторной выдачи Яндекс-доступа по интеграции. |

### Ссылки и канал

| Инструмент | Назначение |
|------------|------------|
| `tgtrack_get_landings` | Лендинги, привязанные к каналу / интеграции. |
| `tgtrack_set_link_url` | Сменить целевой URL ссылки. |
| `tgtrack_set_link_name` | Переименовать ссылку / интеграцию. |
| `tgtrack_set_outbound_link_params` | Параметры кнопки под постом (цель, текст, проверка подписки). |
| `tgtrack_set_channel_auto_approve` | Вкл/выкл авто-одобрение заявок на вступление. |
| `tgtrack_set_report_settings` | Настройки ежедневных отчётов (утренний, если нет подписок, по трафику). |

### Опасные — требуют `confirm: true`

| Инструмент | Назначение |
|------------|------------|
| `tgtrack_delete_invite_link` | ⚠️ Удалить invite-ссылку / интеграцию (необратимо). |
| `tgtrack_delete_outbound_link` | ⚠️ Удалить outbound-ссылку (необратимо). |
| `tgtrack_new_api_token` | ⚠️ Создать новый API-ключ — **инвалидирует предыдущий**. |
| `tgtrack_new_report_key` | ⚠️ Создать новый ключ отчётов — инвалидирует предыдущий. |

Без `confirm: true` опасные инструменты возвращают описание того, что *сделали бы*, и не трогают API.

### Bot API — рантайм-события (`bot-api.tgtrack.ru`)

Отдельный от settings контур: **не** подписывается JWT — шлёт JSON `POST`-ом на
`https://bot-api.tgtrack.ru/v1/<API_KEY>/<метод>` (MAX: `https://max.tgtrack.ru/API/bot-api/v1/<API_KEY>/<метод>`).
`API_KEY` — **ключ конкретного бота/канала** (`apiToken` в `tgtrack_get_channel`), не JWT панели —
передавай его как `apiKey` в каждом вызове либо задай `TGTRACK_BOT_API_KEY`. Для MAX — `max: true`.

| Инструмент | Назначение |
|------------|------------|
| `tgtrack_bot_event_url` | Собрать webhook-URL для конструктора (напр. `my_bothelp_was_started`) — без запроса; вставить в BotHelp/SaleBot. |
| `tgtrack_bot_started` | `my_bot_was_started` — ограниченная интеграция, передать `start_value` (или `auto_detect`). |
| `tgtrack_bot_user_started` | `user_did_start_bot` — старт с данными пользователя (`user_id`, имя, `start_value`). |
| `tgtrack_bot_stopped` | `my_bot_was_stopped` — пользователь заблокировал/отписался. |
| `tgtrack_bot_on_telegram_webhook` | `on_telegram_webhook` — полная интеграция: переслать сырой webhook Telegram 1:1. |
| `tgtrack_bot_send_reach_goal` | `send_reach_goal` — глубокая цель в рекламную систему, откуда пришёл пользователь (окно 21 день). |
| `tgtrack_bot_add_event` | `add_event` — событие воронки/продажа с `amount`, `conversion_target`, `labels`. |
| `tgtrack_bot_get_user_info` | `get_user_info` — utm-метки, даты подписки/отписки и первый источник по `user_id`. |

## Использование

Запуск MCP-сервера по stdio или прямой вызов инструмента для скриптов:

```bash
node dist/index.js                                   # MCP (stdio)

TGTRACK_TOKEN=... npx tsx src/run.ts tgtrack_list_channels
TGTRACK_TOKEN=... npx tsx src/run.ts tgtrack_get_channel '{"chatID":"600334c8b9b9e"}'
```

Streamable HTTP:

```bash
TGTRACK_TOKEN=... node dist/index.js --http --port 3001   # /mcp, /health
```

## Область v1

**Входит:** весь settings/management control-plane — каналы, интеграции, настройки скрипта, цели, ссылки, отчёты.

**Пока не входит:**
- **Аналитика-данные** (подписки по времени, источники, конверсии) — отдельный reporting API по ключу отчётов (`tgtrack_new_report_key`). План v2.
- **Админ-инструменты** (`deleteChannel`, `changeUserAccess`, …) — за флагом, план v1.1.
- **MAX** (`max.tgtrack.ru`) — за опцией `service`.

## Безопасность

Токен живёт только в окружении (`TGTRACK_TOKEN`) — не в репозитории, не в логах, не в текстах ошибок. `.mcp.json` и `.env` в `.gitignore`; коммитится только `.mcp.json.example` с плейсхолдером.

## Лицензия

MIT
