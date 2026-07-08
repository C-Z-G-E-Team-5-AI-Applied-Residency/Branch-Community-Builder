"""One-time loader for neighborhood polygons (Zillow Neighborhood Boundaries, CC BY-SA).

Downloads per-state shapefiles, then imports Name/City + geometry into the
neighborhoods table. This is NOT called at runtime.

Two common approaches:

1. shp2pgsql (simplest, no Python deps):
     shp2pgsql -s 4326 -g boundary ZillowNeighborhoods-CA.shp tmp_neighborhoods \\
       | psql "$DATABASE_URL"
   ...then INSERT INTO neighborhoods (name, city, boundary)
      SELECT "Name", "City", boundary FROM tmp_neighborhoods;

2. GeoPandas (shown below) if you prefer pure Python.

Attribution ("provided by Zillow") must be preserved per the license.
"""
import geopandas as gpd  # pip install geopandas  (not in base requirements)
from sqlalchemy import text

from app.database import engine


def load(shapefile_path: str) -> None:
    gdf = gpd.read_file(shapefile_path).to_crs(epsg=4326)
    columns = {col.lower(): col for col in gdf.columns}
    name_col, city_col = columns["name"], columns["city"]
    with engine.begin() as conn:
        for _, row in gdf.iterrows():
            conn.execute(
                text(
                    "INSERT INTO neighborhoods (name, city, boundary) "
                    "VALUES (:name, :city, ST_Multi(ST_CollectionExtract("
                    "ST_MakeValid(ST_GeomFromText(:wkt, 4326)), 3)))"
                ),
                {"name": row[name_col], "city": row[city_col], "wkt": row.geometry.wkt},
            )


if __name__ == "__main__":
    import sys

    load(sys.argv[1])
