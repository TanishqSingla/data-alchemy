export function buildAutoFixPrompt(entity: string, rows: any[], errors: any[]) {
  return `You are a data cleaning assistant. Your job is to fix errors in a ${entity} table. 

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