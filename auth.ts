import { MongoDBAdapter } from '@auth/mongodb-adapter';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectToDatabase } from './lib/db';
import client from './lib/db/client';
import User from './lib/db/models/user.model';
import NextAuth, { type DefaultSession } from 'next-auth';
import authConfig from './auth.config';

declare module 'next-auth' {
  interface Session {
    user: {
      role: string;
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: {
    signIn: '/sign-in',
    newUser: '/sign-up',
    error: '/sign-in',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  adapter: MongoDBAdapter(client),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        await connectToDatabase();

        // Check if credentials are provided
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Find the user in the database
        const user = await User.findOne({ email: credentials.email });

        // Verify the password
        if (user && user.password) {
          const isMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (isMatch) {
            return {
              id: user._id.toString(),
              name: user.name || user.email.split('@')[0], // Fallback to email if name is missing
              email: user.email,
              role: user.role || 'user', // Default role if not specified
            };
          }
        }

        // Return null if credentials are invalid
        return null;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      // Add user details to the token
      if (user) {
        token.id = user.id;
        token.name = user.name || user.email?.split('@')[0]; // Fallback to email if name is missing
        token.role = (user as { role: string }).role || 'user'; // Default role if not specified
      }

      // Update token if session is updated
      if (trigger === 'update' && session?.user?.name) {
        token.name = session.user.name;
      }

      return token;
    },
    session: async ({ session, token }) => {
      // Add token details to the session
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.name = token.name as string;
      }

      return session;
    },
  },
});