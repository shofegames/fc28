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
- El usuario dejó un plan nuevo en `prompt mejoras.md` (etapas 5 a 10, renumeradas): trabajar por etapas, al final de cada una mostrar fotos antes/después y números, y esperar su OK.

## Animación (etapa 5 del prompt nuevo, 2026-11-09)
- `Rig.animate` en capas: locomoción (largo y frecuencia del paso con `gaitLen`/`gaitDuty` en 00_core, inclinación en curvas con `p.latA`, jockey con `p.jockey`), acción mezclada con entrada/salida suave (`Rig.BLEND`), cabeza que sigue la pelota y escanea (`p.scanT`), y `legIK` + `solveLeg`: IK de 2 huesos con pies clavados (cada pie tiene `plant` en el mundo; 6 pasadas de corrección, 3 en calidad Baja; el cuerpo baja con `this.drop` si la pierna no llega).
- Patadas por tipo en `Rig.KICKS` (pase con el borde interno, largo/centro con el cuerpo atrás, remate encima de la pelota, vaselina, despeje) y pie de apoyo a 25 cm de la pelota (`ac.plant` en `startKick`). Recepciones `trap` con `kind`: suela, interno, muslo, pecho. Cabezazo con agachada/salto/caída. Barrida + `getup`. Arquero: `gkthrow`, `gkvolley`, `punch`. Festejos `style`: fist, airplane, knees; abrazo; `frustrate` (gol errado), `protest` (falta), `p.askT` (pide la pelota). Pie hábil `info.foot` (1 de cada 5 zurdo).
- Medido (60 s IA vs IA): pie apoyado 2,1 → 0,003 m/s de mediana (84% de los cuadros bajo 0,05), saltos de pose 0,2 por mil, animación 1,7 ms por cuadro para 25 personajes. Faltan: chilena, dejar correr la pelota, tropezones en choques, arquero achicando agachado.
## Control, pases y tiros (etapa 6, 2026-11-09)
- Primer toque (`receive` en 40_play): dificultad = velocidad relativa, altura, presión, de espaldas; error = dificultad − habilidad (regate y pase). Error > 0,55 = se le escapa; si no, la acomoda a 0,45 + error·3,3 m (el humano hacia el joystick; la IA hacia el arco o lejos del rival) y `p.touchHold` deja correr la pelota un momento. La IA puede devolver de primera (pared, `brain.wall`) o pasar de primera si la presionan.
- Pases rasantes: `groundRoll`/`groundV0` calculan la fuerza con el roce real para que lleguen a 8-12 m/s (`passArrive`). Error del pase por presión, cuerpo (90° es lo más difícil), pie malo ×1,35, de primera, distancia. Centros rasantes (al primer palo) o altos, con efecto Magnus cerrado/abierto (w 13/16 → ~0,8/1,4 m de curva). Tiros: error ×1,4 pie malo, ×1,25 corriendo rápido, de primera. Cabezazo peinado (`o.flick`).
- IA: `passRisk` ve al rival que tapa la línea cerca del que pasa; `bestPass` castiga más el riesgo; protege la pelota con el cuerpo si tiene un rival a menos de 1,6 m y no hay pase; cutback desde el fondo; recibe abriendo el cuerpo hacia el arco.
- Medido (4 partidos IA vs IA, `PASSAUD`): cortos 77→84-88%, largos rasantes 75→81-87%, centros 24→39-50%, filtrados 63→67-75%, llegada 9,3→9,8 m/s, primer toque mediana 0,5→0,6 m (p90 ~3 m), mal control 2→4-6%, 91% va a buscar la pelota, al arco 45-47%. Pases del usuario 36/40. Decisión (el usuario dijo "lo que vos digas"): más acción, pero con ocasiones buenas. Error de tiro base bajado a `0.0102 + (1-sk)*0.049` → 7 remates, 43% al arco, 2,3 goles por partido de 3 min. Problema para la etapa 7: la mitad de los remates son de más de 24 m, casi ninguno desde el área chica, y el arquero ataja poco los tiros de lejos (subir las ganas de patear solo agregaba tiros de lejos).

## Inteligencia (etapa 7, 2026-11-09)
- Arquero (42_keeper): `keeperPosition` y el achique van sobre la bisectriz del ángulo de los palos; de líbero (hasta 9 m más afuera) si su equipo ataca lejos. `shotThreat(team, keeperX)` da altura/costado/tiempo en el plano del arquero (antes usaba la línea del arco y se equivocaba de altura). Se tira justo a tiempo (`|lat|/velEstirada + 0,14 s`), si viene a menos de 0,9 m ataja parado/saltando; reacciona antes a tiros de lejos. Estirada 3,0+1,6·gk m/s, manos a 1,2 m en 0,35 s.
- Tiros: error ×(1 + (D−16)/13) de lejos; la IA no patea siempre a fondo (`aiShoot`), apunta a 2-3,2 m del centro, castiga tiros de >18 m salvo `info.longShot`.
- Personalidad (01_teams): `info.dribbler`, `info.passer`, `info.longShot` según atributos.
- Ataque: `boxSpot` (primer palo, segundo palo, punto penal, medialuna; en corners suben los 2 centrales más altos). Se paran habilitados y atacan el área cuando sale el centro (brain). `aiCross` apunta al lugar del que llega, no a sus pies; centra más con gente en el área. Compañeros no se amontonan (`spaceNear`). Pase al área +0,3. Corner corto 18%, tiro libre corto 25%; la CPU espera 2,4 s antes de patear el corner.
- Defensa: señales de presión (`t.pressTrig`: de espaldas, mal control, banda), doble marca en la banda (`t.doubleTeam`), temporiza a 2,5 m sin señal, sombra de cobertura hacia el pase peligroso, quite cuando la pelota se separa del pie, barrida solo si lo pasaron o es más rápido. Decide antes cuando lo encima un rival (2,8 m). Arreglado: el "proteger si el pase es muy riesgoso" nunca se activaba.
- Cansancio: también baja la aceleración y sube el error de pases y tiros (hasta +45%).
- Medido (`AIAUD`, `GKTEST`): entradas al área 0,8→~2,5 por partido, posesiones con remate 7→~11%, opciones libres 1,3→1,45 (sin opción 28→22%), offsides 4→~2,5, arquero a 1,2° de la bisectriz. Tiros de 26 m sin marca: gol 66%→13%. Goles ~1,2 por partido (antes 2,3, casi todos de lejos).

## Gráficos y presentación (etapa 8, 2026-11-09)
- Estadio (13_stadium): dos bandejas con anillo LED en el medio, techo con vigas (no en la tribuna de la cámara de TV), pantalla colgada del techo. Público en UNA `InstancedMesh` (torso+cabeza, cabeza color piel con `aSkin`/`aHead` en el shader), parados en la barra (detrás del arco izquierdo, colores del local) y en el sector visitante; banderas instanciadas de dos colores que flamean; bengalas de humo (`Stadium.celebrate`, Points) en el gol. Gente alrededor en una sola malla estática (`people()`): suplentes con pechera, cuerpo técnico, técnicos, alcanzapelotas, fotógrafos y camarógrafos. Carteles LED cambian de publicidad cada 6 s. De noche las tribunas quedan en penumbra (`nightLights`, se aplica después de `R.prep`).
- Hora/clima (`G.setup.tod` día/atardecer/noche, `G.setup.weather` sol/nublado/lluvia; `R.setEnv(S)` acepta el setup y el formato viejo). `R.fitShadow` centra la cámara de sombras donde mira la cámara (36 m; más nítidas). 14_weather: `Weather` (lluvia en el shader delante de la cámara, pasto mojado `Pitch.wet`, pelota que patina: `BP.rollK` 0,27, `eGround` 0,5, niebla) y `NightShadows` (4 sombras por jugador, una por torre).
- 15_post: post-procesado propio por calidad (`QUALITY.post`): Media color TV + viñeta + AA; Alta/Ultra + bloom. MSAA en la textura con WebGL2 (si no, FXAA). Con post, el lienzo se crea sin antialias. Todo se dibuja con `Post.render`.
- Jugadores: botín con capellada, talón y suela; apellido legible en la espalda; arquero con guantes grandes. Pelota con estela cuando va rápida.
- Presentación: salida de los equipos (`Match.walkout`, `walkBrain`, `Cam.mode='walkout'`) con formaciones en pantalla (`Hud.lineup`), se saltea con PASE. Repetición en dos pasadas (TV alta, y cámara lenta detrás del arco a ras del piso). Sonido: bombo y cantos (`AU.drums`), silbidos a las faltas del visitante (`AU.boo`), lluvia (`AU.rain`).
- Medido (1280×720, cámara TV): Baja 82→94 dibujos, 504k→354k triángulos; Media 118→132, 998k→719k, 1,27→1,82 ms; Alta 118→138, 1,47M→1,01M, 1,24→1,84 ms; Ultra 118→137, 1,78M→1,18M, 1,66→1,86 ms. Faltan: briznas de pasto 3D, oclusión ambiental, ropa embarrada con lluvia, ajuste automático de calidad (va en la etapa 9).
## Rendimiento (etapa 9, 2026-11-09)
- La PC del usuario tiene Intel Iris Xe. Con el panel del navegador oculto, los tiempos de dibujo (gl.finish) no son confiables: medir CPU por partes (`PROF9`, o envolviendo funciones) y contar dibujos/triángulos/objetos (`PERF8`).
- Jugadores: `SkinnedMesh` con esfera fija (r 1,75) y `frustumCulled` → no se dibujan si están fuera de cámara o de la zona de sombras. Lejos de la cámara (>40 m) `rig.lod`: IK con 2 pasadas y animación cada 2 cuadros, escalonada (`renderN`).
- Escena: todo lo construido antes de la pelota queda con `matrixAutoUpdate=false` (boot), salvo luces. Tribunas unidas en una malla por material (`Stadium.mergeStand`, ~300 piezas → 5). Objetos 865→588, mallas 413→168.
- IA escalonada: `assignRoles(team)` un equipo por cuadro (los dos si cambió la posesión); `formationTarget` cada 0,1 s por jugador (`brain.ft`).
- Configuración: "Calidad automática" (`AutoQ`: <45 fps durante 8 s en el partido → baja un nivel; `applyQuality` cambia resolución, post y sombras sin recargar) y "Ahorro de batería" (`CFG.saver`: tope 60 fps jugando, 30 en menús/pausa).
- Pérdidas de memoria arregladas: sombra de los pies (ahora geometría compartida), tarjeta/banderín de los árbitros (`Rig.dispose` libera accesorios), marcador del jugador humano (`Human.dispose`), textura del cielo en cada `setEnv`. 10 partidos seguidos: geometrías 122, texturas 75 y objetos 565 fijos (antes +32 geometrías y +1 textura por partido).
- Medido: CPU de lógica+animación 0,57→0,34 ms por cuadro (IA 0,07→0,03, animación 0,43→0,20). Dibujos/triángulos (1280×720, cámara TV): Baja 94→61 / 354k→322k; Media 132→113 / 719k→688k; Alta 138→104 / 1,01M→964k; Ultra 137→105 / 1,18M→1,15M.

## Revisión final (etapa 10, 2026-11-09)
- `CHECK10(halfMin, segs)` (partido vigilado en tramos: NaN, errores, saques que no se hacen, jugadores trabados, pelota afuera/bajo el piso/que atraviesa la red) y `CONTROLS10()` (pase, remate, cambiar y barrida con flechas, WASD, WASD+mouse, JKL, joystick simulado y táctil). 4 partidos (Baja noche con lluvia, Media atardecer, Alta día, Ultra nublado): 0 errores, 0 NaN, 0 trabados, 0 pelotas que atraviesan. Controles: pase, remate y barrida 4/4 en los 6; cambiar 2-4/4 (no cambia si el elegido ya es el mejor).
- Celular (844×390): en la salida de los equipos se esconden los botones (tapaban las formaciones) y se saltea tocando la pantalla.
- v8 → ahora (Alta, cámara TV): 115→101 dibujos, 1,46M→0,97M triángulos.
- Para comparar con versiones viejas: compilar en un `git worktree` temporal y cargar `src/dev/tools.js` con `fetch('/tools_dev.js')` + `__e` si esa versión no lo incluía.
- Pendiente para después: más goles de la CPU (~1,2 por partido de 3 min; casi no llega al área chica), medir fps reales con el panel visible y en un celular de verdad, briznas de pasto 3D, oclusión ambiental, ropa embarrada, chilena, dejar pasar la pelota, tropezones, arquero achicando agachado, torneos, modelos GLB.

- Ojo: no editar fuentes con `Get-Content`/`Set-Content` de PowerShell 5.1 (lee UTF-8 como ANSI y rompe los acentos); usar la herramienta Edit o .NET con UTF-8 sin BOM.

- Herramientas de prueba en `src/dev/tools.js` (solo en `-Dev`): `ADV`, `SNAP`, `SHOT`, `GRID`, `POSE`, `CAMAT`, `PASSAUD(partidos, minPorTiempo)`, `AIAUD(partidos, min)`, `GKTEST(distancias, n)`, `SCENE8()` + `PHOTOS8(tag)` (6 fotos fijas) y `PERF8(n)` (dibujos, triángulos y ms a 1280×720). Los tests que llaman `startMatch()` tienen que saltear la salida con `G.match.endWalkout()`. Más de 2 partidos por llamada se corta por tiempo: usar `AIAUD(2,3)` varias veces. Las fotos quedan en `dev/`.

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
