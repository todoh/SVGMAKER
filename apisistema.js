// =================================================================
// ARCHIVO: apisistema.js
// CONTIENE:
// 1. Lógica para almacenar y rotar múltiples API Keys.
// 2. Funciones para obtener la key actual, rotar a la siguiente,
//    y verificar el estado de las keys.
// =================================================================

let apiKeys = [];
let currentIndex = 0;

/**
 * Inicializa o actualiza la lista de API keys desde el string del input.
 * @param {string} keysString - El string con keys separadas por coma.
 */
export function initApiKeys(keysString) {
    apiKeys = (keysString || "")
                .split(',') // Divide por comas
                .map(k => k.trim()) // Limpia espacios en blanco
                .filter(k => k.length > 0); // Filtra keys vacías
    
    currentIndex = 0; // Resetea al cargar nuevas keys
    
    if (apiKeys.length > 0) {
        console.log(`[APISistema] Keys cargadas: ${apiKeys.length}`);
    }
}

/**
 * Obtiene la API key actualmente activa.
 * @returns {string | null} La key actual, o null si no hay keys.
 */
export function getCurrentKey() {
    if (apiKeys.length === 0) {
        return null;
    }
    return apiKeys[currentIndex];
}

/**
 * Rota a la siguiente API key de la lista y la devuelve.
 * Esto implementa el "enfriamiento" cíclico que mencionaste.
 * @returns {string | null} La *siguiente* key, o null si no hay keys.
 */
export function rotateAndGetNextKey() {
    if (apiKeys.length === 0) {
        return null;
    }
    
    // Avanza al siguiente índice, dando la vuelta al llegar al final
    currentIndex = (currentIndex + 1) % apiKeys.length;
    
    console.log(`[APISistema] Rotando. Nuevo índice: ${currentIndex}`);
    return apiKeys[currentIndex];
}

/**
 * Comprueba si hay al menos una API key cargada.
 * @returns {boolean}
 */
export function hasApiKeys() {
    return apiKeys.length > 0;
}

/**
 * Devuelve la cantidad total de keys cargadas.
 * @returns {number}
 */
export function getKeyCount() {
    return apiKeys.length;
}