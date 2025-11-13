import sqlite3
import json

conn = sqlite3.connect('enhanced_music.db')
cursor = conn.cursor()

# Get all songs and check their genres
cursor.execute("SELECT COUNT(*) FROM songs WHERE genres LIKE '%phonk%'")
result = cursor.fetchone()[0]
print(f'Songs with phonk in genres: {result}')

# Get some samples
cursor.execute("SELECT title, artist, genres FROM songs WHERE genres LIKE '%phonk%' LIMIT 5")
samples = cursor.fetchall()
print(f'\nSample phonk songs:')
for title, artist, genres_json in samples:
    genres = json.loads(genres_json) if genres_json else []
    print(f'  • {title} - {artist}: {genres}')

conn.close()
