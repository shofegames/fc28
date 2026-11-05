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

## Controles
- Esquemas en `SCHEMES` (00_core): `flechas` (predeterminado: flechas mover, S pase, D disparo, W filtrado, A centro, E correr, Q cambiar), `wasd` (WASD + mouse: clic izq pase, clic der disparo, Espacio pase) y `jkl` (el original). Shift siempre corre. Defendiendo, pase = entrada y disparo = barrida. Cambiar una tecla deja el esquema en `custom`.
- El jugador del usuario acelera 1.45x y gira mas rapido que la IA (31_player).
- (v6, pedido: "imitá al DLS") Estilo juego de celular: pelota pegada al pie (`dribble` en 40_play, nunca se aleja más de ~1 m), PASE sale al apretar (no al soltar) y nunca va al vacío (busca al compañero más lógico, prefiriendo al libre), pases rasantes más rápidos. Defendiendo: PASE = cambiar jugador, FILTRADO = presionar (mantenido va solo a quitar), TIRO = barrida. Filtrado desde la banda en el último tercio = centro. En el celular solo 3 botones (PASE, FILTRADO, TIRO) y se corre con el joystick a fondo. Se imita cómo se juega, no la imagen del DLS.

## Movimiento y pases (v7, plan por etapas del usuario)
- Etapa 1 (auditoría, medido en partidos IA vs IA): aceleraciones de 13-17 m/s², giros de 12 m/s² laterales, 38% corriendo de costado, arranques/frenadas 22 por segundo, cuerpo a 71° del pase.
- Etapa 2: `Player.update` separa aceleración longitudinal (arranque que se apaga cerca de la máxima) y lateral (giro limitado por la velocidad); cambio >115° = frena primero. `p.calm` (reubicarse) acelera/frena suave. `moveTo`: estacionamiento con histéresis (`brain.parked`), esquiva a los que tiene adelante, trote para reubicarse. Resultado: vel. media 2,4 m/s, aceleración típica 1,4 m/s², giro P95 7,4 m/s², 0→7 m/s en 1 s.
- Etapa 3: `startKick` elige el receptor/objetivo al empezar y el cuerpo gira hacia ahí antes del contacto (`ac.face`; desvío 71°→8°). Recepción con animación `trap` y primer toque orientado (con el joystick). La pelota rasante suelta rebota en las piernas (`Ball.bodies`).
- Etapa 4 (v8): `teamShape(t)` (en `assignRoles`) calcula línea defensiva que sube/baja con la pelota y retrocede si el rival viene de frente sin marca, bloque compacto y corrimiento; `formationTarget` arma posiciones por línea, laterales que pasan al ataque, extremos abiertos, llegada al área, marca en zona (al hombre cerca del área) y volantes que cierran líneas de pase. Atacando, cada uno busca espacio libre (`spaceNear`) y 3 apoyos (`supportSpot`) sin quedar en offside. Presión tras pérdida (`counterPress`). Remates según calidad de la ocasión (`xgAt`), pases valoran avanzar y dejar al compañero en mejor posición, filtrados al que está en la línea. `passRisk` usa la velocidad real de los pases. Resultado: opciones de pase libres 0,3→1,2, ~8 remates y 2,5 goles por partido IA vs IA, pases del usuario 85%.
- Faltan: Etapa 5 (animaciones), 6 (gráficos), 7 (rendimiento).

## Celular
- `05_touch.js`: joystick dinámico (mitad izquierda) y botones (PASE, TIRO, FILTRADO, CENTRO, CORRER, CAMBIAR) que generan teclas virtuales `T_<accion>` en `Input`. Joystick a fondo = correr. Defendiendo los botones dicen ENTRADA/BARRIDA. Se activa solo en pantallas táctiles (Configuración → Controles táctiles: Auto/Sí/No).
- En vertical aparece "Girá el celular" y el partido se pausa. Al tocar COMENZAR pide pantalla completa y horizontal (Android).
- Estilos para pantallas bajas en `@media (max-height:520px)`. Para probar: viewport 844x390 y `CFG.touch='on'`.

## Pruebas
- `build.ps1 -Dev`, abrir `fc28-dev`, y manejar todo con `__e(...)`: `G.paused=true` y llamar `step(DT)` en bucle para simular minutos en milisegundos.
- Nunca dejar `__e=` en `index.html`: `grep -c "__e=" index.html` tiene que dar 0 antes de publicar.

## Versiones
- `versiones/FC 28 vN.html`: copia de cada versión publicada (v1..v4 sacadas del historial de git). `build.ps1 -Save` arma `index.html` con el número siguiente (se ve abajo en el menú) y guarda la copia. Usar `-Save` cada vez que se publica.

## Gráficos (v5)
- Como Gran Premio 3D: `outputEncoding` sRGB + ACES, cielo con degradé/sol/estrellas (`R.skyMat`), mapa de entorno con `pmrem.fromEquirectangular(R.skyCanvas(S))` (`fromScene` daba negro). `R.prep(root)` pasa colores a lineal y cambia Lambert/Phong por MeshStandard (salvo calidad Baja o `userData.keep`). En r128 las texturas no tienen `userData`: usar `LINTEX` (WeakSet).
- Cada jugador es UNA `SkinnedMesh` (`Rig.bake`): los huesos son `THREE.Bone` con nombres estilo Mixamo, las piezas se unen con color por vértice y la camiseta usa la textura (franja blanca abajo para el resto). Bajó de ~700 a ~80 dibujos por cuadro.
- Césped con textura de detalle repetida (`onBeforeCompile`), público con cabezas aparte, carteles LED sin tone mapping, sombra de contacto bajo los pies.

## Publicación
- Repo público `shofegames/fc28`, GitHub Pages desde `main` (raíz) → https://shofegames.github.io/fc28/
- Commits con el mail noreply `283266715+shofegames@users.noreply.github.com`, nunca el gmail.

## Estado (Fase 1, 2026-11-04)
Hecho: cancha reglamentaria, arcos con redes que se mueven, estadio con público animado, pelota física, 22 jugadores 3D animados, cámara TV (+ TV alta y cercana), controles WASD/JKLI/Q/E/Espacio + joystick, pases (corto, filtrado, largo, centro, de primera), disparos (colocado, potente, vaselina, cabezazo), IA de los dos equipos con formaciones y tácticas, arqueros con estiradas, saques del medio, laterales, córners, saques de arco, goles, dos tiempos, estadísticas, menú, selección de equipos, configuración, pausa.
Fase 3 (2026-11-05, commit local, falta publicar): árbitro y 2 asistentes 3D (52_referee: diagonal, tarjetas, banderín), faltas con ventaja, amarillas/rojas/doble amarilla y expulsión, tiros libres con barrera, penales (cámara atrás del pateador, el arquero adivina un lado), fuera de juego (snapshot al patear, se cobra al intervenir), tiro libre indirecto, tiempo añadido, cambios/formación/táctica/posiciones desde la pausa o el entretiempo (53_subs), la CPU hace 3 cambios por cansancio.
v5 (2026-11-05): gráficos nuevos, repetición del gol (`54_replay.js`, se saltea con PASE), Entrenamiento con 6 prácticas (`55_training.js`: libre, disparos, penales, tiros libres, centros, pases).
Falta: torneos, lluvia, suplentes sentados en el banco, modelos GLB definitivos, probar en un celular real.
