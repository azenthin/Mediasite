import requests
import time

genres = ['phonk', 'hardstyle', 'hyperpop', 'dubstyle', 'trap', 'synthwave', 'grime', 'vaporwave', 'drum and bass', 'indie rock', 'lo-fi', 'psychedelic']

print("MusicBrainz Genre Availability Check")
print("=" * 50)

for genre in genres:
    try:
        r = requests.get(f'https://musicbrainz.org/ws/2/recording/?query=tag:{genre}&fmt=json&limit=1', 
                        headers={'User-Agent': 'MediaSite/1.0'}, timeout=3)
        count = r.json().get('count', 0)
        status = '✅' if count > 0 else '❌'
        print(f"{status} {genre:20} {count:6,} recordings")
    except Exception as e:
        print(f"⚠️  {genre:20} Error: {str(e)[:20]}")
    time.sleep(0.3)  # Respect rate limits

print("=" * 50)
print("✅ = Available (can be imported)")
print("❌ = Not found (need alternative)")
