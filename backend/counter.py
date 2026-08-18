#!/usr/bin/env python3
import json
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = '127.0.0.1'
PORT = int(os.environ.get('PORT', '9700'))
DATABASE = os.environ.get('COUNTER_DB', '/mnt/dados/appsbox-conv-documentos/contador.sqlite')
os.makedirs(os.path.dirname(DATABASE), mode=0o750, exist_ok=True)
with sqlite3.connect(DATABASE) as connection:
    connection.execute('PRAGMA journal_mode=WAL')
    connection.execute('CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), total INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    connection.execute('INSERT OR IGNORE INTO counter (id, total) VALUES (1, 0)')

def total(increment=False):
    with sqlite3.connect(DATABASE, timeout=5) as connection:
        connection.execute('PRAGMA busy_timeout=5000')
        if increment:
            connection.execute("UPDATE counter SET total = total + 1, updated_at = datetime('now') WHERE id = 1")
        return int(connection.execute('SELECT total FROM counter WHERE id = 1').fetchone()[0])

class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        if self.path == '/health': self.send_json(200, {'status': 'ok'})
        elif self.path == '/api/count': self.send_json(200, {'total': total()})
        else: self.send_json(404, {'error': 'not_found'})
    def do_POST(self):
        if self.path != '/api/count': self.send_json(404, {'error': 'not_found'}); return
        length = int(self.headers.get('Content-Length', '0'))
        if length > 32: self.send_json(413, {'error': 'payload_too_large'}); return
        body = self.rfile.read(length)
        if body != b'{}': self.send_json(400, {'error': 'invalid_payload'}); return
        self.send_json(200, {'total': total(True)})
    def log_message(self, *_): pass

ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
