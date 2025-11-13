import requests
import time

print("Testing MusicBrainz API...")
time.sleep(2)

session = requests.Session()
session.headers.update({
    'User-Agent': 'TestAgent/1.0'
})

try:
    response = session.get(
        'https://musicbrainz.org/ws/2/recording/',
        params={
            'query': 'tag:IDM',
            'fmt': 'json',
            'limit': 5,
            'offset': 0
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    if response.status_code == 200:
        data = response.json()
        print(f"Songs: {len(data.get('recordings', []))}")
        print(f"First song: {data.get('recordings', [{}])[0].get('title', 'N/A')}")
    else:
        print(f"Error: {response.text[:200]}")
except Exception as e:
    print(f"Exception: {e}")
