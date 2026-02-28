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

/*
* Utilidades
*/
// Escapar backslash
const escapeForAttr = (p) => String(p).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Extraer hostname legible desde una URL
const extractHostname = (raw) => {
    if (!raw) return '';
    try {
        const u = new URL(raw);
        return u.host || raw;
    } catch {
        // Si no trae protocolo, asumimos https
        try {
            const u2 = new URL('https://' + raw);
            return u2.host || raw;
        } catch {
            return raw;
        }
    }
};


/*
* Citas
*/
const CITE_RE = /\[(doc|site):([^|\]]+)(?:\|[^\]]*)?\]/g;

// Extrae citas del rag conservando orden de aparición
const retrieveCites = (md) => {
    const cites = [];
    if (!md || typeof md !== 'string') return cites;
    let m;
    while ((m = CITE_RE.exec(md)) !== null) {
        const type = String(m[1]).trim();
        const value = String(m[2]).trim();
        if (!type || !value) continue;
        cites.push({ type, value, index: m.index, len: m[0].length });
    }
    return cites;
}

// Construye enlaces HTML para enlaces a documentos
const buildDocAnchor = (filename, docsBasePath) => {
    const label = filename;
    if (!docsBasePath) {
        return `<span class="rag-local-label">${label}</span>`;
    }

    const fullPath =
        docsBasePath && (docsBasePath.includes('\\') || /^[A-Za-z]:\\/.test(docsBasePath))
            ? `${docsBasePath}\\${filename}` // Windows
            : `${docsBasePath}/${filename}`;  // Otros

    const escaped = escapeForAttr(fullPath);

    return `<a href="#"
            class="rag-doc-link"
            data-local-path="${escaped}">
            ${label}
            </a>`.replace(/\n\s+/g, ' ');
}

// Construye enlaces HTML para enlaces a sitios web
const buildSiteAnchor = (url) => {
    const label = extractHostname(url) || url;
    const escapedHref = escapeForAttr(url);
    return `<a href="${escapedHref}"
            class="rag-site-link"
            target="_blank"
            rel="noopener noreferrer">
            ${label}
            </a>`.replace(/\n\s+/g, ' ');
};

// Generar anchors según tipo de cita
const buildAnchorsMixed = (uniqueCites, docsBasePath) => {
    return uniqueCites.map(c => {
        if (c.type === 'doc') return buildDocAnchor(c.value, docsBasePath);
        if (c.type === 'site') return buildSiteAnchor(c.value);
        return '';
    });
};

// Elimina citas duplicadas del texto
function removeInlineCites(md) {
    return md.replace(CITE_RE, '');
}

// Normalizar espacios y puntuación
function normPunctuation(text) {
    if (!text) return text;

    return text
        // Quitar espacios antes de signos de puntuación fuerte
        .replace(/\s+([.,;:!?])/g, '$1')
        // Quitar espacios antes de cierres de paréntesis/corchetes/llaves
        .replace(/\s+([\)\]\}])/g, '$1')
        // Quitar espacios justo después de aperturas
        .replace(/([(\[\{])\s+/g, '$1')
        // Colapsar espacios múltiples
        .replace(/[ \t]{2,}/g, ' ')
        // Quitar espacios al inicio/fin de líneas
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .trim();
}

// Transformar citas del ragh en bloque de referencias
const makeRagCites = (md, docsBasePath) => {
    if (!md || typeof md !== 'string') return md;
    if (!docsBasePath) return md;

    // Obtener citas
    const cites = retrieveCites(md);
    if (cites.length === 0) return md;

    // Deduplicar por filename preservando orden
    const seen = new Set();
    const ordered = [];
    for (const c of cites) {
        const key = `${c.type}:${c.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ordered.push({ type: c.type, value: c.value });
    }

    // Construir anchors
    const anchors = buildAnchorsMixed(ordered, docsBasePath).filter(Boolean);
    if (anchors.length === 0){
        return normPunctuation(removeInlineCites(md));
    };

    // Limpiar citas y añadir bloque de referencias
    const cleaned = normPunctuation(removeInlineCites(md));
    const fuentesBlock = `\n\n**Fuentes:** ${anchors.join(' - ')}`;
    return cleaned + fuentesBlock;
}

/*
* Parser
*/
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