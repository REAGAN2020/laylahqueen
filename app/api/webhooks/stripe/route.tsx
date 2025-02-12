import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { sendPurchaseReceipt } from '@/emails'
import Order from '@/lib/db/models/order.model'
import { connectToDatabase } from '@/lib/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export async function POST(req: NextRequest) {
  // Ensure the database is connected before handling the request
  await connectToDatabase()

  let event: Stripe.Event | null = null
  try {
    // Construct the Stripe event from the request
    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature') as string
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('⚠️ Webhook signature verification failed:', error.message)
      return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
    }
    console.error('⚠️ Unknown error during webhook event construction:', error)
    return new NextResponse('Webhook Error: Unknown error', { status: 400 })
  }

  // Handle the 'charge.succeeded' event type
  if (event && event.type === 'charge.succeeded') {
    const charge = event.data.object
    const orderId = charge.metadata?.orderId
    const email = charge.billing_details?.email
    const pricePaidInCents = charge.amount

    if (!orderId) {
      console.error('⚠️ Missing orderId in charge metadata')
      return new NextResponse('Bad Request: Missing orderId', { status: 400 })
    }

    try {
      // Find the order in the database
      const order = await Order.findById(orderId).populate('user', 'email')

      if (!order) {
        console.error('⚠️ Order not found:', orderId)
        return new NextResponse('Bad Request: Order not found', { status: 400 })
      }

      // Update order payment status
      order.isPaid = true
      order.paidAt = new Date()
      order.paymentResult = {
        id: event.id,
        status: 'COMPLETED',
        email_address: email || 'Unknown',  // Fallback in case email is not provided
        pricePaid: (pricePaidInCents / 100).toFixed(2),  // Convert cents to dollars
      }

      await order.save()

      // Send the purchase receipt email
      try {
        await sendPurchaseReceipt({ order })
      } catch (err) {
        console.error('⚠️ Email sending failed:', err)
        // You may want to return an error here if email sending is critical
      }

      return NextResponse.json({
        message: 'updateOrderToPaid was successful',
      })
    } catch (err) {
      console.error('⚠️ Error processing the order:', err)
      return new NextResponse('Internal Server Error: Order processing failed', { status: 500 })
    }
  }

  return new NextResponse('Event type not processed', { status: 200 })
}
