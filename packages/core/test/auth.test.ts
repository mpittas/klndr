import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, authErrorMessage, signInProblem, signUpProblem } from "../src/index";

const firebase = (code: string, message = "Firebase: Error") => Object.assign(new Error(message), { code });

describe("authErrorMessage", () => {
  it("says the same thing as the web's login page", () => {
    for (const code of ["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential"]) {
      expect(authErrorMessage(firebase(code))).toBe("Invalid email or password. Please verify your credentials.");
    }
    expect(authErrorMessage(firebase("auth/invalid-email"))).toBe("Please enter a valid email address.");
    expect(authErrorMessage(firebase("auth/too-many-requests"))).toBe(
      "Too many failed attempts. Please try again in a few minutes.",
    );
  });

  it("explains a sign-in method or domain Firebase has not enabled", () => {
    expect(authErrorMessage(firebase("auth/operation-not-allowed"))).toBe(
      "That sign-in method isn't available yet. Please use another one.",
    );
    expect(authErrorMessage(firebase("auth/unauthorized-domain"))).toContain("authorized domains");
  });

  it("says the same thing as the web's sign-up page", () => {
    expect(authErrorMessage(firebase("auth/email-already-in-use"), "sign-up")).toBe(
      "An account with this email already exists. Please log in instead.",
    );
    expect(authErrorMessage(firebase("auth/weak-password"), "sign-up")).toBe(
      `Password is too weak. Please use at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  });

  it("explains linking Apple to the account that already has the data", () => {
    expect(authErrorMessage(firebase("auth/account-exists-with-different-credential"))).toMatch(/connect this one from your profile/);
    expect(authErrorMessage(firebase("auth/credential-already-in-use"))).toMatch(/another klndr\. account/);
    expect(authErrorMessage(firebase("auth/provider-already-linked"))).toBe(
      "That sign-in method is already connected to your account.",
    );
    expect(authErrorMessage(firebase("auth/popup-closed-by-user"))).toBe("The sign-in window closed before it finished.");
  });

  it("only blames the credentials when someone was signing in", () => {
    expect(authErrorMessage(firebase("auth/email-already-in-use"))).toBe("Firebase: Error");
    expect(authErrorMessage(firebase("auth/invalid-credential"), "sign-up")).toBe("Firebase: Error");
    expect(authErrorMessage(firebase("auth/user-not-found"), "reset")).toBe(
      "Could not send the reset email. Please try again.",
    );
  });

  it("explains a lost connection", () => {
    expect(authErrorMessage(firebase("auth/network-request-failed"), "sign-up")).toMatch(/connection/);
  });

  it("keeps a readable message and falls back for anything else", () => {
    expect(authErrorMessage(new Error("Play services are out of date"))).toBe("Play services are out of date");
    expect(authErrorMessage(undefined)).toBe("An unexpected error occurred while logging in.");
    expect(authErrorMessage({}, "sign-up")).toBe("Failed to create account. Please try again.");
    expect(authErrorMessage(firebase("auth/something-new", ""), "reset")).toBe(
      "Could not send the reset email. Please try again.",
    );
  });
});

describe("form checks", () => {
  const good = { name: "Ada", email: "ada@example.com", password: "longenough", confirmPassword: "longenough" };

  it("accepts a complete sign-up and names the first problem otherwise", () => {
    expect(signUpProblem(good)).toBeNull();
    expect(signUpProblem({ ...good, name: "  " })).toBe("Please fill in all required fields.");
    expect(signUpProblem({ ...good, email: "" })).toBe("Please fill in all required fields.");
    expect(signUpProblem({ ...good, password: "short", confirmPassword: "short" })).toBe(
      "Password must be at least 8 characters long.",
    );
    expect(signUpProblem({ ...good, confirmPassword: "different1" })).toBe("Passwords do not match.");
  });

  it("wants both fields to sign in", () => {
    expect(signInProblem({ email: "a@b.c", password: "x" })).toBeNull();
    expect(signInProblem({ email: " ", password: "x" })).toBe("Please fill in all fields.");
    expect(signInProblem({ email: "a@b.c", password: "" })).toBe("Please fill in all fields.");
  });
});
