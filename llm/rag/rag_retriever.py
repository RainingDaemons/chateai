import os, json

import faiss
import torch
from sentence_transformers import SentenceTransformer

class RAGRetriever:
    def __init__(self, index_path, meta_path, embed_model_name):
        # Guardar rutas y configuraciones
        self.index_path = index_path
        self.meta_path = meta_path
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Cargar modelo de embedding
        self.model = SentenceTransformer(embed_model_name, device=self.device)
        self.embed_dim = self.model.get_sentence_embedding_dimension()

        # Validaciones
        self._ensure_files()
        self.index = faiss.read_index(index_path)
        self.metas = self._load_meta_lines(meta_path)
    
    def _ensure_files(self):
        """
        Crea archivos vacíos válidos si no existen.
        """
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        os.makedirs(os.path.dirname(self.meta_path), exist_ok=True)

        need_index = not os.path.exists(self.index_path)
        need_meta = not os.path.exists(self.meta_path)

        if need_index or need_meta:
            self._write_empty_index_and_meta()
        else:
            # Validar indice faiss
            try:
                idx = faiss.read_index(self.index_path)
            except Exception:
                # Si el archivo está corrupto, lo recreamos vacío
                self._write_empty_index_and_meta()

            # Validar metadata jsonl
            try:
                _ = self._load_meta_lines(self.meta_path)
            except Exception:
                with open(self.meta_path, "w", encoding="utf-8") as f:
                    pass
    
    def _write_empty_index_and_meta(self):
        """
        Crea un índice faiss y un meta vacío.
        """
        index = faiss.IndexFlatIP(self.embed_dim)
        faiss.write_index(index, self.index_path)
        with open(self.meta_path, "w", encoding="utf-8") as f:
            pass
    
    @staticmethod
    def _load_meta_lines(path):
        metas = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                metas.append(json.loads(line))
        return metas

    def retrieve(self, query, top_k):
        # Si indice vacío, no devolver nada
        if self.index.ntotal == 0 or len(self.metas) == 0:
            return []

        # Embedding normalizado para usar IP como coseno
        q = self.model.encode([query], normalize_embeddings=True)
        q = q.astype("float32")
        D, I = self.index.search(q, top_k)
        hits = []

        for score, idx in zip(D[0], I[0]):
            if idx == -1:
                continue

            m = self.metas[idx]
            hit = {
                "score": float(score),
                "source": m.get("source"),
                "chunk_id": m.get("chunk_id"),
                "text": m.get("text", "")
            }

            # Mantener campos para contexto enriquecido
            for k in ("source_type", "doc_name", "url", "site_domain", "captured_at", "title", "snippet", "summary"):
                if k in m:
                    hit[k] = m[k]

            # Validaciones
            if "source_type" not in hit:
                hit["source_type"] = "site" if (("url" in hit) or ("site_domain" in hit)) else "doc"
            if hit["source_type"] == "doc" and "doc_name" not in hit:
                hit["doc_name"] = os.path.basename(hit["source"] or "desconocido")

            hits.append(hit)

        return hits

def build_context(docs):
    """
    Construye un contexto compacto y citable para documentos y sitios web.
    
    Formatos de cita:
    - DOCS: [doc:{name}|chunk:{id}|score:{s}]
    - WEB : [site:{url}|chunk:{id}|score:{s}]
    """
    docs_parts, web_parts = [], []

    for i, d in enumerate(docs):
        txt = (d.get("text") or "").strip()
        if not txt:
            continue

        # Score y chunk id
        try:
            score = float(d.get("score", 0.0))
        except Exception:
            score = 0.0
        score_str = f"{score:.3f}"
        chunk_id = d.get("chunk_id", i)

        # Detectar tipo de fuente (site/doc)
        source_type = d.get("source_type")
        if not source_type:
            source_type = "site" if d.get("url") else "doc"

        # Preferimos la URL guardada
        if source_type == "site":
            url = d.get("url") or d.get("source") or "desconocido"
            header_tag = f"[site:{url}|chunk:{chunk_id}|score:{score_str}]"
            web_parts.append(f"{header_tag}\n{txt}")
        # DOC local
        else:
            doc_name = d.get("doc_name")
            if not doc_name:
                doc_name = os.path.basename(d.get("source", "desconocido"))
            header_tag = f"[doc:{doc_name}|chunk:{chunk_id}|score:{score_str}]"
            docs_parts.append(f"{header_tag}\n{txt}")

    sections = []
    if docs_parts:
        sections.append("#### CONTEXTO: DOCS\n" + "\n\n".join(docs_parts))
    if web_parts:
        sections.append("#### CONTEXTO: WEB\n" + "\n\n".join(web_parts))

    return "\n\n---\n\n".join(sections) if sections else ""
