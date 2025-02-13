import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getOrderById } from '@/lib/actions/order.actions'
import PaymentForm from './payment-form'
import Stripe from 'stripe'
import { isValidObjectId } from 'mongoose' // or your ORM's validation

export const metadata = { title: 'Payment' }

const CheckoutPaymentPage = async ({ 
  params 
}: { 
  params: { id: string } 
}) => {
  const { id } = params

  // Validate ID format
  if (!isValidObjectId(id)) notFound()

  const [order, session] = await Promise.all([
    getOrderById(id),
    auth()
  ])

  if (!order) notFound()

  let client_secret = null
  if (order.paymentMethod === 'Stripe' && !order.isPaid) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.totalPrice * 100),
        currency: 'USD',
        metadata: { orderId: id },
        payment_method_types: ['card'] // Explicitly specify payment methods
      })
      client_secret = paymentIntent.client_secret
    } catch (error) {
      console.error('Stripe Payment Intent Error:', error)
      throw new Error('Failed to initialize payment processing')
    }
  }

  return (
    <PaymentForm
      order={order}
      paypalClientId={process.env.PAYPAL_CLIENT_ID || ''}
      clientSecret={client_secret}
      isAdmin={session?.user?.role === 'Admin'}
    />
  )
}

export default CheckoutPaymentPage