"""Nominatim (OpenStreetMap) geocoding — address -> (lat, lon).

Called at event creation to populate events.latitude / events.longitude
(which in turn generate events.geo). Nominatim requires a descriptive
User-Agent and asks that you cache results / stay under 1 req/sec.
"""
import httpx

from app.config import settings

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


async def geocode(address: str) -> tuple[float, float] | None:
    """Return (latitude, longitude) for an address, or None if not found."""
    params = {"q": address, "format": "json", "limit": 1}
    headers = {"User-Agent": settings.nominatim_user_agent}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(NOMINATIM_URL, params=params, headers=headers)
        resp.raise_for_status()
        results = resp.json()
    if not results:
        return None
    first = results[0]
    return float(first["lat"]), float(first["lon"])
