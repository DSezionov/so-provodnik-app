"""Polite HTTP fetcher for so-wiki.ru.

- obeys robots.txt (Google-style matching: `*` / `$` wildcards, longest rule wins);
- honours Crawl-delay (never faster than 1 request per second);
- caches every response on disk and revalidates with ETag / Last-Modified.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

import requests

BASE_URL = "https://so-wiki.ru"
USER_AGENT = "ProvodnikBot/0.1 (+https://github.com/DSezionov/so-provodnik-app)"
MIN_DELAY_S = 1.0
DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"


class RobotsDisallowed(Exception):
    pass


@dataclass
class RobotsRules:
    rules: list[tuple[bool, str]] = field(default_factory=list)  # (allow, pattern)
    crawl_delay: float | None = None

    @classmethod
    def parse(cls, text: str, user_agent: str) -> "RobotsRules":
        """Pick the group for `user_agent` (exact token match), falling back to `*`."""
        groups: dict[str, RobotsRules] = {}
        current: list[str] = []
        last_was_agent = False
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = (p.strip() for p in line.split(":", 1))
            key = key.lower()
            if key == "user-agent":
                if not last_was_agent:
                    current = []
                current.append(value.lower())
                groups.setdefault(value.lower(), cls())
                last_was_agent = True
                continue
            last_was_agent = False
            for agent in current:
                group = groups[agent]
                if key in ("allow", "disallow") and value:
                    group.rules.append((key == "allow", value))
                elif key == "crawl-delay":
                    try:
                        group.crawl_delay = float(value)
                    except ValueError:
                        pass
        token = user_agent.split("/", 1)[0].lower()
        return groups.get(token) or groups.get("*") or cls()

    @staticmethod
    def _pattern_to_regex(pattern: str) -> re.Pattern[str]:
        anchored = pattern.endswith("$")
        body = pattern[:-1] if anchored else pattern
        regex = "".join(".*" if ch == "*" else re.escape(ch) for ch in body)
        return re.compile(regex + ("$" if anchored else ""))

    def allowed(self, path_and_query: str) -> bool:
        # Compare decoded paths so that rules written in Cyrillic match percent-encoded URLs.
        target = unquote(path_and_query)
        best: tuple[int, bool] | None = None
        for allow, pattern in self.rules:
            if self._pattern_to_regex(unquote(pattern)).match(target):
                candidate = (len(pattern), allow)
                # Longest match wins; on a tie Allow wins.
                if best is None or candidate[0] > best[0] or (candidate[0] == best[0] and allow):
                    best = candidate
        return True if best is None else best[1]


def page_url(title: str) -> str:
    return f"{BASE_URL}/wiki/{quote(title.replace(' ', '_'), safe='')}"


@dataclass
class Response:
    url: str
    status: int
    content: bytes
    from_cache: bool
    headers: dict[str, str]

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")


class PoliteFetcher:
    def __init__(self, cache_dir: Path = DEFAULT_CACHE_DIR, offline: bool = False) -> None:
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.offline = offline
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._last_request = 0.0
        self.network_requests = 0
        self.robots = RobotsRules()
        self.delay = MIN_DELAY_S
        robots = self.get(f"{BASE_URL}/robots.txt", check_robots=False, revalidate=True)
        self.robots = RobotsRules.parse(robots.text, USER_AGENT)
        self.delay = max(MIN_DELAY_S, self.robots.crawl_delay or 0)

    def _cache_paths(self, url: str) -> tuple[Path, Path]:
        key = hashlib.sha1(url.encode()).hexdigest()
        return self.cache_dir / f"{key}.json", self.cache_dir / f"{key}.body"

    def _throttle(self) -> None:
        wait = self._last_request + self.delay - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self._last_request = time.monotonic()

    def get(self, url: str, *, check_robots: bool = True, revalidate: bool = False) -> Response:
        """Return the cached body; hit the network only if missing or `revalidate` is set."""
        parts = urlsplit(url)
        path = parts.path + (f"?{parts.query}" if parts.query else "")
        if check_robots and not self.robots.allowed(path):
            raise RobotsDisallowed(url)

        meta_path, body_path = self._cache_paths(url)
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else None
        if meta and (not revalidate or self.offline):
            return Response(url, meta["status"], body_path.read_bytes(), True, meta["headers"])
        if self.offline:
            raise FileNotFoundError(f"not cached (offline mode): {url}")

        headers = {}
        if meta:
            if etag := meta["headers"].get("etag"):
                headers["If-None-Match"] = etag
            if modified := meta["headers"].get("last-modified"):
                headers["If-Modified-Since"] = modified
        self._throttle()
        self.network_requests += 1
        resp = self.session.get(url, headers=headers, timeout=30)
        if resp.status_code == 304 and meta:
            return Response(url, meta["status"], body_path.read_bytes(), True, meta["headers"])

        kept = {k.lower(): v for k, v in resp.headers.items() if k.lower() in ("etag", "last-modified", "content-type")}
        meta = {"url": url, "status": resp.status_code, "headers": kept, "fetched_at": time.time()}
        body_path.write_bytes(resp.content)
        meta_path.write_text(json.dumps(meta, ensure_ascii=False))
        return Response(url, resp.status_code, resp.content, False, kept)
