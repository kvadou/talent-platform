import { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

// Allowed email domains
const ALLOWED_DOMAINS = ['acmetalent.com', 'chessat3.sg'];

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // Check domain restriction
      const domain = user.email.split('@')[1];
      if (!ALLOWED_DOMAINS.includes(domain)) {
        return '/auth/unauthorized?error=domain';
      }

      // Upsert user in database
      try {
        const nameParts = (user.name ?? '').split(' ');
        const firstName = nameParts[0] ?? 'User';
        const lastName = nameParts.slice(1).join(' ') || '';

        const existing = await prisma.user.findFirst({
          where: { email: user.email },
        });

        if (existing) {
          // Update existing user
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              firstName,
              lastName,
              profileImageUrl: user.image || existing.profileImageUrl,
            },
          });
        } else {
          // Create new user
          await prisma.user.create({
            data: {
              email: user.email,
              firstName,
              lastName,
              role: 'RECRUITER',
              organization: {
                connectOrCreate: {
                  where: { id: 'stc-org' },
                  create: { id: 'stc-org', name: 'Acme Talent' },
                },
              },
            },
          });
        }
      } catch (error) {
        console.error('Error upserting user:', error);
        // Still allow sign in even if DB update fails
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;

        // Fetch user from database to get role and id
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true, profileImageUrl: true },
        });

        if (dbUser) {
          (session.user as any).id = dbUser.id;
          (session.user as any).role = dbUser.role;

          // Sync Google profile image to DB if missing
          if (!dbUser.profileImageUrl && token.picture) {
            prisma.user.update({
              where: { id: dbUser.id },
              data: { profileImageUrl: token.picture as string },
            }).catch(() => {});
          }
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
};

/**
 * Get the current session on the server side.
 * Use this in API routes and Server Components.
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Require authentication and return the user.
 * Throws if not authenticated.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.email) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

/**
 * Get the current user from the database.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user?.email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email: session.user.email },
  });
}

/**
 * Ensure user exists in database and return their ID.
 * Creates the user if they don't exist.
 */
export async function ensureUser() {
  const session = await getSession();
  if (!session?.user?.email) {
    return null;
  }

  const email = session.user.email;
  const nameParts = (session.user.name ?? '').split(' ');
  const firstName = nameParts[0] ?? 'User';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Create new user
    user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role: 'RECRUITER',
        organization: {
          connectOrCreate: {
            where: { id: 'stc-org' },
            create: { id: 'stc-org', name: 'Acme Talent' },
          },
        },
      },
    });
  }

  return user;
}
