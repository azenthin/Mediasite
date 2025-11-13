import urllib.request
import json

# Test artist search
url = 'http://localhost:3000/api/ai/playlist'
data = json.dumps({'prompt': 'DVRST'}).encode()
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode())
        if result.get('playlist'):
            print(f"✅ Got {len(result['playlist'])} tracks for artist search 'DVRST'")
            for i, track in enumerate(result['playlist'][:5], 1):
                print(f"  {i}. {track.get('title', 'N/A')} - {track.get('artist', 'N/A')}")
        else:
            print("❌ No results")
            print(json.dumps(result, indent=2)[:200])
except Exception as e:
    print(f"Error: {e}")
