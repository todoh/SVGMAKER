// =================================================================
// ARCHIVO: svgeditar.js
// CONTIENE:
// 1. Funciones de utilidad (API, conversión de SVG)
// 2. Manejo de la API Key (AHORA MANEJADO POR apisistema.js)
// 3. (Espacio para futuras funciones de edición manual)
// =================================================================

// Importamos el nuevo sistema de manejo de keys
import { getCurrentKey, rotateAndGetNextKey, hasApiKeys, getKeyCount } from './apisistema.js';

// --- Almacenamiento de la API Key (Eliminado) ---
// La variable 'apiKey' y 'setApiKey' ya no existen aquí.

/**
 * Llama a la API de Gemini, con reintentos y rotación de keys.
 * @param {string} prompt - El prompt para el modelo.
 * @param {string} model - El modelo a usar.
 * @param {boolean} isJson - Si se debe esperar una respuesta JSON.
 * @returns {Promise<any>} La respuesta del modelo (texto o JSON parseado).
 */
export async function callGenerativeApi(prompt, model = 'gemini-2.5-flash-preview-09-2025', isJson = false) {
    
    if (!hasApiKeys()) {
         throw new Error("API Key no está configurada. Ingresa al menos una API Key.");
    }

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    if (isJson) {
        payload.generationConfig = {
            responseMimeType: "application/json",
        };
    }

    // =================================================================
    // NUEVA LÓGICA DE ROTACIÓN Y REINTENTOS
    // =================================================================
    
    let currentKey = getCurrentKey(); // Key inicial
    const totalKeys = getKeyCount();
    let attemptCount = 0; // Contará los intentos fallidos por 429

    // Intentaremos una vez por cada key disponible.
    while (attemptCount < totalKeys) {
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            // --- CASO 1: ÉXITO (200 OK) ---
            if (response.ok) {
                const result = await response.json();

                if (!result.candidates || !result.candidates[0].content.parts[0].text) {
                    console.error("Respuesta inesperada de la API:", result);
                    throw new Error("Respuesta inválida de la API de Gemini.");
                }

                const text = result.candidates[0].content.parts[0].text;

                if (isJson) {
                    try {
                        const cleanText = text.replace(/^```json\n?|```$/g, "").trim();
                        return JSON.parse(cleanText);
                    } catch (e) {
                        console.error("Falló el parseo del JSON:", e);
                        console.log("Texto recibido:", text);
                        throw new Error("La API devolvió un JSON inválido.");
                    }
                } else {
                    return extraerBloqueSVG(text);
                }
            } // Fin de if (response.ok)

            // --- CASO 2: ERROR 429 (Too Many Requests) ---
            // ¡Rotamos la key y reintentamos!
            if (response.status === 429) {
                console.warn(`[APISistema] Error 429 (Límite de peticiones) con la key [${currentKey.substring(0, 4)}...]. Rotando...`);
                attemptCount++;
                
                if (attemptCount >= totalKeys) {
                    // Este fue el último intento, ya probamos todas las keys.
                    throw new Error("Todas las API Keys han fallado por error 429 (Límite de peticiones). Reintenta más tarde.");
                }
                
                // Obtenemos la siguiente key y continuamos el bucle
                currentKey = rotateAndGetNextKey();
                continue; // Vuelve al inicio del 'while' con la nueva key
            }

            // --- CASO 3: OTRO ERROR (400, 500, 403...) ---
            // Error fatal, no reintentar.
            const errorBody = await response.text();
            console.error(`Error fatal en la respuesta de la API (No 429): ${response.status}`, errorBody);
            throw new Error(`Error en la API: ${response.status} ${response.statusText}. (Key: ${currentKey.substring(0, 4)}...)`);

        } catch (error) {
            // --- CASO 4: ERROR DE RED O ERROR YA LANZADO ---
            
            // Si el error ya es uno de los que lanzamos nosotros, solo lo relanzamos.
            if (error.message.startsWith("Todas las API Keys") || 
                error.message.startsWith("Error en la API:") ||
                error.message.startsWith("La API devolvió un JSON inválido") ||
                error.message.startsWith("Respuesta inválida")) 
            {
                throw error;
            }

            // Si es un error de red (ej. 'Failed to fetch'), no rotamos.
            console.error("Error de Red o Fetch en callGenerativeApi:", error);
            throw new Error(`Error de red o fetch (ver consola): ${error.message}`);
        }
    } // Fin del while
    
    // Esta línea solo se alcanzaría si totalKeys es 0, lo cual ya se controla al inicio.
    throw new Error("Ha ocurrido un error inesperado en el bucle de reintentos.");
}

/**
 * Convierte una cadena SVG a una Data URL PNG.
 * (Esta función no necesita cambios)
 * @param {string} svgString - La cadena de texto del SVG.
 * @returns {Promise<string>} Una promesa que resuelve con la Data URL del PNG.
 */
export function svgToPngDataURL(svgString) {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            const viewBoxMatch = svgString.match(/viewBox="([\d\s\.\-]+)"/);
            let width = 1024;
            let height = 1024;

            if (viewBoxMatch) {
                const viewBox = viewBoxMatch[1].split(' ');
                width = parseFloat(viewBox[2]);
                height = parseFloat(viewBox[3]);
            } else {
                const widthMatch = svgString.match(/width="(\d+)"/);
                const heightMatch = svgString.match(/height="(\d+)"/);
                if (widthMatch) width = parseInt(widthMatch[1]);
                if (heightMatch) height = parseInt(heightMatch[1]);
            }
            
            canvas.width = width;
            canvas.height = height;

            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                const pngDataUrl = canvas.toDataURL('image/png');
                resolve(pngDataUrl);
            };

            img.onerror = (e) => {
                console.error("Error al cargar SVG en la imagen:", e);
                URL.revokeObjectURL(url);
                reject(new Error("No se pudo cargar el SVG para convertir a PNG."));
            };

            img.src = url;

        } catch (error) {
            console.error("Error en svgToPngDataURL:", error);
            reject(error);
        }
    });
}

/**
 * Extrae el primer bloque de código SVG de un texto.
 * (Esta función no necesita cambios)
 * @param {string} texto - El texto que puede contener un bloque SVG.
 * @returns {string} El SVG extraído, o el texto original si no se encuentra.
 */
export function extraerBloqueSVG(texto) {
    const match = /<svg[\s\S]*?<\/svg>/.exec(texto);
    if (match) {
        return match[0];
    }
    if (texto.trim().startsWith("<svg")) {
        return texto.trim();
    }
    return texto;
}