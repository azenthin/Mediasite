import sqlite3
import json

conn = sqlite3.connect('enhanced_music.db')
c = conn.cursor()

c.execute("SELECT title, artist, genres, bpm FROM songs WHERE genres LIKE '%phonk%' ORDER BY bpm LIMIT 8")
phonk = c.fetchall()

print('ACTUAL PHONK SONGS IN DATABASE:')
print('=' * 70)
for title, artist, genres_json, bpm in phonk:
    genres = json.loads(genres_json) if genres_json else []
    print(f'• {title}')
    print(f'  Artist: {artist}')
    print(f'  Genres: {genres}')
    print(f'  BPM: {bpm}')
    print()

conn.close()
