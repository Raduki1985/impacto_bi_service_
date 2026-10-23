"""Consulta somente leitura ao SGI de homologacao (sgi-dev). Mesma credencial
bi_web do arquivo de producao, host e banco de homologacao. Nunca imprime a
credencial."""
import sys
from urllib.parse import quote_plus
from sqlalchemy import create_engine, text

def engine():
    env = {}
    for line in open(r"C:\Users\Impacto Telecom\Documents\.impacto-sgi-prod.env", encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    url = "postgresql+psycopg2://{}:{}@{}:{}/{}".format(
        "bi_web", quote_plus(env["SGI_PROD_PASSWORD"]), "138.99.160.37", "5433", "impacto-sgi-dev")
    return create_engine(url, connect_args={"options": "-c default_transaction_read_only=on -c statement_timeout=60000", "connect_timeout": 10})

def run(sql, params=None, limit=200):
    with engine().connect() as c:
        res = c.execute(text(sql), params or {})
        cols = list(res.keys())
        print(" | ".join(cols))
        for i, row in enumerate(res):
            if i >= limit:
                print("..."); break
            print(" | ".join("" if v is None else str(v) for v in row))

if __name__ == "__main__":
    run(sys.stdin.read())
