# scraper — сбор данных с so-wiki.ru

Статус: вежливый загрузчик, парсер, нормализация в модель и сборка JSON для выборки из 50 заданий. Полный сбор всех 1534 заданий и CI данных — Фаза 1 (после ответа админа вики).

## Этикет: robots.txt (прочитан 2026-10-18)

Файл: <https://so-wiki.ru/robots.txt> (last-modified 2026-05-12). Наш User-Agent `ProvodnikBot/0.1 (+https://github.com/DSezionov/so-provodnik-app)` своей группы не имеет → действуют правила `User-agent: *`:

| Правило | Что значит для нас |
|---|---|
| `Disallow: /w/` | **Запрещены `/w/api.php` и `/w/index.php`** → нельзя MediaWiki API и SMW API (`action=ask`, `browsebysubject`). Картинки (`/w/images/`) тоже не качаем. |
| `Disallow: /wiki/Special:` и `/wiki/Служебная:` | Нельзя `Special:Ask`, `Special:Browse`, `Special:Export`, `Special:RecentChanges` и т.п. |
| `Disallow: /wiki/edit/`, `/wiki/history/`, `/wiki/purge/`, `/wiki/info/` | Не трогаем. |
| `Disallow: /*diff=`, `/*oldid=`, `/*action=history`, `/*action=edit`, `/*action=purge`, `/*limit=250`, `/*limit=500` | Не используем такие параметры. |
| `Crawl-delay: 5` | **Не чаще 1 запроса в 5 секунд** (строже, чем «≤ 1/сек» из SPEC). |
| `User-agent: ClaudeBot — Disallow: /` (а также AhrefsBot, SemrushBot и др.) | Нас формально не касается (другой UA), но сигнал владельца понятен — см. письмо админу в `data/report.md`. |
| `Sitemap: https://so-wiki.ru/sitemap.xml` | Разрешено и полезно: `lastmod` по каждой странице → инкрементальное обновление. |

**Разрешено и используется:** `GET /wiki/<Страница>` (отрендеренный HTML), `/sitemap.xml` и `/sitemap/*.xml.gz`, `/robots.txt`.

`?action=raw` на `/wiki/…` формально не запрещён, но по духу правил (закрыт весь бэкенд `/w/`) не используем без явного разрешения администратора.

## Как устроен загрузчик (`provodnik_scraper/fetch.py`)

- перед стартом читает `robots.txt` и проверяет каждый URL (wildcards `*`/`$`, «самое длинное правило побеждает»); запрещённый URL → исключение `RobotsDisallowed`, запрос не уходит;
- пауза между сетевыми запросами = `max(1 с, Crawl-delay)` = 5 с;
- кэш на диске `scraper/cache/` (в `.gitignore`), повторный запуск берёт из кэша; при `revalidate` — условный запрос `If-None-Match` / `If-Modified-Since`;
- режим `offline=True` — работа только из кэша (разбор и отчёт без сети).

## Запуск (Фаза 0)

```bash
python3 -m venv scraper/.venv
scraper/.venv/bin/pip install -r scraper/requirements.txt
cd scraper
.venv/bin/python -m provodnik_scraper.probe --fetch   # докачать недостающее (≈5 с/стр.)
.venv/bin/python -m provodnik_scraper.probe           # офлайн: метрики в stdout, разбор → data/probe/sample-quests.json
.venv/bin/python -m pytest tests
.venv/bin/python -m provodnik_scraper.build           # офлайн: выборка → public/data/*.json (модель SPEC §4.2)
```

`build` — разбор (`parse.py`) → нормализация в модель (`model.py`, чистые функции с тестами) → `public/data/quests.json`, `npcs.json`, `locations.json`, `items.json`, `meta.json`. Справочники содержат только то, на что ссылаются задания. До ответа админа собирается только выборка из 50 заданий (`meta.json: "sample": true`).

Выборка заданий — `scraper/sample_titles.json` (детерминированная, seed 20261018).

> Целевая версия Python по SPEC — 3.12; код Фазы 0 совместим и с 3.9 (локально был только он).
