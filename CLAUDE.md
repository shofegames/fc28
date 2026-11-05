# FC 28 (Shofe Games)

Juego de fútbol 3D (11 contra 11) para el navegador, del usuario (GitHub `shofegames`). Mismo tipo de página que su Gran Premio 3D: un solo `index.html` con Three.js r128 desde cdnjs y todo lo demás inline.

## El usuario
- Habla español argentino (vos). Respuestas simples y paso a paso.
- Mensajes cortos. Si algo no está claro, preguntar con opciones.
- Clubes y jugadores con nombres "truchos" a propósito (Barchelona, Rasing Club, Boca Yuniors...). Nunca nombres, escudos ni logos reales.
- Pedir OK antes de publicar (push), borrar cosas o gastar plata.

## Estructura
- `src/index.html`: plantilla (DOM de menús y HUD). `src/css/*.css`, `src/js/*.js` (se juntan por orden de nombre dentro de un IIFE, comparten alcance).
- `build.ps1` arma `index.html` (lo que se publica). `build.ps1 -Dev` arma `dev/index.html` sin CSP y con `window.__e=s=>eval(s)` para depurar (dev/ no se sube).
- `serve.ps1` = servidor local (no hay Node ni Python en la PC). `.claude/launch.json` → `fc28-dev` en http://localhost:8765.
- Módulos: 00 core/estado `G` · 01 clubes, planteles, escudos · 02 formaciones/tácticas/dificultad · 03 sonido WebAudio · 04 teclado/joystick · 10 render/calidad · 11 cancha · 12 arcos y redes · 13 estadio/público · 20 pelota (física propia + predicción) · 30 modelo y animación del jugador · 31 jugador · 32 equipo · 40 control de pelota, pases, disparos, entradas · 41 IA · 42 arqueros · 43 jugador humano · 50 reglas del partido · 51 cámara · 60 HUD y menús · 99 arranque y bucle.

## Decisiones técnicas
- Física de la pelota propia en vez de Rapier: la misma función `ballStep` mueve la pelota y predice la trayectoria (`Ball.predict`, 3 s a 30 Hz), así arqueros e intercepciones coinciden con lo que pasa. 4 subpasos por cuadro para que no atraviese postes. `solveLaunch` corrige roce y efecto para apuntar disparos y pases altos.
- Lógica a 60 pasos fijos (`DT`), render interpolado.
- Jugadores: jerarquía de huesos con nombres estilo Mixamo (`Rig.j.Hips`, `LeftUpLeg`...), animación procedural; la fase de carrera avanza con la distancia (no patinan). Para pasar a GLB/GLTF: otra clase con el mismo `animate(dt, player)`.
- La dificultad cambia decisiones, reacción y precisión de la IA (`DIFFS`), no la velocidad.

## Pruebas
- `build.ps1 -Dev`, abrir `fc28-dev`, y manejar todo con `__e(...)`: `G.paused=true` y llamar `step(DT)` en bucle para simular minutos en milisegundos.
- Nunca dejar `__e=` en `index.html`: `grep -c "__e=" index.html` tiene que dar 0 antes de publicar.

## Publicación
- Repo público `shofegames/fc28`, GitHub Pages desde `main` (raíz) → https://shofegames.github.io/fc28/
- Commits con el mail noreply `283266715+shofegames@users.noreply.github.com`, nunca el gmail.

## Estado (Fase 1, 2026-11-04)
Hecho: cancha reglamentaria, arcos con redes que se mueven, estadio con público animado, pelota física, 22 jugadores 3D animados, cámara TV (+ TV alta y cercana), controles WASD/JKLI/Q/E/Espacio + joystick, pases (corto, filtrado, largo, centro, de primera), disparos (colocado, potente, vaselina, cabezazo), IA de los dos equipos con formaciones y tácticas, arqueros con estiradas, saques del medio, laterales, córners, saques de arco, goles, dos tiempos, estadísticas, menú, selección de equipos, configuración, pausa.
Falta: faltas, tarjetas, penales, tiros libres, offside, tiempo añadido, árbitro y asistentes, sustituciones, repetición del gol, entrenamiento, torneos, lluvia, modelos GLB definitivos, LOD.
