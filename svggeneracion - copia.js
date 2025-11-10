// =================================================================
// ARCHIVO: svggeneracion.js
// CONTIENE:
// 1. Funciones para crear PROMPTS de GENERACIÓN
// 2. Flujos de GENERACIÓN de SVG (generarImagenDesdePrompt)
// 3. Otros flujos de generación (generarImagenesFaltantes, etc.)
// =================================================================

import { callGenerativeApi, svgToPngDataURL, extraerBloqueSVG } from './svgeditar.js';
import { mejorarImagenDesdeSVG } from './svgmejora.js';

/**
 * Flujo principal para generar una imagen desde un prompt de usuario.
 * @param {string} userPrompt - El prompt del usuario.
 * @param {string} [model] - El modelo de IA a usar.
 * @returns {Promise<{imagen: string, svgContent: string}>}
 */
export async function generarImagenDesdePrompt(userPrompt, model = 'gemini-2.5-flash-preview-09-2025') {
    if (!userPrompt) {
        throw new Error("El prompt de usuario no puede estar vacío.");
    }
    console.log(`[Generador Externo SVG] Iniciando para: "${userPrompt}" usando ${model}`);

    // PASO 1: Obtener el prompt detallado.
    const promptDetallado = await createUnifiedPrompt(userPrompt, model);
    console.log("[Generador Externo SVG] Prompt detallado recibido. Generando JSON y SVG...");

    // PASO 2: Generar el SVG inicial.
    const generatedData = await callGenerativeApi(promptDetallado, model, true);

    // PASO 2.5: Mejorar la imagen con un prompt de texturizado.
    console.log("[Generador Externo SVG] Detallando...");
    const generatedDataMejorada2 = await mejorarImagenDesdeSVG(generatedData.svgContent, 
    "Mejora la conexion entre los elementos del SVG y corrige las formas se vean naturales con lineas organicas y realistas.", 
    model);
    
    const { svgContent } = generatedDataMejorada2;
    if (!svgContent) {
        throw new Error("La respuesta de la IA para la generación externa no contenía 'svgContent'.");
    }

    console.log("[Generador Externo SVG] SVG recibido. Convirtiendo a PNG...");
    const pngDataUrl = await svgToPngDataURL(svgContent);
    
    return { imagen: pngDataUrl, svgContent: svgContent };
}

/**
 * Crea el prompt de generación unificado y clasificado.
 * @param {string} userPrompt - El prompt simple del usuario.
 * @param {string} model - El modelo de IA a usar.
 * @returns {Promise<string>} El prompt detallado para la IA.
 */
async function createUnifiedPrompt(userPrompt, model) {
    console.log("[Clasificación Avanzada] Iniciando análisis del prompt...");

    const classificationPrompt = `
        Analiza el siguiente prompt de usuario y clasifícalo en UNA de las siguientes categorías: 
        'personaje', 'animal', 'arbol', 'planta-no-arbol', 'coche', 'bicicleta', 'motocicleta', 'avion', 'helicoptero', 'barco', 'edificio', 'objeto', 'paisaje', 'logo', 'abstracto'.
        Responde ÚNICAMENTE con la palabra de la categoría.

        PROMPT: "${userPrompt}"

        CATEGORÍA:
    `;
    
    const elementType = await callGenerativeApi(classificationPrompt, model, false);
    const tipoElemento = elementType.trim().toLowerCase();
    console.log(`[Clasificación Avanzada] Elemento detectado: ${tipoElemento}`);

    let specificInstructions = '';
    // (El switch/case gigante va aquí)
    switch (tipoElemento) {
        case 'personaje':
        specificInstructions = `
            **Filosofía de Diseño y Estilo OBLIGATORIA:**
            El objetivo es crear un personaje **humanoide** con un estilo de animación moderno, orgánico y fluido. La clave es mantener **proporciones anatómicas realistas y creíbles** (cabeza, cuello, torso, extremidades) adaptadas a un estilo de dibujo limpio y estilizado. Las líneas deben ser suaves y definir una silueta clara y recognizable.

            **Instrucciones de Dibujo OBLIGATORIAS:**

            1.  **Silueta y Proporciones Humanoides:**
                * Dibuja SIEMPRE el personaje de cuerpo entero con una postura clara y natural.
                * La anatomía debe ser la de un ser humano. Presta especial atención a la relación entre hombros y caderas, la presencia de un cuello definido y la forma en que las extremidades se conectan al torso.
                * La silueta general debe ser lo primero que se defina y debe ser anatómicamente coherente.

            2.  **Anatomía Fluida pero Definida:**
                * Usa **curvas suaves y elegantes (comandos C, S, Q en paths SVG)** para delinear el cuerpo.
                * Los brazos y las piernas deben tener una forma cónica y orgánica, más anchos donde se conectan al torso y más delgados hacia las manos y los pies. Evita las "extremidades de fideo" (grosor uniforme).
                * Aunque el estilo es simplificado, insinúa la estructura subyacente (codos, rodillas, pantorrillas, hombros) a través de cambios sutiles en la curvatura de las líneas, no con círculos o ángulos.

            3.  **Rostro Detallado y Expresivo:**
                * El rostro es el foco emocional. DEBE ser visible, detallado y tener una expresión clara que coincida con la descripción del prompt.
                * Dibuja ojos, nariz y boca que formen un conjunto armónico y estén correctamente situados en la cabeza.

            4.  **Vestimenta y Accesorios Integrados:**
                * La ropa debe envolver la forma del cuerpo, siguiendo sus curvas y volúmenes. Usa pliegues y superposiciones para dar sensación de tela y profundidad.
                * Los accesorios deben estar correctamente posicionados y escalados con respecto al cuerpo.

            5.  **Estructura SVG de Referencia (Guía de Estilo Humanoide):**
                * **Utiliza la siguiente estructura SVG como BASE y GUÍA DE ESTILO.**
                * **NO COPIES los atributos "d" exactos.** En su lugar, usa este modelo para entender cómo construir una forma humanoide creíble con curvas suaves.
                * Adapta, modifica y deforma estas formas base para ajustarlas al género, la complexión, la ropa y la postura que se describen en el prompt.

            <svg width="512" height="512" viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg">
                        .body-part { stroke: #444; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
            .major-muscle { fill: #E0E0E0; }
            .minor-muscle { fill: #D0D0D0; }
            .joints { fill: #BDBDBD; }
            .core-body { fill: #ECECEC; }
            .face-lines { stroke: #BDBDBD; stroke-width: 1; }
            /* --- Nuevos Estilos --- */
            .hair { fill: #A0522D; stroke: #444; stroke-width: 1; }
            .hat { fill: #594D43; }
            .hat-band { fill: #332C26; }
                        <g id="dummy-anatomico-completo">
            <!-- --- Cabeza --- -->
            <g id="cabeza">
                <title>Cabeza</title>
                <path class="body-part core-body" d="M150,20 C169.3,20 185,35.7 185,55 C185,74.3 169.3,90 150,90 C130.7,90 115,74.3 115,55 C115,35.7 130.7,20 150,20 Z" />
                <g id="frente"><title>Frente</title><path style="fill:none; stroke:none;" d="M125,40 C135,35, 165,35, 175,40 L175,55 L125,55 Z" /></g>
                <g id="cuero-cabelludo"><title>Cuero cabelludo</title><path style="fill:none; stroke:none;" d="M115,55 C115,35.7 130.7,20 150,20 C169.3,20 185,35.7 185,55" /></g>
                <path class="face-lines" d="M150,45 L150,65 M135,55 L165,55" />
                <g id="pelo" class="hair"><title>Pelo</title><path d="M116,56 C105,40 120,20 150,18 C180,20 195,40 184,56 C170,45 130,45 116,56 Z" /></g>

                <g id="sombrero" class="body-part"><title>Sombrero</title><path class="hat" d="M105,45 C100,35 200,35 195,45 C190,55 110,55 105,45 Z"/><path class="hat" d="M120,44 C118,30 182,30 180,44 Z"/><path class="hat" d="M120,32 C120,15 180,15 180,32 L120,32 Z"/><path class="hat-band" d="M120,44 C118,38 182,38 180,44 L182,42 C182,36 118,36 118,42 Z"/></g>G>
            </g>
            
            <!-- --- Cuerpo con Diseño Anatómico Mejorado --- -->
            <g id="cuello"><title>Cuello</title><path class="body-part minor-muscle" d="M142,88 L158,88 L162,105 L138,105 Z" /></g>
            <g id="tronco"><title>Tronco</title>
                <g id="pecho"><title>Pecho</title><path class="body-part major-muscle" d="M150,105 C125,108 115,130 120,150 L150,152 Z" /><path class="body-part major-muscle" d="M150,105 C175,108 185,130 180,150 L150,152 Z" /></g>
                <g id="abdomen"><title>Abdomen</title><path class="body-part core-body" d="M120,150 L180,150 L170,200 L130,200 Z" /></g>
                <g id="cintura"><title>Cintura</title><path class="body-part core-body" d="M130,200 L170,200 L180,215 L120,215 Z" /></g>
                <g id="cadera"><title>Cadera</title><path class="body-part core-body" d="M120,215 L180,215 L175,240 C150,245 150,245 125,240 Z" /></g>
            </g>
            <g id="brazo-derecho"><title>Brazo Derecho</title>
                <g id="hombro-derecho"><title>Hombro Derecho</title><path class="body-part major-muscle" d="M180,108 C198,115 205,130 198,145 C190,130 180,120 180,108 Z" /></g>
                <g id="brazo-superior-derecho"><title>Brazo Superior Derecho</title><path class="body-part minor-muscle" d="M190,125 L215,160 L205,168 L182,135 Z" /></g>
                <g id="codo-derecho"><title>Codo Derecho</title><circle class="body-part joints" cx="218" cy="163" r="6" /></g>
                <g id="antebrazo-derecho"><title>Antebrazo Derecho</title><path class="body-part minor-muscle" d="M210,170 L240,200 L235,208 L205,175 Z" /></g>
                <g id="mano-derecha"><title>Mano Derecha</title><path class="body-part minor-muscle" d="M238,208 C255,208 260,225 245,230 C230,235 230,215 238,208 Z" /></g>
            </g>
            <g id="brazo-izquierdo"><title>Brazo Izquierdo</title>
                <g id="hombro-izquierdo"><title>Hombro Izquierdo</title><path class="body-part major-muscle" d="M120,108 C102,115 95,130 102,145 C110,130 120,120 120,108 Z" /></g>
                <g id="brazo-superior-izquierdo"><title>Brazo Superior Izquierdo</title><path class="body-part minor-muscle" d="M110,125 L85,160 L95,168 L118,135 Z" /></g>
                <g id="codo-izquierdo"><title>Codo Izquierdo</title><circle class="body-part joints" cx="82" cy="163" r="6" /></g>
                <g id="antebrazo-izquierdo"><title>Antebrazo Izquierdo</title><path class="body-part minor-muscle" d="M90,170 L60,200 L65,208 L95,175 Z" /></g>
                <g id="mano-izquierda"><title>Mano Izquierda</title><path class="body-part minor-muscle" d="M62,208 C45,208 40,225 55,230 C70,235 70,215 62,208 Z" /></g>
            </g>
            <g id="pierna-derecha"><title>Pierna Derecha</title>
                <g id="muslo-derecho"><title>Muslo Derecho</title><path class="body-part major-muscle" d="M158,242 L180,300 L165,308 L150,244 Z" /></g>
                <g id="rodilla-derecha"><title>Rodilla Derecha</title><circle class="body-part joints" cx="178" cy="303" r="8" /></g>
                <g id="pantorrilla-derecha"><title>Pantorrilla Derecha</title><path class="body-part minor-muscle" d="M172,310 L185,360 L170,365 L165,312 Z" /></g>
                <g id="pie-derecho"><title>Pie Derecho</title><path class="body-part minor-muscle" d="M178,368 L205,370 L190,385 L173,380 Z" /></g>
            </g>
            <g id="pierna-izquierda"><title>Pierna Izquierda</title>
                <g id="muslo-izquierdo"><title>Muslo Izquierdo</title><path class="body-part major-muscle" d="M142,242 L120,300 L135,308 L150,244 Z" /></g>
                <g id="rodilla-izquierda"><title>Rodilla Izquierda</title><circle class="body-part joints" cx="122" cy="303" r="8" /></g>
                <g id="pantorrilla-izquierda"><title>Pantorrilla Izquierda</title><path class="body-part minor-muscle" d="M128,310 L115,360 L130,365 L135,312 Z" /></g>
                <g id="pie-izquierdo"><title>Pie Izquierdo</title><path class="body-part minor-muscle" d="M122,368 L95,370 L110,385 L127,380 Z" /></g>
            </g>
        </g>
                    </svg>
    Manten la cara libre de sombras y cuida que el pelo o los adcesorios no la tapen.  `; 
        break;

            case 'animal':
                specificInstructions = `
                    **Tipo de Elemento:** Animal.
                    **Instrucciones de Dibujo OBLIGATORIAS:**
                    1.  **Sub-Clasificación:** Identifica el tipo de animal y sigue las guías:
                        - **Cuadrúpedos (perro, león, caballo):** Enfócate en la musculatura, la estructura ósea de las patas y una pose natural.
                        - **Aves (águila, gorrión):** Detalla el plumaje, la forma de las alas (en reposo o en vuelo) y el pico.
                        - **Peces (pez payaso, tiburón):** Dibuja escamas con patrones, aletas translúcidas y el brillo del agua sobre el cuerpo.
                        - **Reptiles (serpiente, lagarto):** Simula la textura de las escamas y la piel, y una pose característica de su especie.
                        - **Insectos (mariposa, abeja):** Presta atención a los detalles: antenas, patas segmentadas, patrones en las alas.
                    2.  **Anatomía Específica:** Respeta rigurosamente la anatomía de la especie.
                    3.  **Textura y Pelaje:** Usa degradados y patrones SVG para simular pelaje, plumas o escamas de forma realista.
                `;
                break;
            case 'planta-no-arbol':
                specificInstructions = `
                    **Tipo de Elemento:** Planta/Vegetación.
                    **Instrucciones de Dibujo OBLIGATORIAS:**
                    1.  **Sub-Clasificación:** Identifica el tipo de planta y sigue las guías:
                         - **Flores:** Dibuja un tallo definido, hojas con sus nervaduras y pétalos con volumen, color y degradados sutiles. Cada parte debe estar conectada.
                        - **Arbustos/Matorrales:** Crea una masa densa de hojas y ramas, mostrando profundidad con hojas más oscuras en el interior.
                    2.  **Estructura Botánica:** Todas las partes deben estar conectadas de forma natural.
                `;
                break;

    case 'arbol':
        specificInstructions = `
            **Tipo de Elemento:** Árbol.
            **Instrucciones de Dibujo OBLIGATORIAS:**
            1.  **Estructura Jerárquica:** El árbol debe tener una estructura clara y lógica.
                - **Tronco:** Dibuja un tronco robusto que se ensancha en la base. Usa líneas para simular la textura de la corteza.
                - **Ramas Principales:** Desde el tronco, dibuja de 2 a 5 ramas principales. Deben ser más gruesas en la base y adelgazarse hacia las puntas.
                - **Ramas Secundarias:** De cada rama principal deben nacer varias ramas secundarias, más delgadas que las principales.
                - **Ramas Terciarias/Ramitas:** De las ramas secundarias, dibuja ramitas aún más finas. Son la estructura que soportará las hojas.
            2.  **Follaje (Hojas):**
                - Las hojas deben agruparse en cúmulos (grupos de follaje) alrededor de las ramas terciarias.
                - No dibujes hojas individuales flotando, deben estar conectadas visualmente a las ramitas.
                - Varía la densidad y el tamaño de los cúmulos de hojas para dar un aspecto más natural y con profundidad.
            3.  **Conexión Orgánica:** Todas las partes del árbol (tronco, ramas, ramitas) deben estar conectadas de forma fluida y natural, sin interrupciones abruptas.
        4. Sigue la estructura de la planta, siguiendo las guías de anatomía y cuidando de dar un aspecto natural y realista.
        5. Usa este svg como base para la construcción de tu obra de arte:
        
        <svg width="512" height="512" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <style>
            .trunk { fill: #8B4513; stroke: #5A2D0C; stroke-width: 2; }
            .main-branch { fill: #8B4513; stroke: #5A2D0C; stroke-width: 1.5; }
            .secondary-branch { stroke: #5A2D0C; stroke-width: 1; }
            .twig { stroke: #5A2D0C; stroke-width: 0.5; }
            .foliage { fill: #228B22; stroke: #1A681A; stroke-width: 0.5; opacity: 0.85; }

            /* --- Efectos Interactivos --- */
            #tree-example g:hover > .foliage {
                fill: #3CB371; /* Verde más claro al pasar el cursor */
                cursor: pointer;
                opacity: 1;
            }
            #tree-example g:hover > .trunk,
            #tree-example g:hover > .main-branch {
                fill: #A0522D; /* Marrón más claro */
                cursor: pointer;
            }
        </style>

        <g id="tree-example">
            <title>Árbol Detallado</title>

            <!-- --- Tronco y Ramas Principales --- -->
            <g id="estructura-principal">
                <title>Tronco y Ramas Principales</title>
                <path id="tronco" class="trunk" d="M200,380 Q195,300 200,250 T205,180" />
                
                <g id="ramas-principales">
                    <!-- Rama Principal Izquierda -->
                    <path id="rama-p-1" class="main-branch" d="M202,220 Q150,200 120,150" />
                    <!-- Rama Principal Derecha -->
                    <path id="rama-p-2" class="main-branch" d="M204,210 Q250,190 280,160" />
                    <!-- Rama Principal Central -->
                    <path id="rama-p-3" class="main-branch" d="M204,185 Q200,150 210,120" />
                </g>
            </g>

            <!-- --- Ramas Secundarias y Terciarias --- -->
            <g id="estructura-secundaria">
                <title>Ramas Secundarias y Terciarias</title>
                <!-- Ramas de la rama p-1 -->
                <path id="rama-s-1-1" class="secondary-branch" d="M148,178 Q110,170 90,140" />
                <path id="ramita-1-1-1" class="twig" d="M100,145 Q85,130 95,115" />
                <path id="rama-s-1-2" class="secondary-branch" d="M125,155 Q140,130 130,110" />
                <path id="ramita-1-2-1" class="twig" d="M132,115 Q125,100 135,95" />

                <!-- Ramas de la rama p-2 -->
                <path id="rama-s-2-1" class="secondary-branch" d="M255,170 Q280,150 290,130" />
                <path id="ramita-2-1-1" class="twig" d="M285,135 Q295,120 280,110" />
                <path id="rama-s-2-2" class="secondary-branch" d="M275,162 Q260,140 250,120" />
                <path id="ramita-2-2-1" class="twig" d="M252,125 Q240,110 255,100" />
                
                <!-- Ramas de la rama p-3 -->
                <path id="rama-s-3-1" class="secondary-branch" d="M208,125 Q190,110 180,90" />
                <path id="ramita-3-1-1" class="twig" d="M182,95 Q170,80 185,75" />
                <path id="rama-s-3-2" class="secondary-branch" d="M210,122 Q220,100 230,80" />
                <path id="ramita-3-2-1" class="twig" d="M228,85 Q240,70 230,60" />
            </g>

            <!-- --- Follaje / Cúmulos de Hojas --- -->
            <g id="follaje">
                <title>Follaje</title>
                <!-- Hojas alrededor de ramita 1-1-1 -->
                <path class="foliage" d="M95,120 C75,125 70,105 90,100 C110,95 115,115 95,120 Z" />
                <!-- Hojas alrededor de ramita 1-2-1 -->
                <path class="foliage" d="M135,100 C120,105 115,85 135,80 C155,85 150,105 135,100 Z" />
                <!-- Hojas alrededor de ramita 2-1-1 -->
                <path class="foliage" d="M280,115 C265,120 260,100 280,95 C300,100 295,120 280,115 Z" />
                <!-- Hojas alrededor de ramita 2-2-1 -->
                <path class="foliage" d="M255,105 C235,110 230,90 250,85 C270,90 270,110 255,105 Z" />
                <!-- Hojas alrededor de ramita 3-1-1 -->
                <path class="foliage" d="M185,80 C165,85 160,65 180,60 C200,65 200,85 185,80 Z" />
                <!-- Hojas alrededor de ramita 3-2-1 -->
                <path class="foliage" d="M230,65 C210,70 215,50 235,45 C255,50 250,70 230,65 Z" />
                <!-- Cúmulo central grande -->
                <path class="foliage" d="M210,90 C180,95 170,70 210,60 C250,70 240,95 210,90 Z" />
            </g>
        </g>
    </svg>

        
            `;
        break;
            // ... (otros casos del switch: 'coche', 'bicicleta', etc.)
            // ... (estos son idénticos a los del archivo original, así que se copian)
            case 'coche':
                specificInstructions = `
                    **Tipo de Elemento:** Coche.
                    **Instrucciones de Dibujo OBLIGATORIAS:**
                    1.  **Estructura y Proporciones:** Dibuja la carrocería con proporciones correctas y líneas de diseño claras.
                    2.  **Detalles Clave:** Incluye ruedas con llantas detalladas, ventanas y parabrisa- ... (existing code, not shown)
            <g id="coche-completo">
                <g id="sombra-suelo"><title>Sombra del Coche</title><ellipse cx="300" cy="350" rx="220" ry="25" fill="#000" opacity="0.2"/></g>
                <g id="chasis"><title>Chasis</title><path class="car-body" d="M50,340 L50,220 C60,180 120,170 150,170 L450,180 C520,185 550,220 550,250 L550,340 Z" fill="url(#grad-car-body)" stroke="#222" stroke-width="2"/><path class="rocker-panel" d="M195,340 L415,340 L410,350 L200,350 Z" fill="#444" /></g>
                <g id="cabina"><title>Cabina y Ventanas</title><path class="windows" d="M160,172 L280,170 L380,175 L420,220 L180,220 Z" fill="url(#grad-windows)" stroke="#111" stroke-width="1.5"/><path class="pillars" d="M280,170 L285,220" stroke="#555" stroke-width="4" fill="none"/><g id="limpiaparabrisas" transform="translate(390, 220) rotate(-15)"><rect width="50" height="3" fill="#222" /><rect y="-5" width="50" height="2" fill="#333" /></g></g>
                <g id="ruedas"><title>Ruedas</title><g id="rueda-trasera"><title>Rueda Trasera</title><circle cx="150" cy="320" r="45" fill="#282828"/><g id="llanta-trasera" transform="translate(150, 320)"><circle r="38" fill="#DDD" stroke="#888" stroke-width="2"/><path d="M 0 -35 L 0 35 M -35 0 L 35 0 M -25 -25 L 25 25 M -25 25 L 25 -25" stroke="#999" stroke-width="3"/><circle r="10" fill="#BBB" stroke="#888"/></g><circle cx="150" cy="320" r="44" fill="url(#grad-rim-shine)" opacity="0.4"/></g><g id="rueda-delantera"><title>Rueda Delantera</title><circle cx="460" cy="320" r="45" fill="#282828"/><g id="llanta-delantera" transform="translate(460, 320)"><circle r="38" fill="#DDD" stroke="#888" stroke-width="2"/><path d="M -10 -35 A 35 35 0 0 1 10 -35 L 5 -25 A 25 25 0 0 0 -5 -25 Z" fill="darkred"/><path d="M 0 -35 L 0 35 M -35 0 L 35 0 M -25 -25 L 25 25 M -25 25 L 25 -25" stroke="#999" stroke-width="3"/><circle r="10" fill="#BBB" stroke="#888"/></g><circle cx="460" cy="320" r="44" fill="url(#grad-rim-shine)" opacity="0.4"/></g></g>
                <g id="frontal"><title>Parte Frontal</title><g id="parrilla-frontal" transform="skewX(-15) translate(25, 0)"><rect x="460" y="240" width="80" height="40" rx="5" fill="#333" stroke="#111"/><line x1="465" y1="250" x2="535" y2="250" stroke="#777" stroke-width="2"/><line x1="465" y1="260" x2="535" y2="260" stroke="#777" stroke-width="2"/><line x1="465" y1="270" x2="535" y2="270" stroke="#777" stroke-width="2"/></g><g id="faro-delantero"><path d="M545,210 L500,205 C490,220 530,230 545,220 Z" fill="url(#grad-headlight)" stroke="#555" filter="url(#glow)"/></g><g id="parachoques-delantero"><path d="M480,340 L550,340 L565,320 L485,315 Z" fill-opacity="0.1" fill="#FFF" /><rect x="495" y="295" width="50" height="15" fill="#222" rx="3" transform="skewX(-15)"/></g></g>
                <g id="trasera"><title>Parte Trasera</title><g id="luz-trasera"><path d="M55,230 L80,235 L85,255 L58,250 Z" fill="#C00" stroke="#A00" stroke-width="1" filter="url(#glow)"/></g><g id="tubo-escape"><ellipse cx="90" cy="345" rx="15" ry="5" fill="#777" stroke="#222"/></g></g>
                <g id="detalles-laterales"><title>Detalles Laterales</title><g id="manilla-puerta"><rect x="295" y="235" width="40" height="8" rx="3" fill="#444" stroke="#222" stroke-width="0.5"/></g><g id="espejo-retrovisor"><path d="M165,215 L150,210 L155,195 L170,200 Z" fill="url(#grad-car-body)" stroke="#222"/></g><path d="M70,260 C200,250 400,265 520,270" stroke="#888" stroke-width="2" fill="none" opacity="0.4"/><g id="antena"><line x1="120" y1="175" x2="100" y2="120" stroke="#333" stroke-width="2"/></g></g>
        </g>
    </svg>
                `;
                break;
            case 'bicicleta':
                specificInstructions = `
                    **Tipo de Elemento:** Bicicleta.
                    **Instrucciones de Dibujo OBLIGATORIAS:**
                    1.  **Estructura del Cuadro:** Dibuja el cuadro, el manillar, el sillín y los pedales con precisión.
                    2.  **Ruedas Detalladas:** Las ruedas deben tener radios finos y visibles, conectando el buje con la llanta.
                    3.  **Componentes:** Incluye la cadena, los platos y los piñones si la vista lo permite.
                    4.  **Líneas Limpias:** Utiliza trazos finos y definidos para una apariencia técnica y ligera.
                    5. usa esta estructura para la bicicleta:
                    <svg width="512" height="512" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad-metal-frame" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:rgb(180,180,190);stop-opacity:1" /><stop offset="100%" style="stop-color:rgb(100,100,110);stop-opacity:1" /></linearGradient>
            <linearGradient id="grad-rubber-tire" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:rgb(60,60,60);stop-opacity:1" /><stop offset="100%" style="stop-color:rgb(40,40,40);stop-opacity:1" /></linearGradient>
        </defs>
        <g id="bicicleta-completa">
            <g id="cuadro" fill="none" stroke="url(#grad-metal-frame)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><title>Cuadro de la Bicicleta</title><path d="M 200 130 L 400 120 L 280 280 Z" /><line x1="280" y1="280" x2="200" y2="130" /><path d="M 280 280 L 120 300 L 200 130" /></g>
            <g id="direccion"><title>Dirección</title><path id="horquilla" d="M 400 120 L 480 300" stroke="url(#grad-metal-frame)" stroke-width="10" fill="none" stroke-linecap="round" /><line id="potencia" x1="400" y1="120" x2="430" y2="100" stroke="url(#grad-metal-frame)" stroke-width="8" /><path id="manillar" d="M 410 85 L 450 115" stroke="url(#grad-metal-frame)" stroke-width="7" fill="none" stroke-linecap="round" /><g id="puños"><title>Puños</title><circle cx="408" cy="84" r="5" fill="#333"/><circle cx="452" cy="116" r="5" fill="#333"/></g></g>
            <g id="sillin-y-tija"><title>Sillín y Tija</title><line id="tija" x1="200" y1="130" x2="200" y2="100" stroke="#555" stroke-width="8" /><path id="sillin" d="M 170 95 L 230 105 L 220 115 L 175 105 Z" fill="#222" stroke="#111" stroke-width="1"/></g>
            <g id="ruedas"><title>Ruedas</title><g id="rueda-trasera"><title>Rueda Trasera</title><circle cx="120" cy="300" r="80" fill="none" stroke="url(#grad-rubber-tire)" stroke-width="8"/><circle cx="120" cy="300" r="70" fill="none" stroke="#AAA" stroke-width="3"/><line x1="120" y1="300" x2="189" y2="270" stroke="#999" stroke-width="1"/><line x1="120" y1="300" x2="120" y2="230" stroke="#999" stroke-width="1"/><line x1="120" y1="300" x2="51" y2="270" stroke="#999" stroke-width="1"/><line x1="120" y1="300" x2="51" y2="330" stroke="#999" stroke-width="1"/><line x1="120" y1="300" x2="120" y2="370" stroke="#999" stroke-width="1"/><line x1="120" y1="300" x2="189" y2="330" stroke="#999" stroke-width="1"/><circle cx="120" cy="300" r="8" fill="#777" stroke="#555"/></g><g id="rueda-delantera"><title>Rueda Delantera</title><circle cx="480" cy="300" r="80" fill="none" stroke="url(#grad-rubber-tire)" stroke-width="8"/><circle cx="480" cy="300" r="70" fill="none" stroke="#AAA" stroke-width="3"/><line x1="480" y1="300" x2="549" y2="270" stroke="#999" stroke-width="1"/><line x1="480" y1="300" x2="480" y2="230" stroke="#999" stroke-width="1"/><line x1="480" y1="300" x2="411" y2="270" stroke="#999" stroke-width="1"/><line x1="480" y1="300" x2="411" y2="330" stroke="#999" stroke-width="1"/><line x1="480" y1="300" x2="480" y2="370" stroke="#999" stroke-width="1"/><line x1="480" y1="300" x2="549" y2="330" stroke="#999" stroke-width="1"/><circle cx="480" cy="300" r="8" fill="#777" stroke="#555"/></g></g>
            <g id="transmision"><title>Transmisión</title><g id="platos-y-bielas"><circle cx="280" cy="280" r="25" fill="none" stroke="#666" stroke-width="4"/><circle cx="280" cy="280" r="5" fill="#555"/><line x1="280" y1="280" x2="300" y2="220" stroke="#777" stroke-width="6"/><rect x="295" y="210" width="20" height="8" fill="#444"/></g><g id="cassette-trasero"><circle cx="120" cy="300" r="18" fill="none" stroke="#888" stroke-width="3"/></g><path id="cadena" d="M 280 255 C 200 245, 140 270, 120 282 M 120 318 C 180 325, 260 300, 280 305" fill="none" stroke="#444" stroke-width="3" stroke-dasharray="4 2"/></g>
        </g>
    </svg>
                `;
                break;
            default:
                specificInstructions = `
                    **Tipo de Elemento:** ${tipoElemento}.
                    **Instrucciones de Dibujo Generales:**
                    1.  **Composición:** Centra el elemento principal. Si es un paisaje, usa capas (primer plano, plano medio, fondo) para crear profundidad.
                    2.  **Coherencia Visual:** Todos los componentes deben compartir un estilo de iluminación, color y trazo consistente.
                    3.  **Volumen y Profundidad:** Utiliza luces y texturas  para evitar un resultado plano.
                    4.  **Claridad y Realismo:** Utiliza perspectivas claras y realistas para dar profundidad y realismo.
                    5.  **Estructura:** Usa un orden lógico para organizar los elementos. Los detalles deben estar dentro de los elementos principales.
                `;
    }

    return `
        Eres un diseñador gráfico experto en SVG y un ilustrador técnico. Tu tarea es generar un objeto JSON que contenga metadatos y el código SVG de una imagen, siguiendo un plan de ejecución estricto y detallado.

        PROMPT ORIGINAL DEL USUARIO: "${userPrompt}"

        ==================================================
        PLAN DE EJECUCIÓN OBLIGATORIO (TIENE PRIORIDAD MÁXIMA):
        ${specificInstructions}
        ==================================================

        INSTRUCCIONES FINALES DE FORMATO:
        1.  Ejecuta el PLAN al pie de la letra para crear la imagen.
        2.  Define los metadatos ("nombre", "descripcion", "etiqueta"). La "etiqueta" DEBE ser '${tipoElemento}'.
        3.  Genera el código SVG en la propiedad "svgContent". El SVG debe ser de alta calidad, con viewBox="0 0 1024 1024" y fondo transparente.
                    **¡MUY IMPORTANTE!: La composición del dibujo debe estar centrada y ocupar la mayor parte del espacio del viewBox. Escala los elementos para que llenen el lienzo de 1024x1024, evitando grandes márgenes vacíos.**

        4.  Tu respuesta DEBE SER ÚNICAMENTE el objeto JSON válido. No incluyas texto explicativo, comentarios o markdown fuera del JSON.
    `;
}

// --- OTRAS FUNCIONES DE GENERACIÓN ---
// (generarImagenesFaltantes, generarImagenParaDatos, ultras2, generarSvgRefinado, createEnrichmentPrompt)
// Todas estas funciones se mueven aquí desde el archivo original.

function createEnrichmentPrompt(userPrompt) {
    return `
     Eres un asistente de diseño conceptual y gráfico. Tu tarea es analizar un prompt, extraer su información semántica y generar una representación visual en formato SVG.

        PROMPT DEL USUARIO: "${userPrompt}"

        INSTRUCCIONES:
        1.  Analiza el prompt y define los siguientes metadatos:
            - "nombre": Un nombre corto y descriptivo para el elemento (máx. 5 palabras).
            - "descripcion": Una descripción detallada de lo que representa la imagen.
            - "etiqueta": Clasifica el elemento. Elige UNA de las siguientes opciones: 'personaje', 'ubicacion', 'evento', 'objeto', 'atuendo', 'edificio', 'transporte', 'animal', 'planta', 'ser_vivo', 'elemento_geografico', 'concepto', 'visual', 'indeterminado'.
            - "arco": Asigna un arco temático. Elige UNO: 'videojuego', 'planteamiento', 'visuales'.
        2.  Crea una imagen vectorial de alta calidad que represente el prompt.
        3.  El código de esta imagen debe estar en formato SVG, dentro de una propiedad llamada "svgContent".
        4.  El SVG debe tener un viewBox="0 0 512 512", xmlns="http://www.w3.org/2000/svg", y fondo transparente. Usa estilos ricos (colores, degradados, filtros) y organiza los elementos en grupos (<g>) con IDs.
        5.  COHERENCIA ESTRUCTURAL (¡MUY IMPORTANTE!): Todos los elementos que dibujes deben formar una ÚNICA entidad visual coherente. Si dibujas un personaje, la cabeza debe estar conectada al cuello, el cuello al torso, los brazos al torso, etc. No dejes partes flotando en el espacio. Trata el sujeto como un objeto físico y sólido donde todas sus partes encajan y se tocan.
        6.  La composición general debe estar centrada y bien equilibrada dentro del viewBox.
        7.  Tu respuesta DEBE SER ÚNICAMENTE un objeto JSON válido que contenga todos los campos mencionados. No incluyas explicaciones ni markdown.

        EJEMPLO DE SALIDA PARA EL PROMPT "un veloz zorro naranja en un bosque":
        {
          "nombre": "Zorro Naranja Veloz",
          "descripcion": "Un zorro de color naranja brillante, capturado en pleno movimiento mientras corre a través de un estilizado bosque de tonos verdes y marrones.",
          "etiqueta": "animal",
          "arco": "visuales",
          "svgContent": "<svg viewBox=\\"0 0 512 512\\" xmlns=\\"http://www.w3.org/2000/svg\\"><g id=\\"zorro\\"><path d='...' fill='#E67E22'/><path d='...' fill='#FFFFFF'/></g></svg>"
        }
    `;
}

async function generarImagenesFaltantes() {
    console.log("Iniciando generación de imágenes faltantes...");
    // Esta función depende de elementos DOM que no están en index.html
    // ('#personajes #listapersonajes', '.personaje', '.nombreh', '.personaje-visual')
    // Por ahora se deja como estaba, pero necesitaría que el DOM de index.html
    // se adapte si se quiere usar esta función.
    const listaPersonajes = document.querySelector('#personajes #listapersonajes');
    if (!listaPersonajes) {
        console.warn("generarImagenesFaltantes: No se encontró '#personajes #listapersonajes'");
        return;
    }
    // ... (resto de la lógica)
}

async function generarImagenParaDatos(userPrompt) {
    try { console.log("paso1");
        // PASO 1: Generar SVG base.
        const promptInicial = `Crea un SVG de "${userPrompt}". Responde solo con el código SVG.`;
        const respuestaSvgInicial = await callGenerativeApi(promptInicial, 'gemini-2.5-flash-preview-09-2025', false);
        const svgInicial = extraerBloqueSVG(respuestaSvgInicial);
        if (!svgInicial) throw new Error("La IA no generó un SVG base.");

        // PASO 2: Mejorar SVG. 
        console.log("paso2");
        const promptMejora = `Refina este SVG para que sea más realista, añade detalles y texturas: \`\`\`xml\n${svgInicial}\n\`\`\` Responde solo con el nuevo código SVG.`;
        const respuestaSvgMejorado = await callGenerativeApi(promptMejora, 'gemini-2.5-flash-preview-09-2025', false);
        const svgFinal = extraerBloqueSVG(respuestaSvgMejorado);
        if (!svgFinal) throw new Error("La IA no generó una mejora del SVG.");

        // PASO 3: Convertir a PNG.
        console.log("paso3");
        const pngDataUrl = await svgToPngDataURL(svgFinal);
        if (!pngDataUrl) throw new Error("La conversión de SVG a PNG falló.");

        return { 
            pngUrl: pngDataUrl, 
            svgCode: svgFinal 
        };

    } catch (error) {
        console.error(`[ERROR EN GENERACIÓN] El proceso para "${userPrompt}" falló. Causa:`, error);
        return null;
    }
}


async function ultras2(userPrompt) {
    if (!userPrompt) {
        throw new Error("El prompt de usuario no puede estar vacío.");
    }
    console.log(`[Generador SVG Refinado] Iniciando para: "${userPrompt}"`);

    // --- PASO 1: Generar SVG base ---
    console.log("[Generador SVG Refinado] PASO 1: Generando SVG base...");
    const promptInicial = `Crea un SVG simple de un "${userPrompt}". Responde únicamente con el código SVG, sin explicaciones ni otros textos.`;
    
    const respuestaSvgInicial = await callGenerativeApi(promptInicial, 'gemini-2.5-flash-preview-09-2025', false);
    const svgInicial = extraerBloqueSVG(respuestaSvgInicial);

    if (!svgInicial) {
        console.error("Respuesta recibida en PASO 1:", respuestaSvgInicial);
        throw new Error("La IA no generó un SVG base válido en el primer paso.");
    }
    console.log("[Generador SVG Refinado] SVG base generado.");

    // --- PASO 2: Mejorar el SVG ---
    console.log("[Generador SVG Refinado] PASO 2: Refinando el SVG...");
    const promptMejora = `Refina y mejora el siguiente código SVG para que sea más detallado, realista y visualmente atractivo. Añade texturas, sombras sutiles y líneas orgánicas. Responde únicamente con el nuevo código SVG completo y mejorado:\n\`\`\`xml\n${svgInicial}\n\`\`\``;
    
    const respuestaSvgMejorado = await callGenerativeApi(promptMejora, 'gemini-2.5-flash-preview-09-2025', false);
    const svgFinal = extraerBloqueSVG(respuestaSvgMejorado);

    if (!svgFinal) {
        console.error("Respuesta recibida en PASO 2:", respuestaSvgMejorado);
        throw new Error("La IA no generó una mejora del SVG en el segundo paso.");
    }
    console.log("[Generador SVG Refinado] SVG refinado con éxito.");

    // --- PASO FINAL: Convertir a PNG y devolver ---
    console.log("[Generador SVG Refinado] Convirtiendo SVG final a PNG...");
    const pngDataUrl = await svgToPngDataURL(svgFinal);

    return { imagen: pngDataUrl, svgContent: svgFinal };
}

async function generarSvgRefinado(prompt) {
    if (!prompt) {
        throw new Error("El prompt para la generación de SVG no puede estar vacío.");
    }
    console.log(`[SVG Refinado] Iniciando para: "${prompt}"`);

    try {
        // --- PASO 1: GENERACIÓN DEL BORRADOR INICIAL ---
        console.log(`[SVG Refinado] Paso 1/3: Generando borrador inicial...`);
        
        const promptGeneracion = `Crea un SVG simple y limpio basado en la siguiente descripción: "${prompt}".
El SVG debe ser minimalista pero claro, con un viewBox="0 0 1024 1024" y fondo transparente.
**IMPORTANTE: El dibujo debe estar centrado y ocupar la mayor parte del viewBox, evitando márgenes vacíos.**
Devuelve el resultado en un objeto JSON con la clave "svgContent".`;

        const dataInicial = await callGenerativeApi(promptGeneracion, 'gemini-2.5-flash-preview-09-2025', true);
        const svgInicial = dataInicial?.svgContent; 

        if (!svgInicial) {
            throw new Error("La respuesta de la IA (generación) no contenía la propiedad 'svgContent'.");
        }
        console.log(`[SVG Refinado] Borrador SVG generado.`);


        // --- PASO 2: REFINAMIENTO DEL SVG ---
        console.log(`[SVG Refinado] Paso 2/3: Refinando el SVG con una segunda pasada...`);

        const promptRefinamiento = `Eres un experto diseñador de SVG. Tu tarea es mejorar el siguiente código SVG.
Descripción original: "${prompt}".

SVG a mejorar:
\`\`\`xml
${svgInicial}
\`\`\`

Mejóralo añadiendo más detalles, usando gradientes o formas más complejas.
**IMPORTANTE: Asegúrate de que la composición final esté centrada y llene el espacio del viewBox="0 0 1024 1024".**
Devuelve ÚNICAMENTE el código SVG mejorado dentro de un objeto JSON con la clave "svgContent".`;

        const dataRefinada = await callGenerativeApi(promptRefinamiento, 'gemini-2.5-flash-preview-09-2025', true);
        const svgRefinado = dataRefinada?.svgContent;

        if (!svgRefinado) {
            throw new Error("La respuesta de la IA (refinamiento) no contenía la propiedad 'svgContent'.");
        }
        console.log(`[SVG Refinado] El SVG ha sido mejorado.`);

        // --- PASO 3: CONVERSIÓN A PNG ---
        console.log(`[SVG Refinado] Paso 3/3: Convirtiendo SVG final a PNG...`);

        const pngDataUrl = await svgToPngDataURL(svgRefinado);
        
        return { imagen: pngDataUrl, svgContent: svgRefinado };

    } catch (error) {
        console.error(`[SVG Refinado] Falló la generación para "${prompt}":`, error);
        return null;
    }
}
