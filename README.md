# ActiveBreakApp

Aplicación de Pausas Activas con Detección de Postura en Tiempo Real

## 🎯 Características

- ✅ **Detección de Postura en Tiempo Real**: Usando MoveNet (TensorFlow.js)
- ✅ **Visualización de Skeleton**: Overlay profesional con 17 puntos clave
- ✅ **Análisis Militar-Grade**: 3 reglas estrictas (alineación horizontal, vertical y simetría de hombros)
- ✅ **Feedback Inteligente**: Mensajes específicos según el tipo de error detectado
- ✅ **Notificaciones Configurables**: Alertas nativas con sonido (umbral ajustable 1-60s)
- ✅ **Recordatorios de Pausas**: Sistema automático cada N minutos (5-120 min)
- ✅ **Seguimiento de Estadísticas**: Tracking automático de tiempo en cada postura
- ✅ **Historial Completo**: Registro de eventos con fecha y hora (últimos 100 cambios)
- ✅ **Dashboard Interactivo**: Visualización de datos y tabla de historial
- ✅ **Sistema de Configuración**: Sensibilidad, notificaciones, umbrales personalizables
- ✅ **Interfaz Profesional**: UI moderna con fuente Inter, iconos Feather, y micro-interacciones
- ✅ **Sistema de Diseño**: Variables CSS, paleta refinada, transiciones suaves
- 🚧 **Exportar Datos** (próximamente): Descarga histórico en CSV/JSON

## 🚀 Instalación

Clonar Proyecto: Ir a la carpeta y ejecutar con cmd

```bash
npm init -y
npm install electron --save-dev
npm install @tensorflow/tfjs @mediapipe/pose
npm install electron-builder --save-dev
```

## ▶️ Ejecutar Proyecto

```bash
npm start
```

La aplicación cargará automáticamente:

1. La cámara web
2. El modelo de IA (MoveNet Lightning)
3. La detección de postura en tiempo real

## 🛠️ Tecnologías

- **Electron** v38.4.0 - Desktop app framework
- **TensorFlow.js** v4.22.0 - Machine learning
- **MoveNet Lightning** - Ultra-fast pose detection
- **ES6 Modules** - Modern JavaScript
- **Inter Font** - Professional typography
- **Feather Icons** - Clean, modern iconography
- **CSS Variables** - Design system foundation

## 📊 Estado del Proyecto

**Versión**: 6.2  
**Estado**: Production Ready! 🎉 (Military-Grade AI + Smart Feedback + Data + Settings + History + Professional UI/UX)

Ver `project-purpose.md` para más detalles técnicos.

## 🎮 Cómo Funciona

1. **Detección**: El modelo MoveNet analiza cada frame del video en tiempo real
2. **Keypoints**: Identifica 17 puntos clave del cuerpo humano
3. **Análisis Military-Grade**: Aplica 3 reglas estrictas simultáneamente:
   - 🎖️ **Regla 1**: Alineación horizontal perfecta (tolerancia 15%)
   - 🎖️ **Regla 2**: Postura vertical erguida (50% altura sobre hombros)
   - 🎖️ **Regla 3**: Hombros nivelados (tolerancia 10% de inclinación)
4. **Feedback Inteligente**: Muestra mensajes específicos según el error:
   - ✅ Verde: "Postura Correcta"
   - ⚠️ Rojo: "Centra tu cabeza" / "Endereza tu espalda, siéntate erguido" / "Nivela tus hombros"
5. **Notificaciones**: Si mantienes mala postura por 3+ segundos:
   - 🔔 Notificación nativa del sistema operativo
   - 🔊 Sonido de alerta
   - ♻️ Se resetea automáticamente al corregir la postura
6. **Tracking Automático**: Cada segundo se registra:
   - ⏱️ Tiempo en postura correcta
   - ⏱️ Tiempo en postura incorrecta
   - 💾 Datos guardados en localStorage (persisten al reiniciar)
7. **Estadísticas**: Ve tu progreso en la pestaña "Estadísticas":
   - 📊 Tiempo total en cada postura (formato mm:ss)
   - 📈 Porcentajes y totales en consola
   - 📝 Historial completo de eventos con fecha/hora
   - 🎨 Eventos coloreados (verde/rojo) según tipo
   - ⏱️ Últimos 100 cambios de postura registrados
8. **Recordatorios de Descanso**: Automáticamente cada N minutos:
   - ⏰ Notificación recordando tomar un descanso
   - ⚙️ Configurable en "Configuración" (5-120 minutos)
   - 🔕 Se puede desactivar con el toggle de notificaciones
9. **Configuración Personalizable**: Ajusta todo en "Configuración":
   - 🎚️ Sensibilidad del detector (1-10)
   - 🔔 Activar/desactivar notificaciones
   - ⏱️ Umbral de alerta de postura (1-60 segundos)
   - ⏰ Intervalo de descansos (5-120 minutos)
   - 💾 Todas las configuraciones persisten al reiniciar
10. **Interfaz Pulida y Profesional**:
    - 🎨 Fuente Inter para tipografía moderna
    - 🎯 Iconos Feather para navegación limpia
    - ✨ Micro-interacciones suaves (hover, focus)
    - 🌈 Sistema de diseño con variables CSS
    - 💫 Efectos de elevación en tarjetas
    - 🎭 Transiciones fluidas en todos los elementos

## 🛠️ Implementación

### Admin Login

<img width="640" alt="Admin1" src="https://github.com/user-attachments/assets/63916f27-5460-4090-82c3-9a8d4efef5bd" />
<img width="1161" height="748" alt="Admin2" src="https://github.com/user-attachments/assets/f51a04d1-3e48-4c04-a091-b02a3175aad3" />
<img width="1122" height="761" alt="Admin3" src="https://github.com/user-attachments/assets/2a7beca7-089f-43aa-9bbf-344cc5ecf0e2" />

### Client Login

<img width="1191" height="718" alt="Client1" src="https://github.com/user-attachments/assets/33cb3901-c60e-40c8-8672-e3dc80d9c6f3" />
<img width="1107" height="760" alt="Client2" src="https://github.com/user-attachments/assets/28718d6d-6c27-403e-bd88-3d8b3c5805f8" />
<img width="827" height="662" alt="Client3" src="https://github.com/user-attachments/assets/dc28354b-39fa-479e-a499-a77d47b2e530" />

### Download
<img width="1175" height="695" alt="Download" src="https://github.com/user-attachments/assets/a6b5ede4-c994-425b-98d3-e08944df0397" />


### Main Page
<img width="1225" height="762" alt="Main1" src="https://github.com/user-attachments/assets/e11347a8-c9bb-4eb8-9517-b667e33eeb60" />
<img width="1168" height="677" alt="Main2" src="https://github.com/user-attachments/assets/2ace1ca2-d70f-486e-86c2-39aa6329cd61" />


### Settings
<img width="1210" height="780" alt="Settings1" src="https://github.com/user-attachments/assets/b82b930b-ed71-4daf-a926-abb8701b7cef" />



## 📝 Próximas Mejoras

- [x] ✅ Notificaciones de escritorio con sonido
- [x] ✅ Sistema de threshold configurable
- [x] ✅ IPC seguro con contextBridge
- [x] ✅ Almacenamiento de estadísticas (localStorage)
- [x] ✅ Tracking automático de tiempo por postura
- [x] ✅ Dashboard de estadísticas en tiempo real
- [x] ✅ Recordatorios de pausas activas programables
- [x] ✅ Sistema de configuración funcional con persistencia
- [x] ✅ Sensibilidad ajustable del detector
- [x] ✅ Registro de eventos con timestamps (historial detallado)
- [x] ✅ Tabla interactiva de historial con colores
- [x] ✅ UI/UX profesional con Inter font y Feather Icons
- [x] ✅ Sistema de diseño con CSS variables
- [x] ✅ Micro-interacciones y animaciones suaves
- [x] ✅ Detección military-grade con 3 reglas estrictas
- [x] ✅ Sistema de feedback inteligente con mensajes específicos
- [ ] Análisis avanzado de ángulos de columna vertebral
- [x] ✅ Exportar datos históricos (CSV/JSON)
- [ ] Filtrado de historial por fecha/rango
- [ ] Gráficos de progreso diario/semanal
- [ ] Sugerencias de ejercicios de estiramiento
- [ ] Análisis de sesiones (inicio/fin/duración)
- [ ] Empaquetar y distribuir aplicación
