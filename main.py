from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from moviebox_api.v3 import MovieBox, MovieAuto
import uvicorn
import os

app = FastAPI(title="Cymor Movie Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        # If run() is a standard function, we call it normally. 
        # If it's async, the await stays.
        result = engine.run(movie_query)
        
        # Handle both sync and async return types
        if asyncio.iscoroutine(result):
            movie_data, subtitle_data = await result
        else:
            movie_data, subtitle_data = result
        
        return {
            "title": movie_query,
            "stream_url": movie_data.url,
            "subtitle_url": subtitle_data.url if subtitle_data else None,
            "quality": "HD/1080p",
            "ad_free": True
        }
    except Exception as e:
        print(f"Error: {e}") # Log error to Render console
        raise HTTPException(status_code=404, detail="Movie source not found.")

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
            "download_link": movie_data.url,
            "instructions": "Pass this link to your frontend downloader component"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate link")

if __name__ == "__main__":
    # Use the port assigned by Render or default to 10000
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
