const fetchWithTimeout = async (url, timeout_secs, options = {}) => {
    const timeoutMs = timeout_secs * 1000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(id);
    }
};

const getLlmParams = () => {
    const llmName = import.meta.env.VITE_LLM_NAME;

    switch (llmName) {
        case "LIQUIDAI_LFM2":
            return {
                "temperature": 0.3,
                "min_p": 0.15,
                "repetition_penalty": 1.05
            }
        default:
            console.log(`Error: No está registrado ${llmName ?? 'null'}`);
    }
};

export { fetchWithTimeout, getLlmParams };
