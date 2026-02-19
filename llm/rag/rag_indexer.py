import uuid, json
from pathlib import Path

import faiss
import torch
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

class RAGIndexer:
    def __init__(self, docs_dir, index_path, meta_path, embed_model_name):
        self.docs_dir = docs_dir
        self.index_path = index_path
        self.meta_path = meta_path
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = SentenceTransformer(embed_model_name, device=self.device)
    
    def read_md(self, path):
        return path.read_text(encoding="utf-8", errors="ignore")

    def read_pdf(self, path):
        try:
            reader = PdfReader(str(path))
            return "\n".join([p.extract_text() or "" for p in reader.pages])
        except Exception:
            return ""

    def load_docs(self):
        entries = []

        for p in Path(self.docs_dir).rglob("*"):
            if p.is_file():
                if p.suffix.lower() in {".txt", ".md"}:
                    entries.append((str(p), self.read_md(p)))
                elif p.suffix.lower() in {".pdf"}:
                    entries.append((str(p), self.read_pdf(p)))
        
        return entries

    def simple_split(self, text, max_chars, overlap):
        """
        Crear chunks de texto con longitud máxima max_chars y solapamiento overlap.
        """
        text = text.strip()
        if not text:
            return []
        chunks = []
        start = 0
        n = len(text)

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

        if not raw_docs:
            print("Error: No se encontraron documentos en docs_dir")
            # Se crean índices y meta vacíos para no romper al retriever
            dim = self.model.get_sentence_embedding_dimension()
            index = faiss.IndexFlatIP(dim)
            faiss.write_index(index, self.index_path)
            with open(self.meta_path, "w", encoding="utf-8") as f:
                pass
            return
        
        print(f"[RAG] Generando chunks...")
        docs = []
        for src, txt in raw_docs:
            chunks = self.simple_split(txt, 1200, 200)
            for i, ch in enumerate(chunks):
                docs.append({
                    "id": str(uuid.uuid4()),
                    "source": src,
                    "chunk_id": i,
                    "text": ch
                })
        
        # Nota: normalize_embeddings=True ya normaliza; si no lo usas, aplica normalize(emb)
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
