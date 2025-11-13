import urllib.request
import json

url = 'http://localhost:3000/api/ai/playlist'
data = json.dumps({'prompt': 'phonk music'}).encode()
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode())
        print(json.dumps(result, indent=2))
        if result.get('playlist'):
            print(f"\n✅ Got {len(result['playlist'])} tracks")
            print(f"Source: {result.get('playlist', [{}])[0].get('source', 'unknown')}")
except Exception as e:
    print(f"Error: {e}")
