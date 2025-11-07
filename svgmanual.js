// =================================================================
// ARCHIVO: svgmanual.js
// CONTIENE:
// 1. Funciones para la manipulación manual del viewBox (pan y zoom).
// =================================================================

const DEFAULT_VIEWBOX = { minX: 0, minY: 0, width: 1024, height: 1024 };

/**
 * Parsea el string del viewBox de un SVG a un objeto.
 * @param {string} svgContent - El contenido completo del SVG.
 * @returns {{minX: number, minY: number, width: number, height: number}}
 */
function getViewBox(svgContent) {
    const viewBoxMatch = svgContent.match(/viewBox="([0-9\.\-\s]+)"/);
    
    if (viewBoxMatch && viewBoxMatch[1]) {
        const parts = viewBoxMatch[1].split(' ').map(parseFloat);
        if (parts.length === 4) {
            return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
        }
    }
    // Devuelve el default si no se encuentra o es inválido
    return { ...DEFAULT_VIEWBOX };
}

/**
 * Reemplaza o añade el atributo viewBox en un string SVG.
 * @param {string} svgContent - El contenido completo del SVG.
 * @param {{minX: number, minY: number, width: number, height: number}} viewBox - El objeto del nuevo viewBox.
 * @returns {string} El SVG con el viewBox actualizado.
 */
function setViewBox(svgContent, viewBox) {
    const viewBoxString = `viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}"`;
    
    // Si ya existe un viewBox, lo reemplazamos
    if (svgContent.includes('viewBox=')) {
        return svgContent.replace(/viewBox=".*?"/, viewBoxString);
    } else {
        // Si no existe, lo insertamos en la etiqueta <svg>
        // (Esto es una inserción simple, asume una etiqueta <svg ...>)
        return svgContent.replace(/<svg/, `<svg ${viewBoxString}`);
    }
}

/**
 * Modifica el viewBox de un SVG para mover o escalar la vista.
 * @param {string} svgContent - El contenido SVG actual.
 * @param {'pan-up' | 'pan-down' | 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'reset'} action - La acción a realizar.
 * @param {number} [panStep=50] - Cuántos píxeles mover en una acción 'pan'.
 * @param {number} [zoomFactor=1.2] - Cuánto escalar en una acción 'zoom'.
 * @returns {string} El nuevo contenido SVG con el viewBox modificado.
 */
export function manipulateViewBox(svgContent, action, panStep = 50, zoomFactor = 1.2) {
    let viewBox = getViewBox(svgContent);
    const oldWidth = viewBox.width;
    const oldHeight = viewBox.height;

    switch (action) {
        case 'pan-up':
            viewBox.minY -= panStep;
            break;
        case 'pan-down':
            viewBox.minY += panStep;
            break;
        case 'pan-left':
            viewBox.minX -= panStep;
            break;
        case 'pan-right':
            viewBox.minX += panStep;
            break;
        
        case 'zoom-in':
            // Achica el área de visión (zoom in)
            viewBox.width /= zoomFactor;
            viewBox.height /= zoomFactor;
            // Ajusta minX/minY para que el zoom sea hacia el centro
            viewBox.minX += (oldWidth - viewBox.width) / 2;
            viewBox.minY += (oldHeight - viewBox.height) / 2;
            break;
            
        case 'zoom-out':
            // Agranda el área de visión (zoom out)
            viewBox.width *= zoomFactor;
            viewBox.height *= zoomFactor;
            // Ajusta minX/minY para que el zoom sea desde el centro
            viewBox.minX -= (viewBox.width - oldWidth) / 2;
            viewBox.minY -= (viewBox.height - oldHeight) / 2;
            break;
            
        case 'reset':
            viewBox = { ...DEFAULT_VIEWBOX };
            break;
            
        default:
            // Si la acción no es reconocida, no hace nada
            return svgContent;
    }

    return setViewBox(svgContent, viewBox);
}