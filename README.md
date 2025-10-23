# ActiveBreakApp

Aplicación de Pausas Activas con Detección de Postura en Tiempo Real

## 🎯 Características

- ✅ **Detección de Postura en Tiempo Real**: Usando MoveNet (TensorFlow.js)
- ✅ **Visualización de Skeleton**: Overlay profesional con 17 puntos clave
- ✅ **Análisis Automático**: Clasificación de postura correcta/incorrecta
- ✅ **Notificaciones Configurables**: Alertas nativas con sonido (umbral ajustable 1-60s)
- ✅ **Recordatorios de Pausas**: Sistema automático cada N minutos (5-120 min)
- ✅ **Seguimiento de Estadísticas**: Tracking automático de tiempo en cada postura
- ✅ **Historial Completo**: Registro de eventos con fecha y hora (últimos 100 cambios)
- ✅ **Dashboard Interactivo**: Visualización de datos y tabla de historial
- ✅ **Sistema de Configuración**: Sensibilidad, notificaciones, umbrales personalizables
- ✅ **Interfaz Moderna**: UI oscura con feedback visual en tiempo real
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

## 📊 Estado del Proyecto

**Versión**: 6.0  
**Estado**: Production Ready! 🎉 (AI + Notifications + Data + Settings + History)

Ver `project-purpose.md` para más detalles técnicos.

## 🎮 Cómo Funciona

1. **Detección**: El modelo MoveNet analiza cada frame del video en tiempo real
2. **Keypoints**: Identifica 17 puntos clave del cuerpo humano
3. **Análisis**: Verifica si la nariz está alineada entre los hombros
4. **Feedback Visual**: Muestra estado en tiempo real:
   - ✅ Verde: Postura Correcta
   - ⚠️ Rojo: Postura Incorrecta
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
- [ ] Análisis avanzado de postura (ángulos de columna)
- [ ] Exportar datos históricos (CSV/JSON)
- [ ] Filtrado de historial por fecha/rango
- [ ] Gráficos de progreso diario/semanal
- [ ] Sugerencias de ejercicios de estiramiento
- [ ] Análisis de sesiones (inicio/fin/duración)
