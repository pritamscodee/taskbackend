import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma/client.js';
import { WorkspaceRole } from '../generated/prisma/enums.js';

const prisma = new PrismaClient({
  adapter: new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const displayName = (user.name as string | undefined)?.trim();
            const workspaceName = displayName
              ? `${displayName}'s workspace`
              : 'My Workspace';
            await prisma.$transaction(async (tx) => {
              const workspace = await tx.workspace.create({
                data: {
                  name: workspaceName,
                  ownerId: user.id,
                },
              });
              await tx.workspaceMember.create({
                data: {
                  workspaceId: workspace.id,
                  userId: user.id,
                  role: WorkspaceRole.OWNER,
                },
              });
            });
          } catch (error) {
            console.error('Failed to provision personal workspace', error);
          }
        },
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  url: process.env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ].filter((origin): origin is string => Boolean(origin)),
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
    },
  },
});
