"""Rewrite a D1 export so it can be loaded with `wrangler d1 execute --file`.
D1 runs the file statement by statement, so the export's `PRAGMA defer_foreign_keys` does not help and the self-reference
coffees.canonical_coffee_id fails when a coffee points at a later row. Coffees are written with the link empty and the links are
set by UPDATEs at the end. Usage: python3 -I scripts/d1-import-order.py <export.sql> <import.sql>"""
import sqlite3
import sys

src, out = sys.argv[1], sys.argv[2]
mem = sqlite3.connect(':memory:')

stmts, buf = [], ''
with open(src, encoding='utf-8') as f:
    for line in f:
        buf += line
        if sqlite3.complete_statement(buf):
            stmts.append(buf)
            buf = ''
assert not buf.strip(), 'trailing incomplete statement'

create = next(s for s in stmts if s.lstrip().startswith('CREATE TABLE coffees'))
mem.execute(create)
is_insert = lambda s: s.lstrip().startswith('INSERT INTO "coffees"')
inserts = [s for s in stmts if is_insert(s)]
for s in inserts:
    mem.execute(s)
cols = [r[1] for r in mem.execute('PRAGMA table_info(coffees)')]
assert 'canonical_coffee_id' in cols
col_list = ','.join(f'"{c}"' for c in cols)
values = " || ',' || ".join("'NULL'" if c == 'canonical_coffee_id' else f'quote("{c}")' for c in cols)
rows = [r[0] for r in mem.execute(f"SELECT 'INSERT INTO \"coffees\" ({col_list}) VALUES(' || {values} || ');' FROM coffees ORDER BY rowid")]
updates = [r[0] for r in mem.execute(
    "SELECT 'UPDATE \"coffees\" SET \"canonical_coffee_id\"=' || quote(canonical_coffee_id) || ' WHERE \"id\"=' || quote(id) || ';' "
    "FROM coffees WHERE canonical_coffee_id IS NOT NULL ORDER BY rowid")]
assert len(rows) == len(inserts)

with open(out, 'w', encoding='utf-8') as f:
    emitted = False
    for s in stmts:
        if is_insert(s):
            if not emitted:
                f.write('\n'.join(rows) + '\n')
                emitted = True
            continue
        f.write(s if s.endswith('\n') else s + '\n')
    f.write('\n'.join(updates) + '\n')
print(f'coffees rows: {len(rows)}, canonical links deferred: {len(updates)}, statements in: {len(stmts)}')
