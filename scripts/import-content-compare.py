"""Загрузка «Сравнения контента» в базу из разобранной таблицы владельца.

Запуск: python3 scripts/import-content-compare.py путь/к/compare_data.json
Файл: {"period": {"from", "to"}, "labels": [...], "items": [{"nm", "name", "rev", "similar", "top", "seo"}]}.
Кабинет каждого артикула берётся из rnp_articles. Нужен SUPABASE_ACCESS_TOKEN (Management API), проект в SUPABASE_PROJECT_REF.
Повторный запуск обновляет строки, а не дублирует их.
"""
import json
import os
import sys
import urllib.request

REF = os.environ.get('SUPABASE_PROJECT_REF', 'fiukyfyhotctvfdidktx')
TOKEN = os.environ['SUPABASE_ACCESS_TOKEN']


def q(sql):
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps({'query': sql}).encode(),
        headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'nr-import'},
    )
    return json.load(urllib.request.urlopen(req, timeout=120))


def main(path):
    d = json.load(open(path, encoding='utf-8'))
    nms = [int(b['nm']) for b in d['items']]
    cab = {int(r['nm_id']): r['cabinet_id'] for r in q(
        'select nm_id, cabinet_id::text from rnp_articles where nm_id in (%s)' % ','.join(map(str, nms)))}
    ok, skipped = 0, []
    for b in d['items']:
        c = cab.get(int(b['nm']))
        if not c:
            skipped.append(b['nm'])
            continue
        b = dict(b, labels=d.get('labels', []))
        js = json.dumps(b, ensure_ascii=False).replace("'", "''")
        q("insert into content_compare (cabinet_id, nm_id, period_from, period_to, data) "
          f"values ('{c}', {int(b['nm'])}, '{d['period']['from']}', '{d['period']['to']}', '{js}'::jsonb) "
          "on conflict (cabinet_id, nm_id) do update set data = excluded.data, period_from = excluded.period_from, "
          "period_to = excluded.period_to, updated_at = now()")
        ok += 1
    print('загружено:', ok, '| артикулы без кабинета:', skipped)


if __name__ == '__main__':
    main(sys.argv[1])
