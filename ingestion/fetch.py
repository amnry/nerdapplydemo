"""Stage 1: download one registered page politely, keep a raw snapshot, and reduce it to visible text.
Exists so every later stage works from a hashed, replayable copy and never from the live site."""
import hashlib
import time
from dataclasses import dataclass
from urllib import robotparser
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from .models import DATA

UA = "NerdApplyDemoBot/0.1 (student demo; respects robots.txt)"
_last_hit: dict = {}
_robots: dict = {}


@dataclass
class FetchResult:
    source_id: str
    url: str
    final_url: str = ""
    status: int = 0
    text: str = ""
    sha: str = ""
    tokens_est: int = 0
    skipped: str = ""   # reason the page was not used (robots, non_html, off_domain_redirect)
    error: str = ""


def allowed_hosts(source: dict) -> list:
    """Official domains for a source: explicit allow_hosts, else the registrable tail of its URL host."""
    if source.get("allow_hosts"):
        return list(source["allow_hosts"])
    return [".".join((urlparse(source["url"]).hostname or "").split(".")[-2:])]


def host_ok(url: str, hosts: list) -> bool:
    h = urlparse(url).hostname or ""
    return any(h == a or h.endswith("." + a) for a in hosts)


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "template"]):
        tag.decompose()
    lines = (ln.strip() for ln in soup.get_text("\n").splitlines())
    return "\n".join(ln for ln in lines if ln)


def _throttle(host: str) -> None:
    wait = 1.0 - (time.monotonic() - _last_hit.get(host, 0.0))
    if wait > 0:
        time.sleep(wait)
    _last_hit[host] = time.monotonic()


def _get(client: httpx.Client, url: str, retries: int = 2) -> httpx.Response:
    for attempt in range(retries + 1):
        _throttle(urlparse(url).hostname or "")
        try:
            resp = client.get(url)
            if resp.status_code < 500 or attempt == retries:
                return resp
        except httpx.TransportError:
            if attempt == retries:
                raise
        time.sleep(1.0)


def robots_ok(client: httpx.Client, url: str) -> bool:
    """RFC 9309: 4xx on robots.txt means allowed; 5xx or no answer means disallowed."""
    p = urlparse(url)
    root = f"{p.scheme}://{p.netloc}"
    if root not in _robots:
        rp = robotparser.RobotFileParser()
        try:
            r = _get(client, root + "/robots.txt")
            if r.status_code >= 500:
                rp.disallow_all = True
            elif r.status_code >= 400:
                rp.allow_all = True
            else:
                rp.parse(r.text.splitlines())
        except httpx.HTTPError:
            rp.disallow_all = True
        _robots[root] = rp
    return _robots[root].can_fetch(UA, url)


def check_url(client: httpx.Client, url: str) -> bool:
    """Gate Q7 helper: True if the URL answers 2xx or 3xx."""
    try:
        return _get(client, url).status_code < 400
    except httpx.HTTPError:
        return False


def fetch_source(source: dict, client: httpx.Client) -> FetchResult:
    res = FetchResult(source_id=source["id"], url=source["url"])
    if not robots_ok(client, source["url"]):
        res.skipped = "robots_disallowed"
        return res
    try:
        resp = _get(client, source["url"])
    except httpx.HTTPError as exc:
        res.error = f"{type(exc).__name__}: {exc}"
        return res
    res.status, res.final_url = resp.status_code, str(resp.url)
    ctype = resp.headers.get("content-type", "")
    if resp.status_code != 200:
        res.error = f"http_{resp.status_code}"
    elif not host_ok(res.final_url, allowed_hosts(source)):
        res.skipped = f"off_domain_redirect:{res.final_url}"
    elif "html" not in ctype:
        res.skipped = f"non_html:{ctype or 'unknown'}"
    else:
        res.text = html_to_text(resp.text)
        res.sha = hashlib.sha256(res.text.encode()).hexdigest()
        res.tokens_est = len(res.text) // 4
        raw = DATA / "raw" / source["id"]
        raw.mkdir(parents=True, exist_ok=True)
        (raw / f"{res.sha}.html").write_text(resp.text)
    return res


def new_client() -> httpx.Client:
    return httpx.Client(headers={"User-Agent": UA}, timeout=20.0, follow_redirects=True)
