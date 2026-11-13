import prisma from "../../lib/prisma.js";
import bcrypt from "bcrypt";

export interface RegisterOwnerInput {
  name: string;
  email: string;
  phone?: string | null | undefined;
  businessName?: string | null | undefined;
  password: string;
}

export type RegisterOwnerResult =
  | {
      status: "SUCCESS";
      owner: {
        id: number;
        name: string;
        email: string;
        phone: string | null;
        businessName: string | null;
        createdAt: Date;
      };
    }
  | { status: "EMAIL_EXISTS" }
  | { status: "PHONE_EXISTS" };

export interface VerifyOwnerLoginResult {
  isAuthenticated: boolean;
  ownerId?: number;
  ownerName: string;
  email?: string;
  businessName?: string | null;
}

export interface UpdateProfileInput {
  ownerId: number;
  name?: string | undefined;
  phone?: string | undefined;
  businessName?: string | null | undefined;
}

export type UpdateProfileResult =
  | {
      status: "SUCCESS";
      owner: {
        id: number;
        name: string;
        email: string;
        phone: string | null;
        businessName: string | null;
      };
    }
  | { status: "NOT_FOUND" }
  | { status: "PHONE_EXISTS" };

export interface ChangePasswordInput {
  ownerId: number;
  currentPassword: string;
  newPassword: string;
}

export type ChangePasswordResult =
  | { status: "SUCCESS" }
  | { status: "NOT_FOUND" }
  | { status: "INVALID_CURRENT_PASSWORD" };

export class AuthService {
  /**
   * Fetch current owner profile freshly from DB
   */
  async getOwnerProfile(ownerId: number) {
    return await prisma.owner.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        businessName: true,
      },
    });
  }

  /**
   * Update profile settings for authenticated owner
   */
  async updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
    const { ownerId, name, phone, businessName } = input;

    const existingOwner = await prisma.owner.findUnique({
      where: { id: ownerId },
    });

    if (!existingOwner) {
      return { status: "NOT_FOUND" };
    }

    if (phone && phone !== existingOwner.phone) {
      const conflictingOwner = await prisma.owner.findUnique({
        where: { phone },
      });
      if (conflictingOwner && conflictingOwner.id !== ownerId) {
        return { status: "PHONE_EXISTS" };
      }
    }

    const updated = await prisma.owner.update({
      where: { id: ownerId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(businessName !== undefined ? { businessName } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        businessName: true,
      },
    });

    return {
      status: "SUCCESS",
      owner: updated,
    };
  }

  /**
   * Change password for authenticated owner
   */
  async changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
    const { ownerId, currentPassword, newPassword } = input;

    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return { status: "NOT_FOUND" };
    }

    const isValid = await bcrypt.compare(currentPassword, owner.password);
    if (!isValid) {
      return { status: "INVALID_CURRENT_PASSWORD" };
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await prisma.owner.update({
      where: { id: ownerId },
      data: {
        password: hashedPassword,
      },
    });

    return { status: "SUCCESS" };
  }

  /**
   * Check registration status. In SaaS multi-tenant mode, registration is always open.
   */
  async getRegistrationStatus(): Promise<{ registrationOpen: boolean; hasOwner: boolean }> {
    const ownerCount = await prisma.owner.count();
    return {
      registrationOpen: true,
      hasOwner: ownerCount > 0,
    };
  }

  /**
   * Register a new boutique owner independently.
   * Multiple owners can register with their own unique email and phone.
   */
  async registerOwner(input: RegisterOwnerInput): Promise<RegisterOwnerResult> {
    const { name, email, phone, businessName, password } = input;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone?.trim() || null;

    // Check for existing email conflict
    const existingEmail = await prisma.owner.findUnique({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      return { status: "EMAIL_EXISTS" };
    }

    // Check for existing phone conflict if phone provided
    if (cleanPhone) {
      const existingPhone = await prisma.owner.findUnique({
        where: { phone: cleanPhone },
      });
      if (existingPhone) {
        return { status: "PHONE_EXISTS" };
      }
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    try {
      const newOwner = await prisma.owner.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          businessName: businessName?.trim() || null,
          password: hashedPassword,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          businessName: true,
          createdAt: true,
        },
      });

      return {
        status: "SUCCESS",
        owner: newOwner,
      };
    } catch (err: any) {
      if (err.code === "P2002") {
        const target = Array.isArray(err.meta?.target)
          ? err.meta.target.join(",")
          : String(err.meta?.target || "");
        if (target.includes("phone")) {
          return { status: "PHONE_EXISTS" };
        }
        return { status: "EMAIL_EXISTS" };
      }
      throw err;
    }
  }

  /**
   * Authorize owner login against database record.
   * Returns ownerId for proper tenant-scoped JWT generation.
   */
  async verifyOwnerCredentials(
    email: string,
    plainPassword: string
  ): Promise<VerifyOwnerLoginResult> {
    // 1. Check database first
    const dbOwner = await prisma.owner.findUnique({
      where: { email },
    });

    if (dbOwner) {
      const isMatch = await bcrypt.compare(plainPassword, dbOwner.password);
      return {
        isAuthenticated: isMatch,
        ownerId: dbOwner.id,
        ownerName: dbOwner.name,
        email: dbOwner.email,
        businessName: dbOwner.businessName,
      };
    }

    // 2. Fallback: Only permitted in non-production environments if OWNER_PASSWORD is explicitly configured
    const isProduction = process.env.NODE_ENV === "production";
    const configuredEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const configuredPassword = process.env.OWNER_PASSWORD?.trim();

    if (
      !isProduction &&
      configuredEmail &&
      configuredPassword &&
      configuredPassword.length >= 8 &&
      email.toLowerCase() === configuredEmail
    ) {
      // Find or create fallback owner in database so ownerId is guaranteed
      let fallbackOwner = await prisma.owner.findUnique({
        where: { email: configuredEmail },
      });

      if (!fallbackOwner) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(configuredPassword, saltRounds);
        fallbackOwner = await prisma.owner.create({
          data: {
            name: "Owner",
            email: configuredEmail,
            password: hashedPassword,
          },
        });
      }

      const isMatch = await bcrypt.compare(plainPassword, fallbackOwner.password);
      if (isMatch) {
        return {
          isAuthenticated: true,
          ownerId: fallbackOwner.id,
          ownerName: fallbackOwner.name,
          email: fallbackOwner.email,
          businessName: fallbackOwner.businessName,
        };
      }
    }

    return {
      isAuthenticated: false,
      ownerName: "Owner",
    };
  }
}

export const authService = new AuthService();
