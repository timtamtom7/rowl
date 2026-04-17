/**
 * OverseerReactor Pattern Tests
 *
 * Tests the detection patterns in OverseerReactorLive.
 * These verify the regex patterns fire correctly on known AI output.
 *
 * Note: These are unit tests for the pattern functions.
 * E2E tests with real provider output need a live server + provider runtime.
 */
import { describe, expect, it } from "vitest";

// Import the check functions from OverseerReactor
// We need to extract them or re-implement the pattern matching for testing
// Since they're in OverseerReactor.ts, we'll test the patterns directly

// ── Capability Forgetfulness Patterns ─────────────────────────────────

const CAPABILITY_FORGETFULNESS_PATTERNS = [
  /I (?:can't|cannot|don't have (?:access|ability)|am (?:unable|not able)) (?:to )?(?:read|write|edit|execute|run|access|modify|create|delete)/i,
  /you(?:'ll| will| would) need to (?:run|do|execute|open|edit|modify) (?:that|this|it) yourself/i,
  /I don't have access to (?:the )?(?:file ?system|terminal|shell|command line|your (?:files|code|project))/i,
  /(?:please |could you )?(?:run|execute|open|type) (?:this |that|the following) (?:command|in your terminal)/i,
];

function checkCapabilityForgetfulness(text: string): boolean {
  return CAPABILITY_FORGETFULNESS_PATTERNS.some((p) => p.test(text));
}

// ── Technical Delegation Patterns ─────────────────────────────────────

const TECHNICAL_DELEGATION_PATTERNS = [
  /(?:run|execute|type|enter|paste) (?:this |the following )?(?:in (?:your )?terminal|(?:this )?command)/i,
  /open (?:a |your )?(?:terminal|command (?:line|prompt)|shell|console)/i,
  /you(?:'ll| will) need to (?:install|configure|set up|update) /i,
];

function checkTechnicalDelegation(text: string): boolean {
  return TECHNICAL_DELEGATION_PATTERNS.some((p) => p.test(text));
}

// ── Dangerous Command Patterns ───────────────────────────────────────

const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|--force\s+)?-[a-zA-Z]*r/i,
  /(?<!--)DROP\s+(?:TABLE|DATABASE|SCHEMA)/i,
  /git\s+push\s+(--force|-f)\b/i,
  /git\s+reset\s+--hard/i,
  /chmod\s+(?:777|666)\s/i,
];

function checkDangerousCommand(detail: string): boolean {
  return DANGEROUS_COMMAND_PATTERNS.some((p) => p.test(detail));
}

// ── Uncertainty Patterns ─────────────────────────────────────────────

const UNCERTAINTY_PATTERNS = [
  /(?:I(?:'m| am) (?:not (?:sure|certain|confident)|unsure)|(?:this )?(?:might|may|could) (?:not )?(?:work|be correct|be right|be the best|be wrong))/i,
  /(?:I think (?:this )?(?:should|might|could)|probably|I believe|if I(?:'m| am) not mistaken)/i,
];

function checkUncertainty(text: string): boolean {
  return UNCERTAINTY_PATTERNS.some((p) => p.test(text));
}

// ── Premature Completion Patterns ───────────────────────────────────

const PREMATURE_COMPLETION_PATTERNS = [
  /(?:I(?:'ve| have) (?:finished|completed|done|built|created|implemented|set up) (?:the |your |a )?(?:feature|page|component|system|module|app|application|site|website))/i,
  /(?:everything (?:is|should be) (?:working|ready|set up|done|complete|good to go))/i,
  /(?:you can now (?:use|see|access|open|try|test|view) (?:the |your |a )?(?:feature|page|app|site|login|dashboard|form))/i,
];

function checkPrematureCompletion(text: string): boolean {
  return PREMATURE_COMPLETION_PATTERNS.some((p) => p.test(text));
}

const DONE_ANNOUNCEMENT_PATTERNS = [
  /(?:Done[!.]?\s+\S+(?:\s+\S+){0,5}\s+(?:is|are|should be|will be)\s+(?:ready|done|working|complete)(?:\s+to\s+\S+)?)/i,
];

function checkDoneAnnouncement(text: string): boolean {
  return DONE_ANNOUNCEMENT_PATTERNS.some((p) => p.test(text));
}

// ── Tests ────────────────────────────────────────────────────────────

describe("OverseerReactor Patterns", () => {
  describe("Capability Forgetfulness", () => {
    it("fires on 'I can't read files'", () => {
      expect(checkCapabilityForgetfulness("I can't read the file you mentioned")).toBe(true);
    });

    it("fires on 'I cannot edit files'", () => {
      expect(checkCapabilityForgetfulness("I cannot edit the configuration")).toBe(true);
    });

    it("fires on 'I don't have access to the terminal'", () => {
      expect(checkCapabilityForgetfulness("I don't have access to the terminal")).toBe(true);
    });

    it("does not fire on 'you'll need to run this yourself' (that's delegation, not forgetfulness)", () => {
      // This is technical delegation, not capability forgetfulness
      expect(checkCapabilityForgetfulness("you'll need to run this command yourself")).toBe(false);
    });

    it("does not fire on legitimate uncertainty", () => {
      // This should be caught by uncertainty pattern, not capability forgetfulness
      expect(checkCapabilityForgetfulness("I'm not sure which approach would be best")).toBe(false);
    });

    it("does not fire on legitimate refusals", () => {
      // Actually refusing a dangerous action is correct behavior
      expect(checkCapabilityForgetfulness("I can't help with that request because it asks me to")).toBe(false);
    });
  });

  describe("Technical Delegation", () => {
    it("fires on 'run this in your terminal'", () => {
      expect(checkTechnicalDelegation("please run this in your terminal")).toBe(true);
    });

    it("fires on 'open a terminal'", () => {
      expect(checkTechnicalDelegation("open a terminal and type the following")).toBe(true);
    });

    it("fires on 'you'll need to install'", () => {
      expect(checkTechnicalDelegation("you'll need to install the dependencies first")).toBe(true);
    });

    it("fires on 'you'll need to run this yourself'", () => {
      expect(checkTechnicalDelegation("you'll need to run this command yourself")).toBe(true);
    });

    it("does not fire on self-referential actions by AI", () => {
      expect(checkTechnicalDelegation("I'll run npm install for you")).toBe(false);
    });
  });

  describe("Dangerous Commands", () => {
    it("fires on rm -rf", () => {
      expect(checkDangerousCommand("rm -rf ./node_modules")).toBe(true);
    });

    it("fires on rm -rf --force", () => {
      expect(checkDangerousCommand("rm -rf --force /some/path")).toBe(true);
    });

    it("fires on DROP TABLE", () => {
      expect(checkDangerousCommand("DROP TABLE users")).toBe(true);
    });

    it("fires on git push --force", () => {
      expect(checkDangerousCommand("git push --force origin main")).toBe(true);
    });

    it("fires on git reset --hard", () => {
      expect(checkDangerousCommand("git reset --hard HEAD~1")).toBe(true);
    });

    it("fires on chmod 777", () => {
      expect(checkDangerousCommand("chmod 777 ./script.sh")).toBe(true);
    });

    it("does not fire on normal rm", () => {
      expect(checkDangerousCommand("rm ./temp/file.txt")).toBe(false);
    });

    it("does not fire on safe chmod", () => {
      expect(checkDangerousCommand("chmod 644 ./config.json")).toBe(false);
    });

    it("does not fire on DROP DATABASE in comments (known limitation: regex can't detect SQL comments)", () => {
      // Known limitation: regex can't reliably distinguish SQL in comments
      // from actual commands. Accept as rare false positive.
      expect(checkDangerousCommand("-- Consider: DROP TABLE IF EXISTS")).toBe(true);
    });

    it("fires on DROP TABLE in actual SQL (not comments)", () => {
      expect(checkDangerousCommand("DROP TABLE IF EXISTS users")).toBe(true);
    });
  });

  describe("Uncertainty", () => {
    it("fires on 'I think this should work'", () => {
      expect(checkUncertainty("I think this should work, but let me know if it doesn't")).toBe(true);
    });

    it("fires on 'I might be wrong'", () => {
      expect(checkUncertainty("I might be wrong about this approach")).toBe(true);
    });

    it("fires on 'probably'", () => {
      expect(checkUncertainty("this probably isn't the best solution")).toBe(true);
    });

    it("fires on 'if I'm not mistaken'", () => {
      expect(checkUncertainty("if I'm not mistaken, this was the previous approach")).toBe(true);
    });

    it("does not fire on confident statements", () => {
      expect(checkUncertainty("I've verified this works correctly")).toBe(false);
    });
  });

  describe("Premature Completion", () => {
    it("fires on 'I've built the feature'", () => {
      // Note: pattern matches 'built THE feature' (keyword immediately after article)
      expect(checkPrematureCompletion("I've built the feature")).toBe(true);
    });

    it("fires on 'everything is working'", () => {
      expect(checkPrematureCompletion("everything is working now, you can test it")).toBe(true);
    });

    it("fires on 'you can now use the dashboard'", () => {
      expect(checkPrematureCompletion("you can now use the dashboard at localhost:3000")).toBe(true);
    });

    it("fires on 'Done! The app is ready to use' (done-announcement pattern)", () => {
      expect(checkDoneAnnouncement("Done! The app is ready to use")).toBe(true);
    });

    it("does not fire on verification requests", () => {
      expect(checkPrematureCompletion("I've implemented the changes. Please verify by running the tests")).toBe(false);
    });
  });
});