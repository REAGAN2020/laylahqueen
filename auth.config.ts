// import type { NextAuthConfig } from 'next-auth'

// // Notice this is only an object, not a full Auth.js instance
// export default {
//   providers: [],
//   callbacks: {
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     authorized({ request, auth }: any) {
//       const protectedPaths = [
//         /\/checkout(\/.*)?/,
//         /\/account(\/.*)?/,
//         /\/admin(\/.*)?/,
//       ]
//       const { pathname } = request.nextUrl
//       if (protectedPaths.some((p) => p.test(pathname))) return !!auth
//       return true
//     },
//   },
// } satisfies NextAuthConfig


import type { NextAuthConfig } from 'next-auth';

export default {
  providers: [], // Add providers here if needed
  trustHost: true, // Allow all hosts (for development and production)
  callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authorized({ request, auth }: any) {
          const protectedPaths = [
            /\/checkout(\/.*)?/,
            /\/account(\/.*)?/,
            /\/admin(\/.*)?/,
          ]
          const { pathname } = request.nextUrl
          if (protectedPaths.some((p) => p.test(pathname))) return !!auth
          return true
        },
      },
    } satisfies NextAuthConfig