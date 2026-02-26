import json, requests, hashlib, os
from pathlib import Path
from datetime import datetime

def call_api(query, API_URL, API_KEY):
  if not API_KEY:
      raise RuntimeError("Error: No se encontró la API_KEY de langsearch en el archivo .env")
  if not query:
      raise RuntimeError("Error: No se ha especificado ninguna query")

  # Armar payload y headers
  payload = {
    "query": query,
    "freshness": "onLimit",
    "summary": True,
    "count": 10
  }

  headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}",
  }

  # Hacer la petición a la API
  try:
    resp = requests.post(API_URL, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
  except requests.exceptions.RequestException as e:
    raise RuntimeError(f"Error al llamar a la API: {e}") from e

  # Parsear respuesta
  try:
    return resp.json()
  except json.JSONDecodeError:
    return resp.text

def _sanitize_text(s):
  """Normalizador de texto"""
  if s is None:
    return ""
  s = s.replace("\x00", "")
  s = s.replace("\r\n", "\n").replace("\r", "\n")
  return s

def _indent_block(s, spaces):
  """Indenta texto multinea"""
  spaces = 2
  pad = " " * spaces
  return "\n".join(pad + line for line in s.splitlines())

def _truncate_for_meta(s, limit):
  # Crea una versión breve para el frontmatter"""
  limit = 300
  s = s.strip()
  if len(s) <= limit:
      return s
  return s[:limit].rstrip() + "…"

def _hash(url):
  return hashlib.sha256(url.encode()).hexdigest()[:16]

def create_md(url, title, snippet, summary):
  title = _sanitize_text(title)
  snippet = _sanitize_text(snippet)
  summary = _sanitize_text(summary)

  # Guardamos versiones resumidas del frontmatter
  fm_title = title
  fm_snippet_short = _truncate_for_meta(snippet, 400) if snippet else ""
  fm_summary_short = _truncate_for_meta(summary, 600) if summary else ""

  # Soporte para saltos de linea
  fm_lines = [
    "---",
    "source_type: site",
    f"url: {url}",
    "title: |",
    _indent_block(fm_title, 2),
  ]
  if fm_snippet_short:
    fm_lines += [
      "snippet: |",
      _indent_block(fm_snippet_short, 2),
    ]
  if fm_summary_short:
    fm_lines += [
      "summary: |",
      _indent_block(fm_summary_short, 2),
    ]
  fm_lines += [
    f"captured_at: {datetime.now().isoformat()}Z",
    "---",
    ""
  ]
  fm = "\n".join(fm_lines)

  # Obtener summary, sino utiliza snippet
  body_text = summary.strip() if summary else snippet.strip()
  body_text = body_text if body_text else "(sin contenido disponible)"
  return fm + body_text + "\n"

def get_webpages(query, WEB_DIR, API_URL, API_KEY):
  os.makedirs(WEB_DIR, exist_ok=True)

  results = call_api(query, API_URL, API_KEY)

  # Validar estructura
  pages = (
    results.get("data", {})
      .get("webPages", {})
      .get("value", [])
    if isinstance(results, dict) else []
  )
  if not pages:
    return []

  saved = []
  for r in pages:
    url = r.get("url", "")
    title = r.get("name", "")
    snippet = r.get("snippet", "")
    summary = r.get("summary", "")

    if not url:
      continue

    name = f"web_{_hash(url)}.md"
    path = Path(WEB_DIR) / name

    if not path.exists():
      md = create_md(url, title, snippet, summary)
      path.write_text(md, encoding="utf-8")

    saved.append(str(path))

  return saved
