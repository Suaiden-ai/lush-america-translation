
const url = 'https://yslbjhnqfkjdoxuixfyh.supabase.co/functions/v1/send-translation-webhook';
const payload = {
    document_id: 'f9faa0d1-be6b-4066-a98a-4b0fcb368339',
    user_id: '5358f457-bfc5-43e0-aa23-069af8b2f731',
    filename: '5358f457-bfc5-43e0-aa23-069af8b2f731/simples_8S4B5Y.pdf',
    url: 'https://yslbjhnqfkjdoxuixfyh.supabase.co/storage/v1/object/public/documents/5358f457-bfc5-43e0-aa23-069af8b2f731/simples_8S4B5Y.pdf',
    pages: 3,
    tipo_trad: 'Certificado',
    idioma_raiz: 'Portuguese',
    idioma_destino: 'English',
    total_cost: 62.75,
    is_bank_statement: false
};

fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
})
    .then(async r => {
        const text = await r.text();
        console.log(`Status: ${r.status}`);
        console.log(`Response: ${text}`);
    })
    .catch(e => console.error(e));
