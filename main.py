from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import asyncio

# MovieBox API
from moviebox_api import MovieBox, MovieAuto

app = FastAPI(
    title="Cymor Movie Hub API",
    version="2.0.0"
)

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Initialize Engine
# =========================
moviebox = MovieBox()

# =========================
# Root Endpoint
# =========================
@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Cymor Movie Hub",
        "version": "2.0"
    }

# =========================
# Trending Movies
# =========================
@app.get("/trending")
async def trending():
    try:
        data = moviebox.homepage()

        return {
            "success": True,
            "results": data
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Trending fetch failed: {str(e)}"
        )

# =========================
# Watch Movie
# =========================
@app.get("/watch/{query}")
async def watch_movie(query: str):

    try:
        engine = MovieAuto()

        result = engine.run(query)

        # Handle async/sync safely
        if asyncio.iscoroutine(result):
            result = await result

        movie_data, subtitle_data = result

        stream_url = getattr(movie_data, "url", None)

        subtitle_url = None
        if subtitle_data:
            subtitle_url = getattr(subtitle_data, "url", None)

        if not stream_url:
            raise HTTPException(
                status_code=404,
                detail="No stream found"
            )

        return {
            "success": True,
            "title": query,
            "stream_url": stream_url,
            "subtitle_url": subtitle_url,
            "quality": "1080p",
            "provider": "MovieBox",
            "ad_free": True
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Streaming failed: {str(e)}"
        )

# =========================
# Download Movie
# =========================
@app.get("/download/{query}")
async def download_movie(query: str):

    try:
        engine = MovieAuto()

        result = engine.run(query)

        if asyncio.iscoroutine(result):
            result = await result

        movie_data, _ = result

        download_url = getattr(movie_data, "url", None)

        if not download_url:
            raise HTTPException(
                status_code=404,
                detail="Download source unavailable"
            )

        return {
            "success": True,
            "title": query,
            "download_url": download_url
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Download failed: {str(e)}"
        )

# =========================
# Health Check
# =========================
@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }

# =========================
# Run Server
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
