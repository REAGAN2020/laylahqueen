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
        try {
          await connectToDatabase();

          if (!credentials) {
            console.log('No credentials provided');
            return null;
          }

          const user = await User.findOne({ email: credentials.email });
          if (!user || !user.password) {
            console.log('User not found or password missing');
            return null;
          }

          const isMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          if (!isMatch) {
            console.log('Password does not match');
            return null;
          }

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error('Error during authorization:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id;
        token.name = user.name || user.email!.split('@')[0];
        token.role = (user as { role: string }).role;
      }

      if (trigger === 'update' && session?.user?.name) {
        token.name = session.user.name;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.role = token.role as string;
      session.user.name = token.name;
      return session;
    },
  },
});