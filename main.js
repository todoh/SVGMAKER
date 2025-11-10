// =================================================================
// ARCHIVO: main.js
// CONTIENE:
// 1. Lógica de la Interfaz de Usuario (DOM, Eventos)
// 2. Importación de módulos de lógica (generación, mejora)
// 3. Manejo de estado (API Key, Galería de SVGs)
// =================================================================

import { initApiKeys } from './apisistema.js';
import { generarImagenDesdePrompt } from './svggeneracion.js'; // Importación actualizada
import { generarImagenRealistaDesdePrompt } from './generadorrealista.js'; // <-- NUEVA IMPORTACIÓN
import { mejorarImagenDesdeSVG } from './svgmejora.js';
import { manipulateViewBox } from './svgmanual.js';
import { makeSvgInteractive, deleteSelectedElement, clearSelection, deactivateSvgInteraction } from './svginteract.js';

// --- NUEVAS IMPORTACIONES 3D ---
import { init3DViewer, clear3DViewer, generate3DModel, edit3DModel, renderModel, exportSceneToGLB } from './svga3d.js';
// --- Variables de Estado ---
let svgGallery = [];
let currentSelectedId = null;
let currentMode = 'none'; // 'none', '2d', '3d'

// --- Referencias a elementos DOM ---
let apiKeyInput, promptInput, generateButton, generateRealisticButton, // <-- AÑADIDO
    copySvgButton, downloadSvgButton,
    previewArea, statusMessage, loader,
    modelSelect, galleryGrid, downloadGalleryButton, uploadGalleryInput,
    improveModal, modalItemName, modalImprovePrompt,
    modalImproveCancel, modalRenameSave, modalImproveConfirm,
    modalDuplicate, modalDelete,
    modalDeleteConfirm, modalDeleteConfirmBtn, modalDeleteCancelBtn,
    svgCode, svgCodeContainer, svgCodeWrapper, actionsSection,
    manualControls, 
    deleteShapeButton, modalImproveSection;

// --- NUEVAS REFERENCIAS DOM 3D (MODIFICADAS) ---
let controls3DSection, prompt3D, generate3DButton, edit3DButton,
    copy3DModelButton, download3DModelButton;


// --- Funciones de la UI ---
 
function showLoader(isLoading, text = "Procesando...") {
    if (isLoading) {
        loader.querySelector('p').textContent = text;
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

/**
 * Muestra un mensaje de estado al usuario.
 * @param {string} message - El mensaje a mostrar.
 * @param {boolean} [isError] - Si el mensaje es un error.
 */
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'status-message status-error' : 'status-message status-success';
    
    setTimeout(() => {
        if (statusMessage.textContent === message) {
            statusMessage.textContent = "";
        }
    }, 3000);
}

/**
 * Muestra el editor 2D (SVG o PNG) en la vista previa.
 * @param {object} item - El item de la galería.
 */
function showResultInPreview(item) {
    const { svgContent, prompt, id } = item;
    
    // 1. Limpiar CUALQUER visor anterior (2D o 3D)
    clearPreviewArea();
    currentMode = '2d';
    currentSelectedId = id;

    // ==================
    //  CAMBIO AQUÍ: Detectar si es PNG o SVG
    // ==================
    if (svgContent.startsWith('data:image/png')) {
        // --- ES UN PNG REALISTA ---
        const img = document.createElement('img');
        img.src = svgContent;
        img.alt = item.name;
        previewArea.appendChild(img);

        // Mostrar solo el botón de descarga
        actionsSection.classList.remove('hidden');
        downloadSvgButton.textContent = "Descargar PNG"; // Cambiar texto del botón
        
        // Ocultar todos los demás controles
        copySvgButton.classList.add('hidden');
        deleteShapeButton.classList.add('hidden');
        svgCodeWrapper.classList.add('hidden');
        manualControls.classList.add('hidden');
        controls3DSection.classList.add('hidden'); // No se puede generar 3D desde un PNG

    } else {
        // --- ES UN SVG ---
        let svgElement;
        try {
            const doc = new DOMParser().parseFromString(svgContent, "image/svg+xml");
            svgElement = doc.documentElement;
            if (svgElement.tagName === 'parsererror' || !svgElement) {
                throw new Error('Error al parsear el SVG.');
            }
        } catch (e) {
            console.error("Error parseando SVG:", e);
            showStatus("Error: El SVG está corrupto.", true);
            previewArea.innerHTML = "<p>Error: SVG corrupto.</p>";
            return;
        }

        // 3. Añadir el elemento SVG al DOM y hacerlo interactivo
        previewArea.appendChild(svgElement);
        makeSvgInteractive(svgElement, (updatedSvgString) => {
            updateGalleryItem(currentSelectedId, { svgContent: updatedSvgString });
            svgCode.textContent = updatedSvgString;
        });

        // 4. Mostrar UI 2D (SVG)
        svgCode.textContent = svgContent;
        actionsSection.classList.remove('hidden');
        svgCodeWrapper.classList.remove('hidden');
        manualControls.classList.remove('hidden');
        
        // Mostrar botones de SVG
        downloadSvgButton.textContent = "Descargar SVG";
        copySvgButton.classList.remove('hidden');
        deleteShapeButton.classList.remove('hidden');
        
        // 5. Mostrar UI 3D (para permitir la generación desde 2D)
        controls3DSection.classList.remove('hidden');
        prompt3D.value = ""; // Limpiar el prompt 3D
        copy3DModelButton.classList.add('hidden');
        download3DModelButton.classList.add('hidden');
    }
    // ==================
    //  FIN DEL CAMBIO
    // ==================

    // 6. Resaltar en galería (común a ambos)
    highlightGalleryItem(id);
}

/**
 * Muestra el visor 3D en la vista previa.
 * @param {object} item - El item de la galería (debe tener .model3d).
 */
async function show3DModelInPreview(item) {
    const { model3d, id, name } = item;

    // 1. Limpiar CUALQUER visor anterior (2D o 3D)
    clearPreviewArea();
    currentMode = '3d';
    currentSelectedId = id;

    // 2. Inicializar el visor 3D
    try {
        init3DViewer(previewArea);
        
        // 3. Renderizar el modelo
        if (model3d && model3d.data) {
            await renderModel(model3d.data);
            prompt3D.value = model3d.prompt || "";
        } else {
            throw new Error("El item no contiene datos de modelo 3D válidos.");
        }
    } catch (e) {
        console.error("Error al inicializar o renderizar el visor 3D:", e);
        showStatus("Error al mostrar el modelo 3D.", true);
        previewArea.innerHTML = "<p>Error al mostrar el modelo 3D.</p>";
        return;
    }
    
    // 4. Mostrar UI 3D
    controls3DSection.classList.remove('hidden');
    copy3DModelButton.classList.remove('hidden'); 
    download3DModelButton.classList.remove('hidden'); 
    
    // 5. Ocultar UI 2D
    actionsSection.classList.add('hidden');
    svgCodeWrapper.classList.add('hidden');
    manualControls.classList.add('hidden');
    
    // 6. Resaltar en galería
    highlightGalleryItem(id);
}

/**
 * Limpia el área de vista previa y desactiva los modos.
 */
function clearPreview() {
    clearPreviewArea();
    currentSelectedId = null;
    currentMode = 'none';
    
    // Desmarcar todos los items de la galería
    document.querySelectorAll('.gallery-item.selected').forEach(el => el.classList.remove('selected'));
}

/**
 * Limpia solo el contenido del área de vista previa y los controles.
 * (Función de ayuda interna)
 */
function clearPreviewArea() {
    // Limpiar visor 2D
    deactivateSvgInteraction();
    
    // Limpiar visor 3D
    clear3DViewer(previewArea); // Esta función elimina el canvas

    previewArea.innerHTML = "";
    
    // Ocultar todos los controles contextuales
    actionsSection.classList.add('hidden');
    svgCodeWrapper.classList.add('hidden');
    manualControls.classList.add('hidden');
    controls3DSection.classList.add('hidden');
    
    svgCode.textContent = "...";
}

/**
 * Resalta un item en la galería.
 * @param {string} id - El ID del item a resaltar.
 */
function highlightGalleryItem(id) {
    document.querySelectorAll('.gallery-item.selected').forEach(el => el.classList.remove('selected'));
    const itemEl = galleryGrid.querySelector(`.gallery-item[data-id="${id}"]`);
    if (itemEl) {
        itemEl.classList.add('selected');
    }
}


// --- Funciones de Galería ---

/**
 * Carga la galería. (Ahora solo inicializa)
 */
function initGallery() {
    svgGallery = [];
    renderGallery();
}

/**
 * Guarda la galería (Función vacía por ahora).
 */
function saveGallery() {
    // En el futuro, podría guardar en localStorage o IndexedDB
}

/**
 * Renderiza todos los items de la galería en el DOM.
 */
function renderGallery() {
    galleryGrid.innerHTML = ""; 
    if (svgGallery.length === 0) {
        galleryGrid.innerHTML = "<p>Tu galería está vacía. ¡Genera un dibujo para empezar!</p>";
        return;
    }

    svgGallery.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    svgGallery.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'gallery-item';
        itemEl.dataset.id = item.id;
        itemEl.tabIndex = 0;
        
        if (item.id === currentSelectedId) {
            itemEl.classList.add('selected');
        }

        if (item.status === 'pending') {
            itemEl.classList.add('status-pending');
            itemEl.innerHTML = `
                <div class="gallery-item-status">
                    <div class="spinner-small"></div>
                    <span>Generando...</span>
                </div>
                <img src="https://placehold.co/100x100/f3f4f6/d1d5db?text=..." alt="Generando">
                <p class="gallery-item-name">${item.name}</p>
            `;
        } else if (item.status === 'error') {
            itemEl.classList.add('status-error');
            itemEl.innerHTML = `
                <div class="gallery-item-status">
                    <span>Error</span>
                </div>
                <img src="https://placehold.co/100x100/fecaca/dc2626?text=Error" alt="Error de generación">
                <p class="gallery-item-name">${item.name}</p>
            `;
        } else if (item.svgContent) { 
            // ==================
            //  CAMBIO AQUÍ: Detectar PNG en galería
            // ==================
            let imageTag;
            if (item.svgContent.startsWith('data:image/png')) {
                // Es un PNG
                imageTag = `<img src="${item.svgContent}" alt="${item.name}">`;
            } else {
                // Es un SVG
                const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(item.svgContent);
                imageTag = `<img src="${svgDataUrl}" alt="${item.name}">`;
            }

            itemEl.innerHTML = `
                <div class="gallery-item-actions">
                    <button class="gallery-item-btn edit" data-action="edit" title="Editar">✏️</button>
                    <button class="gallery-item-btn delete" data-action="delete" title="Eliminar">❌</button>
                </div>
                ${imageTag}
                <p class="gallery-item-name">${item.name}</p>
            `;
            // ==================
            //  FIN DEL CAMBIO
            // ==================
        } else if (item.model3d) { // --- ES UN ITEM 3D ---
            // Usamos un placeholder para el 3D
            const placeholder = `https://placehold.co/100x100/374151/e5e7eb?text=3D`;
            itemEl.innerHTML = `
                <div class="gallery-item-actions">
                    <button class="gallery-item-btn edit" data-action="edit" title="Editar">✏️</button>
                    <button class="gallery-item-btn delete" data-action="delete" title="Eliminar">❌</button>
                </div>
                <img src="${placeholder}" alt="${item.name}">
                <p class="gallery-item-name">${item.name}</p>
            `;
            itemEl.classList.add('item-3d'); // Clase para posible estilo futuro
        }

        itemEl.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
            if (action === 'edit') {
                handleGalleryEditClick(item);
            } else if (action === 'delete') {
                handleGalleryDeleteClick(item);
            } else if (item.status === 'completed') {
                handleGalleryItemClick(item); // Click principal
            }
        });
        
        galleryGrid.appendChild(itemEl);
    });
}

/**
 * Añade un nuevo item a la galería.
 * @param {object} item - El objeto del item a añadir.
 */
function addToGallery(item) {
    svgGallery.push(item);
    renderGallery();
    saveGallery();
}

/**
 * Actualiza un item existente en la galería.
 * @param {string} id - El ID del item a actualizar.
 * @param {object} updates - Un objeto con las propiedades a actualizar.
 */
function updateGalleryItem(id, updates) {
    const itemIndex = svgGallery.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        svgGallery[itemIndex] = { ...svgGallery[itemIndex], ...updates };
        renderGallery();
        saveGallery();
    }
}

// --- Manejadores de Eventos ---

/**
 * Inicia la generación de un nuevo SVG y lo añade a la cola.
 */
function handleGenerate() {
    const fullInput = promptInput.value;
    const key = apiKeyInput.value;
    const selectedModel = modelSelect.value;

    const prompts = fullInput.split('@')
                             .map(p => p.trim())
                             .filter(p => p.length > 0);

    if (prompts.length === 0) {
        showStatus("Por favor, ingresa un prompt principal.", true);
        return;
    }

    if (!key) {
        showStatus("Por favor, ingresa tu API Key.", true);
        return;
    }

    generateButton.disabled = true;
    generateRealisticButton.disabled = true; // <-- Deshabilitar ambos
    
    const statusMessage = prompts.length === 1 
        ? "Añadido 1 item SVG a la cola..."
        : `Añadidos ${prompts.length} items SVG a la cola...`;
    showStatus(statusMessage, false);
    
    promptInput.value = "";
    generateButton.disabled = false;
    generateRealisticButton.disabled = false; // <-- Rehabilitar ambos

    const baseTimestamp = Date.now();

    prompts.forEach((prompt, index) => {
        
        const newItem = {
            id: `${baseTimestamp}-${index}`,
            name: prompt.substring(0, 30) + '...' || 'Nuevo SVG',
            prompt: prompt,
            status: 'pending',
            isRealistic: false // <-- Flag
        };

        addToGallery(newItem);

        (async () => {
            try {
                const result = await generarImagenDesdePrompt(prompt, selectedModel);
                
                updateGalleryItem(newItem.id, {
                    svgContent: result.svgContent,
                    status: 'completed'
                });
            } catch (error) {
                console.error(`Error en handleGenerate (SVG) for prompt "${prompt}":`, error);
                showStatus(`Error al generar SVG "${prompt.substring(0, 15)}...": ${error.message}`, true);
                
                updateGalleryItem(newItem.id, { 
                    status: 'error', 
                    name: 'Error de Generación' 
                });
            }
        })();
    });
}

/**
 * =================================================================
 * NUEVA FUNCIÓN: Generar Imagen Realista
 * =================================================================
 */
function handleGenerateRealistic() {
    const fullInput = promptInput.value;
    const key = apiKeyInput.value;
    // El modelo se maneja dentro de generadorrealista.js

    const prompts = fullInput.split('@')
                             .map(p => p.trim())
                             .filter(p => p.length > 0);

    if (prompts.length === 0) {
        showStatus("Por favor, ingresa un prompt principal.", true);
        return;
    }

    if (!key) {
        showStatus("Por favor, ingresa tu API Key.", true);
        return;
    }

    generateButton.disabled = true; // <-- Deshabilitar ambos
    generateRealisticButton.disabled = true;
    
    const statusMessage = prompts.length === 1 
        ? "Añadido 1 item Realista a la cola..."
        : `Añadidos ${prompts.length} items Realistas a la cola...`;
    showStatus(statusMessage, false);
    
    promptInput.value = "";
    generateButton.disabled = false; // <-- Rehabilitar ambos
    generateRealisticButton.disabled = false;

    const baseTimestamp = Date.now();

    prompts.forEach((prompt, index) => {
        
        const newItem = {
            id: `${baseTimestamp}-${index}`,
            name: prompt.substring(0, 30) + '...' || 'Nueva Imagen Realista',
            prompt: prompt,
            status: 'pending',
            isRealistic: true // <-- Flag
        };

        addToGallery(newItem);

        (async () => {
            try {
                // Usamos la nueva función del nuevo archivo
                const pngDataUrl = await generarImagenRealistaDesdePrompt(prompt);
                
                updateGalleryItem(newItem.id, {
                    svgContent: pngDataUrl, // Guardamos la Data URL del PNG aquí
                    status: 'completed'
                });
            } catch (error) {
                console.error(`Error en handleGenerateRealistic for prompt "${prompt}":`, error);
                showStatus(`Error al generar Realista "${prompt.substring(0, 15)}...": ${error.message}`, true);
                
                updateGalleryItem(newItem.id, { 
                    status: 'error', 
                    name: 'Error de Generación' 
                });
            }
        })();
    });
}


 
/**
 * Maneja el click en un item de la galería.
 * Decide si mostrar el editor 2D o el visor 3D.
 * @param {object} item - El item de la galería clickeado.
 */
async function handleGalleryItemClick(item) {
    if (item.status !== 'completed') return;
    if (currentSelectedId === item.id) return; // Ya seleccionado

    if (item.svgContent) {
        // Es un SVG o PNG, mostrar editor 2D
        showResultInPreview(item);
    } else if (item.model3d) {
        // Es un modelo 3D, mostrar visor 3D
        await show3DModelInPreview(item);
    }
}
/**
 * Maneja el click en el botón 'Editar' de un item de la galería.
 * @param {object} item - El item de la galería clickeado.
 */
function handleGalleryEditClick(item) {
    if (item.status !== 'completed') return;

    // 1. Carga el item en la vista previa (si no está ya cargado)
    if (currentSelectedId !== item.id) {
        handleGalleryItemClick(item);
    }
    
    // 2. Pre-popula y muestra el modal
    modalItemName.value = item.name;
    modalImprovePrompt.value = ""; 
    
    // 3. Mostrar/Ocultar campos según el tipo
    // ==================
    //  CAMBIO AQUÍ: Ocultar mejora si es PNG
    // ==================
    if (item.svgContent && !item.svgContent.startsWith('data:image/png')) {
        // Es 2D SVG
        modalImproveSection.style.display = 'block';
        modalImproveConfirm.style.display = 'block';
    } else {
        // Es 3D o 2D PNG
        modalImproveSection.style.display = 'none';
        modalImproveConfirm.style.display = 'none';
    }
    // ==================
    //  FIN DEL CAMBIO
    // ==================

    improveModal.classList.remove('hidden');
    
    // 4. Resetea el estado del modal (confirmación de borrado)
    modalDeleteConfirm.classList.add('hidden');
    modalImproveConfirm.parentElement.style.display = 'flex';
}

/**
 * Maneja el click en el botón 'Eliminar' de un item de la galería.
 * @param {object} item - El item de la galería clickeado.
 */
function handleGalleryDeleteClick(item) {
    if (!item || !item.id) return;

    // Usamos un confirm simple para la acción rápida de la galería
    if (confirm(`¿Estás seguro de que quieres eliminar "${item.name}"?`)) {
        
        if (currentSelectedId === item.id) {
            clearPreview();
        }

        svgGallery = svgGallery.filter(i => i.id !== item.id);
        saveGallery();
        renderGallery();

        showStatus("Item eliminado.", false);
    }
}


/**
 * Maneja el click en el botón de "Mejorar" dentro del modal (SOLO 2D SVG).
 */
async function handleImprove() {
    const improvePrompt = modalImprovePrompt.value;
    const newName = modalItemName.value;
    const selectedModel = modelSelect.value;
    
    const itemIdToImprove = currentSelectedId;
    const originalItem = svgGallery.find(i => i.id === itemIdToImprove);

    // ==================
    //  CAMBIO AQUÍ: Asegurar que es un SVG
    // ==================
    if (!originalItem || !originalItem.svgContent || originalItem.svgContent.startsWith('data:image/png')) {
        showStatus("Error: No se encontró el item SVG seleccionado para mejorar.", true);
        return;
    }
    // ==================
    //  FIN DEL CAMBIO
    // ==================


    // --- Caso 1: Solo renombrar (Sincrónico) ---
    if (!improvePrompt) {
        updateGalleryItem(itemIdToImprove, { name: newName });
        showStatus("Nombre actualizado.", false);
        improveModal.classList.add('hidden');
        return;
    }

    // --- Caso 2: Mejorar (Asincrónico, en cola) ---
    showStatus("Mejora añadida a la cola...", false);
    improveModal.classList.add('hidden');
    
    const originalSvgContent = originalItem.svgContent;

    updateGalleryItem(itemIdToImprove, {
        name: newName,
        prompt: improvePrompt,
        status: 'pending'
    });

    if (currentSelectedId === itemIdToImprove) {
        clearPreview();
    }

    (async () => {
        try {
            const result = await mejorarImagenDesdeSVG(originalSvgContent, improvePrompt, selectedModel);
            
            updateGalleryItem(itemIdToImprove, {
                svgContent: result.svgContent,
                status: 'completed'
            });

        } catch (error) {
            console.error("Error en handleImprove (background):", error);
            showStatus(`Error al mejorar: ${error.message}`, true);
            updateGalleryItem(itemIdToImprove, { 
                status: 'error',
                name: newName || originalItem.name
            });
        }
    })();
}

/**
 * Duplica el item seleccionado actualmente.
 */
function handleDuplicate() {
    if (!currentSelectedId) return;

    const originalItem = svgGallery.find(i => i.id === currentSelectedId);
    if (!originalItem) {
        showStatus("Error: No se encontró el item para duplicar.", true);
        return;
    }

    const newItem = {
        ...originalItem,
        id: Date.now().toString(),
        name: originalItem.name + " (Copia)"
    };

    addToGallery(newItem);
    showStatus("Item duplicado con éxito.", false);
    improveModal.classList.add('hidden');
}

/**
 * Muestra la confirmación de borrado dentro del modal.
 */
function showDeleteConfirmation() {
    modalImproveConfirm.parentElement.style.display = 'none';
    modalDeleteConfirm.classList.remove('hidden');
}

/**
 * Oculta la confirmación de borrado dentro del modal.
 */
function hideDeleteConfirmation() {
    modalImproveConfirm.parentElement.style.display = 'flex';
    modalDeleteConfirm.classList.add('hidden');
}

/**
 * Elimina permanentemente el item seleccionado.
 */
function handleDelete() {
    if (!currentSelectedId) return;

    svgGallery = svgGallery.filter(i => i.id !== currentSelectedId);
    saveGallery();
    renderGallery();

    showStatus("Item eliminado permanentemente.", false);
    improveModal.classList.add('hidden');
    hideDeleteConfirmation();
    clearPreview();
}


/**
 * Maneja la carga de un archivo JSON de galería.
 * @param {Event} event - El evento 'change' del input file.
 */
function handleGalleryUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (file.type !== 'application/json') {
        showStatus("Error: El archivo debe ser de tipo JSON.", true);
        return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            const uploadedItems = JSON.parse(content);

            if (!Array.isArray(uploadedItems)) {
                throw new Error("El JSON no es un array válido.");
            }

            const existingIds = new Set(svgGallery.map(item => item.id));
            let addedCount = 0;

            uploadedItems.forEach(item => {
                // Acepta items 2D (svgContent) o 3D (model3d)
                if (item && item.id && item.name && (item.svgContent || item.model3d)) { 
                    if (!existingIds.has(item.id)) {
                        svgGallery.push(item);
                        existingIds.add(item.id);
                        addedCount++;
                    }
                }
            });

            if (addedCount > 0) {
                saveGallery();
                renderGallery();
                showStatus(`Se añadieron ${addedCount} nuevos items a la galería.`, false);
            } else {
                showStatus("No se añadieron nuevos items (posiblemente ya existían).", false);
            }

        } catch (error) {
            console.error("Error al cargar JSON:", error);
            showStatus(`Error al leer el JSON: ${error.message}`, true);
        } finally {
            event.target.value = null;
        }
    };

    reader.onerror = () => {
        showStatus("Error al leer el archivo.", true);
        event.target.value = null;
    };

    reader.readAsText(file);
}


/**
 * Maneja el guardado de solo el nombre desde el modal.
 */
function handleRenameSave() {
    const newName = modalItemName.value;
    if (!newName) {
        showStatus("El nombre no puede estar vacío.", true);
        return;
    }
    
    if (currentSelectedId) {
        updateGalleryItem(currentSelectedId, { name: newName });
        showStatus("Nombre actualizado.", false);
        improveModal.classList.add('hidden');
    }
}

/**
 * Copia el SVG seleccionado al portapapeles.
 */
function handleCopySvg() {
    const item = svgGallery.find(i => i.id === currentSelectedId);
    
    // ==================
    //  CAMBIO AQUÍ: No copiar si es PNG
    // ==================
    if (currentMode !== '2d' || !item || !item.svgContent || item.svgContent.startsWith('data:image/png')) {
        showStatus("No hay código SVG para copiar (solo 2D SVG).", true);
        return;
    }
    // ==================
    //  FIN DEL CAMBIO
    // ==================


    const textarea = document.createElement('textarea');
    textarea.value = item.svgContent;
    textarea.style.position = 'fixed';
    textarea.style.opacity = 0;
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        // Usamos execCommand por compatibilidad en iFrames
        document.execCommand('copy');
        showStatus("¡SVG copiado al portapapeles!", false);
        
        const originalText = copySvgButton.textContent;
        copySvgButton.textContent = "¡Copiado!";
        setTimeout(() => {
            copySvgButton.textContent = originalText;
        }, 2000);

    } catch (err) {
        console.error('Error al copiar SVG:', err);
        showStatus("Error al copiar. Revisa la consola.", true);
    }
    
    document.body.removeChild(textarea);
}

 


/**
 * Copia el modelo 3D (GLTF JSON) seleccionado al portapapeles.
 */
async function handleCopy3DModel() {
    const item = svgGallery.find(i => i.id === currentSelectedId);
    
    if (currentMode !== '3d' || !item || !item.model3d || !item.model3d.data) {
        showStatus("No hay datos de modelo 3D para copiar.", true);
        return;
    }

    try {
        const modelString = JSON.stringify(item.model3d.data, null, 2); 

        // Usar un textarea y execCommand como fallback para iFrames
        const textarea = document.createElement('textarea');
        textarea.value = modelString;
        textarea.style.position = 'fixed';
        textarea.style.opacity = 0;
        document.body.appendChild(textarea);
        textarea.select();
    
        document.execCommand('copy');
        showStatus("¡GLTF JSON copiado al portapapeles!", false);
        
        document.body.removeChild(textarea);
        
        // Actualizar texto del botón temporalmente
        const originalText = copy3DModelButton.textContent;
        copy3DModelButton.textContent = "¡Copiado!";
        copy3DModelButton.disabled = true;
        
        setTimeout(() => {
            copy3DModelButton.textContent = originalText;
            copy3DModelButton.disabled = false;
        }, 2000);

    } catch (err) {
        console.error('Error al copiar GLTF JSON:', err);
        showStatus("Error al copiar. Revisa la consola.", true);
    }
}

 

/**
 * Descarga la galería completa como un archivo JSON.
 */
function handleDownloadGallery() {
    if (svgGallery.length === 0) {
        showStatus("No hay nada en la galería para descargar.", true);
        return;
    }

    const galleryToDownload = svgGallery.filter(item => item.status === 'completed');

    const jsonString = JSON.stringify(galleryToDownload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `galeria_svg_3d_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus("Galería JSON descargada.", false);
}

/**
 * Descarga el SVG o PNG seleccionado como un archivo.
 */
function handleDownloadSvg() {
    const item = svgGallery.find(i => i.id === currentSelectedId);
    if (currentMode !== '2d' || !item || !item.svgContent) {
        showStatus("No hay nada seleccionado para descargar.", true);
        return;
    }

    try {
        const a = document.createElement('a');
        const fileNameBase = (item.name || 'dibujo').replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // ==================
        //  CAMBIO AQUÍ: Manejar descarga de PNG
        // ==================
        if (item.svgContent.startsWith('data:image/png')) {
            // --- ES UN PNG ---
            a.href = item.svgContent;
            a.download = `${fileNameBase}.png`;
        } else {
            // --- ES UN SVG ---
            const svgString = item.svgContent;
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = `${fileNameBase}.svg`;
            
            // Limpiar la URL del blob después de la descarga
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        // ==================
        //  FIN DEL CAMBIO
        // ==================

        // Simular click
        document.body.appendChild(a);
        a.click();

        // Limpiar
        document.body.removeChild(a);

        showStatus("Descarga iniciada.", false);

    } catch (err) {
        console.error('Error al descargar:', err);
        showStatus("Error al descargar. Revisa la consola.", true);
    }
}

/**
 * Descarga el modelo 3D (GLTF JSON) actual como un archivo.
 */
async function handleDownload3DModel() {
    const item = svgGallery.find(i => i.id === currentSelectedId);

    if (currentMode !== '3d' || !item || !item.model3d) {
        showStatus("No hay un modelo 3D activo para descargar.", true);
        return;
    }

    showStatus("Preparando descarga GLB...", false);
    download3DModelButton.disabled = true;

    try {
        const glbData = await exportSceneToGLB(); 
        const blob = new Blob([glbData], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = (item.name || 'modelo_3d').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${fileName}.glb`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus("Modelo 3D (.glb) descargado.", false);

    } catch (err) {
        console.error('Error al descargar GLB:', err);
        showStatus("Error al descargar el GLB. Revisa la consola.", true);
    } finally {
        download3DModelButton.disabled = false;
    }
}
/**
 * Maneja el click en el botón "Eliminar Forma" (SOLO 2D SVG).
 */
function handleDeleteShape() {
    // ==================
    //  CAMBIO AQUÍ: Validar que sea un SVG
    // ==================
    const item = svgGallery.find(i => i.id === currentSelectedId);
    if (currentMode !== '2d' || !item || item.svgContent.startsWith('data:image/png')) {
        showStatus("Esta acción solo está disponible en el modo de edición de SVG 2D.", true);
        return;
    }
    // ==================
    //  FIN DEL CAMBIO
    // ==================
    
    if (deleteSelectedElement()) {
        showStatus("Forma eliminada.", false);
        // El guardado se gestiona automáticamente por el callback
    } else {
        showStatus("No hay ninguna forma 2D seleccionada.", true);
    }
}

// --- NUEVOS MANEJADORES DE EVENTOS 3D (ASÍNCRONOS) ---

/**
 * Inicia la generación de un modelo 3D desde el SVG actual.
 */
function handleGenerate3D() {
    const svgItem = svgGallery.find(i => i.id === currentSelectedId);
    const prompt = prompt3D.value;
    const selectedModel = modelSelect.value;
    
    if (!selectedModel) {
        showStatus("Error: No hay ningún modelo de IA seleccionado.", true);
        return;
    }

    // ==================
    //  CAMBIO AQUÍ: Validar que sea un SVG
    // ==================
    if (currentMode !== '2d' || !svgItem || (svgItem.svgContent && svgItem.svgContent.startsWith('data:image/png'))) {
        showStatus("Por favor, selecciona un dibujo SVG 2D primero.", true);
        return;
    }
    // ==================
    //  FIN DEL CAMBIO
    // ==================

    if (!prompt) {
        showStatus("Por favor, ingresa un prompt 3D (Ej: 'hazlo de metal rojo').", true);
        return;
    }

    generate3DButton.disabled = true; 
    edit3DButton.disabled = true;
    copy3DModelButton.disabled = true; 
    download3DModelButton.disabled = true; 
    
    showStatus("Añadido a la cola de generación 3D...", false);

    const newItem = {
        id: Date.now().toString(),
        name: svgItem.name + " (3D)",
        status: 'pending',
        _sourceSvgContent: svgItem.svgContent,
        _prompt3D: prompt,
        _model: selectedModel,
        _sourceSvgId: svgItem.id
    };

    addToGallery(newItem);
    prompt3D.value = "";

    generate3DButton.disabled = false;
    edit3DButton.disabled = false;
    copy3DModelButton.disabled = false;
    download3DModelButton.disabled = false;


    (async () => {
        try {
            const result = await generate3DModel(
                newItem._sourceSvgContent, 
                newItem._prompt3D, 
                newItem._model
            );

            updateGalleryItem(newItem.id, {
                status: 'completed',
                model3d: {
                    data: result.gltfJson,
                    sceneDescription: result.sceneDescription,
                    prompt: newItem._prompt3D,
                    sourceSvgId: newItem._sourceSvgId
                },
                _sourceSvgContent: undefined,
                _prompt3D: undefined,
                _model: undefined
            });

        } catch (error) {
            console.error("Error en handleGenerate3D (background):", error);
            showStatus(`Error al generar 3D: ${error.message}`, true);
            updateGalleryItem(newItem.id, { 
                status: 'error', 
                name: 'Error 3D',
                _sourceSvgContent: undefined, 
                _prompt3D: undefined, 
                _model: undefined 
            });
        }
    })();
}

function handleEdit3D() {
    const item = svgGallery.find(i => i.id === currentSelectedId);
    const prompt = prompt3D.value;
    const selectedModel = modelSelect.value;

    if (!selectedModel) {
        showStatus("Error: No hay ningún modelo de IA seleccionado.", true);
        return;
    }
    if (currentMode !== '3d' || !item || !item.model3d) {
        showStatus("Por favor, selecciona un modelo 3D para editar.", true);
        return;
    }
    if (!prompt) {
        showStatus("Por favor, ingresa un prompt 3D para la edición.", true);
        return;
    }
    
    const originalSceneDescription = item.model3d.sceneDescription;
    
    if (!originalSceneDescription) {
        showStatus("Error: Este modelo 3D es antiguo y no se puede editar.", true);
        console.warn("El item 3D no tiene 'sceneDescription' y no puede ser editado.", item);
        return;
    }
    
    const sourceSvgId = item.model3d.sourceSvgId;
    const sourceSvgItem = svgGallery.find(i => i.id === sourceSvgId);
    
    if (!sourceSvgItem || !sourceSvgItem.svgContent || sourceSvgItem.svgContent.startsWith('data:image/png')) {
        showStatus("Error: No se encontró el SVG 2D original. No se puede editar.", true);
        return;
    }
    const sourceSvgContent = sourceSvgItem.svgContent;

    generate3DButton.disabled = true;
    edit3DButton.disabled = true;
    copy3DModelButton.disabled = true;
    download3DModelButton.disabled = true;
    
    showStatus("Añadido a la cola de edición 3D...", false);

    const originalName = item.name;
    const originalModelData = item.model3d;

    updateGalleryItem(item.id, {
        name: item.name.replace(" (3D)", "") + " (Editando...)",
        status: 'pending'
    });
    
    if (currentSelectedId === item.id) {
        clearPreview();
    }

    generate3DButton.disabled = false;
    edit3DButton.disabled = false;
    copy3DModelButton.disabled = false;
    download3DModelButton.disabled = false;

    (async () => {
        try {
            const newModelResult = await edit3DModel(
                originalSceneDescription,
                sourceSvgContent,
                prompt,
                selectedModel
            );

            updateGalleryItem(item.id, {
                name: originalName.replace(" (3D)", "") + " (3D Editado)",
                status: 'completed',
                model3d: {
                    ...originalModelData,
                    data: newModelResult.gltfJson,
                    sceneDescription: newModelResult.sceneDescription,
                    prompt: prompt
                }
            });

        } catch (error) {
            console.error("Error en handleEdit3D (background):", error);
            showStatus(`Error al editar 3D: ${error.message}`, true);
            updateGalleryItem(item.id, {
                name: originalName,
                status: 'completed',
                model3d: originalModelData
            });
        }
    })();
}

// --- Inicialización ---

/**
 * Función principal que se ejecuta al cargar el DOM.
 */
function main() {
    // Asignar referencias DOM
    apiKeyInput = document.getElementById('apiKeyInput');
    modelSelect = document.getElementById('modelSelect');
    promptInput = document.getElementById('promptInput');
    generateButton = document.getElementById('generateButton');
    generateRealisticButton = document.getElementById('generateRealisticButton'); // <-- NUEVO
    copySvgButton = document.getElementById('copySvgButton');
    downloadSvgButton = document.getElementById('donwloadSvgButton');
    downloadGalleryButton = document.getElementById('downloadGalleryButton');
    uploadGalleryInput = document.getElementById('uploadGalleryInput');
    previewArea = document.getElementById('previewArea');
    statusMessage = document.getElementById('statusMessage');
    loader = document.getElementById('loader');
    actionsSection = document.getElementById('actionsSection');
    svgCode = document.getElementById('svgCode');
    svgCodeContainer = document.getElementById('svgCodeContainer');
    svgCodeWrapper = document.getElementById('svgCodeWrapper');
    galleryGrid = document.getElementById('galleryGrid');
    manualControls = document.getElementById('manualControls');
    deleteShapeButton = document.getElementById('deleteShapeButton');

    // --- NUEVAS REFERENCIAS 3D (MODIFICADAS) ---
    controls3DSection = document.getElementById('controls3DSection');
    prompt3D = document.getElementById('prompt3D');
    generate3DButton = document.getElementById('generate3DButton');
    edit3DButton = document.getElementById('edit3DButton');
    copy3DModelButton = document.getElementById('copy3DModelButton');
    download3DModelButton = document.getElementById('download3DModelButton');

    // Referencias del Modal
    improveModal = document.getElementById('improveModal');
    modalItemName = document.getElementById('modalItemName');
    modalImprovePrompt = document.getElementById('modalImprovePrompt');
    modalImproveSection = document.getElementById('modalImproveSection');
    modalImproveCancel = document.getElementById('modalImproveCancel');
    modalRenameSave = document.getElementById('modalRenameSave');
    modalImproveConfirm = document.getElementById('modalImproveConfirm');
    modalDuplicate = document.getElementById('modalDuplicate');
    modalDelete = document.getElementById('modalDelete');
    modalDeleteConfirm = document.getElementById('modalDeleteConfirm');
    modalDeleteConfirmBtn = document.getElementById('modalDeleteConfirmBtn');
    modalDeleteCancelBtn = document.getElementById('modalDeleteCancelBtn');


    // Cargar API key desde localStorage
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        initApiKeys(savedKey);
    }

    // Cargar galería
    initGallery();

    // --- Asignar eventos ---

    // Guardar API key al escribir
    apiKeyInput.addEventListener('input', () => {
        const key = apiKeyInput.value;
        initApiKeys(key);
        localStorage.setItem('geminiApiKey', key);
    });

    // Botones principales
    generateButton.addEventListener('click', handleGenerate);
    generateRealisticButton.addEventListener('click', handleGenerateRealistic); // <-- NUEVO
    copySvgButton.addEventListener('click', handleCopySvg);
    downloadSvgButton.addEventListener('click', handleDownloadSvg);
    downloadGalleryButton.addEventListener('click', handleDownloadGallery);
    uploadGalleryInput.addEventListener('change', handleGalleryUpload);
    deleteShapeButton.addEventListener('click', handleDeleteShape); 
    
    // --- NUEVOS EVENTOS 3D (MODIFICADOS) ---
    generate3DButton.addEventListener('click', handleGenerate3D);
    edit3DButton.addEventListener('click', handleEdit3D);
    copy3DModelButton.addEventListener('click', handleCopy3DModel);
    download3DModelButton.addEventListener('click', handleDownload3DModel);

    // Botones del Modal
    modalImproveCancel.addEventListener('click', () => {
        improveModal.classList.add('hidden');
        hideDeleteConfirmation();
    });
    modalRenameSave.addEventListener('click', handleRenameSave);
    modalImproveConfirm.addEventListener('click', handleImprove);
    modalDuplicate.addEventListener('click', handleDuplicate);
    
    // Flujo de borrado (dentro del modal)
    modalDelete.addEventListener('click', showDeleteConfirmation);
    modalDeleteCancelBtn.addEventListener('click', hideDeleteConfirmation);
    modalDeleteConfirmBtn.addEventListener('click', handleDelete);

    // Event listener para los controles manuales (Pan/Zoom 2D)
    manualControls.addEventListener('click', async (e) => {
        if (e.target.tagName !== 'BUTTON' || currentMode !== '2d') return;
        if (!currentSelectedId) return;
    
        const action = e.target.dataset.action;
        const itemIndex = svgGallery.findIndex(i => i.id === currentSelectedId);
    
        if (itemIndex === -1 || !svgGallery[itemIndex].svgContent || svgGallery[itemIndex].svgContent.startsWith('data:image/png')) return;
    
        const currentItem = svgGallery[itemIndex];
    
        // 1. Aplicar la manipulación
        const newSvgContent = manipulateViewBox(currentItem.svgContent, action);
    
        // 2. Actualizar el item en la galería
        updateGalleryItem(currentSelectedId, { svgContent: newSvgContent });
    
        // 3. Refrescar la vista previa
        showResultInPreview(svgGallery[itemIndex]);
    });
}

// Esperar a que el DOM esté listo para ejecutar la inicialización
document.addEventListener('DOMContentLoaded', main);