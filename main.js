// =================================================================
// ARCHIVO: main.js
// CONTIENE:
// 1. Lógica de la Interfaz de Usuario (DOM, Eventos)
// 2. Importación de módulos de lógica (generación, mejora)
// 3. Manejo de estado (API Key, Galería de SVGs)
// =================================================================

import { initApiKeys } from './apisistema.js';
import { svgToPngDataURL } from './svgeditar.js'; // <-- CAMBIO: Importamos el conversor de PNG
import { generarImagenDesdePrompt } from './svggeneracion.js';
import { mejorarImagenDesdeSVG } from './svgmejora.js';

// --- Variables de Estado ---
let svgGallery = [];
let currentSelectedId = null;
const GALLERY_STORAGE_KEY = 'svgGallery';

// --- Referencias a elementos DOM ---
let apiKeyInput, promptInput, generateButton,
    copySvgButton, previewArea, statusMessage, loader,
    modelSelect, galleryGrid, downloadGalleryButton, uploadGalleryInput,
    improveModal, modalItemName, modalImprovePrompt,
    modalImproveCancel, modalRenameSave, modalImproveConfirm,
    modalDuplicate, modalDelete,
    modalDeleteConfirm, modalDeleteConfirmBtn, modalDeleteCancelBtn,
    svgCode, svgCodeContainer, svgCodeWrapper, actionsSection;


// --- Funciones de la UI ---

/**
 * Muestra u oculta el overlay de carga global (para mejoras).
 * @param {boolean} isLoading - Si debe mostrarse el loader.
 */
function showLoader(isLoading) {
    if (isLoading) {
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
 * Muestra el resultado seleccionado en la UI principal.
 * @param {string} pngDataUrl - La Data URL de la imagen PNG.
 * @param {string} svgContent - El código XML del SVG.
 * @param {string} prompt - El prompt que generó la imagen.
 */
function showResultInPreview(pngDataUrl, svgContent, prompt) {
    previewArea.innerHTML = `<img src="${pngDataUrl}" alt="Vista previa de ${prompt}">`;
    svgCode.textContent = svgContent;
    
    actionsSection.classList.remove('hidden');
    svgCodeWrapper.classList.remove('hidden');
}

/**
 * Limpia el área de vista previa.
 */
function clearPreview() {
    previewArea.innerHTML = "<p>Aquí aparecerá tu dibujo...</p>";
    svgCode.textContent = "...";
    actionsSection.classList.add('hidden');
    svgCodeWrapper.classList.add('hidden');
    currentSelectedId = null;
}

// --- Funciones de Galería ---

/**
 * Carga la galería desde localStorage al iniciar.
 */
function initGallery() {
    const savedGallery = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (savedGallery) {
        // Los items guardados ya no tienen pngDataUrl, así que se cargan ligeros
        svgGallery = JSON.parse(savedGallery); 
        svgGallery = svgGallery.filter(item => item.status === 'completed' || item.status === 'error');
    }
    renderGallery();
}

/**
 * Guarda la galería actual en localStorage (sin los pngDataUrl).
 */
function saveGallery() {
    // <-- CAMBIO: Creamos una galería "limpia" solo para guardarla
    const galleryToSave = svgGallery.map(item => {
        // Copiamos el item, pero eliminamos el 'pngDataUrl'
        const { pngDataUrl, ...itemToSave } = item;
        return itemToSave;
    });

    try {
        // Guardamos la versión ligera
        localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(galleryToSave));
    } catch (error) {
        // Capturamos el error aquí si vuelve a pasar
        console.error("Error al guardar en localStorage (¿quizás aún está lleno?):", error);
        showStatus("Error al guardar la galería. El almacenamiento podría estar lleno.", true);
    }
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
        } else { // 'completed'
            // <-- CAMBIO: Ya no usamos item.pngDataUrl.
            // Creamos un Data URL para el *SVG* sobre la marcha.
            const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(item.svgContent);
            itemEl.innerHTML = `
                <img src="${svgDataUrl}" alt="${item.name}">
                <p class="gallery-item-name">${item.name}</p>
            `;
        }

        itemEl.addEventListener('click', () => handleGalleryItemClick(item));
        
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
async function handleGenerate() {
    const prompt = promptInput.value;
    const key = apiKeyInput.value; // Leemos el string completo
    const selectedModel = modelSelect.value;

    if (!prompt) {
        showStatus("Por favor, ingresa un prompt principal.", true);
        return;
    }
    if (!key) { // Comprobamos si el campo está vacío
        showStatus("Por favor, ingresa tu API Key (o keys).", true);
        return;
    }

    showStatus("Añadido a la cola de generación...", false);

    const newItem = {
        id: Date.now().toString(),
        name: prompt.substring(0, 30) + '...' || 'Nuevo SVG',
        prompt: prompt,
        status: 'pending',
        svgContent: '',
        pngDataUrl: '' // Se mantiene en memoria, pero no se guardará
    };

    addToGallery(newItem);
    promptInput.value = ""; 

    (async () => {
        try {
            const result = await generarImagenDesdePrompt(prompt, selectedModel);
            updateGalleryItem(newItem.id, {
                svgContent: result.svgContent,
                pngDataUrl: result.imagen, // <-- CAMBIO: Guardamos el PNG en memoria...
                status: 'completed'
            }); // ...pero saveGallery() lo filtrará
        } catch (error) {
            console.error("Error en handleGenerate (background):", error);
            // Mostramos el error del sistema de rotación
            showStatus(`Error al generar: ${error.message}`, true);
            updateGalleryItem(newItem.id, { status: 'error', name: 'Error de Generación' });
        }
    })();
}

/**
 * Maneja el click en un item de la galería (AHORA ASÍNCRONO).
 * @param {object} item - El item de la galería clickeado.
 */
async function handleGalleryItemClick(item) { // <-- CAMBIO: Convertida a async
    if (item.status !== 'completed') return;

    currentSelectedId = item.id;

    try {
        // <-- CAMBIO: Generamos el PNG al momento
        const pngDataUrl = await svgToPngDataURL(item.svgContent);
        
        // El pngDataUrl se usa aquí, pero no se guarda en el item
        showResultInPreview(pngDataUrl, item.svgContent, item.prompt);

        modalItemName.value = item.name;
        modalImprovePrompt.value = "";
        improveModal.classList.remove('hidden');
        
        modalDeleteConfirm.classList.add('hidden');
        modalImproveConfirm.parentElement.style.display = 'flex';

    } catch (error) {
        console.error("Error al generar PNG para la vista previa:", error);
        showStatus("Error al mostrar la vista previa.", true);
    }
}

/**
 * Maneja el click en el botón de "Mejorar" dentro del modal.
 */
async function handleImprove() {
    const improvePrompt = modalImprovePrompt.value;
    const newName = modalItemName.value;
    const selectedModel = modelSelect.value;
    
    const itemIdToImprove = currentSelectedId;
    const originalItem = svgGallery.find(i => i.id === itemIdToImprove);

    if (!originalItem) {
        showStatus("Error: No se encontró el item seleccionado.", true);
        return;
    }

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
                pngDataUrl: result.imagen, // Se guarda en memoria...
                status: 'completed'
            }); // ...y se filtra al guardar

        } catch (error) {
            console.error("Error en handleImprove (background):", error);
            // Mostramos el error del sistema de rotación
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
        // pngDataUrl se copia, pero se filtrará al guardar
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
                // Ya no esperamos 'pngDataUrl'
                if (item && item.id && item.name && item.svgContent) { 
                    if (existingIds.has(item.id)) {
                        // No hacer nada, saltar
                    } else {
                        svgGallery.push(item); // Se añade sin pngDataUrl
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

    // --- LA CORRECCIÓN ESTÁ AQUÍ ---
    reader.readAsText(file); // Era 'readText' y debe ser 'readAsText'
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
    if (!item || !item.svgContent) {
        showStatus("No hay código SVG para copiar.", true);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = item.svgContent;
    textarea.style.position = 'fixed';
    textarea.style.opacity = 0;
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
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
 * Descarga la galería completa como un archivo JSON.
 */
function handleDownloadGallery() {
    if (svgGallery.length === 0) {
        showStatus("No hay nada en la galería para descargar.", true);
        return;
    }

    const completedGallery = svgGallery.filter(item => item.status === 'completed');

    // <-- CAMBIO: Aplicamos la misma lógica de limpieza que en saveGallery()
    const galleryToDownload = completedGallery.map(item => {
        const { pngDataUrl, ...itemToDownload } = item;
        return itemToDownload;
    });

    // Usamos la galería limpia
    const jsonString = JSON.stringify(galleryToDownload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `galeria_svg_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus("Galería JSON descargada.", false);
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
    copySvgButton = document.getElementById('copySvgButton');
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

    // Referencias del Modal
    improveModal = document.getElementById('improveModal');
    modalItemName = document.getElementById('modalItemName');
    modalImprovePrompt = document.getElementById('modalImprovePrompt');
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
        initApiKeys(savedKey); // CAMBIO: Usamos el nuevo inicializador
    }

    // Cargar galería desde localStorage
    initGallery();

    // --- Asignar eventos ---

    // Guardar API key al escribir
    apiKeyInput.addEventListener('input', () => {
        const key = apiKeyInput.value;
        initApiKeys(key); // CAMBIO: Usamos el nuevo inicializador
        localStorage.setItem('geminiApiKey', key); // Seguimos guardando el string
    });

    // Botones principales
    generateButton.addEventListener('click', handleGenerate);
    copySvgButton.addEventListener('click', handleCopySvg);
    downloadGalleryButton.addEventListener('click', handleDownloadGallery);
    uploadGalleryInput.addEventListener('change', handleGalleryUpload);

    // Botones del Modal
    modalImproveCancel.addEventListener('click', () => {
        improveModal.classList.add('hidden');
        hideDeleteConfirmation();
    });
    modalRenameSave.addEventListener('click', handleRenameSave);
    modalImproveConfirm.addEventListener('click', handleImprove);
    modalDuplicate.addEventListener('click', handleDuplicate);
    
    // Flujo de borrado
    modalDelete.addEventListener('click', showDeleteConfirmation);
    modalDeleteCancelBtn.addEventListener('click', hideDeleteConfirmation);
    modalDeleteConfirmBtn.addEventListener('click', handleDelete);
}

// Esperar a que el DOM esté listo para ejecutar la inicialización
document.addEventListener('DOMContentLoaded', main);