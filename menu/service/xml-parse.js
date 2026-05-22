/**
 * Parsea el XML BPMN y extrae todos los elementos bpmn:documentation que contienen dataFields
 * @param {string} xml - El XML completo del diagrama BPMN
 * @returns {string[]} Un array de strings, cada uno con formato dataFields:{...}
 */
function parseDataFieldsFromXML(xml) {
  var results = [];
  var processedJsonStrings = new Set();
  var normalized = []; // collect normalized messageStructure objects

  try {
    // Buscar todos los elementos <bpmn:documentation> que contienen "dataFields:"
    // Patrón que maneja múltiples líneas y diferentes formatos
    var documentationPattern =
      /<bpmn:documentation[^>]*>dataFields:([\s\S]*?)<\/bpmn:documentation>/g;
    var match;

    while ((match = documentationPattern.exec(xml)) !== null) {
      try {
        // Extraer el contenido entre dataFields: y </bpmn:documentation>
        var content = match[1].trim();

        // Buscar el JSON dentro del contenido
        var jsonStart = content.indexOf("{");
        if (jsonStart === -1) {
          console.warn("No se encontró inicio de JSON en dataFields");
          continue;
        }

        // Extraer el JSON usando balanceo de llaves
        var jsonString = extractBalancedJSON(content, jsonStart);
        if (!jsonString) {
          console.warn("No se pudo extraer JSON balanceado");
          continue;
        }

        // Evitar procesar el mismo JSON dos veces
        var jsonHash = jsonString.replace(/\s+/g, " ").trim();
        if (processedJsonStrings.has(jsonHash)) {
          continue;
        }
        processedJsonStrings.add(jsonHash);

        // Intentar parsear el JSON y normalizar su estructura para derivación UML
        try {
          var parsed = JSON.parse(jsonString);
          var message = parsed.messageStructure || parsed;

          // Normalizar children
          var children =
            message.children && Array.isArray(message.children)
              ? message.children.map(function (ch) {
                  var c = {
                    name: ch.name || ch.id || null,
                    originalType: ch.type || null,
                    type: (ch.type || "").toString(),
                    domain: ch.domain || ch.typeName || null,
                    extends: !!ch.extends || false,
                    multiplicity: null,
                    relation: null,
                    raw: ch,
                  };

                  // Infer simple multiplicity/relationship hints
                  var t = (c.type || "").toLowerCase();
                  if (
                    t.indexOf("iteration") !== -1 ||
                    t.indexOf("list") !== -1
                  ) {
                    c.multiplicity = "*";
                    c.relation = "aggregation";
                  } else if (t.indexOf("aggregation") !== -1) {
                    c.multiplicity = "0..*";
                    c.relation = "aggregation";
                  } else if (t.indexOf("structure") !== -1) {
                    c.multiplicity = "1";
                    c.relation = "composition";
                  } else if (t.indexOf("reference") !== -1) {
                    c.multiplicity = "1";
                    c.relation = "reference";
                  }

                  return c;
                })
              : [];

          var norm = {
            name: message.name || message.subject || null,
            rawName: message.name || message.subject || null,
            description: message.description || null,
            children: children,
            original: parsed,
          };

          normalized.push(norm);
        } catch (e) {
          // Si no pudo parsear, seguimos guardando el string original para compatibilidad
          var dataFieldsString = "dataFields:" + jsonString;
          results.push(dataFieldsString);
          console.warn(
            "No se pudo parsear JSON de dataFields, se mantiene la versión cruda",
          );
          continue;
        }
        // Guardar el JSON original con el prefijo dataFields: (para compatibilidad)
        results.push("dataFields:" + jsonString);
        console.log("✅ DataFields parseado y normalizado exitosamente");
      } catch (parseError) {
        console.error("Error parseando JSON de dataFields:", parseError);
        console.error("Contenido problemático:", match[1].substring(0, 200));
      }
    }
  } catch (error) {
    console.error("Error parseando XML:", error);
  }

  // Devolver la representación normalizada si hay al menos una estructura válida
  if (normalized.length > 0) {
    try {
      return JSON.stringify({ type: "normalized", payload: normalized });
    } catch (e) {
      // Fallback a resultados crudos
      return results;
    }
  }

  // Si no se pudo normalizar nada, devolver los resultados crudos (array)
  return results;
}

/**
 * Extrae un JSON balanceado desde una posición inicial
 * (Tu función helper está perfecta, no necesita cambios)
 */
function extractBalancedJSON(content, startIndex) {
  if (content[startIndex] !== "{") {
    return null;
  }

  var depth = 0;
  var inString = false;
  var escapeNext = false;
  var jsonEnd = startIndex;

  for (var i = startIndex; i < content.length; i++) {
    var char = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  if (depth !== 0) {
    return null; // JSON no balanceado
  }

  return content.substring(startIndex, jsonEnd);
}

module.exports = {
  parseDataFieldsFromXML,
};
