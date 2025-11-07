// =================================================================
// ARCHIVO: svggeneracion.js
// CONTIENE:
// 1. Funciones para crear PROMPTS de GENERACIÓN (Diseño y Ensamblaje)
// 2. Flujos de GENERACIÓN de SVG (generarImagenDesdePrompt)
// =================================================================

import { callGenerativeApi, svgToPngDataURL, extraerBloqueSVG } from './svgeditar.js';
// (Ya no se importa 'mejorarImagenDesdeSVG' desde aquí,
// ya que el nuevo flujo de generación no lo incluye por defecto)

/**
 * Flujo principal para generar una imagen desde un prompt de usuario en dos pasos.
 * @param {string} userPrompt - El prompt del usuario.
 * @param {string} [model] - El modelo de IA SELECCIONADO para el ensamblaje final.
 * @returns {Promise<{imagen: string, svgContent: string}>}
 */
export async function generarImagenDesdePrompt(userPrompt, model) {
    if (!userPrompt) {
        throw new Error("El prompt de usuario no puede estar vacío.");
    }
    console.log(`[Generador 2 Pasos] Iniciando para: "${userPrompt}"`);
    console.log(`[Generador 2 Pasos] Modelo de Ensamblaje: ${model}`);

    // --- MODELO FIJO PARA EL PASO 1 ---
    const flashModel = 'gemini-2.5-flash-preview-09-2025';

    // =================================================================
    // PASO 1: Diseñar las partes del SVG con el modelo Flash.
    // =================================================================
    console.log(`[Generador 2 Pasos] PASO 1: Diseñando partes con ${flashModel}...`);
    const designPrompt = createDesignPartsPrompt(userPrompt);
    
    // Se espera una respuesta JSON
    const designData = await callGenerativeApi(designPrompt, flashModel, true);

    if (!designData || !designData.parts || !Array.isArray(designData.parts) || designData.parts.length === 0) {
        console.error("Respuesta inesperada en el PASO 1:", designData);
        throw new Error("La IA no devolvió una lista de partes válida.");
    }

    const partsList = designData.parts;
    console.log("[Generador 2 Pasos] Partes recibidas:", partsList);

    // =================================================================
    // PASO 2: Construir el SVG con el modelo SELECCIONADO.
    // =================================================================
    console.log(`[Generador 2 Pasos] PASO 2: Construyendo SVG con ${model}...`);
    const svgPrompt = createSvgFromPartsPrompt(userPrompt, partsList);
    
    // Se espera una respuesta SVG (texto plano)
    const svgContent = await callGenerativeApi(svgPrompt, model, false);

    if (!svgContent || !svgContent.trim().startsWith('<svg')) {
        console.error("Respuesta inesperada en el PASO 2:", svgContent);
        throw new Error("El modelo seleccionado no devolvió un SVG válido.");
    }

    console.log("[Generador 2 Pasos] SVG final recibido. Convirtiendo a PNG...");
    
    // =================================================================
    // PASO 3: Convertir a PNG.
    // =================================================================
    const pngDataUrl = await svgToPngDataURL(svgContent);
    
    return { imagen: pngDataUrl, svgContent: svgContent };
}

/**
 * Crea el prompt para el PASO 1: Diseñar las partes del SVG.
 * @param {string} userPrompt - El prompt simple del usuario.
 * @returns {string} El prompt para la IA (solicitando JSON).
 */
function createDesignPartsPrompt(userPrompt) {
    return `
        Eres un director de arte y diseñador conceptual. Tu tarea es descomponer una solicitud de dibujo en sus componentes visuales clave.

        PROMPT DEL USUARIO: "${userPrompt}"

        INSTRUCCIONES:
        1.  Analiza el prompt y piensa en cómo lo dibujarías.
        2.  Identifica los elementos, capas y componentes principales y secundarios necesarios para construir esta imagen.
        3.  Devuelve una lista de estas partes. Sé descriptivo. Por ejemplo, en lugar de "cabeza", usa "cabeza con casco" o "pelo rubio".
        4.  El objetivo es crear una "lista de tareas" para otro diseñador que ensamblará el SVG final.
        5.  Tu respuesta DEBE SER ÚNICAMENTE un objeto JSON válido con el formato:
            {
              "parts": [
                "descripción de la parte 1",
                "descripción de la parte 2",
                "descripción de la parte 3",
                ...
              ]
            }

        Ejemplo para "Un astronauta en la luna":
        {
          "parts": [
            "Casco de astronauta con reflejo de estrellas",
            "Traje espacial blanco y abultado con bandera",
            "Botas pesadas sobre el polvo lunar",
            "Superficie lunar gris con cráteres",
            "Fondo de espacio negro profundo",
            "La Tierra distante vista desde la luna",
            "Estrellas brillantes en el fondo"
          ]
        }
    `;
}

/**
 * Crea el prompt para el PASO 2: Ensamblar el SVG desde las partes.
 * @param {string} userPrompt - El prompt original del usuario (para contexto).
 * @param {string[]} partsList - La lista de partes generada en el PASO 1.
 * @returns {string} El prompt para la IA (solicitando SVG).
 */
function createSvgFromPartsPrompt(userPrompt, partsList) {
    // Convertir el array de partes en una lista numerada para el prompt.
    const partsListString = partsList.map((part, index) => `  ${index + 1}. ${part}`).join('\n');

    return `
        Eres un ilustrador experto en SVG. Tu tarea es crear un dibujo SVG de alta calidad basado en un prompt y una lista de componentes de diseño.

        PROMPT ORIGINAL: "${userPrompt}"

        LISTA DE COMPONENTES DE DISEÑO (QUÉ DIBUJAR):
${partsListString}

        INSTRUCCIONES DE EJECUCIÓN:
        1.  Usa el PROMPT ORIGINAL como guía de estilo y sentimiento.
        2.  Usa la LISTA DE COMPONENTES como una lista de verificación de los elementos que DEBES incluir.
        3.  Combina todos los componentes en una única escena coherente y bien compuesta.
        4.  Asegúrate de que todas las partes estén conectadas lógicamente (ej. la cabeza al cuello, las ruedas al coche).
        5.  Tu dibujo debe ser detallado, con buen uso del color, degradados y sombras para dar volumen.
        6.  El SVG DEBE tener un viewBox="0 0 1024 1024" y un fondo transparente.
        7.  La composición del dibujo debe estar centrada y ocupar la mayor parte del espacio del viewBox, evitando grandes márgenes vacíos.

        Tu respuesta DEBE SER ÚNICAMENTE el código del SVG final, comenzando con "<svg" y terminando con "</svg>". No incluyas explicaciones, comentarios, ni bloques de código markdown.
    `;
}

// =================================================================
// Se eliminan las funciones anteriores (createUnifiedPrompt, etc.)
// ya que el nuevo flujo de dos pasos las reemplaza.
// =================================================================