#!/usr/bin/env python3
"""Деплой edge-функции из репозитория через Supabase Management API.

    SUPABASE_ACCESS_TOKEN=... python3 scripts/deploy-function.py <slug> [--no-verify-jwt]

Берёт supabase/functions/<slug>/index.ts и все файлы из ../_shared, которые она
(рекурсивно) импортирует. Тесты (*_test.mts) не отправляются. verify_jwt по умолчанию
как у живой функции; для новой функции — true, если не указан --no-verify-jwt.
Токен нигде не печатается.
"""
import json, os, re, sys, time, uuid, urllib.request, urllib.error

REF = 'fiukyfyhotctvfdidktx'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'supabase', 'functions')
API = 'https://api.supabase.com/v1/projects/' + REF
IMPORT_RE = re.compile(r"""from\s+['"](\.{1,2}/[^'"]+)['"]""")


def request(method, path, data=None, headers=None):
    h = {'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN'], 'User-Agent': 'curl/8'}
    h.update(headers or {})
    for attempt in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(API + path, data=data, headers=h, method=method)).read()
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 500 and b'FGA' in body:  # нестабильный слой прав Supabase — повторяем
                time.sleep(3)
                continue
            sys.exit('HTTP %d: %s' % (e.code, body[:400].decode('utf8', 'replace')))
    sys.exit('Supabase не ответил после 6 попыток')


def collect(slug):
    files, queue = {}, [os.path.join(slug, 'index.ts')]
    while queue:
        rel = os.path.normpath(queue.pop())
        if rel in files:
            continue
        with open(os.path.join(ROOT, rel), encoding='utf8') as f:
            src = f.read()
        files[rel] = src
        for imp in IMPORT_RE.findall(src):
            queue.append(os.path.join(os.path.dirname(rel), imp))
    return files


def main():
    slug = sys.argv[1]
    files = collect(slug)
    live = {x['slug']: x for x in json.loads(request('GET', '/functions'))}
    verify = live[slug].get('verify_jwt', True) if slug in live else True
    if '--no-verify-jwt' in sys.argv:
        verify = False
    meta = {'entrypoint_path': slug + '/index.ts', 'name': slug, 'verify_jwt': verify}
    boundary = uuid.uuid4().hex
    parts = [('metadata', None, json.dumps(meta), 'application/json')]
    parts += [('file', rel.replace(os.sep, '/'), src, 'application/octet-stream') for rel, src in sorted(files.items())]
    body = b''
    for name, fname, content, ctype in parts:
        disp = 'form-data; name="%s"' % name + ('; filename="%s"' % fname if fname else '')
        body += ('--%s\r\nContent-Disposition: %s\r\nContent-Type: %s\r\n\r\n' % (boundary, disp, ctype)).encode() + content.encode('utf8') + b'\r\n'
    body += ('--%s--\r\n' % boundary).encode()
    out = request('POST', '/functions/deploy?slug=' + slug, body, {'Content-Type': 'multipart/form-data; boundary=' + boundary})
    info = json.loads(out)
    print(slug, 'версия', info.get('version'), 'verify_jwt', info.get('verify_jwt'), 'файлов', len(files))


main()
