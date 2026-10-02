// Input limits are not a prompt-injection detector. Do not censor reports of violence.
export const SafetyGuard = {
  validateUserInput(text: unknown) {
    return {
      isSafe:
        typeof text === "string" &&
        text.trim().length > 0 &&
        text.length <= 3000,
    };
  },
  validateAiOutput<T>(step: T): T {
    return step;
  },
};
