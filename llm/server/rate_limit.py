import os
import time
import sqlite3
import threading
import datetime
from collections import deque

class ApiUsageTracker:
    def __init__(self, db_path):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.lock = threading.RLock()
        self._ensure_tables()
        self.current_date, self.current_count = self._load_state()

    def _conn(self):
        # Limitar una conexión a la BD por operación
        con = sqlite3.connect(self.db_path, timeout=5, isolation_level=None)
        con.execute("PRAGMA journal_mode=WAL;")
        con.execute("PRAGMA synchronous=NORMAL;")
        return con

    def _ensure_tables(self):
        # Verificar que las tablas se hayan creado en la BD
        with self._conn() as con:
            con.execute("""
                CREATE TABLE IF NOT EXISTS LANGSEARCH (
                    date TEXT PRIMARY KEY,
                    total_requests INTEGER NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            con.execute("""
                CREATE TABLE IF NOT EXISTS LANGSEARCH_STATE (
                    id INTEGER PRIMARY KEY CHECK (id=1),
                    date TEXT NOT NULL,
                    count INTEGER NOT NULL
                )
            """)
            cur = con.execute("SELECT COUNT(*) FROM LANGSEARCH_STATE")
            if cur.fetchone()[0] == 0:
                today = datetime.date.today().isoformat()
                con.execute("INSERT INTO LANGSEARCH_STATE (id, date, count) VALUES (1, ?, 0)", (today,))

    def _load_state(self):
        with self._conn() as con:
            row = con.execute("SELECT date, count FROM LANGSEARCH_STATE WHERE id=1").fetchone()
            return (row[0], row[1])

    def check_rollover(self):
        with self.lock:
            now_date = datetime.date.today()
            now_str = now_date.isoformat()

            if self.current_date != now_str:
                # Persistir el total del día anterior a LANGSEARCH
                with self._conn() as con:
                    con.execute("""
                        INSERT INTO LANGSEARCH (date, total_requests)
                        VALUES (?, ?)
                        ON CONFLICT(date) DO UPDATE SET
                        total_requests = total_requests + excluded.total_requests
                    """, (self.current_date, self.current_count))
                    # Setear estado al dia actual
                    con.execute(
                        "UPDATE LANGSEARCH_STATE SET date=?, count=0 WHERE id=1",
                        (now_str,),
                    )

                self.current_date = now_str
                self.current_count = 0

    def increment(self):
        with self.lock:
            self.check_rollover()
            self.current_count += 1
            with self._conn() as con:
                con.execute(
                    "UPDATE LANGSEARCH_STATE SET count=? WHERE id=1", 
                    (self.current_count,)
                )

    def get_today_count(self):
        with self.lock:
            self.check_rollover()
            return self.current_count, self.current_date

    def get_history(self, limit = 30):
        with self._conn() as con:
            rows = con.execute("""
                SELECT date, total_requests
                FROM LANGSEARCH
                ORDER BY date DESC
                LIMIT ?
            """, (limit,)).fetchall()
        return [{"date": d, "total_requests": t} for (d, t) in rows]

class RateLimiter:
    def __init__(self, tracker, qps, qpm, qpd):
        self.tracker = tracker
        self.qps = max(1, int(qps))
        self.qpm = max(1, int(qpm))
        self.qpd = int(qpd) if qpd is not None else None

        self._sec_window = deque()  # timestamps últimos 1s
        self._min_window = deque()  # timestamps últimos 60s
        self._lock = threading.RLock()

    def _prune(self, now):
        sec_cutoff = now - 1.0
        while self._sec_window and self._sec_window[0] <= sec_cutoff:
            self._sec_window.popleft()

        min_cutoff = now - 60.0
        while self._min_window and self._min_window[0] <= min_cutoff:
            self._min_window.popleft()

    def check_usage(self):
        """
        Reservar un cupo a la api cuando no se hayan excedidos limites
        - Para QPS/QPM: si no hay cupo, espera hasta max_wait
        - Para QPD: si no hay cupo, lanza error inmediata
        """
        max_wait = 1
        start = time.time()
        while True:
            with self._lock:
                now = time.time()
                self._prune(now)

                sec_ok = len(self._sec_window) < self.qps
                min_ok = len(self._min_window) < self.qpm

                today_count, _ = self.tracker.get_today_count()
                day_ok = True if self.qpd is None else (today_count < self.qpd)
                
                # Reservar cupo y contar el intento
                if sec_ok and min_ok and day_ok:
                    self._sec_window.append(now)
                    self._min_window.append(now)
                    self.tracker.increment()
                    return

                if not day_ok:
                    raise RuntimeError(f"[RT] Límite diario alcanzado (QPD={self.qpd}).")

                waits = []
                if not sec_ok and self._sec_window:
                    waits.append(self._sec_window[0] + 1.0 - now)
                if not min_ok and self._min_window:
                    waits.append(self._min_window[0] + 60.0 - now)

                sleep_for = max(0.0, min(waits) if waits else 0.05)

            if (time.time() - start) + sleep_for > max_wait:
                raise RuntimeError("[RT] Rate-limit: excede tiempo máximo de espera.")
            time.sleep(sleep_for if sleep_for > 0 else 0.05)
