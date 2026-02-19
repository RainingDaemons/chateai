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

        with open(meta_path, "r", encoding="utf-8") as f:
            for line in f:
                self.metas.append(json.loads(line))
    
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
            hits.append({
                "score": float(score),
                "source": m["source"],
                "chunk_id": m["chunk_id"],
                "text": m["text"]
            })
        
        return hits

def build_context(docs):
    """
    Construye un contexto compacto y citable
    """
    parts = []

    for d in docs:
        header = f"[doc:{os.path.basename(d['source'])}|chunk:{d['chunk_id']}|score:{d['score']:.3f}]"
        parts.append(f"{header}\n{d['text'].strip()}")
    
    return "\n\n---\n\n".join(parts)