import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "rankyatra-secret-key";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminPermissions: string[];
  isBlocked: boolean;
  canPostReels: boolean;
  preferences: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin,
      adminPermissions: user.adminPermissions,
      isBlocked: user.isBlocked,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.id));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    if (user.isBlocked) {
      res.status(403).json({ error: "Account blocked" });
      return;
    }
    if (user.bannedUntil && user.bannedUntil > new Date()) {
      res.status(403).json({
        error: "banned",
        bannedUntil: user.bannedUntil.toISOString(),
        banReason: user.banReason ?? "Account temporarily suspended",
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin ?? false,
      adminPermissions: (user.adminPermissions as string[]) ?? [],
      isBlocked: user.isBlocked,
      canPostReels: user.canPostReels ?? false,
      preferences: (user.preferences as string[]) ?? [],
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: "Super admin access required" });
      return;
    }
    next();
  });
}

// requirePermission checks: super admin always passes, sub-admin needs the specific permission
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await requireAuth(req, res, async () => {
      if (!req.user?.isAdmin) {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      if (req.user.isSuperAdmin || req.user.adminPermissions.includes(permission)) {
        next();
        return;
      }
      res.status(403).json({ error: `You don't have permission to manage ${permission}` });
    });
  };
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.id));
    if (user && !user.isBlocked) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin ?? false,
        adminPermissions: (user.adminPermissions as string[]) ?? [],
        isBlocked: user.isBlocked,
        canPostReels: user.canPostReels ?? false,
        preferences: (user.preferences as string[]) ?? [],
      };
    }
  } catch {
    // ignore
  }
  next();
}
