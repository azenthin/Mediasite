import pathlib
TARGET = 'QH'
for path in sorted(pathlib.Path('.').glob('**/*.js')):
    if 'node_modules' in path.parts:
        continue
    if path.stat().st_size > 5_000_000:
        continue
    data = None
    for encoding in ('utf-8', 'utf-16', 'latin-1'):
        try:
            data = path.read_text(encoding=encoding)
            break
        except UnicodeDecodeError:
            continue
    if data is None:
        continue
    if TARGET in data:
        print(path)
