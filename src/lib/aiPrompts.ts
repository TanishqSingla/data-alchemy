import { BusinessRule } from "./types";

export function buildAutoFixPrompt(entity: string, rows: any[], errors: any[], businessRules: BusinessRule[] = []) {
  const applicableRules = businessRules.filter(rule => 
    rule.isActive && (rule.entityType === "all" || rule.entityType === entity)
  );

  let rulesSection = "";
  if (applicableRules.length > 0) {
    rulesSection = `\n\nIMPORTANT: Follow these business rules when fixing data:\n${applicableRules
      .sort((a, b) => b.priority - a.priority)
      .map(rule => `- ${rule.name}: ${rule.rule}`)
      .join('\n')}\n`;
  }

  return `You are a data cleaning assistant. Your job is to fix errors in a ${entity} table.${rulesSection}

Here is the table data (as JSON array):
${JSON.stringify(rows, null, 2)}

Here are the validation errors (with row numbers and fields):
${JSON.stringify(errors, null, 2)}

For each row with errors, suggest a corrected version. 
- If a value is missing, fill it with a plausible guess.
- If a value is malformed (e.g. not a number, invalid JSON), fix the format.
- If an ID is duplicated, make it unique by appending a suffix.
- If a reference is unknown, try to match it to the closest valid value or remove it.
- If a value is out of range, bring it into the valid range.
- If a JSON field is broken, repair the JSON.

Return ONLY the corrected table as a JSON array, with the same number of rows and columns as the input.`;
}

export function buildInlineFixPrompt(field: string, value: string, entity: string, businessRules: BusinessRule[] = []) {
  const applicableRules = businessRules.filter(rule => 
    rule.isActive && 
    (rule.entityType === "all" || rule.entityType === entity) &&
    (!rule.field || rule.field === field)
  );

  let rulesSection = "";
  if (applicableRules.length > 0) {
    rulesSection = `\n\nIMPORTANT: Follow these business rules when fixing this field:\n${applicableRules
      .sort((a, b) => b.priority - a.priority)
      .map(rule => `- ${rule.name}: ${rule.rule}`)
      .join('\n')}\n`;
  }

  return `You are a data cleaning assistant. Suggest 1-3 possible values for this field:${rulesSection}

Entity: ${entity}
Field: ${field}
Current value: ${value}

Suggest appropriate values based on the field type and any business rules. Return a JSON object with a 'choices' key containing an array of objects with 'label' and 'value' properties.`;
} 