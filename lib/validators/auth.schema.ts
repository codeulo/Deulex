import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                  REGISTER                                  */
/* -------------------------------------------------------------------------- */
// Password Requirements:
// - Minimum 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one number
// - At least one special character
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const registerSchema = z.object({
  email: z.email("Invalid email format").max(255, "Email is too long"),
  password: z
    .string()
    .nonempty("Password is required")
    .min(8, "Password must be at least 8 characters long")
    .regex(passwordRegex, {
      message:
        "Password must include uppercase, lowercase, number, and special character",
    }),
  phone: z.string().max(20, "Phone is too long"),
});

// Typescript type inference (optional)
export type RegisterSchemaType = z.infer<typeof registerSchema>;

/* -------------------------------------------------------------------------- */
/*                                    LOGIN                                   */
/* -------------------------------------------------------------------------- */
export const loginSchema = z.object({
  email: z.email("Invalid email format").max(255, "Email too long"),
  password: z
    .string()
    .nonempty("Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password too long"),
});

/* -------------------------------------------------------------------------- */
/*                             TWO-FACTOR VERIFICATION                         */
/* -------------------------------------------------------------------------- */

export const twoFactorVerifySchema = z.object({
  token: z
    .string("2FA code is required")
    .length(6, "2FA code must be 6 digits")
    .regex(/^\d{6}$/, "Invalid 2FA code"),
});

/* -------------------------------------------------------------------------- */
/*                         PASSWORD RESET (REQUEST EMAIL)                      */
/* -------------------------------------------------------------------------- */

export const requestPasswordResetSchema = z.object({
  email: z.string("Email is required").email("Invalid email"),
});

/* -------------------------------------------------------------------------- */
/*                          PASSWORD RESET (PERFORM RESET)                    */
/* -------------------------------------------------------------------------- */

export const resetPasswordSchema = z
  .object({
    new_password: z
      .string("New password is required")
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain number")
      .regex(/[^A-Za-z0-9]/, "Must contain special character"),

    confirm_password: z.string("Confirm password is required"),

    token: z.string("Reset token is required"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

/* -------------------------------------------------------------------------- */
/*                           CHANGE PASSWORD (AUTH ONLY)                       */
/* -------------------------------------------------------------------------- */

export const changePasswordSchema = z.object({
  current_password: z.string("Current password is required").min(6),

  new_password: z
    .string("New password is required")
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
});

/* -------------------------------------------------------------------------- */
/*                           EMAIL VERIFICATION (OPTIONAL)                    */
/* -------------------------------------------------------------------------- */

export const emailVerificationSchema = z.object({
  token: z.string("Verification token is required").min(20),
});

/* -------------------------------------------------------------------------- */
/*                             EXPORT ALL SCHEMAS                             */
/* -------------------------------------------------------------------------- */

export const AuthSchemas = {
  registerSchema,
  loginSchema,
  twoFactorVerifySchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  changePasswordSchema,
  emailVerificationSchema,
};

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;
