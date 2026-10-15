#!/usr/bin/env python3
"""Переход на новые legacy-ключи Supabase после смены JWT-секрета (старый service_role ключ утёк в публичную историю git).

Порядок:
  1. В Supabase Dashboard → Project Settings → JWT Keys (или API) смени JWT-секрет. Старые anon и service_role ключи перестанут работать.
  2. Сразу запусти:   SUPABASE_ACCESS_TOKEN=... python3 scripts/rotate-supabase-keys.py --apply
     Без --apply скрипт только показывает, что заменил бы (ничего не пишет).
  3. Скрипт ничего не печатает из значений ключей. Что он делает:
     - берёт новые anon/service_role ключи из Management API;
     - заменяет старый service_role JWT в командах всех pg_cron-задач (cron.alter_job);
     - обновляет секрет Vault `service_role_key` и секрет функций SERVICE_ROLE_KEY;
     - заменяет старый anon JWT в файлах сайта (dashboard.html, login.html, reset-password.html, wb-api.js) — дальше обычный PR и деплой сайта.
  4. Проверка: python3 scripts/rotate-supabase-keys.py --check  (старый ключ должен отвечать 401, новый 200).
"""
import base64, json, os, re, subprocess, sys, urllib.request

REF = 'fiukyfyhotctvfdidktx'
API = f'https://api.supabase.com/v1/projects/{REF}'
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '')
JWT_RX = re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')
SITE_FILES = ['dashboard.html', 'login.html', 'reset-password.html', 'wb-api.js']


def call(path, body=None, method=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, method=method or ('POST' if body is not None else 'GET'),
                                 headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'curl/8'})
    return json.loads(urllib.request.urlopen(req).read() or 'null')


def sql(q):
    return call('/database/query', {'query': q})


def role_of(tok):
    p = tok.split('.')[1]
    p += '=' * (-len(p) % 4)
    return json.loads(base64.urlsafe_b64decode(p)).get('role')


def new_keys():
    ks = call('/api-keys?reveal=true')
    out = {k['name']: k['api_key'] for k in ks if k.get('type') == 'legacy'}
    if 'anon' not in out or 'service_role' not in out:
        sys.exit('legacy-ключи не найдены')
    return out['anon'], out['service_role']


def status(token, kind):
    url = f'https://{REF}.supabase.co/auth/v1/admin/users?per_page=1' if kind == 'service_role' else f'https://{REF}.supabase.co/rest/v1/'
    req = urllib.request.Request(url, headers={'apikey': token, 'Authorization': 'Bearer ' + token})
    try:
        return urllib.request.urlopen(req, timeout=15).status
    except urllib.error.HTTPError as e:
        return e.code


def main():
    if not TOKEN:
        sys.exit('нужен SUPABASE_ACCESS_TOKEN')
    apply = '--apply' in sys.argv
    anon, service = new_keys()

    if '--check' in sys.argv:
        old = set()
        for r in sql("select command from cron.job where command ~ 'eyJ'"):
            old |= set(JWT_RX.findall(r['command']))
        print('новый service_role →', status(service, 'service_role'), '| новый anon →', status(anon, 'anon'))
        print('ключей в cron-задачах, которые ещё не новые:', len([t for t in old if t != service]))
        return

    jobs = sql("select jobid, jobname, command from cron.job where command ~ 'eyJ' order by jobid")
    todo = []
    for j in jobs:
        toks = [t for t in set(JWT_RX.findall(j['command'])) if role_of(t) == 'service_role' and t != service]
        if toks:
            cmd = j['command']
            for t in toks:
                cmd = cmd.replace(t, service)
            todo.append((j['jobid'], j['jobname'], cmd))
    print(f'cron-задач к замене ключа: {len(todo)} из {len(jobs)}')

    files = []
    for f in SITE_FILES:
        if os.path.exists(f):
            txt = open(f, encoding='utf-8').read()
            olds = [t for t in set(JWT_RX.findall(txt)) if role_of(t) == 'anon' and t != anon]
            if olds:
                files.append((f, txt, olds))
    print('файлов сайта к замене anon-ключа:', [f for f, _, _ in files])

    if not apply:
        print('это пробный запуск, ничего не записано (добавь --apply)')
        return

    for jobid, name, cmd in todo:
        sql("select cron.alter_job(%d, command := $cmd$%s$cmd$)" % (jobid, cmd))
    sql("select vault.update_secret(id, $k$%s$k$) from vault.secrets where name = 'service_role_key'" % service)
    call('/secrets', [{'name': 'SERVICE_ROLE_KEY', 'value': service}])
    for f, txt, olds in files:
        for t in olds:
            txt = txt.replace(t, anon)
        open(f, 'w', encoding='utf-8').write(txt)
    print('готово: cron, Vault, секрет функций и файлы сайта обновлены. Дальше: PR и деплой сайта, затем --check')


if __name__ == '__main__':
    main()
