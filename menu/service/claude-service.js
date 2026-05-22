const logger = require("../log/logger");
const path = require("path");
const fs = require("fs");

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function getClaudeConfig() {
  const configPath = path.resolve(__dirname, "../../config.json");
  let config;

  try {
    delete require.cache[require.resolve(configPath)];
    config = require(configPath);
  } catch (error) {
    const errorMsg =
      `Error al cargar config.json.\n\n` +
      `Ruta esperada: ${configPath}\n\n` +
      `Error: ${error.message}`;

    logger.log(errorMsg, "ERROR");
    throw new Error(errorMsg);
  }

  const apiKey = config.ANTHROPIC_API_KEY;
  const model = config.CLAUDE_MODEL || "claude-sonnet-4-5";

  if (!apiKey) {
    const errorMsg =
      "ANTHROPIC_API_KEY no está configurada en config.json.\n\n" +
      "Agrega ANTHROPIC_API_KEY en la raíz del plugin.";

    logger.log(errorMsg, "ERROR");
    throw new Error(errorMsg);
  }

  return {
    apiKey,
    model,
  };
}

function extractClaudeText(data) {
  if (!data || !Array.isArray(data.content)) {
    throw new Error("Respuesta inválida de Claude: no se encontró content.");
  }

  const text = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude respondió, pero no entregó contenido de texto.");
  }

  return text;
}

function cleanPlantUML(text) {
  return text
    .replace(/^```plantuml\s*/i, "")
    .replace(/^```uml\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function validatePlantUML(text) {
  if (!text || text.trim().length === 0) {
    throw new Error("La respuesta de Claude está vacía.");
  }

  if (!text.includes("@startuml")) {
    throw new Error("La respuesta de Claude no contiene @startuml.");
  }

  if (!text.includes("@enduml")) {
    throw new Error("La respuesta de Claude no contiene @enduml.");
  }
}
async function callClaude({
  systemPrompt,
  userPrompt,
  maxTokens = 8192,
  temperature = 0.2,
}) {
  const { apiKey, model } = getClaudeConfig();

  const payload = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  };

  const response = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData = null;

    try {
      errorData = await response.json();
    } catch (_) {
      errorData = null;
    }

    const providerMessage =
      errorData?.error?.message || response.statusText || "Error desconocido";

    throw new Error(`Error ${response.status}: ${providerMessage}`);
  }

  const data = await response.json();
  return extractClaudeText(data);
}

async function run(dataFieldsString = null) {
  const logs = [];
  const startTime = Date.now();

  try {
    logger.log("Claude Service iniciado");
    logs.push("Claude Service iniciado");

    let systemPrompt = `
You are an expert Systematic Derivation Engine specialized in deriving UML Class Diagrams from communication-oriented BPMN message structures. Use the following authoritative rules exactly when producing the output. Do not improvise beyond these rules.

INPUT FORMAT (accepted):
- You will receive a NORMALIZED JSON payload extracted from BPMN <bpmn:documentation> elements with this shape:
  { type: 'normalized', payload: [ { name, rawName, description, children: [ { name, originalType, type, domain, extends, multiplicity, relation, raw } ] } ] }
- Trust the normalized fields ('type', 'multiplicity', 'relation', 'extends') as hints. If a hint conflicts with structure, prefer explicit normalized hint.

HIGH-LEVEL TASK:
1) Derive a conceptual UML Class Diagram (domain model) from the normalized payload.
2) Merge duplicate/identical classes into one definition.
3) Produce the final result as PlantUML only.

NAMING RULES:
- Class names: use PascalCase and singular form. Remove non-alphanumeric characters and convert spaces/underscores to PascalCase (e.g., 'ASIGNATURA OFRECIDA' -> 'AsignaturaOfrecida').
- Attribute names: use snake_case or preserve original tokenization but avoid spaces (use underscores). Use the child 'name' as attribute name.
- Role names: when adding a role label for an association, use the child's 'name' if meaningful.

CLASS & ATTRIBUTE DERIVATION:
- For each 'messageStructure' root (payload item) that is NOT marked as extension, create a class using 'messageStructure.name' (or an inferred non-primitive domain per heuristics below).
- For each child of type 'Data Field', add an attribute to the containing class. Map 'domain' values to primitive types: text->String, date/datetime->Date, number/int->Integer, float/double/decimal->Decimal, boolean->Boolean. If domain is absent, default to 'String'.
- If a child is marked 'identifier' or has 'identifier:true', mark that attribute conceptually as the identifier (no special PlantUML notation required beyond a comment if needed).

RELATIONSHIP RULES (apply in this order):
1. If child.type is 'Reference Field', create an association between the containing class (container) and the referenced class (domain). If referenced class does not yet exist, create it with no attributes initially.
2. If child.type is 'Aggregation' or 'Iteration' with nested 'children', derive the nested structure as a separate class and create an aggregation relationship (open diamond) from container to nested class.
3. If child.type is 'Structure' and is nested tightly (no identity independent of parent), prefer composition (filled diamond).

CARDINALITY RULES:
- If 'multiplicity' hint exists in the normalized child, use it literally (e.g., '0..*', '1', '*').
- Otherwise infer: 'Iteration' or collection -> parent "1" -- "0..*" child; Reference fields -> parent "0..*" -- "1" referenced; Data fields -> attributes (no association).
- Use minimum default '0' when optional information exists (e.g., non-identifier fields) and '1' for mandatory identifiers.

MERGING & DEDUPLICATION:
- If multiple messageStructures or children refer to the same domain name (case-insensitive after normalization), merge their attributes into a single class definition and deduplicate attributes by name.

HERITANCE:
- If the first child of a messageStructure is a 'Reference Field' with 'extends:true' (or 'extends' hint), then treat the messageStructure as an extension of the referenced class (do not create a new class; instead add attributes/relationships to the referenced class). Use generalization arrow ('<|--') with subclass on the left if explicit sub/super names are provided.

OUTPUT & FORMAT RULES (MUST FOLLOW EXACTLY):
- Output only valid PlantUML code. Start with '@startuml' and end with '@enduml'.
- Include the line 'skinparam ClassAttributeIconStyle none' near the top.
- Use 'class ClassName { ... }' blocks for each class; list attributes as 'attribute_name: Type'.
- Use association notation for relationships: composition '*--', aggregation 'o--', association '--', and generalization ' <|-- '.
- Always annotate associations with multiplicities in quotes on both ends, and include a role label after a colon when available: 'A "1" *-- "0..*" B : items'.
- Do NOT include explanatory text, markdown, comments, or anything outside PlantUML.

VALIDATION:
- Ensure every class referenced in a relationship is defined exactly once.
- Ensure relationships are not duplicated; merge equivalent relationships.

ERROR HANDLING:
- If the input is empty or malformed, return a minimal PlantUML diagram with a single class 'EmptyDiagram' and a comment-free minimal structure but still valid PlantUML.

EXAMPLE (format only):
@startuml
skinparam ClassAttributeIconStyle none
class Foo {\n  id: Integer\n}
class Bar {\n  name: String\n}
Foo "1" *-- "0..*" Bar : bars
@enduml

Now, given the normalized JSON payload that will be provided as the user prompt, generate the PlantUML following these rules.
`.trim();

    // Try to load a project-provided DDM rules file and append it verbatim to the system prompt
    function loadDDMRules() {
      const candidates = [
        path.resolve(__dirname, "../DDM_Reglas_Completas.md"),
        path.resolve(__dirname, "../../DDM_Reglas_Completas.md"),
        path.resolve(__dirname, "../../docs/DDM_Reglas_Completas.md"),
        path.resolve(__dirname, "../../menu/DDM_Reglas_Completas.md"),
      ];

      for (const p of candidates) {
        try {
          if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, { encoding: "utf8" });
            return { path: p, content };
          }
        } catch (e) {
          // ignore and try next
        }
      }

      return null;
    }

    const ddm = loadDDMRules();
    if (ddm) {
      logger.log(
        `DDM rules file encontrado en ${ddm.path}; anexando al sistema prompt.`,
      );
      logs.push(`DDM rules appended from ${ddm.path}`);
      systemPrompt +=
        "\n\nFULL_DDM_RULES_VERBATIM_START\n" +
        ddm.content +
        "\nFULL_DDM_RULES_VERBATIM_END";
    } else {
      logger.log(
        "DDM_Reglas_Completas.md no encontrada; procediendo sin ella.",
        "WARN",
      );
      logs.push("DDM_Reglas_Completas.md no encontrada");
    }

    const userPrompt = dataFieldsString
      ? `INPUT NORMALIZED MESSAGE STRUCTURES (JSON):\n\n${dataFieldsString}`
      : "INPUT NORMALIZED MESSAGE STRUCTURES (JSON):\n\n[No se proporcionó contenido]";

    if (dataFieldsString) {
      logger.log(
        `Enviando BPMN XML a Claude para derivar diagrama UML, longitud: ${dataFieldsString.length}`,
      );
      logs.push(`BPMN XML preparado: ${dataFieldsString.length} caracteres`);
    } else {
      logger.log("Advertencia: No se proporcionó dataFieldsString", "WARN");
      logs.push("Advertencia: No se proporcionó dataFieldsString");
    }

    logger.log("Enviando petición a Claude API...");
    logs.push("Enviando petición a Claude API");

    const rawText = await callClaude({
      systemPrompt,
      userPrompt,
      maxTokens: 8192,
      temperature: 0.2,
    });

    const plantUMLText = cleanPlantUML(rawText);
    validatePlantUML(plantUMLText);

    logger.log(
      `Respuesta de Claude recibida: ${plantUMLText.length} caracteres`,
    );
    logger.log(
      "Primeros 200 caracteres de la respuesta: " +
        plantUMLText.substring(0, 200),
    );

    logs.push("Procesamiento completado exitosamente");
    logs.push(
      `Tiempo total de ejecución: ${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    );

    const { model } = getClaudeConfig();

    return {
      success: true,
      result: plantUMLText,
      logs,
      metadata: {
        provider: "claude",
        model,
        inputLength: dataFieldsString ? dataFieldsString.length : 0,
        outputLength: plantUMLText.length,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    let errorMessage = `Error al ejecutar Claude: ${error.message}`;

    if (error.stack && process.env.NODE_ENV === "development") {
      errorMessage += `\n\nStack trace:\n${error.stack}`;
    }

    if (error.message.includes("ANTHROPIC_API_KEY")) {
      errorMessage += "\n\n💡 Tip: Revisa ANTHROPIC_API_KEY en config.json.";
    } else if (error.message.includes("fetch")) {
      errorMessage +=
        "\n\n💡 Tip: Verifica tu conexión a internet y que la API key sea válida.";
    } else if (error.message.includes("429")) {
      errorMessage +=
        "\n\n💡 Tip: Se alcanzó un límite de uso o rate limit de Claude.";
    } else if (error.message.includes("401") || error.message.includes("403")) {
      errorMessage +=
        "\n\n💡 Tip: La API key puede ser inválida o no tener permisos.";
    }

    logger.log(errorMessage, "ERROR");
    logger.log(
      `Error completo: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`,
      "ERROR",
    );

    logs.push(`ERROR: ${errorMessage}`);
    logs.push(
      `Tiempo total de ejecución: ${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    );

    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    throw enhancedError;
  }
}
module.exports = {
  run,
};
