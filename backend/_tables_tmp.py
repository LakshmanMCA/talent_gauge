import sqlite3
c = sqlite3.connect('db.sqlite3')
print([r[0] for r in c.execute("select name from sqlite_master where type='table'")])
print(c.execute("select app,name from django_migrations order by id").fetchall())
