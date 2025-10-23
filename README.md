# ActiveBreakApp

Aplicación de Pausas Activas con Detección de Postura en Tiempo Real

## 🎯 Características

- ✅ **Detección de Postura en Tiempo Real**: Usando MoveNet (TensorFlow.js)
- ✅ **Visualización de Skeleton**: Overlay profesional con 17 puntos clave
- ✅ **Análisis Automático**: Clasificación de postura correcta/incorrecta
- ✅ **Interfaz Moderna**: UI oscura con feedback visual en tiempo real
- 🚧 **Estadísticas** (próximamente): Seguimiento histórico de postura
- 🚧 **Notificaciones** (próximamente): Alertas de escritorio para mala postura

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

**Versión**: 2.0  
**Estado**: Core AI Implementation Complete ✅

Ver `project-purpose.md` para más detalles técnicos.

## 🎮 Cómo Funciona

1. **Detección**: El modelo MoveNet analiza cada frame del video en tiempo real
2. **Keypoints**: Identifica 17 puntos clave del cuerpo humano
3. **Análisis**: Verifica si la nariz está alineada entre los hombros
4. **Feedback**: Muestra estado en tiempo real:
   - ✅ Verde: Postura Correcta
   - ⚠️ Rojo: Postura Incorrecta

## 📝 Próximas Mejoras

- [ ] Notificaciones de escritorio
- [ ] Almacenamiento de estadísticas
- [ ] Análisis avanzado de postura (ángulos de columna)
- [ ] Recordatorios de pausas activas
- [ ] Exportar datos históricos
