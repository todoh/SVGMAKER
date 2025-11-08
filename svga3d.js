// =================================================================
// ARCHIVO: svga3d.js
// CONTIENE:
// 1. Lógica para renderizar con Three.js.
// 2. Funciones para construir una escena 3D (Extrusión o Primitivas)
//    basada en la respuesta de la IA.
// 3. Flujos de generación y edición de modelos 3D.
// =================================================================

// Importamos Three.js y los loaders/controles
import * as THREE from 'https://cdn.skypack.dev/three@0.135.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.135.0/examples/jsm/controls/OrbitControls.js';
import { SVGLoader } from 'https://cdn.skypack.dev/three@0.135.0/examples/jsm/loaders/SVGLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.135.0/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'https://cdn.skypack.dev/three@0.135.0/examples/jsm/exporters/GLTFExporter.js';

// Importamos la función de llamada a la API de Gemini
import { callGenerativeApi } from './svgeditar.js';

let renderer, scene, camera, controls;
let currentLoadedModel = null;
// --- ¡NUEVA FUNCIÓN DE ANÁLISIS ESTRUCTURAL! ---
/**
 * Analiza el contenido SVG y extrae información estructural simple.
 * Utiliza el SVGLoader existente para obtener información de paths.
 * @param {string} svgContent - El código SVG.
 * @returns {object | null} Un objeto con información estructural o null si falla.
 */
function analyzeSvgStructureSimple(svgContent) {
    try {
        const loader = new SVGLoader();
        const svgData = loader.parse(svgContent);
        
        const structure = {
            pathCount: svgData.paths.length,
            // Mapeamos los paths para obtener info útil para la IA
            paths: svgData.paths.map((path, index) => ({
                id: path.userData?.node?.id || `path_${index}`,
                color: `#${path.color.getHexString()}`
            })),
            viewBox: { 
                width: svgData.viewBox.maxX - svgData.viewBox.minX, 
                height: svgData.viewBox.maxY - svgData.viewBox.minY 
            }
        };
        return structure;
    } catch (e) {
        console.warn("No se pudo analizar la estructura SVG, continuando sin ella.", e);
        return null; // Continuar sin análisis si el SVG es inválido
    }
}


// --- ¡FUNCIÓN DE PROMPT MODIFICADA (EL "CEREBRO")! ---
/**
 * Crea el prompt para que la IA devuelva una descripción de escena 3D en JSON.
 * ¡ESTE ES EL NUEVO PROMPT MEJORADO!
 * @param {string} svgContent - El código SVG 2D (como contexto).
 * @param {string} svgStructureJson - El JSON de la estructura analizada.
 * @param {string} userPrompt - El prompt del usuario para el 3D.
 * @returns {string} El prompt para la API.
 */
function create3DScenePrompt(svgContent, svgStructureJson, userPrompt) {
    
    // Convertimos el objeto de estructura en un string JSON para el prompt
    const structureString = svgStructureJson 
        ? JSON.stringify(JSON.parse(svgStructureJson), null, 2) // Re-parsear para formateo limpio
        : "No se pudo analizar la estructura.";

    return `
        Eres un asistente de diseño 3D experto. Tu tarea es analizar un SVG 2D, su ESTRUCTURA JSON, y un prompt de usuario, y devolver un objeto JSON que describa una escena 3D para Three.js.

        SVG 2D (Contexto visual general):
        \`\`\`svg
        ${svgContent}
        \`\`\`

        ESTRUCTURA SVG (Contexto técnico):
        (Te dice cuántas partes (paths) tiene el SVG, sus colores e IDs)
        \`\`\`json
        ${structureString}
        \`\`\`

        PROMPT DE USUARIO: "${userPrompt}"

        TAREA:
        Analiza el SVG, su ESTRUCTURA y el prompt.
        - Decide si debes extruir las formas del SVG ("extrude_svg") o si es mejor RECONSTRUIRLO usando primitivas ("sphere", "box", "cylinder", "cone").
        - **¡NUEVA REGLA IMPORTANTE!** Si el SVG o el prompt describen un objeto orgánico (como un 'cactus', 'persona', 'árbol'), DEBES intentar reconstruirlo usando MÚLTIPLES primitivas posicionadas y escaladas. La extrusión simple se ve mal para estos casos.
        - Un cactus, por ejemplo, debería ser un 'cylinder' (tronco) y otros 'cylinder' (brazos) con \`scale\` para alargarlos, y muchos 'cone' pequeños (pinchos).
        - Puedes generar MÚLTIPLES objetos primitivos para formar una escena compleja.

        Devuelve un objeto JSON con una clave "objects". "objects" debe ser un array de objetos de escena.
        Cada objeto debe tener:
        1.  "type": (String) "extrude_svg", "sphere", "box", "cylinder", "cone". // ¡'cone' AÑADIDO!
        2.  "material": (Objeto) Con "color" (hex), "metalness" (0-1), "roughness" (0-1).
        3.  "geometry": (Objeto) Con los parámetros de la geometría:
            - type="extrude_svg": { "extrusionDepth": (Num), ... }
            - type="sphere": { "radius": (Num), ... }
            - type="box": { "width": (Num), ... }
            - type="cylinder": { "radiusTop": (Num), ... }
            - type="cone": { "radius": (Num), "height": (Num), "radialSegments": (Num) } // ¡'cone' AÑADIDO!
        4.  "position": (Objeto) { "x": 0, "y": 0, "z": 0 }
        5.  "scale": (Objeto, Opcional) { "x": 1, "y": 1, "z": 1 } // ¡'scale' AÑADIDO! Úsalo para alargar o achatar formas.

        REGLAS:
        -   Si el prompt pide "un logo de metal", usa "extrude_svg".
        -   **Si el prompt pide "un cactus", usa MÚLTIPLES 'cylinder' (con \`scale\` para alargarlos) y MÚLTIPLES 'cone' (para los pinchos).**
        -   Usa "extrude_svg" solo para cosas que deban ser planas (logos, texto, contornos 2D).

        Ejemplo para "haz este cactus en 3d" (asumiendo un SVG de cactus):
        {
          "objects": [
            {
              "type": "cylinder",
              "material": { "color": "#228B22", "metalness": 0.1, "roughness": 0.8 },
              "geometry": { "radiusTop": 20, "radiusBottom": 20, "height": 1, "radialSegments": 16 },
              "position": { "x": 0, "y": -50, "z": 0 },
              "scale": { "x": 1, "y": 150, "z": 1 } 
            },
            {
              "type": "cylinder",
              "material": { "color": "#228B22", "metalness": 0.1, "roughness": 0.8 },
              "geometry": { "radiusTop": 15, "radiusBottom": 15, "height": 1, "radialSegments": 16 },
              "position": { "x": 30, "y": 0, "z": 0 },
              "scale": { "x": 1, "y": 80, "z": 1 }
            },
            {
              "type": "cone",
              "material": { "color": "#FFFFE0", "metalness": 0, "roughness": 0.5 },
              "geometry": { "radius": 1, "height": 5, "radialSegments": 6 },
              "position": { "x": 10, "y": -40, "z": 20 }
            },
            {
              "type": "cone",
              "material": { "color": "#FFFFE0", "metalness": 0, "roughness": 0.5 },
              "geometry": { "radius": 1, "height": 5, "radialSegments": 6 },
              "position": { "x": -10, "y": -30, "z": -20 }
            }
          ]
        }

        Responde ÚNICAMENTE con el objeto JSON.
    `;
}


/**
 * Inicializa un visor 3D en el contenedor especificado.
 * (Esta función no cambia)
 */
export function init3DViewer(container) {
    clear3DViewer(container);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);
    const fov = 75;
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    camera.position.set(0, 0, 300);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    container.appendChild(renderer.domElement);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0];
        const { width, height } = entry.contentRect;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
    resizeObserver.observe(container);
}

/**
 * Limpia el visor 3D del contenedor.
 * (Esta función no cambia)
 */
export function clear3DViewer(container) {
    if (renderer) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
        if (scene) {
            while(scene.children.length > 0){ scene.remove(scene.children[0]); }
        }
        renderer = null;
        scene = null;
        camera = null;
        controls = null;
        currentLoadedModel = null; // <--- AÑADE ESTA LÍNEA
    }
}

// =================================================================
// ARCHIVO: svga3d.js
// ... (alrededor de la línea 200) ...
// =================================================================

// =================================================================
// ARCHIVO: svga3d.js
// ... (alrededor de la línea 204) ...
// =================================================================

export function renderModel(modelData) {
    // 1. Envolvemos todo en una nueva Promesa
    return new Promise((resolve, reject) => {
        if (!scene) {
            console.error("La escena 3D no está inicializada.");
            return reject(new Error("La escena 3D no está inicializada."));
        }
        
        // Limpia el modelo anterior si existe
        if (currentLoadedModel) {
            scene.remove(currentLoadedModel);
        }
        scene.children.filter(child => child.isMesh || child.isGroup).forEach(child => {
            scene.remove(child);
        });
        
        currentLoadedModel = null; // Resetea la referencia

        const loader = new GLTFLoader();
        loader.parse(JSON.stringify(modelData), '', (gltf) => {
            
            // ======================================================
            // AQUÍ ESTÁ LA CORRECCIÓN COMPLETA
            // ======================================================

            // ANTES: const modelGroup = gltf.scene.children[0];
            const model = gltf.scene; // <-- CAMBIO 1: Usar la escena completa

            if (model) { // <-- CAMBIO 2: Comprobar 'model' (no 'modelGroup')
                
                currentLoadedModel = model; // <-- CAMBIO 3: Asignar 'model' (no 'modelGroup')
                scene.add(currentLoadedModel);
                console.log("Modelo 3D (gltf.scene) cargado y guardado en 'currentLoadedModel'.", currentLoadedModel); // <-- CAMBIO 4 (Log)
                resolve(); 
            
            } else {
                console.error("GLTF Loader parseó la escena, pero no se encontró un modelo (gltf.scene)."); // <-- CAMBIO 5 (Log)
                currentLoadedModel = null;
                reject(new Error("GLTF Loader no encontró una escena.")); // <-- CAMBIO 6 (Error)
            }
            // ======================================================
            // FIN DE LA CORRECCIÓN
            // ======================================================

        }, (error) => {
            console.error('Error al parsear el GLTF:', error);
            currentLoadedModel = null;
            reject(error);
        });
    });
}

// --- ¡FUNCIÓN DE GENERACIÓN MODIFICADA (EL "PODER")! ---
/**
 * Flujo principal para generar un modelo 3D desde un SVG.
 * @param {string} svgContent - El código SVG.
 * @param {string} prompt - El prompt del usuario para guiar la extrusión/texturizado.
 * @param {string} model - El modelo de IA a utilizar (ej. 'gemini-2.5-pro').
 * @returns {Promise<object>} Una promesa que resuelve con los datos del modelo (ej. GLTF JSON).
 */
export async function generate3DModel(svgContent, prompt, model) {
    console.log(`Iniciando generación 3D con ${model}...`, { prompt });
    
    // --- ¡NUEVO PASO PREVIO! Analizar la estructura del SVG ---
    const svgStructure = analyzeSvgStructureSimple(svgContent);
    const svgStructureJson = svgStructure ? JSON.stringify(svgStructure) : null;
    console.log("Estructura SVG analizada:", svgStructureJson || "Ninguna");
    
    // --- PASO 1: Llamar a la IA para obtener la DESCRIPCIÓN DE ESCENA ---
    let aiParams;
    try {
        // ¡MODIFICADO! Pasamos la estructura a la función del prompt
        const apiPrompt = create3DScenePrompt(svgContent, svgStructureJson, prompt);
        
        aiParams = await callGenerativeApi(apiPrompt, model, true); // true = esperar JSON
        console.log("Descripción de escena 3D recibida de la IA:", aiParams);
        
        // Validar respuesta
        if (!aiParams || !aiParams.objects || !Array.isArray(aiParams.objects)) {
            throw new Error("La IA devolvió un JSON de descripción de escena inválido.");
        }
    } catch (error) {
        console.error("Error al llamar a la IA para parámetros 3D:", error);
        throw new Error(`Error de la IA: ${error.message}`);
    }

    // --- PASO 2: Construir la escena desde la descripción de la IA ---
    const group = new THREE.Group();
    
    // Parseamos el SVG solo si algún objeto lo pide
    const svgData = aiParams.objects.some(obj => obj.type === 'extrude_svg') 
        ? new SVGLoader().parse(svgContent) 
        : null;

    for (const obj of aiParams.objects) {
        // 1. Crear Material
        const material = new THREE.MeshStandardMaterial({
            color: obj.material.color || 0x808080,
            metalness: obj.material.metalness ?? 0.5,
            roughness: obj.material.roughness ?? 0.5
        });

        let geometry;
        let mesh;
        
        // 2. Crear Geometría
        switch (obj.type) {
            case 'extrude_svg':
                if (!svgData) {
                    console.warn("La IA pidió 'extrude_svg' pero el SVG no se pudo parsear o no se cargó.");
                    continue;
                }
                
                const geoParams = obj.geometry;
                const extrudeSettings = {
                    depth: geoParams.extrusionDepth || 20,
                    bevelEnabled: geoParams.bevelEnabled ?? true,
                    bevelSegments: 2,
                    steps: 1,
                    bevelSize: geoParams.bevelSize ?? 1,
                    bevelThickness: geoParams.bevelThickness ?? 1
                };
                
                const svgGroup = new THREE.Group();
                svgData.paths.forEach(path => {
                    const shapes = SVGLoader.createShapes(path);
                    shapes.forEach(shape => {
                        geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                        mesh = new THREE.Mesh(geometry, material);
                        svgGroup.add(mesh);
                    });
                });
                
                svgGroup.rotation.x = Math.PI; 
                svgGroup.scale.set(0.1, 0.1, 0.1);
                mesh = svgGroup;
                break;
                
            case 'sphere':
                geometry = new THREE.SphereGeometry(
                    obj.geometry.radius || 100,
                    obj.geometry.widthSegments || 32,
                    obj.geometry.heightSegments || 32
                );
                mesh = new THREE.Mesh(geometry, material);
                break;
                
            case 'box':
                geometry = new THREE.BoxGeometry(
                    obj.geometry.width || 100,
                    obj.geometry.height || 100,
                    obj.geometry.depth || 100
                );
                mesh = new THREE.Mesh(geometry, material);
                break;
            
             case 'cylinder':
                geometry = new THREE.CylinderGeometry(
                    obj.geometry.radiusTop || 50,
                    obj.geometry.radiusBottom || 50,
                    obj.geometry.height || 100,
                    obj.geometry.radialSegments || 32
                );
                mesh = new THREE.Mesh(geometry, material);
                break;
            
            // --- ¡NUEVO TIPO AÑADIDO! ---
            case 'cone':
                geometry = new THREE.ConeGeometry(
                    obj.geometry.radius || 5, // radio base
                    obj.geometry.height || 10, // altura
                    obj.geometry.radialSegments || 8 // pocos segmentos para pinchos
                );
                mesh = new THREE.Mesh(geometry, material);
                break;
                
            default:
                console.warn(`Tipo de objeto 3D desconocido: ${obj.type}`);
                continue;
        }
        
        // 3. Aplicar posición Y ESCALADO (¡MODIFICADO!)
        if (mesh) {
            // Aplicar posición
            mesh.position.set(
                obj.position.x || 0,
                obj.position.y || 0,
                obj.position.z || 0
            );

            // ¡NUEVO! Aplicar escalado si existe
            if (obj.scale) {
                mesh.scale.set(
                    obj.scale.x || 1,
                    obj.scale.y || 1,
                    obj.scale.z || 1
                );
            }

            group.add(mesh);
        }
    } // Fin del bucle for

    // --- PASO 3: Centrar el grupo ---
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center); // Centrar en el origen

    // --- PASO 4: Exportar a GLTF ---
    const exportScene = new THREE.Scene();
    exportScene.add(group);

    const exporter = new GLTFExporter();
    
    return new Promise((resolve, reject) => {
        exporter.parse(
            exportScene,
            (gltfJson) => {
                console.log("Exportación a GLTF completa.");
                resolve(gltfJson); // Devuelve el JSON del GLTF
            },
            (error) => {
                console.error('Error al exportar a GLTF:', error);
                reject(error);
            },
            { binary: false } // Exportar como JSON
        );
    });
}

/**
 * Flujo para editar un modelo 3D existente.
 * (Esta función no necesita cambios, ya que llama al
 * 'generate3DModel' actualizado, heredando las mejoras).
 * @param {object} modelData - El modelo GLTF JSON actual.
 * @param {string} sourceSvgContent - El SVG 2D original del que provino.
 * @param {string} prompt - El prompt de edición.
 * @param {string} model - El modelo de IA a utilizar.
 * @returns {Promise<object>} El nuevo modelo GLTF JSON.
 */
export async function edit3DModel(modelData, sourceSvgContent, prompt, model) {
    console.log(`Iniciando edición 3D con ${model}...`, { prompt });
    
    // La "edición" real es muy compleja.
    // Por ahora, re-generamos el modelo usando el SVG ORIGINAL
    // y el NUEVO prompt de edición.
    
    console.log("Re-generando el modelo 3D basado en el SVG original y el nuevo prompt...");

    if (!sourceSvgContent) {
        console.error("Error en edit3DModel: No se proporcionó el sourceSvgContent.");
        throw new Error("No se encontró el SVG 2D original para la edición.");
    }
    
    // Usamos el flujo de generación real, que AHORA incluye el análisis estructural.
    const newModel = await generate3DModel(
        sourceSvgContent, // <-- ¡Usa el SVG real!
        prompt,           // El nuevo prompt de edición
        model             // El modelo de IA seleccionado
    );
    
    return newModel;
}

 
/**
 * Exporta la escena 3D actual (visible) a un ArrayBuffer binario (GLB).
 * ¡VERSIÓN CORREGIDA PARA THREE.JS r132!
 * @returns {Promise<ArrayBuffer>} Una promesa que resuelve con el ArrayBuffer del GLB.
 */
export function exportSceneToGLB() {
    // 1. Verificaciones iniciales
    if (!scene || !currentLoadedModel) {
        console.error("Error de exportación: La escena o el modelo no están inicializados.", { scene, currentLoadedModel });
        return Promise.reject("La escena 3D o el modelo no están inicializados.");
    }
    
    // 2. Usar el modelo completo en lugar de solo el hijo[0]
    const meshContainer = currentLoadedModel;  // Exporta el root completo (gltf.scene)

    // 3. Verificación de seguridad
    if (!meshContainer) {
        console.error("Error de exportación: No se encontró el modelo cargado.", currentLoadedModel);
        return Promise.reject("El modelo cargado no está disponible.");
    }

    // Agregar logs de depuración para verificar el contenido
    console.log("MeshContainer para exportar:", meshContainer);
    console.log("Número de hijos en meshContainer:", meshContainer.children.length);
    if (meshContainer.children.length > 0) {
        console.log("Hijo[0] (grupo esperado):", meshContainer.children[0]);
        console.log("Número de meshes en el grupo:", meshContainer.children[0].children.length);
    }

    // 4. Creamos una escena temporal para la exportación
    const tempExportScene = new THREE.Scene();

    // 5. Movemos el modelo completo a la escena temporal
    tempExportScene.add(meshContainer);

    const exporter = new GLTFExporter();

    // 6. Creamos la promesa de exportación (sin onError callback para compatibilidad con r132)
    const exportPromise = new Promise((resolve, reject) => {
        try {
            exporter.parse(
                tempExportScene, // input
                (gltfBinary) => {
                    if (gltfBinary === undefined || !(gltfBinary instanceof ArrayBuffer)) {
                        console.error("Exportación fallida: No se recibió un ArrayBuffer válido.");
                        reject(new Error("Exportación no produjo datos binarios válidos."));
                        return;
                    }
                    console.log("Exportación a GLB completa. Tamaño del binario:", gltfBinary.byteLength, "bytes");
                    resolve(gltfBinary); // Devuelve el ArrayBuffer binario
                },
                { binary: true } // options (tercer argumento en r132)
            );
        } catch (error) {
            console.error('Error al exportar a GLB:', error);
            reject(error);
        }
    });

    // 7. Función para DEVOLVER el modelo a su padre original (la escena principal)
    const moveContainerBack = () => {
        scene.add(meshContainer);  // Lo devolvemos directamente a la escena principal
    };

    // 8. Retorno de la promesa, asegurando que el 'moveBack' se ejecute
    //    tanto si hay éxito como si hay error.
    return exportPromise.then(
        (gltfBinary) => {
            // ÉXITO: Devolver el contenedor
            moveContainerBack();
            return gltfBinary; // Devolvemos el resultado
        },
        (error) => {
            // ERROR: Devolver el contenedor
            moveContainerBack();
            throw error; // Lanzamos el error
        }
    );
}