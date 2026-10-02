import type { z } from 'zod';
import type { RECOVERY_METHODS } from './auth.schema';
import type {
  AccountMessageSchema,
  ForgotPasswordFormSchema,
  RecoverWithPasswordFormSchema,
  RecoverWithTotpFormSchema,
  ResetPasswordFormSchema,
  SignInFormSchema,
  SignUpFormSchema,
} from './auth.schema';

export type TSignInForm = z.output<typeof SignInFormSchema>;
export type TSignUpForm = z.output<typeof SignUpFormSchema>;
export type TForgotPasswordForm = z.output<typeof ForgotPasswordFormSchema>;
export type TResetPasswordForm = z.output<typeof ResetPasswordFormSchema>;
export type TAccountMessage = z.output<typeof AccountMessageSchema>;
export type TRecoverWithTotpForm = z.output<typeof RecoverWithTotpFormSchema>;
export type TRecoverWithPasswordForm = z.output<typeof RecoverWithPasswordFormSchema>;
export type TRecoveryMethod = (typeof RECOVERY_METHODS)[number];
