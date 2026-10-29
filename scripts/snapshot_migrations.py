import subprocess, json, sys, pathlib
PS = ['/usr/lib/postgresql/16/bin/psql','-h','/var/tmp/pgt/sock','-p','54329','-U','postgres','-X','-q','-At','-F','\t','-d','snap']
repo = pathlib.Path('/home/claude/caddeden-9bkj4h')
order = [l.strip().split('/')[-1] for l in (repo/'supabase/apply_order.txt').read_text().splitlines() if l.strip().startswith('migrations/')]
Q = {
 'table': "select table_name from information_schema.tables where table_schema='public'",
 'column': "select table_name||'.'||column_name from information_schema.columns where table_schema='public'",
 'function': "select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'||chr(9)||md5(replace(p.prosrc,chr(13),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')",
 'index': "select indexname from pg_indexes where schemaname='public'",
 'trigger': "select tgname from pg_trigger where not tgisinternal",
 'policy': "select tablename||'.'||policyname from pg_policies where schemaname='public'",
}
def snap():
    out = {}
    for k, q in Q.items():
        r = subprocess.run(PS + ['-c', q], capture_output=True, text=True).stdout.strip().splitlines()
        if k == 'function': out[k] = {l.split('\t')[0]: l.split('\t')[1] for l in r if '\t' in l}
        else: out[k] = sorted(set(r))
    return out
prev = snap(); res = {}
for f in order:
    r = subprocess.run(PS[:-2] + ['-d', 'snap', '-v', 'ON_ERROR_STOP=1', '-f', str(repo/'supabase/migrations'/f)], capture_output=True, text=True, env={'PGOPTIONS': '-c client_min_messages=warning'})
    if r.returncode != 0: print('FAIL', f, r.stderr[:300]); sys.exit(1)
    cur = snap(); d = {}
    for k in ('table','column','index','trigger','policy'):
        d[k] = sorted(set(cur[k]) - set(prev[k]))
    d['function'] = {s: h for s, h in cur['function'].items() if prev['function'].get(s) != h}
    res[f] = d; prev = cur
    print('ok', f, {k: len(v) for k, v in d.items()})
json.dump({'order': order, 'delta': res}, open('/tmp/claude-0/-home-claude/f901d2a6-ec06-5efd-ba97-21d0e8d8c3a9/scratchpad/deltas.json', 'w'))
