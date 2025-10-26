# ActiveBreakApp

Aplicación de Pausas Activas con Detección de Postura en Tiempo Real

## 🎯 Características

- ✅ **Sistema de Autenticación (Mockup)**: Flujo Admin/Client con login y registro (UI only, in-memory)
- ✅ **Detección de Postura en Tiempo Real**: Usando MoveNet (TensorFlow.js)
- ✅ **Visualización de Skeleton**: Overlay profesional con 17 puntos clave
- ✅ **Análisis Militar-Grade**: 3 reglas estrictas (alineación horizontal 15%, vertical 50%, simetría de hombros 10%)
- ✅ **Feedback Inteligente**: Mensajes específicos según el tipo de error detectado
- ❌ **Notificaciones Configurables**: Alertas nativas con sonido (umbral ajustable 1-60s) - **IPC ROTO (triple error: método + canal + mecanismo)**
- ❌ **Recordatorios de Pausas**: Sistema automático cada N minutos (5-120 min) - **IPC ROTO (mismo error)**
- ✅ **Seguimiento de Estadísticas**: Tracking automático de tiempo en cada postura (solo sesión actual)
- ✅ **Historial Completo**: Registro de eventos con fecha y hora (últimos 100 cambios, se borra al reiniciar)
- ✅ **Dashboard Interactivo**: Visualización de datos y tabla de historial
- ✅ **Sistema de Configuración**: Sensibilidad, notificaciones, umbrales personalizables
- ✅ **Interfaz Profesional**: UI moderna con fuente Inter, iconos Feather, y micro-interacciones
- ✅ **Sistema de Diseño**: Variables CSS, paleta refinada, transiciones suaves
- ✅ **Exportar Datos**: Descarga histórico en CSV (implementado en modal de estadísticas de sesión)

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

**Versión**: 7.0  
**Estado**: Production Ready (Core) + Auth Mockup! 🎉

**Componentes**:

- ✅ Core AI App (Military-Grade Detection + Smart Feedback + Data + Settings + History)
- ✅ Professional UI/UX (Inter Font + Feather Icons + CSS Variables)
- 🎭 Authentication System (UI Mockup - In-Memory, No Database)

Ver `project-purpose.md` para más detalles técnicos.

---

## ⚠️ IMPORTANTE: Actualizar main.js

Para usar el nuevo flujo de autenticación, **debes actualizar `main.js`**:

**Cambiar de:**

```javascript
mainWindow.loadFile("public/index.html");
```

**Cambiar a:**

```javascript
mainWindow.loadFile("public/landing.html");
```

Esto carga la página de inicio (`landing.html`) como punto de entrada, permitiendo el flujo Admin/Client.

## ⚠️ **ADVERTENCIAS IMPORTANTES**

### 🚨 Problemas Conocidos (POST-AUDITORÍA v2.0)

#### **1. Notificaciones No Funcionan** ❌ (Bug Crítico - Prioridad 1)

Existe un **triple error de IPC** (Inter-Process Communication):

- **Problema 1 - Nombre del Método**:
  - `script.js` llama a `window.api.sendNotification()` (no existe)
  - `preload.js` expone `window.api.notify()` (nombre diferente)
- **Problema 2 - Canal IPC**:
  - `preload.js` usa canal `"notify"`
  - `main.js` escucha en canal `"notify:posture"` (no coinciden)
- **Problema 3 - Mecanismo IPC**:
  - `preload.js` usa `ipcRenderer.invoke()` (asíncrono)
  - `main.js` usa `ipcMain.on()` (síncrono)

**Impacto**:

- ❌ Las alertas de mala postura **nunca se disparan**
- ❌ Los recordatorios de descanso **nunca se disparan**
- ✅ La lógica de detección funciona (pero no puede comunicarse con el proceso principal)

**Ubicación del Bug**:

- `script.js` líneas 229, 315
- `preload.js` línea 5
- `main.js` línea 26

**Estado**: Requiere corrección coordinada en 3 archivos

---

#### **2. Estadísticas Se Borran en Cada Sesión** ⚠️ (Comportamiento No Persistente)

La app **borra TODAS las estadísticas** al iniciar:

**Código Responsable** (`script.js` líneas 459-468):

```javascript
(function resetSession() {
  localStorage.setItem("correctSeconds", "0");
  localStorage.setItem("incorrectSeconds", "0");
  localStorage.setItem("alertsCount", "0");
  localStorage.setItem("postureHistory", "[]");
  localStorage.setItem("alertsHistory", "[]");
})();
```

**Impacto**:

- ⚠️ **NO puedes ver tu progreso histórico** entre sesiones
- ⚠️ Cada vez que cierras y abres la app, todo vuelve a 0
- ⚠️ El historial de eventos se vacía completamente
- ✅ Durante una sesión activa, las estadísticas funcionan correctamente

**Estado**: Comportamiento intencional del código actual (pero no deseable)

### ✅ Lo Que Sí Funciona

- ✅ Detección de postura en tiempo real con IA (MoveNet Lightning)
- ✅ Visualización de skeleton con overlay de 17 puntos
- ✅ Clasificación military-grade con 3 reglas estrictas (15%, 50%, 10%)
- ✅ Feedback visual inteligente (mensajes específicos en pantalla)
- ✅ Tracking de estadísticas durante la sesión actual
- ✅ Registro de eventos con timestamps (últimos 100 cambios)
- ✅ Configuración personalizable (se guarda correctamente entre sesiones)
- ✅ Sistema de autenticación (UI mockup, in-memory)
- ✅ Detección de cámara y video feed
- ✅ Dashboard de estadísticas (solo sesión actual)

### ❌ Lo Que NO Funciona (Bugs Confirmados)

- ❌ **Notificaciones de escritorio** (triple error de IPC: método + canal + mecanismo)
- ❌ **Recordatorios de descanso** (mismo error de IPC)
- ❌ **Persistencia de estadísticas** (se borran intencionalmente al reiniciar)

### ⚙️ Evaluación Técnica Honesta

**Estado de Funcionalidad**:

- ✅ **Core AI (Detección de Postura)**: 100% funcional
- ❌ **Sistema de Notificaciones**: 0% funcional (IPC roto)
- ⚠️ **Persistencia de Datos**: 0% entre sesiones (100% durante sesión activa)
- ✅ **Configuración y UI**: 100% funcional

**Resultado Global**: ~60% de las características anunciadas funcionan correctamente

---

## 🎮 Cómo Funciona

### Flujo de Autenticación (Nuevo)

1. **Inicio en `landing.html`**: Página de entrada con opciones:
   - 👔 **Admin**: Acceso a panel administrativo (mockup)
   - 👤 **Client**: Acceso a la aplicación de detección de postura
2. **Login/Registro**: Formularios de autenticación (solo UI, sin base de datos)
3. **Redirección**:
   - Admin → `admin-welcome.html` (dashboard placeholder)
   - Client → `client-ready.html` → `index.html` (app principal)

### Detección de Postura (Core App)

1. **Detección**: El modelo MoveNet analiza cada frame del video en tiempo real
2. **Keypoints**: Identifica 17 puntos clave del cuerpo humano
3. **Análisis Military-Grade**: Aplica 3 reglas estrictas simultáneamente:
   - 🎖️ **Regla 1**: Alineación horizontal perfecta (tolerancia 15%)
   - 🎖️ **Regla 2**: Postura vertical erguida (50% altura sobre hombros)
   - 🎖️ **Regla 3**: Hombros nivelados (tolerancia 10% de inclinación)
4. **Feedback Inteligente**: Muestra mensajes específicos según el error:
   - ✅ Verde: "Postura Correcta"
   - ⚠️ Rojo: "Centra tu cabeza" / "Endereza tu espalda, siéntate erguido" / "Nivela tus hombros"
5. **Notificaciones**: ⚠️ **ACTUALMENTE NO FUNCIONAN** (triple error de IPC) - Cuando se corrija:
   - 🔔 Notificación nativa del sistema operativo después de 3+ segundos de mala postura
   - 🔊 Sonido de alerta
   - ♻️ Se resetea automáticamente al corregir la postura
6. **Tracking Automático**: Cada segundo se registra:
   - ⏱️ Tiempo en postura correcta
   - ⏱️ Tiempo en postura incorrecta
   - ⚠️ **IMPORTANTE**: Datos se **borran al reiniciar la app** (no persisten entre sesiones)
7. **Estadísticas**: Ve tu progreso en la pestaña "Estadísticas" (solo sesión actual):
   - 📊 Tiempo total en cada postura (formato mm:ss)
   - 📈 Porcentajes y totales en consola
   - 📝 Historial de eventos con fecha/hora
   - 🎨 Eventos coloreados (verde/rojo) según tipo
   - ⏱️ Últimos 100 cambios de postura registrados
   - ⚠️ **Se borra todo al cerrar y reabrir la app** (`script.js` líneas 459-468)
   - 💾 Exportar a CSV (modal de estadísticas en vivo)
8. **Recordatorios de Descanso**: ⚠️ **ACTUALMENTE NO FUNCIONAN** (triple error de IPC) - Cuando se corrija:
   - ⏰ Notificación recordando tomar un descanso cada N minutos
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
<img width="640" alt="Admin2" src="https://github.com/user-attachments/assets/f51a04d1-3e48-4c04-a091-b02a3175aad3" />
<img width="640" alt="Admin3" src="https://github.com/user-attachments/assets/2a7beca7-089f-43aa-9bbf-344cc5ecf0e2" />

### Client Login

<img width="640" alt="Client1" src="https://github.com/user-attachments/assets/33cb3901-c60e-40c8-8672-e3dc80d9c6f3" />
<img width="640" alt="Client2" src="https://github.com/user-attachments/assets/28718d6d-6c27-403e-bd88-3d8b3c5805f8" />
<img width="640" alt="Client3" src="https://github.com/user-attachments/assets/dc28354b-39fa-479e-a499-a77d47b2e530" />

### Download

<img width="640" alt="Download" src="https://github.com/user-attachments/assets/a6b5ede4-c994-425b-98d3-e08944df0397" />

### Main Page

<img width="640" alt="Main1" src="https://github.com/user-attachments/assets/e11347a8-c9bb-4eb8-9517-b667e33eeb60" />
<img width="640" alt="Main2" src="https://github.com/user-attachments/assets/2ace1ca2-d70f-486e-86c2-39aa6329cd61" />

### Settings

<img width="640" alt="Settings1" src="https://github.com/user-attachments/assets/b82b930b-ed71-4daf-a926-abb8701b7cef" />

## 📝 Próximas Mejoras

### 🚨 **Prioridad Crítica (Bugs a Corregir PRIMERO)**

- [ ] **Arreglar sistema de notificaciones IPC** (triple mismatch confirmado):
  - **Problema 1**: Alinear nombres de métodos (`sendNotification` vs `notify`)
  - **Problema 2**: Alinear canales IPC (`"notify"` vs `"notify:posture"`)
  - **Problema 3**: Alinear mecanismos (`invoke/handle` vs `send/on`)
  - **Archivos afectados**: `script.js` (líneas 229, 315), `preload.js` (línea 5), `main.js` (línea 26)
- [ ] **Hacer estadísticas persistentes** (actualmente se borran al reiniciar):
  - Remover o hacer opcional la función `resetSession()` en `script.js` (líneas 459-468)
  - O documentar claramente que las estadísticas son solo de sesión

### ✅ **Características Completadas (Verificadas por Auditoría)**

- [x] ✅ Sistema de threshold configurable
- [x] ✅ IPC seguro con contextBridge (implementado, pero con triple bug: método + canal + mecanismo)
- [x] ✅ Almacenamiento de estadísticas en localStorage (funciona durante sesión, se resetea al iniciar)
- [x] ✅ Tracking automático de tiempo por postura
- [x] ✅ Dashboard de estadísticas en tiempo real
- [x] ✅ Sistema de configuración funcional con persistencia
- [x] ✅ Sensibilidad ajustable del detector
- [x] ✅ Registro de eventos con timestamps (historial detallado)
- [x] ✅ Tabla interactiva de historial con colores
- [x] ✅ UI/UX profesional con Inter font y Feather Icons
- [x] ✅ Sistema de diseño con CSS variables
- [x] ✅ Micro-interacciones y animaciones suaves
- [x] ✅ Detección military-grade con 3 reglas estrictas (15%, 50%, 10%)
- [x] ✅ Sistema de feedback inteligente con mensajes específicos
- [x] ✅ Sistema de autenticación Admin/Client (mockup UI)
- [x] ✅ Exportar datos históricos (CSV desde modal de estadísticas de sesión)

### 🔮 **Mejoras Futuras**

- [ ] Conectar login a base de datos real
- [ ] Implementar backend con Node.js/Express
- [ ] Añadir JWT para sesiones seguras
- [ ] Sistema de roles y permisos (RBAC)
- [ ] Hash de contraseñas con bcrypt
- [ ] Panel de administración funcional
- [ ] Gestión de usuarios desde Admin dashboard
- [ ] Análisis avanzado de ángulos de columna vertebral
- [ ] Filtrado de historial por fecha/rango
- [ ] Gráficos de progreso diario/semanal
- [ ] Sugerencias de ejercicios de estiramiento
- [ ] Análisis de sesiones (inicio/fin/duración)
- [ ] Empaquetar y distribuir aplicación

---

**NOTA DE AUDITORÍA**: Este README fue actualizado el 26 de octubre de 2025 después de una auditoría QA completa línea por línea. Todas las características marcadas con ✅ han sido verificadas contra el código real. Todas las características marcadas con ❌ han sido confirmadas como no funcionales con explicación técnica del bug.
