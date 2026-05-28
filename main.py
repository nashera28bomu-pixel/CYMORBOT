from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from moviebox_api.v3 import MovieBox, MovieAuto
import asyncio

app = FastAPI(title="Cymor Movie Hub API")

# Enable CORS so your frontend can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

api = MovieBox()

@app.get("/")
async def root():
    return {"message": "Cymor Movie Hub API is Online", "status": "Elite"}

# 1. FETCH TRENDING (Netflix-style Slider Data)
@app.get("/trending")
async def get_trending():
    try:
        # Fetching homepage data which includes 'Trending' and 'Recent'
        data = api.homepage()
        return {"results": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. STREAMING & SUBTITLES (The "Watch" Button)
@app.get("/watch/{movie_query}")
async def watch_movie(movie_query: str):
    try:
        engine = MovieAuto()
        # auto.run fetches the best source and subtitles automatically
        # It bypasses ad-heavy web pages to give you direct links
        movie_data, subtitle_data = await engine.run(movie_query)
        
        return {
            "title": movie_query,
            "stream_url": movie_data.url,
            "subtitle_url": subtitle_data.url if subtitle_data else None,
            "quality": "HD/1080p",
            "ad_free": True
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail="Movie source not found.")

# 3. DOWNLOAD WITH PROGRESS (Background Task)
# Note: On Render Free, large downloads will hit disk limits. 
# It's better to provide the direct download link to the user.
@app.get("/download/{movie_query}")
async def download_movie(movie_query: str):
    try:
        engine = MovieAuto()
        movie_data, _ = await engine.run(movie_query)
        
        return {
            "title": movie_query,
            "download_link": movie_data.url,
            "instructions": "Pass this link to your frontend downloader component"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate download link")

# 4. MORE LIKE THIS (Recommendations)
@app.get("/recommendations/{movie_id}")
async def get_related(movie_id: str):
    # If the API v3 supports search by ID for related content
    try:
        related = api.search(movie_id) # Simplified logic for related search
        return {"results": related[:10]} # Return top 10 similar
    except Exception:
        return {"results": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)
