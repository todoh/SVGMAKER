// =================================================================
// ARCHIVO: generadorrealista.js
// CONTIENE:
// 1. Lógica para llamar a la API de generación de imágenes
//    (gemini-2.0-flash-preview-image-generation) con rotación de keys.
// 2. Lógica para eliminar el fondo verde (chroma key).
// 3. Función principal exportada: generarImagenRealistaDesdePrompt
// =================================================================

import { getCurrentKey, rotateAndGetNextKey, hasApiKeys } from './apisistema.js';

/**
 * Función principal para generar una imagen realista con fondo transparente.
 * @param {string} userPrompt - El prompt del usuario.
 * @returns {Promise<string>} Una promesa que resuelve con la Data URL del PNG.
 */
export async function generarImagenRealistaDesdePrompt(userPrompt) {
    console.log(`[Generador Realista] Iniciando para: "${userPrompt}"`);

    // 1. Crear el prompt específico para chroma key
    // Le pedimos explícitamente un fondo verde sólido y cuerpo completo.
    const imageApiPrompt = `
        Genera una imagen fotorrealista de: "${userPrompt}".

        REGLAS IMPORTANTES:
        1.  **CUERPO COMPLETO:** El personaje, sujeto u objeto DEBE mostrarse de cuerpo completo (full body). Es imprescindible. No cortes la imagen; que sea completa, de la cabeza a los pies.
        2.  **FONDO VERDE:** El sujeto debe estar completamente sobre un fondo de color verde sólido (chroma key green, como #00FF00).
        3.  **FONDO LIMPIO:** El fondo debe ser 100% verde sólido, sin texturas, sombras ni otros objetos.
        4.  **CALIDAD FOTOREALISTA:** La imagen debe ser de alta calidad, con buena iluminación y detalles nítidos.
        5. recuerda si es persona de cuerpo entero.
    `.trim();

    // 2. Llamar a la API de imagen
    const model = 'gemini-2.0-flash-preview-image-generation';
    const responseData = await callImageApiWithRotation(imageApiPrompt, model);

    // 3. Extraer la parte de la imagen
    const imagePart = responseData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart?.inlineData?.data) {
        const textResponse = responseData.candidates?.[0]?.content?.parts?.[0]?.text || "No se encontró contenido.";
        throw new Error(`La API no devolvió una imagen. Respuesta: ${textResponse}`);
    }

    console.log("[Generador Realista] Imagen base recibida. Eliminando fondo verde...");

    // 4. Eliminar el fondo verde
    const processedImage = await removeGreenScreen(imagePart);

    console.log("[Generador Realista] Fondo eliminado y recortado.");

    // 5. Devolver la Data URL final
    return `data:${processedImage.inlineData.mimeType};base64,${processedImage.inlineData.data}`;
}


/**
 * Llama a la API de generación de imágenes con rotación de keys y reintentos.
 * Adaptado de tu archivo generador.js.
 */
async function callImageApiWithRotation(prompt, model) {
    if (!hasApiKeys()) {
        throw new Error("No hay API keys configuradas. Ingresa al menos una API Key.");
    }

    // Usaremos hasta 3 ciclos completos de todas las keys
    const RETRY_CYCLES = 3; 
    const keyCount = hasApiKeys(); // Asumimos que getKeyCount() existe en apisistema
    const maxAttempts = (keyCount > 0 ? keyCount : 1) * RETRY_CYCLES;
    
    let lastError = null;
    let currentKey = getCurrentKey();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const logPrefix = `[Image API][Intento ${attempt + 1}/${maxAttempts}]`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            safetySettings: [
                { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
            ]
        };

        try {
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // 429 = Too Many Requests (Cuota excedida)
            if (response.status === 429) {
                console.warn(`${logPrefix} La clave ha excedido la cuota. Rotando...`);
                lastError = new Error("Cuota excedida.");
                currentKey = rotateAndGetNextKey(); // Rotamos a la siguiente key
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera antes de reintentar
                continue;
            }
            
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`Error no relacionado con cuota (${response.status}): ${errorBody.error?.message || 'Error desconocido'}`);
            }

            console.log(`${logPrefix} ✅ Petición de imagen exitosa.`);
            return await response.json(); // ¡Éxito!

        } catch (error) {
            lastError = error;
            console.error(`${logPrefix} El intento falló:`, error);
            
            // Si el error no es de cuota, es un error fatal, no reintentar.
            if (!error.message.includes("Cuota excedida")) {
                throw lastError;
            }
            
            // Si fue de cuota, ya rotamos la key, así que el bucle continúa.
        }
    }

    throw new Error(`Todos los intentos de generación de imagen fallaron. Último error: ${lastError.message}`);
}

/**
 * Detecta un fondo verde croma, lo elimina, neutraliza el "spill" y recorta.
 * Copiado de tu archivo generador.js.
 */
async function removeGreenScreen(imagePart) {
    if (!imagePart?.inlineData?.data) {
        throw new Error("El objeto imagePart para procesar no es válido.");
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);

            // --- PASO 1: Detectar el color del fondo (solo verdes croma) ---
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;
            const greenColorCounts = new Map();
            const borderSize = 10;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    // Solo analizamos los píxeles de los bordes
                    if (x < borderSize || x >= canvas.width - borderSize || y < borderSize || y >= canvas.height - borderSize) {
                        const index = (y * canvas.width + x) * 4;
                        const r = data[index];
                        const g = data[index + 1];
                        const b = data[index + 2];

                        // Filtro para "verde croma"
                        if (g > r * 1.3 && g > b * 1.3 && g > 90) {
                            const key = `${r},${g},${b}`;
                            greenColorCounts.set(key, (greenColorCounts.get(key) || 0) + 1);
                        }
                    }
                }
            }

            let dominantColorKey = '';
            let maxCount = 0;
            for (const [key, count] of greenColorCounts.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    dominantColorKey = key;
                }
            }
            
            if (!dominantColorKey) {
                // FALLBACK: Si no se detecta verde croma, probamos con blanco/gris claro
                // (Esto es un fallback por si la IA no sigue la instrucción del fondo verde)
                console.warn("[Chroma] No se detectó fondo verde. Intentando fallback con fondo claro...");
                greenColorCounts.clear(); // Reutilizamos el mapa
                 for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        if (x < borderSize || x >= canvas.width - borderSize || y < borderSize || y >= canvas.height - borderSize) {
                            const index = (y * canvas.width + x) * 4;
                            const r = data[index];
                            const g = data[index + 1];
                            const b = data[index + 2];

                            // Filtro para "claro" (blanco/gris)
                            if (r > 200 && g > 200 && b > 200) {
                                const key = `${r},${g},${b}`;
                                greenColorCounts.set(key, (greenColorCounts.get(key) || 0) + 1);
                            }
                        }
                    }
                }
                for (const [key, count] of greenColorCounts.entries()) {
                    if (count > maxCount) {
                        maxCount = count;
                        dominantColorKey = key;
                    }
                }

                if (!dominantColorKey) {
                     // Si aun así falla, devolvemos la imagen original sin procesar.
                    console.error("[Chroma] No se pudo detectar un fondo croma (verde o claro). Se devuelve la imagen original.");
                    resolve(imagePart);
                    return;
                }
            }

            const [chromaR, chromaG, chromaB] = dominantColorKey.split(',').map(Number);
            const isGreen = chromaG > chromaR && chromaG > chromaB; // Flag para el de-spill

            // --- PASO 2: Eliminar el fondo con un borde suave (tolerancia dual) ---
            const hardTolerance = 35;
            const softTolerance = 70;

            for (let i = 0; i < data.length; i += 4) {
                const distance = Math.sqrt(
                    Math.pow(data[i] - chromaR, 2) +
                    Math.pow(data[i + 1] - chromaG, 2) +
                    Math.pow(data[i + 2] - chromaB, 2)
                );

                if (distance < hardTolerance) {
                    data[i + 3] = 0;
                } else if (distance < softTolerance) {
                    const ratio = (distance - hardTolerance) / (softTolerance - hardTolerance);
                    data[i + 3] = Math.floor(data[i + 3] * ratio);
                }
            }
            
            // --- PASO 3: Limpieza de Bordes (De-spill) ---
            if (isGreen) { // Solo hacemos de-spill si el fondo era verde
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    if (a > 0 && g > r && g > b) {
                        const newGreen = (r + b) / 2;
                        data[i + 1] = newGreen;
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);

            // --- PASO 4: Recortar el espacio transparente (autocrop) ---
            let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const alpha = data[(y * canvas.width + x) * 4 + 3];
                    if (alpha > 0) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            if (maxX === -1) {
                // La imagen está completamente vacía
                resolve({ inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }});
                return;
            }

            const cropWidth = maxX - minX + 1;
            const cropHeight = maxY - minY + 1;
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropWidth;
            cropCanvas.height = cropHeight;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            
            const newBase64Url = cropCanvas.toDataURL('image/png');
            const newBase64Data = newBase64Url.split(',')[1];

            resolve({
                inlineData: {
                    mimeType: 'image/png',
                    data: newBase64Data
                }
            });
        };

        img.onerror = (err) => reject(new Error("Error al cargar la imagen Base64 para procesarla. Detalles: " + (err.message || 'Error desconocido')));
        img.src = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    });
}