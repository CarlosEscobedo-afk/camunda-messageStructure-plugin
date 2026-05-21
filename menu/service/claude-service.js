const logger = require("../log/logger");
const path = require("path");

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
async function callClaude({ systemPrompt, userPrompt, maxTokens = 8192, temperature = 0.2 }) {
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
      errorData?.error?.message ||
      response.statusText ||
      "Error desconocido";

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

    const systemPrompt = `
Act as a Systematic Derivation Engine based on the methodology described in "Systematic derivation of class diagrams from communication-oriented business process models" (Gonzalez et al., 2011).

Your task is to:
1. Parse the provided BPMN 2.0 XML content.
2. Extract message structures stored as JSON strings within <bpmn:documentation> tags associated with relevant BPMN elements.
3. Identify the processing order of these messages based on sequence flow connections.
4. Apply the derivation rules R1-R26 incrementally to build a UML Class Diagram.
5. Generate a single, complete UML Class Diagram definition using PlantUML syntax.

Important derivation behavior:
- Create classes from root message structures when they are not marked as extensions.
- Extend existing classes when the first Reference Field has "extends": true.
- Add attributes from Data Field elements.
- Create relationships from nested structures, aggregations, iterations and reference fields.
- Use appropriate cardinalities.
- Merge duplicated classes into a single class definition.
- Define each relationship only once.
- Ensure the final diagram represents connected domain entities when possible.

Output rules:
- Return only valid PlantUML.
- Do not include explanations.
- Do not include markdown.
- Do not wrap the answer in code fences.
- Start with @startuml.
- Include: skinparam ClassAttributeIconStyle none
- End with @enduml.
`.trim();

    const userPrompt = dataFieldsString
      ? `INPUT BPMN XML CONTENT:\n\n${dataFieldsString}`
      : "INPUT BPMN XML CONTENT:\n\n[No se proporcionó contenido BPMN XML]";

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

    logger.log(`Respuesta de Claude recibida: ${plantUMLText.length} caracteres`);
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