// =================================================================
// ARCHIVO: svgmejora.js
// CONTIENE:
// 1. Funciones para crear PROMPTS de MEJORA
// 2. Flujos de MEJORA de SVG (mejorarImagenDesdeSVG)
// =================================================================

import { callGenerativeApi, svgToPngDataURL } from './svgeditar.js';

/**
 * Llama a la IA para mejorar un SVG existente.
 * @param {string} svgExistente - El código SVG actual.
 * @param {string} userPrompt - La instrucción de mejora.
 * @param {string} [modelo] - El modelo de IA a usar.
 * @returns {Promise<{imagen: string, svgContent: string}>}
 */
export async function mejorarImagenDesdeSVG(svgExistente, userPrompt, modelo = 'gemini-2.5-flash-preview-09-2025') {
    if (!svgExistente) {
        throw new Error("No se proporcionó un SVG existente para mejorar.");
    }
    console.log(`[Generador Externo SVG] Iniciando mejora para: "${userPrompt}" usando el modelo: ${modelo}`);

    const prompt = createImprovementPrompt(svgExistente, userPrompt);
    
    const svgMejorado = await callGenerativeApi(prompt, modelo, false);

    if (!svgMejorado) {
        throw new Error("La IA no devolvió un SVG mejorado.");
    }

    const pngDataUrl = await svgToPngDataURL(svgMejorado);

    return { imagen: pngDataUrl, svgContent: svgMejorado };
}

/**
 * Crea el prompt para mejorar un SVG.
 * @param {string} svgContent - El SVG actual.
 * @param {string} userPrompt - La instrucción de mejora.
 * @returns {string} El prompt para la IA.
 */
function createImprovementPrompt(svgContent, userPrompt) {
    return `
        Eres un diseñador gráfico experto en la mejora y refinamiento de arte vectorial. Tu tarea es tomar un SVG existente y mejorarlo basándote en una descripción.

        SVG ACTUAL:
        \`\`\`svg
        ${svgContent}
        \`\`\`

        INSTRUCCIONES DE MEJORA: "${userPrompt}"

        TAREAS A REALIZAR:
        1.  Analiza el SVG actual y la instrucción de mejora.
        2.  NO cambies el concepto fundamental del SVG, a menos que las instrucciones de mejora lo requieran. Tu objetivo es refinarlo, no reemplazarlo.
        2.5 Si es necesario, ajusta el tamaño del SVG para que se ajuste al viewBox="0 0 512 512" y mantén un fondo transparente.
        2.6 Incorpora elementos nuevos o cambia de lugar los que fueran necesarios para mejorar la composición.
        3.  Añade más detalles, tanto formas como texturas , mejora los colores, aplica degradados más sutiles, añade texturas o patrones si es apropiado, y mejora las sombras y luces.
        4.  Asegúrate de que la coherencia estructural se mantenga o mejore. Todas las partes deben seguir conectadas.
        5.  Tu respuesta DEBE SER ÚNICAMENTE el código del NUEVO SVG mejorado, comenzando con "<svg" y terminando con "</svg>". No incluyas explicaciones, comentarios, ni bloques de código markdown.
    `;
}

/**
 * Crea un prompt de mejora estructural.
 * @param {string} svgContent - El SVG actual.
 * @param {string} userPrompt - La instrucción de mejora.
 * @returns {string} El prompt para la IA.
 */
function createStructuralSvgPrompt(svgContent, userPrompt) {
    return `
        Eres un diseñador gráfico experto en la mejora y refinamiento de arte vectorial. Tu tarea es tomar un SVG existente y mejorarlo basándote en una descripción.

        SVG ACTUAL:
        \`\`\`svg
        ${svgContent}
        \`\`\`

        INSTRUCCIONES DE MEJORA: "${userPrompt}"

        TAREAS A REALIZAR:
        1.  Analiza el SVG actual y la instrucción de mejora.
        2.  NO cambies el concepto fundamental del SVG, a menos que las instrucciones de mejora lo requieran. Tu objetivo es refinarlo, no reemplazarlo.
        2.5 Si es necesario, ajusta el tamaño del SVG para que se ajuste al viewBox="0 0 512 512" y mantén un fondo transparente.
        2.6 Incorpora elementos nuevos o cambia de lugar los que fueran necesarios para mejorar la composición.
        3.  Añade más detalles, tanto formas como texturas , mejora los colores, aplica degradados más sutiles, añade texturas o patrones si es apropiado, y mejora las sombras y luces.
        4.  Asegúrate de que la coherencia estructural se mantenga o mejore. Todas las partes deben seguir conectadas.
        5.  Tu respuesta DEBE SER ÚNICAMENTE el código del NUEVO SVG mejorado, comenzando con "<svg" y terminando con "</svg>". No incluyas explicaciones, comentarios, ni bloques de código markdown.
    `;
}