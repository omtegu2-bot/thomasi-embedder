import aiohttp
import asyncio
from bs4 import BeautifulSoup
import json
from urllib.parse import urljoin, urlparse
from asyncio import Semaphore
from collections import Counter
import re
import os

MAX_PAGES_PER_SITE = 30000
MAX_CONCURRENT_REQUESTS = 500
SAVE_INTERVAL = 500
SCRAPER_VERSION = "0.2.0"
SCHEMA_VERSION = 2


semaphore = Semaphore(MAX_CONCURRENT_REQUESTS)

# --- Helper functions ---
async def fetch(session, url):
    async with semaphore:
        try:
            async with session.get(url, timeout=10) as response:
                if response.status == 200:
                    return await response.text()
        except:
            return None
    return None

def clean_words(text):
    return re.findall(r'\b\w+\b', text.lower())

def most_common_word(text, max_words=1000):
    words = clean_words(text)[:max_words]
    if not words:
        return "none"
    counter = Counter(words)
    return counter.most_common(1)[0][0]

def extract_tags_from_description(description):
    words = clean_words(description)
    counter = Counter(words)
    tags = [w for w, _ in counter.most_common(10) if len(w) >= 5][:2]
    while len(tags) < 2:
        tags.append("none")
    return tags

async def scrape_page(session, url, depth=0, discovered_from=None):
    import time
    start_fetch = time.perf_counter()

    try:
        html = await fetch(session, url)
        fetch_time_ms = int((time.perf_counter() - start_fetch) * 1000)

        if not html:
            return None

        start_process = time.perf_counter()

        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.string.strip() if soup.title else "No Title"

        desc_tag = soup.find("meta", attrs={"name": "description"})
        description = desc_tag["content"][:300] if desc_tag and desc_tag.get("content") else ""

        full_text = soup.get_text(separator=" ", strip=True)
        stats = word_stats(full_text)
        entities = extract_entities(full_text)

        processing_time_ms = int((time.perf_counter() - start_process) * 1000)

        parsed = urlparse(url)

        data = {
            "_schema_version": SCHEMA_VERSION,
            "_scraper_version": SCRAPER_VERSION,

            "url": url,
            "domain": parsed.netloc,
            "path": parsed.path or "/",

            "crawl": {
                "discovered_from": discovered_from,
                "depth": depth,
                "fetch_time_ms": fetch_time_ms,
                "processing_time_ms": processing_time_ms,
                "status": 200
            },

            "content": {
                "title": title,
                "description": description
            },

            "signals": {
                "word_count": stats["word_count"],
                "unique_words": stats["unique_words"],
                "text_length": len(full_text)
            },

            "entities": entities,

            "links": {
                "incoming": 0,
                "outgoing": 0
            }
        }

        print(f"Scraped: {url}")
        return data

    except Exception as e:
        print(f"Failed: {url} ({e})")
        return None


async def get_links(session, url, base_domain):
    html = await fetch(session, url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    links = set()

    for a in soup.find_all("a", href=True):
        link = urljoin(url, a["href"])
        parsed = urlparse(link)

        if parsed.scheme in ("http", "https") and parsed.netloc.endswith(base_domain):
            links.add(link)

    return list(links)


# --- Scrape site with resuming ---
async def scrape_site(start_url, existing_results=None):
    incoming_counter = Counter()

    """
    Scrape a site starting from start_url, respecting MAX_PAGES_PER_SITE per site.
    """
    domain = urlparse(start_url).netloc
    results = existing_results if existing_results else []

    # Start with URLs already in existing_results for this domain
    to_visit = []

    # Seed existing pages (optional resume)
    for r in results:
        if urlparse(r["url"]).netloc.endswith(domain):
            to_visit.append((r["url"], r.get("crawl", {}).get("depth", 0), None))

    # Seed the start URL
    if not any(u == start_url for u, _, _ in to_visit):
        to_visit.append((start_url, 0, None))



    visited = set()  # Track pages visited in this run for this site
    site_results = [r for r in results if urlparse(r['url']).netloc.endswith(domain)]

    async with aiohttp.ClientSession() as session:
        while to_visit and len(site_results) < MAX_PAGES_PER_SITE:
            batch = to_visit[:MAX_CONCURRENT_REQUESTS]
            to_visit = to_visit[MAX_CONCURRENT_REQUESTS:]

            tasks = []
            urls_for_tasks = []

            for item in batch:
                url, depth, parent = item

                if url not in visited:
                    visited.add(url)
                    tasks.append(scrape_page(session, url, depth, parent))
                    urls_for_tasks.append(url)


            if not tasks:
                continue

            pages = await asyncio.gather(*tasks)

            for i, data in enumerate(pages):
                current_url = urls_for_tasks[i]
                if data:
                    # Update existing entry if present
                    existing_idx = next(
                        (idx for idx, r in enumerate(site_results) if r['url'] == current_url),
                        None
                    )
                    if existing_idx is not None:
                        site_results[existing_idx] = data
                    else:
                        site_results.append(data)

                    if data:
                        links = await get_links(session, current_url, domain)
                        data["links"]["outgoing"] = len(links)

                        for link in links:
                            incoming_counter[link] += 1

                            if (
                                link not in visited
                                and len(site_results) + len(to_visit) < MAX_PAGES_PER_SITE
                            ):
                                to_visit.append((link, depth + 1, current_url))

                    # Save periodically
                    if len(site_results) % SAVE_INTERVAL == 0:
                        all_results = [r for r in results if not urlparse(r['url']).netloc.endswith(domain)]
                        all_results.extend(site_results)
                        with open("scraped_async.json", "w", encoding="utf-8") as f:
                            json.dump(all_results, f, indent=2, ensure_ascii=False)
                            print(f"Saved {len(site_results)} pages for {domain}.")




    # Merge site_results back into all_results
    other_results = [r for r in results if not urlparse(r['url']).netloc.endswith(domain)]
    final_results = other_results + site_results
    return final_results
    for entry in site_results:
        entry["links"]["incoming"] = incoming_counter.get(entry["url"], 0)



# --- Main entry ---
async def main(urls):
    # Load existing data
    if os.path.exists("scraped_async.json"):
        with open("scraped_async.json", "r", encoding="utf-8") as f:
            all_results = json.load(f)
    else:
        all_results = []

    print(f"Launching {len(urls)} sites concurrently.")

    # Create one task per site
    tasks = [
        scrape_site(url, existing_results=all_results)
        for url in urls
    ]

    # Run all sites at once
    site_results_lists = await asyncio.gather(*tasks)

    # Merge results (dedupe by URL)
    merged = {}
    for site_results in site_results_lists:
        for entry in site_results:
            merged[entry["url"]] = entry

    final_results = list(merged.values())

    # Final save
    with open("scraped_async.json", "w", encoding="utf-8") as f:
        json.dump(final_results, f, indent=2, ensure_ascii=False)

    print(f"Done! Scraped {len(final_results)} pages.")
def word_stats(text):
    words = clean_words(text)
    return {
        "word_count": len(words),
        "unique_words": len(set(words))
    }
def extract_entities(text):
    words = re.findall(r'\b\w+\b', text)
    capitalized = sorted(set(w for w in words if w[0].isupper() and len(w) > 2))

    years = sorted(set(int(y) for y in re.findall(r'\b(18|19|20)\d{2}\b', text)))
    numbers = sorted(set(re.findall(r'\b\d+(\.\d+)?\b', text)))

    return {
        "capitalized_terms": capitalized[:20],
        "years": years,
        "numbers": numbers[:20]
    }


if __name__ == "__main__":
    urls = [
        "https://example.com",
        "https://en.wikipedia.org/wiki/Main_Page",
        "https://minecraft.fandom.com/wiki/Minecraft_Wiki",
        "https://homestuck.com",
        "https://lkarch.org",
        "https://newnameful.com",
        "https://en.wikipedia.org/wiki/Web_scraping",
        "https://ticalc.org"
    ]
    asyncio.run(main(urls))
