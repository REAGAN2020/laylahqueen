import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'
import { auth } from '@/auth'

// Ensure the UploadThing secret is loaded
if (!process.env.UPLOADTHING_SECRET) {
  throw new Error("UPLOADTHING_SECRET is missing in environment variables.");
}

const f = createUploadthing()

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: '4MB' } })
    .middleware(async () => {
      const session = await auth()

      if (!session) throw new UploadThingError('Unauthorized')

      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("File uploaded successfully:", file.url);
      return { uploadedBy: metadata.userId }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter

