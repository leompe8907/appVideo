import http.server, sys, datetime
OUT = sys.argv[1]
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode('utf-8', 'replace')
        with open(OUT, 'a') as f:
            f.write(datetime.datetime.now().strftime('%H:%M:%S ') + body + '\n')
        self.send_response(204); self.end_headers()
    def log_message(self, *a): pass
http.server.HTTPServer(('127.0.0.1', 8765), H).serve_forever()
