import uuid, json, os
from pathlib import Path

import yaml
import faiss
import torch
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

class RAGIndexer:
    def __init__(self, docs_dirs, index_path, meta_path, embed_model_name):
        if isinstance(docs_dirs, str):
            self.docs_dirs = [docs_dirs]
        else:
            self.docs_dirs = list(docs_dirs)

        self.index_path = index_path
        self.meta_path = meta_path
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = SentenceTransformer(embed_model_name, device=self.device)
    
    """
    Lectores de archivos
    """
    def read_md(self, path):
        raw = path.read_text(encoding="utf-8", errors="ignore")
        text, meta = self._split_md_and_meta(raw)

        # Validaciones
        if "source_type" not in meta:
            meta["source_type"] = "site" if ("url" in meta) else "doc"
        if meta.get("source_type") == "doc" and "doc_name" not in meta:
            meta["doc_name"] = os.path.basename(str(path))
        if meta.get("source_type") == "site" and "doc_name" not in meta:
            meta["doc_name"] = meta.get("title") or os.path.basename(str(path))

        return text, meta

    def read_pdf(self, path):
        try:
            reader = PdfReader(str(path))
            text = "\n".join([p.extract_text() or "" for p in reader.pages])
        except Exception:
            text = ""

        meta = {
            "source_type": "doc",
            "doc_name": os.path.basename(str(path))
        }

        return text, meta
    
    """
    Manipulación markdown
    """
    def _parse_yaml(self, s):
        if yaml:
            try:
                return yaml.safe_load(s) or {}
            except Exception:
                pass

        # Alt: si falla yaml
        meta = {}
        for line in s.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or ":" not in line:
                continue
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip('"')

        return meta

    def _split_md_and_meta(self, raw):
        raw = raw.lstrip()
        if not raw.startswith("---"):
            return raw, {}
        
        try:
            # Buscar final del front matter
            end = raw.find("\n---", 3)
            if end == -1:
                return raw, {}
            fm_block = raw[3:end].strip()
            body = raw[end+4:].lstrip("\n")
            meta = self._parse_yaml(fm_block)
            return body, (meta or {})
        except Exception:
            return raw, {}

    """
    Carga de documentos
    """
    def load_docs(self):
        """
        Recorre todas las carpetas del directorio y carga los archivos.
        """
        entries = []

        for d in self.docs_dirs:
            for p in Path(d).rglob("*"):
                if not p.is_file():
                    continue

                suf = p.suffix.lower()
                try:
                    if suf in {".txt"}:
                        text = p.read_text(encoding="utf-8", errors="ignore")
                        meta = {"source_type": "doc", "doc_name": os.path.basename(str(p))}
                        entries.append((str(p), text, meta))
                    elif suf in {".md"}:
                        text, meta = self.read_md(p)
                        entries.append((str(p), text, meta))
                    elif suf in {".pdf"}:
                        text, meta = self.read_pdf(p)
                        entries.append((str(p), text, meta))
                except Exception:
                    continue

        return entries

    def simple_split(self, text, max_chars, overlap):
        """
        Crear chunks de texto con longitud máxima max_chars y solapamiento overlap.
        """
        text = text.strip()
        if not text:
            return []
        
        chunks, start, n = [], 0, len(text)
        while start < n:
            end = min(start + max_chars, n)
            chunk = text[start:end]
            chunks.append(chunk)
            if end == n:
                break
            start = max(0, end - overlap)
        
        return chunks

    def main(self):
        print(f"[RAG] Cargando documentos...")
        raw_docs = self.load_docs()

        # Se crean índices y meta vacíos para no romper al retriever
        if not raw_docs:
            print("[RAG] Error: No se encontraron documentos")
            dim = self.model.get_sentence_embedding_dimension()
            index = faiss.IndexFlatIP(dim)
            faiss.write_index(index, self.index_path)
            with open(self.meta_path, "w", encoding="utf-8") as f:
                pass
            return
        
        print(f"[RAG] Generando chunks...")
        docs = []
        for src, txt, meta in raw_docs:
            chunks = self.simple_split(txt, 1200, 200)
            doc_name = meta.get("doc_name") or os.path.basename(src)
            source_type = meta.get("source_type", "doc")
            url = meta.get("url")

            for i, ch in enumerate(chunks):
                item = {
                    "id": str(uuid.uuid4()),
                    "source": src,
                    "chunk_id": i,
                    "text": ch,
                    "source_type": source_type,
                    "doc_name": doc_name
                }

                if url:
                    item["url"] = url
                
                # Campos opcionales si existen en .md
                for k in ("captured_at", "site_domain", "title", "snippet", "summary"):
                    if k in meta:
                        item[k] = meta[k]

                docs.append(item)

        # Normalizaer text embeddings
        texts = [d["text"] for d in docs]
        print(f"[RAG] Embedding {len(texts)} chunks ...")
        emb = self.model.encode(
            texts,
            batch_size=64,
            show_progress_bar=True,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        dim = emb.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(emb)

        print(f"[RAG] Guardando índices y metadatos...")
        faiss.write_index(index, self.index_path)

        with open(self.meta_path, "w", encoding="utf-8") as f:
            for d in docs:
                f.write(json.dumps(d, ensure_ascii=False) + "\n")

        print("\nIndexado completo.")
