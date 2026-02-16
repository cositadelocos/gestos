import cv2
import mediapipe as mp
import os

# Configuración de Pygame para música (Opcional si no está instalado)
HAS_PYGAME = False
try:
    import pygame
    pygame.mixer.init()
    HAS_PYGAME = True
    print("Pygame inicializado. Música activada.")
except ImportError:
    print("ADVERTENCIA: Pygame no encontrado. La música no sonará.")
except Exception as e:
    print(f"ADVERTENCIA: Error al iniciar Pygame: {e}")

MUSICA_PATH = "musica.mp3"

# Inicializar MediaPipe Hands
# Importamos directamente desde los submódulos de Python para evitar el AttributeError
import mediapipe.python.solutions.hands as mp_hands
import mediapipe.python.solutions.drawing_utils as mp_draw

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)




# Pre-cargar y redimensionar imágenes fuera del bucle para mejor rendimiento
def load_and_resize(path, size=(300, 300)):
    if os.path.exists(path):
        img = cv2.imread(path)
        return cv2.resize(img, size)
    return None

img_jordano = load_and_resize("jordano.png")
img_piolin = load_and_resize("piolin.png")

def contar_dedos(hand_landmarks, handedness):
    dedos = []
    # handedness.classification[0].label es 'Left' o 'Right' (desde la perspectiva de la cámara)
    # MediaPipe detecta las manos invertidas a veces, así que ajustamos la lógica del pulgar
    es_mano_derecha = handedness.classification[0].label == 'Right'

    # Pulgar logic (coordenada X)
    # En mano derecha, el pulgar está a la izquierda del índice si la palma mira a cámara
    # Para ser robustos, comparamos con el punto 3 (base del pulgar)
    landmark_4 = hand_landmarks.landmark[4]
    landmark_3 = hand_landmarks.landmark[3]

    if es_mano_derecha:
        dedos.append(1 if landmark_4.x < landmark_3.x else 0)
    else:
        dedos.append(1 if landmark_4.x > landmark_3.x else 0)

    # Otros dedos (coordenada Y)
    tips = [8, 12, 16, 20] # Índice, Medio, Anular, Meñique
    for tip in tips:
        if hand_landmarks.landmark[tip].y < hand_landmarks.landmark[tip-2].y:
            dedos.append(1)
        else:
            dedos.append(0)

    return dedos

cap = cv2.VideoCapture(0)
musica_sonando = False

print("Control iniciado. Presiona ESC para salir.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Espejar el frame para que sea más natural (tipo espejo)
    frame = cv2.flip(frame, 1)
    h, w, c = frame.shape
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(frame_rgb)

    gesture_text = "Esperando mano..."

    if results.multi_hand_landmarks:
        for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
            mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            dedos = contar_dedos(hand_landmarks, handedness)
            total = dedos.count(1)
            
            # --- DEBUG: Ver que detecta el sistema ---
            mano_l_r = handedness.classification[0].label
            print(f"Mano: {mano_l_r} | Dedos: {dedos} | Total: {total}")

            # --- LÓGICA DE GESTOS ---


            # ✋ Mano abierta (5 dedos) -> Mostrar Jordano
            if total == 5:
                gesture_text = "Mano Abierta (Jordano)"
                if img_jordano is not None:
                    frame[10:310, 10:310] = img_jordano

            # ✊ Puño cerrado (0 dedos) -> Reproducir música
            elif total == 0:
                gesture_text = "Puno (Play Musica)"
                if HAS_PYGAME:
                    try:
                        if not pygame.mixer.music.get_busy():
                            if os.path.exists(MUSICA_PATH):
                                pygame.mixer.music.load(MUSICA_PATH)
                                pygame.mixer.music.play()
                            else:
                                print(f"Archivo de música no encontrado: {MUSICA_PATH}")
                    except Exception as e:
                        print(f"Error al reproducir música: {e}")

            # 👍 Pulgar arriba (Solo pulgar) -> Mostrar Piolín y Play
            elif dedos[0] == 1 and total == 1:
                gesture_text = "Pulgar Arriba (Piolin)"
                if img_piolin is not None:
                    frame[10:310, 10:310] = img_piolin
                
                if HAS_PYGAME:
                    try:
                        if not pygame.mixer.music.get_busy():
                            if os.path.exists(MUSICA_PATH):
                                pygame.mixer.music.load(MUSICA_PATH)
                                pygame.mixer.music.play()
                    except Exception as e:
                        print(f"Error al reproducir música: {e}")

            # ✌️ Signo de Paz (2 dedos) -> Stop música (NUEVA FUNCIÓN)
            elif total == 2 and dedos[1] == 1 and dedos[2] == 1:
                gesture_text = "Paz (Stop Musica)"
                if HAS_PYGAME:
                    try:
                        if pygame.mixer.music.get_busy():
                            pygame.mixer.music.stop()
                    except Exception as e:
                        print(f"Error al detener música: {e}")


    # Mostrar información en pantalla
    cv2.putText(frame, gesture_text, (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    cv2.imshow("Control de Gestos - Arturito", frame)

    if cv2.waitKey(1) & 0xFF == 27: # 27 = ESC
        break

cap.release()
cv2.destroyAllWindows()
