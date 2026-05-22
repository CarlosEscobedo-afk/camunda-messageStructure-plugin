# Reglas Completas de Domain-Driven Modeling (DDM)
> Sintetizado desde: Thoughtworks (2021), TU Darmstadt – EiSE WS11, Visual Paradigm UML Class Diagram Tutorial, y ejemplos de diagramas UML (Class Diagram Overview, Implementation Elements, Object Diagram).

---

## 1. ¿Qué es un Domain Model?

Un **Domain Model** (también llamado *conceptual model*, *domain object model* o *analysis object model*) es una representación visual estructurada de los conceptos interconectados o los objetos del mundo real de un dominio. Incorpora el vocabulario, los conceptos clave, los comportamientos y las relaciones entre todas sus entidades.

> "A domain is a collection of related concepts, relationships, and workflows."

El Domain Model se crea durante el **análisis orientado a objetos** para descomponer el dominio en conceptos o clases conceptuales del mundo real. Es la base para el diseño del software.

---

## 2. Cuándo y para qué hacer Domain Modeling

| Pregunta | Respuesta |
|---|---|
| **¿Por qué?** | Ayuda a identificar los conceptos e ideas relevantes del dominio antes de codificar |
| **¿Cuándo?** | Durante el análisis orientado a objetos, al inicio del proyecto, de manera iterativa |
| **¿Qué produce?** | Un modelo conceptual en perspectiva, base del modelo de diseño |
| **¿Qué NO incluye?** | Operaciones/métodos (solo en el modelo de diseño), detalles de implementación |

**Regla:** Crear un domain model únicamente para las tareas en cuestión (*Only create a domain model for the tasks at hand*).

---

## 3. Reglas para Identificar Clases Conceptuales

### Estrategia A — Reutilizar o modificar un modelo existente
Antes de crear desde cero, buscar modelos de dominio existentes (ej. modelos de análisis de patrones de Martin Fowler) y adaptarlos al contexto actual.

### Estrategia B — Usar una lista de categorías
Recorrer categorías estándar para identificar candidatos:

| Categoría | Ejemplos (Sistema POS) |
|---|---|
| Transacciones de negocio | Venta, Pago |
| Ítems de línea de transacción | SalesLineItem |
| Productos o servicios | Item |
| Lugar de la transacción | Tienda, Register |
| Roles de personas u organizaciones | Cajero, Cliente |
| Eventos importantes con fecha/hora | Venta, Pago |
| Clases de descripción | ProductDescription |

### Estrategia C — Análisis lingüístico (Noun Phrase Analysis)
Identificar los **sustantivos y frases nominales** en descripciones textuales del dominio y considerarlos candidatos a clases conceptuales o atributos.

**Ejemplo:**
> "A customer arrives at a checkout with items to purchase. The cashier uses the POS system to record each item..."

→ Candidatos: `Customer`, `Item`, `Cashier`, `Store`, `Payment`, `SalesLineItem`, `Inventory`, `Receipt`, `Sale`

**Advertencia:** El mapeo sustantivo→clase no es mecánico. Las palabras en lenguaje natural son ambiguas: el mismo sustantivo puede significar cosas distintas y distintos sustantivos pueden referir al mismo concepto.

---

## 4. Reglas para Decidir qué Incluir en el Modelo

### 4.1 ¿Clase o Atributo?
**Regla de oro:** Si en el mundo real no concebimos el concepto X como un número, fecha o texto, entonces X probablemente es una **clase conceptual**, no un atributo.

| Caso | Decisión |
|---|---|
| `destination` en un sistema de reservas de vuelos | **Clase** (`Airport`) — un aeropuerto es un edificio en un lugar, no solo texto |
| `name` de un aeropuerto | **Atributo** — es simplemente texto |
| número de teléfono compuesto de secciones | **Clase** — tiene estructura propia |
| monto de pago con unidad de moneda | **Clase** — la cantidad lleva unidad asociada |

### 4.2 ¿Incluir clases de tipo "reporte"?
Una clase que solo reporta información derivada de otras (ej. `Receipt` = reporte de `Sale` + `Payment`) **generalmente NO debe incluirse**.  
**Excepción:** si tiene semántica propia en el negocio (ej. para manejar devoluciones, un `Receipt` sí tiene relevancia independiente).

### 4.3 ¿Cuándo incluir una Clase de Descripción?
Incluir cuando:
- Necesita existir una descripción de un ítem o servicio **independientemente** de la existencia de ejemplos de ese ítem.
- Eliminar instancias del objeto descrito resultaría en **pérdida de información** relevante.
- Reduce **información redundante o duplicada**.

**Ejemplo:** `ProductDescription` almacena precio, imagen y texto; persiste aunque no haya ítems de ese producto en inventario.

### 4.4 ¿Incluir una Asociación?
**Regla de oro:** Incluir asociaciones en el domain model cuando el **conocimiento de la relación necesita preservarse por alguna duración**.

Incluir cuando la asociación es de tipo:
- A es una transacción relacionada con otra transacción B
- A es un ítem de línea de una transacción B
- A es un producto/servicio para una transacción B
- A es un rol relacionado con una transacción B
- A es parte física o lógica de B

**No incluir** si la relación es transitoria (ej. un Cajero que consulta una ProductDescription no necesita una asociación persistente).

---

## 5. Notación UML para Domain Models

El Domain Model se visualiza usando el **subconjunto del diagrama de clases UML** (sin operaciones en la perspectiva conceptual pura).

### 5.1 Estructura de una Clase

```
┌─────────────────────┐
│      NombreClase     │  ← Nombre (único campo obligatorio)
├─────────────────────┤
│ atributo: Tipo       │  ← Atributos (perspectiva especificación/implementación)
│ /derivado: Tipo      │  ← Atributo derivado (prefijo "/")
├─────────────────────┤
│ +operacion(): Retorno│  ← Operaciones (solo en modelo de diseño)
└─────────────────────┘
```

**Visibilidad de atributos y operaciones:**

| Símbolo | Significado |
|---|---|
| `+` | Public |
| `-` | Private |
| `#` | Protected |
| `~` | Package |

**Dirección de parámetros:** `in`, `out`, `inout` — se escribe antes del nombre del parámetro.

### 5.2 Perspectivas del Diagrama de Clases

| Perspectiva | Cuándo se usa | Qué incluye |
|---|---|---|
| **Conceptual** | Domain modeling / análisis | Clases y relaciones del mundo real; sin operaciones |
| **Especificación** | Análisis y diseño temprano | Interfaces de tipos abstractos |
| **Implementación** | Diseño detallado | Cómo las clases implementan sus interfaces |

---

## 6. Tipos de Relaciones entre Clases

### 6.1 Asociación (Association)
Relación estructural entre dos clases peer. Representada con una **línea sólida**.

**Reglas de nomenclatura:**
- Formato: `NombreClaseA VerbPhrase NombreClaseB`
- El verbo debe ser **específico y significativo**
- ✅ Correcto: `Sale Paid-by CashPayment`, `Player Is-on Square`
- ❌ Incorrecto: `Sale Uses CashPayment` ("Uses" es genérico), `Player Has Square` ("Has" no aporta significado)

### 6.2 Multiplicidad (Multiplicity / Cardinality)
Define cuántas instancias de la clase A pueden asociarse con una instancia de la clase B en un momento dado.

| Notación | Significado |
|---|---|
| `1` | Exactamente uno |
| `*` | Cero o más |
| `0..1` | Cero o uno (opcional) |
| `1..*` | Uno o más |
| `2..3` | Entre dos y tres |
| `1,2` | Uno o dos |
| `0..12` | Entre cero y doce |

**Ejemplo del diagrama Library:**
- `Account` puede tener `0..12` `BookItem` prestados
- `Account` puede tener `0..3` `BookItem` reservados
- Una `Library` agrega `*` `Account` (muchas cuentas)

### 6.3 Generalización / Herencia (Generalization / Inheritance)
Relación "es-un" (is-a). Representada con una **línea sólida con flecha hueca** apuntando al padre.

- El nombre de una clase abstracta se escribe en **cursiva**
- Las subclases heredan atributos, operaciones y relaciones del padre
- **Ejemplo del diagrama:** `Book` (abstracta) ← `BookItem` (estereotipado como `«entity»`)

### 6.4 Agregación (Aggregation)
Relación "parte de" (part-of) débil. Representada con **línea sólida y diamante hueco (◇)** en el extremo del todo.

- Las instancias tienen **ciclos de vida independientes**
- El todo puede existir sin las partes y viceversa
- **Ejemplo del diagrama:** `Library ◇── Account` (la Library agrega cuentas, pero las cuentas pueden existir conceptualmente sin la Library)

### 6.5 Composición (Composition)
Agregación fuerte. Representada con **línea sólida y diamante relleno (◆)** en el extremo del todo.

- Los objetos de la parte **viven y mueren** con el todo
- La parte **no puede existir** independientemente
- **Ejemplo del diagrama:** `Library ◆── Catalog` (el catálogo no puede existir sin la Library) y `Library ◆── Search interface`
- **Analogía:** una hoja no puede existir sin el árbol

### 6.6 Dependencia (Dependency)
Relación donde un objeto de una clase **usa** un objeto de otra, pero no lo almacena en un campo. Representada con **línea discontinua con flecha abierta (-->)**.

- Si cambia la definición de una clase, puede afectar a la otra (pero no al revés)
- **Ejemplo del diagrama:** `Patron «use»→ Search`, `Librarian «use»→ Search`, `Librarian «use»→ Manage`
- **Ejemplo de implementación:** `CameraDemo` usa `android.hardware::Camera`; `Preview` usa `android.view::SurfaceHolder.Callback`

### 6.7 Realización / Interface Realization (Realization)
Relación entre una clase y la interfaz que implementa. Representada con **línea discontinua con flecha hueca (--▷)**.

- **Ejemplo del diagrama Library:** `Library` realiza `«interface» Search` y `«interface» Manage`
- **Ejemplo de implementación:** `Preview` realiza `android.view::SurfaceHolder.Callback`

---

## 7. Elementos Especiales de Notación

### 7.1 Estereotipos (Stereotypes)
Extienden el significado de un elemento UML. Se muestran entre comillas angulares (`«»`).

| Estereotipo | Uso |
|---|---|
| `«entity»` | Clase que representa una entidad persistente del dominio |
| `«interface»` | Define un contrato de comportamiento sin implementación |
| `«enumeration»` | Tipo de dato con valores fijos listados |
| `«create»` | Operación que actúa como constructor |

**Ejemplo del diagrama:** `«entity» BookItem`, `«entity» Account`, `«interface» Search`, `«enumeration» AccountState`

### 7.2 Enumeraciones
Tipo de dato especial con valores predefinidos.

```
«enumeration»
AccountState
──────────────
Active
Frozen
Closed
```

### 7.3 Atributos con Identificador
Un atributo marcado como `{id}` actúa como identificador único de la instancia.

**Ejemplo:** `ISBN: String[0..1] {id}`, `barcode: String[0..1] {id}`, `number {id}`

### 7.4 Atributos Derivados
Se prefijan con `/`. Su valor se calcula a partir de otros atributos.

**Ejemplo:** `/bonus: Percentage` (calculado como suma relativa de puntos de ejercicio)

### 7.5 Restricciones de Multiplicidad de Atributos
`[0..1]` indica que el atributo es opcional (puede estar ausente).  
`[0..*]` indica una colección de cero o más valores.

**Ejemplo:** `history: History[0..*]`

---

## 8. Reglas para los Atributos del Domain Model

1. Los atributos deben ser preferiblemente **tipos de datos primitivos** (respecto al dominio): Boolean, Date, Number, Character, String, Address, Color, PhoneNumber.

2. **Modelar cantidades como clases** si necesitan unidades asociadas (ej. `amount: Money` en lugar de `amount: Number`).

3. Considerar definir una **nueva clase de tipo de dato** para algo inicialmente considerado string si:
   - El string está compuesto de secciones separadas (ej. número de teléfono)
   - Tiene operaciones propias (ej. número de seguro social)
   - Tiene atributos propios
   - Es una cantidad con unidad

4. **Usar asociaciones** para modelar dependencias entre clases conceptuales; **no usar atributos** para representar relaciones.

5. Evitar atributos que representen otra clase conceptual (ej. en un vuelo, `destination` debe ser la clase `Airport`, no un atributo `String`).

---

## 9. Object Diagram (Diagrama de Objetos)

El diagrama de objetos es una **instancia** del diagrama de clases en un momento específico. Muestra objetos concretos y sus valores.

### 9.1 Notación de Instancias

```
nombreInstancia: NombreClase
─────────────────────────────
atributo = valor
```

| Elemento | Descripción |
|---|---|
| `log: Logger` | Instancia nombrada de clase Logger |
| `: UserManager` | Instancia anónima de interfaz UserManager |
| `defaultURI: String = "/users/profile"` | Instancia nombrada con value specification |
| `i` (colección con `{5 ordered, unique}`) | Colección de 5 instancias anónimas únicas |

### 9.2 Links (Vínculos entre Objetos)
- **Link navegable hacia adelante (→):** Se puede navegar de A hacia B
- **Link no navegable hacia atrás (←×):** No se puede navegar en esa dirección
- Los links son instancias de asociaciones del diagrama de clases

### 9.3 Slots con Value Specification
Los valores de los atributos en instancias se denominan *slots*:

```
loginCtrl: LoginController
──────────────────────────
-attemptLimit: Integer = 5
-lockoutTime: Integer = 30
-loginURI = "/users/sign-in"
```

---

## 10. Diagrama de Clases de Implementación

En la perspectiva de implementación (ej. Android SDK), el diagrama de clases incluye elementos adicionales:

### 10.1 Atributos de Clase (Class Attributes)
Se indican con subrayado o prefijo `~` para distinguirlos de atributos de instancia.

### 10.2 Operaciones Derivadas
Prefijadas con `/`. Indican que el valor o resultado se calcula.

### 10.3 Modificador `{final}`
Indica que una operación no puede ser sobreescrita.

### 10.4 Constructores
Marcados con el estereotipo `«create»`.

### 10.5 Navegabilidad de Asociaciones
- `~ camera`: nombre del rol en la asociación
- `~ preview`: nombre del rol de otra asociación en el extremo opuesto

---

## 11. Proceso Paso a Paso para Construir un Domain Model

### Paso 1: Identificar Entidades
Enumerar todo lo que es **único, identificable y existe** en el dominio.

**Técnica lingüística:** identificar sustantivos y frases nominales en la descripción textual del dominio.

### Paso 2: Establecer Relaciones entre Entidades
- Conectar entidades con líneas
- Agregar un **verbo** en la línea que describa la relación
- Definir la **multiplicidad** en cada extremo

### Paso 3: Agregar Atributos
- Agregar solo los atributos necesarios para satisfacer los requisitos de información del escenario actual
- Usar tipos primitivos o de dominio
- Marcar atributos derivados con `/`
- Marcar identificadores con `{id}`

### Paso 4: Refinar el Modelo Iterativamente
- El domain model se completa iterativamente
- Revisar con stakeholders usando el **vocabulario del dominio**
- Evitar nombres genéricos del sistema; usar términos del negocio (ej. `Borrower` en lugar de `Customer` para un sistema de biblioteca)

---

## 12. Del Domain Model al Modelo de Diseño

El domain model sirve como **fuente de inspiración** para el modelo de diseño. La brecha representacional entre los conceptos del dominio y el programa es relativamente pequeña si se usa el domain model directamente.

| Domain Model | Design Model |
|---|---|
| `Sale` (fecha, hora) | `Sale` (date: Date, startTime: Time, getTotal(): Money) |
| `Payment` (monto) | `Payment` (amount: Money, getBalance(): Money) |
| Asociación `Sale 1──1 Payment` | Misma asociación con tipos implementados |

**Regla:** Las clases conceptuales del domain model se convierten en clases de software con la misma estructura, pero añadiendo operaciones, tipos precisos y visibilidad.

---

## 13. Antipatrones a Evitar

| Antipatrón | Corrección |
|---|---|
| Modelar como atributo algo que es una clase en el mundo real | Convertirlo a clase conceptual y asociarlo |
| Usar "Has" o "Uses" como nombre de asociación | Usar verbos específicos del dominio |
| Incluir operaciones en el domain model conceptual | Reservar operaciones para el modelo de diseño |
| Agregar todas las asociaciones posibles | Solo incluir las que necesitan preservarse |
| Usar nombres técnicos del sistema | Usar vocabulario del dominio de negocio |
| Modelar una clase de reporte con información completamente derivada | Evaluarlo: incluir solo si tiene semántica de negocio propia |

---

## 14. Resumen de Elementos Visuales UML

| Elemento | Notación |
|---|---|
| Clase concreta | Rectángulo con 1-3 compartimentos |
| Clase abstracta | Nombre en *cursiva* |
| Clase estereotipada | `«estereotipo»` sobre el nombre |
| Asociación simple | Línea sólida |
| Generalización | Línea sólida + flecha hueca → padre |
| Agregación | Línea sólida + ◇ en el todo |
| Composición | Línea sólida + ◆ en el todo |
| Dependencia | Línea discontinua + flecha abierta → |
| Realización | Línea discontinua + flecha hueca → interfaz |
| Multiplicidad | Números/asteriscos en los extremos de la línea |
| Navegabilidad | Flecha en el extremo navegable |
| No navegabilidad | `×` en el extremo no navegable |
| Atributo derivado | `/nombreAtributo` |
| Identificador | `{id}` junto al atributo |
| Restricción | `{descripción}` junto al elemento |

---

*Fuentes: Thoughtworks Blog (Rodríguez, 2021) · TU Darmstadt EiSE WS11-07 (Eichberg) · Visual Paradigm UML Class Diagram Tutorial · Ejemplos de diagramas UML: Library Domain Overview, Android CameraDemo Implementation, Login Object Diagram*
