import aiohttp
import asyncio
from bs4 import BeautifulSoup
import json
from urllib.parse import urljoin, urlparse
from asyncio import Semaphore
from collections import Counter
import re
import os

MAX_PAGES_PER_SITE = 500
MAX_CONCURRENT_REQUESTS = 500
SAVE_INTERVAL = 20

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

async def scrape_page(session, url):
    html = await fetch(session, url)
    if not html:
        return None
    try:
        soup = BeautifulSoup(html, 'html.parser')
        title = soup.title.string.strip() if soup.title else "No Title"

        desc_tag = soup.find('meta', attrs={'name':'description'})
        if desc_tag and desc_tag.get('content'):
            description = desc_tag['content'][:300]
            desc_full = desc_tag['content']
        else:
            p = soup.find('p')
            description = (p.get_text()[:300] if p else "")
            desc_full = (p.get_text() if p else "")

        # Auto tags from title
        title_words = [w.lower() for w in (title or "").split() if len(w) >= 5]
        title_tags = title_words[:2]
        while len(title_tags) < 2:
            title_tags.append("none")
        tag1, tag2 = title_tags

        tag3, tag4 = extract_tags_from_description(desc_full)
        tag5 = ""  # manual edit

        common_word = most_common_word(desc_full)

        data = {
            "url": url,
            "title": title,
            "description": description,
            "tag1": tag1,
            "tag2": tag2,
            "tag3": tag3,
            "tag4": tag4,
            "tag5": tag5,
            "common_word": common_word
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
    soup = BeautifulSoup(html, 'html.parser')
    links = set()
    for a in soup.find_all('a', href=True):
        link = urljoin(url, a['href'])
        parsed = urlparse(link)
        # include any subdomain that ends with base_domain
        if parsed.scheme in ["http", "https"] and parsed.netloc.endswith(base_domain):
            # avoid fragments
            clean_link = parsed._replace(fragment="").geturl()
            links.add(clean_link)
    return list(links)


# --- Scrape site with resuming ---
async def scrape_site(start_url, visited_urls=None, existing_results=None):
    """
    Scrape a site starting from start_url, resuming from existing_results if provided.
    """
    domain = urlparse(start_url).netloc
    visited = visited_urls if visited_urls else set()
    results = existing_results if existing_results else []

    # Start with URLs in the existing results for this domain
    to_visit = [r['url'] for r in results if urlparse(r['url']).netloc.endswith(domain)]
    if start_url not in to_visit:
        to_visit.append(start_url)

    async with aiohttp.ClientSession() as session:
        while to_visit and len(results) < MAX_PAGES_PER_SITE:
            batch = to_visit[:MAX_CONCURRENT_REQUESTS]
            to_visit = to_visit[MAX_CONCURRENT_REQUESTS:]

            tasks = []
            urls_for_tasks = []  # Keep track of which URL corresponds to each task

            for url in batch:
                if url not in visited:
                    visited.add(url)
                    tasks.append(scrape_page(session, url))
                    urls_for_tasks.append(url)

            if not tasks:
                continue  # Nothing to fetch in this batch

            # Run tasks concurrently
            pages = await asyncio.gather(*tasks)

            for i, data in enumerate(pages):
                current_url = urls_for_tasks[i]

                if data:
                    # Update existing entry if present
                    existing_idx = next((idx for idx, r in enumerate(results) if r['url'] == current_url), None)
                    if existing_idx is not None:
                        results[existing_idx] = data
                    else:
                        results.append(data)

                    # Save periodically
                    if len(results) % SAVE_INTERVAL == 0:
                        with open("scraped_async.json", "w", encoding="utf-8") as f:
                            json.dump(results, f, indent=2, ensure_ascii=False)
                        print(f"Saved {len(results)} pages to file.")

                # Fetch links from this page regardless of whether it was just scraped
                links = await get_links(session, current_url, domain)
                for link in links:
                    if link not in visited and len(results) + len(to_visit) < MAX_PAGES_PER_SITE:
                        to_visit.append(link)

    return results

# --- Main entry ---
async def main(urls):
    # Load existing data
    if os.path.exists("scraped_async.json"):
        with open("scraped_async.json", "r", encoding="utf-8") as f:
            all_results = json.load(f)
    else:
        all_results = []

    visited_urls = set(r['url'] for r in all_results)

    for url in urls:
        print(f"Starting site: {url}")
        site_results = await scrape_site(url, visited_urls=visited_urls, existing_results=all_results)
        all_results = site_results  # update master list

    # Final save
    with open("scraped_async.json", "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"Done! Scraped {len(all_results)} pages.")

if __name__ == "__main__":
    urls = [
        "https://example.com",
        "https://en.wikipedia.org/wiki/Main_Page",
        "https://minecraft.fandom.com/wiki/Minecraft_Wiki",
        "https://ticalc.org",
        "https://homestuck.com"
    ]
    asyncio.run(main(urls))
