// =================================================================
// ARCHIVO: svginteract.js
// CONTIENE:
// 1. Lógica para hacer interactivos los elementos de un SVG.
// 2. Funciones para seleccionar, arrastrar y eliminar formas.
// =================================================================

let svgRoot = null;
let selectedElement = null;
let offset = { x: 0, y: 0 };
let onUpdateCallback = null;

const SELECTED_CLASS = 'shape-selected';

/**
 * Obtiene las coordenadas del mouse dentro del sistema de coordenadas del SVG.
 * @param {MouseEvent} evt - El evento del mouse.
 * @returns {{x: number, y: number}}
 */
function getMousePosition(evt) {
    if (!svgRoot) return { x: 0, y: 0 };
    const CTM = svgRoot.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

/**
 * Inicia el proceso de arrastre.
 * @param {Event} evt - El evento mousedown.
 */
function startDrag(evt) {
    evt.stopPropagation();
    const target = evt.currentTarget;
    
    // Si ya hay un elemento seleccionado, lo deseleccionamos
    if (selectedElement && selectedElement !== target) {
        clearSelection();
    }
    
    // Seleccionamos el nuevo elemento
    selectedElement = target;
    selectedElement.classList.add(SELECTED_CLASS);

    const pos = getMousePosition(evt);

    // Obtenemos la transformación de traslación actual (si existe)
    // Asumimos que la primera transformación es la de traslación
    const transform = selectedElement.transform.baseVal;
    let translate = null;

    if (transform.length > 0 && transform.getItem(0).type === SVGTransform.SVG_TRANSFORM_TRANSLATE) {
        translate = transform.getItem(0);
    } else {
        // Si no existe, creamos una nueva en [0, 0]
        translate = svgRoot.createSVGTransform();
        translate.setTranslate(0, 0);
        selectedElement.transform.baseVal.insertItemBefore(translate, 0);
    }

    // Calculamos el offset del mouse respecto a la traslación del elemento
    offset.x = pos.x - translate.matrix.e;
    offset.y = pos.y - translate.matrix.f;

    svgRoot.addEventListener('mousemove', drag);
    svgRoot.addEventListener('mouseup', endDrag);
    svgRoot.addEventListener('mouseleave', endDrag);
}

/**
 * Mueve el elemento seleccionado.
 * @param {Event} evt - El evento mousemove.
 */
function drag(evt) {
    if (!selectedElement) return;
    evt.preventDefault();
    
    const pos = getMousePosition(evt);
    const newX = pos.x - offset.x;
    const newY = pos.y - offset.y;

    // Actualizamos la transformación de traslación
    selectedElement.transform.baseVal.getItem(0).setTranslate(newX, newY);
}

/**
 * Finaliza el proceso de arrastre.
 */
function endDrag() {
    svgRoot.removeEventListener('mousemove', drag);
    svgRoot.removeEventListener('mouseup', endDrag);
    svgRoot.removeEventListener('mouseleave', endDrag);

    // Notificamos a main.js que el SVG ha sido modificado
    if (onUpdateCallback && svgRoot) {
        onUpdateCallback(svgRoot.outerHTML);
    }
}

/**
 * Deselecciona cualquier elemento activo.
 */
export function clearSelection() {
    if (selectedElement) {
        selectedElement.classList.remove(SELECTED_CLASS);
    }
    selectedElement = null;
}

/**
 * Elimina el elemento actualmente seleccionado.
 * @returns {boolean} - True si un elemento fue eliminado.
 */
export function deleteSelectedElement() {
    if (selectedElement) {
        selectedElement.remove();
        
        // Notificamos la actualización
        if (onUpdateCallback && svgRoot) {
            onUpdateCallback(svgRoot.outerHTML);
        }
        
        selectedElement = null;
        return true;
    }
    return false;
}

/**
 * Prepara un SVG para que sus elementos internos sean interactivos.
 * @param {SVGElement} svgElement - El elemento <svg> del DOM.
 * @param {function(string):void} onUpdate - Callback que se llama con el nuevo string SVG tras una modificación.
 */
export function makeSvgInteractive(svgElement, onUpdate) {
    svgRoot = svgElement;
    onUpdateCallback = onUpdate;
    clearSelection();

    // Hacemos que el fondo del SVG deseleccione todo
    svgRoot.addEventListener('mousedown', (e) => {
        // Si el click es en el fondo (el propio <svg>) y no en una forma
        if (e.target === svgRoot) {
            clearSelection();
        }
    });

    // Añadimos listeners a todas las formas y grupos
    const shapes = svgRoot.querySelectorAll('path, circle, rect, ellipse, line, polyline, polygon, g');
    
    shapes.forEach(shape => {
        shape.style.cursor = 'move';
        shape.addEventListener('mousedown', startDrag);
    });
}

/**
 * Desactiva la interactividad del SVG (limpieza).
 */
export function deactivateSvgInteraction() {
    if (svgRoot) {
        // Aquí podríamos querer eliminar los event listeners si fuera necesario
        // Pero por ahora, solo limpiamos las referencias.
    }
    clearSelection();
    svgRoot = null;
    onUpdateCallback = null;
}