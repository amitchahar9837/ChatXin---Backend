import { z } from "zod";

export const signupSchema = z.object({
  fullName: z
    .string({ required_error: "The fullName field is required." })
    .trim()
    .min(3, "The fullName field must be at least 3 characters long.")
    .max(30, "The fullName field must be at most 30 characters long.")
    .regex(/^[a-zA-Z ]+$/, "The fullName field must contain only letters."),
  email: z
    .string({ required_error: "The email field is required." })
    .trim()
    .email("The email is not valid."),
  password: z
    .string({ required_error: "The password field is required." })
    .min(6, "The password must be at least 6 characters long.")
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d).{6,}$/,
      "The password must contain at least one letter and one number.",
    ),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: "The email field is required." })
    .trim()
    .email("The email is not valid."),
  password: z.string({ required_error: "The password field is required." }),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(3).max(30).optional(),
  bio: z.string().max(150).optional(),
  profilePic: z.string().optional(),
});
