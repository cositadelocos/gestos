const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const gestureOverlay = document.getElementById('gesture-overlay');
const startBtn = document.getElementById('startBtn');

// Elementos de medios
const imgJordano = document.getElementById('imgJordano');
const imgPiolin = document.getElementById('imgPiolin');
const audioMusica = document.getElementById('audioMusica');

// Estado
let isRunning = false;
let musicaSonando = false;

// Configuración de Three.js (3D)
let scene, camera, renderer, cube;
function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 640 / 480, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ alpha: true }); // Fondo transparente
    renderer.setSize(640, 480);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    // Insertar el canvas 3D sobre el canvas 2D
    // Insertar el canvas 3D sobre el canvas 2D
    document.querySelector('.video-container').appendChild(renderer.domElement);

    // Iluminación (Necesaria para ver bien el modelo 3D)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Cargar modelo STL 'joseblemder.stl'
    const loader = new THREE.STLLoader();
    loader.load('joseblemder.stl', function (geometry) {
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, specular: 0x111111, shininess: 200 });
        cube = new THREE.Mesh(geometry, material);

        // Ajustar escala y posición (Ajusta estos valores si el modelo es muy grande/pequeño)
        cube.scale.set(0.1, 0.1, 0.1);
        cube.position.set(0, 0, 0);

        // Centrar geometría
        geometry.center();

        scene.add(cube);
        document.getElementById('status').innerText = "Modelos cargados. ¡Listo!";
    }, undefined, function (error) {
        console.error('Error cargando el modelo 3D:', error);
        document.getElementById('status').innerText = "Error: No se pudo cargar el 3D (¿Usas servidor local?)";
        document.getElementById('status').style.color = "red";
    });

    camera.position.z = 50; // Alejar cámara por si el modelo es grande
    renderer.domElement.style.display = 'none'; // Ocultar por defecto
}

init3D();

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Dibujar video
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let gestureText = "Esperando mano...";
    let show3D = false;

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

            // Lógica de conteo de dedos (Simplificada para JS)
            const dedos = contarDedos(landmarks);
            const total = dedos.reduce((a, b) => a + b, 0);

            // --- GESTOS ---

            // ✋ Mano abierta (5 dedos) -> Mostrar Jordano
            if (total === 5) {
                gestureText = "Mano Abierta (Jordano)";
                // Dibujar Jordano
                canvasCtx.drawImage(imgJordano, 10, 10, 300, 300);
            }

            // 🤏 Pinza (Índice y Pulgar cerca) -> Mostrar Objeto 3D
            else if (calculateDistance(landmarks[4], landmarks[8]) < 0.05) {
                gestureText = "Pinza (Objeto 3D)";
                show3D = true;
                if (cube) {
                    cube.rotation.x += 0.01;
                    cube.rotation.y += 0.01;
                }
            }

            // ✊ Puño cerrado (0 dedos) -> Reproducir música
            else if (total === 0) {
                gestureText = "Puño (Play Música)";
                if (audioMusica.paused) {
                    audioMusica.play().catch(e => console.log("Error audio:", e));
                }
            }

            // 👍 Pulgar arriba (Dedos index, medio, anular, meñique abajo, pulgar a un lado)
            // Simplificación: Solo pulgar extendido y total=1
            else if (total === 1 && dedos[0] === 1) {
                gestureText = "Pulgar Arriba (Piolín)";
                // Dibujar Piolín
                canvasCtx.drawImage(imgPiolin, 10, 10, 200, 200);
            }

            // ✌️ Amor y Paz (2 dedos) -> Stop música
            else if (total === 2 && dedos[1] === 1 && dedos[2] === 1) {
                gestureText = "Paz (Stop Música)";
                if (!audioMusica.paused) {
                    audioMusica.pause();
                    audioMusica.currentTime = 0;
                }
            }
        }
    }

    // Actualizar UI
    gestureOverlay.innerText = gestureText;
    renderer.domElement.style.display = show3D ? 'block' : 'none';
    if (show3D) renderer.render(scene, camera);

    canvasCtx.restore();
}

function contarDedos(landmarks) {
    let dedos = [0, 0, 0, 0, 0];

    // Pulgar (asumiendo mano derecha por defecto para simplificar, o chequeando x)
    // Nota: En JS MediaPipe, landmarks están normalizados.
    // Comparar x del tip con x del nudillo no siempre funciona igual si la mano rota.
    // Usaremos una heurística simple de x.
    if (landmarks[4].x < landmarks[3].x) dedos[0] = 1; // Ajustar según mano izq/der si es necesario

    // Otros dedos (Y) - El origen (0,0) es arriba-izquierda. Y menor es más arriba.
    if (landmarks[8].y < landmarks[6].y) dedos[1] = 1;
    if (landmarks[12].y < landmarks[10].y) dedos[2] = 1;
    if (landmarks[16].y < landmarks[14].y) dedos[3] = 1;
    if (landmarks[20].y < landmarks[18].y) dedos[4] = 1;

    return dedos;
}

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// Cámara
let cameraObj = null;

function calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

startBtn.addEventListener('click', () => {
    if (!isRunning) {
        cameraObj = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        cameraObj.start();
        isRunning = true;
        startBtn.innerText = "Detener Cámara";
    } else {
        // Detener (recargar página es lo más fácil para limpiar contexto en demos simples)
        location.reload();
    }
});
