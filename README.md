# PLATA — Finanzas Personales ARS & USD

PLATA es una aplicación web progresiva (PWA) de finanzas personales diseñada especialmente para el contexto financiero argentino. Permite consolidar y gestionar de manera unificada cuentas en pesos (ARS) y dólares (USD), realizar transacciones, realizar simulaciones de trading de acciones e interactuar con un asesor financiero inteligente potenciado por IA.

---

## Características Principales

- **Gestión Multi-Moneda (ARS & USD):** Cuentas separadas con cálculo automático del saldo consolidado.
- **Registro de Actividad:** Seguimiento detallado de ingresos, gastos y transferencias entre cuentas.
- **Portafolio de Inversiones (Stocks):** Simulación de trading y visualización de cotizaciones de acciones.
- **PLATA AI (Asistente Financiero):** Integración nativa con la API de Gemini para responder preguntas, analizar tus gastos y brindar recomendaciones personalizadas de ahorro y presupuestos en base a tu contexto real de transacciones.
- **Sincronización en Tiempo Real:** Base de datos segura y persistente gestionada con Firebase Firestore.
- **Diseño Moderno e Inmersivo (Glassmorphism):** Interfaz optimizada tanto para dispositivos móviles como para computadoras de escritorio, con un diseño oscuro pulido y micro-animaciones fluidas.

---

## Stack Tecnológico

- **Frontend:** [Next.js](https://nextjs.org/) (App Router, Turbopack, SSR/Static rendering)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS & Iconos por Lucide React
- **Base de Datos & Auth:** Firebase (Authentication & Cloud Firestore)
- **Motor de IA:** API de Gemini (gemma/gemini a través del backend de Next.js)
- **Gestor de Paquetes / Entorno:** Bun

---

## Requisitos Previos

- Tener instalado [Bun](https://bun.sh/) (gestor de paquetes y ejecutable rápido de JavaScript).
- Una cuenta de Firebase con Firestore habilitado.
- Una API Key de Gemini (Google AI Studio).
- Una API Key de Finnhub (para cotización de acciones).

---

## Configuración y Despliegue Local

### 1. Clonar el repositorio y acceder
```bash
git clone <url-del-repositorio>
cd personal-finance-pwa
```

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo `.env.example` y renómbralo a `.env.local`:
```bash
cp .env.example .env.local
```
Completa las claves necesarias en `.env.local`:
- `GEMINI_API_KEY`: Tu API Key de Google Studio para PLATA AI.
- Variables `NEXT_PUBLIC_FIREBASE_*`: Las credenciales de configuración de tu aplicación web de Firebase.
- `FINNHUB_API_KEY`: API Key para obtener cotizaciones de mercado.

### 3. Instalar Dependencias
Utiliza `bun` para una instalación rápida y eficiente:
```bash
bun install
```

### 4. Iniciar Servidor de Desarrollo
```bash
bun dev
```
La aplicación estará disponible localmente en [http://localhost:3000](http://localhost:3000).

### 5. Compilar para Producción
Para validar y generar una compilación optimizada:
```bash
bun run build
bun start
```

---

## Estructura del Proyecto

- `app/`: Rutas, layouts y controladores de API de Next.js (App Router).
- `components/`: Componentes modulares de React.
  - `finance/`: Toda la lógica visual y de estado de la aplicación financiera (paneles, transacciones, advisor, etc.).
  - `ui/`: Componentes base reutilizables.
- `lib/`: Utilidades generales y formateadores de datos.
- `public/`: Assets estáticos, íconos y assets de PWA.

---

## Licencia

Este proyecto es privado. Todos los derechos reservados.
