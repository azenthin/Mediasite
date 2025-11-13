import sqlite3

conn = sqlite3.connect('enhanced_music.db')
c = conn.cursor()

c.execute('SELECT title, artist, release_year FROM songs WHERE genres LIKE "%phonk%" LIMIT 10')
rows = c.fetchall()

print('Phonk tracks with release years:')
for title, artist, year in rows:
    print(f'  {title[:40]:40} - {artist[:20]:20} | Year: {year}')

conn.close()
