from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# Correct import structure for moviebox-api v0.5.3
import moviebox_api
from moviebox_api import MovieBox, MovieAuto 
import uvicorn
import os
import asyncio

app = FastAPI(title="Cymor Movie Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize API
api = MovieBox()

@app.get("/")
async def root():
    return {"message": "Cymor Movie Hub API is Online", "status": "Elite"}

@app.get("/trending")
async def get_trending():
    try:
        data = api.homepage()
        return {"results": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/watch/{movie_query}")
async def watch_movie(movie_query: str):
    try:
        engine = MovieAuto()
        result = engine.run(movie_query)
        
        if asyncio.iscoroutine(result):
            movie_data, subtitle_data = await result
        else:
            movie_data, subtitle_data = result
        
        return {
            "title": movie_query,
            "stream_url": getattr(movie_data, 'url', None),
            "subtitle_url": getattr(subtitle_data, 'url', None) if subtitle_data else None,
            "quality": "HD/1080p",
            "ad_free": True
        }
    except Exception as e:
        print(f"Error: {e}") 
        raise HTTPException(status_code=404, detail=f"Movie source not found: {str(e)}")

@app.get("/download/{movie_query}")
async def download_movie(movie_query: str):
    try:
        engine = MovieAuto()
        result = engine.run(movie_query)
        
        if asyncio.iscoroutine(result):
            movie_data, _ = await result
        else:
            movie_data, _ = result
            
        return {
            "title": movie_query,
            "download_link": getattr(movie_data, 'url', None),
            "instructions": "Pass this link to your frontend downloader component"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate link")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
