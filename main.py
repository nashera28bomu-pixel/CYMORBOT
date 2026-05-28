from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn
import os

app = FastAPI(title="Cymor Movie Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://api.consumet.org"

# ── helpers ──────────────────────────────────────────────────────────────────

async def fetch(url: str, params: dict = None):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()

# ── routes ───────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "Cymor Movie Hub API is Online 🎬", "status": "Elite"}


@app.get("/trending")
async def get_trending():
    """Return trending/popular movies."""
    try:
        data = await fetch(f"{BASE_URL}/movies/flixhq/trending")
        return {"results": data.get("results", data)}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {e}")


@app.get("/search/{movie_query}")
async def search_movies(movie_query: str):
    """Search for movies/shows by title."""
    try:
        data = await fetch(f"{BASE_URL}/movies/flixhq/{movie_query}")
        return {"query": movie_query, "results": data.get("results", [])}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=404, detail=f"Not found: {e}")


@app.get("/info/{media_id:path}")
async def get_info(media_id: str):
    """Get full details for a movie/show (use the id from /search)."""
    try:
        data = await fetch(
            f"{BASE_URL}/movies/flixhq/info",
            params={"id": media_id}
        )
        return data
    except httpx.HTTPError as e:
        raise HTTPException(status_code=404, detail=f"Info not found: {e}")


@app.get("/watch")
async def watch_movie(episode_id: str, media_id: str):
    """
    Get stream sources for a movie/episode.
    - episode_id: from the episodes list in /info
    - media_id:   the top-level id from /search
    Example: /watch?episode_id=...&media_id=...
    """
    try:
        data = await fetch(
            f"{BASE_URL}/movies/flixhq/watch",
            params={"episodeId": episode_id, "mediaId": media_id}
        )
        sources = data.get("sources", [])
        subtitles = data.get("subtitles", [])

        # Pick best quality source
        best = next(
            (s for s in sources if "1080" in s.get("quality", "")),
            next((s for s in sources if "720" in s.get("quality", "")),
                 sources[0] if sources else None)
        )

        return {
            "stream_url": best.get("url") if best else None,
            "quality": best.get("quality") if best else "unknown",
            "all_sources": sources,
            "subtitles": subtitles,
            "ad_free": True
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=404, detail=f"Stream not found: {e}")


@app.get("/download")
async def download_movie(episode_id: str, media_id: str):
    """Return a direct download link (same stream URL, pass to frontend downloader)."""
    try:
        data = await fetch(
            f"{BASE_URL}/movies/flixhq/watch",
            params={"episodeId": episode_id, "mediaId": media_id}
        )
        sources = data.get("sources", [])
        best = sources[0] if sources else None

        return {
            "download_link": best.get("url") if best else None,
            "quality": best.get("quality") if best else "unknown",
            "instructions": "Pass this link to your frontend downloader component"
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate link: {e}")


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
