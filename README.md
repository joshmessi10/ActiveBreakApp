# ActiveBreakApp

Aplicación de Pausas Activas con Detección de Postura en Tiempo Real

## 🎯 Características

- ✅ **Detección de Postura en Tiempo Real**: Usando MoveNet (TensorFlow.js)
- ✅ **Visualización de Skeleton**: Overlay profesional con 17 puntos clave
- ✅ **Análisis Automático**: Clasificación de postura correcta/incorrecta
- ✅ **Notificaciones de Escritorio**: Alertas nativas con sonido después de 3 segundos de mala postura
- ✅ **Seguimiento de Estadísticas**: Tracking automático de tiempo en cada postura (localStorage)
- ✅ **Dashboard Interactivo**: Visualización de datos en formato mm:ss
- ✅ **Interfaz Moderna**: UI oscura con feedback visual en tiempo real
- 🚧 **Recordatorios de Pausas** (próximamente): Sistema de break timers
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

**Versión**: 4.0  
**Estado**: Core Features Complete! 🎉 (AI + Notifications + Data Tracking)

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

## 📝 Próximas Mejoras

- [x] ✅ Notificaciones de escritorio con sonido
- [x] ✅ Sistema de threshold (3 segundos)
- [x] ✅ IPC seguro con contextBridge
- [x] ✅ Almacenamiento de estadísticas (localStorage)
- [x] ✅ Tracking automático de tiempo por postura
- [x] ✅ Dashboard de estadísticas en tiempo real
- [ ] Registro de eventos con timestamps (historial detallado)
- [ ] Análisis avanzado de postura (ángulos de columna)
- [ ] Recordatorios de pausas activas programables
- [ ] Exportar datos históricos (CSV/JSON)
- [ ] Configuración de sensibilidad funcional
- [ ] Gráficos de progreso diario/semanal
