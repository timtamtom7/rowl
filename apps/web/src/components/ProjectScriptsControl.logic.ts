export interface ProjectScriptValidationErrors {
  name?: string;
  command?: string;
  form?: string;
}

export function validateProjectScriptInput(input: {
  name: string;
  command: string;
}): ProjectScriptValidationErrors {
  const errors: ProjectScriptValidationErrors = {};

  if (input.name.trim().length === 0) {
    errors.name = "Name is required.";
  }

  if (input.command.trim().length === 0) {
    errors.command = "Command is required.";
  }

  return errors;
}

export function clearProjectScriptValidationFields(
  errors: ProjectScriptValidationErrors,
  fields: ReadonlyArray<keyof ProjectScriptValidationErrors>,
): ProjectScriptValidationErrors {
  let changed = false;
  const nextErrors: ProjectScriptValidationErrors = { ...errors };

  for (const field of fields) {
    if (!(field in nextErrors)) {
      continue;
    }
    changed = true;
    delete nextErrors[field];
  }

  return changed ? nextErrors : errors;
}

export function getFirstInvalidProjectScriptField(
  errors: ProjectScriptValidationErrors,
): "name" | "command" | null {
  if (errors.name) {
    return "name";
  }
  if (errors.command) {
    return "command";
  }
  return null;
}
