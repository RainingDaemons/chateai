import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const renderer = new marked.Renderer();
const origLink = renderer.link.bind(renderer);
renderer.link = (href, title, text) => {
    const html = origLink(href, title, text);
    return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
};

marked.setOptions({
    renderer,
    highlight(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    }
});

// Escapar backslash
const escapeForAttr = (p) => String(p).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Extrae citas del rag conservando orden de aparición
const retrieveDocCites = (md) => {
    const re = /\[doc:([^|\]]+)(?:\|[^\]]*)?\]/g;
    const cites = [];
    let m;
    while ((m = re.exec(md)) !== null) {
        const filename = String(m[1]).trim();
        if (!filename) continue;
        cites.push({ filename, index: m.index, len: m[0].length });
    }
    return cites;
}

// Construye enlaces HTML referenciando archivo en data-local-path
const buildAnchors = (filenames, docsBasePath) => {
    return filenames.map((filename) => {
        const fullPath =
            docsBasePath && (docsBasePath.includes('\\') || /^[A-Za-z]:\\/.test(docsBasePath))
                ? `${docsBasePath}\\${filename}` // Windows
                : `${docsBasePath}/${filename}`; // Otros

        const escaped = escapeForAttr(fullPath);
        const label = filename;

        return `<a href="#" class="rag-local-link" data-local-path="${escaped}">${label}</a>`;
    });
}

// Elimina citas duplicadas del texto
function removeDocCites(md) {
    const re = /\[doc:([^|\]]+)(?:\|[^\]]*)?\]/g;
    return md.replace(re, '');
}

// Transformar citas de RAG en enlaces locales
const makeRagCites = (md, docsBasePath) => {
    if (!md || typeof md !== 'string') return md;
    if (!docsBasePath) return md;

    // Obtener citas
    const cites = retrieveDocCites(md);
    if (cites.length === 0) return md;

    // Deduplicar por filename preservando orden
    const seen = new Set();
    const ordered = [];
    for (const c of cites) {
        if (seen.has(c.filename)) continue;
        seen.add(c.filename);
        ordered.push(c.filename);
    }

    // Construir anchors
    const anchors = buildAnchors(ordered, docsBasePath);

    // Construir bloque con listado de fuentes
    const fuentesBlock = `\n\n**Fuentes:** ${anchors.join(' · ')}`;

    // Eliminar citas inline y agregar al bloque final
    const cleaned = removeDocCites(md);
    return cleaned + fuentesBlock;
}

// Parsea y sanitiza conversión markdown a HTML
const textParser = (md, docsDirVar) => {
    const mdTransfomed = makeRagCites(md, docsDirVar);
    const html = marked.parse(mdTransfomed);

    // Permitir protocolos adicionales
    return DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel', 'data-local-path'],
    });
}

export { textParser };